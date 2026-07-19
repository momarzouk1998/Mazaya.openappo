import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ============================================================
// DELETE /api/internal-transport/:id
// يحذف قيد النقل الداخلي ويعكس الـ 3 تأثيرات:
//   1) يحذف journal_entry
//   2) يحذف overhead_expense المرتبطة
//   3) لو كان مرتبط بأوردر → ينقص internal_transport_cost
// ============================================================
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('internal_transport', 'delete');
    const { id } = await params;

    const journal = await prisma.journal_entries.findFirst({
      where: { id, entry_type: 'نقل داخلي' },
    });
    if (!journal) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'القيد غير موجود' } },
        { status: 404 }
      );
    }

    const amount = Number(journal.amount);
    const orderId = journal.order_id;

    await prisma.$transaction(async (tx) => {
      // 1) احذف overhead_expense المرتبطة (journal_entry_id FK)
      await tx.overhead_expenses.deleteMany({
        where: { journal_entry_id: id },
      });

      // 2) احذف القيد
      await tx.journal_entries.delete({ where: { id } });

      // 3) عكس internal_transport_cost على الأوردر
      if (orderId) {
        const order = await tx.orders.findUnique({
          where: { id: orderId },
          select: { internal_transport_cost: true },
        });
        if (order) {
          const newCost = Math.max(0, Number(order.internal_transport_cost) - amount);
          await tx.orders.update({
            where: { id: orderId },
            data: { internal_transport_cost: newCost },
          });
          auditLog({
            user_id: user.id, action: 'update', table_name: 'orders', row_id: orderId,
            before: { internal_transport_cost: order.internal_transport_cost },
            after: { internal_transport_cost: newCost },
          });
        }
      }
    });

    auditLog({
      user_id: user.id, action: 'delete',
      table_name: 'journal_entries', row_id: id, before: journal,
    });

    return NextResponse.json({ ok: true, data: { deleted: true, reversed_amount: amount } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message } }, { status: e.status });
    console.error('internal-transport delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/internal-transport/:id
// يعدّل القيد ويعكس الفرق على الأوردر لو تغيّر المبلغ أو الأوردر
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('internal_transport', 'edit');
    const { id } = await params;

    const journal = await prisma.journal_entries.findFirst({
      where: { id, entry_type: 'نقل داخلي' },
    });
    if (!journal) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'القيد غير موجود' } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { amount, payment_method, date, notes, order_id } = body;

    const oldAmount = Number(journal.amount);
    const newAmount = amount !== undefined ? Number(amount) : oldAmount;
    const oldOrderId = journal.order_id;
    const newOrderId = order_id !== undefined ? (order_id || null) : oldOrderId;

    if (newAmount <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'المبلغ يجب أن يكون أكبر من صفر' } },
        { status: 400 }
      );
    }

    const newDesc = notes !== undefined
      ? (newOrderId ? `[نقل داخلي] ${notes || 'نقل داخلي مرتبط بأوردر'}` : `[نقل داخلي] ${notes || 'نقل داخلي'}`)
      : journal.description;

    await prisma.$transaction(async (tx) => {
      // 1) عدّل القيد
      const journalData: any = { updated_at: new Date() };
      if (amount !== undefined) journalData.amount = newAmount;
      if (date) journalData.date = new Date(date);
      if (payment_method) journalData.payment_method = payment_method;
      if (notes !== undefined) journalData.description = newDesc;
      if (order_id !== undefined) journalData.order_id = newOrderId;

      await tx.journal_entries.update({ where: { id }, data: journalData });

      // 2) عدّل overhead_expense المرتبطة
      const overheadData: any = { updated_at: new Date() };
      if (amount !== undefined) overheadData.amount = newAmount;
      if (date) overheadData.date = new Date(date);
      if (payment_method) overheadData.payment_method = payment_method;
      if (notes !== undefined) { overheadData.notes = notes || null; overheadData.description = newDesc; }
      await tx.overhead_expenses.updateMany({ where: { journal_entry_id: id }, data: overheadData });

      // 3) تعديل internal_transport_cost على الأوردرات
      // الأوردر القديم: اطرح منه المبلغ القديم
      if (oldOrderId && (oldOrderId !== newOrderId || oldAmount !== newAmount)) {
        const oldOrder = await tx.orders.findUnique({
          where: { id: oldOrderId }, select: { internal_transport_cost: true },
        });
        if (oldOrder) {
          await tx.orders.update({
            where: { id: oldOrderId },
            data: { internal_transport_cost: Math.max(0, Number(oldOrder.internal_transport_cost) - oldAmount) },
          });
        }
      }

      // الأوردر الجديد: أضف له المبلغ الجديد
      if (newOrderId && (oldOrderId !== newOrderId || oldAmount !== newAmount)) {
        const newOrder = await tx.orders.findUnique({
          where: { id: newOrderId }, select: { internal_transport_cost: true },
        });
        if (newOrder) {
          // لو نفس الأوردر: القيمة اتطرحت فوق، نضيف الجديدة فقط
          // لو أوردر جديد: نضيف للقيمة الحالية
          const base = oldOrderId === newOrderId ? 0 : Number(newOrder.internal_transport_cost);
          await tx.orders.update({
            where: { id: newOrderId },
            data: { internal_transport_cost: base + newAmount },
          });
        }
      }
    });

    auditLog({
      user_id: user.id, action: 'update',
      table_name: 'journal_entries', row_id: id,
      before: journal,
      after: { ...journal, amount: newAmount, order_id: newOrderId },
    });

    return NextResponse.json({ ok: true, data: { updated: true } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message } }, { status: e.status });
    console.error('internal-transport update error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

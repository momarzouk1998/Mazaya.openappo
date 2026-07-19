import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

// ============================================================
// /api/internal-transport — النقل الداخلي
// ============================================================
// بينشئ:
//   1) قيد يومية نوعه "نثريات" → بيخصم من رصيد يومية المصنع
//   2) لو فيه order_id → بيتراكم على order.internal_transport_cost
//
// الفورم: العامل/المبلغ/الطريقة/التاريخ/الأوردر (اختياري)/ملاحظات
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('internal_transport', 'view');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // كل قيود النقل الداخلي (entry_type='نقل داخلي')
    const where: any = {
      entry_type: 'نقل داخلي',
    };

    const [total, entries] = await Promise.all([
      prisma.journal_entries.count({ where }),
      prisma.journal_entries.findMany({
        where,
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    const serialized = entries.map((e: any) => ({ ...e, amount: Number(e.amount) }));

    return NextResponse.json({
      ok: true,
      data: {
        entries: serialized,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('internal_transport', 'add');
    const body = await request.json();
    const { amount, payment_method, date, notes, order_id } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' } },
        { status: 400 }
      );
    }

    const entryDate = date ? new Date(date) : new Date();
    const desc = order_id
      ? `[نقل داخلي] ${notes || 'نقل داخلي مرتبط بأوردر'}`
      : `[نقل داخلي] ${notes || 'نقل داخلي'}`;

    // transaction: قيد يومية + overhead + (لو فيه أوردر) زيادة internal_transport_cost
    const result = await prisma.$transaction(async (tx) => {
      // 1) قيد يومية "نقل داخلي" → بيخصم من يومية المصنع (FACTORY_EXPENSE_TYPES)
      const journalEntry = await tx.journal_entries.create({
        data: {
          date: entryDate,
          entry_type: 'نقل داخلي',
          description: desc,
          amount,
          payment_method: payment_method || 'نقدي',
          order_id: order_id || null,
          created_by: user.id,
        },
      });

      // 2) overhead_expenses (تصنيف "نقل داخلي")
      const expense = await tx.overhead_expenses.create({
        data: {
          date: entryDate,
          category: 'نقل داخلي',
          description: desc,
          amount,
          payment_method: payment_method || 'نقدي',
          journal_entry_id: journalEntry.id,
          created_by: user.id,
          notes: notes || null,
        },
      });

      // 3) لو فيه أوردر، زوّد internal_transport_cost (تراكمي)
      let orderUpdate = null;
      if (order_id) {
        // جب القيمة الحالية أولًا
        const order = await tx.orders.findUnique({
          where: { id: order_id },
          select: { internal_transport_cost: true, order_name: true },
        });
        if (!order) {
          throw new Error('الأوردر غير موجود');
        }
        const newTransport = Number(order.internal_transport_cost) + Number(amount);
        orderUpdate = await tx.orders.update({
          where: { id: order_id },
          data: { internal_transport_cost: newTransport },
        });
      }

      return {
        journal_entry: { ...journalEntry, amount: Number(journalEntry.amount) },
        expense: { ...expense, amount: Number(expense.amount) },
        order: orderUpdate ? { id: orderUpdate.id, internal_transport_cost: Number(orderUpdate.internal_transport_cost) } : null,
      };
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'journal_entries', row_id: result.journal_entry.id, after: result.journal_entry });
    if (result.order) {
      auditLog({ user_id: user.id, action: 'update', table_name: 'orders', row_id: result.order.id, after: result.order });
    }

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

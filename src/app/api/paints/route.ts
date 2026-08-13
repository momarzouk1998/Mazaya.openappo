import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    await requirePermission('journal', 'view');
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '500');
    const order_id = searchParams.get('order_id') || '';

    const where: any = {
      category: 'مصاريف دهانات',
    };

    if (order_id) {
      where.journal_entry = { order_id };
    }

    const expenses = await prisma.overhead_expenses.findMany({
      where,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      take: limit,
      include: {
        journal_entry: {
          include: {
            order: { select: { id: true, order_name: true } },
          },
        },
      },
    });

    const serialized = expenses.map((e: any) => ({
      id: e.id,
      date: e.date,
      description: e.description,
      amount: Number(e.amount),
      payment_method: e.payment_method,
      notes: e.notes,
      journal_entry_id: e.journal_entry_id,
      order_id: e.journal_entry?.order_id || null,
      order_name: e.journal_entry?.order?.order_name || null,
      created_at: e.created_at,
    }));

    return NextResponse.json({
      ok: true,
      data: { items: serialized },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Paints GET error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('journal', 'add');
    const body = await request.json();
    const { amount, payment_method, date, notes, order_id, description } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' } },
        { status: 400 }
      );
    }

    const entryDate = date ? new Date(date) : new Date();
    const desc = description || `[مصاريف دهانات] ${notes || 'مرمات وألوان وتينر'}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1) قيد يومية "مصاريف دهانات" → يخصم في يومية المصنع واليومية العامة
      const journalEntry = await tx.journal_entries.create({
        data: {
          date: entryDate,
          entry_type: 'مصاريف دهانات',
          description: desc,
          amount: Number(amount),
          payment_method: payment_method || 'نقدي',
          order_id: order_id || null,
          created_by: user.id,
          notes: notes || null,
        },
      });

      // 2) overhead_expenses (تصنيف "مصاريف دهانات")
      const expense = await tx.overhead_expenses.create({
        data: {
          date: entryDate,
          category: 'مصاريف دهانات',
          description: desc,
          amount: Number(amount),
          payment_method: payment_method || 'نقدي',
          journal_entry_id: journalEntry.id,
          created_by: user.id,
          notes: notes || null,
        },
      });

      // 3) إضافة لتكلفة الأوردر الإضافية لو تم اختيار أوردر
      if (order_id) {
        await tx.order_extra_costs.create({
          data: {
            order_id,
            cost_type: 'مصاريف دهانات',
            amount: Number(amount),
            notes: notes || desc,
          },
        });
      }

      return {
        journal_entry: { ...journalEntry, amount: Number(journalEntry.amount) },
        expense: { ...expense, amount: Number(expense.amount) },
      };
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'journal_entries', row_id: result.journal_entry.id, after: result.journal_entry });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Paints POST error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

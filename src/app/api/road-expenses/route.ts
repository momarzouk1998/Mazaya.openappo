import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/road-expenses
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('overhead', 'view');
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const where: any = { category: 'مصاريف طريق' };
    if (orderId) {
      where.journal_entry = { order_id: orderId };
    }

    const [total, expenses] = await Promise.all([
      prisma.overhead_expenses.count({ where }),
      prisma.overhead_expenses.findMany({
        where,
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        include: {
          journal_entry: { select: { id: true, order_id: true, order: { select: { id: true, order_name: true, customer: { select: { name: true } } } } } },
        },
        skip: offset,
        take: limit,
      }),
    ]);

    const serialized = expenses.map((e: any) => ({
      ...e,
      amount: Number(e.amount),
      order_id: e.journal_entry?.order_id || null,
      order_name: e.journal_entry?.order?.order_name || null,
      customer_name: e.journal_entry?.order?.customer?.name || null,
    }));

    return NextResponse.json({
      ok: true,
      data: {
        entries: serialized,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Road expenses GET error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// POST /api/road-expenses
// Body: { amount, payment_method, date, notes, order_id }
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('overhead', 'add');
    const body = await request.json();
    const { amount, payment_method, date, notes, order_id } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' } },
        { status: 400 }
      );
    }

    const entryDate = date ? new Date(date) : new Date();
    const desc = order_id
      ? `[مصاريف طريق] ${notes || 'مصاريف طريق مرتبطة بأوردر'}`
      : `[مصاريف طريق] ${notes || 'مصاريف طريق'}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1) قيد يومية
      const journalEntry = await tx.journal_entries.create({
        data: {
          date: entryDate,
          entry_type: 'مصاريف طريق',
          description: desc,
          amount: Number(amount),
          payment_method: payment_method || 'نقدي',
          order_id: order_id || null,
          created_by: user.id,
        },
      });

      // 2) overhead_expenses (تصنيف "مصاريف طريق")
      const expense = await tx.overhead_expenses.create({
        data: {
          date: entryDate,
          category: 'مصاريف طريق',
          description: desc,
          amount: Number(amount),
          payment_method: payment_method || 'نقدي',
          journal_entry_id: journalEntry.id,
          created_by: user.id,
          notes: notes || null,
        },
      });

      // 3) لو فيه أوردر، سجل مصروف طريق في worker_travel_expenses أو order_extra_costs
      let travelExpense = null;
      if (order_id) {
        travelExpense = await tx.worker_travel_expenses.create({
          data: {
            order_id,
            description: notes || 'مصاريف طريق',
            amount: Number(amount),
            expense_date: entryDate,
            payment_method: payment_method || 'نقدي',
            notes: notes || null,
            created_by: user.id,
          },
        });
      }

      return {
        journal_entry: { ...journalEntry, amount: Number(journalEntry.amount) },
        expense: { ...expense, amount: Number(expense.amount) },
        travel_expense: travelExpense ? { ...travelExpense, amount: Number(travelExpense.amount) } : null,
      };
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'overhead_expenses', row_id: result.expense.id, after: result.expense });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Road expenses POST error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

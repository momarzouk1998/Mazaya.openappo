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
      category: 'مصاريف ليد',
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

    const serialized = expenses.map((e: any) => {
      const noteText = e.notes || '';
      return {
        id: e.id,
        date: e.date,
        description: e.description,
        amount: Number(e.amount),
        payment_method: e.payment_method,
        notes: noteText,
        journal_entry_id: e.journal_entry_id,
        order_id: e.journal_entry?.order_id || null,
        order_name: e.journal_entry?.order?.order_name || null,
        created_at: e.created_at,
      };
    });

    return NextResponse.json({
      ok: true,
      data: { items: serialized },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('LED Expenses GET error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('journal', 'add');
    const body = await request.json();
    const { boda_amount, masnaeya_amount, payment_method, date, notes, order_id } = body;

    const boda = Number(boda_amount || 0);
    const masnaeya = Number(masnaeya_amount || 0);
    const totalAmount = boda + masnaeya;

    if (totalAmount <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'يجب إدخال قيمة لبضاعة الليد أو المصنعية' } },
        { status: 400 }
      );
    }

    const entryDate = date ? new Date(date) : new Date();
    const formattedNotes = `بضاعة ليد: ${boda} ج.م | مصنعية ليد: ${masnaeya} ج.م${notes ? ` | ${notes}` : ''}`;
    const desc = `[مصاريف ليد وكهرباء] بضاعة (${boda}) + مصنعية (${masnaeya})`;

    const result = await prisma.$transaction(async (tx) => {
      // 1) قيد يومية "مصاريف ليد" → يخصم في يومية المصنع تلقائياً
      const journalEntry = await tx.journal_entries.create({
        data: {
          date: entryDate,
          entry_type: 'مصاريف ليد',
          description: desc,
          amount: totalAmount,
          payment_method: payment_method || 'نقدي',
          order_id: order_id || null,
          created_by: user.id,
          notes: formattedNotes,
        },
      });

      // 2) overhead_expenses (تصنيف "مصاريف ليد")
      const expense = await tx.overhead_expenses.create({
        data: {
          date: entryDate,
          category: 'مصاريف ليد',
          description: desc,
          amount: totalAmount,
          payment_method: payment_method || 'نقدي',
          journal_entry_id: journalEntry.id,
          created_by: user.id,
          notes: formattedNotes,
        },
      });

      // 3) إضافة لتكاليف الأوردر المباشرة لو محدد
      if (order_id) {
        if (boda > 0) {
          await tx.order_extra_costs.create({
            data: {
              order_id,
              cost_type: 'بضاعة ليد',
              amount: boda,
              notes: notes || 'بضاعة ليد وكهرباء',
            },
          });
        }
        if (masnaeya > 0) {
          await tx.order_extra_costs.create({
            data: {
              order_id,
              cost_type: 'مصنعية ليد',
              amount: masnaeya,
              notes: notes || 'مصنعية ليد وكهرباء',
            },
          });
        }
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
    console.error('LED Expenses POST error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

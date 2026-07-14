import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('overhead', 'view');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category') || '';
    const date_from = searchParams.get('date_from') || '';
    const date_to = searchParams.get('date_to') || '';
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;

    const where: any = {};
    if (category) where.category = category;
    if (date_from || date_to) {
      where.date = {};
      if (date_from) where.date.gte = new Date(date_from);
      if (date_to) where.date.lte = new Date(date_to);
    }
    if (search) where.description = { contains: search, mode: 'insensitive' };

    const total = await prisma.overhead_expenses.count({ where });

    const expenses = await prisma.overhead_expenses.findMany({
      where,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
      skip: offset,
      take: limit,
      include: { worker: { select: { id: true, name: true } } },
    });

    const serialized = expenses.map((e) => ({ ...e, amount: Number(e.amount) }));

    return NextResponse.json({
      ok: true,
      data: {
        expenses: serialized,
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
    const user = await requirePermission('overhead', 'add');
    const { searchParams } = new URL(request.url);
    const createJournal = searchParams.get('create_journal') === 'true';

    const body = await request.json();
    const { description, amount, category, payment_method, date, notes, worker_id } = body;

    if (!description || description.trim() === '') {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'الوصف مطلوب' } },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' } },
        { status: 400 }
      );
    }

    if (createJournal) {
      const result = await prisma.$transaction(async (tx) => {
        const journalEntry = await tx.journal_entries.create({
          data: {
            date: date ? new Date(date) : new Date(),
            // SSoT (F8) — نستخدم المفتاح العربي 'نثريات' بدل 'overhead'
            // عشان كل الحسابات الموحدة في src/lib/finance.ts تشتغل صح
            entry_type: 'نثريات',
            description: description.trim(),
            amount,
            payment_method: payment_method || null,
            created_by: user.id,
          },
        });

        const expense = await tx.overhead_expenses.create({
          data: {
            date: date ? new Date(date) : new Date(),
            category: category || null,
            description: description.trim(),
            amount,
            payment_method: payment_method || null,
            journal_entry_id: journalEntry.id,
            created_by: user.id,
            notes: notes || null,
            worker_id: worker_id || null,
          },
        });

        return {
          expense: { ...expense, amount: Number(expense.amount) },
          journal_entry: { ...journalEntry, amount: Number(journalEntry.amount) },
        };
      });

      auditLog({
        user_id: user.id,
        action: 'create',
        table_name: 'overhead_expenses',
        row_id: result.expense.id,
        after: result.expense,
      });
      auditLog({
        user_id: user.id,
        action: 'create',
        table_name: 'journal_entries',
        row_id: result.journal_entry.id,
        after: result.journal_entry,
      });

      return NextResponse.json({ ok: true, data: result }, { status: 201 });
    }

    const expense = await prisma.overhead_expenses.create({
      data: {
        date: date ? new Date(date) : new Date(),
        category: category || null,
        description: description.trim(),
        amount,
        payment_method: payment_method || null,
        created_by: user.id,
        notes: notes || null,
        worker_id: worker_id || null,
      },
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'overhead_expenses', row_id: expense.id, after: expense });

    return NextResponse.json({ ok: true, data: { ...expense, amount: Number(expense.amount) } }, { status: 201 });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

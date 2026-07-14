import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('overhead', 'view');
    const { id } = await params;

    const expense = await prisma.overhead_expenses.findFirst({ where: { id } });

    if (!expense) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'المصروف غير موجود' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: { ...expense, amount: Number(expense.amount) } });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('overhead', 'edit');
    const { id } = await params;

    const existing = await prisma.overhead_expenses.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'المصروف غير موجود' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { description, amount, category, payment_method, date, notes, worker_id } = body;

    if (amount !== undefined && (amount <= 0 || amount === null)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'المبلغ يجب أن يكون أكبر من صفر' } },
        { status: 400 }
      );
    }

    const data: any = {};
    if (date !== undefined) data.date = new Date(date);
    if (category !== undefined) data.category = category || null;
    if (description !== undefined) data.description = description.trim();
    if (amount !== undefined) data.amount = amount;
    if (payment_method !== undefined) data.payment_method = payment_method || null;
    if (notes !== undefined) data.notes = notes;
    if (worker_id !== undefined) data.worker_id = worker_id || null;
    data.updated_at = new Date();

    const expense = await prisma.overhead_expenses.update({
      where: { id },
      data,
    });

    auditLog({
      user_id: user.id,
      action: 'update',
      table_name: 'overhead_expenses',
      row_id: id,
      before: existing,
      after: expense,
    });

    return NextResponse.json({ ok: true, data: { ...expense, amount: Number(expense.amount) } });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('overhead', 'delete');
    const { id } = await params;

    const existing = await prisma.overhead_expenses.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'المصروف غير موجود' } },
        { status: 404 }
      );
    }

    if (existing.journal_entry_id) {
      await prisma.journal_entries.delete({ where: { id: existing.journal_entry_id } });
      auditLog({
        user_id: user.id,
        action: 'delete',
        table_name: 'journal_entries',
        row_id: existing.journal_entry_id,
        before: { id: existing.journal_entry_id },
      });
    }

    await prisma.overhead_expenses.delete({ where: { id } });

    auditLog({
      user_id: user.id,
      action: 'delete',
      table_name: 'overhead_expenses',
      row_id: id,
      before: existing,
    });

    return NextResponse.json({ ok: true, data: { deleted: true } });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

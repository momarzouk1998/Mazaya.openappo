import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';
import { VALID_ENTRY_TYPES } from '@/lib/finance';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('journal', 'view');
    const { id } = await params;

    const entries: any[] = await prisma.$queryRawUnsafe(
      `SELECT je.*,
        CASE
          WHEN je.party_type = 'supplier' THEN s.name
          WHEN je.party_type = 'branch' THEN b.name
          WHEN je.party_type = 'contractor' THEN c.name
          ELSE NULL
        END as party_name
       FROM mazaya.journal_entries je
       LEFT JOIN mazaya.suppliers s ON je.party_type = 'supplier' AND je.party_id = s.id
       LEFT JOIN mazaya.branches b ON je.party_type = 'branch' AND je.party_id = b.id
       LEFT JOIN mazaya.contractors c ON je.party_type = 'contractor' AND je.party_id = c.id
       WHERE je.id = $1`,
      id
    );

    if (entries.length === 0) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'القيد غير موجود' } },
        { status: 404 }
      );
    }

    const entry = { ...entries[0], amount: Number(entries[0].amount) };

    return NextResponse.json({ ok: true, data: entry });
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
    const user = await requirePermission('journal', 'edit');
    const { id } = await params;

    const existing = await prisma.journal_entries.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'القيد غير موجود' } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { description, amount, entry_type, payment_method, party_type, party_id, order_id, date } = body;

    if (amount !== undefined && (amount <= 0 || amount === null)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'المبلغ يجب أن يكون أكبر من صفر' } },
        { status: 400 }
      );
    }

    const validEntryTypes = [...(VALID_ENTRY_TYPES as readonly string[]), 'purchase', 'incoming_from_branch', 'outgoing_to_supplier', 'transfer', 'overhead', 'income', 'expense'];
    if (entry_type && !validEntryTypes.includes(entry_type)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'نوع القيد غير صالح' } },
        { status: 400 }
      );
    }

    if (payment_method && !['نقدي', 'تحويل'].includes(payment_method)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'طريقة الدفع غير صالحة' } },
        { status: 400 }
      );
    }

    const data: any = {};
    if (date !== undefined) data.date = new Date(date);
    if (entry_type !== undefined) data.entry_type = entry_type;
    if (description !== undefined) data.description = description.trim();
    if (amount !== undefined) data.amount = amount;
    if (payment_method !== undefined) data.payment_method = payment_method || 'نقدي';
    if (party_type !== undefined) data.party_type = party_type || null;
    if (party_id !== undefined) data.party_id = party_id || null;
    if (order_id !== undefined) data.order_id = order_id || null;
    data.updated_at = new Date();

    const entry = await prisma.journal_entries.update({
      where: { id },
      data,
    });

    auditLog({
      user_id: user.id,
      action: 'update',
      table_name: 'journal_entries',
      row_id: id,
      before: existing,
      after: entry,
    });

    return NextResponse.json({ ok: true, data: { ...entry, amount: Number(entry.amount) } });
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
    const user = await requirePermission('journal', 'delete');
    const { id } = await params;

    const existing = await prisma.journal_entries.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'القيد غير موجود' } },
        { status: 404 }
      );
    }

    const refCheck = await prisma.overhead_expenses.findFirst({ where: { journal_entry_id: id } });
    if (refCheck) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'لا يمكن حذف القيد لأنه مرتبط بمصروفات عامة' } },
        { status: 409 }
      );
    }

    await prisma.journal_entries.delete({ where: { id } });

    auditLog({
      user_id: user.id,
      action: 'delete',
      table_name: 'journal_entries',
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

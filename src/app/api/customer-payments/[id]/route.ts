import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

// GET /api/customer-payments/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('payments', 'view');
    const { id } = await params;

    const payment = await prisma.customer_payments.findFirst({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        order: { select: { id: true, order_name: true } },
      },
    });

    if (!payment) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الدفعة غير موجودة' } }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: payment });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// PATCH /api/customer-payments/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('payments', 'edit');
    const { id } = await params;

    const existing = await prisma.customer_payments.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الدفعة غير موجودة' } }, { status: 404 });
    }

    const body = await request.json();
    const { amount, payment_method, date, notes, order_id } = body;

    const updateData: any = {};
    if (amount !== undefined) updateData.amount = Number(amount);
    if (payment_method !== undefined) updateData.payment_method = payment_method;
    if (date !== undefined) updateData.date = date ? new Date(date) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (order_id !== undefined) updateData.order_id = order_id || null;

    const updated = await prisma.customer_payments.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true } },
        order: { select: { id: true, order_name: true } },
      },
    });

    auditLog({
      user_id: user.id,
      action: 'update',
      table_name: 'customer_payments',
      row_id: id,
      before: existing,
      after: updated,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// DELETE /api/customer-payments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission('payments', 'delete');
    const { id } = await params;

    const existing = await prisma.customer_payments.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الدفعة غير موجودة' } }, { status: 404 });
    }

    await prisma.customer_payments.delete({ where: { id } });

    auditLog({
      user_id: user.id,
      action: 'delete',
      table_name: 'customer_payments',
      row_id: id,
      before: existing,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

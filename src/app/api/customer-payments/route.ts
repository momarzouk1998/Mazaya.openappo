import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

// GET /api/customer-payments?customer_id=xxx&order_id=xxx
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('payments', 'view');
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const orderId = searchParams.get('order_id');
    const limit = parseInt(searchParams.get('limit') || '500');
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {};
    if (customerId) where.customer_id = customerId;
    if (orderId) where.order_id = orderId;

    const [payments, total] = await Promise.all([
      prisma.customer_payments.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          order: { select: { id: true, order_name: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer_payments.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data: { items: payments, total, page, limit },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

// POST /api/customer-payments
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('payments', 'add');
    const body = await request.json();
    const { customer_id, order_id, amount, payment_method, date, notes } = body;

    if (!customer_id || amount == null) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'العميل والمبلغ مطلوبان' } },
        { status: 400 }
      );
    }

    // Validate customer exists
    const customer = await prisma.customers.findFirst({ where: { id: customer_id, deleted_at: null } });
    if (!customer) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'العميل غير موجود' } },
        { status: 404 }
      );
    }

    // Validate order if provided
    if (order_id) {
      const order = await prisma.orders.findFirst({ where: { id: order_id, deleted_at: null } });
      if (!order) {
        return NextResponse.json(
          { ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } },
          { status: 404 }
        );
      }
    }

    const payment = await prisma.customer_payments.create({
      data: {
        customer_id,
        order_id: order_id || null,
        amount: Number(amount),
        payment_method: payment_method || 'نقدي',
        date: date ? new Date(date) : new Date(),
        notes: notes || null,
        created_by: user.id,
      },
      include: {
        customer: { select: { id: true, name: true } },
        order: { select: { id: true, order_name: true } },
      },
    });

    auditLog({
      user_id: user.id,
      action: 'create',
      table_name: 'customer_payments',
      row_id: payment.id,
      after: payment,
    });

    return NextResponse.json({ ok: true, data: payment }, { status: 201 });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

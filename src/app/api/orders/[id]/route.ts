import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('orders', 'view');
    const { id } = await params;
    const orderId = id;

    // ============================
    // Single Source of Truth (SSoT)
    // ============================
    // نستخدم v_order_totals view بدل ما نحسب boards_cost /
    // accessories_cost في 4 استعلامات منفصلة + نضيف installation_cost
    // يدوياً. الـ view بيحسب order_total بشكل صحيح (F3, F4, F5).
    const [order, totalsR, extraCostsR] = await Promise.all([
      prisma.orders.findFirst({
        where: { id: orderId, deleted_at: null },
        include: { customer: true, branch: true },
      }),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT boards_cost, accessories_cost, order_total, extra_costs_total
         FROM mazaya.v_order_totals WHERE order_id = $1::uuid`,
        orderId,
      ).catch(() => [{ boards_cost: 0, accessories_cost: 0, order_total: 0, extra_costs_total: 0 }]),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM mazaya.order_extra_costs WHERE order_id = $1::uuid ORDER BY created_at ASC`,
        orderId,
      ).catch(() => []),
    ]);
    if (!order) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } }, { status: 404 });
    }

    // لازم نرجّع المواد والأعمال الخارجية كمان عشان باقي الواجهات
    // تعتمد على نفس الـ payload
    const [materialsR, extWorkR] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
        SELECT om.*,
          CASE
            WHEN om.item_category = 'boards_inventory' THEN bi.item_name
            WHEN om.item_category = 'accessories_inventory' THEN ai.item_name
          END as item_name,
          CASE
            WHEN om.item_category = 'boards_inventory' THEN bi.code
            WHEN om.item_category = 'accessories_inventory' THEN ai.code
          END as item_code
        FROM mazaya.order_materials om
        LEFT JOIN mazaya.boards_inventory bi ON om.item_category = 'boards_inventory' AND om.item_id = bi.id
        LEFT JOIN mazaya.accessories_inventory ai ON om.item_category = 'accessories_inventory' AND om.item_id = ai.id
        WHERE om.order_id = $1::uuid
      `, orderId).catch(() => []),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT oew.*, co.name as contractor_name
        FROM mazaya.order_external_work oew
        LEFT JOIN mazaya.contractors co ON oew.contractor_id = co.id
        WHERE oew.order_id = $1::uuid
      `, orderId).catch(() => []),
    ]);

    const totals = totalsR[0] || { boards_cost: 0, accessories_cost: 0, order_total: 0, extra_costs_total: 0 };
    const extraCostsTotal = extraCostsR.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    const { customer, branch, ...orderData } = order;

    return NextResponse.json({
      ok: true,
      data: {
        ...orderData,
        customer_name: customer?.name ?? null,
        branch_name: branch?.name ?? null,
        materials: materialsR,
        external_work: extWorkR,
        extra_costs: extraCostsR.map((r: any) => ({ ...r, amount: Number(r.amount) })),
        boards_cost: Number(totals.boards_cost),
        accessories_cost: Number(totals.accessories_cost),
        extra_costs_total: extraCostsTotal,
        // order_total = كل التكاليف (ماشية من الـ view)
        order_total: Number(totals.order_total),
      },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('orders', 'edit');
    const { id } = await params;
    const orderId = id;

    const before = await prisma.orders.findFirst({
      where: { id: orderId, deleted_at: null },
    });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } }, { status: 404 });
    }

    const body = await request.json();
    const allowed = ['order_name', 'customer_id', 'branch_id', 'order_type', 'start_date', 'end_date', 'status', 'installation_cost', 'installation_travel_days', 'internal_transport_cost', 'external_transport_cost', 'factory_commission', 'workers_count', 'notes'];
    const data: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if ((key === 'start_date' || key === 'end_date') && body[key]) {
          data[key] = new Date(body[key]).toISOString();
        } else {
          data[key] = body[key];
        }
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'لا توجد بيانات للتعديل' } }, { status: 400 });
    }
    data.updated_at = new Date();

    const r = await prisma.orders.update({
      where: { id: orderId },
      data,
    });
    auditLog({ user_id: user.id, action: 'update', table_name: 'orders', row_id: orderId, before, after: r });

    return NextResponse.json({ ok: true, data: r });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order update error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('orders', 'delete');
    const { id } = await params;
    const orderId = id;

    const before = await prisma.orders.findFirst({
      where: { id: orderId, deleted_at: null },
    });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } }, { status: 404 });
    }

    await prisma.orders.update({
      where: { id: orderId },
      data: { deleted_at: new Date() },
    });
    auditLog({ user_id: user.id, action: 'delete', table_name: 'orders', row_id: orderId, before });

    return NextResponse.json({ ok: true, data: { message: 'تم الحذف' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

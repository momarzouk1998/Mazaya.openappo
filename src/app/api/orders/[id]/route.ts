import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('orders', 'view');
    const { id } = await params;
    const orderId = id;

    // 1) Fetch main order record
    const order = await prisma.orders.findFirst({
      where: { id: orderId, deleted_at: null },
      include: { customer: true, branch: true },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } }, { status: 404 });
    }

    // 2) Fetch all related cost components concurrently
    const [
      materialsR,
      extWorkR,
      workerLogsR,
      roadExpensesR,
      extraCostsR,
      internalTransportJournalR,
      roadJournalR,
    ] = await Promise.all([
      // Materials (Boards + Accessories)
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

      // External work
      prisma.$queryRawUnsafe<any[]>(`
        SELECT oew.*, co.name as contractor_name
        FROM mazaya.order_external_work oew
        LEFT JOIN mazaya.contractors co ON oew.contractor_id = co.id
        WHERE oew.order_id = $1::uuid
      `, orderId).catch(() => []),

      // Worker daily logs
      prisma.$queryRawUnsafe<any[]>(`
        SELECT wdl.*, w.name as worker_name
        FROM mazaya.worker_daily_logs wdl
        LEFT JOIN mazaya.workers w ON wdl.worker_id = w.id
        WHERE wdl.order_id = $1::uuid
      `, orderId).catch(() => []),

      // Worker travel expenses (legacy)
      prisma.$queryRawUnsafe<any[]>(`
        SELECT wte.*
        FROM mazaya.worker_travel_expenses wte
        WHERE wte.order_id = $1::uuid
      `, orderId).catch(() => []),

      // Extra costs (Paints, LED, Overhead, etc.)
      prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM mazaya.order_extra_costs WHERE order_id = $1::uuid ORDER BY created_at ASC
      `, orderId).catch(() => []),

      // Real internal transport from journal entries
      prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(SUM(amount), 0)::float8 AS total
        FROM mazaya.journal_entries
        WHERE order_id = $1::uuid AND entry_type = 'نقل داخلي'
      `, orderId).catch(() => [{ total: 0 }]),

      // Real road expenses from journal entries
      prisma.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(SUM(amount), 0)::float8 AS total
        FROM mazaya.journal_entries
        WHERE order_id = $1::uuid AND (entry_type = 'مصاريف طريق' OR entry_type = 'مصاريف الطريق')
      `, orderId).catch(() => [{ total: 0 }]),
    ]);

    // 3) Calculate all totals accurately
    const boardsCost = materialsR
      .filter((m: any) => m.item_category === 'boards_inventory' || m.board_id)
      .reduce((s: number, m: any) => s + Number(m.line_total ?? (Number(m.quantity_used || 0) * Number(m.unit_price_snapshot || 0))), 0);

    const accessoriesCost = materialsR
      .filter((m: any) => m.item_category !== 'boards_inventory' && !m.board_id)
      .reduce((s: number, m: any) => s + Number(m.line_total ?? (Number(m.quantity_used || 0) * Number(m.unit_price_snapshot || 0))), 0);

    const extraCostsTotal = extraCostsR.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    const workerLogsTotal = workerLogsR.reduce((s: number, r: any) => s + Number(r.daily_rate ?? 0), 0);
    const externalWorkTotal = extWorkR.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

    // Internal transport: exact sum of all registered internal transport movements, or the manual field if higher
    const internalTransportFromJournal = Number(internalTransportJournalR[0]?.total || 0);
    const internalTransportTotal = Math.max(Number(order.internal_transport_cost || 0), internalTransportFromJournal);

    // Road expenses: take the full sum (either from worker_travel_expenses which has all 7 records, or journal entries)
    const roadExpensesLegacy = roadExpensesR.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    const roadExpensesJournal = Number(roadJournalR[0]?.total || 0);
    const roadExpensesTotal = Math.max(roadExpensesLegacy, roadExpensesJournal);

    // Manual costs
    const installationCost = Number(order.installation_cost || 0);
    const externalTransportCost = Number(order.external_transport_cost || 0);
    const factoryCommission = Number(order.factory_commission || 0);

    // Grand order total
    const orderTotal =
      boardsCost +
      accessoriesCost +
      installationCost +
      internalTransportTotal +
      externalTransportCost +
      factoryCommission +
      workerLogsTotal +
      roadExpensesTotal +
      extraCostsTotal +
      externalWorkTotal;

    // Synchronize internal_transport_cost in orders table if higher
    if (internalTransportTotal > Number(order.internal_transport_cost || 0)) {
      await prisma.orders.update({
        where: { id: orderId },
        data: { internal_transport_cost: internalTransportTotal },
      }).catch(() => {});
    }

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
        worker_logs: workerLogsR.map((r: any) => ({ ...r, daily_rate: Number(r.daily_rate) })),
        road_expenses: roadExpensesR.map((r: any) => ({ ...r, amount: Number(r.amount) })),
        boards_cost: boardsCost,
        accessories_cost: accessoriesCost,
        internal_transport_cost: internalTransportTotal,
        installation_cost: installationCost,
        external_transport_cost: externalTransportCost,
        factory_commission: factoryCommission,
        extra_costs_total: extraCostsTotal,
        worker_logs_total: workerLogsTotal,
        road_expenses_total: roadExpensesTotal,
        external_work_total: externalWorkTotal,
        order_total: orderTotal,
      },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order detail GET error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('orders', 'edit');
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.orders.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } }, { status: 404 });
    }

    const allowed = [
      'order_name', 'customer_id', 'branch_id', 'order_type', 'start_date', 'end_date',
      'status', 'installation_cost', 'installation_travel_days', 'internal_transport_cost',
      'external_transport_cost', 'factory_commission', 'workers_count', 'notes',
    ];
    const updateData: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key.endsWith('_date')) {
          updateData[key] = body[key] ? new Date(body[key]) : null;
        } else if (['installation_cost', 'installation_travel_days', 'internal_transport_cost', 'external_transport_cost', 'factory_commission', 'workers_count'].includes(key)) {
          updateData[key] = body[key] !== null ? Number(body[key]) : 0;
        } else {
          updateData[key] = body[key];
        }
      }
    }

    const updated = await prisma.orders.update({
      where: { id },
      data: updateData,
    });

    auditLog({
      user_id: user.id,
      action: 'update',
      table_name: 'orders',
      row_id: id,
      before: existing,
      after: updated,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order PATCH error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('orders', 'delete');
    const { id } = await params;

    const existing = await prisma.orders.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1) ارجع كميات المواد للمخزون
      const materials = await tx.order_materials.findMany({ where: { order_id: id } });
      for (const m of materials) {
        if (m.item_category === 'boards_inventory' && m.item_id) {
          await tx.boards_inventory.update({
            where: { id: m.item_id },
            data: { quantity_used: { decrement: Number(m.quantity_used) } },
          }).catch(() => {});
        } else if (m.item_category === 'accessories_inventory' && m.item_id) {
          await tx.accessories_inventory.update({
            where: { id: m.item_id },
            data: { quantity_used: { decrement: Number(m.quantity_used) } },
          }).catch(() => {});
        }
      }

      // 2) Soft delete
      await tx.orders.update({
        where: { id },
        data: { deleted_at: new Date() },
      });
    });

    auditLog({
      user_id: user.id,
      action: 'delete',
      table_name: 'orders',
      row_id: id,
      before: existing,
    });

    return NextResponse.json({ ok: true, message: 'تم حذف الأوردر بنجاح' });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order DELETE error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

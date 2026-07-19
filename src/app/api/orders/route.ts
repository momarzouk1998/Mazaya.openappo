import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * ===========================
 * Single Source of Truth (SSoT)
 * ===========================
 * - قائمة الأوردرات بتيجي من v_order_totals (view) لأنها تحسب
 *   order_total / boards_cost / accessories_cost من order_materials.line_total.
 *   عمود order_total في جدول orders بيبقى NULL في كل صف (F3, F13)
 *   فمفيش صفحة بتحط رقم صفر للإجمالي غير لما تستخدم الجدول مباشرة.
 * - الـ view ده هو نفس مصدر التقارير (reports/orders, profit-loss)،
 *   فلو عدّلنا أي عمود في الأوردر (مثلاً installation_cost) الـ view
 *   بيحسب order_total تاني بشكل صحيح.
 *
 * ملحوظة مهمة بخصوص branch_id:
 *   في الكود القديم بنستخدم prisma.orders.findMany() اللي بيرجع أعمدة
 *   v_order_totals ما كانتش فيه. الآن بنستخدم raw SQL على v_order_totals
 *   فبنطبّق scope الفرع يدوي (search + status + branch_id + customer_id).
 */
export async function GET(request: Request) {
  try {
    const user = await requirePermission('orders', 'view');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const branch_id = searchParams.get('branch_id') || '';
    const customer_id = searchParams.get('customer_id') || '';
    const offset = (page - 1) * limit;

    // تحديد الفرع بناءً على صلاحيات المستخدم
    const effectiveBranchId =
      user.role !== 'admin' && user.branch_id ? user.branch_id : branch_id || null;

    // نبني WHERE clause بطريقة parameterized
    const conditions: string[] = ['vot.deleted_at IS NULL'];
    const rawParams: any[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`vot.order_name ILIKE $${paramIdx++}`);
      rawParams.push(`%${search}%`);
    }
    if (status) {
      conditions.push(`vot.status = $${paramIdx++}`);
      rawParams.push(status);
    }
    if (effectiveBranchId) {
      conditions.push(`vot.branch_id = $${paramIdx++}::uuid`);
      rawParams.push(effectiveBranchId);
    }
    if (customer_id) {
      conditions.push(`vot.customer_id = $${paramIdx++}::uuid`);
      rawParams.push(customer_id);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [countResult, data] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int as total FROM mazaya.v_order_totals vot ${whereClause}`,
        ...rawParams
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT vot.*,
          c.name as customer_name,
          b.name as branch_name,
          COALESCE((
            SELECT SUM(ec.amount)::float8
            FROM mazaya.order_extra_costs ec
            WHERE ec.order_id = vot.order_id
              AND ec.cost_type = 'نثريات'
          ), 0) AS overhead_costs_total
         FROM mazaya.v_order_totals vot
         LEFT JOIN mazaya.customers c ON vot.customer_id = c.id
         LEFT JOIN mazaya.branches b ON vot.branch_id = b.id
         ${whereClause}
         ORDER BY vot.created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        ...rawParams, limit, offset
      ),
    ]);

    const total = parseInt(countResult[0]?.total ?? '0', 10);

    // Serializing decimals properly for client
    const items = data.map((r: any) => ({
      ...r,
      id: r.order_id,
      boards_cost: Number(r.boards_cost ?? 0),
      accessories_cost: Number(r.accessories_cost ?? 0),
      installation_cost: Number(r.installation_cost ?? 0),
      internal_transport_cost: Number(r.internal_transport_cost ?? 0),
      external_transport_cost: Number(r.external_transport_cost ?? 0),
      factory_commission: Number(r.factory_commission ?? 0),
      order_total: Number(r.order_total ?? 0),
      extra_costs_total: Number(r.extra_costs_total ?? 0),
      overhead_costs_total: Number(r.overhead_costs_total ?? 0),
    }));

    return NextResponse.json({
      ok: true,
      data: { items, total, page, limit },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Orders list error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission('orders', 'add');
    const body = await request.json();
    const { order_name, customer_id, branch_id, order_type, start_date, end_date, status, installation_cost, installation_travel_days, internal_transport_cost, external_transport_cost, factory_commission, workers_count, notes } = body;

    if (!order_name || !order_name.trim()) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'اسم الأوردر مطلوب' } }, { status: 400 });
    }

    const validStatuses = ['open', 'in_progress', 'completed', 'delivered', 'مفتوح', 'قيد التنفيذ', 'مكتمل', 'تم التسليم'];
    const validTypes = ['new', 'maintenance', 'تصنيع جديد', 'صيانة'];

    const r = await prisma.orders.create({
      data: {
        order_name: order_name.trim(),
        customer_id: customer_id || null,
        branch_id: branch_id || null,
        order_type: validTypes.includes(order_type) ? order_type : 'تصنيع جديد',
        start_date: start_date ? new Date(start_date).toISOString() : null,
        end_date: end_date ? new Date(end_date).toISOString() : null,
        status: validStatuses.includes(status) ? status : 'مفتوح',
        installation_cost: installation_cost || 0,
        installation_travel_days: installation_travel_days ?? 0,
        internal_transport_cost: internal_transport_cost || 0,
        external_transport_cost: external_transport_cost || 0,
        factory_commission: factory_commission || 0,
        workers_count: workers_count ?? 0,
        notes: notes || null,
        created_by: user.id,
      },
    });

    auditLog({ user_id: user.id, action: 'create', table_name: 'orders', row_id: r.id, after: r });
    return NextResponse.json({ ok: true, data: r }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order create error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

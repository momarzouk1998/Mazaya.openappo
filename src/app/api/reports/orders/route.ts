import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('reports', 'view');
    const { searchParams } = new URL(request.url);
    const date_from = searchParams.get('date_from') || '';
    const date_to = searchParams.get('date_to') || '';
    const status = searchParams.get('status') || '';
    const branch_id = searchParams.get('branch_id') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (date_from) {
      whereClause += ` AND created_at >= $${paramIdx}`;
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      whereClause += ` AND created_at <= $${paramIdx}`;
      params.push(date_to);
      paramIdx++;
    }
    if (status) {
      whereClause += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (branch_id) {
      whereClause += ` AND branch_id = $${paramIdx}`;
      params.push(branch_id);
      paramIdx++;
    }

    // Count for pagination
    const countR = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total FROM mazaya.v_order_totals ${whereClause}`,
      ...params
    );
    const total = parseInt(countR[0].total);

    // Main data query
    const dataR = await prisma.$queryRawUnsafe<any[]>(
      `SELECT vot.*,
        c.name as customer_name,
        b.name as branch_name
       FROM mazaya.v_order_totals vot
       LEFT JOIN mazaya.customers c ON vot.customer_id = c.id
       LEFT JOIN mazaya.branches b ON vot.branch_id = b.id
       ${whereClause}
       ORDER BY vot.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      ...params, limit, offset
    );

    // Summary stats
    const summaryWhere = whereClause.replace('WHERE 1=1', 'WHERE 1=1');
    const summaryParams = [...params];

    const summaryR = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         COUNT(*) as total_orders,
         COALESCE(SUM(order_total), 0) as total_revenue,
         CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(order_total), 0) / COUNT(*) ELSE 0 END as average_order_value
       FROM mazaya.v_order_totals ${summaryWhere}`,
      ...summaryParams
    );

    return NextResponse.json({
      ok: true,
      data: {
        orders: dataR.map((r: any) => ({ ...r, id: r.order_id })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        summary: {
          total_orders: parseInt(summaryR[0].total_orders),
          total_revenue: parseFloat(summaryR[0].total_revenue),
          average_order_value: parseFloat(summaryR[0].average_order_value),
        },
      },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

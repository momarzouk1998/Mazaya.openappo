import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const date_from = searchParams.get('date_from') || '';
    const date_to = searchParams.get('date_to') || '';
    const monthly = searchParams.get('monthly') === 'true';

    const params: any[] = [];
    let paramIdx = 1;

    if (date_from) {
      params.push(date_from);
      paramIdx++;
    }
    if (date_to) {
      params.push(date_to);
      paramIdx++;
    }
    const hasDates = params.length > 0;

    if (monthly) {
      const revenueR = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           TO_CHAR(created_at, 'YYYY-MM') as month,
           SUM(order_total)::float8 as revenue
         FROM mazaya.v_order_totals
         WHERE status IN ('مكتمل', 'تم التسليم')
         ${date_from ? ` AND created_at >= $1::timestamp` : ''}
         ${date_to ? ` AND created_at <= $${date_from ? 2 : 1}::timestamp` : ''}
         GROUP BY TO_CHAR(created_at, 'YYYY-MM')
         ORDER BY month`,
        ...(hasDates ? params : [])
      );

      const materialCostR = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           TO_CHAR(created_at, 'YYYY-MM') as month,
           SUM(boards_cost)::float8 as boards_cost,
           SUM(accessories_cost)::float8 as accessories_cost
         FROM mazaya.order_costs
         WHERE 1=1
         ${date_from ? ` AND created_at >= $1::timestamp` : ''}
         ${date_to ? ` AND created_at <= $${date_from ? 2 : 1}::timestamp` : ''}
         GROUP BY TO_CHAR(created_at, 'YYYY-MM')
         ORDER BY month`,
        ...(hasDates ? params : [])
      );

      const externalWorkR = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           TO_CHAR(created_at, 'YYYY-MM') as month,
           COALESCE(SUM(amount), 0)::float8 as external_work_cost
         FROM mazaya.order_external_work
         WHERE 1=1
         ${date_from ? ` AND created_at >= $1::timestamp` : ''}
         ${date_to ? ` AND created_at <= $${date_from ? 2 : 1}::timestamp` : ''}
         GROUP BY TO_CHAR(created_at, 'YYYY-MM')
         ORDER BY month`,
        ...(hasDates ? params : [])
      );

      const overheadR = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           TO_CHAR(date, 'YYYY-MM') as month,
           COALESCE(SUM(amount), 0)::float8 as overhead_cost
         FROM mazaya.overhead_expenses
         WHERE 1=1
         ${date_from ? ` AND date >= $1::date` : ''}
         ${date_to ? ` AND date <= $${date_from ? 2 : 1}::date` : ''}
         GROUP BY TO_CHAR(date, 'YYYY-MM')
         ORDER BY month`,
        ...(hasDates ? params : [])
      );

      const monthMap = new Map<string, any>();

      for (const row of revenueR) {
        monthMap.set(row.month, { month: row.month, revenue: row.revenue, boards_cost: 0, accessories_cost: 0, external_work_cost: 0, overhead_cost: 0 });
      }
      for (const row of materialCostR) {
        const entry = monthMap.get(row.month) || { month: row.month, revenue: 0, boards_cost: 0, accessories_cost: 0, external_work_cost: 0, overhead_cost: 0 };
        entry.boards_cost = row.boards_cost;
        entry.accessories_cost = row.accessories_cost;
        monthMap.set(row.month, entry);
      }
      for (const row of externalWorkR) {
        const entry = monthMap.get(row.month) || { month: row.month, revenue: 0, boards_cost: 0, accessories_cost: 0, external_work_cost: 0, overhead_cost: 0 };
        entry.external_work_cost = row.external_work_cost;
        monthMap.set(row.month, entry);
      }
      for (const row of overheadR) {
        const entry = monthMap.get(row.month) || { month: row.month, revenue: 0, boards_cost: 0, accessories_cost: 0, external_work_cost: 0, overhead_cost: 0 };
        entry.overhead_cost = row.overhead_cost;
        monthMap.set(row.month, entry);
      }

      const monthlyData = Array.from(monthMap.values())
        .map(m => ({
          ...m,
          total_cost: m.boards_cost + m.accessories_cost + m.external_work_cost + m.overhead_cost,
          profit: m.revenue - (m.boards_cost + m.accessories_cost + m.external_work_cost + m.overhead_cost),
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const overallRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
      const overallCosts = monthlyData.reduce((sum, m) => sum + m.total_cost, 0);

      return NextResponse.json({
        ok: true,
        data: {
          monthly: monthlyData,
          summary: {
            total_revenue: overallRevenue,
            total_costs: overallCosts,
            profit: overallRevenue - overallCosts,
          },
        },
      });
    }

    // Non-monthly: overall totals
    const revenueR = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(order_total), 0)::float8 as total_revenue FROM mazaya.v_order_totals
       WHERE status IN ('مكتمل', 'تم التسليم')
       ${date_from ? ' AND created_at >= $1::timestamp' : ''}
       ${date_to ? ` AND created_at <= $${date_from ? 2 : 1}::timestamp` : ''}`,
      ...(hasDates ? params : [])
    );

    const materialCostR = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         COALESCE(SUM(boards_cost), 0)::float8 as total_boards_cost,
         COALESCE(SUM(accessories_cost), 0)::float8 as total_accessories_cost
       FROM mazaya.order_costs
       WHERE 1=1
       ${date_from ? ' AND created_at >= $1::timestamp' : ''}
       ${date_to ? ` AND created_at <= $${date_from ? 2 : 1}::timestamp` : ''}`,
      ...(hasDates ? params : [])
    );

    const externalWorkR = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(amount), 0)::float8 as total_external_work FROM mazaya.order_external_work
       WHERE 1=1
       ${date_from ? ' AND created_at >= $1::timestamp' : ''}
       ${date_to ? ` AND created_at <= $${date_from ? 2 : 1}::timestamp` : ''}`,
      ...(hasDates ? params : [])
    );

    const overheadR = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(amount), 0)::float8 as total_overhead FROM mazaya.overhead_expenses
       WHERE 1=1
       ${date_from ? ' AND date >= $1::date' : ''}
       ${date_to ? ` AND date <= $${date_from ? 2 : 1}::date` : ''}`,
      ...(hasDates ? params : [])
    );

    const totalRevenue = revenueR[0].total_revenue;
    const totalBoardsCost = materialCostR[0].total_boards_cost;
    const totalAccessoriesCost = materialCostR[0].total_accessories_cost;
    const totalExternalWork = externalWorkR[0].total_external_work;
    const totalOverhead = overheadR[0].total_overhead;
    const totalCosts = totalBoardsCost + totalAccessoriesCost + totalExternalWork + totalOverhead;
    const profit = totalRevenue - totalCosts;

    return NextResponse.json({
      ok: true,
      data: {
        revenue: totalRevenue,
        costs: {
          boards: totalBoardsCost,
          accessories: totalAccessoriesCost,
          external_work: totalExternalWork,
          overhead: totalOverhead,
          total: totalCosts,
        },
        profit,
      },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    // Query the v_inventory_value view grouped by inventory_type
    const totalsR = await prisma.$queryRaw<any[]>`
      SELECT inventory_type, SUM(total_value)::float8 as total_value
      FROM mazaya.v_inventory_value
      GROUP BY inventory_type
      ORDER BY inventory_type
    `;

    // Breakdown by material_type within each inventory_type
    const breakdownR = await prisma.$queryRaw<any[]>`
      SELECT inventory_type, material_type, SUM(total_value)::float8 as total_value, COUNT(*)::int as item_count
      FROM mazaya.v_inventory_value
      GROUP BY inventory_type, material_type
      ORDER BY inventory_type, total_value DESC
    `;

    // Grand total
    const grandTotalR = await prisma.$queryRaw<any[]>`
      SELECT COALESCE(SUM(total_value), 0)::float8 as grand_total FROM mazaya.v_inventory_value
    `;

    return NextResponse.json({
      ok: true,
      data: {
        totals: totalsR,
        breakdown: breakdownR,
        grand_total: grandTotalR[0].grand_total,
      },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

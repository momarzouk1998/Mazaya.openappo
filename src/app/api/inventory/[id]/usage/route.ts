import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory/[id]/usage?category=boards|accessories
 * يجيب سجل استخدام صنف معيّن (لوح أو إكسسوار) في كل الأوردرات.
 * برجع: اسم الأوردر، العميل، المعرض، الحالة، تاريخ البدء، الكمية، السعر، الإجمالي، تاريخ الاستخدام.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('boards_inventory', 'view');
    const { id: itemId } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category'); // 'boards' | 'accessories'

    if (!itemId) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'معرّف الصنف مطلوب' } }, { status: 400 });
    }

    // حوّل 'boards' → 'boards_inventory' إلخ.
    let tableHint = '';
    if (category === 'boards') tableHint = 'boards_inventory';
    else if (category === 'accessories') tableHint = 'accessories_inventory';

    // لو مفيش category محدد، نجيب الاثنين
    const categories = tableHint ? [tableHint] : ['boards_inventory', 'accessories_inventory'];

    // استعلام موحّد: ندمج اسم الصنف + معلومات الأوردر في query واحدة
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        om.id,
        om.order_id,
        om.item_category,
        om.quantity_used,
        om.unit_price_snapshot,
        om.line_total,
        om.created_at,
        o.order_name,
        o.status,
        o.start_date,
        c.name AS customer_name,
        b.name AS branch_name
      FROM mazaya.order_materials om
      JOIN mazaya.orders o ON om.order_id = o.id
      LEFT JOIN mazaya.customers c ON o.customer_id = c.id
      LEFT JOIN mazaya.branches b ON o.branch_id = b.id
      WHERE om.item_id = $1::uuid
        AND om.item_category = ANY($2::text[])
        AND o.deleted_at IS NULL
      ORDER BY om.created_at DESC
    `, itemId, categories);

    const serialized = rows.map((r) => ({
      ...r,
      quantity_used: Number(r.quantity_used),
      unit_price_snapshot: Number(r.unit_price_snapshot),
      line_total: Number(r.line_total),
    }));

    const totalQty = serialized.reduce((s, r) => s + r.quantity_used, 0);
    const totalValue = serialized.reduce((s, r) => s + r.line_total, 0);

    return NextResponse.json({
      ok: true,
      data: {
        usage: serialized,
        totals: {
          count: serialized.length,
          total_quantity: totalQty,
          total_value: totalValue,
        },
      },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Inventory usage error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** GET — list materials for an order */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: orderIdStr } = await params;
    const orderId = orderIdStr;

    const order = await prisma.orders.findFirst({
      where: { id: orderId, deleted_at: null },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } }, { status: 404 });
    }

    const r = await prisma.$queryRawUnsafe<any[]>(`
      SELECT om.*,
        CASE
          WHEN om.item_category = 'boards_inventory' THEN bi.item_name
          WHEN om.item_category = 'accessories_inventory' THEN ai.item_name
        END as item_name,
        CASE
          WHEN om.item_category = 'boards_inventory' THEN bi.code
          WHEN om.item_category = 'accessories_inventory' THEN ai.code
        END as item_code,
        CASE
          WHEN om.item_category = 'boards_inventory' THEN bi.quantity_remaining
          WHEN om.item_category = 'accessories_inventory' THEN ai.quantity_remaining
        END as available_quantity
      FROM mazaya.order_materials om
      LEFT JOIN mazaya.boards_inventory bi ON om.item_category = 'boards_inventory' AND om.item_id = bi.id
      LEFT JOIN mazaya.accessories_inventory ai ON om.item_category = 'accessories_inventory' AND om.item_id = ai.id
      WHERE om.order_id = $1::uuid
      ORDER BY om.created_at DESC
    `, orderId);

    return NextResponse.json({ ok: true, data: r });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

/** POST — add material to order (deduct from inventory) */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: orderIdStr } = await params;
    const orderId = orderIdStr;
    const body = await request.json();
    const { item_category, item_id, quantity_used, unit_price_snapshot } = body;

    const order = await prisma.orders.findFirst({
      where: { id: orderId, deleted_at: null },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } }, { status: 404 });
    }

    if (!item_category || !['boards_inventory', 'accessories_inventory'].includes(item_category)) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'نوع المخزون غير صالح' } }, { status: 400 });
    }
    if (!item_id) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'معرف الصنف مطلوب' } }, { status: 400 });
    }
    if (!quantity_used || quantity_used <= 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'الكمية المستخدمة مطلوبة' } }, { status: 400 });
    }
    if (!unit_price_snapshot || unit_price_snapshot <= 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'سعر الوحدة مطلوب' } }, { status: 400 });
    }

    let invItem: any[];
    if (item_category === 'boards_inventory') {
      invItem = await prisma.$queryRaw<any[]>`
        SELECT id, quantity_remaining FROM mazaya.boards_inventory WHERE id = ${item_id} AND deleted_at IS NULL
      `;
    } else {
      invItem = await prisma.$queryRaw<any[]>`
        SELECT id, quantity_remaining FROM mazaya.accessories_inventory WHERE id = ${item_id} AND deleted_at IS NULL
      `;
    }
    if (invItem.length === 0) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الصنف غير موجود في المخزون' } }, { status: 404 });
    }

    const available = parseFloat(invItem[0].quantity_remaining);
    if (quantity_used > available) {
      return NextResponse.json(
        { ok: false, error: { code: 'INSUFFICIENT_STOCK', message: `الكمية المطلوبة (${quantity_used}) أكبر من المتاح (${available})` } },
        { status: 400 }
      );
    }

    const r = await prisma.order_materials.create({
      data: {
        order_id: orderId,
        item_category,
        item_id,
        quantity_used,
        unit_price_snapshot,
      },
    });

    // خصم من المخزون
    if (item_category === 'boards_inventory') {
      await prisma.$executeRawUnsafe(`
        UPDATE mazaya.boards_inventory
        SET quantity_used = quantity_used + $1,
            quantity_remaining = quantity_in - quantity_used - $1,
            total_price = (quantity_in - quantity_used - $1) * unit_price
        WHERE id = $2::uuid AND deleted_at IS NULL
      `, quantity_used, item_id);
    } else {
      await prisma.$executeRawUnsafe(`
        UPDATE mazaya.accessories_inventory
        SET quantity_used = quantity_used + $1,
            quantity_remaining = quantity_in - quantity_used - $1,
            total_price = (quantity_in - quantity_used - $1) * unit_price
        WHERE id = $2::uuid AND deleted_at IS NULL
      `, quantity_used, item_id);
    }

    auditLog({ user_id: user.id, action: 'create', table_name: 'order_materials', row_id: r.id, after: r });
    return NextResponse.json({ ok: true, data: r }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order material create error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

/** DELETE — remove material from order (restore inventory) */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: orderIdStr } = await params;
    const orderId = orderIdStr;
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('material_id');

    if (!materialId) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'معرف المادة مطلوب' } }, { status: 400 });
    }

    const before = await prisma.order_materials.findFirst({
      where: { id: materialId, order_id: orderId },
    });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'المادة غير موجودة' } }, { status: 404 });
    }

    await prisma.order_materials.delete({
      where: { id: materialId },
    });

    // رجع الكمية للمخزون
    const cat = before.item_category as string;
    const itemId = before.item_id as string;
    const qty = Number(before.quantity_used ?? 0);
    if (qty > 0) {
      if (cat === 'boards_inventory') {
        await prisma.$executeRawUnsafe(`
          UPDATE mazaya.boards_inventory
          SET quantity_used = GREATEST(quantity_used - $1, 0),
              quantity_remaining = LEAST(quantity_in - GREATEST(quantity_used - $1, 0), quantity_in),
              total_price = LEAST(quantity_in - GREATEST(quantity_used - $1, 0), quantity_in) * unit_price
          WHERE id = $2::uuid AND deleted_at IS NULL
        `, qty, itemId);
      } else {
        await prisma.$executeRawUnsafe(`
          UPDATE mazaya.accessories_inventory
          SET quantity_used = GREATEST(quantity_used - $1, 0),
              quantity_remaining = LEAST(quantity_in - GREATEST(quantity_used - $1, 0), quantity_in),
              total_price = LEAST(quantity_in - GREATEST(quantity_used - $1, 0), quantity_in) * unit_price
          WHERE id = $2::uuid AND deleted_at IS NULL
        `, qty, itemId);
      }
    }

    auditLog({ user_id: user.id, action: 'delete', table_name: 'order_materials', row_id: materialId, before });

    return NextResponse.json({ ok: true, data: { message: 'تم حذف المادة' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order material delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

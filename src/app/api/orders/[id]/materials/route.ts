import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { auditLog } from '@/lib/audit';
import { adjustInventoryUsage, getInventoryRemaining } from '@/lib/inventory';

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

/** POST — add material(s) to order (deduct from inventory). Accepts single object or array. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: orderIdStr } = await params;
    const orderId = orderIdStr;
    const body = await request.json();

    // Accept single object or array
    const items: any[] = Array.isArray(body) ? body : [body];

    const order = await prisma.orders.findFirst({
      where: { id: orderId, deleted_at: null },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الأوردر غير موجود' } }, { status: 404 });
    }

    const created: any[] = [];
    const errors: string[] = [];

    for (const mat of items) {
      const { item_category, item_id, quantity_used, unit_price_snapshot } = mat;

      if (!item_category || !['boards_inventory', 'accessories_inventory'].includes(item_category)) {
        errors.push('نوع المخزون غير صالح'); continue;
      }
      if (!item_id) {
        errors.push('معرف الصنف مطلوب'); continue;
      }
      if (!quantity_used || quantity_used <= 0) {
        errors.push('الكمية المستخدمة مطلوبة'); continue;
      }
      if (!unit_price_snapshot || unit_price_snapshot <= 0) {
        errors.push('سعر الوحدة مطلوب'); continue;
      }

      // Check stock
      const available = await getInventoryRemaining(prisma, item_category, item_id);
      if (available === 0) {
        errors.push(`الصنف غير موجود`); continue;
      }
      if (quantity_used > available) {
        errors.push(`الكمية المطلوبة (${quantity_used}) أكبر من المتاح (${available})`); continue;
      }

      const r = await prisma.order_materials.create({
        data: {
          order_id: orderId,
          item_category,
          item_id,
          quantity_used,
          unit_price_snapshot,
          // حساب line_total هنا (SSoT) عشان كل القراءات
          // اللي بتعتمد عليه متضمناه
          line_total: Number(quantity_used) * Number(unit_price_snapshot),
        },
      });

      // خصم من المخزون — كل التحديثات بتعدي على الـ helper
      // الموحد (F7) عشان كل صف واحد يستخدم نفس القانون.
      await adjustInventoryUsage(prisma, item_category, item_id, Number(quantity_used));

      auditLog({ user_id: user.id, action: 'create', table_name: 'order_materials', row_id: r.id, after: r });
      created.push(r);
    }

    if (created.length === 0 && errors.length > 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: errors.join('; ') } }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: { created, errors: errors.length > 0 ? errors : undefined } }, { status: 201 });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order material create error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

/** DELETE — remove material(s) from order (restore inventory) */
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

    if (materialId === 'all') {
      // حذف كل مواد الأوردر ورجع المخزون
      const allMaterials = await prisma.order_materials.findMany({
        where: { order_id: orderId },
      });

      for (const mat of allMaterials) {
        const qty = Number(mat.quantity_used ?? 0);
        const cat = mat.item_category as 'boards_inventory' | 'accessories_inventory';
        const itemId = mat.item_id as string;
        if (qty > 0) {
          // diff بالسالب = إرجاع للمخزون
          await adjustInventoryUsage(prisma, cat, itemId, -qty);
        }
      }

      await prisma.order_materials.deleteMany({
        where: { order_id: orderId },
      });

      return NextResponse.json({ ok: true, data: { message: 'تم حذف كل المواد' } });
    }

    // حذف مادة واحدة
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
    const cat = before.item_category as 'boards_inventory' | 'accessories_inventory';
    const itemId = before.item_id as string;
    const qty = Number(before.quantity_used ?? 0);
    if (qty > 0) {
      await adjustInventoryUsage(prisma, cat, itemId, -qty);
    }

    auditLog({ user_id: user.id, action: 'delete', table_name: 'order_materials', row_id: materialId, before });

    return NextResponse.json({ ok: true, data: { message: 'تم حذف المادة' } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order material delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

/** PATCH — update material quantity (adjust inventory diff) */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id: orderIdStr } = await params;
    const orderId = orderIdStr;
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('material_id');

    if (!materialId) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'معرف المادة مطلوب' } }, { status: 400 });
    }

    const body = await request.json();
    const newQty = Number(body.quantity_used);

    if (!newQty || newQty <= 0) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'الكمية يجب أن تكون أكبر من 0' } }, { status: 400 });
    }

    const before = await prisma.order_materials.findFirst({
      where: { id: materialId, order_id: orderId },
    });
    if (!before) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'المادة غير موجودة' } }, { status: 404 });
    }

    const oldQty = Number(before.quantity_used ?? 0);
    const diff = newQty - oldQty; // positive = increase usage, negative = decrease usage

    const cat = before.item_category as 'boards_inventory' | 'accessories_inventory';
    const itemId = before.item_id as string;

    // لو بيزود الاستهلاك، يتأكد إن المخزون يكفي
    if (diff > 0) {
      const avail = await getInventoryRemaining(prisma, cat, itemId);
      if (avail === 0) {
        return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'الصنف غير موجود في المخزون' } }, { status: 404 });
      }
      if (diff > avail) {
        return NextResponse.json({ ok: false, error: { code: 'INSUFFICIENT_STOCK', message: `الكمية الإضافية (${diff}) أكبر من المتاح (${avail})` } }, { status: 400 });
      }
    }

    // Update the material record
    await prisma.order_materials.update({
      where: { id: materialId },
      data: {
        quantity_used: newQty,
        // نحسب line_total على الـ spot عشان الـ view يطلع رقم صحيح
        line_total: newQty * Number(before.unit_price_snapshot ?? 0),
      },
    });

    // Adjust inventory — نفس الـ helper الموحد
    if (diff !== 0) {
      await adjustInventoryUsage(prisma, cat, itemId, diff);
    }

    auditLog({ user_id: user.id, action: 'update', table_name: 'order_materials', row_id: materialId, before, after: { ...before, quantity_used: newQty } });

    return NextResponse.json({ ok: true, data: { message: 'تم تعديل الكمية', oldQty, newQty, diff } });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: e.status });
    console.error('Order material delete error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}

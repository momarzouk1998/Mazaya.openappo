import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import prisma from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * One-time fix: recalculate quantity_used, quantity_remaining, total_price
 * from actual order_materials + quantity_in.
 * Call: GET /api/fix-inventory (requires admin login)
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "admin") {
      return NextResponse.json({ ok: false, error: "أدمن فقط" }, { status: 403 });
    }

    // Fix boards: recalculate quantity_used from order_materials
    const boardsUsed = await prisma.$queryRawUnsafe<{ item_id: string; total_used: string }[]>(`
      SELECT item_id, SUM(quantity_used)::numeric AS total_used
      FROM mazaya.order_materials
      WHERE item_category = 'boards_inventory'
      GROUP BY item_id
    `);

    let boardsFixed = 0;
    for (const row of boardsUsed) {
      const used = Number(row.total_used);
      if (used > 0) {
        const r = await prisma.$executeRawUnsafe(`
          UPDATE mazaya.boards_inventory
          SET quantity_used = $1,
              quantity_remaining = GREATEST(quantity_in - $1, 0),
              total_price = GREATEST(quantity_in - $1, 0) * unit_price
          WHERE id = $2::uuid AND deleted_at IS NULL
        `, used, row.item_id);
        boardsFixed += r;
      }
    }

    // For boards with NO materials but quantity_remaining = 0 and quantity_in > 0
    const boardsNoMaterials = await prisma.$executeRawUnsafe(`
      UPDATE mazaya.boards_inventory
      SET quantity_remaining = quantity_in,
          total_price = quantity_in * unit_price
      WHERE deleted_at IS NULL
        AND quantity_remaining = 0
        AND quantity_in > 0
        AND id NOT IN (SELECT item_id FROM mazaya.order_materials WHERE item_category = 'boards_inventory')
    `);
    boardsFixed += boardsNoMaterials;

    // Fix accessories: same
    const accUsed = await prisma.$queryRawUnsafe<{ item_id: string; total_used: string }[]>(`
      SELECT item_id, SUM(quantity_used)::numeric AS total_used
      FROM mazaya.order_materials
      WHERE item_category = 'accessories_inventory'
      GROUP BY item_id
    `);

    let accFixed = 0;
    for (const row of accUsed) {
      const used = Number(row.total_used);
      if (used > 0) {
        const r = await prisma.$executeRawUnsafe(`
          UPDATE mazaya.accessories_inventory
          SET quantity_used = $1,
              quantity_remaining = GREATEST(quantity_in - $1, 0),
              total_price = GREATEST(quantity_in - $1, 0) * unit_price
          WHERE id = $2::uuid AND deleted_at IS NULL
        `, used, row.item_id);
        accFixed += r;
      }
    }

    const accNoMaterials = await prisma.$executeRawUnsafe(`
      UPDATE mazaya.accessories_inventory
      SET quantity_remaining = quantity_in,
          total_price = quantity_in * unit_price
      WHERE deleted_at IS NULL
        AND quantity_remaining = 0
        AND quantity_in > 0
        AND id NOT IN (SELECT item_id FROM mazaya.order_materials WHERE item_category = 'accessories_inventory')
    `);
    accFixed += accNoMaterials;

    // Verify
    const boardsSample = await prisma.$queryRawUnsafe<any[]>(
      `SELECT item_name, quantity_in, quantity_used, quantity_remaining, total_price, unit_price FROM mazaya.boards_inventory WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 10`
    );

    return NextResponse.json({
      ok: true,
      message: "تم إصلاح المخزون",
      boardsFixed,
      accessoriesFixed: accFixed,
      sample: boardsSample.map((b: any) => ({
        name: b.item_name,
        qtyIn: Number(b.quantity_in),
        qtyUsed: Number(b.quantity_used),
        remaining: Number(b.quantity_remaining),
        total: Number(b.total_price),
        price: Number(b.unit_price),
      })),
    });
  } catch (e: any) {
    console.error("Fix inventory error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "حدث خطأ" }, { status: 500 });
  }
}

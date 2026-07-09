import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import prisma from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * One-time fix: update quantity_remaining and total_price for records
 * where quantity_in > 0 but quantity_remaining = 0.
 * Call: GET /api/fix-inventory (requires admin login)
 */
export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "admin") {
      return NextResponse.json({ ok: false, error: "أدمن فقط" }, { status: 403 });
    }

    const boardsResult = await prisma.$executeRawUnsafe(`
      UPDATE mazaya.boards_inventory
      SET quantity_remaining = quantity_in,
          total_price = quantity_in * unit_price
      WHERE deleted_at IS NULL
        AND quantity_remaining = 0
        AND quantity_in > 0
    `);

    const accResult = await prisma.$executeRawUnsafe(`
      UPDATE mazaya.accessories_inventory
      SET quantity_remaining = quantity_in,
          total_price = quantity_in * unit_price
      WHERE deleted_at IS NULL
        AND quantity_remaining = 0
        AND quantity_in > 0
    `);

    // Verify
    const boardsSample = await prisma.$queryRawUnsafe<any[]>(
      `SELECT item_name, quantity_in, quantity_remaining, total_price, unit_price FROM mazaya.boards_inventory WHERE deleted_at IS NULL LIMIT 10`
    );

    return NextResponse.json({
      ok: true,
      message: "تم إصلاح المخزون",
      boardsFixed: boardsResult,
      accessoriesFixed: accResult,
      sample: boardsSample.map((b: any) => ({
        name: b.item_name,
        qtyIn: Number(b.quantity_in),
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

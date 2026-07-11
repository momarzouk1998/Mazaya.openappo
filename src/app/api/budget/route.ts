import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import prisma from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get("month"); // format: "2026-07"

    const now = new Date();
    const year = monthStr ? parseInt(monthStr.split("-")[0]) : now.getFullYear();
    const month = monthStr ? parseInt(monthStr.split("-")[1]) : now.getMonth() + 1;

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const monthEndStr = monthEnd.toISOString().slice(0, 10);

    // ===== أوردرات الشهر =====
    // (P4) نستخدم parameterized queries بدل string interpolation
    const orders = await prisma.$queryRawUnsafe<any[]>(`
      SELECT status, boards_cost, accessories_cost, installation_cost,
             internal_transport_cost, external_transport_cost,
             factory_commission, order_total
      FROM mazaya.orders
      WHERE deleted_at IS NULL
        AND created_at >= $1::timestamptz
        AND created_at <= $2::timestamptz
    `, monthStartStr, monthEndStr).catch(() => []);

    const completedOrders = orders.filter(o => o.status === "مكتمل" || o.status === "تم التسليم");
    const openOrders = orders.filter(o => o.status === "مفتوح" || o.status === "قيد التنفيذ");

    const sumField = (arr: any[], field: string) => arr.reduce((s: number, o: any) => s + Number(o[field] ?? 0), 0);

    const completedOrderTotal = sumField(completedOrders, "order_total");
    const completedBoardsCost = sumField(completedOrders, "boards_cost");
    const completedAccessoriesCost = sumField(completedOrders, "accessories_cost");
    const completedInstallCost = sumField(completedOrders, "installation_cost");
    const completedIntTransport = sumField(completedOrders, "internal_transport_cost");
    const completedExtTransport = sumField(completedOrders, "external_transport_cost");
    const completedCommission = sumField(completedOrders, "factory_commission");

    const openOrderTotal = sumField(openOrders, "order_total");

    // ===== حركات اليومية للشهر =====
    const journal = await prisma.$queryRawUnsafe<any[]>(`
      SELECT entry_type, amount, is_passthrough
      FROM mazaya.journal_entries
      WHERE deleted_at IS NULL
        AND date >= $1::date
        AND date <= $2::date
    `, monthStartStr, monthEndStr).catch(() => []);

    const income = journal
      .filter(j => j.entry_type === "دفعة واردة من معرض" && !j.is_passthrough)
      .reduce((s, j) => s + Number(j.amount), 0);

    const purchases = journal
      .filter(j => ["مشتريات", "نثريات"].includes(j.entry_type))
      .reduce((s, j) => s + Number(j.amount), 0);

    const payouts = journal
      .filter(j => j.entry_type === "دفعة صادرة لمورد" && !j.is_passthrough)
      .reduce((s, j) => s + Number(j.amount), 0);

    const overheadOnly = journal
      .filter(j => j.entry_type === "نثريات")
      .reduce((s, j) => s + Number(j.amount), 0);

    const boardsPurchases = journal
      .filter(j => j.entry_type === "مشتريات")
      .reduce((s, j) => s + Number(j.amount), 0);

    // ===== المخزون الحالي =====
    const [boardsInv, accInv] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`SELECT unit_price, quantity_remaining, quantity_in FROM mazaya.boards_inventory WHERE deleted_at IS NULL`).catch(() => []),
      prisma.$queryRawUnsafe<any[]>(`SELECT unit_price, quantity_remaining, quantity_in FROM mazaya.accessories_inventory WHERE deleted_at IS NULL`).catch(() => []),
    ]);

    const inventoryValue = boardsInv.reduce((s, b) => s + Number(b.unit_price ?? 0) * Number(b.quantity_remaining ?? 0), 0)
      + accInv.reduce((s, a) => s + Number(a.unit_price ?? 0) * Number(a.quantity_remaining ?? 0), 0);

    const totalItems = boardsInv.length + accInv.length;

    // ===== تكلفة الأوردرات المكتملة (المصروف الفعلي) =====
    const totalOrderCost = completedBoardsCost + completedAccessoriesCost
      + completedInstallCost + completedIntTransport + completedExtTransport + completedCommission;

    // ===== صافي الشهر =====
    const netCash = income - purchases - payouts;
    const grossProfit = completedOrderTotal - totalOrderCost;
    const overallNet = netCash; // الوارد - كل المصروفات

    return NextResponse.json({
      ok: true,
      data: {
        month: `${year}-${String(month).padStart(2, "0")}`,
        monthLabel: new Date(year, month - 1).toLocaleDateString("ar-EG", { month: "long", year: "numeric" }),

        // إجماليات الأوردرات
        totalOrders: orders.length,
        completedOrdersCount: completedOrders.length,
        openOrdersCount: openOrders.length,

        // قيمة الأوردرات المكتملة (المبيعات)
        completedOrderTotal,
        openOrderTotal,

        // تفصيل تكلفة الأوردرات المكتملة
        completedBoardsCost,
        completedAccessoriesCost,
        completedInstallCost,
        completedIntTransport,
        completedExtTransport,
        completedCommission,
        totalOrderCost,

        // الحركة المالية
        income,          // وارد من معارض
        boardsPurchases, // مشتريات ألواح + اكسسوارات
        overheadOnly,     // نثريات فقط
        purchases,       // مشتريات + نثريات
        payouts,          // دفوع للموردين

        // المخزون
        inventoryValue,
        totalItems,

        // صافي
        netCash,
        grossProfit,
        overallNet,
      },
    });
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "غير مسجل الدخول" } }, { status: e.status });
    console.error("Budget error:", e);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 });
  }
}

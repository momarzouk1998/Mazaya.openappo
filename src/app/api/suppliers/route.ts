import { NextResponse } from "next/server"
import { requirePermission } from '@/lib/auth-server'
import prisma from "@/lib/db/prisma"
import { auditLog } from "@/lib/audit"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await requirePermission('suppliers', 'view')
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const search = searchParams.get("search") || ""
    const offset = (page - 1) * limit

    const where: any = { deleted_at: null }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.suppliers.findMany({ where, orderBy: { created_at: "desc" }, skip: offset, take: limit }),
      prisma.suppliers.count({ where }),
    ])

    // Fetch financial stats for all suppliers from journal_entries
    const rawStats: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        party_id::text as party_id,
        SUM(CASE WHEN entry_type IN ('مشتريات', 'purchase') THEN amount ELSE 0 END) as total_purchases,
        SUM(CASE WHEN entry_type IN ('دفعة صادرة لمورد', 'outgoing_to_supplier') THEN amount ELSE 0 END) as total_payments
      FROM mazaya.journal_entries
      WHERE party_type = 'supplier' AND party_id IS NOT NULL
      GROUP BY party_id
    `);

    // Create a map for quick lookup and compute global stats
    const statsMap = new Map<string, { purchases: number, payments: number, balance: number }>();
    let totalDebt = 0; // Factory owes suppliers
    let totalCredit = 0; // Factory overpaid suppliers

    for (const row of rawStats) {
      if (!row.party_id) continue;
      const purchases = Number(row.total_purchases || 0);
      const payments = Number(row.total_payments || 0);
      const balance = purchases - payments; // Positive = Factory owes supplier (Debt)
      
      statsMap.set(row.party_id, { purchases, payments, balance });
      
      if (balance > 0) totalDebt += balance;
      else if (balance < 0) totalCredit += Math.abs(balance);
    }

    // Attach balances to the paginated items
    const itemsWithBalance = items.map(item => {
      const stats = statsMap.get(item.id) || { purchases: 0, payments: 0, balance: 0 };
      return {
        ...item,
        total_purchases: stats.purchases,
        total_payments: stats.payments,
        balance: stats.balance
      };
    });

    return NextResponse.json({ 
      ok: true, 
      data: { 
        items: itemsWithBalance, 
        total, 
        page, 
        limit,
        stats: { totalDebt, totalCredit, suppliersCount: total }
      } 
    })
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status })
    console.error("Suppliers list error:", e)
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission('suppliers', 'add')
    const body = await request.json()
    const { name, payment_type, phone, notes } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "اسم المورد مطلوب" } }, { status: 400 })
    }

    // accept any Arabic or English payment type
    const pt = payment_type || "نقدي"

    const item = await prisma.suppliers.create({
      data: { name: name.trim(), payment_type: pt, phone: phone || null, notes: notes || null },
    })

    auditLog({ user_id: user.id, action: "create", table_name: "suppliers", row_id: item.id, after: item })

    return NextResponse.json({ ok: true, data: item }, { status: 201 })
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status })
    console.error("Supplier create error:", e)
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 })
  }
}


import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from '@/lib/auth-server'
import prisma from "@/lib/db/prisma"
import { auditLog } from "@/lib/audit"
import { increaseInventory } from "@/lib/inventory"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('boards_inventory', 'add')
    const body = await request.json()
    const { item_id, quantity, unit_price, supplier_id, payment_method, notes, date, create_journal } = body

    if (!item_id) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "معرف الصنف مطلوب" } }, { status: 400 })
    const qty = Number(quantity || 0)
    if (qty <= 0) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "الكمية يجب أن تكون أكبر من صفر" } }, { status: 400 })
    const price = Number(unit_price || 0)
    if (price < 0) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "سعر الشراء غير صالح" } }, { status: 400 })

    const item = await prisma.boards_inventory.findFirst({ where: { id: item_id, deleted_at: null } })
    if (!item) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "الصنف غير موجود" } }, { status: 404 })

    const total = qty * price

    const result = await prisma.$transaction(async (tx) => {
      const before = { quantity_in: item.quantity_in, quantity_remaining: item.quantity_remaining, unit_price: item.unit_price }
      // الـ trigger في الـ DB + الـ helper بيحدّثوا quantity_remaining و
      // total_price بشكل أوتوماتيك. قانون واحد لكل أنواع الشراء (F7).
      await increaseInventory(
        prisma,
        "boards_inventory",
        item_id,
        qty,
        { newUnitPrice: price, supplierId: supplier_id || item.supplier_id || null, txClient: tx }
      );
      const updated = await tx.boards_inventory.findUnique({ where: { id: item_id } });

      let journal: any = null
      if (create_journal) {
        journal = await tx.journal_entries.create({
          data: {
            date: date ? new Date(date) : new Date(),
            entry_type: "مشتريات",
            description: "شراء " + qty + " " + item.item_name,
            amount: total,
            payment_method: payment_method || "نقدي",
            party_type: supplier_id ? "supplier" : null,
            party_id: supplier_id || null,
            notes: notes || null,
            created_by: user.id,
          },
        })
        auditLog({ user_id: user.id, action: "create", table_name: "journal_entries", row_id: journal.id, after: journal })
      }

      auditLog({ user_id: user.id, action: "update", table_name: "boards_inventory", row_id: item_id, before, after: updated })

      return { item: updated, journal }
    })

    return NextResponse.json({ ok: true, data: { ...result.item, total, quantity_remaining: Number(result.item.quantity_remaining) } }, { status: 201 })
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status })
    console.error("Board purchase error:", e)
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 })
  }
}


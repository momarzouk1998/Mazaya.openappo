import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from '@/lib/auth-server'
import prisma from "@/lib/db/prisma"
import { auditLog } from "@/lib/audit"

export const dynamic = "force-dynamic"

let legacySynced = false

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('material_types', 'view')
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "500")
    const category = searchParams.get("category") || ""
    const where: any = {}
    if (category) where.category = category
    const offset = (page - 1) * limit
    const [items, total] = await Promise.all([
      prisma.material_types.findMany({ where, orderBy: [{ sort_order: "asc" }, { name: "asc" }], skip: offset, take: limit }),
      prisma.material_types.count({ where }),
    ])

    // --- Dynamic fallback for legacy materials (Runs only once per server start) ---
    if (!legacySynced) {
      const legacyNames = new Set<string>()
      if (!category || category === "board") {
        const bMats = await prisma.boards_inventory.findMany({
          where: { material_type: { not: "" }, deleted_at: null },
          select: { material_type: true },
          distinct: ["material_type"],
        })
        bMats.forEach(b => legacyNames.add((b.material_type || "").trim()))
      }
      if (!category || category === "accessory") {
        const aMats = await prisma.accessories_inventory.findMany({
          where: { material_type: { not: "" }, deleted_at: null },
          select: { material_type: true },
          distinct: ["material_type"],
        })
        aMats.forEach(a => legacyNames.add((a.material_type || "").trim()))
      }
      const existingNames = new Set(items.map(i => i.name.trim().toLowerCase()))

      const newItemsToInsert: any[] = []
      legacyNames.forEach(name => {
        if (name && !existingNames.has(name.toLowerCase())) {
          newItemsToInsert.push({
            name,
            category: category || "board",
            is_active: true,
            sort_order: 99
          })
          existingNames.add(name.toLowerCase())
        }
      })

      legacySynced = true // Mark as synced so it doesn't run again

      if (newItemsToInsert.length > 0) {
        await prisma.material_types.createMany({ data: newItemsToInsert, skipDuplicates: true })
        const [newItems, newTotal] = await Promise.all([
          prisma.material_types.findMany({ where, orderBy: [{ sort_order: "asc" }, { name: "asc" }], skip: offset, take: limit }),
          prisma.material_types.count({ where }),
        ])
        return NextResponse.json({ ok: true, data: { items: newItems, total: newTotal, page, limit } })
      }
    }
    // ---------------------------------------------

    return NextResponse.json({ ok: true, data: { items, total, page, limit } })
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: e.code || 'UNAUTHORIZED', message: e?.message || 'غير مسجل الدخول' } }, { status: 401 })
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مصرح' } }, { status: 403 })
    console.error("Error:", e)
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission('material_types', 'add')
    const body = await request.json()
    const name = (body.name || body.value || "").trim()
    const category = body.category || "board"

    if (!name) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "اسم المادة مطلوب" } }, { status: 400 })
    }
    if (!["board", "accessory"].includes(category)) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "التصنيف يجب أن يكون board أو accessory" } }, { status: 400 })
    }

    const existing = await prisma.material_types.findFirst({ where: { name }, select: { id: true } })
    if (existing) {
      return NextResponse.json({ ok: true, data: await prisma.material_types.findUnique({ where: { id: existing.id } }) }, { status: 200 })
    }

    const sort_order = body.sort_order ?? 99
    const materialType = await prisma.material_types.create({ data: { name, category, sort_order } })
    auditLog({ user_id: user.id, action: "create", table_name: "material_types", row_id: materialType.id, after: materialType })
    return NextResponse.json({ ok: true, data: materialType }, { status: 201 })
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: e.code || 'UNAUTHORIZED', message: e?.message || 'غير مسجل الدخول' } }, { status: 401 })
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مصرح' } }, { status: 403 })
    console.error("Error:", e)
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 })
  }
}

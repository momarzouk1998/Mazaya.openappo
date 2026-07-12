import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import prisma from "@/lib/db/prisma"
import { auditLog } from "@/lib/audit"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id: orderIdStr } = await params
    const orderId = orderIdStr
    const order = await prisma.orders.findFirst({ where: { id: orderId, deleted_at: null }, select: { id: true } })
    if (!order) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "الأوردر غير موجود" } }, { status: 404 })
    const r = await prisma.$queryRawUnsafe<any[]>(`SELECT oew.*, co.name as contractor_name FROM mazaya.order_external_work oew LEFT JOIN mazaya.contractors co ON oew.contractor_id = co.id WHERE oew.order_id = $1::uuid ORDER BY oew.created_at DESC`, orderId)
    return NextResponse.json({ ok: true, data: r })
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "غير مسجل الدخول" } }, { status: e.status })
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id: orderIdStr } = await params
    const orderId = orderIdStr
    const body = await request.json()
    const order = await prisma.orders.findFirst({ where: { id: orderId, deleted_at: null }, select: { id: true } })
    if (!order) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "الأوردر غير موجود" } }, { status: 404 })
    const items = Array.isArray(body) ? body : [body]
    const created: any[] = []
    for (const it of items) {
      const contractorRaw = it.contractor_id
      // نشيل قيم غير صالحة (NaN / رقم / فاضي) — contractor_id لازم UUID أو null
      const contractorId = (contractorRaw == null || contractorRaw === "" || (typeof contractorRaw === "number" && Number.isNaN(contractorRaw)) || String(contractorRaw) === "NaN")
        ? null
        : String(contractorRaw)
      const r = await prisma.order_external_work.create({
        data: {
          order_id: orderId,
          contractor_id: contractorId,
          work_type: it.work_type || it.description || "",
          amount: Number(it.amount ?? it.cost ?? 0),
          notes: it.notes || null,
        },
      })
      created.push(r)
      auditLog({ user_id: user.id, action: "create", table_name: "order_external_work", row_id: r.id, after: r })
    }
    return NextResponse.json({ ok: true, data: created }, { status: 201 })
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "غير مسجل الدخول" } }, { status: e.status })
    console.error("External work create error:", e)
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id: orderIdStr } = await params
    const orderId = orderIdStr
    const { searchParams } = new URL(request.url)
    const externalId = searchParams.get("external_id")
    if (externalId === "all") {
      await prisma.order_external_work.deleteMany({ where: { order_id: orderId } })
      return NextResponse.json({ ok: true, data: { deleted: "all" } })
    }
    if (!externalId) return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "معرف العمل مطلوب" } }, { status: 400 })
    const before = await prisma.order_external_work.findFirst({ where: { id: externalId, order_id: orderId } })
    if (!before) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "العمل غير موجود" } }, { status: 404 })
    await prisma.order_external_work.delete({ where: { id: externalId } })
    auditLog({ user_id: user.id, action: "delete", table_name: "order_external_work", row_id: externalId, before })
    return NextResponse.json({ ok: true, data: { message: "تم حذف العمل" } })
  } catch (e: any) {
    if (e.status) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "غير مسجل الدخول" } }, { status: e.status })
    console.error("External work delete error:", e)
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 })
  }
}


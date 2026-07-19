import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth-server";
import prisma from "@/lib/db/prisma";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

// ============================================================
// DELETE /api/accessories/purchase/:journal_id
// يحذف قيد شراء الإكسسوارات ويعكس المخزن
// ============================================================
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ journal_id: string }> }
) {
  try {
    const user = await requirePermission("accessories_inventory", "delete");
    const { journal_id } = await params;

    const journal = await prisma.journal_entries.findFirst({
      where: { id: journal_id, entry_type: "شراء إكسسوارات" },
    });
    if (!journal) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "قيد الشراء غير موجود" } },
        { status: 404 }
      );
    }

    // استنتاج الكمية واسم الصنف من الـ description — format: "شراء {qty} {item_name}"
    const descParts = journal.description?.match(/^شراء\s+([\d.]+)\s+(.+)$/);
    const qty = descParts ? Number(descParts[1]) : null;
    const itemName = descParts ? descParts[2] : null;
    const supplierId = journal.party_id;
    const amount = Number(journal.amount);

    await prisma.$transaction(async (tx) => {
      // 1) عكس المخزن — نطرح الكمية اللي اتضافت
      if (itemName && qty && qty > 0) {
        const item = await tx.accessories_inventory.findFirst({
          where: {
            item_name: itemName,
            deleted_at: null,
            ...(supplierId ? { supplier_id: Number(supplierId) } : {}),
          },
        });
        if (item) {
          const newQtyIn = Math.max(0, Number(item.quantity_in) - qty);
          const newQtyRemaining = Math.max(0, Number(item.quantity_remaining) - qty);
          await tx.accessories_inventory.update({
            where: { id: item.id },
            data: { quantity_in: newQtyIn, quantity_remaining: newQtyRemaining, updated_at: new Date() },
          });
          auditLog({
            user_id: user.id, action: "update",
            table_name: "accessories_inventory", row_id: item.id,
            before: { quantity_in: item.quantity_in, quantity_remaining: item.quantity_remaining },
            after: { quantity_in: newQtyIn, quantity_remaining: newQtyRemaining },
          });
        }
      }

      // 2) احذف القيد
      await tx.journal_entries.delete({ where: { id: journal_id } });
    });

    auditLog({
      user_id: user.id, action: "delete",
      table_name: "journal_entries", row_id: journal_id, before: journal,
    });

    return NextResponse.json({ ok: true, data: { deleted: true, reversed_amount: amount } });
  } catch (e: any) {
    if (e.status)
      return NextResponse.json({ ok: false, error: { code: e.code || "FORBIDDEN", message: e?.message } }, { status: e.status });
    console.error("Accessory purchase delete error:", e);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/accessories/purchase/:journal_id
// يعدّل المبلغ / التاريخ / طريقة الدفع / المورد للقيد فقط
// (الكمية في المخزن لا تتغير — تعقيد زائد بدون فائدة عملية)
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ journal_id: string }> }
) {
  try {
    const user = await requirePermission("accessories_inventory", "edit");
    const { journal_id } = await params;

    const journal = await prisma.journal_entries.findFirst({
      where: { id: journal_id, entry_type: "شراء إكسسوارات" },
    });
    if (!journal) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "قيد الشراء غير موجود" } },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { amount, date, payment_method, description, notes, supplier_id } = body;

    if (amount !== undefined && Number(amount) <= 0) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: "المبلغ يجب أن يكون أكبر من صفر" } },
        { status: 400 }
      );
    }

    const data: any = { updated_at: new Date() };
    if (amount !== undefined) data.amount = Number(amount);
    if (date) data.date = new Date(date);
    if (payment_method) data.payment_method = payment_method;
    if (description) data.description = description.trim();
    if (notes !== undefined) data.notes = notes || null;
    if (supplier_id !== undefined) {
      data.party_type = supplier_id ? "supplier" : null;
      data.party_id = supplier_id || null;
    }

    const updated = await prisma.journal_entries.update({ where: { id: journal_id }, data });

    auditLog({
      user_id: user.id, action: "update",
      table_name: "journal_entries", row_id: journal_id,
      before: journal, after: updated,
    });

    return NextResponse.json({ ok: true, data: { ...updated, amount: Number(updated.amount) } });
  } catch (e: any) {
    if (e.status)
      return NextResponse.json({ ok: false, error: { code: e.code || "FORBIDDEN", message: e?.message } }, { status: e.status });
    console.error("Accessory purchase update error:", e);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "حدث خطأ" } }, { status: 500 });
  }
}

// ============================================================
// Single Source of Truth (SSoT) — منطق المخزون
// ============================================================
// كل تعديل على المخزون في النظام لازم يمر من هنا عشان:
//  1) نضمن إن quantity_used / quantity_in بتتحدث صح
//  2) الـ DB trigger (trg_recompute_boards / _accessories) يحسب
//     quantity_remaining و total_price تلقائياً
//  3) نمنع منطق مكرر بين purchase / order_materials POST/PATCH/DELETE
//
// ملحوظة F7: قبل كده كان في 4 formulas مختلفة لـ quantity_remaining
// (boards/purchase, materials POST, materials PATCH, materials DELETE)
// والـ trigger بيلغي كل ده ويحط قانون واحد: remaining = in - used.
// ============================================================

export type InventoryCategory = "boards_inventory" | "accessories_inventory";

const TABLE_FOR_CATEGORY: Record<InventoryCategory, string> = {
  boards_inventory: "mazaya.boards_inventory",
  accessories_inventory: "mazaya.accessories_inventory",
};

/**
 * يضيف كمية على المخزون (الكمية الواردة من شراء).
 * الـ trigger بيحسب quantity_remaining و total_price تلقائياً.
 */
export async function increaseInventory(
  prisma: any,
  category: InventoryCategory,
  itemId: string,
  qty: number,
  options?: { newUnitPrice?: number; supplierId?: string | null; txClient?: any }
) {
  if (qty <= 0) throw new Error("increaseInventory: qty must be > 0");
  const client = options?.txClient ?? prisma;
  const table = TABLE_FOR_CATEGORY[category];
  // بنبني SET clause ديناميكياً — الـ trigger بياخد quantity_in
  // و quantity_used وبيحسب الباقي
  const setClauses = [
    `quantity_in = quantity_in + $1`,
    `quantity_remaining = GREATEST(quantity_in + $1 - quantity_used, 0)`,
    `total_price = GREATEST(quantity_in + $1 - quantity_used, 0) * unit_price`,
  ];
  const params: any[] = [qty];
  let paramIdx = 2;
  if (options?.newUnitPrice !== undefined) {
    setClauses.push(`unit_price = $${paramIdx++}`);
    params.push(options.newUnitPrice);
    // لو السعر اتغير، نعيد حساب total_price بالقيمة الجديدة
    setClauses[setClauses.length - 2] = `total_price = GREATEST(quantity_in + $1 - quantity_used, 0) * $${paramIdx - 1}`;
  }
  if (options?.supplierId !== undefined) {
    setClauses.push(`supplier_id = $${paramIdx++}::uuid`);
    params.push(options.supplierId);
  }
  await client.$executeRawUnsafe(
    `UPDATE ${table}
     SET ${setClauses.join(", ")}
     WHERE id = $${paramIdx}::uuid AND deleted_at IS NULL`,
    ...params,
    itemId
  );
}

/**
 * يخصم من المخزون (الكمية المستخدمة في أوردر).
 * الـ trigger بيحسب quantity_remaining و total_price تلقائياً.
 *
 * @param diff موجب = زيادة استهلاك، سالب = إرجاع للمخزون
 */
export async function adjustInventoryUsage(
  prisma: any,
  category: InventoryCategory,
  itemId: string,
  diff: number,
  options?: { txClient?: any }
) {
  if (diff === 0) return;
  const client = options?.txClient ?? prisma;
  const table = TABLE_FOR_CATEGORY[category];
  // diff > 0: زيادة في quantity_used (خصم من المتاح)
  // diff < 0: نقص في quantity_used (إرجاع للمتاح)
  await client.$executeRawUnsafe(
    `UPDATE ${table}
     SET quantity_used = GREATEST(quantity_used + $1, 0),
         quantity_remaining = GREATEST(quantity_in - GREATEST(quantity_used + $1, 0), 0),
         total_price = GREATEST(quantity_in - GREATEST(quantity_used + $1, 0), 0) * unit_price
     WHERE id = $2::uuid AND deleted_at IS NULL`,
    diff,
    itemId
  );
}

/**
 * يرجع الكمية المتاحة في المخزون (للفحص قبل الخصم).
 */
export async function getInventoryRemaining(
  prisma: any,
  category: InventoryCategory,
  itemId: string
): Promise<number> {
  const table = TABLE_FOR_CATEGORY[category];
  const r: any[] = await prisma.$queryRawUnsafe(
    `SELECT quantity_remaining FROM ${table} WHERE id = $1::uuid AND deleted_at IS NULL`,
    itemId
  );
  if (!r.length) return 0;
  return Number(r[0].quantity_remaining ?? 0);
}

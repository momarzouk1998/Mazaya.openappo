// ============================================================
// Fix existing inventory records where quantity_remaining drifted
// from the canonical formula: quantity_remaining = quantity_in - quantity_used
// ============================================================
// هذا السكربت يبقى موجوداً كاحتياط فقط. الـ DB trigger
// (trg_recompute_boards / trg_recompute_accessories) موجود في
// migration: 20260711_financial_sso_views ويحسب quantity_remaining
// و total_price تلقائياً بعد كل INSERT/UPDATE. لو حصل drift قبل
// تطبيق الـ migration، السكربت ده يصلح البيانات مرة واحدة.
//
// الاستخدام:
//   node fix-inventory-remaining.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('Fixing boards_inventory...');
  // قانون موحد (F7): quantity_remaining = quantity_in - quantity_used
  // total_price = quantity_remaining * unit_price
  const boardsResult = await prisma.$executeRawUnsafe(`
    UPDATE mazaya.boards_inventory
    SET quantity_remaining = GREATEST(quantity_in - quantity_used, 0),
        total_price = GREATEST(quantity_in - quantity_used, 0) * unit_price
    WHERE deleted_at IS NULL
  `);
  console.log(`Boards fixed: ${boardsResult} rows`);

  console.log('Fixing accessories_inventory...');
  const accResult = await prisma.$executeRawUnsafe(`
    UPDATE mazaya.accessories_inventory
    SET quantity_remaining = GREATEST(quantity_in - quantity_used, 0),
        total_price = GREATEST(quantity_in - quantity_used, 0) * unit_price
    WHERE deleted_at IS NULL
  `);
  console.log(`Accessories fixed: ${accResult} rows`);

  // Backfill order_materials.line_total (F5) — للصفوف اللي line_total بيساوي NULL
  console.log('Backfilling order_materials.line_total...');
  const matResult = await prisma.$executeRawUnsafe(`
    UPDATE mazaya.order_materials
    SET line_total = quantity_used * unit_price_snapshot
    WHERE line_total IS NULL
  `);
  console.log(`Materials backfilled: ${matResult} rows`);

  // Verify
  const boards = await prisma.$queryRawUnsafe(`
    SELECT item_name, quantity_in, quantity_used, quantity_remaining, total_price, unit_price
    FROM mazaya.boards_inventory
    WHERE deleted_at IS NULL
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 10
  `);
  console.log('\nSample boards after fix:');
  console.table(boards);

  await prisma.$disconnect();
}

fix().catch(e => { console.error(e); prisma.$disconnect(); });

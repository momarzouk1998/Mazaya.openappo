// Fix existing inventory records where quantity_remaining = 0 but quantity_in > 0
// Run: node fix-inventory-remaining.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  console.log('Fixing boards_inventory...');
  const boardsResult = await prisma.$executeRawUnsafe(`
    UPDATE mazaya.boards_inventory
    SET quantity_remaining = quantity_in,
        total_price = quantity_in * unit_price
    WHERE deleted_at IS NULL
      AND quantity_remaining = 0
      AND quantity_in > 0
  `);
  console.log(`Boards fixed: ${boardsResult} rows`);

  console.log('Fixing accessories_inventory...');
  const accResult = await prisma.$executeRawUnsafe(`
    UPDATE mazaya.accessories_inventory
    SET quantity_remaining = quantity_in,
        total_price = quantity_in * unit_price
    WHERE deleted_at IS NULL
      AND quantity_remaining = 0
      AND quantity_in > 0
  `);
  console.log(`Accessories fixed: ${accResult} rows`);

  // Verify
  const boards = await prisma.$queryRawUnsafe(`SELECT item_name, quantity_in, quantity_remaining, total_price, unit_price FROM mazaya.boards_inventory WHERE deleted_at IS NULL LIMIT 10`);
  console.log('\nSample boards after fix:');
  console.table(boards);

  await prisma.$disconnect();
}

fix().catch(e => { console.error(e); prisma.$disconnect(); });

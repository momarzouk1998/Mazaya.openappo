// سكربت تشخيص: القيود اللي فيها مبالغ خيالية
// node scripts/check-huge-amounts.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== القيود بمبالغ أكبر من 1,000,000 ===\n');
  const huge = await prisma.$queryRawUnsafe(`
    SELECT id, date, entry_type, description, amount, is_pass_through, party_type, created_at
    FROM mazaya.journal_entries
    WHERE amount > 1000000 OR amount < -1000000
    ORDER BY date DESC
  `);
  if (huge.length === 0) {
    console.log('مفيش قيود بمبالغ كبيرة. يعني المشكلة في الحساب.');
  } else {
    for (const r of huge) {
      console.log(`${r.date} | ${r.entry_type} | amount=${r.amount} | passthrough=${r.is_pass_through}`);
      console.log(`   id=${r.id}`);
      console.log(`   desc=${r.description}`);
      console.log('');
    }
  }

  console.log('\n=== كل القيود في الفترة 12-17 يوليو ===\n');
  const all = await prisma.$queryRawUnsafe(`
    SELECT date, entry_type, amount, is_pass_through, description
    FROM mazaya.journal_entries
    WHERE date >= '2026-07-12' AND date <= '2026-07-17'
    ORDER BY date ASC, created_at ASC
  `);
  for (const r of all) {
    console.log(`${r.date} | ${r.entry_type} | amount=${r.amount} | pt=${r.is_pass_through} | ${r.description}`);
  }
  console.log(`\nإجمالي القيود: ${all.length}`);
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

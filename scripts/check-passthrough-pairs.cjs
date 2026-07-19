// ============================================================
// check-passthrough-pairs.cjs
// ============================================================
// يتحقق إن كل تحويل تمريري له قيدين (وارد + صادر) بنفس المبلغ.
// لو فيه قيد ناقص، يطّلعه.
//
// طريقة الاستخدام على السيرفر:
//   docker exec -it furniture-xhl2yk node /app/scripts/check-passthrough-pairs.cjs
// أو لو مرفوع محلي:
//   node scripts/check-passthrough-pairs.cjs
// ============================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== كل القيود التمريرية (is_pass_through = true) ===\n');

  const pass = await prisma.$queryRawUnsafe(`
    SELECT id, date, entry_type, description, amount, party_type,
           (SELECT name FROM mazaya.branches   WHERE id = party_id) AS branch_name,
           (SELECT name FROM mazaya.suppliers  WHERE id = party_id) AS supplier_name,
           (SELECT name FROM mazaya.contractors WHERE id = party_id) AS contractor_name
    FROM mazaya.journal_entries
    WHERE is_pass_through = true
    ORDER BY date DESC, created_at DESC
  `);

  if (pass.length === 0) {
    console.log('مفيش قيود تمريرية في الداتابيز.');
    return;
  }

  // طباعة كل قيد
  for (const r of pass) {
    const amt = Number(r.amount);
    const party = r.branch_name || r.supplier_name || r.contractor_name || '?';
    const direction = r.party_type === 'branch' ? 'وارد' : (r.party_type === 'supplier' ? 'صادر' : '?');
    console.log(`${formatDate(r.date)} | ${direction.padEnd(4)} | ${amt.toString().padStart(10)} | ${r.party_type}=${party} | ${r.description}`);
  }

  // التحقق من الأزواج: نجمّع حسب (date, description)
  // كل تمريري المفروض يكون له قيدين: واحد وارد + واحد صادر بنفس المبلغ
  console.log('\n=== التحقق من الأزواج ===\n');

  const groups = {};
  for (const r of pass) {
    // المفتاح: التاريخ + المبلغ (التمريري الواحد ليهم نفس التاريخ والمبلغ غالبًا)
    const key = `${formatDate(r.date)}|${Number(r.amount)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  let problems = 0;
  for (const [key, items] of Object.entries(groups)) {
    const income = items.filter(i => i.party_type === 'branch').length;
    const expense = items.filter(i => i.party_type === 'supplier').length;
    const status = (income >= 1 && expense >= 1) ? '✅' : '❌';
    const [date, amount] = key.split('|');
    console.log(`${status} ${date} | مبلغ ${amount} | وارد=${income} صادر=${expense}`);
    if (status === '❌') {
      problems++;
      console.log(`   ↳ المشكلة: ${income === 0 ? 'مفيش قيد وارد' : 'مفيش قيد صادر'}`);
      console.log(`   ↳ البيان: ${items[0].description}`);
      console.log(`   ↳ الأطراف: ${items.map(i => `${i.party_type}=${i.branch_name || i.supplier_name || i.contractor_name}`).join(', ')}`);
    }
  }

  console.log(`\n=== النتيجة ===`);
  console.log(`إجمالي القيود التمريرية: ${pass.length}`);
  console.log(`أزواج سليمة: ${Object.keys(groups).length - problems}`);
  console.log(`مشاكل (قيد ناقص): ${problems}`);

  if (problems > 0) {
    console.log('\n⚠️  فيه حركات تمريرية ناقصة. تحتاج إصلاح يدوي.');
  } else {
    console.log('\n✅ كل التحويلات التمريرية سليمة.');
  }
}

function formatDate(d) {
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// ============================================================
// check-old-passthrough.cjs
// ============================================================
// يطّلع كل القيود اللي محتملة تكون تمريرية (قديمة أو جديدة)
// ويبّين مين معلم بـ is_pass_through ومين لأ.
//
// طريقة الاستخدام:
//   1. انسخ السكربت للسيرفر:
//      scp scripts/check-old-passthrough.cjs root@64.226.118.40:/tmp/check.cjs
//   2. شغّله جوّا حاوية furniture:
//      docker cp /tmp/check.cjs $(docker ps -qf name=furniture-xhl2yk):/app/check.cjs
//      docker exec $(docker ps -qf name=furniture-xhl2yk) node /app/check.cjs
// ============================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== كل القيود اللي محتملة تكون تمريرية ===\n');

  // نطّلع القيود اللي محتملة تكون تمريرية بأي طريقة:
  //  - is_pass_through = true (اللي معلم صح)
  //  - أو entry_type فيها 'تمريري' أو description فيها 'تمريري'
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, date, entry_type, description, amount,
           is_pass_through,
           party_type,
           (SELECT name FROM mazaya.suppliers  WHERE id = party_id) AS supplier_name,
           (SELECT name FROM mazaya.branches   WHERE id = party_id) AS branch_name
    FROM mazaya.journal_entries
    WHERE is_pass_through = true
       OR entry_type LIKE '%تمريري%'
       OR description LIKE '%تمريري%'
       OR (entry_type = 'دفعة صادرة لمورد' AND party_type = 'supplier')
    ORDER BY date DESC, created_at DESC
    LIMIT 100
  `);

  if (rows.length === 0) {
    console.log('مفيش قيود تمريرية في الداتابيز.');
    return;
  }

  console.log('التاريخ        | is_pass | entry_type                | amount | party | description');
  console.log('-'.repeat(120));

  let flagged = 0;
  for (const r of rows) {
    const date = new Date(r.date).toISOString().slice(0, 10);
    const pt = r.is_pass_through ? '✓' : '❌';
    const amt = Number(r.amount).toString().padStart(8);
    const party = r.party_type === 'supplier' ? `مورد:${r.supplier_name || '?'}` :
                  r.party_type === 'branch' ? `معرض:${r.branch_name || '?'}` : '-';
    const desc = String(r.description || '').slice(0, 50);

    // لو قيد محتمل يكون تمريري (صادر لمورد أو فيه كلمة تمريري) بس مش معلم، نفلّجه
    const isSuspicious =
      (String(r.entry_type).includes('تمريري') || r.entry_type === 'دفعة صادرة لمورد') &&
      !r.is_pass_through;

    if (isSuspicious) {
      flagged++;
      console.log(`${date} | ${pt} ⚠️ | ${(r.entry_type || '').padEnd(25)} | ${amt} | ${party.padEnd(20)} | ${desc}`);
    } else {
      console.log(`${date} | ${pt}    | ${(r.entry_type || '').padEnd(25)} | ${amt} | ${party.padEnd(20)} | ${desc}`);
    }
  }

  console.log('\n=== النتيجة ===');
  console.log(`إجمالي القيود: ${rows.length}`);
  console.log(`قيود مش معلمة is_pass_through (محتاجة تصلح): ${flagged}`);

  if (flagged > 0) {
    console.log('\n⚠️  فيه قيود قديمة محتاجة تتعلم is_pass_through=true.');
    console.log('    شغّل أمر الإصلاح ده:');
    console.log('    sudo -u postgres psql -d mazaya -c "UPDATE mazaya.journal_entries SET is_pass_through = true WHERE entry_type = \'دفعة صادرة لمورد\' AND party_type = \'supplier\' AND is_pass_through = false; UPDATE mazaya.journal_entries SET is_pass_through = true WHERE entry_type = \'دفعة واردة من معرض\' AND party_type = \'branch\' AND description LIKE \'%تمريري%\' AND is_pass_through = false;"');
  }
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

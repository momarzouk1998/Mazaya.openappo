/**
 * تصفير كل بيانات النظام مع الاحتفاظ بجدول المستخدمين (users).
 * Zero out all system data while keeping the users table intact.
 *
 * التشغيل المحلي:  node clear-data.js
 * داخل Docker:     docker exec mazaya node /app/clear-data.js
 *
 * ملاحظات:
 *  - لا يُحذف جدول users إطلاقاً.
 *  - يُفصل أي مستخدم عن فرعه (branch_id = null) قبل حذف الفروع
 *    تفادياً لخطأ قيد المفتاح الأجنبي.
 *  - يُحذف بالترتيب: الأبناء قبل الآباء لاحترام قيود FK.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ترتيب الحذف (الأبناء أولاً) لاحترام قيود المفاتيح الأجنبية.
const DELETE_ORDER = [
  'audit_log',
  'order_materials',
  'order_external_work',
  'order_extra_costs',
  'customer_payments',
  'overhead_expenses', // له FK إلى journal_entries (يجب قبله)
  'journal_entries',
  'orders',
  'boards_inventory',
  'accessories_inventory',
  'customers',
  'suppliers',
  'contractors',
  'workers',
  'material_types',
  'accessory_types',
  'branches', // يُحذف أخيراً بعد فصل المستخدمين
];

async function main() {
  // 1) افصل المستخدمين عن الفروع حتى لا يفشل حذف branches بسبب FK.
  const detached = await prisma.users.updateMany({
    where: { branch_id: { not: null } },
    data: { branch_id: null },
  });
  if (detached.count > 0) {
    console.log(`تم فصل ${detached.count} مستخدم عن فرعه (branch_id = null).`);
  }

  // 2) احذف كل جدول بحسب الترتيب.
  // يتم تجاوز أي جدول لا توجد عليه صلاحية ويسجل لمعالجته لاحقاً.
  let total = 0;
  const skipped = [];
  for (const model of DELETE_ORDER) {
    try {
      const result = await prisma[model].deleteMany();
      if (result.count > 0) {
        console.log(`${model.padEnd(24)} حُذف ${result.count}`);
      }
      total += result.count;
    } catch (e) {
      const msg = (e && e.message) ? e.message.split('\n')[0] : String(e);
      skipped.push(model);
      console.log(`${model.padEnd(24)} ⚠ تم تخطّيه: ${msg}`);
    }
  }
  if (skipped.length > 0) {
    console.log(`\n⚠ لم يُحذف (${skipped.length}) لعدم وجود صلاحية أو خطأ: ${skipped.join(', ')}`);
  }

  // 3) تأكيد بقاء المستخدمين.
  const usersKept = await prisma.users.count();
  console.log('\n----------------------------------------');
  console.log(`إجمالي الصفوف المحذوفة: ${total}`);
  console.log(`المستخدمون المحفوظون: ${usersKept}`);
  console.log('تم.');
}

main()
  .catch((e) => {
    console.error('خطأ أثناء التصفير:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

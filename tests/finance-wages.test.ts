// ============================================================
// Unit test — finance.ts: نوع قيد "أجور عمال" جديد
// ============================================================
// "أجور عمال" لازم:
//   1) يدخل في calcExpense (يحسب في المحفظة والميزانية)
//   2) ميكونش income/payout
//   3) التمريري (is_pass_through=true) مستثنى من كل الحسابات
//
// التشغيل: node --experimental-strip-types --no-warnings=ExperimentalWarning tests/finance-wages.test.ts
// ============================================================

import {
  EXPENSE_TYPES,
  VALID_ENTRY_TYPES,
  calcIncome,
  calcExpense,
  calcPayout,
  calcNet,
} from '../src/lib/finance.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('❌ FAIL:', msg); failures++; }
  else console.log('✅ PASS:', msg);
}

// 1) "أجور عمال" داخل EXPENSE_TYPES و VALID_ENTRY_TYPES
assert(EXPENSE_TYPES.includes('أجور عمال' as any), '"أجور عمال" في EXPENSE_TYPES');
assert((VALID_ENTRY_TYPES as readonly string[]).includes('أجور عمال'), '"أجور عمال" في VALID_ENTRY_TYPES');

// 2) قيد أجور عمال بيدخل في المصروف
const rows = [
  { entry_type: 'أجور عمال', amount: 500, is_pass_through: false },
  { entry_type: 'مشتريات', amount: 300, is_pass_through: false },
];
assert(calcExpense(rows) === 800, `calcExpense = 800 (got ${calcExpense(rows)})`);

// 3) أجور عمال ميكونش income أو payout
assert(calcIncome(rows) === 0, `calcIncome = 0 (got ${calcIncome(rows)})`);
assert(calcPayout(rows) === 0, `calcPayout = 0 (got ${calcPayout(rows)})`);

// 4) التمريري مستثنى من المصروف حتى لو نوعه أجور عمال
const withPassthrough = [
  { entry_type: 'أجور عمال', amount: 500, is_pass_through: false },
  { entry_type: 'أجور عمال', amount: 1000, is_pass_through: true },
];
assert(calcExpense(withPassthrough) === 500, `pass-through excluded from expense (got ${calcExpense(withPassthrough)})`);

// 5) net = income - expense - payout
assert(calcNet(rows) === -800, `calcNet = -800 (got ${calcNet(rows)})`);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log('\n✅ All finance-wages tests passed');
}

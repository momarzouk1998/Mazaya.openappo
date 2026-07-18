// ============================================================
// Unit test — finance.ts + factory-wallet: Prisma Decimal handling
// ============================================================
// الـ bug: Prisma بيرجّع amount كـ Decimal object من $queryRawUnsafe.
// لما الـ reduce بيعمل s + decimalObject، JS بيحوّله لـ string
// فيحصل concatenation بدل جمع: "6000" + "10200" + "6800" = "6000102006800"
// بدل 23000. النتيجة: أرقام خيالية (تريليونات).
//
// الـ fix: toNum لازم يتعامل مع Decimal object (له toNumber/toString).
//
// التشغيل: node --experimental-strip-types --no-warnings=ExperimentalWarning tests/finance-decimal.test.ts
// ============================================================

import {
  calcIncome,
  calcExpense,
  calcNet,
} from '../src/lib/finance.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('❌ FAIL:', msg); failures++; }
  else console.log('✅ PASS:', msg);
}

// محاكاة Prisma Decimal object (زي اللي بيرجع من $queryRawUnsafe)
function makeDecimal(n: number) {
  return {
    toNumber: () => n,
    toString: () => String(n),
  };
}

// سيناريو يوم الأربعاء 15 يوليو اللي كان فيه الـ bug:
//   مشتريات: 6000 + 10200 + 6800 = 23000 (مش 6000102006800!)
const expenseRowsWithDecimal = [
  { entry_type: 'مشتريات', amount: makeDecimal(6000), is_pass_through: false },
  { entry_type: 'مشتريات', amount: makeDecimal(10200), is_pass_through: false },
  { entry_type: 'مشتريات', amount: makeDecimal(6800), is_pass_through: false },
];

const expenseResult = calcExpense(expenseRowsWithDecimal);
assert(
  expenseResult === 23000,
  `calcExpense with Decimal objects = 23000 (got ${expenseResult}) — BUG FIX verified`
);

// لو الـ bug لسه موجود، النتيجة هتكون رقم خيالي زي 6000102006800

// سيناريو مختلط: number + string + Decimal
const mixedRows = [
  { entry_type: 'مشتريات', amount: 1000, is_pass_through: false },           // number
  { entry_type: 'مشتريات', amount: '2000', is_pass_through: false },         // string
  { entry_type: 'مشتريات', amount: makeDecimal(3000), is_pass_through: false }, // Decimal
];
const mixedResult = calcExpense(mixedRows);
assert(mixedResult === 6000, `calcExpense mixed types = 6000 (got ${mixedResult})`);

// calcNet
const netRows = [
  { entry_type: 'دفعة واردة من معرض', amount: makeDecimal(15000), is_pass_through: false },
  { entry_type: 'مشتريات', amount: makeDecimal(23000), is_pass_through: false },
];
const netResult = calcNet(netRows);
assert(netResult === -8000, `calcNet with Decimal = -8000 (got ${netResult})`);

// income
const incomeRows = [
  { entry_type: 'دفعة واردة من معرض', amount: makeDecimal(15000), is_pass_through: false },
];
assert(calcIncome(incomeRows) === 15000, `calcIncome with Decimal = 15000 (got ${calcIncome(incomeRows)})`);

// null/undefined amounts
const nullRows = [
  { entry_type: 'مشتريات', amount: null, is_pass_through: false },
  { entry_type: 'مشتريات', amount: undefined, is_pass_through: false },
  { entry_type: 'مشتريات', amount: makeDecimal(500), is_pass_through: false },
];
assert(calcExpense(nullRows) === 500, `calcExpense with null/undefined = 500 (got ${calcExpense(nullRows)})`);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log('\n✅ All decimal-handling tests passed');
}

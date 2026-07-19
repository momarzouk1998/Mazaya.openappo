// ============================================================
// Single Source of Truth (SSoT) — حسابات المالية
// ============================================================
// كل صفحة (journal, budget, reports, _journal-page-wrapper) كانت
// بتحسب income / expense / payout / net / running balance بشكل مستقل
// بـ filter() و reduce() على الـ array. ده كان بيسبب اختلافات:
//   - الـ running balance كان بيتجاهل الـ payout (F1)
//   - الـ cards بتستخدم صيغ مختلفة (F2)
//   - في حالة pagination، الحسابات بتختلف بين الصفحات
//
// الحل: كل الكود لازم يستخدم الـ functions دي بدل المنطق المكرر.
// الـ constants (INCOME_TYPES, EXPENSE_TYPES, PAYOUT_TYPES) لازم
// تبقى متطابقة بين server validation و client filtering.
// ============================================================

export const INCOME_TYPES = ['دفعة واردة من معرض'] as const;
export const EXPENSE_TYPES = ['مشتريات', 'شراء إكسسوارات', 'نثريات', 'أجور عمال', 'نقل داخلي'] as const;
export const PAYOUT_TYPES = ['دفعة صادرة لمورد'] as const;
export const PASSTHROUGH_TYPES = ['تحويل تمريري', 'transfer'] as const;

// ============================================================
// مجموعات منفصلة ليوميات متخصصة
// ============================================================
// يومية المصنع: كل المصروفات النقدية للمصنع ما عدا شراء الألواح
// (الألواح في يومية الألواح). الإكسسوارات والنقل الداخلي بيدخلوا هنا.
export const FACTORY_EXPENSE_TYPES = ['شراء إكسسوارات', 'نثريات', 'أجور عمال', 'نقل داخلي'] as const;

// يومية الألواح: بتحسب شراء الألواح فقط.
export const BOARDS_EXPENSE_TYPES = ['مشتريات'] as const;


// كل entry types اللي بيتقبلها الـ API (مرجع موحد بدل القيم المكررة)
export const VALID_ENTRY_TYPES = [
  ...INCOME_TYPES,
  ...EXPENSE_TYPES,
  ...PAYOUT_TYPES,
  ...PASSTHROUGH_TYPES,
] as const;

export const VALID_PAYMENT_METHODS = ['نقدي', 'تحويل'] as const;

export type JournalRow = {
  amount: number | string | { toNumber?: () => number; toString?: () => string };
  entry_type: string;
  is_passthrough?: boolean;
  is_pass_through?: boolean;
  date?: string;
};

/** هل الحركة وارد من معرض حقيقي (مش تمريري)؟ */
export function isIncome(r: JournalRow): boolean {
  return (INCOME_TYPES as readonly string[]).includes(r.entry_type) && !isPassThrough(r);
}

/** هل الحركة مصروف (مشتريات أو نثريات)؟ — التمريري ما بيدخلش */
export function isExpense(r: JournalRow): boolean {
  return (EXPENSE_TYPES as readonly string[]).includes(r.entry_type) && !isPassThrough(r);
}

/** هل الحركة دفعة صادرة لمورد حقيقي (مش تمريري)؟ */
export function isPayout(r: JournalRow): boolean {
  return (PAYOUT_TYPES as readonly string[]).includes(r.entry_type) && !isPassThrough(r);
}

/** هل الحركة تمريرية؟ بنقبل is_pass_through أو is_passthrough */
export function isPassThrough(r: JournalRow): boolean {
  return Boolean(r.is_pass_through ?? r.is_passthrough);
}

function toNum(v: number | string | { toNumber?: () => number; toString?: () => string } | null | undefined): number {
  if (v == null) return 0;
  // Prisma بيرجّع Decimal كـ object. لو سبّبناه زي ما هو،
  // الـ reduce هيحصل فيه string concatenation بدل جمع.
  if (typeof v === 'object') {
    const obj = v as { toNumber?: () => number; toString?: () => string };
    if (typeof obj.toNumber === 'function') return obj.toNumber();
    if (typeof obj.toString === 'function') {
      const n = parseFloat(obj.toString());
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return isNaN(v) ? 0 : v;
}

/** إجمالي الوارد الحقيقي (من غير تمريري) */
export function calcIncome(rows: JournalRow[]): number {
  return rows.filter(isIncome).reduce<number>((s, r) => s + toNum(r.amount), 0);
}

/** إجمالي المصروف الحقيقي (مشتريات + نثريات، من غير تمريري) */
export function calcExpense(rows: JournalRow[]): number {
  return rows.filter(isExpense).reduce<number>((s, r) => s + toNum(r.amount), 0);
}

/** إجمالي الدفعات للموردين (من غير تمريري) */
export function calcPayout(rows: JournalRow[]): number {
  return rows.filter(isPayout).reduce<number>((s, r) => s + toNum(r.amount), 0);
}

/** إجمالي الحركات التمريرية (للمعلومات فقط) */
export function calcPassthrough(rows: JournalRow[]): number {
  return rows.filter(isPassThrough).reduce<number>((s, r) => s + toNum(r.amount), 0);
}

/** الصافي = وارد − مصروف − دفعات */
export function calcNet(rows: JournalRow[]): number {
  return calcIncome(rows) - calcExpense(rows) - calcPayout(rows);
}

/** صافي يوم واحد = dayIncome − dayExpense − dayPayout */
export function calcDayNet(rows: JournalRow[]): number {
  return calcIncome(rows) - calcExpense(rows) - calcPayout(rows);
}

/**
 * الرصيد الجاري قبل تاريخ معيّن
 * (opening balance) — يشمل كل الحركات (وارد − مصروف − دفعات)
 * لأيام قبل `dateKey` (YYYY-MM-DD). يطابق الحساب في v_running_balance.
 */
export function calcOpeningBalance(rows: JournalRow[], dateKey: string): number {
  const before = rows.filter(r => (r.date ?? '').slice(0, 10) < dateKey);
  return calcNet(before);
}

/** رصيد آخر اليوم = opening + dayNet */
export function calcClosingBalance(rows: JournalRow[], dateKey: string): number {
  return calcOpeningBalance(rows, dateKey) + calcDayNet(rows.filter(r => (r.date ?? '').slice(0, 10) === dateKey));
}

/** مفتاح الـ YYYY-MM-DD من كائن Date */
export function dateKey(d: Date | string = new Date()): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

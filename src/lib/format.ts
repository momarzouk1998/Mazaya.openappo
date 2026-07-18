// أدوات مساعدة مشتركة
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value);
}
export function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}
export function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("ar-EG", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch { return date; }
}
export function formatDateShort(date: string | null | undefined): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("ar-EG");
  } catch { return date; }
}
export function daysBetween(start: string, end: string): number | null {
  if (!start || !end) return null;
  const s = new Date(start); const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// خرائط العرض (للدروبداونات) — مفاتيح عربية فقط
// ============================================================
export const STATUS_LABELS: Record<string, string> = {
  "مفتوح": "مفتوح",
  "قيد التنفيذ": "قيد التنفيذ",
  "مكتمل": "مكتمل",
  "تم التسليم": "تم التسليم",
};
export const ORDER_TYPE_LABELS: Record<string, string> = {
  "تصنيع جديد": "تصنيع جديد",
  "صيانة": "صيانة",
};
export const ENTRY_TYPE_LABELS: Record<string, string> = {
  "مشتريات": "مشتريات",
  "دفعة واردة من معرض": "دفعة واردة من معرض",
  "دفعة صادرة لمورد": "دفعة صادرة لمورد",
  "تحويل تمريري": "تحويل تمريري",
  "نثريات": "نثريات",
  "أجور عمال": "أجور عمال",
};
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  "نقدي": "نقدي",
  "تحويل": "تحويل",
  "كلاهما": "كلاهما",
};

// ============================================================
// خرائط الألوان (للـ badges) — فيها المفاتيح العربية + الإنجليزية
// عشان بتتوافق مع البيانات القديمة في الداتابيز
// ============================================================
export const STATUS_COLORS: Record<string, string> = {
  "مفتوح": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "قيد التنفيذ": "bg-blue-100 text-blue-800 border-blue-300",
  "مكتمل": "bg-green-100 text-green-800 border-green-300",
  "تم التسليم": "bg-gray-100 text-gray-800 border-gray-300",
  open: "bg-yellow-100 text-yellow-800 border-yellow-300",
  in_progress: "bg-blue-100 text-blue-800 border-blue-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  delivered: "bg-gray-100 text-gray-800 border-gray-300",
};
export const ENTRY_TYPE_COLORS: Record<string, string> = {
  "مشتريات": "bg-red-100 text-red-700 border-red-300",
  "دفعة واردة من معرض": "bg-green-100 text-green-700 border-green-300",
  "دفعة صادرة لمورد": "bg-red-100 text-red-700 border-red-300",
  "تحويل تمريري": "bg-orange-100 text-orange-700 border-orange-300",
  "نثريات": "bg-purple-100 text-purple-700 border-purple-300",
  "أجور عمال": "bg-amber-100 text-amber-700 border-amber-300",
  purchase: "bg-red-100 text-red-700 border-red-300",
  income: "bg-green-100 text-green-700 border-green-300",
  expense: "bg-red-100 text-red-700 border-red-300",
  transfer: "bg-orange-100 text-orange-700 border-orange-300",
  overhead: "bg-purple-100 text-purple-700 border-purple-300",
};

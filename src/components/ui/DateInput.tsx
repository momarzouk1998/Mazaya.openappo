"use client";
import { useRef } from "react";

// ============================================================
// DateInput — حقل تاريخ مع تقويم بصيغة DD/MM/YYYY
// ============================================================
// - input type="date" مخفي يفتح التقويم لما يضغط الأيقونة
// - يعرض للمستخدم: يوم/شهر/سنة
// - يحفظ ويبعت للـ onChange: YYYY-MM-DD
// ============================================================

interface DateInputProps {
  label?: string;
  value: string;           // YYYY-MM-DD
  onChange: (e: { target: { value: string } }) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

/** تحويل YYYY-MM-DD → DD/MM/YYYY */
function toDisplay(iso: string): string {
  if (!iso || iso.length < 10) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/** تحويل DD/MM/YYYY → YYYY-MM-DD */
function toISO(display: string): string {
  const clean = display.replace(/[^0-9]/g, "");
  if (clean.length !== 8) return "";
  const d = clean.slice(0, 2);
  const m = clean.slice(2, 4);
  const y = clean.slice(4, 8);
  if (Number(m) < 1 || Number(m) > 12) return "";
  if (Number(d) < 1 || Number(d) > 31) return "";
  return `${y}-${m}-${d}`;
}

export function DateInput({
  label, value, onChange, required, hint, error, className = "", placeholder = "يوم/شهر/سنة", disabled,
}: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  // ما يكتب في الحقل النصي
  function handleTextChange(raw: string) {
    let digits = raw.replace(/[^0-9]/g, "");
    // auto-format: بعد كل رقمين نضيف /
    if (digits.length > 4) digits = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
    else if (digits.length > 2) digits = digits.slice(0, 2) + "/" + digits.slice(2);

    // نبعت للـ onChange لو اكتمل
    const iso = toISO(digits.replace(/\//g, "").padEnd(8, "0").slice(0, 8) === "00000000" ? "" : digits);
    onChange({ target: { value: iso || "" } });
  }

  // لما يختار من التقويم
  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ target: { value: e.target.value } });
  }

  function openPicker() {
    hiddenRef.current?.showPicker?.();
    hiddenRef.current?.click();
  }

  const display = toDisplay(value);

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}{required && " *"}
        </label>
      )}
      <div className="relative">
        {/* حقل العرض النصي */}
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={e => handleTextChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={10}
          dir="ltr"
          className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:outline-none focus:ring-2 transition-all text-left ${
            error
              ? "border-red-400 focus:ring-red-200"
              : "border-gray-300 focus:ring-brand-orange/30 focus:border-brand-orange"
          } ${disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""} ${className}`}
        />
        {/* زر فتح التقويم */}
        {!disabled && (
          <button
            type="button"
            onClick={openPicker}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-brand-orange transition-colors"
            tabIndex={-1}
            title="اختر من التقويم"
          >
            📅
          </button>
        )}
        {/* input type=date مخفي للتقويم */}
        <input
          ref={hiddenRef}
          type="date"
          value={value || ""}
          onChange={handlePickerChange}
          disabled={disabled}
          className="absolute inset-0 opacity-0 pointer-events-none w-full"
          tabIndex={-1}
        />
      </div>
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default DateInput;

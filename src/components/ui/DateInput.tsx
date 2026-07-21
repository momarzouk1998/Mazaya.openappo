"use client";
import { useState, useEffect, useRef } from "react";

// ============================================================
// DateInput — حقل تاريخ بصيغة DD/MM/YYYY (يوم/شهر/سنة)
// ============================================================
// - يعرض للمستخدم: DD/MM/YYYY (مثال: 21/07/2026)
// - يحفظ داخلياً ويبعت للـ onChange: YYYY-MM-DD (مثال: 2026-07-21)
// - متوافق مع كل الفورمات اللي بتستخدم value + onChange
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
  const parts = display.replace(/[^0-9]/g, "/").split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  if (!d || !m || !y || y.length !== 4) return "";
  const dd = d.padStart(2, "0");
  const mm = m.padStart(2, "0");
  if (Number(mm) < 1 || Number(mm) > 12) return "";
  if (Number(dd) < 1 || Number(dd) > 31) return "";
  return `${y}-${mm}-${dd}`;
}

export function DateInput({
  label, value, onChange, required, hint, error, className = "", placeholder = "يوم/شهر/سنة", disabled,
}: DateInputProps) {
  const [display, setDisplay] = useState(() => toDisplay(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // لو القيمة الخارجية اتغيرت (مثلاً reset) نحدّث العرض
  useEffect(() => {
    if (!focused) {
      setDisplay(toDisplay(value));
    }
  }, [value, focused]);

  function handleChange(raw: string) {
    // السماح بالأرقام والـ / فقط
    let cleaned = raw.replace(/[^0-9/]/g, "");

    // auto-insert / بعد اليوم وبعد الشهر
    if (cleaned.length === 2 && display.length === 1 && !cleaned.includes("/")) {
      cleaned = cleaned + "/";
    } else if (cleaned.length === 5 && display.length === 4 && cleaned.split("/").length === 2) {
      cleaned = cleaned + "/";
    }

    setDisplay(cleaned);

    // لو الإدخال كامل (DD/MM/YYYY = 10 أحرف)
    const iso = toISO(cleaned);
    if (iso) {
      onChange({ target: { value: iso } });
    } else if (cleaned === "") {
      onChange({ target: { value: "" } });
    }
  }

  function handleBlur() {
    setFocused(false);
    // لو المستخدم كتب تاريخ ناقص — نعيد العرض للقيمة المحفوظة
    const iso = toISO(display);
    if (iso) {
      setDisplay(toDisplay(iso));
    } else if (!display) {
      setDisplay("");
    }
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}{required && " *"}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={10}
        dir="ltr"
        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all text-left ${
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-gray-300 focus:ring-brand-orange/30 focus:border-brand-orange"
        } ${disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""} ${className}`}
      />
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default DateInput;

"use client";
import { useRef, useState, useEffect, useMemo } from "react";

// ============================================================
// DateInput — حقل تاريخ: يوم/شهر/سنة مع تقويم مخصص
// ============================================================
// - الحقل النصي يعرض DD/MM/YYYY ويدعم الكتابة اليدوية
// - أيقونة 📅 تفتح تقويم مخصص (مش تقويم المتصفح)
// - التقويم ثابت دايماً: عربي، RTL، ميلادي، أيام بالعربي
//   مش بيتأثر بلغة الجهاز (عربي/إنجليزي) خالص
// - الـ value الخارجي والداخلي دايماً YYYY-MM-DD
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

// تحويلات
function isoToDisplay(iso: string): string {
  if (!iso || iso.length < 10) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function displayToISO(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const d = digits.slice(0, 2), m = digits.slice(2, 4), y = digits.slice(4, 8);
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return "";
  return `${y}-${m}-${d}`;
}

function autoFormat(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length > 4) return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0,2)}/${d.slice(2)}`;
  return d;
}

// فك الـ ISO إلى أجزاء رقمية (آمن ضد NaN)
function isoToParts(iso: string): { y: number; m: number; d: number } | null {
  if (!iso || iso.length < 10) return null;
  const [ys, ms, ds] = iso.slice(0, 10).split("-");
  const y = Number(ys), m = Number(ms), d = Number(ds);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

// ترتيب الأسماء يبدأ من السبت ليناسب التقويم العربي (السبت أول أيام الأسبوع)
const WEEKDAYS = ["سبت", "حد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function daysInMonth(year: number, month1to12: number): number {
  // month1to12: 1=يناير ... 12=ديسمبر
  return new Date(year, month1to12, 0).getDate();
}

// أول أيام الأسبوع (0=السبت) لشهر معيّن
function firstWeekdaySaturdayBased(year: number, month1to12: number): number {
  // getDay(): 0=الأحد ... 6=السبت
  // نحوّلها لأساس السبت: السبت يبقى 0، الأحد 1، ... الجمعة 6
  const jsDay = new Date(year, month1to12 - 1, 1).getDay();
  return (jsDay + 1) % 7;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

// ============================================================
// التقويم المنبثق المخصص
// ============================================================
function Calendar({
  selectedISO,
  viewMonth,   // 1-12
  viewYear,
  onPrevMonth,
  onNextMonth,
  onSelectYear,
  onSelectMonth,
  onPick,
}: {
  selectedISO: string;
  viewMonth: number;
  viewYear: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectYear: (y: number) => void;
  onSelectMonth: (m: number) => void;
  onPick: (iso: string) => void;
}) {
  const [mode, setMode] = useState<"days" | "months" | "years">("days");

  const total = daysInMonth(viewYear, viewMonth);
  const leadBlanks = firstWeekdaySaturdayBased(viewYear, viewMonth);
  const sel = isoToParts(selectedISO);
  const today = isoToParts(todayISO());

  // نولّد شبكة الأيام (6 صفوف × 7 أعمدة) عشان الارتفاع يبقى ثابت
  const cells: (number | null)[] = [];
  for (let i = 0; i < leadBlanks; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  // نطاق السنين المعروضة (12 سنة حول السنة الحالية)
  const yearList = useMemo(() => {
    const start = Math.floor(viewYear / 12) * 12;
    return Array.from({ length: 12 }, (_, i) => start + i);
  }, [viewYear]);

  return (
    <div
      dir="rtl"
      className="w-[300px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
      onMouseDown={(e) => e.preventDefault()} // نمنع ضياع التركيز من الحقل
    >
      {/* الترويسة: تنقّل بين الشهور */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="الشهر السابق"
        >
          {/* سهم لليمين = السابق في RTL */}
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "months" ? "days" : "months")}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          {MONTHS[viewMonth - 1]}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "years" ? "days" : "years")}
          className="rounded-lg px-2 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          {viewYear}
        </button>

        <button
          type="button"
          onClick={onNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          title="الشهر التالي"
        >
          {/* سهم لليسار = التالي في RTL */}
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* وضع الأيام */}
      {mode === "days" && (
        <>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-center text-[11px] font-medium text-gray-400">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const iso = `${viewYear}-${pad2(viewMonth)}-${pad2(d)}`;
              const isSelected = sel && sel.y === viewYear && sel.m === viewMonth && sel.d === d;
              const isToday = today && today.y === viewYear && today.m === viewMonth && today.d === d;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPick(iso)}
                  className={
                    "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors " +
                    (isSelected
                      ? "bg-brand-orange text-white font-semibold"
                      : isToday
                        ? "border border-brand-orange/50 text-brand-orange font-semibold hover:bg-brand-orange/10"
                        : "text-gray-700 hover:bg-gray-100")
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* وضع اختيار الشهر */}
      {mode === "months" && (
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((name, idx) => {
            const m = idx + 1;
            const isSel = viewMonth === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => { onSelectMonth(m); setMode("days"); }}
                className={
                  "rounded-lg py-2 text-sm transition-colors " +
                  (isSel ? "bg-brand-orange text-white font-semibold" : "text-gray-700 hover:bg-gray-100")
                }
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* وضع اختيار السنة */}
      {mode === "years" && (
        <div className="grid grid-cols-3 gap-1">
          {yearList.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => { onSelectYear(y); setMode("days"); }}
              className={
                "rounded-lg py-2 text-sm transition-colors " +
                (viewYear === y ? "bg-brand-orange text-white font-semibold" : "text-gray-700 hover:bg-gray-100")
              }
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* زر "اليوم" */}
      <div className="mt-2 border-t border-gray-100 pt-2">
        <button
          type="button"
          onClick={() => onPick(todayISO())}
          className="w-full rounded-lg py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          اليوم
        </button>
      </div>
    </div>
  );
}

// ============================================================
// المكوّن الرئيسي
// ============================================================
export function DateInput({
  label, value, onChange, required, hint, error, className = "", placeholder = "يوم/شهر/سنة", disabled,
}: DateInputProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);

  // حالة عرض التقويم (شهر/سنة اللي بن展示ها — مش بالضرارة بتاعة القيمة المختارة)
  const [viewYear, setViewYear] = useState<number>(() => {
    const p = isoToParts(value);
    return p ? p.y : new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const p = isoToParts(value);
    return p ? p.m : new Date().getMonth() + 1;
  });

  // مزامنة لو القيمة الخارجية اتغيرت (reset مثلاً)
  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  // إغلاق عند الضغط برّه أو Escape
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleText(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = autoFormat(e.target.value);
    setText(formatted);
    const iso = displayToISO(formatted);
    onChange({ target: { value: iso } });
    // لو اكتمل التاريخ، نوجّه التقويم ليه
    if (iso) {
      const p = isoToParts(iso);
      if (p) { setViewYear(p.y); setViewMonth(p.m); }
    }
  }

  function openPicker() {
    if (disabled) return;
    // وجّه التقويم لشهر القيمة الحالية (أو اليوم لو فاضي)
    const p = isoToParts(value);
    if (p) { setViewYear(p.y); setViewMonth(p.m); }
    setOpen((o) => !o);
  }

  function handlePick(iso: string) {
    onChange({ target: { value: iso } });
    setText(isoToDisplay(iso));
    setOpen(false);
  }

  function goPrevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function goNextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  const baseClass = `w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
    error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-brand-orange/30 focus:border-brand-orange"
  } ${disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : ""}`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}{required && " *"}
        </label>
      )}
      <div className="relative" ref={wrapRef}>
        <div className="relative flex items-center">
          {/* الحقل النصي — يعرض DD/MM/YYYY من اليمين لليسار */}
          <input
            type="text"
            inputMode="numeric"
            value={text}
            onChange={handleText}
            onFocus={() => {
              // وجّه التقويم للقيمة الحالية عند فتح الحقل
              const p = isoToParts(value);
              if (p) { setViewYear(p.y); setViewMonth(p.m); }
            }}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            maxLength={10}
            dir="rtl"
            className={`${baseClass} px-10 text-right ${className}`}
          />
          {/* زر التقويم */}
          {!disabled && (
            <button
              type="button"
              onClick={openPicker}
              tabIndex={-1}
              className="absolute right-3 text-gray-400 hover:text-brand-orange transition-colors"
              title="اختر من التقويم"
              aria-label="اختر من التقويم"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* التقويم المنبثق */}
        {open && !disabled && (
          <div className="absolute left-0 top-full z-50 mt-1">
            <Calendar
              selectedISO={value || ""}
              viewMonth={viewMonth}
              viewYear={viewYear}
              onPrevMonth={goPrevMonth}
              onNextMonth={goNextMonth}
              onSelectYear={setViewYear}
              onSelectMonth={setViewMonth}
              onPick={handlePick}
            />
          </div>
        )}
      </div>
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default DateInput;

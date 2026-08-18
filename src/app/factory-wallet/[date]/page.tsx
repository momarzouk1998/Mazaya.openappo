"use client";
import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import {
  formatCurrency,
  formatDate,
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/format";
import { downloadElementAsPdf } from "@/lib/pdf-export";
import { canSeeModule } from "@/lib/auth";

interface DayEntry {
  id: string;
  date: string | Date;
  entry_type: string;
  description: string;
  amount: number;
  payment_method: string | null;
  party_name: string | null;
  party_type: string | null;
  order_id: string | null;
  order_name?: string | null;
  notes?: string | null;
  created_at?: string;
}

interface DayData {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
  entries: DayEntry[];
}

interface WalletResponse {
  today: DayData;
  days: DayData[];
  current_balance: number;
  totals: any;
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function fmtNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function DayStatementPage() {
  const params = useParams<{ date?: string }>();
  const dateStr = params?.date || new Date().toISOString().slice(0, 10);
  const router = useRouter();
  const { user: profile } = useUserStore();
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<"all" | "cash" | "electronic">("all");

  const query = `/api/factory-wallet?date_from=${dateStr}&date_to=${dateStr}`;
  const { data, loading } = useApi<WalletResponse>(query);

  if (!profile) return null;
  const canSee = canSeeModule(profile, "factory_wallet");

  const dayData: DayData = useMemo(() => {
    if (!data) {
      return {
        date: dateStr,
        opening: 0,
        income: 0,
        expense: 0,
        payout: 0,
        closing: 0,
        count: 0,
        entries: [],
      };
    }
    return (
      data.days?.find((d) => d.date === dateStr) ||
      data.days?.[0] ||
      data.today || {
        date: dateStr,
        opening: 0,
        income: 0,
        expense: 0,
        payout: 0,
        closing: 0,
        count: 0,
        entries: [],
      }
    );
  }, [data, dateStr]);

  const dateObj = new Date(dateStr + "T00:00:00");
  const dayName = isNaN(dateObj.getTime()) ? "" : DAY_NAMES[dateObj.getDay()];

  // Analysis of day movements
  const analysis = useMemo(() => {
    let cashIncome = 0;
    let cashExpense = 0;
    let bankIncome = 0;
    let bankExpense = 0;

    let branchIncome = 0;
    let overheadExpense = 0;
    let workersExpense = 0;
    let roadExpense = 0;
    let otherExpense = 0;

    const entries = dayData.entries || [];

    entries.forEach((e) => {
      const amt = fmtNum(e.amount);
      const isInc = e.entry_type === "دفعة واردة من معرض";
      const isCash = !e.payment_method || e.payment_method === "نقدي";

      if (isInc) {
        if (isCash) cashIncome += amt;
        else bankIncome += amt;
        branchIncome += amt;
      } else {
        if (isCash) cashExpense += amt;
        else bankExpense += amt;

        if (e.entry_type === "نثريات") overheadExpense += amt;
        else if (e.entry_type === "أجور عمال" || e.entry_type === "سلف عمال") workersExpense += amt;
        else if (e.entry_type === "مصاريف طريق") roadExpense += amt;
        else otherExpense += amt;
      }
    });

    const netDay = dayData.income - dayData.expense;

    return {
      cashIncome,
      cashExpense,
      cashNet: cashIncome - cashExpense,
      bankIncome,
      bankExpense,
      bankNet: bankIncome - bankExpense,
      branchIncome,
      overheadExpense,
      workersExpense,
      roadExpense,
      otherExpense,
      netDay,
    };
  }, [dayData]);

  // Filtered entries for table view
  const filteredEntries = useMemo(() => {
    let list = dayData.entries || [];

    if (methodFilter === "cash") {
      list = list.filter((e) => !e.payment_method || e.payment_method === "نقدي");
    } else if (methodFilter === "electronic") {
      list = list.filter((e) => e.payment_method && e.payment_method !== "نقدي");
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((e) => {
        return (
          (e.description || "").toLowerCase().includes(q) ||
          (e.party_name || "").toLowerCase().includes(q) ||
          (e.entry_type || "").toLowerCase().includes(q) ||
          String(e.amount || "").includes(q)
        );
      });
    }

    return list;
  }, [dayData.entries, methodFilter, search]);

  function handleExportExcel() {
    const clean = filteredEntries.map((e, idx) => ({
      "#": idx + 1,
      التاريخ: dateStr,
      "نوع الحركة": ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type,
      البيان: e.description,
      "الجهة / الطرف": e.party_name || "—",
      "طريقة الدفع": PAYMENT_METHOD_LABELS[e.payment_method || "نقدي"] || e.payment_method || "نقدي",
      الوارد: e.entry_type === "دفعة واردة من معرض" ? fmtNum(e.amount) : 0,
      المصروف: e.entry_type !== "دفعة واردة من معرض" ? fmtNum(e.amount) : 0,
      الأثر: e.entry_type === "دفعة واردة من معرض" ? `+${e.amount}` : `-${e.amount}`,
      الملاحظات: e.notes || "—",
    }));

    exportToExcel(clean, `كشف_حساب_يومية_المصنع_${dateStr}`);
  }

  async function handleDownloadPdf() {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    try {
      await downloadElementAsPdf({
        elementId: "printable-day-statement",
        fileName: `كشف_حساب_يومية_المصنع_${dateStr}`,
        orientation: "landscape",
      });
    } catch (e) {
      console.error("PDF download error:", e);
      alert("تعذر إنشاء ملف PDF، يرجى المحاولة مرة أخرى.");
    } finally {
      setPdfGenerating(false);
    }
  }

  if (!canSee) {
    return (
      <DashboardLayout profile={profile}>
        <div className="card text-center text-gray-500 py-12">🔒 هذه الصفحة للمصنع فقط.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout profile={profile}>
      {/* رأس الصفحة مع العنوان والأزرار العلوية */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h1 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <span>📅</span>
            <span>كشف حساب يومية المصنع — {dayName} {formatDate(dateStr)}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            تفاصيل حركة الخزينة والإيرادات والمصروفات والأرصدة الافتتاحية والختامية لهذا اليوم
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportExcel}
            className="flex items-center gap-1 font-bold h-7 text-xs px-2.5 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
          >
            <span>📥</span>
            <span>تحميل Excel</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1 font-bold h-7 text-xs px-2.5 bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
          >
            <span>🖨️</span>
            <span>طباعة</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            className="flex items-center gap-1 font-bold h-7 text-xs px-2.5 bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 disabled:opacity-50"
          >
            <span>{pdfGenerating ? "⏳" : "📄"}</span>
            <span>{pdfGenerating ? "جاري التجهيز..." : "تحميل PDF"}</span>
          </Button>

          <Link
            href="/factory-wallet"
            className="btn-secondary h-7 px-2.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
          >
            <span>←</span>
            <span>رجوع لليومية</span>
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* كروت ملخصة للأرصدة والإيرادات والمصروفات وصافي اليوم */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-3">
        {/* 1. الرصيد الافتتاحي */}
        <div className="bg-white rounded-xl border border-gray-200 p-2.5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-500 mb-1">🪙 الرصيد الافتتاحي</div>
          <div className={`text-base font-extrabold font-mono ${dayData.opening < 0 ? "text-rose-600" : "text-gray-900"}`}>
            {formatCurrency(dayData.opening)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">بداية اليوم</div>
        </div>

        {/* 2. إجمالي الوارد */}
        <div className="bg-emerald-50/70 rounded-xl border border-emerald-200 p-2.5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-emerald-800 mb-1">📥 إجمالي الوارد</div>
          <div className="text-base font-extrabold font-mono text-emerald-700">
            +{formatCurrency(dayData.income)}
          </div>
          <div className="text-[10px] text-emerald-600/80 mt-1">دفعات المعارض والمقبوضات</div>
        </div>

        {/* 3. إجمالي المصروف */}
        <div className="bg-rose-50/70 rounded-xl border border-rose-200 p-2.5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-rose-800 mb-1">📤 إجمالي المصروف</div>
          <div className="text-base font-extrabold font-mono text-rose-700">
            -{formatCurrency(dayData.expense)}
          </div>
          <div className="text-[10px] text-rose-600/80 mt-1">نثريات وأجور ومصاريف</div>
        </div>

        {/* 4. صافي حركة اليوم */}
        <div className="bg-blue-50/70 rounded-xl border border-blue-200 p-2.5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-blue-800 mb-1">💰 صافي حركة اليوم</div>
          <div className={`text-base font-extrabold font-mono ${analysis.netDay >= 0 ? "text-blue-900" : "text-rose-600"}`}>
            {formatCurrency(analysis.netDay)}
          </div>
          <div className="text-[10px] text-blue-600/80 mt-1">الوارد − المصروف</div>
        </div>

        {/* 5. الرصيد الختامي */}
        <div className="bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white rounded-xl p-2.5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-white/90 mb-1">💵 الرصيد الختامي</div>
          <div className="text-base font-extrabold font-mono text-white">
            {formatCurrency(dayData.closing)}
          </div>
          <div className="text-[10px] text-white/80 mt-1">نهاية اليوم</div>
        </div>

        {/* 6. عدد الحركات */}
        <div className="bg-white rounded-xl border border-gray-200 p-2.5 shadow-xs flex flex-col justify-between">
          <div className="text-[11px] font-bold text-gray-500 mb-1">🔢 عدد العمليات</div>
          <div className="text-base font-extrabold font-mono text-gray-800">
            {dayData.entries.length} حركة
          </div>
          <div className="text-[10px] text-gray-400 mt-1">مسجلة باليومية</div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* تحليل قنوات الدفع والتصنيفات */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        {/* قنوات النقدية (كاش vs بنك) */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
          <div className="text-xs font-bold text-gray-800 mb-2 flex items-center justify-between border-b pb-1.5">
            <span>💳 تحليل قنوات النقدية والوسائل</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-200">
              <div className="font-bold text-amber-900 mb-1 flex items-center justify-between">
                <span>💵 الخزينة النقدية (كاش)</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-600">وارد نقدي:</span>
                  <strong className="font-mono text-emerald-700">+{formatCurrency(analysis.cashIncome)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">مصروف نقدي:</span>
                  <strong className="font-mono text-rose-700">-{formatCurrency(analysis.cashExpense)}</strong>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>صافي النقدية:</span>
                  <strong className="font-mono">{formatCurrency(analysis.cashNet)}</strong>
                </div>
              </div>
            </div>

            <div className="bg-purple-50/50 p-2 rounded-lg border border-purple-200">
              <div className="font-bold text-purple-900 mb-1 flex items-center justify-between">
                <span>🏦 بنكي وإلكتروني</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-600">وارد بنكي:</span>
                  <strong className="font-mono text-emerald-700">+{formatCurrency(analysis.bankIncome)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">مصروف بنكي:</span>
                  <strong className="font-mono text-rose-700">-{formatCurrency(analysis.bankExpense)}</strong>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>صافي البنكي:</span>
                  <strong className="font-mono">{formatCurrency(analysis.bankNet)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* توزيع بنود المصروفات */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
          <div className="text-xs font-bold text-gray-800 mb-2 flex items-center justify-between border-b pb-1.5">
            <span>📊 تصنيف بنود المصروفات والإيراد</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex justify-between items-center">
              <span className="text-emerald-900 font-semibold">🏪 دفعات المعارض:</span>
              <strong className="font-mono text-emerald-900 font-bold">{formatCurrency(analysis.branchIncome)}</strong>
            </div>
            <div className="bg-rose-50 p-2 rounded-lg border border-rose-100 flex justify-between items-center">
              <span className="text-rose-900 font-semibold">🧾 نثريات عامة:</span>
              <strong className="font-mono text-rose-900 font-bold">{formatCurrency(analysis.overheadExpense)}</strong>
            </div>
            <div className="bg-amber-50 p-2 rounded-lg border border-amber-100 flex justify-between items-center">
              <span className="text-amber-900 font-semibold">🧑‍🔧 أجور وسلف عمال:</span>
              <strong className="font-mono text-amber-900 font-bold">{formatCurrency(analysis.workersExpense)}</strong>
            </div>
            <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 flex justify-between items-center">
              <span className="text-blue-900 font-semibold">🛣️ مصاريف طريق ونقل:</span>
              <strong className="font-mono text-blue-900 font-bold">{formatCurrency(analysis.roadExpense)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* شريط التحكم بالبحث والفلترة */}
      {/* ======================================================== */}
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-xs mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMethodFilter("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              methodFilter === "all" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            كل الحركات ({dayData.entries.length})
          </button>
          <button
            onClick={() => setMethodFilter("cash")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              methodFilter === "cash" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            💵 نقدي كاش
          </button>
          <button
            onClick={() => setMethodFilter("electronic")}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              methodFilter === "electronic" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🏦 بنكي وإلكتروني
          </button>
        </div>

        <div className="relative w-48 sm:w-60">
          <input
            type="text"
            placeholder="🔍 بحث في بيان أو طرف الحركة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-orange focus:bg-white transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* جدول الحركات التفصيلي */}
      {/* ======================================================== */}
      {loading ? (
        <div className="card text-center py-12 bg-white border">
          <div className="text-2xl mb-2">⏳</div>
          <div className="text-xs font-bold text-gray-600">جاري تحميل بيانات اليومية...</div>
        </div>
      ) : filteredEntries.length > 0 ? (
        <div className="card overflow-hidden p-0 border border-gray-200 shadow-sm rounded-xl bg-white mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 text-gray-800 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-2 text-center font-bold text-gray-500 w-8">#</th>
                  <th className="px-2 py-2 text-center font-extrabold whitespace-nowrap">نوع الحركة</th>
                  <th className="px-3 py-2 text-start font-extrabold">البيان والوصف</th>
                  <th className="px-2 py-2 text-center font-extrabold whitespace-nowrap">الجهة / الطرف</th>
                  <th className="px-2 py-2 text-center font-extrabold whitespace-nowrap">طريقة الدفع</th>
                  <th className="px-2 py-2 text-center font-extrabold whitespace-nowrap">الوارد (+)</th>
                  <th className="px-2 py-2 text-center font-extrabold whitespace-nowrap">المصروف (-)</th>
                  <th className="px-2 py-2 text-center font-extrabold whitespace-nowrap">الأثر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEntries.map((e, i) => {
                  const isIncome = e.entry_type === "دفعة واردة من معرض";
                  const amt = fmtNum(e.amount);
                  return (
                    <tr key={e.id || i} className="hover:bg-orange-50/30 transition">
                      <td className="px-2 py-2 text-center text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${ENTRY_TYPE_COLORS[e.entry_type] || "bg-gray-100 text-gray-800"}`}>
                          {ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-800">
                        {e.description}
                        {e.order_id && (
                          <Link
                            href={`/orders/${e.order_id}`}
                            className="mr-1 inline-block text-[10px] font-bold text-brand-orange hover:underline bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200"
                          >
                            📦 أوردر مرتبط
                          </Link>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap">
                        {e.party_name || "—"}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600 whitespace-nowrap">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                          {PAYMENT_METHOD_LABELS[e.payment_method || "نقدي"] || e.payment_method || "نقدي"}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center font-extrabold font-mono text-emerald-700 whitespace-nowrap">
                        {isIncome ? formatCurrency(amt) : "—"}
                      </td>
                      <td className="px-2 py-2 text-center font-extrabold font-mono text-rose-700 whitespace-nowrap">
                        {!isIncome ? formatCurrency(amt) : "—"}
                      </td>
                      <td className="px-2 py-2 text-center font-bold font-mono whitespace-nowrap">
                        <span className={isIncome ? "text-emerald-700" : "text-rose-700"}>
                          {isIncome ? `+${formatCurrency(amt)}` : `-${formatCurrency(amt)}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-extrabold text-xs text-gray-800">
                <tr>
                  <td className="px-2 py-2 text-center text-gray-500">Σ</td>
                  <td colSpan={4} className="px-3 py-2 text-start">
                    إجمالي حركات اليوم ({filteredEntries.length} حركة)
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-emerald-800 whitespace-nowrap">
                    +{formatCurrency(filteredEntries.filter((e) => e.entry_type === "دفعة واردة من معرض").reduce((s, e) => s + fmtNum(e.amount), 0))}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-rose-800 whitespace-nowrap">
                    -{formatCurrency(filteredEntries.filter((e) => e.entry_type !== "دفعة واردة من معرض").reduce((s, e) => s + fmtNum(e.amount), 0))}
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-extrabold text-brand-orange-dark whitespace-nowrap">
                    {formatCurrency(
                      filteredEntries.filter((e) => e.entry_type === "دفعة واردة من معرض").reduce((s, e) => s + fmtNum(e.amount), 0) -
                      filteredEntries.filter((e) => e.entry_type !== "دفعة واردة من معرض").reduce((s, e) => s + fmtNum(e.amount), 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center text-gray-400 py-12 bg-white border rounded-xl">
          <div className="text-4xl mb-2">📭</div>
          <div className="font-bold text-gray-700 text-sm">لا توجد حركات مسجلة في هذا اليوم</div>
          <div className="text-xs text-gray-400 mt-0.5">لم تسجل أي حركة نقدية في هذا التاريخ.</div>
        </div>
      )}

      {/* ======================================================== */}
      {/* حاوية الطباعة وتحميل الـ PDF المستقلة عالية الجودة (Off-screen) */}
      {/* ======================================================== */}
      <div
        id="printable-day-statement"
        style={{
          position: "fixed",
          left: "-9999px",
          top: "0",
          width: "1200px",
          backgroundColor: "#ffffff",
          padding: "24px",
          color: "#111827",
          fontFamily: "Tajawal, sans-serif",
          zIndex: -100,
        }}
      >
        {/* ترويسة المستند */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #ea580c", paddingBottom: "12px", marginBottom: "16px" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#111827", margin: 0 }}>شركة مزايا للتصنيع والأثاث</h1>
            <h2 style={{ fontSize: "14px", fontWeight: "700", color: "#ea580c", marginTop: "4px", margin: 0 }}>
              كشف حساب يومية المصنع — {dayName} {formatDate(dateStr)}
            </h2>
          </div>
          <div style={{ textAlign: "left", fontSize: "11px", color: "#4b5563" }}>
            <div>تاريخ الاستخراج: {new Date().toLocaleDateString("ar-EG")}</div>
            <div>إجمالي الحركات: {dayData.entries.length} حركة</div>
          </div>
        </div>

        {/* كروت الإحصائيات في الـ PDF */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", marginBottom: "16px" }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px", backgroundColor: "#f9fafb" }}>
            <div style={{ fontSize: "11px", color: "#4b5563", fontWeight: "700" }}>🪙 الرصيد الافتتاحي</div>
            <div style={{ fontSize: "14px", fontWeight: "900", fontFamily: "monospace", marginTop: "4px" }}>{formatCurrency(dayData.opening)}</div>
          </div>
          <div style={{ border: "1px solid #bbf7d0", borderRadius: "8px", padding: "8px", backgroundColor: "#f0fdf4" }}>
            <div style={{ fontSize: "11px", color: "#166534", fontWeight: "700" }}>📥 إجمالي الوارد</div>
            <div style={{ fontSize: "14px", fontWeight: "900", fontFamily: "monospace", color: "#15803d", marginTop: "4px" }}>+{formatCurrency(dayData.income)}</div>
          </div>
          <div style={{ border: "1px solid #fecdd3", borderRadius: "8px", padding: "8px", backgroundColor: "#fff1f2" }}>
            <div style={{ fontSize: "11px", color: "#9f1239", fontWeight: "700" }}>📤 إجمالي المصروف</div>
            <div style={{ fontSize: "14px", fontWeight: "900", fontFamily: "monospace", color: "#be123c", marginTop: "4px" }}>-{formatCurrency(dayData.expense)}</div>
          </div>
          <div style={{ border: "1px solid #bfdbfe", borderRadius: "8px", padding: "8px", backgroundColor: "#eff6ff" }}>
            <div style={{ fontSize: "11px", color: "#1e40af", fontWeight: "700" }}>💰 صافي اليومية</div>
            <div style={{ fontSize: "14px", fontWeight: "900", fontFamily: "monospace", color: "#1d4ed8", marginTop: "4px" }}>{formatCurrency(analysis.netDay)}</div>
          </div>
          <div style={{ border: "1px solid #fed7aa", borderRadius: "8px", padding: "8px", backgroundColor: "#fff7ed" }}>
            <div style={{ fontSize: "11px", color: "#9a3412", fontWeight: "700" }}>💵 الرصيد الختامي</div>
            <div style={{ fontSize: "14px", fontWeight: "900", fontFamily: "monospace", color: "#ea580c", marginTop: "4px" }}>{formatCurrency(dayData.closing)}</div>
          </div>
        </div>

        {/* جدول حركات اليوم في الـ PDF */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", textAlign: "center" }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #d1d5db" }}>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", width: "24px" }}>#</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>نوع الحركة</th>
              <th style={{ padding: "6px 6px", border: "1px solid #e5e7eb", fontWeight: "800", textAlign: "right" }}>البيان والوصف</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>الجهة / الطرف</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>طريقة الدفع</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>الوارد (+)</th>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>المصروف (-)</th>
            </tr>
          </thead>
          <tbody>
            {dayData.entries.map((e, i) => {
              const isIncome = e.entry_type === "دفعة واردة من معرض";
              const amt = fmtNum(e.amount);
              return (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                  <td style={{ padding: "5px 3px", border: "1px solid #e5e7eb", color: "#6b7280", fontFamily: "monospace" }}>{i + 1}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb", whiteSpace: "nowrap", fontWeight: "700" }}>{ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}</td>
                  <td style={{ padding: "5px 6px", border: "1px solid #e5e7eb", textAlign: "right", fontWeight: "600" }}>{e.description}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb", color: "#4b5563" }}>{e.party_name || "—"}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb" }}>{PAYMENT_METHOD_LABELS[e.payment_method || "نقدي"] || e.payment_method || "نقدي"}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb", color: "#15803d", fontWeight: "800", fontFamily: "monospace" }}>{isIncome ? formatCurrency(amt) : "—"}</td>
                  <td style={{ padding: "5px 4px", border: "1px solid #e5e7eb", color: "#be123c", fontWeight: "800", fontFamily: "monospace" }}>{!isIncome ? formatCurrency(amt) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: "#fef3c7", borderTop: "2px solid #d97706", fontWeight: "900", fontSize: "11px" }}>
              <td style={{ padding: "6px 4px", border: "1px solid #fde68a" }}>Σ</td>
              <td colSpan={4} style={{ padding: "6px 6px", border: "1px solid #fde68a", textAlign: "right" }}>إجمالي حركة اليوم ({dayData.entries.length} حركة)</td>
              <td style={{ padding: "6px 4px", border: "1px solid #fde68a", fontFamily: "monospace", color: "#15803d" }}>+{formatCurrency(dayData.income)}</td>
              <td style={{ padding: "6px 4px", border: "1px solid #fde68a", fontFamily: "monospace", color: "#be123c" }}>-{formatCurrency(dayData.expense)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* تنسيقات الطباعة العادية */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 8mm;
          }
          header, aside, .btn-secondary, button, input, select, .no-print {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          .card {
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            break-inside: avoid;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}

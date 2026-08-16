"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApiMutation } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/format";
import DateInput from "@/components/ui/DateInput";

function safeFormatDate(v: any): string {
  if (!v || v === "null" || v === "undefined" || v === "-") return "—";
  if (typeof v === "string" && (v.includes("/") || v === "—")) return v;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v || "—").slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(v || "—");
  }
}

function fmtNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function CashflowReportPage() {
  const { user: profile } = useUserStore();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [subTab, setSubTab] = useState<"all" | "factory" | "boards">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [entries, setEntries] = useState<any[]>([]);
  const { mutate } = useApiMutation();

  async function loadData() {
    setLoading(true);
    try {
      const res = await mutate(
        "GET",
        `/api/journal?limit=2000${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
      );
      const rawList = (res as any)?.data?.entries ?? (res as any)?.data ?? (res as any)?.entries ?? [];

      const mapped = (Array.isArray(rawList) ? rawList : []).map((x: any) => {
        const isBoardsWallet = x.entry_type === "تحويل تمريري" || x.entry_type === "مشتريات";
        const walletType = isBoardsWallet ? "يومية الألواح" : "يومية المصنع";
        const amount = fmtNum(x.amount);
        const isIncome = x.entry_type === "دفعة واردة من معرض" || x.entry_type === "تحويل تمريري";

        return {
          _wallet: isBoardsWallet ? "boards" : "factory",
          _isIncome: isIncome,
          _amount: amount,
          التاريخ: safeFormatDate(x.date),
          "المحفظة / اليومية": walletType,
          "نوع الحركة": x.entry_type ?? "",
          البيان: x.description ?? "",
          الجهة: x.party_name ?? "-",
          "طريقة الدفع": x.payment_method ?? "-",
          الوارد: isIncome ? amount : 0,
          المصروف: !isIncome ? amount : 0,
          الأثر: isIncome ? `+${amount}` : `-${amount}`,
        };
      });

      setEntries(mapped);
    } catch (e) {
      console.error("Cashflow report load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [fromDate, toDate]);

  function applyPreset(preset: "today" | "week" | "month" | "all") {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === "today") {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === "week") {
      const w = new Date();
      w.setDate(now.getDate() - 7);
      setFromDate(w.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (preset === "month") {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(m.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else {
      setFromDate("");
      setToDate("");
    }
  }

  // KPIs
  const stats = useMemo(() => {
    let factoryIncome = 0;
    let factoryExpense = 0;
    let boardsIncome = 0;
    let boardsExpense = 0;

    entries.forEach((e) => {
      if (e._wallet === "factory") {
        if (e._isIncome) factoryIncome += e._amount;
        else factoryExpense += e._amount;
      } else {
        if (e._isIncome) boardsIncome += e._amount;
        else boardsExpense += e._amount;
      }
    });

    const factoryNet = factoryIncome - factoryExpense;
    const boardsNet = boardsIncome - boardsExpense;
    const grandNet = factoryNet + boardsNet;

    return {
      factoryIncome,
      factoryExpense,
      factoryNet,
      boardsIncome,
      boardsExpense,
      boardsNet,
      grandNet,
      totalCount: entries.length,
    };
  }, [entries]);

  // Active dataset
  const activeDataset = useMemo(() => {
    let list = entries;
    if (subTab !== "all") list = list.filter((r) => r._wallet === subTab);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) =>
        Object.entries(r).some(([k, v]) => {
          if (k.startsWith("_")) return false;
          return String(v ?? "").toLowerCase().includes(q);
        })
      );
    }
    return list;
  }, [entries, subTab, search]);

  const columns = useMemo(() => {
    if (!activeDataset.length) return [];
    return Object.keys(activeDataset[0]).filter((k) => !k.startsWith("_"));
  }, [activeDataset]);

  const moneyKeys = useMemo<string[]>(() => {
    return columns.filter((k) => k === "الوارد" || k === "المصروف");
  }, [columns]);

  const columnSums = useMemo<Record<string, number>>(() => {
    const sums: Record<string, number> = {};
    if (!activeDataset.length) return sums;
    moneyKeys.forEach((k) => {
      sums[k] = activeDataset.reduce((s, r) => s + fmtNum(r[k]), 0);
    });
    return sums;
  }, [activeDataset, moneyKeys]);

  function handleExport() {
    const clean = activeDataset.map((row) => {
      const o: any = {};
      columns.forEach((c) => (o[c] = row[c]));
      return o;
    });
    exportToExcel(clean, `تقرير_التدفق_النقدي_${new Date().toISOString().slice(0, 10)}`);
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <PageHeader
          title="تقرير التدفق النقدي واليوميات"
          subtitle="كشف حركات الخزينة والنقدية مع الفصل التام بين يومية المصنع ويومية الألواح"
          backHref="/reports"
        />
        <Link
          href="/reports"
          className="btn-secondary h-9 px-4 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>←</span>
          <span>رجوع للتقارير</span>
        </Link>
      </div>

      {/* فلاتر التاريخ */}
      <div className="card mb-5 bg-white border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b">
          <div className="text-xs font-bold text-gray-700 flex items-center gap-2">
            <span>📅 نطاق حركة النقدية بالتاريخ</span>
            {(fromDate || toDate) && (
              <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                من {fromDate || "البداية"} إلى {toDate || "اليوم"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border text-xs">
            <button
              onClick={() => applyPreset("today")}
              className="px-2.5 py-1 rounded-lg hover:bg-white transition text-gray-700 font-medium"
            >
              اليوم
            </button>
            <button
              onClick={() => applyPreset("week")}
              className="px-2.5 py-1 rounded-lg hover:bg-white transition text-gray-700 font-medium"
            >
              آخر 7 أيام
            </button>
            <button
              onClick={() => applyPreset("month")}
              className="px-2.5 py-1 rounded-lg hover:bg-white transition text-gray-700 font-medium"
            >
              هذا الشهر
            </button>
            <button
              onClick={() => applyPreset("all")}
              className="px-2.5 py-1 rounded-lg hover:bg-white transition text-gray-700 font-medium"
            >
              الكل
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">من تاريخ</label>
            <DateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">إلى تاريخ</label>
            <DateInput value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={loadData} loading={loading} className="w-full h-10 font-bold">
              {loading ? "⏳ جاري التحديث..." : "🔄 تحديث البيانات"}
            </Button>
          </div>
        </div>
      </div>

      {/* كروت المؤشرات النقدية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 border-r-4 border-emerald-600 p-4 shadow-sm">
          <div className="text-xs text-gray-600 font-semibold mb-1">👛 صافي يومية المصنع</div>
          <div className="text-2xl font-extrabold text-emerald-900 font-mono">
            {formatCurrency(stats.factoryNet)}
          </div>
          <div className="text-xs text-emerald-700 mt-1">
            وارد: {formatCurrency(stats.factoryIncome)} − مصروف: {formatCurrency(stats.factoryExpense)}
          </div>
        </div>

        <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-r-4 border-amber-600 p-4 shadow-sm">
          <div className="text-xs text-gray-600 font-semibold mb-1">🪵 صافي يومية الألواح</div>
          <div className="text-2xl font-extrabold text-amber-900 font-mono">
            {formatCurrency(stats.boardsNet)}
          </div>
          <div className="text-xs text-amber-700 mt-1">
            تمريري: {formatCurrency(stats.boardsIncome)} − مشتريات: {formatCurrency(stats.boardsExpense)}
          </div>
        </div>

        <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-4 shadow-md">
          <div className="text-xs text-white/90 font-semibold mb-1">💵 صافي التدفق النقدي الشامل</div>
          <div className="text-2xl font-extrabold font-mono">
            {formatCurrency(stats.grandNet)}
          </div>
          <div className="text-xs text-white/80 mt-1">
            إجمالي الحركات: <strong>{entries.length}</strong> حركة مالية
          </div>
        </div>
      </div>

      {/* التابات الفرعية + البحث والتصدير */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => setSubTab("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              subTab === "all" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            💸 كل الحركات ({entries.length})
          </button>
          <button
            onClick={() => setSubTab("factory")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              subTab === "factory" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            👛 يومية المصنع ({entries.filter((r) => r._wallet === "factory").length})
          </button>
          <button
            onClick={() => setSubTab("boards")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              subTab === "boards" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🪵 يومية الألواح ({entries.filter((r) => r._wallet === "boards").length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              placeholder="🔍 بحث في الحركات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-orange focus:bg-white transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={handleExport} className="flex items-center gap-1.5 font-bold h-9">
            <span>📥</span>
            <span>تصدير Excel</span>
          </Button>
        </div>
      </div>

      {/* جدول البيانات */}
      {loading ? (
        <div className="card text-center py-16 bg-white border">
          <div className="text-3xl mb-2">⏳</div>
          <div className="text-sm font-bold text-gray-600">جاري تحميل بيانات التدفق النقدي...</div>
        </div>
      ) : activeDataset.length > 0 ? (
        <div className="card overflow-hidden p-0 border border-gray-200 shadow-sm rounded-2xl bg-white mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100/80 text-gray-800 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 w-10">#</th>
                  {columns.map((k) => (
                    <th key={k} className="px-3 py-3 text-right font-extrabold text-xs whitespace-nowrap text-gray-700">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeDataset.map((row, i) => (
                  <tr key={i} className="hover:bg-orange-50/30 transition">
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 font-mono">{i + 1}</td>
                    {columns.map((k) => {
                      const v = row[k];
                      const isMoney = moneyKeys.includes(k);
                      const isEffect = k === "الأثر";
                      const isWallet = k === "المحفظة / اليومية";
                      return (
                        <td
                          key={k}
                          className={`px-3 py-2.5 whitespace-nowrap ${
                            isMoney
                              ? "font-bold font-mono text-left"
                              : isEffect
                                ? `font-bold font-mono text-left ${String(v).startsWith("+") ? "text-emerald-600" : "text-rose-600"}`
                                : "text-gray-700"
                          }`}
                        >
                          {isMoney ? (
                            v > 0 ? formatCurrency(fmtNum(v)) : "—"
                          ) : isWallet ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                v === "يومية المصنع" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {v}
                            </span>
                          ) : (
                            v ?? "—"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-extrabold text-xs text-gray-800">
                <tr>
                  <td className="px-3 py-3 text-center text-gray-500">Σ</td>
                  {columns.map((k) => {
                    const isMoney = moneyKeys.includes(k);
                    if (isMoney) {
                      return (
                        <td key={k} className="px-3 py-3 text-left font-mono font-bold text-brand-orange-dark text-sm whitespace-nowrap">
                          {formatCurrency(columnSums[k] || 0)}
                        </td>
                      );
                    }
                    if (k === columns[0]) {
                      return (
                        <td key={k} className="px-3 py-3 whitespace-nowrap text-gray-800">
                          الإجمالي ({activeDataset.length} حركة)
                        </td>
                      );
                    }
                    return <td key={k} className="px-3 py-3"></td>;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center text-gray-400 py-16 bg-white border rounded-2xl">
          <div className="text-5xl mb-3">📭</div>
          <div className="font-extrabold text-gray-700 text-base">لا توجد حركات نقدية مطابقة للفترة المحددة</div>
          <div className="text-xs text-gray-400 mt-1">جرب تغيير نطاق التاريخ أو إلغاء فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

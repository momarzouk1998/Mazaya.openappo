"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
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

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [entries, setEntries] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/journal?limit=2000${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
      ).then((r) => r.json()).catch(() => ({ ok: false, data: [] }));

      const rawList = res?.data?.entries ?? res?.data ?? res?.entries ?? [];

      const mapped = (Array.isArray(rawList) ? rawList : []).map((x: any) => {
        const isBoardsWallet = x.entry_type === "تحويل تمريري" || x.entry_type === "مشتريات";
        const walletType = isBoardsWallet ? "يومية الألواح" : "يومية المصنع";
        const amount = fmtNum(x.amount);
        const isIncome = x.entry_type === "دفعة واردة من معرض" || x.entry_type === "تحويل تمريري";

        return {
          _wallet: isBoardsWallet ? "boards" : "factory",
          _isIncome: isIncome,
          _amount: amount,
          _payMethod: x.payment_method || "نقدي",
          التاريخ: safeFormatDate(x.date),
          "المحفظة / اليومية": walletType,
          "نوع الحركة": x.entry_type ?? "",
          البيان: x.description ?? "",
          الجهة: x.party_name ?? "-",
          "طريقة الدفع": x.payment_method ?? "نقدي",
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
    setPage(1);
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

  // KPIs Breakdown
  const stats = useMemo(() => {
    let factoryIncome = 0;
    let factoryExpense = 0;
    let factoryCount = 0;

    let boardsIncome = 0;
    let boardsExpense = 0;
    let boardsCount = 0;

    let cashTotal = 0;
    let bankTotal = 0;

    entries.forEach((e) => {
      if (e._wallet === "factory") {
        factoryCount++;
        if (e._isIncome) factoryIncome += e._amount;
        else factoryExpense += e._amount;
      } else {
        boardsCount++;
        if (e._isIncome) boardsIncome += e._amount;
        else boardsExpense += e._amount;
      }

      if (e._payMethod === "نقدي" || !e._payMethod) {
        cashTotal += e._amount;
      } else {
        bankTotal += e._amount;
      }
    });

    const factoryNet = factoryIncome - factoryExpense;
    const boardsNet = boardsIncome - boardsExpense;
    const grandNet = factoryNet + boardsNet;

    return {
      factoryIncome,
      factoryExpense,
      factoryNet,
      factoryCount,
      boardsIncome,
      boardsExpense,
      boardsNet,
      boardsCount,
      grandNet,
      cashTotal,
      bankTotal,
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

  const totalPages = Math.max(1, Math.ceil(activeDataset.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return activeDataset.slice(start, start + pageSize);
  }, [activeDataset, page, pageSize]);

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
      <div className="flex items-center justify-between gap-3 mb-3">
        <PageHeader
          title="تقرير التدفق النقدي واليوميات"
          subtitle="تحليل الخزينة مع الفصل التام بين يومية المصنع ويومية الألواح وتفصيل الوارد والمصروف"
          backHref="/reports"
        />
        <Link
          href="/reports"
          className="btn-secondary h-8 px-3 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
        >
          <span>←</span>
          <span>رجوع للتقارير</span>
        </Link>
      </div>

      {/* فلاتر التاريخ */}
      <div className="card mb-3.5 bg-white border border-gray-100 shadow-xs p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b">
          <div className="text-xs font-bold text-gray-700 flex items-center gap-2">
            <span>📅 نطاق حركة النقدية بالتاريخ</span>
            {(fromDate || toDate) && (
              <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                من {fromDate || "البداية"} إلى {toDate || "اليوم"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-lg border text-xs">
            <button
              onClick={() => applyPreset("today")}
              className="px-2 py-1 rounded hover:bg-white transition text-gray-700 font-medium"
            >
              اليوم
            </button>
            <button
              onClick={() => applyPreset("week")}
              className="px-2 py-1 rounded hover:bg-white transition text-gray-700 font-medium"
            >
              آخر 7 أيام
            </button>
            <button
              onClick={() => applyPreset("month")}
              className="px-2 py-1 rounded hover:bg-white transition text-gray-700 font-medium"
            >
              هذا الشهر
            </button>
            <button
              onClick={() => applyPreset("all")}
              className="px-2 py-1 rounded hover:bg-white transition text-gray-700 font-medium"
            >
              كل الحركات
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">من تاريخ</label>
            <DateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">إلى تاريخ</label>
            <DateInput value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={loadData} loading={loading} className="w-full h-8 text-xs font-bold">
              {loading ? "⏳ جاري التحديث..." : "🔄 تحديث البيانات"}
            </Button>
          </div>
        </div>
      </div>

      {/* كروت المؤشرات التفصيلية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3.5">
        {/* يومية المصنع */}
        <div className="bg-white rounded-xl p-3 border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold mb-1">
            <span>👛 يومية المصنع</span>
            <span className="bg-emerald-50 px-2 py-0.5 rounded text-[11px]">{stats.factoryCount} حركة</span>
          </div>
          <div className="text-base font-extrabold text-emerald-950 font-mono">
            صافي: {formatCurrency(stats.factoryNet)}
          </div>
          <div className="text-[11px] text-emerald-800 mt-1 flex justify-between border-t border-emerald-100 pt-1">
            <span>وارد: <strong>{formatCurrency(stats.factoryIncome)}</strong></span>
            <span>مصروف: <strong>{formatCurrency(stats.factoryExpense)}</strong></span>
          </div>
        </div>

        {/* يومية الألواح */}
        <div className="bg-white rounded-xl p-3 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold mb-1">
            <span>🪵 يومية الألواح</span>
            <span className="bg-amber-50 px-2 py-0.5 rounded text-[11px]">{stats.boardsCount} حركة</span>
          </div>
          <div className="text-base font-extrabold text-amber-950 font-mono">
            صافي: {formatCurrency(stats.boardsNet)}
          </div>
          <div className="text-[11px] text-amber-800 mt-1 flex justify-between border-t border-amber-100 pt-1">
            <span>تمريري وارد: <strong>{formatCurrency(stats.boardsIncome)}</strong></span>
            <span>مشتريات: <strong>{formatCurrency(stats.boardsExpense)}</strong></span>
          </div>
        </div>

        {/* صافي التدفق الشامل */}
        <div className="bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-white/90 text-xs font-bold mb-1">
            <span>💵 صافي الخزينة العام</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-[11px]">{stats.totalCount} حركة كلية</span>
          </div>
          <div className="text-base font-extrabold font-mono text-white">
            {formatCurrency(stats.grandNet)}
          </div>
          <div className="text-[11px] text-white/80 mt-1 flex justify-between border-t border-white/20 pt-1">
            <span>نقدي: <strong>{formatCurrency(stats.cashTotal)}</strong></span>
            <span>بنكي/إلكتروني: <strong>{formatCurrency(stats.bankTotal)}</strong></span>
          </div>
        </div>
      </div>

      {/* التابات الفرعية + البحث والتصدير */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => { setSubTab("all"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "all" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            💸 كل الحركات ({entries.length})
          </button>
          <button
            onClick={() => { setSubTab("factory"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "factory" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            👛 يومية المصنع ({stats.factoryCount})
          </button>
          <button
            onClick={() => { setSubTab("boards"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "boards" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🪵 يومية الألواح ({stats.boardsCount})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
          <div className="relative flex-1 sm:w-52">
            <input
              type="text"
              placeholder="🔍 بحث في الحركات..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-orange focus:bg-white transition"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(1); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={handleExport} className="flex items-center gap-1 font-bold h-8 text-xs">
            <span>📥</span>
            <span>Excel</span>
          </Button>
        </div>
      </div>

      {/* جدول البيانات */}
      {loading ? (
        <div className="card text-center py-12 bg-white border">
          <div className="text-2xl mb-2">⏳</div>
          <div className="text-xs font-bold text-gray-600">جاري تحميل بيانات التدفق النقدي...</div>
        </div>
      ) : activeDataset.length > 0 ? (
        <div className="card overflow-hidden p-0 border border-gray-200 shadow-sm rounded-xl bg-white mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 text-gray-800 border-b border-gray-200">
                <tr>
                  <th className="px-2.5 py-2.5 text-center font-bold text-gray-500 w-8">#</th>
                  {columns.map((k) => (
                    <th key={k} className="px-2.5 py-2.5 text-right font-extrabold whitespace-nowrap text-gray-700">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRows.map((row, i) => (
                  <tr key={i} className="hover:bg-orange-50/30 transition">
                    <td className="px-2.5 py-2 text-center text-gray-400 font-mono">
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    {columns.map((k) => {
                      const v = row[k];
                      const isMoney = moneyKeys.includes(k);
                      const isEffect = k === "الأثر";
                      const isWallet = k === "المحفظة / اليومية";
                      return (
                        <td
                          key={k}
                          className={`px-2.5 py-2 whitespace-nowrap ${
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
                              className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
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
                  <td className="px-2.5 py-2.5 text-center text-gray-500">Σ</td>
                  {columns.map((k) => {
                    const isMoney = moneyKeys.includes(k);
                    if (isMoney) {
                      return (
                        <td key={k} className="px-2.5 py-2.5 text-left font-mono font-bold text-brand-orange-dark text-xs whitespace-nowrap">
                          {formatCurrency(columnSums[k] || 0)}
                        </td>
                      );
                    }
                    if (k === columns[0]) {
                      return (
                        <td key={k} className="px-2.5 py-2.5 whitespace-nowrap text-gray-800">
                          الإجمالي ({activeDataset.length} حركة)
                        </td>
                      );
                    }
                    return <td key={k} className="px-2.5 py-2.5"></td>;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ترقيم الصفحات Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-gray-50/80 border-t text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span>
                عرض {(page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, activeDataset.length)} من {activeDataset.length} حركة
              </span>
              <span className="text-gray-300">|</span>
              <span>حجم الصفحة:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-white border rounded px-1.5 py-0.5 text-xs font-semibold"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 bg-white border rounded disabled:opacity-40 font-bold hover:bg-gray-100"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 bg-white border rounded disabled:opacity-40 font-bold hover:bg-gray-100"
              >
                السابق
              </button>
              <span className="px-2.5 py-1 font-bold text-gray-800">
                صفحة {page} من {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 bg-white border rounded disabled:opacity-40 font-bold hover:bg-gray-100"
              >
                التالي
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 bg-white border rounded disabled:opacity-40 font-bold hover:bg-gray-100"
              >
                »
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center text-gray-400 py-12 bg-white border rounded-xl">
          <div className="text-4xl mb-2">📭</div>
          <div className="font-bold text-gray-700 text-sm">لا توجد حركات نقدية مطابقة للفترة المحددة</div>
          <div className="text-xs text-gray-400 mt-0.5">جرب تغيير نطاق التاريخ أو إلغاء فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

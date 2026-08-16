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

export default function WorkersReportPage() {
  const { user: profile } = useUserStore();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [subTab, setSubTab] = useState<"summary" | "logs">("summary");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [logsData, setLogsData] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const fetchSafe = (url: string) =>
        fetch(url)
          .then((r) => r.json())
          .catch(() => ({ ok: false, data: [] }));

      const [wRes, dlRes] = await Promise.all([
        fetchSafe("/api/workers?limit=500"),
        fetchSafe(
          `/api/workers/daily-logs?limit=2000${fromDate ? "&startDate=" + fromDate : ""}${toDate ? "&endDate=" + toDate : ""}`
        ),
      ]);

      const workers = wRes?.data?.items ?? wRes?.data ?? wRes?.items ?? [];
      const logs = dlRes?.data?.items ?? dlRes?.data ?? dlRes?.items ?? [];

      const workerSummaryMap: Record<
        string,
        { count: number; normalDays: number; travelDays: number; total: number; lastDate: string }
      > = {};

      (Array.isArray(logs) ? logs : []).forEach((l: any) => {
        const rate = fmtNum(l.daily_rate);
        const wid = String(l.worker_id || l.worker?.id);
        if (!workerSummaryMap[wid]) {
          workerSummaryMap[wid] = { count: 0, normalDays: 0, travelDays: 0, total: 0, lastDate: "" };
        }
        workerSummaryMap[wid].count += 1;
        workerSummaryMap[wid].total += rate;
        if (l.is_travel) {
          workerSummaryMap[wid].travelDays += 1;
        } else {
          workerSummaryMap[wid].normalDays += 1;
        }
        const d = String(l.work_date).slice(0, 10);
        if (d > workerSummaryMap[wid].lastDate) {
          workerSummaryMap[wid].lastDate = d;
        }
      });

      const sRows = (Array.isArray(workers) ? workers : []).map((wk: any) => {
        const s = workerSummaryMap[String(wk.id)] || {
          count: 0,
          normalDays: 0,
          travelDays: 0,
          total: 0,
          lastDate: "-",
        };
        return {
          "اسم العامل": wk.name ?? "",
          المهنة: wk.job_title || wk.role || "عامل",
          الهاتف: wk.phone ?? "-",
          "اليومية الأساسية": fmtNum(wk.daily_rate),
          "إجمالي الأيام": s.count,
          "أيام عادية": s.normalDays,
          "أيام سفر": s.travelDays,
          "إجمالي الأجور المستحقة": s.total,
          "آخر يومية مسجلة": s.lastDate ? safeFormatDate(s.lastDate) : "-",
        };
      });

      const lRows = (Array.isArray(logs) ? logs : []).map((l: any) => ({
        التاريخ: safeFormatDate(l.work_date),
        "اسم العامل": l.worker?.name || "عامل",
        الأوردر: l.order?.order_name || "—",
        "اليومية المحسوبة": fmtNum(l.daily_rate),
        "سفرية؟": l.is_travel ? "✈️ نعم" : "لا",
        الملاحظات: l.notes || "-",
      }));

      setSummaryData(sRows);
      setLogsData(lRows);
    } catch (e) {
      console.error("Workers report load error:", e);
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
    const totalWages = summaryData.reduce((s, r) => s + fmtNum(r["إجمالي الأجور المستحقة"]), 0);
    const totalNormal = summaryData.reduce((s, r) => s + fmtNum(r["أيام عادية"]), 0);
    const totalTravel = summaryData.reduce((s, r) => s + fmtNum(r["أيام سفر"]), 0);
    const activeWorkers = summaryData.filter((r) => fmtNum(r["إجمالي الأيام"]) > 0).length;

    return {
      totalWages,
      totalNormal,
      totalTravel,
      activeWorkers,
      workersCount: summaryData.length,
      logsCount: logsData.length,
    };
  }, [summaryData, logsData]);

  // Active dataset
  const activeDataset = useMemo(() => {
    let list = subTab === "summary" ? summaryData : logsData;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [subTab, summaryData, logsData, search]);

  const totalPages = Math.max(1, Math.ceil(activeDataset.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return activeDataset.slice(start, start + pageSize);
  }, [activeDataset, page, pageSize]);

  const columns = useMemo(() => {
    if (!activeDataset.length) return [];
    return Object.keys(activeDataset[0]);
  }, [activeDataset]);

  const moneyKeys = useMemo(() => {
    return columns.filter((k) => k.includes("الأجور") || k.includes("اليومية"));
  }, [columns]);

  const columnSums = useMemo(() => {
    const sums: Record<string, number> = {};
    if (!activeDataset.length) return sums;
    moneyKeys.forEach((k) => {
      sums[k] = activeDataset.reduce((s, r) => s + fmtNum(r[k]), 0);
    });
    return sums;
  }, [activeDataset, moneyKeys]);

  function handleExport() {
    exportToExcel(
      activeDataset,
      `تقرير_${subTab === "summary" ? "ملخص_أجور_العمال" : "سجل_يوميات_العمال"}_${new Date().toISOString().slice(0, 10)}`
    );
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <PageHeader
          title="تقرير أجور ويوميات العمال"
          subtitle="تحليل مستحقات العمال وسجل اليوميات والسفريات المحسوبة على الأوردرات"
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
            <span>📅 نطاق اليوميات المسجلة بالتاريخ</span>
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
              كل العمال
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
        {/* إجمالي الأجور */}
        <div className="bg-white rounded-xl p-3 border border-orange-200 shadow-xs">
          <div className="flex items-center justify-between text-orange-700 text-xs font-bold mb-1">
            <span>🧑‍🔧 إجمالي الأجور المستحقة</span>
            <span className="bg-orange-50 px-2 py-0.5 rounded text-[11px]">{stats.logsCount} يومية</span>
          </div>
          <div className="text-base font-extrabold text-orange-950 font-mono">
            {formatCurrency(stats.totalWages)}
          </div>
          <div className="text-[11px] text-orange-800 mt-1 flex justify-between border-t border-orange-100 pt-1">
            <span>أيام عادية: <strong>{stats.totalNormal}</strong></span>
            <span>أيام سفر: <strong>{stats.totalTravel}</strong></span>
          </div>
        </div>

        {/* أيام السفر */}
        <div className="bg-white rounded-xl p-3 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold mb-1">
            <span>✈️ بدلات وأيام السفر</span>
            <span className="bg-amber-50 px-2 py-0.5 rounded text-[11px]">{stats.totalTravel} يوم سفر</span>
          </div>
          <div className="text-base font-extrabold text-amber-950 font-mono">
            {stats.totalTravel > 0 ? `${stats.totalTravel} أيام سفر مسجلة` : "لا توجد سفريات"}
          </div>
          <div className="text-[11px] text-amber-700 mt-1 border-t border-amber-100 pt-1">
            أيام العمل مع احتساب بدل سفرية
          </div>
        </div>

        {/* عدد العمال والنشاط */}
        <div className="bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-white/90 text-xs font-bold mb-1">
            <span>👥 العمال والنشاط</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-[11px]">{stats.workersCount} عامل كلي</span>
          </div>
          <div className="text-base font-extrabold font-mono text-white">
            {stats.activeWorkers} عامل نشط بالفترة
          </div>
          <div className="text-[11px] text-white/80 mt-1 border-t border-white/20 pt-1">
            كشف شامل لحسابات ويوميات العمال
          </div>
        </div>
      </div>

      {/* التابات الفرعية + البحث والتصدير */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => { setSubTab("summary"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "summary" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            📊 ملخص حسابات العمال ({summaryData.length})
          </button>
          <button
            onClick={() => { setSubTab("logs"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "logs" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            📋 سجل اليوميات والسفريات ({logsData.length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
          <div className="relative flex-1 sm:w-52">
            <input
              type="text"
              placeholder="🔍 بحث في العمال..."
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
          <div className="text-xs font-bold text-gray-600">جاري تحميل بيانات العمال واليوميات...</div>
        </div>
      ) : activeDataset.length > 0 ? (
        <div className="card overflow-hidden p-0 border border-gray-200 shadow-sm rounded-xl bg-white mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 text-gray-800 border-b border-gray-200">
                <tr>
                  <th className="px-2.5 py-2.5 text-center font-bold text-gray-500 w-8">#</th>
                  {columns.map((k) => (
                    <th key={k} className="px-2.5 py-2.5 text-center font-extrabold whitespace-nowrap text-gray-700">
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
                      const isTravel = k === "سفرية؟";
                      return (
                        <td
                          key={k}
                          className={`px-2.5 py-2 whitespace-nowrap text-center ${
                            isMoney
                              ? "font-bold text-brand-orange-dark font-mono"
                              : isTravel
                                ? "font-bold text-amber-700"
                                : "text-gray-700"
                          }`}
                        >
                          {isMoney ? formatCurrency(fmtNum(v)) : v ?? "—"}
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
                        <td key={k} className="px-2.5 py-2.5 text-center font-mono font-bold text-brand-orange-dark text-xs whitespace-nowrap">
                          {formatCurrency(columnSums[k] || 0)}
                        </td>
                      );
                    }
                    if (k === columns[0]) {
                      return (
                        <td key={k} className="px-2.5 py-2.5 text-center whitespace-nowrap text-gray-800">
                          الإجمالي ({activeDataset.length} سجل)
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
                عرض {(page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, activeDataset.length)} من {activeDataset.length} سجل
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
          <div className="font-bold text-gray-700 text-sm">لا توجد بيانات مطابقة للفترة المحددة</div>
          <div className="text-xs text-gray-400 mt-0.5">جرب تغيير نطاق التاريخ أو إلغاء فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

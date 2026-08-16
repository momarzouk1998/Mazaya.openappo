"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/format";
import DateInput from "@/components/ui/DateInput";

function fmtNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function SuppliersReportPage() {
  const { user: profile } = useUserStore();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [items, setItems] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const fetchSafe = (url: string) =>
        fetch(url)
          .then((r) => r.json())
          .catch(() => ({ ok: false, data: [] }));

      const [sRes, pRes, pyRes] = await Promise.all([
        fetchSafe("/api/suppliers?limit=500"),
        fetchSafe(
          `/api/journal?limit=2000&entry_type=مشتريات${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
        ),
        fetchSafe(
          `/api/journal?limit=2000&entry_type=دفعة صادرة لمورد${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
        ),
      ]);

      const suppliers = sRes?.data?.items ?? sRes?.data ?? sRes?.items ?? [];
      const purchases = pRes?.data?.entries ?? pRes?.data ?? pRes?.entries ?? [];
      const payments = pyRes?.data?.entries ?? pyRes?.data ?? pyRes?.entries ?? [];

      const purchaseMap: Record<string, number> = {};
      const paymentMap: Record<string, number> = {};

      (Array.isArray(purchases) ? purchases : []).forEach((x: any) => {
        if (x.party_id) {
          purchaseMap[String(x.party_id)] =
            (purchaseMap[String(x.party_id)] || 0) + fmtNum(x.amount);
        }
      });

      (Array.isArray(payments) ? payments : []).forEach((x: any) => {
        if (x.party_id) {
          paymentMap[String(x.party_id)] =
            (paymentMap[String(x.party_id)] || 0) + fmtNum(x.amount);
        }
      });

      const mapped = (Array.isArray(suppliers) ? suppliers : []).map((x: any) => {
        const purch = purchaseMap[String(x.id)] || 0;
        const pay = paymentMap[String(x.id)] || 0;
        const balance = purch - pay;

        return {
          "اسم المورد": x.name ?? "",
          "نوع التعامل": x.payment_type ?? "-",
          الهاتف: x.phone ?? "-",
          "إجمالي المشتريات": purch,
          "إجمالي المدفوع له": pay,
          "الرصيد المستحق (الديون)": balance,
        };
      });

      setItems(mapped);
    } catch (e) {
      console.error("Suppliers report error:", e);
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
    const totalPurchases = items.reduce((s, r) => s + fmtNum(r["إجمالي المشتريات"]), 0);
    const totalPayments = items.reduce((s, r) => s + fmtNum(r["إجمالي المدفوع له"]), 0);
    const totalBalance = totalPurchases - totalPayments;
    const debtSuppliersCount = items.filter((r) => fmtNum(r["الرصيد المستحق (الديون)"]) > 0).length;

    return {
      totalPurchases,
      totalPayments,
      totalBalance,
      debtSuppliersCount,
      count: items.length,
    };
  }, [items]);

  // Active dataset
  const activeDataset = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((r) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [items, search]);

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
    return columns.filter((k) => k.includes("المشتريات") || k.includes("المدفوع") || k.includes("الرصيد"));
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
    exportToExcel(activeDataset, `تقرير_الموردين_والمشتريات_${new Date().toISOString().slice(0, 10)}`);
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      {/* رأس الصفحة المدمج والأنيق بدون سطر فرعي */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <span>🏭</span>
          <span>تقرير الموردين وحسابات المشتريات</span>
        </h1>
        <Link
          href="/reports"
          className="btn-secondary h-7 px-2.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
        >
          <span>←</span>
          <span>رجوع للتقارير</span>
        </Link>
      </div>

      {/* كروت المؤشرات التفصيلية تحت العنوان مباشرة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2.5">
        {/* إجمالي المشتريات */}
        <div className="bg-white rounded-xl p-2.5 border border-red-200 shadow-xs">
          <div className="flex items-center justify-between text-red-700 text-xs font-bold mb-1">
            <span>🏭 إجمالي المشتريات</span>
            <span className="bg-red-50 px-2 py-0.5 rounded text-[11px]">{stats.count} مورد</span>
          </div>
          <div className="text-sm font-extrabold text-red-950 font-mono">
            {formatCurrency(stats.totalPurchases)}
          </div>
          <div className="text-[10px] text-red-700 mt-0.5 border-t border-red-100 pt-0.5">
            ألواح وإكسسوارات ومواد خام
          </div>
        </div>

        {/* إجمالي المدفوع */}
        <div className="bg-white rounded-xl p-2.5 border border-green-200 shadow-xs">
          <div className="flex items-center justify-between text-green-700 text-xs font-bold mb-1">
            <span>💳 إجمالي المدفوع للموردين</span>
            <span className="bg-green-50 px-2 py-0.5 rounded text-[11px]">سدادات ودفعات</span>
          </div>
          <div className="text-sm font-extrabold text-green-950 font-mono">
            {formatCurrency(stats.totalPayments)}
          </div>
          <div className="text-[10px] text-green-700 mt-0.5 border-t border-green-100 pt-0.5">
            دفعات نقدية وبنكية مسجلة
          </div>
        </div>

        {/* إجمالي الديون المستحقة */}
        <div className="bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white rounded-xl p-2.5 shadow-xs">
          <div className="flex items-center justify-between text-white/90 text-xs font-bold mb-1">
            <span>⏳ إجمالي الديون المستحقة</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-[11px]">{stats.debtSuppliersCount} مورد له ديون</span>
          </div>
          <div className="text-sm font-extrabold font-mono text-white">
            {formatCurrency(stats.totalBalance)}
          </div>
          <div className="text-[10px] text-white/80 mt-0.5 border-t border-white/20 pt-0.5">
            المتبقي لصالح الموردين
          </div>
        </div>
      </div>

      {/* شريط التحكم الموحد المدمج: التاريخ + الفلاتر + البحث + التصدير */}
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-xs mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-gray-700">
          🏭 كشف حساب الموردين ({items.length})
        </div>

        {/* فلاتر التاريخ والبحث والأزرار */}
        <div className="flex flex-wrap items-center gap-1.5 mr-auto">
          {/* أزرار الفترات السريعة */}
          <div className="flex items-center bg-gray-50 p-0.5 rounded-lg border text-xs">
            <button
              onClick={() => applyPreset("today")}
              className="px-2 py-0.5 rounded hover:bg-white transition text-gray-700 font-medium text-[11px]"
            >
              اليوم
            </button>
            <button
              onClick={() => applyPreset("week")}
              className="px-2 py-0.5 rounded hover:bg-white transition text-gray-700 font-medium text-[11px]"
            >
              7 أيام
            </button>
            <button
              onClick={() => applyPreset("month")}
              className="px-2 py-0.5 rounded hover:bg-white transition text-gray-700 font-medium text-[11px]"
            >
              الشهر
            </button>
            <button
              onClick={() => applyPreset("all")}
              className="px-2 py-0.5 rounded hover:bg-white transition text-gray-700 font-medium text-[11px]"
            >
              الكل
            </button>
          </div>

          {/* مدخلات التاريخ المدمجة */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-gray-500 font-semibold">من:</span>
            <div className="w-28">
              <DateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <span className="text-gray-500 font-semibold">إلى:</span>
            <div className="w-28">
              <DateInput value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          {/* مربع البحث */}
          <div className="relative w-36 sm:w-44">
            <input
              type="text"
              placeholder="🔍 بحث في الموردين..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full text-xs px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-brand-orange focus:bg-white transition"
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

          {/* زر التصدير */}
          <Button variant="secondary" size="sm" onClick={handleExport} className="flex items-center gap-1 font-bold h-7 text-xs px-2.5">
            <span>📥</span>
            <span>Excel</span>
          </Button>
        </div>
      </div>

      {/* جدول البيانات */}
      {loading ? (
        <div className="card text-center py-12 bg-white border">
          <div className="text-2xl mb-2">⏳</div>
          <div className="text-xs font-bold text-gray-600">جاري تحميل بيانات الموردين...</div>
        </div>
      ) : activeDataset.length > 0 ? (
        <div className="card overflow-hidden p-0 border border-gray-200 shadow-sm rounded-xl bg-white mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100/80 text-gray-800 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-2 text-center font-bold text-gray-500 w-8">#</th>
                  {columns.map((k) => (
                    <th key={k} className="px-2 py-2 text-center font-extrabold whitespace-nowrap text-gray-700">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedRows.map((row, i) => (
                  <tr key={i} className="hover:bg-orange-50/30 transition">
                    <td className="px-2 py-1.5 text-center text-gray-400 font-mono">
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    {columns.map((k) => {
                      const v = row[k];
                      const isMoney = moneyKeys.includes(k);
                      const isBalance = k === "الرصيد المستحق (الديون)";
                      return (
                        <td
                          key={k}
                          className={`px-2 py-1.5 whitespace-nowrap text-center ${
                            isMoney
                              ? isBalance && fmtNum(v) > 0
                                ? "font-bold text-red-600 font-mono"
                                : "font-bold text-brand-orange-dark font-mono"
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
                  <td className="px-2 py-2 text-center text-gray-500">Σ</td>
                  {columns.map((k) => {
                    const isMoney = moneyKeys.includes(k);
                    if (isMoney) {
                      return (
                        <td key={k} className="px-2 py-2 text-center font-mono font-bold text-brand-orange-dark text-xs whitespace-nowrap">
                          {formatCurrency(columnSums[k] || 0)}
                        </td>
                      );
                    }
                    if (k === columns[0]) {
                      return (
                        <td key={k} className="px-2 py-2 text-center whitespace-nowrap text-gray-800">
                          الإجمالي ({activeDataset.length} مورد)
                        </td>
                      );
                    }
                    return <td key={k} className="px-2 py-2"></td>;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ترقيم الصفحات Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-gray-50/80 border-t text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span>
                عرض {(page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, activeDataset.length)} من {activeDataset.length} مورد
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
                className="px-2 py-0.5 bg-white border rounded disabled:opacity-40 font-bold hover:bg-gray-100 text-xs"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-0.5 bg-white border rounded disabled:opacity-40 font-bold hover:bg-gray-100 text-xs"
              >
                السابق
              </button>
              <span className="px-2.5 py-0.5 font-bold text-gray-800 text-xs">
                صفحة {page} من {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-0.5 bg-white border rounded disabled:opacity-40 font-bold hover:bg-gray-100 text-xs"
              >
                التالي
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-0.5 bg-white border rounded disabled:opacity-40 font-bold hover:bg-gray-100 text-xs"
              >
                »
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center text-gray-400 py-12 bg-white border rounded-xl">
          <div className="text-4xl mb-2">📭</div>
          <div className="font-bold text-gray-700 text-sm">لا توجد بيانات موردين مطابقة</div>
          <div className="text-xs text-gray-400 mt-0.5">جرب تغيير نطاق التاريخ أو إلغاء فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

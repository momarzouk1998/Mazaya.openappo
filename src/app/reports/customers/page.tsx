"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/format";

function fmtNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function CustomersReportPage() {
  const { user: profile } = useUserStore();
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

      const [cRes, oRes, payRes] = await Promise.all([
        fetchSafe("/api/customers?limit=500"),
        fetchSafe("/api/orders?limit=2000"),
        fetchSafe("/api/customer-payments?limit=2000"),
      ]);

      const customers = cRes?.data?.items ?? cRes?.data ?? cRes?.items ?? [];
      const orders = oRes?.data?.items ?? oRes?.data ?? oRes?.items ?? [];
      const payments = payRes?.data?.payments ?? payRes?.data?.items ?? payRes?.data ?? payRes?.payments ?? [];

      const orderStats: Record<string, { count: number; total: number }> = {};
      (Array.isArray(orders) ? orders : []).forEach((ord: any) => {
        if (!ord.customer_id) return;
        const cid = String(ord.customer_id);
        if (!orderStats[cid]) orderStats[cid] = { count: 0, total: 0 };
        orderStats[cid].count += 1;
        orderStats[cid].total += fmtNum(ord.order_total ?? ord.total ?? 0);
      });

      const paymentMap: Record<string, number> = {};
      (Array.isArray(payments) ? payments : []).forEach((p: any) => {
        if (p.customer_id) {
          paymentMap[String(p.customer_id)] =
            (paymentMap[String(p.customer_id)] || 0) + fmtNum(p.amount);
        }
      });

      const mapped = (Array.isArray(customers) ? customers : []).map((x: any) => {
        const s = orderStats[String(x.id)] || { count: 0, total: 0 };
        const collected = paymentMap[String(x.id)] || 0;
        const rem = s.total - collected;

        return {
          "اسم العميل": x.name ?? "",
          الهاتف: x.phone ?? "-",
          المعرض: x.branch_name || x.branch?.name || "-",
          "عدد الأوردرات": s.count,
          "إجمالي قيمة الأوردرات": s.total,
          "إجمالي المدفوعات المسجلة": collected,
          "المتبقي على العميل": rem,
        };
      });

      setItems(mapped);
    } catch (e) {
      console.error("Customers report error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    setPage(1);
  }, []);

  // KPIs Breakdown
  const stats = useMemo(() => {
    const totalOrdersVal = items.reduce((s, r) => s + fmtNum(r["إجمالي قيمة الأوردرات"]), 0);
    const totalCollected = items.reduce((s, r) => s + fmtNum(r["إجمالي المدفوعات المسجلة"]), 0);
    const totalRemaining = totalOrdersVal - totalCollected;
    const debtCustomersCount = items.filter((r) => fmtNum(r["المتبقي على العميل"]) > 0).length;
    const collectionRate = totalOrdersVal > 0 ? ((totalCollected / totalOrdersVal) * 100).toFixed(1) : "0";

    return {
      totalOrdersVal,
      totalCollected,
      totalRemaining,
      debtCustomersCount,
      collectionRate,
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
    return columns.filter((k) => k.includes("الأوردرات") || k.includes("المدفوعات") || k.includes("المتبقي"));
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
    exportToExcel(activeDataset, `تقرير_العملاء_والتحصيلات_${new Date().toISOString().slice(0, 10)}`);
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <PageHeader
          title="تقرير العملاء والتحصيلات"
          subtitle="كشف حساب العملاء والمعارض، إجمالي الأوردرات، التحصيلات المسددة، والمتبقي"
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

      {/* كروت المؤشرات التفصيلية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3.5">
        {/* إجمالي الأوردرات */}
        <div className="bg-white rounded-xl p-3 border border-indigo-200 shadow-xs">
          <div className="flex items-center justify-between text-indigo-700 text-xs font-bold mb-1">
            <span>📦 إجمالي قيمة أوردرات العملاء</span>
            <span className="bg-indigo-50 px-2 py-0.5 rounded text-[11px]">{stats.count} عميل</span>
          </div>
          <div className="text-base font-extrabold text-indigo-950 font-mono">
            {formatCurrency(stats.totalOrdersVal)}
          </div>
          <div className="text-[11px] text-indigo-700 mt-1 border-t border-indigo-100 pt-1">
            عبر كافة الفروع والمعارض
          </div>
        </div>

        {/* إجمالي التحصيلات */}
        <div className="bg-white rounded-xl p-3 border border-green-200 shadow-xs">
          <div className="flex items-center justify-between text-green-700 text-xs font-bold mb-1">
            <span>💳 إجمالي التحصيلات المسددة</span>
            <span className="bg-green-50 px-2 py-0.5 rounded text-[11px]">نسبة التحصيل: {stats.collectionRate}%</span>
          </div>
          <div className="text-base font-extrabold text-green-950 font-mono">
            {formatCurrency(stats.totalCollected)}
          </div>
          <div className="text-[11px] text-green-700 mt-1 border-t border-green-100 pt-1">
            دفعات محصلة من العملاء
          </div>
        </div>

        {/* إجمالي المتبقي */}
        <div className="bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white rounded-xl p-3 shadow-xs">
          <div className="flex items-center justify-between text-white/90 text-xs font-bold mb-1">
            <span>⏳ إجمالي المتبقي على العملاء</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-[11px]">{stats.debtCustomersCount} عميل عليه مستحقات</span>
          </div>
          <div className="text-base font-extrabold font-mono text-white">
            {formatCurrency(stats.totalRemaining)}
          </div>
          <div className="text-[11px] text-white/80 mt-1 border-t border-white/20 pt-1">
            مستحقات المصنع لدى العملاء
          </div>
        </div>
      </div>

      {/* شريط البحث والتصدير */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="text-xs font-bold text-gray-700">
          👥 كشف حساب العملاء ({items.length})
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
          <div className="relative flex-1 sm:w-52">
            <input
              type="text"
              placeholder="🔍 بحث في العملاء..."
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
          <div className="text-xs font-bold text-gray-600">جاري تحميل بيانات العملاء...</div>
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
                      const isRemaining = k === "المتبقي على العميل";
                      return (
                        <td
                          key={k}
                          className={`px-2.5 py-2 whitespace-nowrap ${
                            isMoney
                              ? isRemaining && fmtNum(v) > 0
                                ? "font-bold text-amber-700 font-mono text-left"
                                : "font-bold text-brand-orange-dark font-mono text-left"
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
                        <td key={k} className="px-2.5 py-2.5 text-left font-mono font-bold text-brand-orange-dark text-xs whitespace-nowrap">
                          {formatCurrency(columnSums[k] || 0)}
                        </td>
                      );
                    }
                    if (k === columns[0]) {
                      return (
                        <td key={k} className="px-2.5 py-2.5 whitespace-nowrap text-gray-800">
                          الإجمالي ({activeDataset.length} عميل)
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
                عرض {(page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, activeDataset.length)} من {activeDataset.length} عميل
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
          <div className="font-bold text-gray-700 text-sm">لا توجد بيانات عملاء مطابقة</div>
          <div className="text-xs text-gray-400 mt-0.5">جرب تغيير فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

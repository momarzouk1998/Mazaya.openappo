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

function fmtNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function CustomersReportPage() {
  const { user: profile } = useUserStore();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<any[]>([]);
  const { mutate } = useApiMutation();

  async function loadData() {
    setLoading(true);
    try {
      const [cRes, oRes, payRes] = await Promise.all([
        mutate("GET", "/api/customers?limit=500"),
        mutate("GET", "/api/orders?limit=2000"),
        mutate("GET", "/api/customer-payments?limit=2000"),
      ]);

      const customers = cRes?.data?.items ?? cRes?.data ?? cRes?.items ?? cRes ?? [];
      const orders = oRes?.data?.items ?? oRes?.data ?? oRes?.items ?? oRes ?? [];
      const payments = payRes?.data?.payments ?? payRes?.data?.items ?? payRes?.data ?? payRes?.payments ?? payRes ?? [];

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
  }, []);

  // KPIs
  const stats = useMemo(() => {
    const totalOrdersVal = items.reduce((s, r) => s + fmtNum(r["إجمالي قيمة الأوردرات"]), 0);
    const totalCollected = items.reduce((s, r) => s + fmtNum(r["إجمالي المدفوعات المسجلة"]), 0);
    const totalRemaining = totalOrdersVal - totalCollected;
    return { totalOrdersVal, totalCollected, totalRemaining, count: items.length };
  }, [items]);

  // Active dataset
  const activeDataset = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((r) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [items, search]);

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
      <div className="flex items-center justify-between gap-3 mb-4">
        <PageHeader
          title="تقرير العملاء والتحصيلات"
          subtitle="كشف حساب العملاء والمعارض، إجمالي الأوردرات، التحصيلات المسددة، والمتبقي"
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

      {/* كروت المؤشرات */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="card bg-gradient-to-br from-indigo-50 to-blue-50 border-r-4 border-indigo-600 p-4 shadow-sm">
          <div className="text-xs text-gray-600 font-semibold mb-1">📦 إجمالي قيمة أوردرات العملاء</div>
          <div className="text-2xl font-extrabold text-indigo-900 font-mono">
            {formatCurrency(stats.totalOrdersVal)}
          </div>
          <div className="text-xs text-indigo-700 mt-1">عبر كافة الفروع والمعارض</div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-r-4 border-green-500 p-4 shadow-sm">
          <div className="text-xs text-gray-600 font-semibold mb-1">💳 إجمالي التحصيلات المسجلة</div>
          <div className="text-2xl font-extrabold text-green-900 font-mono">
            {formatCurrency(stats.totalCollected)}
          </div>
          <div className="text-xs text-green-700 mt-1">دفعات محصلة من العملاء</div>
        </div>

        <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-4 shadow-md">
          <div className="text-xs text-white/90 font-semibold mb-1">⏳ إجمالي المتبقي على العملاء</div>
          <div className="text-2xl font-extrabold font-mono">
            {formatCurrency(stats.totalRemaining)}
          </div>
          <div className="text-xs text-white/80 mt-1">مستحقات المصنع لدى العملاء</div>
        </div>
      </div>

      {/* شريط البحث والتصدير */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        <div className="text-xs font-bold text-gray-700">
          👥 كشف حساب العملاء ({items.length})
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              placeholder="🔍 بحث في العملاء أو المعارض..."
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
          <div className="text-sm font-bold text-gray-600">جاري تحميل بيانات العملاء...</div>
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
                      const isRemaining = k === "المتبقي على العميل";
                      return (
                        <td
                          key={k}
                          className={`px-3 py-2.5 whitespace-nowrap ${
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
                          الإجمالي ({activeDataset.length} عميل)
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
          <div className="font-extrabold text-gray-700 text-base">لا توجد بيانات عملاء مطابقة</div>
          <div className="text-xs text-gray-400 mt-1">جرب تغيير فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

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

export default function OverheadReportPage() {
  const { user: profile } = useUserStore();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<any[]>([]);
  const { mutate } = useApiMutation();

  async function loadData() {
    setLoading(true);
    try {
      const res = await mutate(
        "GET",
        `/api/overhead?limit=2000&exclude_wages=true${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
      );
      const rawList = (res as any)?.data?.expenses ?? (res as any)?.data?.items ?? (res as any)?.data ?? [];

      const mapped = (Array.isArray(rawList) ? rawList : []).map((x: any) => ({
        التاريخ: safeFormatDate(x.date || x.created_at),
        التصنيف: x.category ?? "نثريات عامة",
        البيان: x.description ?? "",
        "طريقة الدفع": x.payment_method ?? "نقدي",
        المبلغ: fmtNum(x.amount),
        الملاحظات: x.notes ?? "-",
      }));

      setItems(mapped);
    } catch (e) {
      console.error("Overhead report error:", e);
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
    const totalAmount = items.reduce((s, r) => s + fmtNum(r["المبلغ"]), 0);
    return { totalAmount, count: items.length };
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

  const columnSums = useMemo(() => {
    const sums: Record<string, number> = {};
    if (!activeDataset.length) return sums;
    sums["المبلغ"] = activeDataset.reduce((s, r) => s + fmtNum(r["المبلغ"]), 0);
    return sums;
  }, [activeDataset]);

  function handleExport() {
    exportToExcel(activeDataset, `تقرير_النثريات_والمصاريف_العامة_${new Date().toISOString().slice(0, 10)}`);
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <PageHeader
          title="تقرير النثريات والمصاريف التشغيلية"
          subtitle="مصاريف تشغيل المصنع العامة فقط (كهرباء، شحن، صيانة دورية، بوفيه) مستبعد منها أجور العمال"
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
            <span>📅 نطاق النثريات بالتاريخ</span>
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

      {/* كروت المؤشرات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="card bg-gradient-to-br from-purple-50 to-fuchsia-50 border-r-4 border-purple-600 p-4 shadow-sm">
          <div className="text-xs text-gray-600 font-semibold mb-1">📄 إجمالي النثريات التشغيلية</div>
          <div className="text-2xl font-extrabold text-purple-900 font-mono">
            {formatCurrency(stats.totalAmount)}
          </div>
          <div className="text-xs text-purple-700 mt-1">كهرباء، شحن، صيانة عامة، بوفيه ومصاريف تشغيل</div>
        </div>

        <div className="card bg-gray-50 border border-gray-200 p-4 shadow-sm">
          <div className="text-xs text-gray-600 font-semibold mb-1">🧾 عدد الحركات المسجلة</div>
          <div className="text-2xl font-extrabold text-gray-900 font-mono">
            {stats.count} حركة
          </div>
          <div className="text-xs text-gray-500 mt-1">(مستبعد منها كلياً أجور العمال والنقل)</div>
        </div>
      </div>

      {/* شريط البحث والتصدير */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        <div className="text-xs font-bold text-gray-700">
          📋 بيان حركات النثريات والمصاريف ({items.length})
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              placeholder="🔍 بحث في النثريات والبيان..."
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
          <div className="text-sm font-bold text-gray-600">جاري تحميل بيانات النثريات...</div>
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
                      const isMoney = k === "المبلغ";
                      return (
                        <td
                          key={k}
                          className={`px-3 py-2.5 whitespace-nowrap ${
                            isMoney ? "font-bold text-brand-orange-dark font-mono text-left" : "text-gray-700"
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
                    if (k === "المبلغ") {
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
          <div className="font-extrabold text-gray-700 text-base">لا توجد حركات نثريات للفترة المحددة</div>
          <div className="text-xs text-gray-400 mt-1">جرب تغيير نطاق التاريخ أو إلغاء فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

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

export default function OrdersReportPage() {
  const { user: profile } = useUserStore();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [subTab, setSubTab] = useState<"orders" | "additions" | "external">("orders");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Data sets
  const [orders, setOrders] = useState<any[]>([]);
  const [additions, setAdditions] = useState<any[]>([]);
  const [externalWork, setExternalWork] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const fetchSafe = (url: string) =>
        fetch(url)
          .then((r) => r.json())
          .catch(() => ({ ok: false, data: [] }));

      const [ordRes, pRes, lRes, tRes, extRes] = await Promise.all([
        fetchSafe(`/api/orders?limit=1000${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`),
        fetchSafe("/api/paints?limit=1000"),
        fetchSafe("/api/led-expenses?limit=1000"),
        fetchSafe("/api/internal-transport?limit=1000"),
        fetchSafe("/api/external-work?limit=1000"),
      ]);

      const ordList = ordRes?.data?.items ?? ordRes?.data ?? ordRes?.items ?? [];
      const pList = pRes?.data?.items ?? pRes?.data ?? pRes?.items ?? [];
      const lList = lRes?.data?.items ?? lRes?.data ?? lRes?.items ?? [];
      const tList = tRes?.data?.entries ?? tRes?.data ?? tRes?.entries ?? [];
      const extList = extRes?.data?.items ?? extRes?.data ?? extRes?.items ?? [];

      const filterByDate = (list: any[]) => {
        if (!fromDate && !toDate) return list;
        return list.filter((x: any) => {
          const d = String(x.date || x.expense_date || x.created_at || "").slice(0, 10);
          return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
        });
      };

      const filteredP = filterByDate(Array.isArray(pList) ? pList : []);
      const filteredL = filterByDate(Array.isArray(lList) ? lList : []);
      const filteredT = filterByDate(Array.isArray(tList) ? tList : []);
      const filteredExt = filterByDate(Array.isArray(extList) ? extList : []);

      // Map Orders
      const mappedOrders = (Array.isArray(ordList) ? ordList : []).map((x: any) => {
        const grand = fmtNum(x.order_total ?? x.total ?? 0);
        const ext = fmtNum(x.external_work_total ?? 0);
        const factory = Math.max(0, grand - ext);
        return {
          "اسم الأوردر": x.order_name ?? "",
          العميل: x.customer_name ?? "-",
          المعرض: x.branch_name ?? "-",
          الحالة: x.status ?? "",
          النوع: x.order_type ?? "",
          "تاريخ البدء": safeFormatDate(x.start_date),
          "تاريخ الانتهاء": safeFormatDate(x.end_date),
          "تكلفة الألواح": fmtNum(x.boards_cost ?? 0),
          "تكلفة الاكسسوارات": fmtNum(x.accessories_cost ?? 0),
          "أجور العمال": fmtNum(x.worker_logs_total ?? 0),
          "مصاريف الطريق": fmtNum(x.road_expenses_total ?? 0),
          "تكلفة المصنع (بدون مقاولين)": factory,
          "الأعمال الخارجية (المقاولين)": ext,
          "الإجمالي الشامل للأوردر": grand,
        };
      });

      // Map Additions
      const mappedAdditions = [
        ...filteredP.map((x: any) => ({
          التاريخ: safeFormatDate(x.date || x.created_at),
          القسم: "🎨 مصاريف دهانات ومرمات",
          الأوردر: x.order_name || "—",
          البيان: x.description || "دهانات وتينر",
          "طريقة الدفع": x.payment_method || "نقدي",
          المبلغ: fmtNum(x.amount),
          الملاحظات: x.notes || "-",
        })),
        ...filteredL.map((x: any) => ({
          التاريخ: safeFormatDate(x.date || x.created_at),
          القسم: "💡 مصاريف ليد وكهرباء",
          الأوردر: x.order_name || "—",
          البيان: x.description || "بضاعة ومصنعية ليد",
          "طريقة الدفع": x.payment_method || "نقدي",
          المبلغ: fmtNum(x.amount),
          الملاحظات: x.notes || "-",
        })),
        ...filteredT.map((x: any) => ({
          التاريخ: safeFormatDate(x.date || x.created_at),
          القسم: "🚚 نقل داخلي ومصاريف طريق",
          الأوردر: x.order_name || "—",
          البيان: x.description || "نقل / مصاريف طريق",
          "طريقة الدفع": x.payment_method || "نقدي",
          المبلغ: fmtNum(x.amount),
          الملاحظات: x.notes || "-",
        })),
      ];

      // Map External Work
      const mappedExt = filteredExt.map((x: any) => ({
        التاريخ: safeFormatDate(x.created_at),
        "المقاول / الورشة": x.contractor_name || "—",
        الأوردر: x.order_name || "—",
        "نوع العمل الخارجي": x.work_type || "أخرى",
        المبلغ: fmtNum(x.amount),
        الملاحظات: x.notes || "-",
      }));

      setOrders(mappedOrders);
      setAdditions(mappedAdditions);
      setExternalWork(mappedExt);
    } catch (e) {
      console.error("Orders report load error:", e);
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

  // KPIs
  const stats = useMemo(() => {
    const factorySum = orders.reduce((s, r) => s + fmtNum(r["تكلفة المصنع (بدون مقاولين)"]), 0);
    const externalSum = orders.reduce((s, r) => s + fmtNum(r["الأعمال الخارجية (المقاولين)"]), 0);
    const grandSum = orders.reduce((s, r) => s + fmtNum(r["الإجمالي الشامل للأوردر"]), 0);
    const additionsSum = additions.reduce((s, r) => s + fmtNum(r["المبلغ"]), 0);
    return { factorySum, externalSum, grandSum, additionsSum, count: orders.length };
  }, [orders, additions]);

  // Active dataset
  const activeDataset = useMemo(() => {
    let list: any[] = [];
    if (subTab === "orders") list = orders;
    else if (subTab === "additions") list = additions;
    else if (subTab === "external") list = externalWork;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [subTab, orders, additions, externalWork, search]);

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
    return columns.filter(
      (k) =>
        k.includes("المبلغ") ||
        k.includes("تكلفة") ||
        k.includes("الإجمالي") ||
        k.includes("أجور") ||
        k.includes("مصاريف") ||
        k.includes("الأعمال الخارجية")
    );
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
    const titles = {
      orders: "كشف_الأوردرات_والتكاليف",
      additions: "إضافات_الأوردرات_دهانات_وليد_ونقل",
      external: "الأعمال_الخارجية_للمقاولين",
    };
    exportToExcel(activeDataset, `${titles[subTab]}_${new Date().toISOString().slice(0, 10)}`);
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <PageHeader
          title="تقرير الأوردرات والتكاليف الشاملة"
          subtitle="تحليل تكاليف المصنع مفصولة عن الأعمال الخارجية مع إضافات الدهانات والليد والنقل"
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

      {/* شريط الفلاتر */}
      <div className="card mb-4 bg-white border border-gray-100 shadow-sm p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b">
          <div className="text-xs font-bold text-gray-700 flex items-center gap-2">
            <span>📅 نطاق التقرير بالتاريخ</span>
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
              كل الأوردرات
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">من تاريخ</label>
            <DateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">إلى تاريخ</label>
            <DateInput value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={loadData} loading={loading} className="w-full h-9 text-xs font-bold">
              {loading ? "⏳ جاري التحديث..." : "🔄 تحديث البيانات"}
            </Button>
          </div>
        </div>
      </div>

      {/* كروت المؤشرات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-r-4 border-indigo-600 p-3 shadow-xs">
          <div className="text-[11px] text-gray-600 font-semibold mb-0.5">📦 تكلفة المصنع</div>
          <div className="text-xl font-extrabold text-indigo-900 font-mono">
            {formatCurrency(stats.factorySum)}
          </div>
          <div className="text-[10px] text-indigo-700 mt-0.5">بدون مقاولين</div>
        </div>

        <div className="card bg-gradient-to-br from-amber-50 to-yellow-50 border-r-4 border-amber-500 p-3 shadow-xs">
          <div className="text-[11px] text-gray-600 font-semibold mb-0.5">🔨 الأعمال الخارجية</div>
          <div className="text-xl font-extrabold text-amber-900 font-mono">
            {formatCurrency(stats.externalSum)}
          </div>
          <div className="text-[10px] text-amber-700 mt-0.5">المقاولين والورش</div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-fuchsia-50 border-r-4 border-purple-500 p-3 shadow-xs">
          <div className="text-[11px] text-gray-600 font-semibold mb-0.5">🎨 إضافات الأوردرات</div>
          <div className="text-xl font-extrabold text-purple-900 font-mono">
            {formatCurrency(stats.additionsSum)}
          </div>
          <div className="text-[10px] text-purple-700 mt-0.5">دهانات + ليد + نقل</div>
        </div>

        <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-3 shadow-xs">
          <div className="text-[11px] text-white/90 font-semibold mb-0.5">💰 الإجمالي الشامل</div>
          <div className="text-xl font-extrabold font-mono">
            {formatCurrency(stats.grandSum)}
          </div>
          <div className="text-[10px] text-white/80 mt-0.5">عدد الأوردرات: {stats.count}</div>
        </div>
      </div>

      {/* التابات الفرعية + البحث والتصدير */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => { setSubTab("orders"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "orders" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            📋 الأوردرات والتكاليف ({orders.length})
          </button>
          <button
            onClick={() => { setSubTab("additions"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "additions" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🧩 إضافات الأوردرات ({additions.length})
          </button>
          <button
            onClick={() => { setSubTab("external"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "external" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🔨 الأعمال الخارجية ({externalWork.length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
          <div className="relative flex-1 sm:w-52">
            <input
              type="text"
              placeholder="🔍 بحث..."
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

      {/* جدول البيانات مع الترقيم */}
      {loading ? (
        <div className="card text-center py-12 bg-white border">
          <div className="text-2xl mb-2">⏳</div>
          <div className="text-xs font-bold text-gray-600">جاري تحميل بيانات الأوردرات...</div>
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
                      const isStatus = k === "الحالة";
                      return (
                        <td
                          key={k}
                          className={`px-2.5 py-2 whitespace-nowrap ${
                            isMoney ? "font-bold text-brand-orange-dark font-mono text-left" : "text-gray-700"
                          }`}
                        >
                          {isMoney ? (
                            formatCurrency(fmtNum(v))
                          ) : isStatus ? (
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                v === "مكتمل" || v === "تم التسليم"
                                  ? "bg-green-100 text-green-800"
                                  : v === "قيد التنفيذ"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-gray-100 text-gray-800"
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

          {/* شريط ترقيم الصفحات Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50/80 border-t text-xs text-gray-600">
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

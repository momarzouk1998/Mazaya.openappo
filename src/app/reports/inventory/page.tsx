"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import DashboardLayout from "@/components/layout/DashboardLayout";
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

export default function InventoryReportPage() {
  const { user: profile } = useUserStore();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [subTab, setSubTab] = useState<"all" | "boards" | "accessories">("all");
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

      const [bRes, aRes] = await Promise.all([
        fetchSafe(`/api/boards?limit=1000${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`),
        fetchSafe(`/api/accessories?limit=1000${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`),
      ]);

      const boards = bRes?.data?.items ?? bRes?.data ?? bRes?.items ?? [];
      const accessories = aRes?.data?.items ?? aRes?.data ?? aRes?.items ?? [];

      const bList = (Array.isArray(boards) ? boards : []).map((x: any) => {
        const rem = fmtNum(x.quantity_remaining ?? 0);
        const price = fmtNum(x.unit_price);
        const qtyIn = fmtNum(x.quantity_in);
        const qtyUsed = fmtNum(x.quantity_used ?? 0);
        return {
          الفئة: "لوح",
          _cat: "boards",
          "تاريخ الإضافة": safeFormatDate(x.date_added || x.created_at),
          الاسم: x.item_name ?? "",
          الكود: x.code ?? "-",
          الخامة: x.material_type ?? "-",
          المورد: x.supplier_name ?? "-",
          "سعر الوحدة": price,
          الداخل: qtyIn,
          المستخدم: qtyUsed,
          المتبقي: rem,
          "قيمة المتبقي": rem * price,
          ملاحظات: x.notes ?? "-",
        };
      });

      const aList = (Array.isArray(accessories) ? accessories : []).map((x: any) => {
        const rem = fmtNum(x.quantity_remaining ?? 0);
        const price = fmtNum(x.unit_price);
        const qtyIn = fmtNum(x.quantity_in);
        const qtyUsed = fmtNum(x.quantity_used ?? 0);
        return {
          الفئة: "اكسسوار",
          _cat: "accessories",
          "تاريخ الإضافة": safeFormatDate(x.date_added || x.created_at),
          الاسم: x.item_name ?? "",
          الكود: x.code ?? "-",
          الخامة: x.material_type || x.type || "-",
          المورد: x.supplier_name ?? "-",
          "سعر الوحدة": price,
          الداخل: qtyIn,
          المستخدم: qtyUsed,
          المتبقي: rem,
          "قيمة المتبقي": rem * price,
          ملاحظات: x.notes ?? "-",
        };
      });

      const combined = [...bList, ...aList].sort((a: any, b: any) => {
        const da = String(a["تاريخ الإضافة"] || "");
        const db = String(b["تاريخ الإضافة"] || "");
        return db.localeCompare(da);
      });

      setItems(combined);
    } catch (e) {
      console.error("Inventory report error:", e);
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
    const bItems = items.filter((r) => r._cat === "boards");
    const aItems = items.filter((r) => r._cat === "accessories");

    const boardsVal = bItems.reduce((s, r) => s + fmtNum(r["قيمة المتبقي"]), 0);
    const boardsInQty = bItems.reduce((s, r) => s + fmtNum(r["الداخل"]), 0);
    const boardsUsedQty = bItems.reduce((s, r) => s + fmtNum(r["المستخدم"]), 0);
    const boardsRemQty = bItems.reduce((s, r) => s + fmtNum(r["المتبقي"]), 0);
    const boardsZeroCount = bItems.filter((r) => fmtNum(r["المتبقي"]) <= 0).length;

    const accVal = aItems.reduce((s, r) => s + fmtNum(r["قيمة المتبقي"]), 0);
    const accInQty = aItems.reduce((s, r) => s + fmtNum(r["الداخل"]), 0);
    const accUsedQty = aItems.reduce((s, r) => s + fmtNum(r["المستخدم"]), 0);
    const accRemQty = aItems.reduce((s, r) => s + fmtNum(r["المتبقي"]), 0);
    const accZeroCount = aItems.filter((r) => fmtNum(r["المتبقي"]) <= 0).length;

    return {
      boardsCount: bItems.length,
      boardsVal,
      boardsInQty,
      boardsUsedQty,
      boardsRemQty,
      boardsZeroCount,

      accCount: aItems.length,
      accVal,
      accInQty,
      accUsedQty,
      accRemQty,
      accZeroCount,

      totalVal: boardsVal + accVal,
      totalCount: items.length,
      totalRemQty: boardsRemQty + accRemQty,
      totalZeroCount: boardsZeroCount + accZeroCount,
    };
  }, [items]);

  // Active dataset
  const activeDataset = useMemo(() => {
    let list = items;
    if (subTab !== "all") list = list.filter((r) => r._cat === subTab);

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
  }, [items, subTab, search]);

  const totalPages = Math.max(1, Math.ceil(activeDataset.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return activeDataset.slice(start, start + pageSize);
  }, [activeDataset, page, pageSize]);

  const columns = useMemo(() => {
    if (!activeDataset.length) return [];
    return Object.keys(activeDataset[0]).filter((k) => !k.startsWith("_"));
  }, [activeDataset]);

  const moneyKeys = useMemo(() => {
    return columns.filter((k) => k.includes("قيمة") || k.includes("سعر"));
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
    const clean = activeDataset.map((row) => {
      const o: any = {};
      columns.forEach((c) => (o[c] = row[c]));
      return o;
    });
    exportToExcel(clean, `تقرير_الجرد_والمخزون_${new Date().toISOString().slice(0, 10)}`);
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      {/* رأس الصفحة المدمج والأنيق بدون سطر فرعي */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <span>📦</span>
          <span>تقرير المخزون والجرد الدوري</span>
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
        {/* مخزون الألواح */}
        <div className="bg-white rounded-xl p-2.5 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold mb-1">
            <span>🪵 مخزون الألواح</span>
            <span className="bg-amber-50 px-2 py-0.5 rounded text-[11px]">{stats.boardsCount} صنف</span>
          </div>
          <div className="text-sm font-extrabold text-amber-950 font-mono">
            {formatCurrency(stats.boardsVal)}
          </div>
          <div className="text-[10px] text-amber-800 mt-0.5 flex justify-between border-t border-amber-100 pt-0.5">
            <span>متبقي: <strong>{stats.boardsRemQty}</strong> لوح</span>
            <span>مستخدم: <strong>{stats.boardsUsedQty}</strong></span>
            <span>داخل: <strong>{stats.boardsInQty}</strong></span>
          </div>
        </div>

        {/* مخزون الإكسسوارات */}
        <div className="bg-white rounded-xl p-2.5 border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 text-xs font-bold mb-1">
            <span>🔩 مخزون الإكسسوارات</span>
            <span className="bg-rose-50 px-2 py-0.5 rounded text-[11px]">{stats.accCount} صنف</span>
          </div>
          <div className="text-sm font-extrabold text-rose-950 font-mono">
            {formatCurrency(stats.accVal)}
          </div>
          <div className="text-[10px] text-rose-800 mt-0.5 flex justify-between border-t border-rose-100 pt-0.5">
            <span>متبقي: <strong>{stats.accRemQty}</strong> قطعة</span>
            <span>مستخدم: <strong>{stats.accUsedQty}</strong></span>
            <span>داخل: <strong>{stats.accInQty}</strong></span>
          </div>
        </div>

        {/* إجمالي المخزون الشامل */}
        <div className="bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white rounded-xl p-2.5 shadow-xs">
          <div className="flex items-center justify-between text-white/90 text-xs font-bold mb-1">
            <span>📦 إجمالي قيمة المخزون</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-[11px]">{stats.totalCount} صنف كلي</span>
          </div>
          <div className="text-sm font-extrabold font-mono text-white">
            {formatCurrency(stats.totalVal)}
          </div>
          <div className="text-[10px] text-white/80 mt-0.5 flex justify-between border-t border-white/20 pt-0.5">
            <span>إجمالي المتبقي: <strong>{stats.totalRemQty}</strong></span>
            <span>أصناف رصيد صفر: <strong>{stats.totalZeroCount}</strong></span>
          </div>
        </div>
      </div>

      {/* شريط التحكم الموحد المدمج: التابات + التاريخ + الفلاتر + البحث + التصدير */}
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-xs mb-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* التابات الفرعية */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => { setSubTab("all"); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              subTab === "all" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            📦 كل المخزون ({items.length})
          </button>
          <button
            onClick={() => { setSubTab("boards"); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              subTab === "boards" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🪵 الألواح ({stats.boardsCount})
          </button>
          <button
            onClick={() => { setSubTab("accessories"); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              subTab === "accessories" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🔩 الإكسسوارات ({stats.accCount})
          </button>
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
              placeholder="🔍 بحث في الأصناف..."
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
          <div className="text-xs font-bold text-gray-600">جاري تحميل بيانات الجرد...</div>
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
                      const isCategory = k === "الفئة";
                      const isRemaining = k === "المتبقي";
                      return (
                        <td
                          key={k}
                          className={`px-2 py-1.5 whitespace-nowrap text-center ${
                            isMoney
                              ? "font-bold text-brand-orange-dark font-mono"
                              : isRemaining
                                ? fmtNum(v) <= 0
                                  ? "font-bold text-red-500 font-mono"
                                  : "font-bold text-emerald-700 font-mono"
                                : "text-gray-700"
                          }`}
                        >
                          {isMoney ? (
                            formatCurrency(fmtNum(v))
                          ) : isCategory ? (
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                v === "لوح" ? "bg-amber-100 text-amber-900" : "bg-rose-100 text-rose-900"
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
                          الإجمالي ({activeDataset.length} صنف)
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
                عرض {(page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, activeDataset.length)} من {activeDataset.length} صنف
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
          <div className="font-bold text-gray-700 text-sm">لا توجد أصناف مطابقة للفترة المحددة</div>
          <div className="text-xs text-gray-400 mt-0.5">جرب تغيير نطاق التاريخ أو إلغاء فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

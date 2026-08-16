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
        return {
          الفئة: "لوح",
          _cat: "boards",
          "تاريخ الإضافة": safeFormatDate(x.date_added || x.created_at),
          الاسم: x.item_name ?? "",
          الكود: x.code ?? "-",
          الخامة: x.material_type ?? "-",
          المورد: x.supplier_name ?? "-",
          "سعر الوحدة": price,
          الداخل: fmtNum(x.quantity_in),
          المستخدم: fmtNum(x.quantity_used ?? 0),
          المتبقي: rem,
          "قيمة المتبقي": rem * price,
          ملاحظات: x.notes ?? "-",
        };
      });

      const aList = (Array.isArray(accessories) ? accessories : []).map((x: any) => {
        const rem = fmtNum(x.quantity_remaining ?? 0);
        const price = fmtNum(x.unit_price);
        return {
          الفئة: "اكسسوار",
          _cat: "accessories",
          "تاريخ الإضافة": safeFormatDate(x.date_added || x.created_at),
          الاسم: x.item_name ?? "",
          الكود: x.code ?? "-",
          الخامة: x.material_type || x.type || "-",
          المورد: x.supplier_name ?? "-",
          "سعر الوحدة": price,
          الداخل: fmtNum(x.quantity_in),
          المستخدم: fmtNum(x.quantity_used ?? 0),
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

  // KPIs
  const stats = useMemo(() => {
    const bItems = items.filter((r) => r._cat === "boards");
    const aItems = items.filter((r) => r._cat === "accessories");

    const boardsVal = bItems.reduce((s, r) => s + fmtNum(r["قيمة المتبقي"]), 0);
    const boardsQty = bItems.reduce((s, r) => s + fmtNum(r["المتبقي"]), 0);

    const accVal = aItems.reduce((s, r) => s + fmtNum(r["قيمة المتبقي"]), 0);
    const accQty = aItems.reduce((s, r) => s + fmtNum(r["المتبقي"]), 0);

    return {
      boardsVal,
      boardsQty,
      accVal,
      accQty,
      totalVal: boardsVal + accVal,
      totalQty: boardsQty + accQty,
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
      <div className="flex items-center justify-between gap-3 mb-4">
        <PageHeader
          title="تقرير المخزون والجرد الدوري"
          subtitle="جرد تفصيلي لمخزون الألواح والإكسسوارات واحتساب القيمة المالية للمتبقي والراكد"
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
      <div className="card mb-4 bg-white border border-gray-100 shadow-sm p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b">
          <div className="text-xs font-bold text-gray-700 flex items-center gap-2">
            <span>📅 نطاق حركة وجرد المخزون بالتاريخ</span>
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
              كل المخزون
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
              {loading ? "⏳ جاري التحديث..." : "🔄 تحديث بيانات الجرد"}
            </Button>
          </div>
        </div>
      </div>

      {/* كروت المؤشرات */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
        <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-r-4 border-amber-500 p-3 shadow-xs">
          <div className="text-[11px] text-gray-600 font-semibold mb-0.5">🪵 قيمة مخزون الألواح</div>
          <div className="text-xl font-extrabold text-amber-900 font-mono">
            {formatCurrency(stats.boardsVal)}
          </div>
          <div className="text-[10px] text-amber-700 mt-0.5">
            الكمية المتبقية: <strong>{stats.boardsQty}</strong> لوح
          </div>
        </div>

        <div className="card bg-gradient-to-br from-rose-50 to-pink-50 border-r-4 border-rose-500 p-3 shadow-xs">
          <div className="text-[11px] text-gray-600 font-semibold mb-0.5">🔩 قيمة مخزون الإكسسوارات</div>
          <div className="text-xl font-extrabold text-rose-900 font-mono">
            {formatCurrency(stats.accVal)}
          </div>
          <div className="text-[10px] text-rose-700 mt-0.5">
            الكمية المتبقية: <strong>{stats.accQty}</strong> قطعة
          </div>
        </div>

        <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-3 shadow-xs">
          <div className="text-[11px] text-white/90 font-semibold mb-0.5">📦 إجمالي قيمة المخزون</div>
          <div className="text-xl font-extrabold font-mono">
            {formatCurrency(stats.totalVal)}
          </div>
          <div className="text-[10px] text-white/80 mt-0.5">
            إجمالي الأصناف: <strong>{items.length}</strong> صنف
          </div>
        </div>
      </div>

      {/* التابات الفرعية + البحث والتصدير */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => { setSubTab("all"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "all" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            📦 كل المخزون ({items.length})
          </button>
          <button
            onClick={() => { setSubTab("boards"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "boards" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🪵 الألواح ({items.filter((r) => r._cat === "boards").length})
          </button>
          <button
            onClick={() => { setSubTab("accessories"); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              subTab === "accessories" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🔩 الإكسسوارات ({items.filter((r) => r._cat === "accessories").length})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto mr-auto">
          <div className="relative flex-1 sm:w-52">
            <input
              type="text"
              placeholder="🔍 بحث في الأصناف..."
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
          <div className="text-xs font-bold text-gray-600">جاري تحميل بيانات الجرد...</div>
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
                      const isCategory = k === "الفئة";
                      return (
                        <td
                          key={k}
                          className={`px-2.5 py-2 whitespace-nowrap ${
                            isMoney ? "font-bold text-brand-orange-dark font-mono text-left" : "text-gray-700"
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
                          الإجمالي ({activeDataset.length} صنف)
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
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gray-50/80 border-t text-xs text-gray-600">
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
          <div className="font-bold text-gray-700 text-sm">لا توجد أصناف مطابقة للفترة المحددة</div>
          <div className="text-xs text-gray-400 mt-0.5">جرب تغيير نطاق التاريخ أو إلغاء فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

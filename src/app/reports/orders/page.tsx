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

  // Raw fetched lists
  const [rawOrders, setRawOrders] = useState<any[]>([]);
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

      setRawOrders(Array.isArray(ordList) ? ordList : []);

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

      // Map Orders with rich itemization
      const mappedOrders = (Array.isArray(ordList) ? ordList : []).map((x: any) => {
        const grand = fmtNum(x.order_total ?? x.total ?? 0);
        const ext = fmtNum(x.external_work_total ?? 0);
        const bCost = fmtNum(x.boards_cost ?? 0);
        const aCost = fmtNum(x.accessories_cost ?? 0);
        const matTotal = bCost + aCost;
        const factory = Math.max(0, grand - ext);
        const wLogs = fmtNum(x.worker_logs_total ?? 0);
        const roadExp = fmtNum(x.road_expenses_total ?? 0);
        const instCost = fmtNum(x.installation_cost ?? 0);
        const inTrans = fmtNum(x.internal_transport_cost ?? 0);
        const exTrans = fmtNum(x.external_transport_cost ?? 0);
        const commission = fmtNum(x.factory_commission ?? 0);
        const extraCosts = fmtNum(x.extra_costs_total ?? 0);

        return {
          "اسم الأوردر": x.order_name ?? "",
          العميل: x.customer_name ?? "-",
          المعرض: x.branch_name ?? "-",
          الحالة: x.status ?? "",
          "تاريخ البدء": safeFormatDate(x.start_date || x.created_at),
          "تاريخ الانتهاء": safeFormatDate(x.end_date),
          "إجمالي المواد": matTotal,
          "تكلفة الألواح": bCost,
          "تكلفة الاكسسوارات": aCost,
          "أجور العمال": wLogs,
          "مصاريف الطريق": roadExp,
          "نقل داخلي": inTrans,
          "نقل خارجي": exTrans,
          تركيبات: instCost,
          عمولة: commission,
          "تكاليف إضافية": extraCosts,
          "الأعمال الخارجية (المقاولين)": ext,
          "تكلفة المصنع (بدون مقاولين)": factory,
          "الإجمالي الشامل للأوردر": grand,
        };
      });

      // Map Additions
      const mappedAdditions = [
        ...filteredP.map((x: any) => ({
          التاريخ: safeFormatDate(x.date || x.created_at),
          القسم: "🎨 دهانات ومرمات",
          الأوردر: x.order_name || "—",
          البيان: x.description || "دهانات وتينر",
          "طريقة الدفع": x.payment_method || "نقدي",
          المبلغ: fmtNum(x.amount),
          الملاحظات: x.notes || "-",
        })),
        ...filteredL.map((x: any) => ({
          التاريخ: safeFormatDate(x.date || x.created_at),
          القسم: "💡 ليد وكهرباء",
          الأوردر: x.order_name || "—",
          البيان: x.description || "بضاعة ومصنعية ليد",
          "طريقة الدفع": x.payment_method || "نقدي",
          المبلغ: fmtNum(x.amount),
          الملاحظات: x.notes || "-",
        })),
        ...filteredT.map((x: any) => ({
          التاريخ: safeFormatDate(x.date || x.created_at),
          القسم: "🚚 نقل ومصاريف طريق",
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

  // KPIs Breakdown
  const stats = useMemo(() => {
    let openCount = 0;
    let openTotal = 0;
    let completedCount = 0;
    let completedTotal = 0;
    let deliveredCount = 0;
    let boardsTotal = 0;
    let accessoriesTotal = 0;
    let externalTotal = 0;
    let workerLogsTotal = 0;
    let roadExpensesTotal = 0;
    let internalTransportTotal = 0;
    let externalTransportTotal = 0;
    let installationTotal = 0;
    let commissionTotal = 0;
    let extraCostsTotal = 0;
    let grandTotal = 0;

    rawOrders.forEach((o) => {
      const total = fmtNum(o.order_total ?? o.total ?? 0);
      const st = String(o.status ?? "");
      grandTotal += total;

      if (st === "مكتمل" || st === "تم التسليم") {
        completedCount++;
        completedTotal += total;
        if (st === "تم التسليم") deliveredCount++;
      } else {
        openCount++;
        openTotal += total;
      }

      boardsTotal += fmtNum(o.boards_cost);
      accessoriesTotal += fmtNum(o.accessories_cost);
      externalTotal += fmtNum(o.external_work_total);
      workerLogsTotal += fmtNum(o.worker_logs_total);
      roadExpensesTotal += fmtNum(o.road_expenses_total);
      internalTransportTotal += fmtNum(o.internal_transport_cost);
      externalTransportTotal += fmtNum(o.external_transport_cost);
      installationTotal += fmtNum(o.installation_cost);
      commissionTotal += fmtNum(o.factory_commission);
      extraCostsTotal += fmtNum(o.extra_costs_total);
    });

    const materialsTotal = boardsTotal + accessoriesTotal;
    const manualCostsTotal =
      workerLogsTotal +
      roadExpensesTotal +
      internalTransportTotal +
      externalTransportTotal +
      installationTotal +
      commissionTotal +
      extraCostsTotal;

    return {
      openCount,
      openTotal,
      completedCount,
      completedTotal,
      deliveredCount,
      totalCount: rawOrders.length,
      grandTotal,
      materialsTotal,
      boardsTotal,
      accessoriesTotal,
      externalTotal,
      manualCostsTotal,
      workerLogsTotal,
      roadExpensesTotal,
      internalTransportTotal,
      externalTransportTotal,
      installationTotal,
      commissionTotal,
      extraCostsTotal,
      factoryTotal: Math.max(0, grandTotal - externalTotal),
    };
  }, [rawOrders]);

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
        k.includes("نقل") ||
        k.includes("تركيبات") ||
        k.includes("عمولة") ||
        k.includes("المواد") ||
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
      orders: "كشف_الأوردرات_والتكاليف_التفصيلي",
      additions: "إضافات_الأوردرات_دهانات_وليد_ونقل",
      external: "الأعمال_الخارجية_للمقاولين",
    };
    exportToExcel(activeDataset, `${titles[subTab]}_${new Date().toISOString().slice(0, 10)}`);
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      {/* رأس الصفحة المدمج والأنيق بدون سطر فرعي */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <span>📋</span>
          <span>تقرير الأوردرات والتكاليف الشاملة</span>
        </h1>
        <Link
          href="/reports"
          className="btn-secondary h-7 px-2.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
        >
          <span>←</span>
          <span>رجوع للتقارير</span>
        </Link>
      </div>

      {/* لوحة المؤشرات التفصيلية المجمعة تحت العنوان مباشرة */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-2.5">
        {/* أوردرات مفتوحة */}
        <div className="bg-white rounded-xl p-2.5 border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 text-xs font-bold mb-1">
            <span>📂 أوردرات مفتوحة</span>
            <span className="bg-blue-50 px-1.5 py-0.2 rounded text-[11px]">{stats.openCount}</span>
          </div>
          <div className="text-sm font-extrabold text-blue-950 font-mono">
            {formatCurrency(stats.openTotal)}
          </div>
          <div className="text-[10px] text-blue-600 mt-0.5">قيد التنفيذ والتشغيل</div>
        </div>

        {/* أوردرات مكتملة */}
        <div className="bg-white rounded-xl p-2.5 border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-bold mb-1">
            <span>✅ مكتملة</span>
            <span className="bg-emerald-50 px-1.5 py-0.2 rounded text-[11px]">{stats.completedCount}</span>
          </div>
          <div className="text-sm font-extrabold text-emerald-950 font-mono">
            {formatCurrency(stats.completedTotal)}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">منها {stats.deliveredCount} مسلّم 🚚</div>
        </div>

        {/* إجمالي كل الأوردرات */}
        <div className="bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white rounded-xl p-2.5 shadow-xs">
          <div className="flex items-center justify-between text-white/90 text-xs font-bold mb-1">
            <span>📦 إجمالي الأوردرات</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded text-[11px]">{stats.totalCount}</span>
          </div>
          <div className="text-sm font-extrabold font-mono text-white">
            {formatCurrency(stats.grandTotal)}
          </div>
          <div className="text-[10px] text-white/80 mt-0.5">تكلفة المصنع: {formatCurrency(stats.factoryTotal)}</div>
        </div>

        {/* تفصيل المواد */}
        <div className="bg-white rounded-xl p-2.5 border border-amber-200 shadow-xs">
          <div className="text-amber-700 text-xs font-bold mb-1">🪵 المواد الخام</div>
          <div className="text-sm font-extrabold text-amber-950 font-mono">
            {formatCurrency(stats.materialsTotal)}
          </div>
          <div className="text-[10px] text-amber-700 mt-0.5 flex flex-col leading-tight">
            <span>ألواح: {formatCurrency(stats.boardsTotal)}</span>
            <span>إكسسوار: {formatCurrency(stats.accessoriesTotal)}</span>
          </div>
        </div>

        {/* أعمال خارجية للمقاولين */}
        <div className="bg-white rounded-xl p-2.5 border border-purple-200 shadow-xs">
          <div className="text-purple-700 text-xs font-bold mb-1">🔨 أعمال خارجية</div>
          <div className="text-sm font-extrabold text-purple-950 font-mono">
            {formatCurrency(stats.externalTotal)}
          </div>
          <div className="text-[10px] text-purple-600 mt-0.5">مقاولين وورش خارجية</div>
        </div>

        {/* تكاليف وإضافات */}
        <div className="bg-white rounded-xl p-2.5 border border-gray-200 shadow-xs">
          <div className="text-gray-700 text-xs font-bold mb-1">💸 تكاليف وإضافات</div>
          <div className="text-sm font-extrabold text-gray-900 font-mono">
            {formatCurrency(stats.manualCostsTotal)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5 flex flex-col leading-tight">
            <span>عمال: {formatCurrency(stats.workerLogsTotal)}</span>
            <span>نقل وطريق: {formatCurrency(stats.roadExpensesTotal + stats.internalTransportTotal)}</span>
          </div>
        </div>
      </div>

      {/* شريط التحكم الموحد المدمج: التابات + التاريخ + الفلاتر + البحث + التصدير */}
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-xs mb-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* التابات الفرعية */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => { setSubTab("orders"); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              subTab === "orders" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            📋 الأوردرات ({orders.length})
          </button>
          <button
            onClick={() => { setSubTab("additions"); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              subTab === "additions" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🧩 الإضافات ({additions.length})
          </button>
          <button
            onClick={() => { setSubTab("external"); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              subTab === "external" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🔨 أعمال خارجية ({externalWork.length})
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
              placeholder="🔍 بحث..."
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
                      const isStatus = k === "الحالة";
                      const isGrand = k === "الإجمالي الشامل للأوردر";
                      const isFactory = k === "تكلفة المصنع (بدون مقاولين)";
                      return (
                        <td
                          key={k}
                          className={`px-2 py-1.5 whitespace-nowrap text-center ${
                            isGrand
                              ? "font-extrabold text-brand-orange-dark font-mono bg-orange-50/20"
                              : isFactory
                                ? "font-bold text-blue-900 font-mono"
                                : isMoney
                                  ? "font-semibold text-gray-900 font-mono"
                                  : "text-gray-700"
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
                          الإجمالي ({activeDataset.length} سجل)
                        </td>
                      );
                    }
                    return <td key={k} className="px-2 py-2"></td>;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* شريط ترقيم الصفحات Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-gray-50/80 border-t text-xs text-gray-600">
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
              <span className="px-2 py-0.5 font-bold text-gray-800 text-xs">
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
          <div className="font-bold text-gray-700 text-sm">لا توجد بيانات مطابقة للفترة المحددة</div>
          <div className="text-xs text-gray-400 mt-0.5">جرب تغيير نطاق التاريخ أو إلغاء فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

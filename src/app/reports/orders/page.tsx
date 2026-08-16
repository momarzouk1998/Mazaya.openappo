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
  const [paintsTotal, setPaintsTotal] = useState(0);
  const [ledTotal, setLedTotal] = useState(0);

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

      setPaintsTotal(filteredP.reduce((s: number, r: any) => s + fmtNum(r.amount), 0));
      setLedTotal(filteredL.reduce((s: number, r: any) => s + fmtNum(r.amount), 0));

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
        const overhead = fmtNum(x.overhead_costs_total ?? x.overhead_total ?? 0);
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
          نثريات: overhead,
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

  // Comprehensive Detailed KPIs Breakdown
  const stats = useMemo(() => {
    let openCount = 0;
    let openTotal = 0;
    let completedCount = 0;
    let completedTotal = 0;
    let deliveredCount = 0;
    let deliveredTotal = 0;

    let boardsTotal = 0;
    let accessoriesTotal = 0;
    let externalTotal = 0;
    let workerLogsTotal = 0;
    let roadExpensesTotal = 0;
    let internalTransportTotal = 0;
    let externalTransportTotal = 0;
    let installationTotal = 0;
    let commissionTotal = 0;
    let overheadTotal = 0;
    let extraCostsTotal = 0;
    let grandTotal = 0;

    rawOrders.forEach((o) => {
      const total = fmtNum(o.order_total ?? o.total ?? 0);
      const st = String(o.status ?? "");
      grandTotal += total;

      if (st === "مكتمل" || st === "تم التسليم") {
        completedCount++;
        completedTotal += total;
        if (st === "تم التسليم") {
          deliveredCount++;
          deliveredTotal += total;
        }
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
      overheadTotal += fmtNum(o.overhead_costs_total ?? o.overhead_total ?? 0);
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
      overheadTotal +
      extraCostsTotal;

    return {
      openCount,
      openTotal,
      completedCount,
      completedTotal,
      deliveredCount,
      deliveredTotal,
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
      overheadTotal,
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
        k.includes("نثريات") ||
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
      {/* رأس الصفحة المدمج والأنيق */}
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

      {/* ======================================================== */}
      {/* جدول ملون ومفصل للإحصائيات بخط واضح وأرقام كبيرة وواضحة */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-3 mb-3">
        <div className="text-xs font-bold text-gray-800 mb-2 flex items-center justify-between border-b pb-1.5">
          <span className="flex items-center gap-1.5">
            <span>📊</span>
            <span>لوحة الإحصائيات والتحليل المالي الشامل للأوردرات</span>
          </span>
          <span className="text-[11px] font-semibold text-gray-500">
            إجمالي الأوردرات المسجلة: <strong className="text-brand-orange-dark font-mono text-xs">{stats.totalCount}</strong> أوردر
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* العمود 1: حالات الأوردرات والإجمالي */}
          <div className="bg-blue-50/50 rounded-lg border border-blue-200 p-2.5 flex flex-col justify-between">
            <div className="text-xs font-bold text-blue-900 mb-1.5 flex items-center justify-between">
              <span>📦 حالات الأوردرات</span>
              <span className="bg-blue-200/60 text-blue-900 px-1.5 py-0.2 rounded text-[11px]">
                {stats.totalCount} أوردر
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between bg-white p-1.5 rounded border border-blue-100">
                <span className="text-blue-700 font-semibold flex items-center gap-1">
                  <span>📂</span> أوردرات مفتوحة ({stats.openCount}):
                </span>
                <span className="font-extrabold font-mono text-gray-900">
                  {formatCurrency(stats.openTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white p-1.5 rounded border border-blue-100">
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <span>✅</span> مكتملة ({stats.completedCount}):
                </span>
                <span className="font-extrabold font-mono text-gray-900">
                  {formatCurrency(stats.completedTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white p-1.5 rounded border border-blue-100">
                <span className="text-purple-700 font-semibold flex items-center gap-1">
                  <span>🚚</span> تم التسليم ({stats.deliveredCount}):
                </span>
                <span className="font-extrabold font-mono text-purple-900">
                  {formatCurrency(stats.deliveredTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-blue-600 text-white p-1.5 rounded font-bold shadow-xs">
                <span>الإجمالي الكلي:</span>
                <span className="font-extrabold font-mono text-sm">
                  {formatCurrency(stats.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* العمود 2: المواد الخام والمشتريات */}
          <div className="bg-amber-50/50 rounded-lg border border-amber-200 p-2.5 flex flex-col justify-between">
            <div className="text-xs font-bold text-amber-900 mb-1.5 flex items-center justify-between">
              <span>🪵 المواد الخام والمشتريات</span>
              <span className="bg-amber-200/60 text-amber-900 px-1.5 py-0.2 rounded text-[11px]">
                {formatCurrency(stats.materialsTotal + paintsTotal + ledTotal)}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between bg-white p-1.5 rounded border border-amber-100">
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <span>🪵</span> ألواح خشب:
                </span>
                <span className="font-extrabold font-mono text-gray-900">
                  {formatCurrency(stats.boardsTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white p-1.5 rounded border border-amber-100">
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <span>🔩</span> إكسسوارات ومفصلات:
                </span>
                <span className="font-extrabold font-mono text-gray-900">
                  {formatCurrency(stats.accessoriesTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white p-1.5 rounded border border-amber-100">
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <span>🎨</span> دهانات وتينر:
                </span>
                <span className="font-extrabold font-mono text-gray-900">
                  {formatCurrency(paintsTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white p-1.5 rounded border border-amber-100">
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <span>💡</span> ليد وكهرباء:
                </span>
                <span className="font-extrabold font-mono text-gray-900">
                  {formatCurrency(ledTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* العمود 3: التكاليف والمصاريف التشغيلية اليدوية */}
          <div className="bg-rose-50/50 rounded-lg border border-rose-200 p-2.5 flex flex-col justify-between">
            <div className="text-xs font-bold text-rose-900 mb-1.5 flex items-center justify-between">
              <span>💸 التكاليف والمصاريف اليدوية</span>
              <span className="bg-rose-200/60 text-rose-900 px-1.5 py-0.2 rounded text-[11px]">
                {formatCurrency(stats.manualCostsTotal)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">🧑‍🔧 عمال:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.workerLogsTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">🛣️ طريق:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.roadExpensesTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">📦 نقل داخلي:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.internalTransportTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">🚛 نقل خارجي:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.externalTransportTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">🔧 تركيبات:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.installationTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">🏭 عمولة:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.commissionTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">🧾 نثريات:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.overheadTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">➕ إضافية:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.extraCostsTotal)}</strong>
              </div>
            </div>
          </div>

          {/* العمود 4: الأعمال الخارجية + صافي تكلفة المصنع */}
          <div className="bg-purple-50/50 rounded-lg border border-purple-200 p-2.5 flex flex-col justify-between">
            <div className="text-xs font-bold text-purple-900 mb-1.5 flex items-center justify-between">
              <span>🔨 مقاولين وصافي المصنع</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between bg-white p-1.5 rounded border border-purple-100">
                <span className="text-purple-800 font-semibold flex items-center gap-1">
                  <span>🔨</span> أعمال خارجية للمقاولين:
                </span>
                <span className="font-extrabold font-mono text-purple-950 text-xs">
                  {formatCurrency(stats.externalTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-white p-1.5 rounded border border-purple-100">
                <span className="text-gray-700 font-semibold flex items-center gap-1">
                  <span>🏭</span> تكلفة المصنع الصافية:
                </span>
                <span className="font-extrabold font-mono text-brand-orange-dark text-xs">
                  {formatCurrency(stats.factoryTotal)}
                </span>
              </div>
              <div className="bg-gradient-to-r from-brand-orange to-brand-orange-dark text-white p-2 rounded-lg text-center shadow-xs">
                <div className="text-[11px] text-white/80 font-medium">الإجمالي الشامل المحسوب للأوردرات</div>
                <div className="text-base font-extrabold font-mono text-white mt-0.5">
                  {formatCurrency(stats.grandTotal)}
                </div>
              </div>
            </div>
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
            📋 الأوردرات والتكاليف ({orders.length})
          </button>
          <button
            onClick={() => { setSubTab("additions"); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              subTab === "additions" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🧩 الإضافات (دهانات، ليد، نقل) ({additions.length})
          </button>
          <button
            onClick={() => { setSubTab("external"); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              subTab === "external" ? "bg-brand-orange text-white shadow-xs" : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🔨 أعمال المقاولين ({externalWork.length})
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
              placeholder="🔍 بحث سريع..."
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
          <div className="font-bold text-gray-700 text-sm">لا توجد بيانات مطابقة للفترة المحددة</div>
          <div className="text-xs text-gray-400 mt-0.5">جرب تغيير نطاق التاريخ أو إلغاء فلتر البحث.</div>
        </div>
      )}
    </DashboardLayout>
  );
}

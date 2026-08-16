"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/format";
import DateInput from "@/components/ui/DateInput";
import { downloadElementAsPdf } from "@/lib/pdf-export";

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
  const [pdfGenerating, setPdfGenerating] = useState(false);

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
        fetchSafe("/api/orders/external-work/all?limit=1000"),
      ]);

      const ordList = ordRes?.data?.items ?? ordRes?.data ?? ordRes?.items ?? [];
      const paintsList = pRes?.data?.items ?? pRes?.data ?? pRes?.items ?? [];
      const ledList = lRes?.data?.items ?? lRes?.data ?? lRes?.items ?? [];
      const transList = tRes?.data?.entries ?? tRes?.data ?? tRes?.entries ?? [];
      const extList = extRes?.data?.items ?? extRes?.data ?? extRes?.items ?? [];

      const pTotal = (Array.isArray(paintsList) ? paintsList : []).reduce((s: number, x: any) => s + fmtNum(x.amount ?? x.cost), 0);
      const lTotal = (Array.isArray(ledList) ? ledList : []).reduce((s: number, x: any) => s + fmtNum(x.amount ?? x.cost), 0);
      setPaintsTotal(pTotal);
      setLedTotal(lTotal);

      const parsedOrders = (Array.isArray(ordList) ? ordList : []).map((x: any) => {
        const boardsCost = fmtNum(x.boards_cost);
        const accCost = fmtNum(x.accessories_cost);
        const installCost = fmtNum(x.installation_cost);
        const internalTrans = fmtNum(x.internal_transport_cost);
        const externalTrans = fmtNum(x.external_transport_cost);
        const commission = fmtNum(x.factory_commission);
        const workersWages = fmtNum(x.worker_logs_total);
        const roadExp = fmtNum(x.road_expenses_total);
        const extraCosts = fmtNum(x.extra_costs_total);
        const overheadTot = fmtNum(x.overhead_total);
        const externalWorkTot = fmtNum(x.external_work_total);

        const factoryCost =
          boardsCost +
          accCost +
          installCost +
          internalTrans +
          externalTrans +
          commission +
          workersWages +
          roadExp +
          extraCosts +
          overheadTot;

        const grandTotal = fmtNum(x.order_total) > 0 ? fmtNum(x.order_total) : factoryCost + externalWorkTot;

        return {
          _id: x.id,
          _status: x.status ?? "مفتوح",
          _raw: x,
          "اسم الأوردر": x.order_name ?? "-",
          العميل: x.customer?.name ?? x.customer_name ?? "-",
          المعرض: x.branch?.name ?? x.branch_name ?? "-",
          الحالة: x.status ?? "مفتوح",
          "تاريخ البدء": safeFormatDate(x.start_date || x.created_at),
          "تاريخ الانتهاء": safeFormatDate(x.end_date),
          "إجمالي المواد": boardsCost + accCost,
          "تكلفة الألواح": boardsCost,
          "تكلفة الإكسسوارات": accCost,
          "أجور العمال": workersWages,
          "مصاريف الطريق": roadExp,
          "نقل داخلي": internalTrans,
          "نقل خارجي": externalTrans,
          تركيبات: installCost,
          "عمولة المصنع": commission,
          نثريات: overheadTot,
          "تكاليف إضافية": extraCosts,
          "أعمال خارجية": externalWorkTot,
          "صافي تكلفة المصنع": factoryCost,
          "الإجمالي الشامل": grandTotal,
        };
      });

      setRawOrders(Array.isArray(ordList) ? ordList : []);
      setOrders(parsedOrders);

      // Additions tab dataset
      const paintsFormatted = (Array.isArray(paintsList) ? paintsList : []).map((x: any) => ({
        النوع: "🎨 دهانات وتينر",
        التاريخ: safeFormatDate(x.date || x.created_at),
        الأوردر: x.order_name || x.order?.order_name || "-",
        البيان: x.description || x.item_name || "-",
        المبلغ: fmtNum(x.amount ?? x.cost),
        ملاحظات: x.notes || "-",
      }));

      const ledFormatted = (Array.isArray(ledList) ? ledList : []).map((x: any) => ({
        النوع: "💡 ليد وكهرباء",
        التاريخ: safeFormatDate(x.date || x.created_at),
        الأوردر: x.order_name || x.order?.order_name || "-",
        البيان: x.description || x.item_name || "-",
        المبلغ: fmtNum(x.amount ?? x.cost),
        ملاحظات: x.notes || "-",
      }));

      const transFormatted = (Array.isArray(transList) ? transList : []).map((x: any) => ({
        النوع: "🚚 نقل داخلي",
        التاريخ: safeFormatDate(x.date || x.created_at),
        الأوردر: x.order_name || x.order?.order_name || "-",
        البيان: x.description || "-",
        المبلغ: fmtNum(x.amount),
        ملاحظات: x.notes || "-",
      }));

      setAdditions([...paintsFormatted, ...ledFormatted, ...transFormatted]);

      // External work tab dataset
      const extFormatted = (Array.isArray(extList) ? extList : []).map((x: any) => ({
        التاريخ: safeFormatDate(x.date || x.created_at),
        الأوردر: x.order_name || x.order?.order_name || "-",
        "المقاول / الورشة": x.contractor?.name || x.contractor_name || "-",
        "نوع العمل": x.work_type || "-",
        التكلفة: fmtNum(x.amount ?? x.cost),
        ملاحظات: x.notes || "-",
      }));

      setExternalWork(extFormatted);
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

  // Active dataset
  const activeDataset = useMemo(() => {
    let list = subTab === "orders" ? orders : subTab === "additions" ? additions : externalWork;

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
  }, [orders, additions, externalWork, subTab, search]);

  const totalPages = Math.max(1, Math.ceil(activeDataset.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return activeDataset.slice(start, start + pageSize);
  }, [activeDataset, page, pageSize]);

  // Executive Dashboard KPIs
  const stats = useMemo(() => {
    let openCount = 0;
    let completedCount = 0;
    let deliveredCount = 0;
    let openTotal = 0;
    let completedTotal = 0;
    let deliveredTotal = 0;

    let materialsTotal = 0;
    let boardsTotal = 0;
    let accessoriesTotal = 0;
    let workersTotal = 0;
    let roadTotal = 0;
    let internalTransTotal = 0;
    let externalTransTotal = 0;
    let installationTotal = 0;
    let commissionTotal = 0;
    let overheadTotal = 0;
    let extraCostsTotal = 0;
    let externalTotal = 0;
    let factoryTotal = 0;
    let grandTotal = 0;

    orders.forEach((o) => {
      const st = o["الحالة"];
      const g = fmtNum(o["الإجمالي الشامل"]);

      if (st === "مكتمل") {
        completedCount++;
        completedTotal += g;
      } else if (st === "تم التسليم") {
        deliveredCount++;
        deliveredTotal += g;
      } else {
        openCount++;
        openTotal += g;
      }

      materialsTotal += fmtNum(o["إجمالي المواد"]);
      boardsTotal += fmtNum(o["تكلفة الألواح"]);
      accessoriesTotal += fmtNum(o["تكلفة الإكسسوارات"]);
      workersTotal += fmtNum(o["أجور العمال"]);
      roadTotal += fmtNum(o["مصاريف الطريق"]);
      internalTransTotal += fmtNum(o["نقل داخلي"]);
      externalTransTotal += fmtNum(o["نقل خارجي"]);
      installationTotal += fmtNum(o["تركيبات"]);
      commissionTotal += fmtNum(o["عمولة المصنع"]);
      overheadTotal += fmtNum(o["نثريات"]);
      extraCostsTotal += fmtNum(o["تكاليف إضافية"]);
      externalTotal += fmtNum(o["أعمال خارجية"]);
      factoryTotal += fmtNum(o["صافي تكلفة المصنع"]);
      grandTotal += g;
    });

    return {
      totalCount: orders.length,
      openCount,
      completedCount,
      deliveredCount,
      openTotal,
      completedTotal,
      deliveredTotal,
      materialsTotal,
      boardsTotal,
      accessoriesTotal,
      workersTotal,
      roadTotal,
      internalTransTotal,
      externalTransTotal,
      installationTotal,
      commissionTotal,
      overheadTotal,
      extraCostsTotal,
      externalTotal,
      factoryTotal,
      grandTotal,
    };
  }, [orders]);

  const columns = useMemo(() => {
    if (!activeDataset.length) return [];
    return Object.keys(activeDataset[0]).filter((k) => !k.startsWith("_"));
  }, [activeDataset]);

  const moneyKeys = useMemo(() => {
    return columns.filter(
      (k) =>
        k.includes("تكلفة") ||
        k.includes("إجمالي") ||
        k.includes("المبلغ") ||
        k.includes("التكلفة") ||
        k.includes("أجور") ||
        k.includes("مصاريف") ||
        k.includes("نقل") ||
        k.includes("تركيبات") ||
        k.includes("عمولة") ||
        k.includes("نثريات") ||
        k.includes("إضافية") ||
        k.includes("أعمال خارجية") ||
        k.includes("صافي") ||
        k.includes("الشامل")
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
    const clean = activeDataset.map((row) => {
      const o: any = {};
      columns.forEach((c) => (o[c] = row[c]));
      return o;
    });
    exportToExcel(clean, `تقرير_الأوردرات_والتكاليف_${new Date().toISOString().slice(0, 10)}`);
  }

  async function handleDownloadPdf() {
    if (pdfGenerating) return;
    setPdfGenerating(true);
    try {
      await downloadElementAsPdf({
        elementId: "printable-orders-report",
        fileName: `تقرير_الأوردرات_والتكاليف_${new Date().toISOString().slice(0, 10)}`,
        orientation: "landscape",
      });
    } catch (e) {
      console.error("PDF download error:", e);
      alert("تعذر توليد ملف PDF، يرجى المحاولة مرة أخرى.");
    } finally {
      setPdfGenerating(false);
    }
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      {/* رأس الصفحة مع أزرار التحميل المباشر وزر الرجوع بجانب بعض */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <span>📋</span>
          <span>تقرير الأوردرات والتكاليف الشاملة</span>
        </h1>

        <div className="flex items-center gap-1.5">
          {/* زر تحميل Excel */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            className="flex items-center gap-1 font-bold h-7 text-xs px-2.5 bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
          >
            <span>📥</span>
            <span>تحميل Excel</span>
          </Button>

          {/* زر تحميل PDF مباشر */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            className="flex items-center gap-1 font-bold h-7 text-xs px-2.5 bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 disabled:opacity-50"
            title="تحميل التقرير كملف PDF مباشر بتنسيق عرضي عالي الجودة"
          >
            <span>{pdfGenerating ? "⏳" : "📄"}</span>
            <span>{pdfGenerating ? "جاري التجهيز..." : "تحميل PDF"}</span>
          </Button>

          {/* زر الرجوع */}
          <Link
            href="/reports"
            className="btn-secondary h-7 px-2.5 text-xs font-bold flex items-center gap-1 whitespace-nowrap"
          >
            <span>←</span>
            <span>رجوع للتقارير</span>
          </Link>
        </div>
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

          {/* العمود 3: التكاليف والمصاريف اليدوية */}
          <div className="bg-rose-50/50 rounded-lg border border-rose-200 p-2.5 flex flex-col justify-between">
            <div className="text-xs font-bold text-rose-900 mb-1.5 flex items-center justify-between">
              <span>💸 التكاليف والمصاريف اليدوية</span>
              <span className="bg-rose-200/60 text-rose-900 px-1.5 py-0.2 rounded text-[11px]">
                {formatCurrency(
                  stats.workersTotal +
                    stats.roadTotal +
                    stats.internalTransTotal +
                    stats.externalTransTotal +
                    stats.installationTotal +
                    stats.commissionTotal +
                    stats.overheadTotal +
                    stats.extraCostsTotal
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">🧑‍🔧 عمال:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.workersTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">🛣️ طريق:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.roadTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">📦 نقل داخلي:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.internalTransTotal)}</strong>
              </div>
              <div className="bg-white p-1 rounded border border-rose-100 flex justify-between items-center">
                <span className="text-gray-600 font-medium">🚛 نقل خارجي:</span>
                <strong className="font-mono text-gray-900 text-xs">{formatCurrency(stats.externalTransTotal)}</strong>
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

      {/* شريط التحكم الموحد المدمج: التابات + التاريخ + الفلاتر + البحث */}
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

        {/* فلاتر التاريخ والبحث */}
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
                      const isGrand = k === "الإجمالي الشامل" || k === "صافي تكلفة المصنع";
                      return (
                        <td
                          key={k}
                          className={`px-2 py-1.5 whitespace-nowrap text-center ${
                            isGrand
                              ? "font-bold text-brand-orange-dark font-mono"
                              : isMoney
                                ? "font-semibold text-gray-900 font-mono"
                                : "text-gray-700"
                          }`}
                        >
                          {isMoney ? (
                            v > 0 ? formatCurrency(fmtNum(v)) : "0"
                          ) : isStatus ? (
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                v === "مكتمل"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : v === "تم التسليم"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-blue-100 text-blue-800"
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

          {/* ترقيم الصفحات Pagination */}
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

      {/* ======================================================== */}
      {/* حاوية الـ PDF المستقلة - عالية الدقة ومكتملة البيانات (Off-screen Container) */}
      {/* ======================================================== */}
      <div
        id="printable-orders-report"
        style={{
          position: "fixed",
          left: "-9999px",
          top: "0",
          width: "1350px",
          backgroundColor: "#ffffff",
          padding: "24px",
          color: "#111827",
          fontFamily: "Tajawal, sans-serif",
          zIndex: -100,
        }}
      >
        {/* ترويسة التقرير */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #ea580c", paddingBottom: "12px", marginBottom: "16px" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: "900", color: "#111827", margin: 0 }}>شركة مزايا للتصنيع والأثاث</h1>
            <h2 style={{ fontSize: "14px", fontWeight: "700", color: "#ea580c", marginTop: "4px", margin: 0 }}>
              تقرير الأوردرات والتكاليف الشاملة {subTab === "additions" ? "(إضافات الأوردرات)" : subTab === "external" ? "(أعمال المقاولين)" : ""}
            </h2>
          </div>
          <div style={{ textAlign: "left", fontSize: "11px", color: "#4b5563" }}>
            <div>الفترة: {fromDate || "البداية"} إلى {toDate || "الآن"}</div>
            <div>تاريخ الاستخراج: {new Date().toLocaleDateString("ar-EG")}</div>
            <div>إجمالي السجلات: {activeDataset.length} سجل</div>
          </div>
        </div>

        {/* مصفوفة الإحصائيات الأفقية في الـ PDF */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "16px" }}>
          {/* كارد 1 */}
          <div style={{ border: "1px solid #bfdbfe", backgroundColor: "#eff6ff", borderRadius: "8px", padding: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: "800", color: "#1e40af", marginBottom: "6px" }}>📦 حالات الأوردرات</div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>مفتوحة ({stats.openCount}):</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.openTotal)}</strong>
            </div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>مكتملة ({stats.completedCount}):</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.completedTotal)}</strong>
            </div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>تم التسليم ({stats.deliveredCount}):</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.deliveredTotal)}</strong>
            </div>
            <div style={{ borderTop: "1px solid #bfdbfe", paddingTop: "4px", marginTop: "4px", display: "flex", justifyContent: "space-between", fontWeight: "800", color: "#1e3a8a", fontSize: "12px" }}>
              <span>الإجمالي:</span>
              <span style={{ fontFamily: "monospace" }}>{formatCurrency(stats.grandTotal)}</span>
            </div>
          </div>

          {/* كارد 2 */}
          <div style={{ border: "1px solid #fde68a", backgroundColor: "#fffbeb", borderRadius: "8px", padding: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: "800", color: "#92400e", marginBottom: "6px" }}>🪵 المواد الخام</div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>ألواح خشب:</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.boardsTotal)}</strong>
            </div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>إكسسوارات:</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.accessoriesTotal)}</strong>
            </div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>دهانات وليد:</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(paintsTotal + ledTotal)}</strong>
            </div>
            <div style={{ borderTop: "1px solid #fde68a", paddingTop: "4px", marginTop: "4px", display: "flex", justifyContent: "space-between", fontWeight: "800", color: "#78350f", fontSize: "12px" }}>
              <span>إجمالي المواد:</span>
              <span style={{ fontFamily: "monospace" }}>{formatCurrency(stats.materialsTotal + paintsTotal + ledTotal)}</span>
            </div>
          </div>

          {/* كارد 3 */}
          <div style={{ border: "1px solid #fbcfe8", backgroundColor: "#fdf2f8", borderRadius: "8px", padding: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: "800", color: "#9d174d", marginBottom: "6px" }}>💸 المصاريف والتشغيل</div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>أجور عمال:</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.workersTotal)}</strong>
            </div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>نقل داخلي وطريق:</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.internalTransTotal + stats.roadTotal)}</strong>
            </div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>تركيبات وعمولات:</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.installationTotal + stats.commissionTotal)}</strong>
            </div>
            <div style={{ borderTop: "1px solid #fbcfe8", paddingTop: "4px", marginTop: "4px", display: "flex", justifyContent: "space-between", fontWeight: "800", color: "#831843", fontSize: "12px" }}>
              <span>إضافية ونثريات:</span>
              <span style={{ fontFamily: "monospace" }}>{formatCurrency(stats.extraCostsTotal + stats.overheadTotal)}</span>
            </div>
          </div>

          {/* كارد 4 */}
          <div style={{ border: "1px solid #fed7aa", backgroundColor: "#fff7ed", borderRadius: "8px", padding: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: "800", color: "#c2410c", marginBottom: "6px" }}>🏭 صافي تكلفة المصنع</div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>أعمال مقاولين:</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.externalTotal)}</strong>
            </div>
            <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span>صافي المصنع:</span>
              <strong style={{ fontFamily: "monospace" }}>{formatCurrency(stats.factoryTotal)}</strong>
            </div>
            <div style={{ borderTop: "1px solid #fed7aa", paddingTop: "4px", marginTop: "4px", display: "flex", justifyContent: "space-between", fontWeight: "900", color: "#9a3412", fontSize: "13px" }}>
              <span>الإجمالي الشامل:</span>
              <span style={{ fontFamily: "monospace", color: "#c2410c" }}>{formatCurrency(stats.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* الجدول الكامل لجميع السجلات بدون Pagination */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", textAlign: "center" }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #d1d5db" }}>
              <th style={{ padding: "6px 4px", border: "1px solid #e5e7eb", width: "24px" }}>#</th>
              {columns.map((k) => (
                <th key={k} style={{ padding: "6px 4px", border: "1px solid #e5e7eb", fontWeight: "800", whiteSpace: "nowrap" }}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDataset.map((row, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                <td style={{ padding: "5px 3px", border: "1px solid #e5e7eb", color: "#6b7280", fontFamily: "monospace" }}>
                  {i + 1}
                </td>
                {columns.map((k) => {
                  const v = row[k];
                  const isMoney = moneyKeys.includes(k);
                  const isStatus = k === "الحالة";
                  const isGrand = k === "الإجمالي الشامل" || k === "صافي تكلفة المصنع";
                  return (
                    <td
                      key={k}
                      style={{
                        padding: "5px 3px",
                        border: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                        fontWeight: isGrand ? "800" : isMoney ? "700" : "500",
                        color: isGrand ? "#ea580c" : isMoney ? "#111827" : "#374151",
                        fontFamily: isMoney ? "monospace" : "inherit",
                      }}
                    >
                      {isMoney ? (v > 0 ? formatCurrency(fmtNum(v)) : "0") : isStatus ? String(v) : (v ?? "—")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: "#fef3c7", borderTop: "2px solid #d97706", fontWeight: "900", fontSize: "10.5px" }}>
              <td style={{ padding: "6px 4px", border: "1px solid #fde68a" }}>Σ</td>
              {columns.map((k) => {
                const isMoney = moneyKeys.includes(k);
                if (isMoney) {
                  return (
                    <td key={k} style={{ padding: "6px 4px", border: "1px solid #fde68a", fontFamily: "monospace", color: "#b45309", whiteSpace: "nowrap" }}>
                      {formatCurrency(columnSums[k] || 0)}
                    </td>
                  );
                }
                if (k === columns[0]) {
                  return (
                    <td key={k} style={{ padding: "6px 4px", border: "1px solid #fde68a", whiteSpace: "nowrap" }}>
                      الإجمالي ({activeDataset.length} سجل)
                    </td>
                  );
                }
                return <td key={k} style={{ padding: "6px 4px", border: "1px solid #fde68a" }}></td>;
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </DashboardLayout>
  );
}

"use client";
import { useState, useMemo } from "react";
import { useUserStore } from "@/store/user-store";
import { useApiMutation } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/format";
import DateInput from "@/components/ui/DateInput";

type ReportType =
  | "inventory"
  | "orders"
  | "cashflow"
  | "overhead"
  | "workers"
  | "contractors"
  | "order_additions"
  | "suppliers"
  | "customers";

interface ReportConfigItem {
  label: string;
  icon: string;
  needsDate: boolean;
  desc: string;
  badge: string;
}

const REPORT_CONFIG: Record<ReportType, ReportConfigItem> = {
  inventory: {
    label: "تقرير المخزون والجرد",
    icon: "📦",
    needsDate: true,
    desc: "جرد شامل للألواح والإكسسوارات وقيمة المتبقي بالتاريخ",
    badge: "مخزون وجرد",
  },
  orders: {
    label: "تقرير الأوردرات والتكاليف",
    icon: "📋",
    needsDate: true,
    desc: "تكاليف المصنع والأوردرات مفصولة عن الأعمال الخارجية",
    badge: "أوردرات ومقاولين",
  },
  cashflow: {
    label: "التدفق النقدي واليوميات",
    icon: "💸",
    needsDate: true,
    desc: "حركات النقدية مع فصل يومية المصنع عن يومية الألواح",
    badge: "نقدية ومحافظ",
  },
  overhead: {
    label: "تقرير النثريات العامة",
    icon: "📄",
    needsDate: true,
    desc: "مصاريف تشغيل المصنع العامة فقط (بدون أجور عمال)",
    badge: "نثريات تشغيل",
  },
  workers: {
    label: "تقرير أجور ويوميات العمال",
    icon: "🧑‍🔧",
    needsDate: true,
    desc: "تفاصيل يوميات وسفريات وأجور العمال والتسويات",
    badge: "عمال ويوميات",
  },
  contractors: {
    label: "تقرير المقاولين والورش",
    icon: "🔨",
    needsDate: true,
    desc: "كل الأعمال الخارجية المسندة للورش والمقاولين",
    badge: "مقاولين وورش",
  },
  order_additions: {
    label: "تقرير إضافات الأوردرات",
    icon: "🧩",
    needsDate: true,
    desc: "مصاريف الدهانات، الليد، والنقل الداخلي ومصاريف الطريق",
    badge: "دهانات وليد ونقل",
  },
  suppliers: {
    label: "تقرير الموردين والمشتريات",
    icon: "🏭",
    needsDate: true,
    desc: "إجمالي المشتريات والمدفوعات والمتبقي لكل مورد",
    badge: "موردين ومشتريات",
  },
  customers: {
    label: "تقرير العملاء والتحصيلات",
    icon: "👥",
    needsDate: false,
    desc: "قيمة أوردرات العملاء والمدفوعات والمتبقي عليهم",
    badge: "عملاء وتحصيل",
  },
};

// تنسيق التاريخ بشكل آمن 100% يمنع Invalid Date نهائياً
function safeFormatDate(v: any): string {
  if (!v || v === "null" || v === "undefined" || v === "-") return "—";
  if (typeof v === "string" && (v.includes("/") || v === "—")) return v;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) {
      const s = String(v).slice(0, 10);
      return s || "—";
    }
    return d.toISOString().slice(0, 10);
  } catch {
    return String(v || "—");
  }
}

function fmtNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function ReportsPage() {
  const { user: profile } = useUserStore();
  const [type, setType] = useState<ReportType>("inventory");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Search filter within results
  const [tableSearch, setTableSearch] = useState("");

  // Sub-filter tabs
  const [subFilter, setSubFilter] = useState("all");

  // Raw data fetched
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Extra KPI stats
  const [customStats, setCustomStats] = useState<Record<string, any>>({});

  const { mutate } = useApiMutation();
  const config = REPORT_CONFIG[type];

  // Quick date presets
  function applyDatePreset(preset: "today" | "week" | "month" | "all") {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (preset === "today") {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      setFromDate(weekAgo.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (preset === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(monthStart.toISOString().slice(0, 10));
      setToDate(todayStr);
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
    }
  }

  // ============================================================
  // توليد البيانات
  // ============================================================
  async function generate() {
    setLoading(true);
    setGenerated(true);
    setSubFilter("all");
    setTableSearch("");
    let result: any[] = [];
    let stats: Record<string, any> = {};

    try {
      // 1. تقرير المخزون والجرد
      if (type === "inventory") {
        const [{ data: b }, { data: a }] = await Promise.all([
          mutate(
            "GET",
            `/api/boards?limit=1000${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
          ),
          mutate(
            "GET",
            `/api/accessories?limit=1000${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
          ),
        ]);
        const boards = b?.items ?? b ?? [];
        const accessories = a?.items ?? a ?? [];

        let boardsVal = 0;
        let boardsQty = 0;
        let accVal = 0;
        let accQty = 0;

        const boardsList = boards.map((x: any) => {
          const rem = fmtNum(x.quantity_remaining ?? 0);
          const price = fmtNum(x.unit_price);
          const val = rem * price;
          boardsVal += val;
          boardsQty += rem;
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
            "قيمة المتبقي": val,
            ملاحظات: x.notes ?? "-",
          };
        });

        const accList = accessories.map((x: any) => {
          const rem = fmtNum(x.quantity_remaining ?? 0);
          const price = fmtNum(x.unit_price);
          const val = rem * price;
          accVal += val;
          accQty += rem;
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
            "قيمة المتبقي": val,
            ملاحظات: x.notes ?? "-",
          };
        });

        result = [...boardsList, ...accList];
        stats = {
          boardsVal,
          boardsQty,
          accVal,
          accQty,
          totalVal: boardsVal + accVal,
          totalQty: boardsQty + accQty,
        };
      }

      // 2. تقرير الأوردرات والتكاليف الشاملة
      else if (type === "orders") {
        const { data: o } = await mutate(
          "GET",
          `/api/orders?limit=1000${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
        );
        const orders = o?.items ?? o ?? [];

        let factoryTotal = 0;
        let externalTotal = 0;
        let grandTotal = 0;

        result = orders.map((x: any) => {
          const grand = fmtNum(x.order_total ?? x.total ?? 0);
          const ext = fmtNum(x.external_work_total ?? 0);
          const factory = Math.max(0, grand - ext);

          factoryTotal += factory;
          externalTotal += ext;
          grandTotal += grand;

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
            "تكلفة المصنع (بدون مقاولين)": factory,
            "الأعمال الخارجية (المقاولين)": ext,
            "الإجمالي الشامل للأوردر": grand,
          };
        });

        stats = {
          factoryTotal,
          externalTotal,
          grandTotal,
          count: orders.length,
        };
      }

      // 3. تقرير التدفق النقدي واليوميات
      else if (type === "cashflow") {
        const { data: j } = await mutate(
          "GET",
          `/api/journal?limit=2000${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
        );
        const entries = j?.entries ?? j ?? [];

        let factoryIncome = 0;
        let factoryExpense = 0;
        let boardsIncome = 0;
        let boardsExpense = 0;

        result = entries.map((x: any) => {
          const isBoardsWallet =
            x.entry_type === "تحويل تمريري" || x.entry_type === "مشتريات";
          const walletType = isBoardsWallet ? "يومية الألواح" : "يومية المصنع";
          const amount = fmtNum(x.amount);
          const isIncome =
            x.entry_type === "دفعة واردة من معرض" ||
            x.entry_type === "تحويل تمريري";

          if (walletType === "يومية المصنع") {
            if (isIncome) factoryIncome += amount;
            else factoryExpense += amount;
          } else {
            if (isIncome) boardsIncome += amount;
            else boardsExpense += amount;
          }

          return {
            _wallet: isBoardsWallet ? "boards" : "factory",
            التاريخ: safeFormatDate(x.date),
            "المحفظة / اليومية": walletType,
            "نوع الحركة": x.entry_type ?? "",
            البيان: x.description ?? "",
            الجهة: x.party_name ?? "-",
            "طريقة الدفع": x.payment_method ?? "-",
            المبلغ: amount,
            الأثر: isIncome ? `+${amount}` : `-${amount}`,
          };
        });

        stats = {
          factoryIncome,
          factoryExpense,
          factoryNet: factoryIncome - factoryExpense,
          boardsIncome,
          boardsExpense,
          boardsNet: boardsIncome - boardsExpense,
          grandNet:
            factoryIncome - factoryExpense + (boardsIncome - boardsExpense),
        };
      }

      // 4. تقرير النثريات العامة (بدون أجور عمال)
      else if (type === "overhead") {
        const { data: o } = await mutate(
          "GET",
          `/api/overhead?limit=2000&exclude_wages=true${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
        );
        const items = o?.expenses ?? o?.items ?? o ?? [];
        let totalOverhead = 0;

        result = items.map((x: any) => {
          const amt = fmtNum(x.amount);
          totalOverhead += amt;
          return {
            التاريخ: safeFormatDate(x.date),
            التصنيف: x.category ?? "نثريات عامة",
            البيان: x.description ?? "",
            "طريقة الدفع": x.payment_method ?? "نقدي",
            المبلغ: amt,
            ملاحظات: x.notes ?? "-",
          };
        });

        stats = {
          totalOverhead,
          count: items.length,
        };
      }

      // 5. تقرير العمال والأجور واليوميات
      else if (type === "workers") {
        const [{ data: w }, { data: dl }] = await Promise.all([
          mutate("GET", "/api/workers?limit=500"),
          mutate(
            "GET",
            `/api/workers/daily-logs?limit=2000${fromDate ? "&startDate=" + fromDate : ""}${toDate ? "&endDate=" + toDate : ""}`
          ),
        ]);

        const workers = w?.items ?? w ?? [];
        const logs = dl?.items ?? dl ?? [];

        let totalLogsAmount = 0;
        let totalTravelDays = 0;

        const workerSummaryMap: Record<
          string,
          { count: number; total: number; travelDays: number; lastDate: string }
        > = {};

        logs.forEach((l: any) => {
          const rate = fmtNum(l.daily_rate);
          totalLogsAmount += rate;
          if (l.is_travel) totalTravelDays += 1;

          const wid = String(l.worker_id || l.worker?.id);
          if (!workerSummaryMap[wid]) {
            workerSummaryMap[wid] = {
              count: 0,
              total: 0,
              travelDays: 0,
              lastDate: "",
            };
          }
          workerSummaryMap[wid].count += 1;
          workerSummaryMap[wid].total += rate;
          if (l.is_travel) workerSummaryMap[wid].travelDays += 1;
          const d = String(l.work_date).slice(0, 10);
          if (d > workerSummaryMap[wid].lastDate) {
            workerSummaryMap[wid].lastDate = d;
          }
        });

        const summaryRows = workers.map((wk: any) => {
          const s = workerSummaryMap[String(wk.id)] || {
            count: 0,
            total: 0,
            travelDays: 0,
            lastDate: "-",
          };
          return {
            _sub: "summary",
            "اسم العامل": wk.name ?? "",
            المهنة: wk.job_title || wk.role || "عامل",
            الهاتف: wk.phone ?? "-",
            "اليومية الأساسية": fmtNum(wk.daily_rate),
            "عدد أيام العمل": s.count,
            "أيام السفر": s.travelDays,
            "إجمالي الأجور المستحقة": s.total,
            "آخر يومية مسجلة": s.lastDate ? safeFormatDate(s.lastDate) : "-",
          };
        });

        const detailedLogRows = logs.map((l: any) => ({
          _sub: "logs",
          التاريخ: safeFormatDate(l.work_date),
          "اسم العامل": l.worker?.name || "عامل",
          الأوردر: l.order?.order_name || "—",
          "اليومية المحسوبة": fmtNum(l.daily_rate),
          "سفرية؟": l.is_travel ? "✈️ نعم" : "لا",
          ملاحظات: l.notes || "-",
        }));

        result = [...summaryRows, ...detailedLogRows];
        stats = {
          totalLogsAmount,
          totalTravelDays,
          workersCount: workers.length,
          logsCount: logs.length,
        };
      }

      // 6. تقرير المقاولين والورش
      else if (type === "contractors") {
        const { data: ew } = await mutate("GET", "/api/external-work?limit=1000");
        let items = ew?.items ?? ew ?? [];

        if (fromDate || toDate) {
          items = items.filter((it: any) => {
            const d = String(it.created_at || "").slice(0, 10);
            if (fromDate && d < fromDate) return false;
            if (toDate && d > toDate) return false;
            return true;
          });
        }

        let totalContractorsAmount = 0;
        result = items.map((x: any) => {
          const amt = fmtNum(x.amount);
          totalContractorsAmount += amt;
          return {
            التاريخ: safeFormatDate(x.created_at),
            "المقاول / الورشة": x.contractor_name || "—",
            الأوردر: x.order_name || "—",
            "نوع العمل الخارجي": x.work_type || "أخرى",
            المبلغ: amt,
            الملاحظات: x.notes || "-",
          };
        });

        stats = {
          totalContractorsAmount,
          count: items.length,
        };
      }

      // 7. تقرير إضافات الأوردرات (دهانات + ليد + نقل ومصاريف طريق)
      else if (type === "order_additions") {
        const [{ data: p }, { data: l }, { data: t }] = await Promise.all([
          mutate("GET", "/api/paints?limit=1000"),
          mutate("GET", "/api/led-expenses?limit=1000"),
          mutate("GET", "/api/internal-transport?limit=1000"),
        ]);

        let paints = p?.items ?? p ?? [];
        let leds = l?.items ?? l ?? [];
        let transports = t?.entries ?? t ?? [];

        if (fromDate || toDate) {
          paints = paints.filter((it: any) => {
            const d = String(it.date || it.created_at).slice(0, 10);
            return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
          });
          leds = leds.filter((it: any) => {
            const d = String(it.date || it.created_at).slice(0, 10);
            return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
          });
          transports = transports.filter((it: any) => {
            const d = String(it.date || it.created_at).slice(0, 10);
            return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
          });
        }

        let paintsTotal = 0;
        let ledTotal = 0;
        let transportTotal = 0;

        const pRows = paints.map((x: any) => {
          const amt = fmtNum(x.amount);
          paintsTotal += amt;
          return {
            _sub: "paints",
            التاريخ: safeFormatDate(x.date || x.created_at),
            القسم: "🎨 مصاريف دهانات ومرمات",
            الأوردر: x.order_name || "—",
            البيان: x.description || "دهانات وتينر",
            "طريقة الدفع": x.payment_method || "نقدي",
            المبلغ: amt,
            ملاحظات: x.notes || "-",
          };
        });

        const lRows = leds.map((x: any) => {
          const amt = fmtNum(x.amount);
          ledTotal += amt;
          return {
            _sub: "led",
            التاريخ: safeFormatDate(x.date || x.created_at),
            القسم: "💡 مصاريف ليد وكهرباء",
            الأوردر: x.order_name || "—",
            البيان: x.description || "بضاعة ومصنعية ليد",
            "طريقة الدفع": x.payment_method || "نقدي",
            المبلغ: amt,
            ملاحظات: x.notes || "-",
          };
        });

        const tRows = transports.map((x: any) => {
          const amt = fmtNum(x.amount);
          transportTotal += amt;
          return {
            _sub: "transport",
            التاريخ: safeFormatDate(x.date || x.created_at),
            القسم: "🚚 نقل داخلي ومصاريف طريق",
            الأوردر: x.order_name || "—",
            البيان: x.description || "نقل / مصاريف طريق",
            "طريقة الدفع": x.payment_method || "نقدي",
            المبلغ: amt,
            ملاحظات: x.notes || "-",
          };
        });

        result = [...pRows, ...lRows, ...tRows];
        stats = {
          paintsTotal,
          ledTotal,
          transportTotal,
          additionsTotal: paintsTotal + ledTotal + transportTotal,
        };
      }

      // 8. تقرير الموردين والمشتريات
      else if (type === "suppliers") {
        const [{ data: s }, { data: p }, { data: py }] = await Promise.all([
          mutate("GET", "/api/suppliers?limit=500"),
          mutate(
            "GET",
            `/api/journal?limit=2000&entry_type=مشتريات${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
          ),
          mutate(
            "GET",
            `/api/journal?limit=2000&entry_type=دفعة صادرة لمورد${fromDate ? "&from_date=" + fromDate : ""}${toDate ? "&to_date=" + toDate : ""}`
          ),
        ]);

        const suppliers = s?.items ?? s ?? [];
        const purchases = p?.entries ?? p ?? [];
        const payments = py?.entries ?? py ?? [];

        const purchaseMap: Record<string, number> = {};
        const paymentMap: Record<string, number> = {};

        purchases.forEach((x: any) => {
          if (x.party_id) {
            purchaseMap[String(x.party_id)] =
              (purchaseMap[String(x.party_id)] || 0) + fmtNum(x.amount);
          }
        });

        payments.forEach((x: any) => {
          if (x.party_id) {
            paymentMap[String(x.party_id)] =
              (paymentMap[String(x.party_id)] || 0) + fmtNum(x.amount);
          }
        });

        let totalPurchases = 0;
        let totalPayments = 0;

        result = suppliers.map((x: any) => {
          const purch = purchaseMap[String(x.id)] || 0;
          const pay = paymentMap[String(x.id)] || 0;
          const balance = purch - pay;

          totalPurchases += purch;
          totalPayments += pay;

          return {
            "اسم المورد": x.name ?? "",
            "نوع التعامل": x.payment_type ?? "-",
            الهاتف: x.phone ?? "-",
            "إجمالي المشتريات": purch,
            "إجمالي المدفوع له": pay,
            "الرصيد المستحق (الديون)": balance,
          };
        });

        stats = {
          totalPurchases,
          totalPayments,
          totalBalance: totalPurchases - totalPayments,
          count: suppliers.length,
        };
      }

      // 9. تقرير العملاء والتحصيلات
      else if (type === "customers") {
        const [{ data: c }, { data: o }, { data: pay }] = await Promise.all([
          mutate("GET", "/api/customers?limit=500"),
          mutate("GET", "/api/orders?limit=2000"),
          mutate("GET", "/api/customer-payments?limit=2000"),
        ]);

        const customers = c?.items ?? c ?? [];
        const orders = o?.items ?? o ?? [];
        const payments = pay?.payments ?? pay?.items ?? pay ?? [];

        const orderStats: Record<string, { count: number; total: number }> = {};
        orders.forEach((ord: any) => {
          if (!ord.customer_id) return;
          const cid = String(ord.customer_id);
          if (!orderStats[cid]) orderStats[cid] = { count: 0, total: 0 };
          orderStats[cid].count += 1;
          orderStats[cid].total += fmtNum(ord.order_total ?? ord.total ?? 0);
        });

        const paymentMap: Record<string, number> = {};
        payments.forEach((p: any) => {
          if (p.customer_id) {
            paymentMap[String(p.customer_id)] =
              (paymentMap[String(p.customer_id)] || 0) + fmtNum(p.amount);
          }
        });

        let totalOrdersVal = 0;
        let totalCollected = 0;

        result = customers.map((x: any) => {
          const s = orderStats[String(x.id)] || { count: 0, total: 0 };
          const collected = paymentMap[String(x.id)] || 0;
          const rem = s.total - collected;

          totalOrdersVal += s.total;
          totalCollected += collected;

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

        stats = {
          totalOrdersVal,
          totalCollected,
          totalRemaining: totalOrdersVal - totalCollected,
          count: customers.length,
        };
      }

      setRawData(result);
      setCustomStats(stats);
    } catch (e) {
      console.error("Report generation error:", e);
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // تصفية العرض بناءً على التاب الداخلي (Sub-Filter) ومربع البحث
  // ============================================================
  const displayedData = useMemo(() => {
    if (!rawData.length) return [];
    let list = rawData;

    if (subFilter !== "all") {
      if (type === "inventory") list = list.filter((r) => r._cat === subFilter);
      else if (type === "cashflow") list = list.filter((r) => r._wallet === subFilter);
      else if (type === "workers") list = list.filter((r) => r._sub === subFilter);
      else if (type === "order_additions") list = list.filter((r) => r._sub === subFilter);
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((row) =>
        Object.entries(row).some(([k, v]) => {
          if (k.startsWith("_")) return false;
          return String(v ?? "").toLowerCase().includes(q);
        })
      );
    }

    return list;
  }, [rawData, subFilter, type, tableSearch]);

  // استخراج أسماء الأعمدة المعروضة النظيفة
  const columns = useMemo(() => {
    if (!displayedData.length) return [];
    return Object.keys(displayedData[0]).filter((k) => !k.startsWith("_"));
  }, [displayedData]);

  // تحديد أعمدة المبالغ المالية
  const moneyKeys = useMemo(() => {
    return columns.filter(
      (k) =>
        k.includes("قيمة") ||
        k.includes("إجمالي") ||
        k.includes("المبلغ") ||
        k.includes("تكلفة") ||
        k.includes("سعر") ||
        k.includes("الأجور") ||
        k.includes("المشتريات") ||
        k.includes("المدفوع") ||
        k.includes("الرصيد") ||
        k.includes("الأعمال الخارجية") ||
        k.includes("المتبقي على العميل")
    );
  }, [columns]);

  // حساب المجاميع للأعمدة المالية في الفوتر
  const columnSums = useMemo(() => {
    const sums: Record<string, number> = {};
    if (!displayedData.length) return sums;
    moneyKeys.forEach((key) => {
      sums[key] = displayedData.reduce((acc, row) => acc + fmtNum(row[key]), 0);
    });
    return sums;
  }, [displayedData, moneyKeys]);

  function changeType(newType: ReportType) {
    setType(newType);
    setRawData([]);
    setGenerated(false);
    setSubFilter("all");
    setTableSearch("");
    setCustomStats({});
  }

  function handleExportExcel() {
    const exportCleanData = displayedData.map((row) => {
      const clean: any = {};
      columns.forEach((col) => {
        clean[col] = row[col];
      });
      return clean;
    });
    exportToExcel(
      exportCleanData,
      `تقرير_${config.label}_${new Date().toISOString().slice(0, 10)}`
    );
  }

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="مركز التقارير والإحصائيات"
        subtitle="تحليلات دقيقة وكشوفات شاملة مع تصدير Excel فوري"
        helpTitle="التقارير"
        helpDescription="اختر نوع التقرير، حدد النطاق الزمني بالتاريخ، اضغط توليد للحصول على المؤشرات والجداول التفصيلية."
        backHref="/journal"
      />

      {/* كروت اختيار نوع التقرير الفاخرة */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-5">
        {(
          Object.entries(REPORT_CONFIG) as [
            ReportType,
            (typeof REPORT_CONFIG)[ReportType],
          ][]
        ).map(([key, cfg]) => {
          const isSelected = type === key;
          return (
            <button
              key={key}
              onClick={() => changeType(key)}
              className={`p-3.5 rounded-2xl text-right transition-all duration-200 flex flex-col justify-between relative overflow-hidden border ${
                isSelected
                  ? "bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white shadow-lg shadow-brand-orange/20 scale-[1.02] border-brand-orange"
                  : "bg-white border-gray-200 text-gray-800 hover:border-brand-orange/40 hover:bg-orange-50/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{cfg.icon}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {cfg.badge}
                </span>
              </div>
              <div>
                <div className="font-extrabold text-xs leading-tight mb-1">
                  {cfg.label}
                </div>
                <div
                  className={`text-[11px] line-clamp-1 leading-tight ${
                    isSelected ? "text-white/85" : "text-gray-400"
                  }`}
                >
                  {cfg.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* لوحة فلترة التاريخ وزر التوليد والتصفية السريعة */}
      <div className="card mb-5 bg-white border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 rounded-xl bg-orange-50 border border-orange-100">
              {config.icon}
            </span>
            <div>
              <div className="font-extrabold text-base text-brand-black flex items-center gap-2">
                <span>{config.label}</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded bg-brand-orange-light text-brand-orange-dark font-mono">
                  {config.badge}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{config.desc}</div>
            </div>
          </div>

          {/* أزرار الفترات السريعة */}
          {config.needsDate && (
            <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200 text-xs">
              <button
                type="button"
                onClick={() => applyDatePreset("today")}
                className="px-2.5 py-1 rounded-lg hover:bg-white hover:shadow-xs transition text-gray-700 font-medium"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("week")}
                className="px-2.5 py-1 rounded-lg hover:bg-white hover:shadow-xs transition text-gray-700 font-medium"
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("month")}
                className="px-2.5 py-1 rounded-lg hover:bg-white hover:shadow-xs transition text-gray-700 font-medium"
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset("all")}
                className="px-2.5 py-1 rounded-lg hover:bg-white hover:shadow-xs transition text-gray-700 font-medium"
              >
                كل الفترات
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              📅 من تاريخ
            </label>
            <DateInput
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="يوم / شهر / سنة"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              📅 إلى تاريخ
            </label>
            <DateInput
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="يوم / شهر / سنة"
            />
          </div>
          <div>
            <Button
              onClick={generate}
              loading={loading}
              className="w-full h-10 font-bold shadow-md shadow-brand-orange/20"
            >
              {loading ? "⏳ جاري استخراج البيانات..." : `🔍 توليد ${config.label}`}
            </Button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* كروت الإحصائيات التجميعية الفائقة لكل تقرير (Top KPI Cards) */}
      {/* ============================================================ */}
      {generated && rawData.length > 0 && (
        <div className="space-y-4 mb-5">
          {/* كروت تقرير المخزون والجرد */}
          {type === "inventory" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-r-4 border-amber-500 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🪵 قيمة مخزون الألواح المتبقي
                </div>
                <div className="text-2xl font-extrabold text-amber-900 font-mono">
                  {formatCurrency(customStats.boardsVal || 0)}
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  الكمية المتبقية: <strong>{customStats.boardsQty || 0}</strong> لوح
                </div>
              </div>

              <div className="card bg-gradient-to-br from-rose-50 to-pink-50 border-r-4 border-rose-500 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🔩 قيمة مخزون الإكسسوارات المتبقي
                </div>
                <div className="text-2xl font-extrabold text-rose-900 font-mono">
                  {formatCurrency(customStats.accVal || 0)}
                </div>
                <div className="text-xs text-rose-700 mt-1">
                  الكمية المتبقية: <strong>{customStats.accQty || 0}</strong> قطعة
                </div>
              </div>

              <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-4 shadow-md">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  📦 إجمالي القيمة العامة لمخزون المصنع
                </div>
                <div className="text-2xl font-extrabold font-mono">
                  {formatCurrency(customStats.totalVal || 0)}
                </div>
                <div className="text-xs text-white/80 mt-1">
                  إجمالي الأصناف المسجلة: <strong>{rawData.length}</strong> صنف
                </div>
              </div>
            </div>
          )}

          {/* كروت تقرير الأوردرات والتكاليف */}
          {type === "orders" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-r-4 border-indigo-600 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  📦 تكلفة المصنع للأوردرات (بدون مقاولين)
                </div>
                <div className="text-2xl font-extrabold text-indigo-900 font-mono">
                  {formatCurrency(customStats.factoryTotal || 0)}
                </div>
                <div className="text-xs text-indigo-700 mt-1">
                  خامات + تركيبات + نقل + يوميات + دهانات وليد
                </div>
              </div>

              <div className="card bg-gradient-to-br from-amber-50 to-yellow-50 border-r-4 border-amber-500 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🔨 إجمالي الأعمال الخارجية (المقاولين والورش)
                </div>
                <div className="text-2xl font-extrabold text-amber-900 font-mono">
                  {formatCurrency(customStats.externalTotal || 0)}
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  مستحقات الورش الخارجية المسندة
                </div>
              </div>

              <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-4 shadow-md">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  💰 الإجمالي الشامل لكافة الأوردرات
                </div>
                <div className="text-2xl font-extrabold font-mono">
                  {formatCurrency(customStats.grandTotal || 0)}
                </div>
                <div className="text-xs text-white/80 mt-1">
                  عدد الأوردرات: <strong>{customStats.count || 0}</strong> أوردر
                </div>
              </div>
            </div>
          )}

          {/* كروت تقرير التدفق النقدي واليوميات */}
          {type === "cashflow" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 border-r-4 border-emerald-600 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  👛 صافي يومية المصنع
                </div>
                <div className="text-2xl font-extrabold text-emerald-900 font-mono">
                  {formatCurrency(customStats.factoryNet || 0)}
                </div>
                <div className="text-xs text-emerald-700 mt-1">
                  وارد: {formatCurrency(customStats.factoryIncome || 0)} − مصروف: {formatCurrency(customStats.factoryExpense || 0)}
                </div>
              </div>

              <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-r-4 border-amber-600 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🪵 صافي يومية الألواح
                </div>
                <div className="text-2xl font-extrabold text-amber-900 font-mono">
                  {formatCurrency(customStats.boardsNet || 0)}
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  تمريري: {formatCurrency(customStats.boardsIncome || 0)} − مشتريات: {formatCurrency(customStats.boardsExpense || 0)}
                </div>
              </div>

              <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-4 shadow-md">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  💵 صافي التدفق النقدي الشامل
                </div>
                <div className="text-2xl font-extrabold font-mono">
                  {formatCurrency(customStats.grandNet || 0)}
                </div>
                <div className="text-xs text-white/80 mt-1">
                  إجمالي الحركات: <strong>{rawData.length}</strong> حركة مالية
                </div>
              </div>
            </div>
          )}

          {/* كروت تقرير النثريات */}
          {type === "overhead" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="card bg-purple-50 border-r-4 border-purple-600 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  📄 إجمالي النثريات العامة للمصنع
                </div>
                <div className="text-2xl font-extrabold text-purple-900 font-mono">
                  {formatCurrency(customStats.totalOverhead || 0)}
                </div>
                <div className="text-xs text-purple-700 mt-1">
                  كهرباء، شحن، صيانة دورية، بوفيه ونثريات تشغيل
                </div>
              </div>

              <div className="card bg-gray-50 border border-gray-200 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🧾 عدد حركات النثريات
                </div>
                <div className="text-2xl font-extrabold text-gray-900 font-mono">
                  {customStats.count || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  (مستبعد منها كلياً أجور العمال والنقل)
                </div>
              </div>
            </div>
          )}

          {/* كروت تقرير العمال */}
          {type === "workers" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card bg-orange-50 border-r-4 border-orange-500 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🧑‍🔧 إجمالي أجور ويوميات العمال
                </div>
                <div className="text-2xl font-extrabold text-orange-900 font-mono">
                  {formatCurrency(customStats.totalLogsAmount || 0)}
                </div>
                <div className="text-xs text-orange-700 mt-1">
                  إجمالي سجلات اليوميات: {customStats.logsCount || 0} يومية
                </div>
              </div>

              <div className="card bg-amber-50 border-r-4 border-amber-500 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  ✈️ إجمالي أيام السفر
                </div>
                <div className="text-2xl font-extrabold text-amber-900 font-mono">
                  {customStats.totalTravelDays || 0} يوم
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  أيام عمل تم احتساب يومية سفر عليها
                </div>
              </div>

              <div className="card bg-gray-50 border border-gray-200 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  👥 عدد العمال
                </div>
                <div className="text-2xl font-extrabold text-gray-900 font-mono">
                  {customStats.workersCount || 0} عامل
                </div>
                <div className="text-xs text-gray-500 mt-1">المسجلين في النظام</div>
              </div>
            </div>
          )}

          {/* كروت تقرير المقاولين */}
          {type === "contractors" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="card bg-indigo-50 border-r-4 border-indigo-600 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🔨 إجمالي الأعمال الخارجية للمقاولين
                </div>
                <div className="text-2xl font-extrabold text-indigo-900 font-mono">
                  {formatCurrency(customStats.totalContractorsAmount || 0)}
                </div>
                <div className="text-xs text-indigo-700 mt-1">
                  مستحقات الورش والمقاولين المسندة من الأوردرات
                </div>
              </div>

              <div className="card bg-gray-50 border border-gray-200 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  📋 عدد العمليات الخارجية
                </div>
                <div className="text-2xl font-extrabold text-gray-900 font-mono">
                  {customStats.count || 0} عملية
                </div>
                <div className="text-xs text-gray-500 mt-1">ألوميتال، تنجيد، وغيرها</div>
              </div>
            </div>
          )}

          {/* كروت تقرير إضافات الأوردرات */}
          {type === "order_additions" && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="card bg-fuchsia-50 border-r-4 border-fuchsia-500 p-3 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🎨 مصاريف الدهانات
                </div>
                <div className="text-xl font-extrabold text-fuchsia-900 font-mono">
                  {formatCurrency(customStats.paintsTotal || 0)}
                </div>
              </div>

              <div className="card bg-yellow-50 border-r-4 border-yellow-500 p-3 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  💡 مصاريف الليد
                </div>
                <div className="text-xl font-extrabold text-yellow-900 font-mono">
                  {formatCurrency(customStats.ledTotal || 0)}
                </div>
              </div>

              <div className="card bg-sky-50 border-r-4 border-sky-500 p-3 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🚚 النقل ومصاريف الطريق
                </div>
                <div className="text-xl font-extrabold text-sky-900 font-mono">
                  {formatCurrency(customStats.transportTotal || 0)}
                </div>
              </div>

              <div className="card bg-brand-orange text-white p-3 shadow-md">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  ➕ إجمالي الإضافات
                </div>
                <div className="text-xl font-extrabold font-mono">
                  {formatCurrency(customStats.additionsTotal || 0)}
                </div>
              </div>
            </div>
          )}

          {/* كروت تقرير الموردين */}
          {type === "suppliers" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card bg-red-50 border-r-4 border-red-500 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🏭 إجمالي المشتريات من الموردين
                </div>
                <div className="text-2xl font-extrabold text-red-900 font-mono">
                  {formatCurrency(customStats.totalPurchases || 0)}
                </div>
                <div className="text-xs text-red-700 mt-1">ألواح وإكسسوارات</div>
              </div>

              <div className="card bg-green-50 border-r-4 border-green-500 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  💳 إجمالي المدفوعات للموردين
                </div>
                <div className="text-2xl font-extrabold text-green-900 font-mono">
                  {formatCurrency(customStats.totalPayments || 0)}
                </div>
                <div className="text-xs text-green-700 mt-1">دفعات سداد مسجلة</div>
              </div>

              <div className="card bg-orange-50 border-r-4 border-orange-500 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  ⏳ إجمالي الديون المستحقة
                </div>
                <div className="text-2xl font-extrabold text-orange-900 font-mono">
                  {formatCurrency(customStats.totalBalance || 0)}
                </div>
                <div className="text-xs text-orange-700 mt-1">المتبقي لصالح الموردين</div>
              </div>
            </div>
          )}

          {/* كروت تقرير العملاء */}
          {type === "customers" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card bg-indigo-50 border-r-4 border-indigo-600 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  📦 إجمالي قيمة أوردرات العملاء
                </div>
                <div className="text-2xl font-extrabold text-indigo-900 font-mono">
                  {formatCurrency(customStats.totalOrdersVal || 0)}
                </div>
                <div className="text-xs text-indigo-700 mt-1">عبر كافة الفروع والمعارض</div>
              </div>

              <div className="card bg-green-50 border-r-4 border-green-500 p-4 shadow-sm">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  💳 إجمالي التحصيلات والمدفوعات
                </div>
                <div className="text-2xl font-extrabold text-green-900 font-mono">
                  {formatCurrency(customStats.totalCollected || 0)}
                </div>
                <div className="text-xs text-green-700 mt-1">دفعات محصلة ومسجلة</div>
              </div>

              <div className="card bg-brand-orange text-white p-4 shadow-md">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  ⏳ إجمالي المتبقي على العملاء
                </div>
                <div className="text-2xl font-extrabold font-mono">
                  {formatCurrency(customStats.totalRemaining || 0)}
                </div>
                <div className="text-xs text-white/80 mt-1">مستحقات المصنع لدى العملاء</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* التابات الفرعية التفاعلية + شريط البحث وتصدير Excel */}
      {/* ============================================================ */}
      {generated && rawData.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {type === "inventory" && (
              <>
                <button
                  onClick={() => setSubFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "all"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  📦 كل المخزون ({rawData.length})
                </button>
                <button
                  onClick={() => setSubFilter("boards")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "boards"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  🪵 الألواح فقط ({rawData.filter((r) => r._cat === "boards").length})
                </button>
                <button
                  onClick={() => setSubFilter("accessories")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "accessories"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  🔩 الإكسسوارات فقط ({rawData.filter((r) => r._cat === "accessories").length})
                </button>
              </>
            )}

            {type === "cashflow" && (
              <>
                <button
                  onClick={() => setSubFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "all"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  💸 كل الحركات ({rawData.length})
                </button>
                <button
                  onClick={() => setSubFilter("factory")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "factory"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  👛 يومية المصنع ({rawData.filter((r) => r._wallet === "factory").length})
                </button>
                <button
                  onClick={() => setSubFilter("boards")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "boards"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  🪵 يومية الألواح ({rawData.filter((r) => r._wallet === "boards").length})
                </button>
              </>
            )}

            {type === "workers" && (
              <>
                <button
                  onClick={() => setSubFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "all"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  👥 كل البيانات ({rawData.length})
                </button>
                <button
                  onClick={() => setSubFilter("summary")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "summary"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  📊 ملخص إجمالي العمال ({rawData.filter((r) => r._sub === "summary").length})
                </button>
                <button
                  onClick={() => setSubFilter("logs")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "logs"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  📋 سجل اليوميات التفصيلي ({rawData.filter((r) => r._sub === "logs").length})
                </button>
              </>
            )}

            {type === "order_additions" && (
              <>
                <button
                  onClick={() => setSubFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "all"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  🧩 كل الإضافات ({rawData.length})
                </button>
                <button
                  onClick={() => setSubFilter("paints")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "paints"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  🎨 الدهانات ({rawData.filter((r) => r._sub === "paints").length})
                </button>
                <button
                  onClick={() => setSubFilter("led")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "led"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  💡 الليد ({rawData.filter((r) => r._sub === "led").length})
                </button>
                <button
                  onClick={() => setSubFilter("transport")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    subFilter === "transport"
                      ? "bg-brand-orange text-white shadow-xs"
                      : "bg-gray-50 border text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  🚚 النقل ومصاريف الطريق ({rawData.filter((r) => r._sub === "transport").length})
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mr-auto w-full sm:w-auto">
            {/* مربع بحث داخلي في الجدول */}
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="🔍 بحث سريع في النتائج..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-orange focus:bg-white transition"
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 font-bold whitespace-nowrap h-9"
            >
              <span>📥</span>
              <span>تصدير Excel</span>
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* جدول عرض النتائج التفصيلي مع فوتر المجاميع */}
      {/* ============================================================ */}
      {displayedData.length > 0 && (
        <div className="card overflow-hidden p-0 border border-gray-200 shadow-sm rounded-2xl bg-white mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100/80 text-gray-800 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 w-10">
                    #
                  </th>
                  {columns.map((k) => (
                    <th
                      key={k}
                      className="px-3 py-3 text-right font-extrabold text-xs whitespace-nowrap text-gray-700"
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedData.slice(0, 300).map((row, i) => (
                  <tr key={i} className="hover:bg-orange-50/30 transition">
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 font-mono">
                      {i + 1}
                    </td>
                    {columns.map((k) => {
                      const v = row[k];
                      const isMoney = moneyKeys.includes(k);
                      const isStatus = k === "الحالة" || k === "نوع التعامل" || k === "سفرية؟";
                      return (
                        <td
                          key={k}
                          className={`px-3 py-2.5 whitespace-nowrap ${
                            isMoney
                              ? "font-bold text-brand-orange-dark font-mono text-left"
                              : isStatus
                                ? "font-semibold"
                                : "text-gray-700"
                          }`}
                        >
                          {isMoney ? (
                            formatCurrency(fmtNum(v))
                          ) : isStatus ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs ${
                                v === "مكتمل" || v === "تم التسليم"
                                  ? "bg-green-100 text-green-800"
                                  : v === "قيد التنفيذ"
                                    ? "bg-blue-100 text-blue-800"
                                    : v === "✈️ نعم"
                                      ? "bg-amber-100 text-amber-800 font-bold"
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
              {/* فوتر مجاميع الأعمدة */}
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-extrabold text-xs text-gray-800">
                <tr>
                  <td className="px-3 py-3 text-center text-gray-500">Σ</td>
                  {columns.map((k) => {
                    const isMoney = moneyKeys.includes(k);
                    if (isMoney) {
                      return (
                        <td
                          key={k}
                          className="px-3 py-3 text-left font-mono font-bold text-brand-orange-dark text-sm whitespace-nowrap"
                        >
                          {formatCurrency(columnSums[k] || 0)}
                        </td>
                      );
                    }
                    if (k === columns[0]) {
                      return (
                        <td key={k} className="px-3 py-3 whitespace-nowrap text-gray-800">
                          الإجمالي ({displayedData.length} سجل)
                        </td>
                      );
                    }
                    return <td key={k} className="px-3 py-3"></td>;
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
          {displayedData.length > 300 && (
            <div className="p-3 text-center text-gray-500 text-xs bg-gray-50 border-t">
              ... تم عرض أول 300 سجل. اضغط "تصدير Excel" لعرض وتحميل كافة السجلات.
            </div>
          )}
        </div>
      )}

      {/* رسائل التنبيه عند عدم وجود بيانات أو قبل التوليد */}
      {!loading && generated && displayedData.length === 0 && (
        <div className="card text-center text-gray-400 py-14 bg-white border rounded-2xl shadow-xs">
          <div className="text-5xl mb-3">📭</div>
          <div className="font-extrabold text-gray-700 text-base">
            لا توجد بيانات مطابقة في هذا التقرير للفترة المحددة
          </div>
          <div className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            جرب تغيير نطاق التاريخ، إلغاء فلتر البحث، أو اختيار قسم آخر.
          </div>
        </div>
      )}

      {!generated && !loading && (
        <div className="card text-center text-gray-400 py-16 bg-white border rounded-2xl shadow-xs">
          <div className="text-6xl mb-3">📊</div>
          <div className="font-extrabold text-base text-gray-800">
            مركز التقارير والإحصائيات الشاملة
          </div>
          <div className="text-xs text-gray-400 mt-1 max-w-md mx-auto leading-relaxed">
            اختر نوع التقرير المطلوب من الكروت في الأعلى، وحدد الفترة الزمنية ثم اضغط زر "توليد التقرير" لاستعراض البيانات الدقيقة وتصديرها.
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

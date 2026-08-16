"use client";
import { useState, useMemo } from "react";
import { useUserStore } from "@/store/user-store";
import { useApiMutation } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency, formatDateShort } from "@/lib/format";
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
}

const REPORT_CONFIG: Record<ReportType, ReportConfigItem> = {
  inventory: {
    label: "تقرير المخزون والجرد",
    icon: "📦",
    needsDate: true,
    desc: "جرد شامل للألواح والإكسسوارات وقيمة المتبقي بالتاريخ",
  },
  orders: {
    label: "تقرير الأوردرات والتكاليف",
    icon: "📋",
    needsDate: true,
    desc: "تكاليف المصنع والأوردرات مفصولة عن الأعمال الخارجية",
  },
  cashflow: {
    label: "التدفق النقدي واليوميات",
    icon: "💸",
    needsDate: true,
    desc: "حركات النقدية مع فصل يومية المصنع عن يومية الألواح",
  },
  overhead: {
    label: "تقرير النثريات العامة",
    icon: "📄",
    needsDate: true,
    desc: "مصاريف تشغيل المصنع العامة فقط (بدون أجور عمال)",
  },
  workers: {
    label: "تقرير أجور ويوميات العمال",
    icon: "🧑‍🔧",
    needsDate: true,
    desc: "تفاصيل يوميات وسفريات وأجور العمال والتسويات",
  },
  contractors: {
    label: "تقرير المقاولين والورش",
    icon: "🔨",
    needsDate: true,
    desc: "كل الأعمال الخارجية المسندة للورش والمقاولين",
  },
  order_additions: {
    label: "تقرير إضافات الأوردرات",
    icon: "🧩",
    needsDate: true,
    desc: "مصاريف الدهانات، الليد، والنقل الداخلي ومصاريف الطريق",
  },
  suppliers: {
    label: "تقرير الموردين والمشتريات",
    icon: "🏭",
    needsDate: true,
    desc: "إجمالي المشتريات والمدفوعات والمتبقي لكل مورد",
  },
  customers: {
    label: "تقرير العملاء والتحصيلات",
    icon: "👥",
    needsDate: false,
    desc: "قيمة أوردرات العملاء والمدفوعات والمتبقي عليهم",
  },
};

function cleanDate(v: any): string {
  if (!v) return "-";
  const s = String(v).slice(0, 10);
  if (!s || s === "null") return "-";
  try {
    return formatDateShort(s);
  } catch {
    return s;
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

  // Sub-filter tabs
  const [subFilter, setSubFilter] = useState("all");

  // Raw raw data fetched
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Extra KPI stats
  const [customStats, setCustomStats] = useState<Record<string, any>>({});

  const { mutate } = useApiMutation();
  const config = REPORT_CONFIG[type];

  // ============================================================
  // توليد البيانات
  // ============================================================
  async function generate() {
    setLoading(true);
    setGenerated(true);
    setSubFilter("all");
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
            "تاريخ الإضافة": cleanDate(x.date_added || x.created_at),
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
            "تاريخ الإضافة": cleanDate(x.date_added || x.created_at),
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
            "تاريخ البدء": cleanDate(x.start_date),
            "تاريخ الانتهاء": cleanDate(x.end_date),
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
            التاريخ: cleanDate(x.date),
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
            التاريخ: cleanDate(x.date),
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
            "آخر يومية مسجلة": s.lastDate ? cleanDate(s.lastDate) : "-",
          };
        });

        const detailedLogRows = logs.map((l: any) => ({
          _sub: "logs",
          التاريخ: cleanDate(l.work_date),
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
            التاريخ: cleanDate(x.created_at),
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
            التاريخ: cleanDate(x.date || x.created_at),
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
            التاريخ: cleanDate(x.date || x.created_at),
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
            التاريخ: cleanDate(x.date || x.created_at),
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
  // تصفية العرض بناءً على التاب الداخلي (Sub-Filter)
  // ============================================================
  const displayedData = useMemo(() => {
    if (!rawData.length) return [];
    if (subFilter === "all") return rawData;

    if (type === "inventory") {
      return rawData.filter((r) => r._cat === subFilter);
    }
    if (type === "cashflow") {
      return rawData.filter((r) => r._wallet === subFilter);
    }
    if (type === "workers") {
      return rawData.filter((r) => r._sub === subFilter);
    }
    if (type === "order_additions") {
      return rawData.filter((r) => r._sub === subFilter);
    }
    return rawData;
  }, [rawData, subFilter, type]);

  // استخراج أسماء الأعمدة المعروضة النظيفة (بدون المفاتيح المخفية _cat, _wallet, _sub)
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

  function changeType(newType: ReportType) {
    setType(newType);
    setRawData([]);
    setGenerated(false);
    setSubFilter("all");
    setCustomStats({});
  }

  function handleExportExcel() {
    // تنظيف البيانات من المفاتيح الداخلية قبل التصدير
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
        title="التقارير الشاملة"
        subtitle="استخراج بيانات تفصيلية متكاملة وتصديرها Excel"
        helpTitle="التقارير"
        helpDescription="اختر نوع التقرير المطلوب، حدد الفترة الزمنية بالتاريخ، واضغط 'توليد' لعرض الإحصائيات الشاملة والجداول التفصيلية."
        backHref="/journal"
      />

      {/* كروت اختيار نوع التقرير */}
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
              className={`p-3 rounded-xl text-right transition-all flex flex-col justify-between ${
                isSelected
                  ? "bg-brand-orange text-white shadow-md scale-[1.02] border-brand-orange"
                  : "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50"
              }`}
            >
              <div className="text-2xl mb-1.5">{cfg.icon}</div>
              <div>
                <div className="font-bold text-xs leading-tight mb-0.5">
                  {cfg.label}
                </div>
                <div
                  className={`text-[10px] line-clamp-1 ${isSelected ? "text-white/80" : "text-gray-400"}`}
                >
                  {cfg.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* لوحة فلترة التاريخ وزر التوليد */}
      <div className="card mb-5 bg-white border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4 border-b pb-3">
          <span className="text-3xl">{config.icon}</span>
          <div>
            <div className="font-bold text-base text-brand-black">
              {config.label}
            </div>
            <div className="text-xs text-gray-500">{config.desc}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              من تاريخ
            </label>
            <DateInput
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="يوم / شهر / سنة"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              إلى تاريخ
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
              className="w-full h-10 font-bold"
            >
              {loading ? "⏳ جاري استخراج التقرير..." : `🔍 توليد ${config.label}`}
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
              <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-r-4 border-amber-500 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🪵 قيمة مخزون الألواح المتبقي
                </div>
                <div className="text-2xl font-extrabold text-amber-900">
                  {formatCurrency(customStats.boardsVal || 0)}
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  الكمية المتبقية: <strong>{customStats.boardsQty || 0}</strong> لوح
                </div>
              </div>

              <div className="card bg-gradient-to-br from-rose-50 to-pink-50 border-r-4 border-rose-500 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🔩 قيمة مخزون الإكسسوارات المتبقي
                </div>
                <div className="text-2xl font-extrabold text-rose-900">
                  {formatCurrency(customStats.accVal || 0)}
                </div>
                <div className="text-xs text-rose-700 mt-1">
                  الكمية المتبقية: <strong>{customStats.accQty || 0}</strong> قطعة
                </div>
              </div>

              <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-4">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  📦 إجمالي القيمة العامة لمخزون المصنع
                </div>
                <div className="text-2xl font-extrabold">
                  {formatCurrency(customStats.totalVal || 0)}
                </div>
                <div className="text-xs text-white/80 mt-1">
                  إجمالي الأصناف: <strong>{rawData.length}</strong> صنف مسجل
                </div>
              </div>
            </div>
          )}

          {/* كروت تقرير الأوردرات والتكاليف */}
          {type === "orders" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-r-4 border-indigo-600 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  📦 تكلفة المصنع للأوردرات (بدون مقاولين)
                </div>
                <div className="text-2xl font-extrabold text-indigo-900">
                  {formatCurrency(customStats.factoryTotal || 0)}
                </div>
                <div className="text-xs text-indigo-700 mt-1">
                  تشمل الخامات والتركيبات والنقل واليوميات والدهانات والليد
                </div>
              </div>

              <div className="card bg-gradient-to-br from-amber-50 to-yellow-50 border-r-4 border-amber-500 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🔨 إجمالي الأعمال الخارجية (المقاولين والورش)
                </div>
                <div className="text-2xl font-extrabold text-amber-900">
                  {formatCurrency(customStats.externalTotal || 0)}
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  مستقلة للورش الخارجية (ألوميتال، تنجيد، إلخ)
                </div>
              </div>

              <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-4">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  💰 الإجمالي الشامل لكافة الأوردرات
                </div>
                <div className="text-2xl font-extrabold">
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
              <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 border-r-4 border-emerald-600 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  👛 صافي يومية المصنع
                </div>
                <div className="text-2xl font-extrabold text-emerald-900">
                  {formatCurrency(customStats.factoryNet || 0)}
                </div>
                <div className="text-xs text-emerald-700 mt-1">
                  وارد: {formatCurrency(customStats.factoryIncome || 0)} − مصروف: {formatCurrency(customStats.factoryExpense || 0)}
                </div>
              </div>

              <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-r-4 border-amber-600 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🪵 صافي يومية الألواح
                </div>
                <div className="text-2xl font-extrabold text-amber-900">
                  {formatCurrency(customStats.boardsNet || 0)}
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  تمريري: {formatCurrency(customStats.boardsIncome || 0)} − مشتريات: {formatCurrency(customStats.boardsExpense || 0)}
                </div>
              </div>

              <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white p-4">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  💵 صافي التدفق النقدي الشامل
                </div>
                <div className="text-2xl font-extrabold">
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
              <div className="card bg-purple-50 border-r-4 border-purple-600 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  📄 إجمالي النثريات العامة للمصنع
                </div>
                <div className="text-2xl font-extrabold text-purple-900">
                  {formatCurrency(customStats.totalOverhead || 0)}
                </div>
                <div className="text-xs text-purple-700 mt-1">
                  كهرباء، شحن، صيانة دورية، بوفيه ونثريات تشغيل
                </div>
              </div>

              <div className="card bg-gray-50 border border-gray-200 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🧾 عدد الحركات المسجلة
                </div>
                <div className="text-2xl font-extrabold text-gray-900">
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
              <div className="card bg-orange-50 border-r-4 border-orange-500 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🧑‍🔧 إجمالي أجور ويوميات العمال
                </div>
                <div className="text-2xl font-extrabold text-orange-900">
                  {formatCurrency(customStats.totalLogsAmount || 0)}
                </div>
                <div className="text-xs text-orange-700 mt-1">
                  إجمالي سجلات اليوميات: {customStats.logsCount || 0} يومية
                </div>
              </div>

              <div className="card bg-amber-50 border-r-4 border-amber-500 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  ✈️ إجمالي أيام السفر
                </div>
                <div className="text-2xl font-extrabold text-amber-900">
                  {customStats.totalTravelDays || 0} يوم
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  أيام عمل تم احتساب يومية سفر عليها
                </div>
              </div>

              <div className="card bg-gray-50 border border-gray-200 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  👥 عدد العمال
                </div>
                <div className="text-2xl font-extrabold text-gray-900">
                  {customStats.workersCount || 0} عامل
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  المسجلين في النظام
                </div>
              </div>
            </div>
          )}

          {/* كروت تقرير المقاولين */}
          {type === "contractors" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="card bg-indigo-50 border-r-4 border-indigo-600 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🔨 إجمالي الأعمال الخارجية للمقاولين
                </div>
                <div className="text-2xl font-extrabold text-indigo-900">
                  {formatCurrency(customStats.totalContractorsAmount || 0)}
                </div>
                <div className="text-xs text-indigo-700 mt-1">
                  مستحقات الورش والمقاولين المسندة من الأوردرات
                </div>
              </div>

              <div className="card bg-gray-50 border border-gray-200 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  📋 عدد العمليات الخارجية
                </div>
                <div className="text-2xl font-extrabold text-gray-900">
                  {customStats.count || 0} عملية
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  ألوميتال، تنجيد، وغيرها
                </div>
              </div>
            </div>
          )}

          {/* كروت تقرير إضافات الأوردرات */}
          {type === "order_additions" && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="card bg-fuchsia-50 border-r-4 border-fuchsia-500 p-3">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🎨 مصاريف الدهانات
                </div>
                <div className="text-xl font-extrabold text-fuchsia-900">
                  {formatCurrency(customStats.paintsTotal || 0)}
                </div>
              </div>

              <div className="card bg-yellow-50 border-r-4 border-yellow-500 p-3">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  💡 مصاريف الليد
                </div>
                <div className="text-xl font-extrabold text-yellow-900">
                  {formatCurrency(customStats.ledTotal || 0)}
                </div>
              </div>

              <div className="card bg-sky-50 border-r-4 border-sky-500 p-3">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🚚 النقل ومصاريف الطريق
                </div>
                <div className="text-xl font-extrabold text-sky-900">
                  {formatCurrency(customStats.transportTotal || 0)}
                </div>
              </div>

              <div className="card bg-brand-orange text-white p-3">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  ➕ إجمالي الإضافات
                </div>
                <div className="text-xl font-extrabold">
                  {formatCurrency(customStats.additionsTotal || 0)}
                </div>
              </div>
            </div>
          )}

          {/* كروت تقرير الموردين */}
          {type === "suppliers" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card bg-red-50 border-r-4 border-red-500 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  🏭 إجمالي المشتريات من الموردين
                </div>
                <div className="text-2xl font-extrabold text-red-900">
                  {formatCurrency(customStats.totalPurchases || 0)}
                </div>
                <div className="text-xs text-red-700 mt-1">ألواح وإكسسوارات</div>
              </div>

              <div className="card bg-green-50 border-r-4 border-green-500 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  💳 إجمالي المدفوعات للموردين
                </div>
                <div className="text-2xl font-extrabold text-green-900">
                  {formatCurrency(customStats.totalPayments || 0)}
                </div>
                <div className="text-xs text-green-700 mt-1">دفعات سداد مسجلة</div>
              </div>

              <div className="card bg-orange-50 border-r-4 border-orange-500 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  ⏳ إجمالي الديون المستحقة
                </div>
                <div className="text-2xl font-extrabold text-orange-900">
                  {formatCurrency(customStats.totalBalance || 0)}
                </div>
                <div className="text-xs text-orange-700 mt-1">المتبقي لصالح الموردين</div>
              </div>
            </div>
          )}

          {/* كروت تقرير العملاء */}
          {type === "customers" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card bg-indigo-50 border-r-4 border-indigo-600 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  📦 إجمالي قيمة أوردرات العملاء
                </div>
                <div className="text-2xl font-extrabold text-indigo-900">
                  {formatCurrency(customStats.totalOrdersVal || 0)}
                </div>
                <div className="text-xs text-indigo-700 mt-1">عبر كافة الفروع والمعارض</div>
              </div>

              <div className="card bg-green-50 border-r-4 border-green-500 p-4">
                <div className="text-xs text-gray-600 font-semibold mb-1">
                  💳 إجمالي التحصيلات والمدفوعات
                </div>
                <div className="text-2xl font-extrabold text-green-900">
                  {formatCurrency(customStats.totalCollected || 0)}
                </div>
                <div className="text-xs text-green-700 mt-1">دفعات محصلة ومسجلة</div>
              </div>

              <div className="card bg-brand-orange text-white p-4">
                <div className="text-xs text-white/90 font-semibold mb-1">
                  ⏳ إجمالي المتبقي على العملاء
                </div>
                <div className="text-2xl font-extrabold">
                  {formatCurrency(customStats.totalRemaining || 0)}
                </div>
                <div className="text-xs text-white/80 mt-1">مستحقات المصنع لدى العملاء</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* التابات الفرعية التفاعلية للتقرير (Sub-Filter Tabs) */}
      {/* ============================================================ */}
      {generated && rawData.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {type === "inventory" && (
              <>
                <button
                  onClick={() => setSubFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "all" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  📦 كل المخزون ({rawData.length})
                </button>
                <button
                  onClick={() => setSubFilter("boards")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "boards" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  🪵 الألواح فقط ({rawData.filter((r) => r._cat === "boards").length})
                </button>
                <button
                  onClick={() => setSubFilter("accessories")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "accessories" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  🔩 الإكسسوارات فقط ({rawData.filter((r) => r._cat === "accessories").length})
                </button>
              </>
            )}

            {type === "cashflow" && (
              <>
                <button
                  onClick={() => setSubFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "all" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  💸 كل الحركات ({rawData.length})
                </button>
                <button
                  onClick={() => setSubFilter("factory")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "factory" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  👛 يومية المصنع ({rawData.filter((r) => r._wallet === "factory").length})
                </button>
                <button
                  onClick={() => setSubFilter("boards")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "boards" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  🪵 يومية الألواح ({rawData.filter((r) => r._wallet === "boards").length})
                </button>
              </>
            )}

            {type === "workers" && (
              <>
                <button
                  onClick={() => setSubFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "all" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  👥 كل البيانات
                </button>
                <button
                  onClick={() => setSubFilter("summary")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "summary" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  📊 ملخص إجمالي العمال
                </button>
                <button
                  onClick={() => setSubFilter("logs")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "logs" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  📋 سجل اليوميات التفصيلي
                </button>
              </>
            )}

            {type === "order_additions" && (
              <>
                <button
                  onClick={() => setSubFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "all" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  🧩 كل الإضافات ({rawData.length})
                </button>
                <button
                  onClick={() => setSubFilter("paints")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "paints" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  🎨 الدهانات ({rawData.filter((r) => r._sub === "paints").length})
                </button>
                <button
                  onClick={() => setSubFilter("led")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "led" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  💡 الليد ({rawData.filter((r) => r._sub === "led").length})
                </button>
                <button
                  onClick={() => setSubFilter("transport")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${subFilter === "transport" ? "bg-brand-orange text-white shadow-sm" : "bg-white border text-gray-700 hover:bg-gray-50"}`}
                >
                  🚚 النقل ومصاريف الطريق ({rawData.filter((r) => r._sub === "transport").length})
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mr-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 font-bold"
            >
              <span>📥</span>
              <span>تصدير Excel</span>
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* جدول عرض النتائج التفصيلي */}
      {/* ============================================================ */}
      {displayedData.length > 0 && (
        <div className="card overflow-hidden p-0 border border-gray-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-800 border-b border-gray-200">
                <tr>
                  {columns.map((k) => (
                    <th
                      key={k}
                      className="px-3 py-3 text-right font-bold text-xs whitespace-nowrap"
                    >
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedData.slice(0, 300).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition">
                    {columns.map((k) => {
                      const v = row[k];
                      const isMoney = moneyKeys.includes(k);
                      const isDateCol =
                        k.includes("تاريخ") || k.includes("آخر");
                      return (
                        <td
                          key={k}
                          className={`px-3 py-2.5 whitespace-nowrap ${
                            isMoney
                              ? "font-bold text-brand-orange-dark"
                              : "text-gray-700"
                          }`}
                        >
                          {isMoney
                            ? formatCurrency(fmtNum(v))
                            : isDateCol
                              ? cleanDate(v)
                              : (v ?? "-")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {displayedData.length > 300 && (
            <div className="p-3 text-center text-gray-400 text-xs bg-gray-50 border-t">
              ... تم عرض أول 300 سجل. اضغط "تصدير Excel" لعرض وتحميل كافة السجلات.
            </div>
          )}
        </div>
      )}

      {/* رسائل التنبيه عند عدم وجود بيانات أو قبل التوليد */}
      {!loading && generated && displayedData.length === 0 && (
        <div className="card text-center text-gray-400 py-12 bg-white border">
          <div className="text-5xl mb-3">📭</div>
          <div className="font-bold text-gray-600">
            لا توجد بيانات مطابقة في هذا التقرير للفترة المحددة
          </div>
          <div className="text-xs text-gray-400 mt-1">
            جرب تغيير نطاق التاريخ أو اختيار قسم آخر.
          </div>
        </div>
      )}

      {!generated && !loading && (
        <div className="card text-center text-gray-400 py-16 bg-white border">
          <div className="text-6xl mb-3">📊</div>
          <div className="font-bold text-base text-gray-700">
            مركز التقارير والإحصائيات الشاملة
          </div>
          <div className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            اختر نوع التقرير المطلوب من الكروت في الأعلى، وحدد الفترة الزمنية ثم اضغط زر "توليد التقرير" لاستعراض البيانات الدقيقة وتصديرها.
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

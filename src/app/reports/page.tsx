"use client";
import { useState } from "react";
import { useUserStore } from "@/store/user-store";
import { useApiMutation } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/format";

type ReportType = "inventory" | "orders" | "cashflow" | "suppliers" | "overhead" | "workers" | "customers";

const REPORT_CONFIG: Record<ReportType, { label: string; icon: string; needsDate: boolean; desc: string }> = {
  inventory: { label: "تقرير المخزون", icon: "📦", needsDate: false, desc: "كل أصناف الألواح والاكسسوارات مع قيمة المتبقي" },
  orders: { label: "تقرير الأوردرات", icon: "📋", needsDate: true, desc: "كل الأوردرات مع التفاصيل والإجمالي" },
  cashflow: { label: "التدفق النقدي", icon: "💸", needsDate: true, desc: "كل الحركات المالية (وارد/مصروف/دفوعات)" },
  suppliers: { label: "تقرير الموردين", icon: "🏭", needsDate: false, desc: "إجمالي المشتريات من كل مورد" },
  overhead: { label: "تقرير النثريات", icon: "📄", needsDate: true, desc: "كل النثريات والأجور" },
  workers: { label: "تقرير العمال (الأجور)", icon: "🧑‍🔧", needsDate: true, desc: "إجمالي الأجور لكل عامل" },
  customers: { label: "تقرير العملاء", icon: "👥", needsDate: false, desc: "العملاء وأوردراتهم" },
};

// تنسيق التاريخ بشكل نظيف بدون الوقت
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

// تنسيق القيمة الرقمية
function fmtNum(v: any): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export default function ReportsPage() {
  const { user: profile } = useUserStore();
  const [type, setType] = useState<ReportType>("inventory");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [moneyKeys, setMoneyKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const { mutate } = useApiMutation();

  const config = REPORT_CONFIG[type];

  async function generate() {
    setLoading(true);
    setGenerated(true);
    let result: any[] = [];

    if (type === "inventory") {
      const [{ data: b }, { data: a }] = await Promise.all([
        mutate('GET', '/api/boards?limit=500'),
        mutate('GET', '/api/accessories?limit=500'),
      ]);
      const boards = b?.items ?? b ?? [];
      const accessories = a?.items ?? a ?? [];
      result = [
        ...(boards).map((x: any) => ({
          الفئة: "لوح", الاسم: x.item_name ?? "", الكود: x.code ?? "-", الخامة: x.material_type ?? "",
          المورد: x.supplier_name ?? "", "سعر الوحدة": fmtNum(x.unit_price), الداخل: fmtNum(x.quantity_in),
          المستخدم: fmtNum(x.quantity_used ?? 0), المتبقي: fmtNum(x.quantity_remaining ?? 0),
          "قيمة المتبقي": fmtNum(x.unit_price) * fmtNum(x.quantity_remaining ?? 0),
        })),
        ...(accessories).map((x: any) => ({
          الفئة: "اكسسوار", الاسم: x.item_name ?? "", الكود: x.code ?? "-", النوع: x.type ?? "",
          المورد: x.supplier_name ?? "", "سعر الوحدة": fmtNum(x.unit_price), الداخل: fmtNum(x.quantity_in),
          المستخدم: fmtNum(x.quantity_used ?? 0), المتبقي: fmtNum(x.quantity_remaining ?? 0),
          "قيمة المتبقي": fmtNum(x.unit_price) * fmtNum(x.quantity_remaining ?? 0),
        })),
      ];
    } else if (type === "orders") {
      const { data: o } = await mutate('GET', `/api/orders?limit=500${fromDate ? '&from_date=' + fromDate : ''}${toDate ? '&to_date=' + toDate : ''}`);
      const orders = o?.items ?? o ?? [];
      result = (orders).map((x: any) => ({
        "اسم الأوردر": x.order_name ?? "", العميل: x.customer_name ?? "-", المعرض: x.branch_name ?? "-",
        الحالة: x.status ?? "", النوع: x.order_type ?? "",
        "تاريخ البدء": x.start_date ? formatDateShort(x.start_date) : "-",
        "تاريخ الانتهاء": x.end_date ? formatDateShort(x.end_date) : "-",
        المدة: x.duration_days ? x.duration_days + " يوم" : "-",
        الإجمالي: fmtNum(x.order_total ?? x.total ?? 0),
        "تكلفة الألواح": fmtNum(x.boards_cost ?? 0),
        "تكلفة الاكسسوارات": fmtNum(x.accessories_cost ?? 0),
        "أعمال خارجية": fmtNum(x.external_work_total ?? 0),
      }));
    } else if (type === "cashflow") {
      const { data: j } = await mutate('GET', `/api/journal?limit=500${fromDate ? '&from_date=' + fromDate : ''}${toDate ? '&to_date=' + toDate : ''}`);
      const entries = j?.entries ?? j ?? [];
      result = (entries).map((x: any) => ({
        التاريخ: cleanDate(x.date),
        النوع: x.entry_type ?? "",
        البيان: x.description ?? "",
        الجهة: x.party_name ?? "-",
        "طريقة الدفع": x.payment_method ?? "-",
        المبلغ: fmtNum(x.amount),
      }));
    } else if (type === "suppliers") {
      const [{ data: s }, { data: p }] = await Promise.all([
        mutate('GET', '/api/suppliers?limit=500'),
        mutate('GET', `/api/journal?limit=1000&entry_type=مشتريات${fromDate ? '&from_date=' + fromDate : ''}${toDate ? '&to_date=' + toDate : ''}`),
      ]);
      const suppliers = s?.items ?? s ?? [];
      const purchases = p?.entries ?? p ?? [];
      const totals: Record<string, number> = {};
      (purchases).forEach((x: any) => { if (x.party_id) totals[String(x.party_id)] = (totals[String(x.party_id)] || 0) + fmtNum(x.amount); });
      result = (suppliers).map((x: any) => ({
        الاسم: x.name ?? "", "نوع التعامل": x.payment_type ?? "-", الهاتف: x.phone ?? "-",
        "إجمالي المشتريات": fmtNum(totals[String(x.id)] || 0),
      }));
    } else if (type === "overhead") {
      const { data: o } = await mutate('GET', `/api/overhead?limit=1000${fromDate ? '&from_date=' + fromDate : ''}${toDate ? '&to_date=' + toDate : ''}`);
      const items = o?.expenses ?? o?.items ?? o ?? [];
      result = (items).map((x: any) => ({
        التاريخ: cleanDate(x.date),
        التصنيف: x.category ?? "-",
        البيان: x.description ?? "",
        العامل: x.worker?.name ?? "-",
        المبلغ: fmtNum(x.amount),
        ملاحظات: x.notes ?? "-",
      }));
    } else if (type === "workers") {
      const [{ data: w }, { data: o }] = await Promise.all([
        mutate('GET', '/api/workers?limit=500'),
        mutate('GET', `/api/overhead?limit=2000${fromDate ? '&from_date=' + fromDate : ''}${toDate ? '&to_date=' + toDate : ''}`),
      ]);
      const workers = w?.items ?? w ?? [];
      const expenses = o?.expenses ?? o?.items ?? o ?? [];
      const byWorker: Record<string, { count: number; total: number; last: string }> = {};
      for (const e of expenses) {
        if (!e.worker_id) continue;
        const wid = String(e.worker_id);
        if (!byWorker[wid]) byWorker[wid] = { count: 0, total: 0, last: "" };
        byWorker[wid].count += 1;
        byWorker[wid].total += fmtNum(e.amount);
        const d = String(e.date).slice(0, 10);
        if (d > byWorker[wid].last) byWorker[wid].last = d;
      }
      result = (workers).map((x: any) => {
        const s = byWorker[String(x.id)] || { count: 0, total: 0, last: "" };
        return {
          الاسم: x.name ?? "", الهاتف: x.phone ?? "-",
          "عدد المصروفات": s.count,
          "إجمالي الأجور": fmtNum(s.total),
          "آخر صرف": s.last ? formatDateShort(s.last) : "-",
        };
      });
    } else if (type === "customers") {
      const { data: c } = await mutate('GET', '/api/customers?limit=500');
      const { data: o } = await mutate('GET', '/api/orders?limit=1000');
      const customers = c?.items ?? c ?? [];
      const orders = o?.items ?? o ?? [];
      const orderStats: Record<string, { count: number; total: number }> = {};
      (orders).forEach((ord: any) => {
        if (!ord.customer_id) return;
        const cid = String(ord.customer_id);
        if (!orderStats[cid]) orderStats[cid] = { count: 0, total: 0 };
        orderStats[cid].count += 1;
        orderStats[cid].total += fmtNum(ord.order_total ?? ord.total ?? 0);
      });
      result = (customers).map((x: any) => {
        const s = orderStats[String(x.id)] || { count: 0, total: 0 };
        return {
          الاسم: x.name ?? "", الهاتف: x.phone ?? "-",
          "عدد الأوردرات": s.count,
          "إجمالي الأوردرات": fmtNum(s.total),
        };
      });
    }

    setData(result);
    if (result.length > 0) {
      const cols = Object.keys(result[0]);
      setColumns(cols);
      // حدد المفاتيح اللي فيها فلوس
      setMoneyKeys(cols.filter(k =>
        k.includes("قيمة") || k.includes("إجمالي") || k.includes("المبلغ") ||
        k.includes("تكلفة") || k.includes("سعر") || k.includes("الأجور") ||
        k.includes("المشتريات") || k.includes("أعمال خارجية")
      ));
    } else {
      setColumns([]);
      setMoneyKeys([]);
    }
    setLoading(false);
  }

  if (!profile) return null;

  // حساب الإجمالي
  const totalKey = moneyKeys.length > 0
    ? moneyKeys.find(k => k.includes("قيمة المتبقي") || k === "إجمالي" || k === "المبلغ" || k.includes("المشتريات") || k.includes("الأجور") || k.includes("الأوردرات")) || moneyKeys[0]
    : null;
  const total = totalKey ? data.reduce((s, r) => s + fmtNum(r[totalKey]), 0) : 0;

  function changeType(newType: ReportType) {
    setType(newType);
    setData([]);
    setColumns([]);
    setMoneyKeys([]);
    setGenerated(false);
  }

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="التقارير"
        subtitle="استخراج بيانات تفصيلية وتصديرها Excel"
        helpTitle="التقارير"
        helpDescription="اختار نوع التقرير، حدد الفترة (لو التقرير بيحتاج تاريخ)، اضغط 'توليد'، ثم 'تصدير Excel' لتحميله."
        backHref="/journal"
      />

      {/* اختيار نوع التقرير - كاردات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {(Object.entries(REPORT_CONFIG) as [ReportType, typeof REPORT_CONFIG[ReportType]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => changeType(key)}
            className={`card text-right transition-all hover:shadow-elevated ${type === key ? "border-2 border-brand-orange bg-brand-orange-light ring-2 ring-brand-orange/20" : "bg-white border border-gray-100"}`}
          >
            <div className="text-3xl mb-1">{cfg.icon}</div>
            <div className="font-bold text-sm text-brand-black">{cfg.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{cfg.desc}</div>
          </button>
        ))}
      </div>

      {/* لوحة التحكم في التقرير */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <div className="font-bold text-brand-black">{config.label}</div>
            <div className="text-xs text-gray-500">{config.desc}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {config.needsDate && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">من تاريخ</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">إلى تاريخ</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg" />
              </div>
            </>
          )}
          <div className={config.needsDate ? "" : "col-span-2 lg:col-span-4 flex items-end"}>
            <Button onClick={generate} loading={loading} className="w-full">
              {loading ? "⏳ جاري التوليد..." : `🔍 توليد ${config.label}`}
            </Button>
          </div>
        </div>

        {/* شريط الإجمالي */}
        {data.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="bg-gray-50 px-3 py-1.5 rounded-lg">
                عدد السجلات: <strong className="text-brand-black">{data.length}</strong>
              </div>
              {totalKey && (
                <div className="bg-brand-orange-light px-3 py-1.5 rounded-lg">
                  الإجمالي ({totalKey}): <strong className="text-brand-orange-dark">{formatCurrency(total)}</strong>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {(fromDate || toDate) && (
                <span className="text-xs text-gray-500 self-center">
                  الفترة: {fromDate ? formatDateShort(fromDate) : "البداية"} ← {toDate ? formatDateShort(toDate) : "اليوم"}
                </span>
              )}
              <Button variant="secondary" onClick={() => exportToExcel(data, `report_${type}_${new Date().toISOString().slice(0, 10)}`)}>📥 تصدير Excel</Button>
            </div>
          </div>
        )}
      </div>

      {/* جدول النتائج */}
      {data.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map(k => (
                    <th key={k} className="px-3 py-3 text-right font-bold text-xs text-gray-700 whitespace-nowrap">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {columns.map(k => {
                      const v = row[k];
                      const isMoney = moneyKeys.includes(k);
                      const isDateCol = k.includes("تاريخ") || k.includes("آخر");
                      return (
                        <td key={k} className={`px-3 py-2 whitespace-nowrap ${isMoney ? "font-bold text-brand-orange-dark" : ""}`}>
                          {isMoney ? formatCurrency(fmtNum(v)) : isDateCol ? cleanDate(v) : (v ?? "-")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              {totalKey && data.length > 0 && (
                <tfoot className="bg-brand-orange-light font-bold">
                  <tr>
                    <td colSpan={Math.max(1, columns.indexOf(totalKey))} className="px-3 py-3 text-brand-orange-dark">الإجمالي ({data.length} سجل)</td>
                    <td className="px-3 py-3 text-brand-orange-dark text-lg">{formatCurrency(total)}</td>
                    {columns.length > columns.indexOf(totalKey) + 1 && <td colSpan={columns.length - columns.indexOf(totalKey) - 1} className="px-3 py-3"></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {data.length > 100 && <div className="p-3 text-center text-gray-400 text-sm bg-gray-50">... و{data.length - 100} سجل آخر. صدّر Excel لعرض الكل.</div>}
        </div>
      )}

      {!loading && generated && data.length === 0 && (
        <div className="card text-center text-gray-400 py-12">
          <div className="text-5xl mb-3">📭</div>
          <div>لا توجد بيانات في هذا التقرير للفترة المحددة</div>
        </div>
      )}

      {!generated && !loading && (
        <div className="card text-center text-gray-400 py-12">
          <div className="text-5xl mb-3">📊</div>
          <div>اختر نوع التقرير واضغط "توليد"</div>
        </div>
      )}
    </DashboardLayout>
  );
}

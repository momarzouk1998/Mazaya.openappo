"use client";
import { useMemo, useState } from "react";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { SearchBox } from "@/components/SearchFilter";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency, formatDate, ENTRY_TYPE_LABELS, ENTRY_TYPE_COLORS, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { calcIncome, calcExpense, calcPayout, calcOpeningBalance, calcClosingBalance, dateKey } from "@/lib/finance";
import { canSeeModule } from "@/lib/auth";
import RowEditor, { type FieldDef } from "@/components/ui/RowEditor";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import {
  BoardPurchasePanel,
  AccessoryPurchasePanel,
  OverheadPanel,
  IncomePanel,
  InventorySearchPanel,
  WorkersReportPanel,
} from "@/app/journal/_panels";

const journalFields: FieldDef[] = [
  { name: "date", label: "التاريخ", type: "date", required: true },
  { name: "entry_type", label: "نوع الحركة", options: Object.entries(ENTRY_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })), required: true },
  { name: "description", label: "البيان", required: true },
  { name: "amount", label: "المبلغ", type: "number", required: true },
  { name: "payment_method", label: "طريقة الدفع", options: [{ value: "نقدي", label: "نقدي" }, { value: "تحويل", label: "تحويل" }] },
  { name: "notes", label: "ملاحظات", rows: 2 },
];

type PanelKey =
  | "board" | "accessory" | "overhead" | "income"
  | "search" | "workers" | "today" | "filter" | null;

interface ActionBtn { key: PanelKey; icon: string; label: string; color: string; }

const ACTIONS: ActionBtn[] = [
  { key: "board", icon: "🪵", label: "شراء ألواح", color: "border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white" },
  { key: "accessory", icon: "🔩", label: "شراء إكسسوارات", color: "border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white" },
  { key: "overhead", icon: "💵", label: "نثريات / أجور عمال", color: "border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white" },
  { key: "income", icon: "📥", label: "دفعة من معرض", color: "border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white" },
  { key: "search", icon: "🔍", label: "بحث في المخزن", color: "border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white" },
  { key: "today", icon: "📅", label: "تقرير اليوم", color: "border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white" },
  { key: "workers", icon: "🧑‍🔧", label: "تقرير العمال", color: "border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white" },
  { key: "filter", icon: "📋", label: "الحركات المالية", color: "border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white" },
];

const PANEL_TITLES: Record<Exclude<PanelKey, null>, string> = {
  board: "🪵 شراء ألواح",
  accessory: "🔩 شراء إكسسوارات",
  overhead: "💵 نثريات / أجور عمال",
  income: "📥 دفعة من معرض",
  search: "🔍 بحث في المخزن",
  workers: "🧑‍🔧 تقرير العمال",
  today: "📅 تقرير اليوم",
  filter: "📋 الحركات المالية",
};

export default function JournalPageWrapper({ showSummary = false }: { showSummary?: boolean }) {
  const { user: profile } = useUserStore();
  const { data, loading, refetch } = useApi<{ entries: any[] }>("/api/journal?limit=500");
  const { data: boardsData } = useApi<{ items: any[] }>("/api/boards?limit=500");
  const { data: accessoriesData } = useApi<{ items: any[] }>("/api/accessories?limit=500");
  const { data: ordersData } = useApi<{ items: any[] }>("/api/orders?limit=500");
  const { data: suppliersData } = useApi<{ items: any[] }>("/api/suppliers?limit=500");
  const rows = data?.entries ?? [];
  const boards = boardsData?.items ?? [];
  const accessories = accessoriesData?.items ?? [];
  const allOrders = ordersData?.items ?? [];
  const suppliersList = suppliersData?.items ?? [];
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activePanel, setActivePanel] = useState<PanelKey>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const activeFiltersCount = [typeFilter, payFilter, fromDate, toDate].filter(Boolean).length;

  const filtered = useMemo(() => rows.filter(r => {
    const matchSearch = !search || r.description.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || r.entry_type === typeFilter;
    const matchPay = !payFilter || r.payment_method === payFilter;
    const matchDate = (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate);
    return matchSearch && matchType && matchPay && matchDate;
  }), [rows, search, typeFilter, payFilter, fromDate, toDate]);

  // ====== 3 مستويات للملخص ======
  // (SSoT — F1, F2) كل الحسابات المالية من src/lib/finance.ts
  const todayKey = dateKey();
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = dateKey(weekStart);

  const todayRows = rows.filter(r => r.date === todayKey);
  const weekRows = rows.filter(r => r.date >= weekStartKey);

  const todayIncome = calcIncome(todayRows);
  const todayExpense = calcExpense(todayRows);
  const weekIncome = calcIncome(weekRows);
  const weekExpense = calcExpense(weekRows);
  const totalIncome = calcIncome(rows);
  const totalExpense = calcExpense(rows);
  const totalPayout = calcPayout(rows);
  const totalNet = totalIncome - totalExpense - totalPayout;

  // ====== الرصيد الجاري (Running Balance) ======
  // SSoT — يشمل الوارد والمصروف والدفوع (F1).
  // كان قبل كده بيحسب openingBalance = income_before - expense_before
  // وبيتجاهل الـ payout، فكان الرقم مش متطابق مع totalNet.
  const openingBalance = calcOpeningBalance(rows, todayKey);
  const todayNet = todayIncome - todayExpense;
  // closingBalance = opening + dayNet (نفس المعادلة الموحدة)
  const closingBalance = calcClosingBalance(rows, todayKey);

  // ====== تفاصيل اليوم لجدول "تقرير اليوم" ======
  const todayDetail = todayRows.slice().reverse(); // الأحدث أولاً
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  if (!profile) return null;
  const canSee = canSeeModule(profile, "journal");

  function closePanel() { setActivePanel(null); }

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title={showSummary ? "ملخص اليومية" : "اليومية"}
        subtitle={showSummary ? "صندوق الرصيد + ملخص الأسبوع" : "أدخل أي حركة من هنا — شراء، نثريات، وارد، بحث"}
        helpTitle="اليومية"
        helpDescription="هنا تدخل كل حاجة من صفحة واحدة: اضغط أي زر في الأزرار السريعة (شراء ألواح، نثريات، دفعة من معرض...)، يفتح فورم جنبها. كل حاجة بتسجل في اليومية تلقائياً."
        actions={<PWAInstallButton />}
      />

      {!canSee ? (
        <div className="card text-center text-gray-500 py-12">🔒 هذه الصفحة للمصنع فقط.</div>
      ) : (
        <>
          {/* ===== ملخص المخزون والأوردرات ===== */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="card bg-white border-r-4 border-brand-orange">
              <div className="text-xs text-gray-500">قيمة المخزون</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-brand-black">{formatCurrency(
                  boards.reduce((s: number, b: any) => s + (Number(b.unit_price ?? 0) * Number(b.quantity_remaining ?? 0)), 0)
                  + accessories.reduce((s: number, a: any) => s + (Number(a.unit_price ?? 0) * Number(a.quantity_remaining ?? 0)), 0)
                )}</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{boards.length + accessories.length} صنف</div>
            </div>
            <div className="card bg-white border-r-4 border-brand-orange">
              <div className="text-xs text-gray-500">أوردرات مفتوحة</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-brand-orange">{allOrders.filter((o: any) => o.status === "مفتوح" || o.status === "قيد التنفيذ").length}</span>
                <span className="text-2xl font-extrabold text-brand-orange">{formatCurrency(allOrders.filter((o: any) => o.status === "مفتوح" || o.status === "قيد التنفيذ").reduce((s: number, o: any) => s + Number(o.order_total ?? o.total ?? 0), 0))}</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">إجمالي قيمة المفتوحة</div>
            </div>
            <div className="card bg-white border-r-4 border-brand-orange">
              <div className="text-xs text-gray-500">أوردرات مكتملة</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-green-600">{allOrders.filter((o: any) => o.status === "مكتمل" || o.status === "تم التسليم").length}</span>
                <span className="text-2xl font-extrabold text-green-600">{formatCurrency(allOrders.filter((o: any) => o.status === "مكتمل" || o.status === "تم التسليم").reduce((s: number, o: any) => s + Number(o.order_total ?? o.total ?? 0), 0))}</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">إجمالي قيمة المكتملة</div>
            </div>
            <div className="card bg-white border-r-4 border-brand-orange">
              <div className="text-xs text-gray-500">إجمالي الأوردرات</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-brand-black">{allOrders.length}</span>
                <span className="text-2xl font-extrabold text-brand-orange">{formatCurrency(allOrders.reduce((s: number, o: any) => s + Number(o.order_total ?? o.total ?? 0), 0))}</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">عدد + قيمة الكل</div>
            </div>
          </div>

          {/* ===== ملخص إجمالي كل الفلوس ===== */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="card bg-white border-r-4 border-brand-orange">
              <div className="text-xs text-gray-500">إجمالي الوارد</div>
              <div className="text-2xl font-extrabold text-brand-black">{formatCurrency(totalIncome)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">كل التحويلات الواردة من المعارض</div>
            </div>
            <div className="card bg-white border-r-4 border-brand-orange">
              <div className="text-xs text-gray-500">إجمالي المصروف (مشتريات)</div>
              <div className="text-2xl font-extrabold text-brand-black">{formatCurrency(totalExpense)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">مشتريات ألواح + إكسسوارات + نثريات</div>
            </div>
            <div className="card bg-white border-r-4 border-brand-orange">
              <div className="text-xs text-gray-500">إجمالي المدفوعات (موردين)</div>
              <div className="text-2xl font-extrabold text-brand-black">{formatCurrency(totalPayout)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">دفوع صادرة للموردين</div>
            </div>
            <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white">
              <div className="text-xs opacity-90">صافي الرصيد الحالي</div>
              <div className="text-2xl font-extrabold">{formatCurrency(totalNet)}</div>
              <div className="text-[10px] opacity-70 mt-0.5">الوارد − المصروف − المدفوعات</div>
            </div>
          </div>

          {/* ===== ملخص اليوم + آخر 7 أيام ===== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {/* تقرير اليوم */}
            <div className="card bg-white border border-gray-200">
              <div className="text-xs font-bold text-gray-700 mb-2 border-b pb-2">📅 تقرير اليوم ({formatDate(todayKey)})</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-brand-orange-light rounded p-1.5"><div className="text-[10px] text-gray-500">وارد</div><div className="font-bold text-brand-orange-dark text-sm">{formatCurrency(todayIncome)}</div></div>
                <div className="bg-gray-50 rounded p-1.5"><div className="text-[10px] text-gray-500">مصروف</div><div className="font-bold text-gray-700 text-sm">{formatCurrency(todayExpense)}</div></div>
                <div className="bg-white border rounded p-1.5"><div className="text-[10px] text-gray-500">الصافي</div><div className={`font-bold text-sm ${todayIncome - todayExpense >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(todayIncome - todayExpense)}</div></div>
              </div>
            </div>
            {/* تقرير آخر 7 أيام */}
            <div className="card bg-white border border-gray-200">
              <div className="text-xs font-bold text-gray-700 mb-2 border-b pb-2">📆 آخر 7 أيام</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-brand-orange-light rounded p-1.5"><div className="text-[10px] text-gray-500">وارد</div><div className="font-bold text-brand-orange-dark text-sm">{formatCurrency(weekIncome)}</div></div>
                <div className="bg-gray-50 rounded p-1.5"><div className="text-[10px] text-gray-500">مصروف</div><div className="font-bold text-gray-700 text-sm">{formatCurrency(weekExpense)}</div></div>
                <div className="col-span-2 bg-white border rounded p-1.5"><div className="text-[10px] text-gray-500">صافي الأسبوع</div><div className="font-bold text-brand-black text-sm">{formatCurrency(weekIncome - weekExpense)}</div></div>
              </div>
            </div>
          </div>

          {/* ===== أزرار الإجراءات السريعة ===== */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {ACTIONS.map(a => (
              <button
                key={a.key}
                onClick={() => setActivePanel(activePanel === a.key ? null : a.key)}
                className={`group relative overflow-hidden rounded-2xl border-2 ${a.color} bg-white p-4 shadow-sm transition-all hover:-translate-y-1 ${activePanel === a.key ? "ring-2 ring-offset-2 ring-brand-orange" : ""}`}
              >
                <div className="text-3xl mb-1">{a.icon}</div>
                <div className="text-xs font-bold leading-tight">{a.label}</div>
              </button>
            ))}
          </div>

          {/* ===== لوحة ديناميكية ===== */}
          {activePanel && (
            <div className="card mb-6 border-2 border-brand-orange/30">
              <div className="flex items-center justify-between mb-3 pb-3 border-b">
                <h3 className="font-bold text-lg text-brand-orange">{PANEL_TITLES[activePanel]}</h3>
                <button onClick={closePanel} className="text-gray-400 hover:text-red-500 text-xl">✕</button>
              </div>
              <div className={activePanel === "today" || activePanel === "filter" ? "" : "max-w-2xl"}>
                {activePanel === "board" && <BoardPurchasePanel onSaved={() => refetch()} />}
                {activePanel === "accessory" && <AccessoryPurchasePanel onSaved={() => refetch()} />}
                {activePanel === "overhead" && <OverheadPanel onSaved={() => refetch()} />}
                {activePanel === "income" && <IncomePanel onSaved={() => refetch()} />}
                {activePanel === "search" && <InventorySearchPanel onOpenPurchase={(cat) => setActivePanel(cat)} />}
                {activePanel === "workers" && <WorkersReportPanel />}
                {activePanel === "filter" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[200px]"><SearchBox value={search} onChange={setSearch} placeholder="ابحث في البيان..." /></div>
                      <Button variant="secondary" onClick={() => setFilterOpen(v => !v)} className="relative">تصفية{activeFiltersCount > 0 && <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFiltersCount}</span>}</Button>
                    </div>
                    {filterOpen && (
                      <div className="bg-gray-50 rounded-xl p-4 space-y-3 border">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">نوع الحركة</label>
                            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                              <option value="">كل الأنواع</option>
                              {Object.entries(ENTRY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">طريقة الدفع</label>
                            <select value={payFilter} onChange={e => setPayFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                              <option value="">كل طرق الدفع</option>
                              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">من تاريخ</label>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">إلى تاريخ</label>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                          </div>
                        </div>
                        {activeFiltersCount > 0 && (
                          <div className="flex justify-end">
                            <Button variant="secondary" size="sm" onClick={() => { setTypeFilter(""); setPayFilter(""); setFromDate(""); setToDate(""); }}>🗑️ مسح الفلاتر</Button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">النتائج: <strong>{filtered.length}</strong> حركة</span>
                      <Button variant="secondary" onClick={() => exportToExcel(filtered as any, "journal")}>📥 تصدير</Button>
                    </div>
                    <DataTable
                      loading={loading}
                      rows={filtered}
                      emptyMessage="لا توجد حركات مالية"
                      columns={[
                        { key: "date", label: "التاريخ", render: r => formatDate(r.date) },
                        { key: "entry_type", label: "النوع", render: r => <span className={`badge ${ENTRY_TYPE_COLORS[r.entry_type]}`}>{ENTRY_TYPE_LABELS[r.entry_type]}</span> },
                        { key: "description", label: "البيان" },
                        { key: "party", label: "الجهة", render: r => r.party_name || "-" },
                        { key: "payment_method", label: "الطريقة", render: r => PAYMENT_METHOD_LABELS[r.payment_method] || "-" },
                        { key: "amount", label: "المبلغ", render: r => <span className={`font-bold ${r.entry_type === "دفعة واردة من معرض" ? "text-green-600" : "text-red-600"}`}>{formatCurrency(r.amount)}</span> },
                        { key: "_actions", label: "إجراءات", render: r => <RowEditor row={r} apiBase="/api/journal" fields={journalFields} entityLabel="الحركة المالية" deleteHint="لا يمكن حذف هذه الحركة لأنها مرتبطة بأوردر أو حركات أخرى" /> },
                      ]}
                    />
                  </div>
                )}
                {activePanel === "today" && (
                  <div>
                    {/* ملخص الرصيد الجاري */}
                    <div className="card bg-white border-r-4 border-brand-orange mb-4">
                      <div className="text-sm font-bold text-brand-orange mb-3">💰 تقرير اليوم — {formatDate(todayKey)} ({dayNames[new Date().getDay()]})</div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-orange-50 rounded-lg p-3 text-center border border-brand-orange/20">
                          <div className="text-xs text-brand-orange-dark mb-1">وارد</div>
                          <div className="font-bold text-brand-orange-dark text-lg">{formatCurrency(todayIncome)}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center border">
                          <div className="text-xs text-gray-500 mb-1">مصروف</div>
                          <div className="font-bold text-gray-700 text-lg">{formatCurrency(todayExpense)}</div>
                        </div>
                        <div className={`rounded-lg p-3 text-center border ${todayIncome - todayExpense >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
                          <div className={`text-xs mb-1 ${todayIncome - todayExpense >= 0 ? "text-green-700" : "text-red-600"}`}>الصافي</div>
                          <div className={`font-bold text-lg ${todayIncome - todayExpense >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(todayIncome - todayExpense)}</div>
                        </div>
                      </div>
                    </div>

                    {/* تفاصيل حركات اليوم */}
                    <h4 className="font-bold mb-2 text-gray-700">📋 تفاصيل حركات اليوم ({todayDetail.length})</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50"><tr>
                          <th className="p-2 text-right">النوع</th>
                          <th className="p-2 text-right">البيان</th>
                          <th className="p-2 text-right">الجهة</th>
                          <th className="p-2 text-right">الطريقة</th>
                          <th className="p-2 text-right">المبلغ</th>
                        </tr></thead>
                        <tbody className="divide-y">
                          {todayDetail.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-400">لا توجد حركات اليوم بعد</td></tr>}
                          {todayDetail.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50">
                              <td className="p-2"><span className={`badge ${ENTRY_TYPE_COLORS[r.entry_type] || ""}`}>{ENTRY_TYPE_LABELS[r.entry_type] || r.entry_type}</span></td>
                              <td className="p-2">{r.description}</td>
                              <td className="p-2 text-xs text-gray-500">{r.party_name || "-"}</td>
                              <td className="p-2 text-xs">{PAYMENT_METHOD_LABELS[r.payment_method] || "-"}</td>
                              <td className={`p-2 font-bold ${r.entry_type === "دفعة واردة من معرض" ? "text-green-600" : "text-red-600"}`}>{formatCurrency(r.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        {todayDetail.length > 0 && (
                          <tfoot className="bg-gray-100 font-bold">
                            <tr>
                              <td colSpan={2} className="p-2">الإجمالي</td>
                              <td colSpan={2} className="p-2 text-green-700">وارد: {formatCurrency(todayIncome)}</td>
                              <td className="p-2 text-red-700">مصروف: {formatCurrency(todayExpense)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                    <div className="mt-3 text-right">
                      <Button variant="secondary" onClick={() => exportToExcel(todayDetail as any, `journal_today_${todayKey}`)}>📥 تصدير تقرير اليوم</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </>
      )}
    </DashboardLayout>
  );
}

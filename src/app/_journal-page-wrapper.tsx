"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { SearchBox, FilterBar } from "@/components/SearchFilter";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency, formatDate, ENTRY_TYPE_LABELS, ENTRY_TYPE_COLORS, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { canSeeModule } from "@/lib/auth";
import RowEditor, { type FieldDef } from "@/components/ui/RowEditor";
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
  | "search" | "workers" | "today" | null;

interface ActionBtn { key: PanelKey; icon: string; label: string; color: string; }

const ACTIONS: ActionBtn[] = [
  { key: "board", icon: "🪵", label: "شراء ألواح", color: "from-amber-500 to-orange-600" },
  { key: "accessory", icon: "🔩", label: "شراء إكسسوارات", color: "from-purple-500 to-purple-700" },
  { key: "overhead", icon: "💵", label: "نثريات / أجور عمال", color: "from-pink-500 to-rose-600" },
  { key: "income", icon: "📥", label: "دفعة من معرض", color: "from-green-500 to-emerald-600" },
  { key: "search", icon: "🔍", label: "بحث في المخزن", color: "from-blue-500 to-blue-700" },
  { key: "today", icon: "📅", label: "تقرير اليوم", color: "from-cyan-500 to-teal-600" },
  { key: "workers", icon: "🧑‍🔧", label: "تقرير العمال", color: "from-indigo-500 to-indigo-700" },
];

const PANEL_TITLES: Record<Exclude<PanelKey, null>, string> = {
  board: "🪵 شراء ألواح",
  accessory: "🔩 شراء إكسسوارات",
  overhead: "💵 نثريات / أجور عمال",
  income: "📥 دفعة واردة من معرض",
  search: "🔍 بحث في المخزن",
  workers: "🧑‍🔧 تقرير العمال",
  today: "📅 تقرير اليوم",
};

export default function JournalPageWrapper({ showSummary = false }: { showSummary?: boolean }) {
  const { user: profile } = useUserStore();
  const { data, loading, refetch } = useApi<{ entries: any[] }>("/api/journal?limit=500");
  const rows = data?.entries ?? [];
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activePanel, setActivePanel] = useState<PanelKey>(null);

  const filtered = useMemo(() => rows.filter(r => {
    const matchSearch = !search || r.description.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || r.entry_type === typeFilter;
    const matchPay = !payFilter || r.payment_method === payFilter;
    const matchDate = (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate);
    return matchSearch && matchType && matchPay && matchDate;
  }), [rows, search, typeFilter, payFilter, fromDate, toDate]);

  // ====== 3 مستويات للملخص ======
  const todayKey = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = weekStart.toISOString().slice(0, 10);

  const todayRows = rows.filter(r => r.date === todayKey);
  const weekRows = rows.filter(r => r.date >= weekStartKey);

  const calcIncome = (arr: any[]) => arr.filter(r => r.entry_type === "دفعة واردة من معرض" && !r.is_passthrough).reduce((s, r) => s + Number(r.amount), 0);
  const calcExpense = (arr: any[]) => arr.filter(r => ["مشتريات", "نثريات"].includes(r.entry_type)).reduce((s, r) => s + Number(r.amount), 0);

  const todayIncome = calcIncome(todayRows);
  const todayExpense = calcExpense(todayRows);
  const weekIncome = calcIncome(weekRows);
  const weekExpense = calcExpense(weekRows);
  const totalIncome = calcIncome(filtered);
  const totalExpense = calcExpense(filtered);

  // ====== الرصيد الجاري (Running Balance) ======
  // رصيد أول اليوم = (الوارد التراكمي − المصروف التراكمي) لكل الأيام قبل اليوم.
  // رصيد آخر اليوم = رصيد الأول + وارد اليوم − مصروف اليوم (ده اللي يبدأ بيه بكره).
  const beforeTodayRows = rows.filter(r => r.date < todayKey);
  const openingBalance = calcIncome(beforeTodayRows) - calcExpense(beforeTodayRows);
  const todayNet = todayIncome - todayExpense;
  const closingBalance = openingBalance + todayNet;

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
        backHref="/dashboard"
        actions={canSee ? (
          <>
            {!showSummary && <Link href="/journal/summary"><Button variant="secondary">📊 ملخص الأسبوع</Button></Link>}
            {showSummary && <Link href="/journal"><Button variant="secondary">📋 كل الحركات</Button></Link>}
            <Button variant="secondary" onClick={() => exportToExcel(filtered as any, "journal")}>📥 تصدير</Button>
          </>
        ) : null}
      />

      {!canSee ? (
        <div className="card text-center text-gray-500 py-12">🔒 هذه الصفحة للمصنع فقط.</div>
      ) : (
        <>
          {/* ===== 3 مستويات للملخص ===== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {/* تقرير اليوم */}
            <div className="card border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 to-white">
              <div className="text-xs font-bold text-cyan-700 mb-2">📅 تقرير اليوم ({formatDate(todayKey)})</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white/60 rounded p-1.5"><div className="text-[10px] text-gray-500">رصيد أول اليوم</div><div className="font-bold text-gray-700 text-sm">{formatCurrency(openingBalance)}</div></div>
                <div className="bg-green-50 rounded p-1.5"><div className="text-[10px] text-gray-500">+ وارد اليوم</div><div className="font-bold text-green-600 text-sm">{formatCurrency(todayIncome)}</div></div>
                <div className="bg-red-50 rounded p-1.5"><div className="text-[10px] text-gray-500">− مصروف اليوم</div><div className="font-bold text-red-600 text-sm">{formatCurrency(todayExpense)}</div></div>
                <div className={`rounded p-1.5 ${closingBalance >= 0 ? "bg-blue-50" : "bg-red-100"}`}><div className="text-[10px] text-gray-500">= المتبقي (آخر اليوم)</div><div className={`font-bold text-sm ${closingBalance >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(closingBalance)}</div></div>
              </div>
            </div>
            {/* تقرير آخر 7 أيام */}
            <div className="card border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-white">
              <div className="text-xs font-bold text-blue-700 mb-2">📆 آخر 7 أيام</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-green-50 rounded p-1.5"><div className="text-[10px] text-gray-500">وارد</div><div className="font-bold text-green-600 text-sm">{formatCurrency(weekIncome)}</div></div>
                <div className="bg-red-50 rounded p-1.5"><div className="text-[10px] text-gray-500">مصروف</div><div className="font-bold text-red-600 text-sm">{formatCurrency(weekExpense)}</div></div>
                <div className="col-span-2 bg-blue-50 rounded p-1.5"><div className="text-[10px] text-gray-500">صافي الأسبوع</div><div className={`font-bold text-sm ${weekIncome - weekExpense >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(weekIncome - weekExpense)}</div></div>
              </div>
            </div>
            {/* التقرير العام (التراكمي) */}
            <div className="card border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white">
              <div className="text-xs font-bold text-purple-700 mb-2">📊 التقرير العام (تراكمي)</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-green-50 rounded p-1.5"><div className="text-[10px] text-gray-500">إجمالي الوارد</div><div className="font-bold text-green-600 text-sm">{formatCurrency(totalIncome)}</div></div>
                <div className="bg-red-50 rounded p-1.5"><div className="text-[10px] text-gray-500">إجمالي المصروف</div><div className="font-bold text-red-600 text-sm">{formatCurrency(totalExpense)}</div></div>
                <div className="col-span-2 bg-purple-50 rounded p-1.5"><div className="text-[10px] text-gray-500">الرصيد الكلي الحالي</div><div className={`font-bold text-sm ${closingBalance >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(closingBalance)}</div></div>
              </div>
            </div>
          </div>

          {/* ===== أزرار الإجراءات السريعة ===== */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {ACTIONS.map(a => (
              <button
                key={a.key}
                onClick={() => setActivePanel(activePanel === a.key ? null : a.key)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${a.color} p-4 text-white shadow-md transition hover:scale-105 ${activePanel === a.key ? "ring-4 ring-offset-2 ring-brand-orange" : ""}`}
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
              <div className={activePanel === "today" ? "" : "max-w-2xl"}>
                {activePanel === "board" && <BoardPurchasePanel onSaved={() => refetch()} />}
                {activePanel === "accessory" && <AccessoryPurchasePanel onSaved={() => refetch()} />}
                {activePanel === "overhead" && <OverheadPanel onSaved={() => refetch()} />}
                {activePanel === "income" && <IncomePanel onSaved={() => refetch()} />}
                {activePanel === "search" && <InventorySearchPanel />}
                {activePanel === "workers" && <WorkersReportPanel />}
                {activePanel === "today" && (
                  <div>
                    {/* ملخص الرصيد الجاري */}
                    <div className="bg-gradient-to-l from-cyan-50 to-white border-2 border-cyan-200 rounded-xl p-4 mb-4">
                      <div className="text-sm font-bold text-cyan-800 mb-3">💰 الرصيد الجاري — {formatDate(todayKey)} ({dayNames[new Date().getDay()]})</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white rounded-lg p-3 text-center border">
                          <div className="text-xs text-gray-500 mb-1">رصيد أول اليوم</div>
                          <div className="font-bold text-gray-700">{formatCurrency(openingBalance)}</div>
                          <div className="text-[10px] text-gray-400 mt-1">المتبقي من الأيام السابقة</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                          <div className="text-xs text-green-600 mb-1">+ وارد اليوم</div>
                          <div className="font-bold text-green-700">{formatCurrency(todayIncome)}</div>
                          <div className="text-[10px] text-gray-400 mt-1">تحويلات من المعرض</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                          <div className="text-xs text-red-600 mb-1">− مصروف اليوم</div>
                          <div className="font-bold text-red-700">{formatCurrency(todayExpense)}</div>
                          <div className="text-[10px] text-gray-400 mt-1">مشتريات + نثريات</div>
                        </div>
                        <div className={`rounded-lg p-3 text-center border-2 ${closingBalance >= 0 ? "bg-blue-50 border-blue-300" : "bg-red-100 border-red-300"}`}>
                          <div className={`text-xs mb-1 ${closingBalance >= 0 ? "text-blue-600" : "text-red-600"}`}>= المتبقي (آخر اليوم)</div>
                          <div className={`font-bold text-lg ${closingBalance >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(closingBalance)}</div>
                          <div className="text-[10px] text-gray-400 mt-1">ده اللي هتبدأ بيه بكره</div>
                        </div>
                      </div>
                      {todayNet !== 0 && (
                        <div className="mt-3 text-center text-sm">
                          <span className="text-gray-500">صافي حركة اليوم: </span>
                          <span className={`font-bold ${todayNet >= 0 ? "text-green-700" : "text-red-700"}`}>{todayNet >= 0 ? "+" : ""}{formatCurrency(todayNet)}</span>
                        </div>
                      )}
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

          {/* ===== جدول كل الحركات ===== */}
          <div className="card mb-4">
            <FilterBar>
              <div className="flex-1"><SearchBox value={search} onChange={setSearch} placeholder="ابحث في البيان..." /></div>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2.5 border rounded-lg bg-white">
                <option value="">كل الأنواع</option>
                {Object.entries(ENTRY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={payFilter} onChange={e => setPayFilter(e.target.value)} className="px-3 py-2.5 border rounded-lg bg-white">
                <option value="">كل طرق الدفع</option>
                {Object.entries(PAYMENT_METHOD_LABELS).filter(([k]) => k !== "both").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-2.5 border rounded-lg" title="من" />
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-2.5 border rounded-lg" title="إلى" />
            </FilterBar>
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
        </>
      )}
    </DashboardLayout>
  );
}

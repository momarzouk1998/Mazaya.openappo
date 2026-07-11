"use client";
import { useMemo, useState } from "react";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { SearchBox, FilterBar } from "@/components/SearchFilter";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate, ENTRY_TYPE_LABELS, ENTRY_TYPE_COLORS, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { calcIncome, calcExpense, calcPayout, calcPassthrough } from "@/lib/finance";

export default function BudgetPage() {
  const { user: profile } = useUserStore();
  const { data, loading, refetch } = useApi<{ entries: any[] }>("/api/journal?limit=500");
  const rows = data?.entries ?? [];

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const activeFiltersCount = [typeFilter, payFilter, fromDate, toDate].filter(Boolean).length;

  const filtered = useMemo(() => rows.filter(r => {
    const matchSearch = !search || r.description.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || r.entry_type === typeFilter;
    const matchPay = !payFilter || r.payment_method === payFilter;
    const matchDate = (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate);
    return matchSearch && matchType && matchPay && matchDate;
  }), [rows, search, typeFilter, payFilter, fromDate, toDate]);

  // ====== حسابات الكاردات من filtered ======
  // (SSoT — F2) كل الحسابات من src/lib/finance.ts عشان نضمن
  // نفس القيم في كل الصفحات.
  const fIncome = calcIncome(filtered);
  const fExpense = calcExpense(filtered);
  const fPayout = calcPayout(filtered);
  const fPassthrough = calcPassthrough(filtered);
  const fNet = fIncome - fExpense - fPayout;

  // إجمالي الكل (من غير فلتر) للمقارنة
  const allIncome = calcIncome(rows);
  const allExpense = calcExpense(rows);
  const allPayout = calcPayout(rows);
  const allNet = allIncome - allExpense - allPayout;

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="الميزانية"
        subtitle="شوف فلوس إيه دخلت وإيه خرجت — مع فلتر بالتاريخ والنوع والطريقة"
        helpTitle="الميزانية"
        helpDescription="زي الحركات المالية في اليومية لكن مع كاردات تلخّص الوارد والمصروف والصافي. الفلتر بيأثر على الأرقام — يعني تقدر تقارن شهر بشهر أو نوع بنوع."
        backHref="/journal"
      />

      {/* ===== كاردات الملخص (بتتغير مع الفلتر) ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <div className="text-xs opacity-90">📥 الوارد (تحويلات)</div>
          <div className="text-2xl font-extrabold">{formatCurrency(fIncome)}</div>
          <div className="text-[10px] opacity-70 mt-0.5">إجمالي: {formatCurrency(allIncome)}</div>
        </div>
        <div className="card bg-gradient-to-br from-red-400 to-red-600 text-white">
          <div className="text-xs opacity-90">📤 المصروف (مشتريات + نثريات)</div>
          <div className="text-2xl font-extrabold">{formatCurrency(fExpense)}</div>
          <div className="text-[10px] opacity-70 mt-0.5">إجمالي: {formatCurrency(allExpense)}</div>
        </div>
        <div className="card bg-gradient-to-br from-orange-400 to-orange-600 text-white">
          <div className="text-xs opacity-90">💸 دفوع للموردين</div>
          <div className="text-2xl font-extrabold">{formatCurrency(fPayout)}</div>
          <div className="text-[10px] opacity-70 mt-0.5">إجمالي: {formatCurrency(allPayout)}</div>
        </div>
        <div className={`card bg-gradient-to-br ${fNet >= 0 ? "from-blue-500 to-blue-700" : "from-red-500 to-red-700"} text-white`}>
          <div className="text-xs opacity-90">💰 صافي الرصيد</div>
          <div className="text-2xl font-extrabold">{formatCurrency(fNet)}</div>
          <div className="text-[10px] opacity-70 mt-0.5">وارد − مصروف − دفوع</div>
        </div>
      </div>

      {/* ===== ملخص تفصيلي ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">عدد الحركات</div>
              <div className="font-bold text-brand-black">{filtered.length}</div>
            </div>
            <div className="text-2xl">📋</div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">تحويلات تمريرية</div>
              <div className="font-bold text-gray-500">{formatCurrency(fPassthrough)}</div>
            </div>
            <div className="text-2xl">🔄</div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">صافي إجمالي (كل الحركات)</div>
              <div className={`font-bold ${allNet >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(allNet)}</div>
            </div>
            <div className="text-2xl">📊</div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">متوسط الحركة</div>
              <div className="font-bold text-brand-black">{filtered.length > 0 ? formatCurrency(filtered.reduce((s, r) => s + Number(r.amount), 0) / filtered.length) : "0"}</div>
            </div>
            <div className="text-2xl">📈</div>
          </div>
        </div>
      </div>

      {/* ===== الفلتر ===== */}
      <div className="card mb-4">
        <FilterBar>
          <div className="flex-1 min-w-[200px]"><SearchBox value={search} onChange={setSearch} placeholder="ابحث في البيان..." /></div>
          <Button variant="secondary" onClick={() => setFilterOpen(v => !v)} className="relative">
            تصفية
            {activeFiltersCount > 0 && <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFiltersCount}</span>}
          </Button>
        </FilterBar>
        {filterOpen && (
          <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-3 border">
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
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-gray-500">النتائج: <strong>{filtered.length}</strong> حركة</span>
          <Button variant="secondary" onClick={() => exportToExcel(filtered as any, `budget_${fromDate || "all"}_${toDate || "all"}`)}>📥 تصدير Excel</Button>
        </div>
      </div>

      {/* ===== جدول الحركات ===== */}
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
          { key: "amount", label: "المبلغ", render: r => {
            const isIncome = r.entry_type === "دفعة واردة من معرض" && !r.is_passthrough;
            const isPassthrough = r.is_passthrough;
            return (
              <span className={`font-bold ${isPassthrough ? "text-gray-400" : isIncome ? "text-green-600" : "text-red-600"}`}>
                {isIncome ? "+" : "−"}{formatCurrency(r.amount)}
                {isPassthrough && <span className="text-[10px] text-gray-400 mr-1">تمريري</span>}
              </span>
            );
          }},
        ]}
      />
    </DashboardLayout>
  );
}

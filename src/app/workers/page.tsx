"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import { useCan } from "@/hooks/useCan";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { SearchBox, FilterBar } from "@/components/SearchFilter";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/format";
import RowEditor, { type FieldDef } from "@/components/ui/RowEditor";
import { WagesTab } from "./_wages-tab";

const workerFields: FieldDef[] = [
  { name: "name", label: "اسم العامل", required: true },
  { name: "phone", label: "رقم التواصل" },
  { name: "notes", label: "ملاحظات", rows: 2 },
];

export default function WorkersPage() {
  const router = useRouter();
  const { user: profile } = useUserStore();
  const { can } = useCan();
  const { data, loading } = useApi<{ items: any[] }>("/api/workers?limit=500");
  // Fetch overhead expenses (with worker relation) to compute totals per worker
  const { data: ohData } = useApi<{ expenses: any[] }>("/api/overhead?limit=2000");
  const rows = data?.items ?? [];
  const expenses = ohData?.expenses ?? [];
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"workers" | "wages">("workers");

  // Map worker_id -> total paid
  const totalsByWorker = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of expenses) {
      if (e.worker_id) m[e.worker_id] = (m[e.worker_id] || 0) + Number(e.amount || 0);
    }
    return m;
  }, [expenses]);

  const lastDateByWorker = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of expenses) {
      if (!e.worker_id) continue;
      const d = String(e.date).slice(0, 10);
      if (!m[e.worker_id] || d > m[e.worker_id]) m[e.worker_id] = d;
    }
    return m;
  }, [expenses]);

  const filtered = useMemo(
    () => rows.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const rowsWithStats = useMemo(
    () => filtered.map(w => ({
      ...w,
      total_paid: totalsByWorker[w.id] || 0,
      last_paid_date: lastDateByWorker[w.id] || null,
    })),
    [filtered, totalsByWorker, lastDateByWorker]
  );

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="العمال"
        subtitle={rows.length + " عامل"}
        helpTitle="العمال"
        helpDescription="قائمة عمال المصنع. أجور كل عامل بتتسجل من تبويب 'أجور العمال'. الإجمالي بيتجمّع تلقائيًا."
        backHref="/journal"
        actions={
          <>
            <Button variant="secondary" onClick={() => exportToExcel(rowsWithStats, "workers")}>📥 تصدير</Button>
            {can('workers', 'add') && <Button onClick={() => router.push("/workers/new")}>+ عامل جديد</Button>}
          </>
        }
      />

      {/* تبويبات */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setTab("workers")}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition ${tab === "workers" ? "border-brand-orange text-brand-orange" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          🧑‍🔧 العمال
        </button>
        <button
          onClick={() => setTab("wages")}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition ${tab === "wages" ? "border-brand-orange text-brand-orange" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          💵 أجور العمال
        </button>
      </div>

      {tab === "workers" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="card bg-white border-r-4 border-brand-orange">
              <div className="text-xs text-gray-500">إجمالي العمال</div>
              <div className="text-2xl font-extrabold text-brand-black">{rows.length}</div>
            </div>
            <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white">
              <div className="text-xs opacity-90">إجمالي الأجور (الكل)</div>
              <div className="text-2xl font-extrabold">{formatCurrency(Object.values(totalsByWorker).reduce((s, v) => s + v, 0))}</div>
            </div>
            <div className="card bg-white border-r-4 border-brand-orange">
              <div className="text-xs text-gray-500">النتائج المعروضة</div>
              <div className="text-2xl font-bold text-brand-black">{filtered.length}</div>
            </div>
          </div>

          <div className="card mb-4">
            <FilterBar>
              <div className="flex-1"><SearchBox value={search} onChange={setSearch} placeholder="ابحث بالاسم..." /></div>
              <div className="text-sm text-gray-500 mr-auto">النتائج: <strong>{filtered.length}</strong></div>
            </FilterBar>
          </div>

          <DataTable
            loading={loading}
            rows={rowsWithStats}
            emptyMessage="لا يوجد عمال. ابدأ بإضافة عامل."
            columns={[
              { key: "name", label: "الاسم", render: r => <span className="font-semibold text-brand-orange">{r.name}</span> },
              { key: "phone", label: "رقم التواصل" },
              { key: "total_paid", label: "إجمالي الأجور", render: r => <span className="font-bold text-purple-700">{formatCurrency(r.total_paid)}</span> },
              { key: "last_paid_date", label: "آخر صرف", render: r => r.last_paid_date || "-" },
              { key: "notes", label: "ملاحظات" },
              { key: "_actions", label: "إجراءات", render: r => <RowEditor row={r} apiBase="/api/workers" fields={workerFields} entityLabel="العامل" deleteHint="لا يمكن حذف هذا العامل لوجود مصروفات مرتبطة به" canEdit={can('workers', 'edit')} canDelete={can('workers', 'delete')} /> },
            ]}
          />
        </>
      ) : (
        <WagesTab />
      )}
    </DashboardLayout>
  );
}

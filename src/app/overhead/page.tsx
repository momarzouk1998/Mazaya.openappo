"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApi } from "@/hooks/useApi"
import { useCan } from "@/hooks/useCan"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { DataTable } from "@/components/DataTable"
import { SearchBox } from "@/components/SearchFilter"
import { Button } from "@/components/ui/Button"
import { exportToExcel } from "@/lib/excel"
import { formatCurrency, formatDate } from "@/lib/format"
import RowEditor, { type FieldDef } from "@/components/ui/RowEditor"

const overheadFields: FieldDef[] = [
  { name: "date", label: "التاريخ", type: "date", required: true },
  { name: "description", label: "البيان", required: true },
  { name: "amount", label: "المبلغ", type: "number", required: true },
  { name: "notes", label: "ملاحظات", rows: 2 },
]

export default function OverheadPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { can } = useCan()
  const { data, loading } = useApi<{ expenses: any[]; items?: any[] }>("/api/overhead?limit=500")
  const { data: workersData } = useApi<{ items: any[] }>("/api/workers?limit=500")
  const rows: any[] = data?.expenses ?? data?.items ?? []
  const workers = workersData?.items ?? []
  const [search, setSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [workerFilter, setWorkerFilter] = useState("")
  const [workerSearch, setWorkerSearch] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)

  const activeFiltersCount = [categoryFilter, workerFilter, fromDate, toDate].filter(Boolean).length

  const filtered = useMemo(() => rows.filter((r) => {
    const matchSearch = !search || (r.description ?? "").toLowerCase().includes(search.toLowerCase())
    const matchCategory = !categoryFilter || (r.category ?? "") === categoryFilter
    const matchWorker = !workerFilter || r.worker_id === workerFilter
    const matchDate = (!fromDate || String(r.date) >= fromDate) && (!toDate || String(r.date) <= toDate)
    return matchSearch && matchCategory && matchWorker && matchDate
  }), [rows, search, categoryFilter, workerFilter, fromDate, toDate])

  const total = filtered.reduce((s, r) => s + Number(r.amount ?? 0), 0)

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort()
  }, [rows])

  // فلتر العمال: لو اختار "أجور عمال" يظهر خانة بحث عامل
  const showWorkerFilter = categoryFilter === "أجور عمال"
  const filteredWorkers = useMemo(() => {
    if (!workerSearch) return workers
    return workers.filter((w: any) => (w.name ?? "").toLowerCase().includes(workerSearch.toLowerCase()))
  }, [workers, workerSearch])

  // لو عامل محدد، نظهر اسمه
  const selectedWorkerName = workerFilter ? (workers.find((w: any) => w.id === workerFilter)?.name || "") : ""

  function clearFilters() {
    setCategoryFilter(""); setWorkerFilter(""); setWorkerSearch(""); setFromDate(""); setToDate("")
  }

  if (!profile) return null

  return (
    <DashboardLayout profile={profile}>
      <PageHeader title="النثريات" subtitle="مصاريف تشغيل المصنع العامة" helpTitle="النثريات" helpDescription="كهرباء، أجور عمال، شحن، إلخ." backHref="/journal" actions={can('overhead', 'add') ? <Button onClick={() => router.push("/overhead/new")}>+ نثريات جديدة</Button> : undefined} />

      {/* كارد الإجمالي الوحيد */}
      <div className="mb-4">
        <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white hover:shadow-elevated transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">إجمالي النثريات</div>
              <div className="text-4xl font-extrabold mt-1">{formatCurrency(total)}</div>
              <div className="text-xs opacity-80 mt-1">
                {filtered.length} سجل
                {categoryFilter && ` • تصنيف: ${categoryFilter}`}
                {selectedWorkerName && ` • عامل: ${selectedWorkerName}`}
                {(fromDate || toDate) && ` • فترة: ${fromDate || "البداية"} → ${toDate || "اليوم"}`}
              </div>
            </div>
            <div className="text-6xl opacity-30">💵</div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]"><SearchBox value={search} onChange={setSearch} placeholder="ابحث في البيان..." /></div>
          <Button variant="secondary" onClick={() => setFilterOpen(true)} className="relative">
            تصفية
            {activeFiltersCount > 0 && <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFiltersCount}</span>}
          </Button>
          <Button variant="secondary" onClick={() => exportToExcel(filtered as any, "overhead")}>تصدير</Button>
        </div>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setFilterOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">تصفية النثريات</h2>
              <button onClick={() => setFilterOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setWorkerFilter(""); setWorkerSearch("") }}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">كل التصنيفات</option>
                  {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {showWorkerFilter && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">بحث عن عامل</label>
                  <input
                    type="search"
                    value={workerSearch}
                    onChange={(e) => setWorkerSearch(e.target.value)}
                    placeholder="اكتب اسم العامل..."
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                  {workerSearch && (
                    <div className="mt-1 max-h-40 overflow-y-auto bg-white border rounded-lg">
                      {filteredWorkers.length === 0 && <div className="p-2 text-xs text-gray-400">لا يوجد عمال</div>}
                      {filteredWorkers.map((w: any) => (
                        <button
                          key={w.id}
                          onClick={() => { setWorkerFilter(w.id); setWorkerSearch(w.name) }}
                          className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 ${workerFilter === w.id ? "bg-brand-orange-light text-brand-orange-dark font-bold" : ""}`}
                        >
                          {w.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {workerFilter && (
                    <div className="mt-2 flex items-center gap-2 bg-brand-orange-light p-2 rounded-lg">
                      <span className="text-xs text-brand-orange-dark font-medium">✓ العامل المحدد: {selectedWorkerName}</span>
                      <button onClick={() => { setWorkerFilter(""); setWorkerSearch("") }} className="text-xs text-red-500 hover:underline mr-auto">إزالة</button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              {activeFiltersCount > 0 && (
                <div className="text-xs text-brand-orange-dark bg-brand-orange-light border border-brand-orange/20 p-2 rounded">
                  تم تطبيق {activeFiltersCount} فلتر — الإجمالي سيتحدث تلقائياً
                </div>
              )}
            </div>
            <div className="flex justify-between gap-2 pt-4 mt-4 border-t">
              <Button variant="secondary" onClick={clearFilters}>مسح الفلاتر</Button>
              <Button onClick={() => setFilterOpen(false)}>تطبيق</Button>
            </div>
          </div>
        </div>
      )}

      <DataTable
        loading={loading}
        rows={filtered}
        emptyMessage="لا توجد نثريات"
        columns={[
          { key: "date", label: "التاريخ", render: (r) => formatDate(r.date) },
          { key: "category", label: "التصنيف", render: (r) => r.category ? <span className="badge bg-purple-100 text-purple-700 border-purple-300">{r.category}</span> : "-" },
          { key: "description", label: "البيان" },
          { key: "worker", label: "العامل", render: (r) => r.worker?.name || "-" },
          { key: "amount", label: "المبلغ", render: (r) => <span className="font-bold text-red-600">{formatCurrency(Number(r.amount ?? 0))}</span> },
          { key: "notes", label: "ملاحظات" },
          { key: "_actions", label: "إجراءات", render: (r) => <RowEditor row={r} apiBase="/api/overhead" fields={overheadFields} entityLabel="النثريات" deleteHint="لا يمكن حذف هذه الحركة لأنها مرتبطة بحركة يومية" canEdit={can('overhead', 'edit')} canDelete={can('overhead', 'delete')} /> },
        ]}
      />
    </DashboardLayout>
  )
}

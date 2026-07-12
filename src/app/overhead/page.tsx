"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApi } from "@/hooks/useApi"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { DataTable } from "@/components/DataTable"
import { SearchBox, FilterBar } from "@/components/SearchFilter"
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

const CATEGORIES = ["أجور عمال", "كهرباء", "شحن", "إيجار", "صيانة", "أخرى"] as const

export default function OverheadPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
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

  // كاردات التصنيفات من الفلتر الحالي
  const categoryTotals = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach((r) => {
      const cat = r.category || "أخرى"
      m[cat] = (m[cat] || 0) + Number(r.amount ?? 0)
    })
    return m
  }, [filtered])

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort()
  }, [rows])

  // فلتر العمال: لو اختار "أجور عمال" يظهر خانة بحث عامل
  const showWorkerFilter = categoryFilter === "أجور عمال"
  const filteredWorkers = useMemo(() => {
    if (!workerSearch) return workers
    return workers.filter((w: any) => (w.name ?? "").toLowerCase().includes(workerSearch.toLowerCase()))
  }, [workers, workerSearch])

  if (!profile) return null

  return (
    <DashboardLayout profile={profile}>
      <PageHeader title="النثريات" subtitle="مصاريف تشغيل المصنع العامة" helpTitle="النثريات" helpDescription="كهرباء، أجور عمال، شحن، إلخ." backHref="/journal" actions={<Button onClick={() => router.push("/overhead/new")}>+ نثريات جديدة</Button>} />

      {/* كاردات الإجماليات */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white">
          <div className="text-xs opacity-90">إجمالي النثريات</div>
          <div className="text-2xl font-extrabold">{formatCurrency(total)}</div>
          <div className="text-[10px] opacity-70 mt-0.5">{filtered.length} سجل</div>
        </div>
        <div className="card bg-white border-r-4 border-brand-orange">
          <div className="text-xs text-gray-500">عدد السجلات</div>
          <div className="text-2xl font-extrabold text-brand-black">{filtered.length}</div>
        </div>
      </div>

      {/* كاردات التصنيفات */}
      {Object.keys(categoryTotals).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
            <div
              key={cat}
              className={`card cursor-pointer transition ${categoryFilter === cat ? "border-brand-orange bg-brand-orange-light ring-2 ring-brand-orange/30" : "bg-white"}`}
              onClick={() => setCategoryFilter(categoryFilter === cat ? "" : cat)}
            >
              <div className="text-xs text-gray-500">{cat}</div>
              <div className="text-xl font-extrabold text-brand-black">{formatCurrency(amount)}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{filtered.filter((r) => (r.category || "أخرى") === cat).length} سجل</div>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1"><SearchBox value={search} onChange={setSearch} placeholder="ابحث في البيان..." /></div>
          <Button variant="secondary" onClick={() => setFilterOpen(v => !v)} className="relative">
            تصفية
            {activeFiltersCount > 0 && <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFiltersCount}</span>}
          </Button>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2.5 border rounded-lg" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2.5 border rounded-lg" />
          <Button variant="secondary" onClick={() => exportToExcel(filtered as any, "overhead")}>تصدير</Button>
        </div>
        {filterOpen && (
          <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-3 border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">التصنيف</label>
                <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setWorkerFilter("") }} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">كل التصنيفات</option>
                  {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {showWorkerFilter && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">بحث عامل</label>
                  <input
                    type="search"
                    value={workerSearch}
                    onChange={(e) => setWorkerSearch(e.target.value)}
                    placeholder="اكتب اسم العامل..."
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  />
                  {workerSearch && (
                    <div className="mt-1 max-h-32 overflow-y-auto bg-white border rounded-lg">
                      {filteredWorkers.length === 0 && <div className="p-2 text-xs text-gray-400">لا يوجد عمال</div>}
                      {filteredWorkers.map((w: any) => (
                        <button
                          key={w.id}
                          onClick={() => setWorkerFilter(w.id)}
                          className={`w-full text-right px-3 py-2 text-sm hover:bg-gray-100 ${workerFilter === w.id ? "bg-brand-orange-light text-brand-orange-dark font-bold" : ""}`}
                        >
                          {w.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {workerFilter && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">محدد: {workers.find((w: any) => w.id === workerFilter)?.name || ""}</span>
                      <button onClick={() => setWorkerFilter("")} className="text-xs text-red-500 hover:underline">مسح</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {activeFiltersCount > 0 && (
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => { setCategoryFilter(""); setWorkerFilter(""); setWorkerSearch(""); setFromDate(""); setToDate(""); }}>🗑️ مسح الفلاتر</Button>
              </div>
            )}
          </div>
        )}
      </div>

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
          { key: "_actions", label: "إجراءات", render: (r) => <RowEditor row={r} apiBase="/api/overhead" fields={overheadFields} entityLabel="النثريات" deleteHint="لا يمكن حذف هذه الحركة لأنها مرتبطة بحركة يومية" /> },
        ]}
      />
    </DashboardLayout>
  )
}


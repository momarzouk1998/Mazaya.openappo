"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUserStore } from "@/store/user-store"
import { useApi } from "@/hooks/useApi"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { DataTable } from "@/components/DataTable"
import { SearchBox, FilterBar } from "@/components/SearchFilter"
import { Button } from "@/components/ui/Button"
import { exportToExcel } from "@/lib/excel"
import { formatCurrency } from "@/lib/format"
import RowEditor, { type FieldDef } from "@/components/ui/RowEditor"

const boardFields: FieldDef[] = [
  { name: "item_name", label: "اسم الصنف", required: true },
  { name: "code", label: "الكود (اختياري)" },
  { name: "material_type", label: "الخامة" },
  { name: "unit_price", label: "سعر الوحدة", type: "number" },
  { name: "quantity_in", label: "الكمية المبدئية", type: "number" },
  { name: "notes", label: "ملاحظات", rows: 2 },
]

export default function BoardsPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { data, loading } = useApi<{ items: any[] }>("/api/boards?limit=500")
  const { data: suppliersData } = useApi<{ items: any[] }>("/api/suppliers?limit=500")
  const rows = data?.items ?? []
  const suppliers = suppliersData?.items ?? []
  const [search, setSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("")
  const [materialFilter, setMaterialFilter] = useState("")
  const [availableOnly, setAvailableOnly] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)

  const [materialTypes, setMaterialTypes] = useState<string[]>([])

  const activeFiltersCount = [supplierFilter, materialFilter, availableOnly ? "1" : "", fromDate, toDate].filter(Boolean).length

  function clearFilters() {
    setSupplierFilter(""); setMaterialFilter(""); setAvailableOnly(false); setFromDate(""); setToDate("")
  }

  // Load material types from the normalized lookup table (no duplicates)
  useEffect(() => {
    fetch("/api/material-types?category=board&limit=500")
      .then(r => r.json())
      .then(d => {
        const items = d?.data?.items ?? []
        const uniqueNames = Array.from(new Set(items.map((m: any) => (m.name || '').trim()))).sort()
        setMaterialTypes(uniqueNames as string[])
      })
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => rows.filter((b) => {
    const matchSearch = !search || b.item_name.toLowerCase().includes(search.toLowerCase()) || (b.code ?? "").toLowerCase().includes(search.toLowerCase())
    const matchSup = !supplierFilter || String(b.supplier_id) === supplierFilter
    const matchMat = !materialFilter || (b.material_type || "").trim().toLowerCase() === materialFilter.trim().toLowerCase()
    const matchAvail = !availableOnly || b.quantity_remaining > 0
    const matchFrom = !fromDate || String(b.date_added ?? "") >= fromDate
    const matchTo = !toDate || String(b.date_added ?? "") <= toDate
    return matchSearch && matchSup && matchMat && matchAvail && matchFrom && matchTo
  }), [rows, search, supplierFilter, materialFilter, availableOnly, fromDate, toDate])

  if (!profile) return null

  return (
    <DashboardLayout profile={profile}>
      <PageHeader title="مخزون الألواح" subtitle={rows.length + " صنف إجمالي"} helpTitle="مخزون الألواح" helpDescription="من هنا بتدير ألواح المصنع. الشراء والإضافة الجديدة من صفحة اليومية." backHref="/journal" actions={
        <Button variant="secondary" onClick={() => exportToExcel(filtered.map(({ id, supplier_name, total_price, ...rest }: any) => rest as any), "boards_inventory")}>📥 تصدير</Button>
      } />
      {/* إجمالي المخزون */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="card bg-white border-r-4 border-brand-orange">
            <div className="text-xs text-gray-500">إجمالي الداخل</div>
            <div className="text-2xl font-extrabold text-brand-black">{filtered.reduce((s: number, b: any) => s + Number(b.quantity_in ?? 0), 0)}</div>
          </div>
          <div className="card bg-white border-r-4 border-brand-orange">
            <div className="text-xs text-gray-500">إجمالي المستخدم</div>
            <div className="text-2xl font-extrabold text-brand-black">{filtered.reduce((s: number, b: any) => s + Number(b.quantity_used ?? 0), 0)}</div>
          </div>
          <div className="card bg-white border-r-4 border-brand-orange">
            <div className="text-xs text-gray-500">إجمالي المتبقي</div>
            <div className="text-2xl font-extrabold text-brand-black">{filtered.reduce((s: number, b: any) => s + Number(b.quantity_remaining ?? 0), 0)}</div>
          </div>
          <div className="card bg-white border-r-4 border-brand-orange">
            <div className="text-xs text-gray-500">عدد الأصناف</div>
            <div className="text-2xl font-extrabold text-brand-black">{filtered.length}</div>
          </div>
          <div className="col-span-2 md:col-span-1 card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white">
            <div className="text-xs opacity-90">قيمة المخزون</div>
            <div className="text-2xl font-extrabold">{formatCurrency(filtered.reduce((s: number, b: any) => s + (Number(b.unit_price ?? 0) * Number(b.quantity_remaining ?? 0)), 0))}</div>
          </div>
        </div>
      )}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]"><SearchBox value={search} onChange={setSearch} placeholder="ابحث بالاسم أو الكود..." /></div>
          <Button variant="secondary" onClick={() => setFilterOpen(true)} className="relative">تصفية{activeFiltersCount > 0 && <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFiltersCount}</span>}</Button>
          <div className="text-sm text-gray-500 mr-auto">النتائج: <strong>{filtered.length}</strong></div>
        </div>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setFilterOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">تصفية الألواح</h2>
              <button onClick={() => setFilterOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
                <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">كل الموردين</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الخامة</label>
                <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">كل الخامات</option>
                  {materialTypes.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
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
              <label className="flex items-center gap-2 text-sm cursor-pointer bg-gray-50 p-3 rounded-lg">
                <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="accent-brand-orange w-4 h-4" />
                <span className="font-medium">المتوفر فقط (لديه مخزون)</span>
              </label>
              {activeFiltersCount > 0 && <div className="text-xs text-brand-orange-dark bg-brand-orange-light border border-brand-orange/20 p-2 rounded">تم تطبيق {activeFiltersCount} فلتر</div>}
            </div>
            <div className="flex justify-between gap-2 pt-4 mt-4 border-t">
              <Button variant="secondary" onClick={clearFilters}>مسح الفلاتر</Button>
              <Button onClick={() => setFilterOpen(false)}>تطبيق</Button>
            </div>
          </div>
        </div>
      )}
      <DataTable loading={loading} rows={filtered} emptyMessage="لا توجد ألواح. ابدأ بإضافة صنف أو استيراد Excel." columns={[
        { key: "item_name", label: "البيان", render: (r) => <Link href={"/boards/" + r.id} className="text-brand-orange hover:underline font-medium">{r.item_name}</Link> },
        { key: "code", label: "الكود", render: (r) => <code className="text-xs bg-gray-100 px-2 py-1 rounded">{r.code}</code> },
        { key: "material_type", label: "الخامة" },
        { key: "supplier_name", label: "المورد" },
        { key: "unit_price", label: "السعر", render: (r) => formatCurrency(Number(r.unit_price ?? 0)) },
        { key: "quantity_in", label: "الداخل", render: (r) => Number(r.quantity_in ?? 0) },
        { key: "quantity_used", label: "المستخدم", render: (r) => Number(r.quantity_used ?? 0) },
        { key: "quantity_remaining", label: "المتبقي", render: (r) => <span className={Number(r.quantity_remaining ?? 0) > 0 ? "font-bold text-green-600" : "text-gray-400"}>{Number(r.quantity_remaining ?? 0)}</span> },
        { key: "total_price", label: "الإجمالي", render: (r) => <span className="font-bold">{formatCurrency(Number(r.total_price ?? 0))}</span> },
        { key: "_actions", label: "إجراءات", render: (r) => <RowEditor row={r} apiBase="/api/boards" fields={boardFields} entityLabel="اللوح" deleteHint="لا يمكن حذف هذا الصنف لأنه مُستخدم في أوردرات أو مُسجّل في اليومية" /> },
      ]} />
    </DashboardLayout>
  )
}


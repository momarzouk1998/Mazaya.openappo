"use client"
import { useMemo, useState } from "react"
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

const accessoryFields: FieldDef[] = [
  { name: "item_name", label: "اسم الصنف", required: true },
  { name: "type", label: "النوع" },
  { name: "unit_price", label: "سعر الوحدة", type: "number" },
  { name: "quantity_in", label: "الكمية المبدئية", type: "number" },
  { name: "notes", label: "ملاحظات", rows: 2 },
]

export default function AccessoriesPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { data, loading } = useApi<{ items: any[] }>("/api/accessories?limit=500")
  const { data: suppliersData } = useApi<{ items: any[] }>("/api/suppliers?limit=500")
  const rows = data?.items ?? []
  const suppliers = suppliersData?.items ?? []
  const [search, setSearch] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [availableOnly, setAvailableOnly] = useState(false)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const types = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r: any) => { if (r.type) set.add(r.type) })
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => rows.filter((a: any) => {
    const matchSearch = !search || a.item_name.toLowerCase().includes(search.toLowerCase()) || (a.code ?? "").toLowerCase().includes(search.toLowerCase())
    const matchSup = !supplierFilter || String(a.supplier_id) === supplierFilter
    const matchType = !typeFilter || a.type === typeFilter
    const matchAvail = !availableOnly || a.quantity_remaining > 0
    const matchFrom = !fromDate || String(a.date_added ?? "") >= fromDate
    const matchTo = !toDate || String(a.date_added ?? "") <= toDate
    return matchSearch && matchSup && matchType && matchAvail && matchFrom && matchTo
  }), [rows, search, supplierFilter, typeFilter, availableOnly, fromDate, toDate])

  if (!profile) return null

  return (
    <DashboardLayout profile={profile}>
      <PageHeader title="مخزون الاكسسوارات" subtitle={rows.length + " صنف إجمالي"} helpTitle="مخزون الاكسسوارات" helpDescription="إدارة مفصلات، سكك درج، مجاري، كاوتش، إلخ. الشراء والإضافة الجديدة من صفحة اليومية." backHref="/journal" actions={
        <Button variant="secondary" onClick={() => exportToExcel(filtered.map(({ id, supplier_name, total_price, ...rest }: any) => rest as any), "accessories_inventory")}>📥 تصدير</Button>
      } />
      {/* إجمالي المخزون */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="card bg-white border-r-4 border-brand-orange">
            <div className="text-xs text-gray-500">إجمالي الداخل</div>
            <div className="text-2xl font-extrabold text-brand-black">{filtered.reduce((s: number, a: any) => s + Number(a.quantity_in ?? 0), 0)}</div>
          </div>
          <div className="card bg-white border-r-4 border-brand-orange">
            <div className="text-xs text-gray-500">إجمالي المستخدم</div>
            <div className="text-2xl font-extrabold text-brand-black">{filtered.reduce((s: number, a: any) => s + Number(a.quantity_used ?? 0), 0)}</div>
          </div>
          <div className="card bg-white border-r-4 border-brand-orange">
            <div className="text-xs text-gray-500">إجمالي المتبقي</div>
            <div className="text-2xl font-extrabold text-brand-black">{filtered.reduce((s: number, a: any) => s + Number(a.quantity_remaining ?? 0), 0)}</div>
          </div>
          <div className="card bg-white border-r-4 border-brand-orange">
            <div className="text-xs text-gray-500">عدد الأصناف</div>
            <div className="text-2xl font-extrabold text-brand-black">{filtered.length}</div>
          </div>
          <div className="col-span-2 md:col-span-1 card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white">
            <div className="text-xs opacity-90">قيمة المخزون</div>
            <div className="text-2xl font-extrabold">{formatCurrency(filtered.reduce((s: number, a: any) => s + (Number(a.unit_price ?? 0) * Number(a.quantity_remaining ?? 0)), 0))}</div>
          </div>
        </div>
      )}
      <div className="card mb-4">
        <FilterBar>
          <div className="flex-1 min-w-[200px]"><SearchBox value={search} onChange={setSearch} placeholder="ابحث بالاسم أو الكود..." /></div>
          <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white"><option value="">كل الموردين</option>{suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white"><option value="">كل الأنواع</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="accent-brand-orange" />المتوفر فقط</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white" placeholder="من تاريخ" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white" placeholder="إلى تاريخ" />
          <div className="text-sm text-gray-500 mr-auto">النتائج: <strong>{filtered.length}</strong></div>
        </FilterBar>
      </div>
        <DataTable loading={loading} rows={filtered} emptyMessage="لا توجد اكسسوارات." columns={[
        { key: "item_name", label: "البيان", render: (r: any) => <Link href={"/accessories/" + r.id} className="text-brand-orange hover:underline font-medium">{r.item_name}</Link> },
        { key: "type", label: "النوع" },
        { key: "supplier_name", label: "المورد" },
        { key: "unit_price", label: "السعر", render: (r: any) => formatCurrency(Number(r.unit_price ?? 0)) },
        { key: "quantity_in", label: "الداخل", render: (r: any) => Number(r.quantity_in ?? 0) },
        { key: "quantity_used", label: "المستخدم", render: (r: any) => Number(r.quantity_used ?? 0) },
        { key: "quantity_remaining", label: "المتبقي", render: (r: any) => <span className={Number(r.quantity_remaining ?? 0) > 0 ? "font-bold text-green-600" : "text-gray-400"}>{Number(r.quantity_remaining ?? 0)}</span> },
        { key: "total_price", label: "الإجمالي", render: (r: any) => <span className="font-bold">{formatCurrency(Number(r.total_price ?? 0))}</span> },
        { key: "_actions", label: "إجراءات", render: (r: any) => <RowEditor row={r} apiBase="/api/accessories" fields={accessoryFields} entityLabel="الاكسسوار" deleteHint="لا يمكن حذف هذا الصنف لأنه مُستخدم في أوردرات أو مُسجّل في اليومية" /> },
      ]} />
    </DashboardLayout>
  )
}


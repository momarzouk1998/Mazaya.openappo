"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUserStore } from "@/store/user-store"
import { useApi } from "@/hooks/useApi"
import { useCan } from "@/hooks/useCan"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { DataTable } from "@/components/DataTable"
import { SearchBox, FilterBar } from "@/components/SearchFilter"
import { Button } from "@/components/ui/Button"
import { exportToExcel } from "@/lib/excel"
import { formatCurrency } from "@/lib/format"
import RowEditor, { type FieldDef } from "@/components/ui/RowEditor"

const branchFields: FieldDef[] = [
  { name: "name", label: "اسم المعرض", required: true },
  { name: "location", label: "الموقع" },
  { name: "phone", label: "رقم التواصل" },
  { name: "notes", label: "ملاحظات", rows: 2 },
]

export default function BranchesPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { can } = useCan()
  const { data, loading } = useApi<{ items: any[] }>("/api/branches?limit=500")
  const { data: customersData } = useApi<{ items: any[] }>("/api/customers?limit=500")
  const { data: ordersData } = useApi<{ items: any[] }>("/api/orders?limit=500")
  const { data: journalData } = useApi<any>("/api/journal?limit=500")
  const rows = data?.items ?? []
  const customers = customersData?.items ?? []
  const orders = ordersData?.items ?? []
  const journal = Array.isArray(journalData) ? journalData : (journalData?.entries ?? [])
  const [search, setSearch] = useState("")

  const enriched = useMemo(() => rows.map((br: any) => {
    const customersCount = customers.filter((c: any) => c.branch_id === br.id).length
    const ordersCount = orders.filter((o: any) => o.branch_id === br.id).length
    const totalIncome = journal.filter((x: any) => x.branch_id === br.id && !x.is_passthrough).reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0)
    return { ...br, customers_count: customersCount, orders_count: ordersCount, total_income: totalIncome }
  }), [rows, customers, orders, journal])

  const filtered = useMemo(() => enriched.filter((b) =>
    !search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.location ?? "").toLowerCase().includes(search.toLowerCase())
  ), [enriched, search])

  if (!profile) return null

  return (
    <DashboardLayout profile={profile}>
      <PageHeader title="المعارض / الفروع" subtitle="النقاط اللي بتبتاع للعميل النهائي" helpTitle="المعارض" helpDescription="هنا الـ 4 معارض بتاعة المصنع. كل معرض له عملاء وأوردرات. المعرض يحوّل للمصنع قيمة الأوردرات اللي بيوصلها." backHref="/journal" actions={<><Button variant="secondary" onClick={() => exportToExcel(filtered, "branches")}>تصدير</Button>{can('branches', 'add') && <Button onClick={() => router.push("/branches/new")}>+ معرض جديد</Button>}</>} />
      <div className="card mb-4">
        <FilterBar>
          <div className="flex-1"><SearchBox value={search} onChange={setSearch} placeholder="ابحث باسم المعرض أو الموقع..." /></div>
          <div className="text-sm text-gray-500 mr-auto">النتائج: <strong>{filtered.length}</strong></div>
        </FilterBar>
      </div>
      <DataTable
        loading={loading}
        rows={filtered}
        columns={[
          { key: "name", label: "اسم المعرض", render: (r) => <Link href={"/branches/" + r.id} className="font-semibold text-brand-orange hover:underline">{r.name}</Link> },
          { key: "location", label: "الموقع" },
          { key: "phone", label: "التواصل" },
          { key: "customers_count", label: "عدد العملاء" },
          { key: "orders_count", label: "عدد الأوردرات" },
          { key: "total_income", label: "إجمالي التحويلات", render: (r) => <span className="font-bold text-green-600">{formatCurrency(r.total_income)}</span> },
          { key: "_actions", label: "إجراءات", render: (r) => <RowEditor row={r} apiBase="/api/branches" fields={branchFields} entityLabel="المعرض" deleteHint="لا يمكن حذف هذا المعرض لوجود عملاء أو أوردرات أو تحويلات مرتبطة به" canEdit={can('branches', 'edit')} canDelete={can('branches', 'delete')} /> },
        ]}
      />
    </DashboardLayout>
  )
}


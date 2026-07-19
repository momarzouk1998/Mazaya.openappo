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
import { SearchBox } from "@/components/SearchFilter"
import { Button } from "@/components/ui/Button"
import { exportToExcel } from "@/lib/excel"
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS, ORDER_TYPE_LABELS, daysBetween } from "@/lib/format"

interface Order {
  id: string; order_name: string; status: string; order_type: string
  customer_id: string | null; branch_id: string | null
  start_date: string | null; end_date: string | null; duration_days: number | null
  order_total: number | string | null; total?: number | string | null
  customer_name?: string; branch_name?: string
  notes?: string | null
}

export default function OrdersPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { can } = useCan()
  const { data, loading, refetch } = useApi<{ items: any[] }>("/api/orders?limit=500")
  const { data: branchesData } = useApi<{ items: any[] }>("/api/branches?limit=500")
  const rows: Order[] = data?.items ?? []
  const branches = branchesData?.items ?? []
  const [search, setSearch] = useState("")
  const [branchFilter, setBranchFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const pageSize = 20

  const filtered = useMemo(() => {
    return rows.filter((o) => {
      const matchSearch = !search || o.order_name.toLowerCase().includes(search.toLowerCase()) || (o.customer_name ?? "").toLowerCase().includes(search.toLowerCase())
      const matchBranch = !branchFilter || String(o.branch_id) === branchFilter
      const matchStatus = !statusFilter || o.status === statusFilter
      const matchType = !typeFilter || o.order_type === typeFilter
      const matchDate = (!fromDate || (o.start_date && String(o.start_date) >= fromDate)) && (!toDate || (o.start_date && String(o.start_date) <= toDate))
      return matchSearch && matchBranch && matchStatus && matchType && matchDate
    })
  }, [rows, search, branchFilter, statusFilter, typeFilter, fromDate, toDate])

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const activeFiltersCount = [branchFilter, statusFilter, typeFilter, fromDate, toDate].filter(Boolean).length

  // كاردات الحالات
  const openOrders = filtered.filter(o => o.status === "مفتوح" || o.status === "قيد التنفيذ")
  const completedOrders = filtered.filter(o => o.status === "مكتمل" || o.status === "تم التسليم")
  const deliveredOrders = filtered.filter(o => o.status === "تم التسليم")
  const totalOpen = openOrders.reduce((s, o: any) => s + Number(o.order_total ?? o.total ?? 0), 0)
  const totalCompleted = completedOrders.reduce((s, o: any) => s + Number(o.order_total ?? o.total ?? 0), 0)
  const totalAll = filtered.reduce((s, o: any) => s + Number(o.order_total ?? o.total ?? 0), 0)
  const totalBoards = filtered.reduce((s, o: any) => s + Number(o.boards_cost ?? 0), 0)
  const totalAccessories = filtered.reduce((s, o: any) => s + Number(o.accessories_cost ?? 0), 0)
  const totalMaterials = totalBoards + totalAccessories
  const totalExternalWork = filtered.reduce((s, o: any) => s + Number(o.external_work_total ?? 0), 0)
  const totalInstallation = filtered.reduce((s, o: any) => s + Number(o.installation_cost ?? 0), 0)
  const totalInternalTransport = filtered.reduce((s, o: any) => s + Number(o.internal_transport_cost ?? 0), 0)
  const totalExternalTransport = filtered.reduce((s, o: any) => s + Number(o.external_transport_cost ?? 0), 0)
  const totalFactoryCommission = filtered.reduce((s, o: any) => s + Number(o.factory_commission ?? 0), 0)
  const totalExtraCosts = filtered.reduce((s, o: any) => s + Number(o.extra_costs_total ?? 0), 0)
  const totalManualCosts = totalInstallation + totalInternalTransport + totalExternalTransport + totalFactoryCommission + totalExtraCosts

  function clearFilters() {
    setBranchFilter(""); setStatusFilter(""); setTypeFilter(""); setFromDate(""); setToDate("")
  }

  async function deleteOrder(row: Order) {
    if (!window.confirm("هل تريد حذف الأوردر " + row.order_name + "؟ سيتم إرجاع المواد للمخزون.")) return
    const res = await fetch("/api/orders/" + row.id, { method: "DELETE" })
    if (res.ok) refetch()
    else { const json = await res.json().catch(() => ({})); window.alert("خطأ: " + (json?.error?.message || res.status)) }
  }

  if (!profile) return null

  return (
    <DashboardLayout profile={profile}>
      <PageHeader title="الأوردرات" subtitle={filtered.length + " أوردر مطابق للفلاتر"} helpTitle="الأوردرات" helpDescription="هنا كل أوردرات المصنع. ابحث بالاسم أو العميل، فلتر بالمعرض أو الحالة أو التاريخ." backHref="/journal" actions={can('orders', 'add') ? <Button onClick={() => router.push("/orders/new")}>+ أوردر جديد</Button> : undefined} />

      {/* كاردات الحالات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card bg-white border-t-4 border-brand-orange hover:shadow-elevated transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 font-medium">أوردرات مفتوحة</div>
              <div className="text-3xl font-extrabold text-brand-orange mt-1">{openOrders.length}</div>
              <div className="text-sm font-bold text-brand-orange mt-0.5">{formatCurrency(totalOpen)}</div>
            </div>
            <div className="text-4xl opacity-30">📂</div>
          </div>
        </div>
        <div className="card bg-white border-t-4 border-blue-500 hover:shadow-elevated transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 font-medium">أوردرات مكتملة</div>
              <div className="text-3xl font-extrabold text-blue-600 mt-1">{completedOrders.length}</div>
              <div className="text-sm font-bold text-blue-600 mt-0.5">{formatCurrency(totalCompleted)}</div>
            </div>
            <div className="text-4xl opacity-30">✅</div>
          </div>
        </div>
        <div className="card bg-white border-t-4 border-green-500 hover:shadow-elevated transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 font-medium">تم التسليم</div>
              <div className="text-3xl font-extrabold text-green-600 mt-1">{deliveredOrders.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">من المكتملة</div>
            </div>
            <div className="text-4xl opacity-30">🚚</div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white hover:shadow-elevated transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-90 font-medium">إجمالي كل الأوردرات</div>
              <div className="text-3xl font-extrabold mt-1">{filtered.length}</div>
              <div className="text-sm font-bold opacity-90 mt-0.5">{formatCurrency(totalAll)}</div>
            </div>
            <div className="text-4xl opacity-40">📦</div>
          </div>
        </div>
      </div>

      {/* كاردات المواد والأعمال */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="card bg-white border-t-4 border-brand-orange hover:shadow-elevated transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand-orange-light flex items-center justify-center text-xl">📋</div>
            <div className="text-sm font-bold text-gray-700">المواد</div>
          </div>
          <div className="text-2xl font-extrabold text-brand-black">{formatCurrency(totalMaterials)}</div>
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="text-gray-500">🪵 ألواح: <strong className="text-brand-black">{formatCurrency(totalBoards)}</strong></span>
            <span className="text-gray-500">🔩 اكسسوارات: <strong className="text-brand-black">{formatCurrency(totalAccessories)}</strong></span>
          </div>
        </div>
        <div className="card bg-white border-t-4 border-purple-500 hover:shadow-elevated transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-xl">🔨</div>
            <div className="text-sm font-bold text-gray-700">أعمال خارجية</div>
          </div>
          <div className="text-2xl font-extrabold text-purple-600">{formatCurrency(totalExternalWork)}</div>
          <div className="text-xs text-gray-400 mt-2">إجمالي الأعمال الخارجية على الأوردرات</div>
        </div>
        <div className="card bg-white border-t-4 border-yellow-500 hover:shadow-elevated transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center text-xl">💸</div>
            <div className="text-sm font-bold text-gray-700">تكاليف يدوية</div>
          </div>
          <div className="text-2xl font-extrabold text-yellow-700">{formatCurrency(totalManualCosts)}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
            <span>🔧 تركيبات: <strong className="text-brand-black">{formatCurrency(totalInstallation)}</strong></span>
            <span>📦 نقل داخلي: <strong className="text-brand-black">{formatCurrency(totalInternalTransport)}</strong></span>
            <span>🚛 نقل خارجي: <strong className="text-brand-black">{formatCurrency(totalExternalTransport)}</strong></span>
            <span>🏭 عمولة: <strong className="text-brand-black">{formatCurrency(totalFactoryCommission)}</strong></span>
            <span>🧾 نثريات: <strong className="text-yellow-700">{formatCurrency(filtered.reduce((s, o: any) => s + Number(o.overhead_total ?? 0), 0))}</strong></span>
            <span>➕ تكاليف إضافية: <strong className="text-brand-black">{formatCurrency(totalExtraCosts)}</strong></span>
          </div>
        </div>
      </div>
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]"><SearchBox value={search} onChange={setSearch} placeholder="ابحث باسم الأوردر أو العميل..." /></div>
          <Button variant="secondary" onClick={() => setFilterOpen(true)} className="relative">تصفية{activeFiltersCount > 0 && <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{activeFiltersCount}</span>}</Button>
          <Button variant="secondary" onClick={() => exportToExcel(filtered as any, "orders")}>تصدير</Button>
        </div>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setFilterOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">تصفية الأوردرات</h2><button onClick={() => setFilterOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">✕</button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">المعرض</label><select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white"><option value="">كل المعارض</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white"><option value="">كل الحالات</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">النوع</label><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white"><option value="">كل الأنواع</option>{Object.entries(ORDER_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">من تاريخ</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">إلى تاريخ</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              {activeFiltersCount > 0 && <div className="text-xs text-brand-orange-dark bg-brand-orange-light border border-brand-orange/20 p-2 rounded">تم تطبيق {activeFiltersCount} فلتر (يمكن دمجهم معاً)</div>}
            </div>
            <div className="flex justify-between gap-2 pt-4 mt-4 border-t"><Button variant="secondary" onClick={clearFilters}>مسح الفلاتر</Button><Button onClick={() => setFilterOpen(false)}>تطبيق</Button></div>
          </div>
        </div>
      )}

      <DataTable loading={loading} rows={paged} emptyMessage="لا توجد أوردرات" columns={[
        { key: "order_name", label: "اسم الأوردر", render: (r: any) => <Link href={"/orders/" + r.id} className="font-semibold text-brand-orange hover:underline">{r.order_name}</Link> },
        { key: "type", label: "النوع", render: (r: any) => ORDER_TYPE_LABELS[r.order_type] || r.order_type },
        { key: "customer_name", label: "العميل", render: (r: any) => r.customer_id ? <Link href={`/customers/${r.customer_id}`} className="text-brand-orange hover:underline">{r.customer_name || "-"}</Link> : (r.customer_name || "-") },
        { key: "branch_name", label: "المعرض" },
        { key: "status", label: "الحالة", render: (r: any) => <span className={"badge " + STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</span> },
        { key: "start_date", label: "البدء", render: (r: any) => formatDate(r.start_date) },
        { key: "duration", label: "المدة", render: (r: any) => { const computed = daysBetween(r.start_date ?? "", r.end_date ?? ""); const days = r.duration_days ?? computed; return days != null ? days + " يوم" : "-" } },
        { key: "total", label: "الإجمالي", render: (r: any) => <span className="font-bold">{formatCurrency(Number(r.order_total ?? r.total ?? 0))}</span> },
        { key: "_actions", label: "إجراءات", render: (r: any) => <div className="flex items-center justify-center gap-1"><Link href={"/orders/" + r.id} className="p-1.5 hover:bg-blue-100 rounded text-base" title="عرض">👁️</Link>{can('orders', 'edit') && <Link href={"/orders/" + r.id + "/edit"} className="p-1.5 hover:bg-blue-100 rounded text-base" title="تعديل">✏️</Link>}<Link href={"/orders/" + r.id + "/invoice"} className="p-1.5 hover:bg-blue-100 rounded text-base" title="طباعة فاتورة">🧾</Link>{can('orders', 'delete') && <button onClick={() => deleteOrder(r)} className="p-1.5 hover:bg-red-100 rounded text-base" title="حذف">🗑️</button>}</div> },
      ]} />

      {totalPages > 1 && <div className="flex items-center justify-center gap-2 mt-4"><Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>السابق</Button><span className="text-sm text-gray-600">صفحة {page} من {totalPages}</span><Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button></div>}
    </DashboardLayout>
  )
}


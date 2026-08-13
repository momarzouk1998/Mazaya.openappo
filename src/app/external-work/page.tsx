"use client"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApi, useApiMutation } from "@/hooks/useApi"
import HubTabs, { ORDER_ADDITION_TABS } from "@/components/ui/HubTabs"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { DataTable } from "@/components/DataTable"
import { SearchBox } from "@/components/SearchFilter"
import { Button } from "@/components/ui/Button"
import { Input, Select, Textarea } from "@/components/ui/Input"
import { exportToExcel } from "@/lib/excel"
import { formatCurrency, formatDate } from "@/lib/format"

interface OrderOption {
  id: string
  order_name: string
  code?: string
}

interface ContractorOption {
  id: string
  name: string
}

const WORK_TYPES = [
  { value: "ألوميتال", label: "ألوميتال" },
  { value: "تنجيد", label: "تنجيد" },
  { value: "زجاج", label: "زجاج ومرايا" },
  { value: "دهانات خارجية", label: "دهانات خارجية" },
  { value: "أخرى", label: "أخرى" },
]

export default function ExternalWorkPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { data: extData, loading, refetch } = useApi<{ items: any[] }>("/api/external-work")
  const { data: ordersData } = useApi<{ items: OrderOption[] }>("/api/orders?limit=500")
  const { data: contractorsData } = useApi<{ items: ContractorOption[] }>("/api/contractors?limit=500")
  const { mutate, loading: saving } = useApiMutation()

  const rows: any[] = extData?.items ?? []
  const orders: OrderOption[] = ordersData?.items ?? []
  const contractors: ContractorOption[] = contractorsData?.items ?? []

  const [search, setSearch] = useState("")
  const [showModal, setShowModal] = useState(false)

  const [form, setForm] = useState({
    order_id: "",
    contractor_id: "",
    work_type: "ألوميتال",
    amount: "",
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        !search ||
        (r.order_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.contractor_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.work_type ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.notes ?? "").toLowerCase().includes(search.toLowerCase())
      return matchSearch
    })
  }, [rows, search])

  const totalAmount = filtered.reduce((s, r) => s + Number(r.amount ?? 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.order_id) {
      setError("اختيار الأوردر مطلوب")
      return
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError("المبلغ مطلوب ويجب أن يكون أكبر من صفر")
      return
    }

    const { error: err } = await mutate("POST", "/api/external-work", {
      order_id: form.order_id,
      contractor_id: form.contractor_id || null,
      work_type: form.work_type,
      amount: Number(form.amount),
      notes: form.notes || null,
    })

    if (err) {
      setError(err)
      return
    }

    setShowModal(false)
    setForm({
      order_id: "",
      contractor_id: "",
      work_type: "ألوميتال",
      amount: "",
      notes: "",
    })
    refetch()
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت تأكد من حذف عمل خارجي هذا؟")) return
    const { error: err } = await mutate("DELETE", `/api/external-work/${id}`)
    if (err) {
      alert(err)
      return
    }
    refetch()
  }

  if (!profile) return null

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="الأعمال الخارجية للمقاولين"
        subtitle="تسجيل وتتبع الأعمال الخارجية المسندة للورش والمقاولين لكل أوردر (ألوميتال، تنجيد، زجاج...)"
        backHref="/order-additions"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowModal(true)}>+ عمل خارجي جديد</Button>
          </div>
        }
      />

      <HubTabs tabs={ORDER_ADDITION_TABS} />

      {/* كارد الإجمالي */}
      <div className="mb-4">
        <div className="card bg-gradient-to-br from-emerald-600 to-teal-700 text-white hover:shadow-elevated transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">إجمالي تكاليف الأعمال الخارجية</div>
              <div className="text-4xl font-extrabold mt-1">{formatCurrency(totalAmount)}</div>
              <div className="text-xs opacity-80 mt-1">
                {filtered.length} حركات أعمال خارجية مسجلة
              </div>
            </div>
            <div className="text-6xl opacity-30">🔨</div>
          </div>
        </div>
      </div>

      {/* شريط البحث والفلترة */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchBox value={search} onChange={setSearch} placeholder="ابحث باسم الأوردر، المقاول، نوع العمل..." />
          </div>
          <Button variant="secondary" onClick={() => exportToExcel(filtered as any, "external-work")}>
            تصدير Excel
          </Button>
        </div>
      </div>

      {/* مودال إضافة عمل خارجي */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">🔨 تسجيل عمل خارجي جديد للأوردر</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Select
                  label="الأوردر المباشر *"
                  value={form.order_id}
                  onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                  options={[
                    { value: "", label: "— اختر الأوردر —" },
                    ...orders.map((o) => ({
                      value: o.id,
                      label: `${o.order_name} ${o.code ? `(${o.code})` : ""}`,
                    })),
                  ]}
                />
              </div>

              <div>
                <Select
                  label="المقاول / الورشة (اختياري)"
                  value={form.contractor_id}
                  onChange={(e) => setForm({ ...form, contractor_id: e.target.value })}
                  options={[
                    { value: "", label: "— اختر المقاول —" },
                    ...contractors.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="نوع العمل *"
                  value={form.work_type}
                  onChange={(e) => setForm({ ...form, work_type: e.target.value })}
                  options={WORK_TYPES}
                />
                <Input
                  label="المبلغ (ج.م) *"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <Textarea
                  label="تفاصيل وملاحظات"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="ملاحظات تفصيلية عن الشغل المطلوب..."
                />
              </div>

              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
                <Button type="submit" loading={saving}>حفظ العمل الخارجي</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* الجدول الرئيسي */}
      <DataTable
        loading={loading}
        rows={filtered}
        emptyMessage="لا توجد حركات أعمال خارجية مسجلة"
        columns={[
          { key: "created_at", label: "تاريخ التسجيل", render: (r) => formatDate(r.created_at) },
          {
            key: "order_name",
            label: "الأوردر",
            render: (r) => <span className="font-semibold text-emerald-700">{r.order_name}</span>,
          },
          { key: "work_type", label: "نوع العمل", render: (r) => <span className="badge bg-emerald-100 text-emerald-800">{r.work_type}</span> },
          { key: "contractor_name", label: "المقاول / الورشة", render: (r) => r.contractor_name || "—" },
          {
            key: "amount",
            label: "المبلغ",
            render: (r) => <span className="font-bold text-red-600">{formatCurrency(Number(r.amount ?? 0))}</span>,
          },
          { key: "notes", label: "ملاحظات", render: (r) => r.notes || "-" },
          {
            key: "_actions",
            label: "إجراءات",
            render: (r) => (
              <Button size="sm" variant="danger" onClick={() => handleDelete(r.id)}>
                حذف
              </Button>
            ),
          },
        ]}
      />
    </DashboardLayout>
  )
}

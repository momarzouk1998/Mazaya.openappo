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
import DateInput from "@/components/ui/DateInput"

interface OrderOption {
  id: string
  order_name: string
  code?: string
}

export default function LedExpensesPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { data: ledData, loading, refetch } = useApi<{ items: any[] }>("/api/led-expenses")
  const { data: ordersData } = useApi<{ items: OrderOption[] }>("/api/orders?limit=500")
  const { mutate, loading: saving } = useApiMutation()

  const rows: any[] = ledData?.items ?? []
  const orders: OrderOption[] = ordersData?.items ?? []

  const [search, setSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [showModal, setShowModal] = useState(false)

  const [form, setForm] = useState({
    order_id: "",
    boda_amount: "",
    masnaeya_amount: "",
    payment_method: "نقدي",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)

  const calculatedTotal = useMemo(() => {
    return Number(form.boda_amount || 0) + Number(form.masnaeya_amount || 0)
  }, [form.boda_amount, form.masnaeya_amount])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const rDate = String(r.date ?? "").slice(0, 10)
      const matchSearch =
        !search ||
        (r.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.order_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.notes ?? "").toLowerCase().includes(search.toLowerCase())
      const matchDate = (!fromDate || rDate >= fromDate) && (!toDate || rDate <= toDate)
      return matchSearch && matchDate
    })
  }, [rows, search, fromDate, toDate])

  const grandTotal = filtered.reduce((s, r) => s + Number(r.amount ?? 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (calculatedTotal <= 0) {
      setError("يجب إدخال مبلغ لبضاعة الليد أو المصنعية")
      return
    }

    const { error: err } = await mutate("POST", "/api/led-expenses", {
      order_id: form.order_id || null,
      boda_amount: Number(form.boda_amount || 0),
      masnaeya_amount: Number(form.masnaeya_amount || 0),
      payment_method: form.payment_method,
      date: form.date,
      notes: form.notes || null,
    })

    if (err) {
      setError(err)
      return
    }

    setShowModal(false)
    setForm({
      order_id: "",
      boda_amount: "",
      masnaeya_amount: "",
      payment_method: "نقدي",
      date: new Date().toISOString().slice(0, 10),
      notes: "",
    })
    refetch()
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت تأكد من حذف مصاريف الليد والكهرباء هذه؟")) return
    const { error: err } = await mutate("DELETE", `/api/led-expenses/${id}`)
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
        title="مصاريف الليد والكهرباء"
        subtitle="بضاعة ومصنعية الليد والكهرباء المسندة للأوردرات وتُخصم من يومية المصنع"
        backHref="/order-additions"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowModal(true)}>+ حركة ليد جديدة</Button>
          </div>
        }
      />

      <HubTabs tabs={ORDER_ADDITION_TABS} />

      {/* كارد الإجمالي */}
      <div className="mb-4">
        <div className="card bg-gradient-to-br from-amber-500 to-yellow-600 text-white hover:shadow-elevated transition-all">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-90 font-medium">إجمالي مصاريف الليد والكهرباء</div>
              <div className="text-4xl font-extrabold mt-1">{formatCurrency(grandTotal)}</div>
              <div className="text-xs opacity-80 mt-1">
                {filtered.length} سجلات • تقتطع مباشرة من يومية المصنع
                {(fromDate || toDate) && ` • فترة: ${fromDate || "البداية"} ← ${toDate || "اليوم"}`}
              </div>
            </div>
            <div className="text-6xl opacity-30">💡</div>
          </div>
        </div>
      </div>

      {/* شريط البحث والفلترة */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchBox value={search} onChange={setSearch} placeholder="ابحث باسم الأوردر، التفاصيل..." />
          </div>
          <div className="flex items-center gap-2">
            <DateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="من تاريخ" />
            <DateInput value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="إلى تاريخ" />
          </div>
          <Button variant="secondary" onClick={() => exportToExcel(filtered as any, "led-expenses")}>
            تصدير Excel
          </Button>
        </div>
      </div>

      {/* مودال إضافة حركة ليد */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">💡 تسجيل مصاريف ليد وكهرباء جديدة</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Select
                  label="الأوردر المرتبط (اختياري)"
                  value={form.order_id}
                  onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                  options={[
                    { value: "", label: "— بدون أوردر محدد —" },
                    ...orders.map((o) => ({
                      value: o.id,
                      label: `${o.order_name} ${o.code ? `(${o.code})` : ""}`,
                    })),
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="بضاعة الليد (ج.م)"
                  type="number"
                  step="0.01"
                  value={form.boda_amount}
                  onChange={(e) => setForm({ ...form, boda_amount: e.target.value })}
                  placeholder="0.00"
                />
                <Input
                  label="مصنعية الليد (ج.م)"
                  type="number"
                  step="0.01"
                  value={form.masnaeya_amount}
                  onChange={(e) => setForm({ ...form, masnaeya_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              {calculatedTotal > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm font-semibold flex justify-between">
                  <span>الإجمالي الكلي للحركة:</span>
                  <span className="text-brand-orange-dark font-extrabold">{formatCurrency(calculatedTotal)}</span>
                </div>
              )}

              <div>
                <Input
                  label="التاريخ"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>

              <div>
                <Textarea
                  label="ملاحظات"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="تفاصيل إضافية..."
                />
              </div>

              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
                <Button type="submit" loading={saving}>حفظ الحركة</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* الجدول الرئيسي */}
      <DataTable
        loading={loading}
        rows={filtered}
        emptyMessage="لا توجد حركات مصاريف ليد مسجلة"
        columns={[
          { key: "date", label: "التاريخ", render: (r) => formatDate(r.date) },
          {
            key: "order_name",
            label: "الأوردر",
            render: (r) =>
              r.order_name ? (
                <span className="font-semibold text-amber-700">{r.order_name}</span>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          { key: "description", label: "البيان" },
          {
            key: "amount",
            label: "الإجمالي",
            render: (r) => <span className="font-bold text-red-600">{formatCurrency(Number(r.amount ?? 0))}</span>,
          },
          { key: "notes", label: "تفاصيل البضاعة والمصنعية", render: (r) => r.notes || "-" },
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

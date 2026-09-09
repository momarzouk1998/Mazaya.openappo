"use client"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApi } from "@/hooks/useApi"
import PageHeader from "@/components/PageHeader"
import { Input, Select, Textarea } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { formatCurrency } from "@/lib/format"

export default function BuyAccessoriesPage() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { data: accessoriesData } = useApi<{ items: any[] }>("/api/accessories?limit=500")
  const { data: suppliersData } = useApi<{ items: any[] }>("/api/suppliers?limit=500")
  const accessories: any[] = accessoriesData?.items ?? []
  const suppliers: any[] = suppliersData?.items ?? []

  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [form, setForm] = useState({
    item_id: "",
    quantity: "",
    unit_price: "",
    supplier_id: "",
    payment_method: "نقدي",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    create_journal: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => accessories.filter((a) =>
    !search || a.item_name.toLowerCase().includes(search.toLowerCase()) || (a.code ?? "").toLowerCase().includes(search.toLowerCase())
  ).slice(0, 30), [accessories, search])

  const selected = accessories.find((a) => a.id === selectedId || a.id === form.item_id)
  const total = Number(form.quantity || 0) * Number(form.unit_price || 0)

  function selectAccessory(a: any) {
    setSelectedId(a.id)
    setForm((f) => ({ ...f, item_id: a.id, unit_price: String(a.unit_price ?? ""), supplier_id: a.supplier_id ? String(a.supplier_id) : f.supplier_id }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.item_id) { setError("اختار صنف من القائمة"); return }
    if (!form.quantity || Number(form.quantity) <= 0) { setError("الكمية يجب أن تكون أكبر من صفر"); return }
    if (Number(form.unit_price) < 0) { setError("سعر الشراء غير صالح"); return }
    setSaving(true)
    const res = await fetch("/api/accessories/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: form.item_id,
        quantity: Number(form.quantity),
        unit_price: Number(form.unit_price),
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        payment_method: form.payment_method,
        date: form.date,
        notes: form.notes || null,
        create_journal: form.create_journal,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json?.error?.message || "حدث خطأ"); return }
    router.push("/accessories")
    router.refresh()
  }

  if (!profile) return null

  return (
    <>
      <PageHeader title="شراء اكسسوارات" subtitle="إضافة كمية من صنف موجود + تسجيل الحركة في اليومية" backHref="/accessories" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-bold mb-3">1️⃣ اختار الصنف</h3>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الكود..." className="mb-3" />
          <div className="max-h-96 overflow-y-auto divide-y">
            {filtered.length === 0 ? <div className="text-gray-400 text-center py-6">لا توجد نتائج</div> : filtered.map((a) => (
              <div key={a.id} onClick={() => selectAccessory(a)} className={"p-3 cursor-pointer rounded-lg transition " + (selectedId === a.id ? "bg-brand-orange text-white" : "hover:bg-gray-50")}>
                <div className="font-medium text-sm">{a.item_name}</div>
                <div className={"text-xs " + (selectedId === a.id ? "text-white opacity-80" : "text-gray-500")}>{a.code} • متوفر: {Number(a.quantity_remaining ?? 0)} • سعر: {formatCurrency(Number(a.unit_price ?? 0))}</div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <h3 className="font-bold">2️⃣ تفاصيل الشراء</h3>
          {selected && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="font-medium text-brand-black">{selected.item_name}</div>
              <div className="text-gray-600 text-xs">كود: {selected.code} • المتاح حالياً: {Number(selected.quantity_remaining ?? 0)} • آخر سعر: {formatCurrency(Number(selected.unit_price ?? 0))}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="الكمية *" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            <Input label="سعر شراء الوحدة *" type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} required hint="السعر الجديد للمخزون" />
          </div>
          <Select label="المورد" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} options={[{ value: "", label: "— بدون مورد —" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="التاريخ" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Select label="طريقة الدفع" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} options={[{ value: "نقدي", label: "نقدي" }, { value: "تحويل", label: "تحويل" }]} />
          </div>
          <Textarea label="ملاحظات" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={form.create_journal} onChange={(e) => setForm({ ...form, create_journal: e.target.checked })} className="mt-1 accent-brand-orange" />
            <div className="text-sm">
              <div className="font-medium">تسجيل في اليومية</div>
              <div className="text-gray-500 text-xs mt-0.5">سيسجل المشتريات في اليومية تلقائياً</div>
            </div>
          </label>
          {total > 0 && <div className="bg-gradient-to-l from-brand-orange to-brand-orange-dark text-white p-3 rounded-lg flex items-center justify-between"><span className="font-bold">إجمالي الفاتورة</span><span className="text-xl font-extrabold">{formatCurrency(total)}</span></div>}
          {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => router.back()}>إلغاء</Button>
            <Button type="submit" loading={saving} disabled={!form.item_id}>💾 تسجيل الشراء</Button>
          </div>
        </form>
      </div>
    </>
  )
}


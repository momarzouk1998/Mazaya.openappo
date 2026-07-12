"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApiMutation } from "@/hooks/useApi"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { Input, Textarea, Select } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import Combobox from "@/components/ui/Combobox"
import { formatCurrency } from "@/lib/format"
import { PAYMENT_METHOD_LABELS } from "@/lib/format"

const CATEGORIES = [
  { value: "", label: "— اختر التصنيف —" },
  { value: "أجور عمال", label: "أجور عمال" },
  { value: "نثريات عامة", label: "نثريات عامة" },
  { value: "غداء", label: "غداء" },
  { value: "كهرباء", label: "كهرباء" },
  { value: "شحن", label: "شحن / نقل" },
  { value: "صيانة", label: "صيانة" },
  { value: "أخرى", label: "أخرى" },
]

export default function NewOverheadForm() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "",
    description: "",
    amount: "",
    payment_method: "نقدي",
    notes: "",
  })
  const [workerId, setWorkerId] = useState("")
  const [workerName, setWorkerName] = useState("")
  const { mutate, loading: saving } = useApiMutation()
  const [error, setError] = useState<string | null>(null)

  const isWages = form.category === "أجور عمال"

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isWages) {
      if (!workerId || !form.amount) {
        setError("لأجور العمال: اختيار العامل والمبلغ مطلوب")
        return
      }
    } else if (!form.description || !form.amount) {
      setError("البيان والمبلغ مطلوبين")
      return
    }
    setError(null)
    // For wages, auto-fill description with worker name if empty
    const description = isWages ? (form.description || `أجر عامل: ${workerName}`) : form.description
    const { error: err } = await mutate("POST", "/api/overhead?create_journal=true", {
      date: form.date,
      category: form.category || null,
      description,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      notes: form.notes || null,
      worker_id: isWages ? workerId : null,
    })
    if (err) { setError(err); return }
    router.push("/overhead")
    router.refresh()
  }

  if (!profile) return null
  return (
    <DashboardLayout profile={profile}>
      <PageHeader title="نثريات جديدة" subtitle="أجور عمال، كهرباء، شحن، إلخ" backHref="/overhead" />
      <form onSubmit={onSubmit} className="card max-w-xl space-y-4">
        <Input label="التاريخ" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <Select label="التصنيف" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, description: "" })} options={CATEGORIES} />

        {isWages ? (
          <Combobox
            label="اسم العامل *"
            endpoint="/api/workers?limit=500"
            value={workerId}
            onChange={(id, name) => { setWorkerId(id); setWorkerName(name || "") }}
            placeholder="ابحث عن عامل أو أضف جديد..."
            hint="اكتب اسم العامل — لو موجود هيظهر واختاره، لو جديد اكتبه كامل واضغط 'إضافة'."
          />
        ) : null}

        {!isWages && (
          <Input label="البيان *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: كهرباء المصنع، شحن بضاعة" required />
        )}
        {isWages && (
          <Input label="بيان إضافي (اختياري)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: أسبوع 3 — سيترك فارغاً افتراضياً" />
        )}

        <Input label="المبلغ *" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        <Select label="طريقة الدفع" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} options={Object.entries(PAYMENT_METHOD_LABELS).filter(([k]) => k !== "both" && k !== "كلاهما").map(([k, v]) => ({ value: k, label: v }))} />
        <Textarea label="ملاحظات" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        {form.amount && <div className="bg-brand-orange-light border border-brand-orange/20 text-brand-orange-dark p-3 rounded-lg text-sm">سيتم تسجيل الحركة تلقائياً في اليومية بمبلغ <strong>{formatCurrency(Number(form.amount))}</strong>{isWages && workerName && <> للعامل <strong>{workerName}</strong></>}</div>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" loading={saving}>حفظ</Button>
        </div>
      </form>
    </DashboardLayout>
  )
}

"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApi, useApiMutation } from "@/hooks/useApi"
import PageHeader from "@/components/PageHeader"
import { Input, Select, Textarea } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

export default function NewSupplierPage() {
  const router = useRouter()
  const { user, initialized } = useUserStore()
  const { data: suppliersData } = useApi<{ items: any[] }>("/api/suppliers?limit=500")
  const suppliers: any[] = suppliersData?.items ?? []

  const [form, setForm] = useState({ name: "", payment_type: "", phone: "", notes: "" })
  const [error, setError] = useState<string | null>(null)
  const { mutate, loading } = useApiMutation()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) { setError("اسم الشركة مطلوب"); return }
    if (!form.payment_type.trim()) { setError("نوع التعامل مطلوب"); return }
    const { error: err } = await mutate("POST", "/api/suppliers", form)
    if (err) { setError(err); return }
    router.push("/suppliers")
    router.refresh()
  }

  if (!initialized) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full"></div></div>
  if (!user) return null

  // unique payment types from existing suppliers
  const knownTypes = Array.from(new Set(suppliers.map((s) => s.payment_type).filter(Boolean)))

  return (
    <>
      <PageHeader title="مورد جديد" backHref="/suppliers" />
      <form onSubmit={onSubmit} className="card max-w-2xl space-y-4">
        <Input label="اسم الشركة *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">نوع التعامل *</label>
          <input list="payment-type-list" type="text" value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })} placeholder="مثال: نقدي، تحويل، شيك، آجل" required className="w-full px-3 py-2 border rounded-lg" />
          <datalist id="payment-type-list">
            {knownTypes.map((t) => <option key={t} value={t} />)}
          </datalist>
          <p className="text-xs text-gray-500 mt-1">💡 اكتب نوع جديد أو اختار من اللي موجود</p>
        </div>

        <Input label="رقم التواصل" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Textarea label="ملاحظات" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" loading={loading}>حفظ</Button>
        </div>
      </form>
    </>
  )
}


"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApi } from "@/hooks/useApi"
import { useApiMutation } from "@/hooks/useApi"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { Input, Textarea } from "@/components/ui/Input"
import Combobox from "@/components/ui/Combobox"
import { Button } from "@/components/ui/Button"
import { ENTRY_TYPE_LABELS, formatCurrency } from "@/lib/format"

export default function NewJournalForm() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { data: suppliersData } = useApi<{ items: any[] }>("/api/suppliers?limit=500")
  const { data: branchesData } = useApi<{ items: any[] }>("/api/branches?limit=500")
  const { data: contractorsData } = useApi<{ items: any[] }>("/api/contractors?limit=500")
  const { data: ordersData } = useApi<{ items: any[] }>("/api/orders?limit=500")
  const { data: journalData } = useApi<any>("/api/journal?limit=500")
  const suppliers = suppliersData?.items ?? []
  const branches = branchesData?.items ?? []
  const contractors = contractorsData?.items ?? []
  const orders = ordersData?.items ?? []
  const journalEntries: any[] = Array.isArray(journalData) ? journalData : (journalData?.entries ?? [])

  // unique values from existing journal entries
  // نوّحد القيم الإنجليزي للعربي عشان متظهرش كخيارات مكررة
  const normalizePayment = (p: string) =>
    p === "cash" ? "نقدي" :
    p === "transfer" ? "تحويل" :
    p === "both" ? "كلاهما" : p;
  const knownDescriptions = Array.from(new Set(journalEntries.map((j) => j.description).filter(Boolean)))
  const knownPaymentMethods = Array.from(new Set(
    journalEntries
      .map((j) => normalizePayment(j.payment_method))
      .filter((v) => v && v !== "both" && v !== "كلاهما" && v !== "نقدي" && v !== "تحويل")
  ))

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    entry_type: "دفعة واردة من معرض",
    description: "",
    amount: "",
    payment_method: "نقدي",
    supplier_id: "", branch_id: "", contractor_id: "", order_id: "",
    is_passthrough: false,
    notes: "",
  })
  const [error, setError] = useState<string | null>(null)
  const { mutate, loading: saving } = useApiMutation()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim() || !form.amount) { setError("البيان والمبلغ مطلوبين"); return }
    setError(null)
    const payload: any = {
      date: form.date, entry_type: form.entry_type, description: form.description,
      amount: Number(form.amount), payment_method: form.payment_method,
      supplier_id: form.supplier_id || null,
      branch_id: form.branch_id || null,
      contractor_id: form.contractor_id || null,
      order_id: form.order_id || null,
      // التمريري يتفعل تلقائياً لو النوع "تحويل تمريري" + المستخدم يقدر يفعله يدوياً
      is_passthrough: form.is_passthrough || form.entry_type === "تحويل تمريري",
      notes: form.notes || null,
    }
    const { error: err } = await mutate("POST", "/api/journal", payload)
    if (err) { setError(err); return }
    router.push("/journal")
    router.refresh()
  }

  if (!profile) return null
  const isPass = form.entry_type === "تحويل تمريري"

  return (
    <DashboardLayout profile={profile}>
      <PageHeader title="حركة يومية جديدة" backHref="/journal" />
      <form onSubmit={onSubmit} className="card max-w-2xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="التاريخ" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نوع الحركة *</label>
            <input list="entry-type-list" type="text" value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })} required className="w-full px-3 py-2 border rounded-lg" />
            <datalist id="entry-type-list">{Object.entries(ENTRY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</datalist>
            <p className="text-xs text-gray-500 mt-1">💡 اختار من القائمة أو اكتب نوع جديد</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">البيان *</label>
          <input list="description-list" type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="مثال: كهرباء المصنع، شراء خشب" className="w-full px-3 py-2 border rounded-lg" />
          <datalist id="description-list">{knownDescriptions.map((d) => <option key={d} value={d} />)}</datalist>
          <p className="text-xs text-gray-500 mt-1">💡 اختار بيان موجود أو اكتب جديد</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="المبلغ *" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع</label>
            <input list="payment-method-list" type="text" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <datalist id="payment-method-list">
              <option value="نقدي" />
              <option value="تحويل" />
              {knownPaymentMethods.map((p) => <option key={p} value={p} />)}
            </datalist>
            <p className="text-xs text-gray-500 mt-1">💡 اكتب طريقة جديدة أو اختار من الموجودة</p>
          </div>
        </div>

        {form.entry_type === "دفعة واردة من معرض" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المعرض</label>
            <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              <option value="">— اختر —</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        {(form.entry_type === "مشتريات" || form.entry_type === "دفعة صادرة لمورد") && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المورد</label>
            <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              <option value="">— اختر —</option>
              {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        {isPass && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">من (المعرض)</label>
              <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">— اختر —</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">إلى (المورد)</label>
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">— اختر —</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={form.is_passthrough} onChange={(e) => setForm({ ...form, is_passthrough: e.target.checked })} className="mt-1 accent-brand-orange" />
              <div className="text-sm">
                <div className="font-medium">تمريري — لا يؤثر على صافي الرصيد</div>
                <div className="text-gray-500 text-xs mt-0.5">فعّل ده لو المعرض حوّل مباشرة للمورد (دخلت وخرجت في نفس الوقت).</div>
              </div>
            </label>
          </>
        )}
        {form.entry_type === "نثريات" && <div className="bg-purple-50 text-purple-700 text-sm p-3 rounded-lg">💡 الأفضل تسجيل النثريات من صفحة "النثريات" — هتترتبط هنا تلقائياً.</div>}

        <Combobox
          label="الأوردر المرتبط (اختياري)"
          placeholder="🔍 ابحث باسم الأوردر..."
          endpoint="/api/orders?limit=500"
          value={form.order_id}
          onChange={(id) => setForm({ ...form, order_id: id })}
          allowCreate={false}
          nameKey="order_name"
        />

        <Textarea label="ملاحظات" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <div className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
          <span className="text-gray-600">المبلغ:</span>
          <span className="text-2xl font-extrabold text-brand-orange">{formatCurrency(Number(form.amount) || 0)}</span>
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" loading={saving}>حفظ</Button>
        </div>
      </form>
    </DashboardLayout>
  )
}


"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApi, useApiMutation } from "@/hooks/useApi"
import PageHeader from "@/components/PageHeader"
import { Input, Select, Textarea } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { formatCurrency } from "@/lib/format"

interface Props { category: "boards" | "accessories" }

export default function NewInventoryForm({ category }: Props) {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const { mutate, loading: saving } = useApiMutation()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [knownMaterials, setKnownMaterials] = useState<string[]>([])
  const [knownTypes, setKnownTypes] = useState<string[]>([])
  const [newMaterial, setNewMaterial] = useState("")
  const [newType, setNewType] = useState("")
  const [addingMaterial, setAddingMaterial] = useState(false)
  const [addingType, setAddingType] = useState(false)
  const [form, setForm] = useState({
    item_name: "", code: "", supplier_id: "",
    type: "", unit_price: "", quantity_in: "", notes: "",
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/suppliers?limit=500").then((r) => r.json()).then((d) => {
      if (d.ok) setSuppliers(d.data.items ?? [])
    })
  }, [])

  function loadMaterials(cat: "boards" | "accessories") {
    fetch("/api/material-types?category=" + (cat === "boards" ? "board" : "accessory") + "&limit=500")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setKnownMaterials((d.data.items ?? []).map((m: any) => m.name))
        } else {
          console.error("Failed to load material types", d.error)
        }
      })
      .catch((err) => {
        console.error("Failed to load material types", err)
      })
  }

  useEffect(() => { loadMaterials(category) }, [category])

  // When category = accessories, also load known "type" field (currently same as material_types accessory)
  useEffect(() => {
    if (category !== "accessories") return
    setKnownTypes(["مفصلات", "سكك درج", "مقابض", "مسامير", "إكسسوار عام", "أخرى"])
  }, [category])

  async function quickAddMaterial() {
    const name = newMaterial.trim()
    if (!name) return
    setAddingMaterial(true)
    const cat = category === "boards" ? "board" : "accessory"
    const r = await fetch("/api/material-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category: cat }),
    })
    if (r.ok) {
      setKnownMaterials((arr) => Array.from(new Set([...arr, name])))
      setForm((f) => ({ ...f, type: name }))
      setNewMaterial("")
    } else {
      const j = await r.json().catch(() => ({}))
      alert(j?.error?.message || "خطأ في الإضافة")
    }
    setAddingMaterial(false)
  }

  async function quickAddType() {
    const name = newType.trim()
    if (!name) return
    setAddingType(true)
    const r = await fetch("/api/material-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category: "accessory" }),
    })
    if (r.ok) {
      setKnownTypes((arr) => Array.from(new Set([...arr, name])))
      setForm((f) => ({ ...f, type: name }))
      setNewType("")
    } else {
      const j = await r.json().catch(() => ({}))
      alert(j?.error?.message || "خطأ في الإضافة")
    }
    setAddingType(false)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.item_name || !form.code || !form.unit_price || !form.quantity_in) {
      setError("املا الحقول المطلوبة")
      return
    }
    const payload: any = {
      item_name: form.item_name, code: form.code,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      unit_price: Number(form.unit_price), quantity_in: Number(form.quantity_in),
      notes: form.notes || null,
    }
    if (category === "boards") payload.material_type = form.type || null
    else payload.type = form.type || null

    const apiPath = category === "boards" ? "/api/boards" : "/api/accessories"
    const res = await fetch(apiPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await res.json()
    if (!res.ok) { setError(result?.error?.message || "حدث خطأ"); return }
    router.push("/" + category)
    router.refresh()
  }

  if (!profile) return null
  const backHref = "/" + category
  const typeLabel = category === "boards" ? "خامة اللوح" : "نوع الاكسسوار"

  return (
    <>
      <PageHeader title={category === "boards" ? "لوح جديد" : "اكسسوار جديد"} backHref={backHref} />
      <form onSubmit={onSubmit} className="card max-w-2xl space-y-4">
        <Input label="اسم الصنف (البيان) *" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} required />
        <Input label="الكود *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required hint="الكود فريد لكل صنف" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{typeLabel}</label>
          <div className="flex gap-2">
            <input list={category === "boards" ? "material-list" : "type-list"} type="text" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder={category === "boards" ? "مثال: خشب طبيعي" : "مثال: مفصلات"} className="flex-1 px-3 py-2 border rounded-lg" />
            <datalist id="material-list">{knownMaterials.map((m) => <option key={m} value={m} />)}</datalist>
            <datalist id="type-list">{knownTypes.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div className="flex gap-2 mt-2">
            <input type="text" value={category === "boards" ? newMaterial : newType} onChange={(e) => (category === "boards" ? setNewMaterial(e.target.value) : setNewType(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); category === "boards" ? quickAddMaterial() : quickAddType() } }} placeholder={"إضافة " + typeLabel + " جديد"} className="flex-1 px-3 py-2 border rounded-lg text-sm" />
            <Button type="button" variant="secondary" onClick={category === "boards" ? quickAddMaterial : quickAddType} loading={category === "boards" ? addingMaterial : addingType}>+ إضافة للقائمة</Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">💡 اكتب اسم جديد أو اختار من اللي موجود</p>
        </div>

        <Select label="المورد" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} options={[{ value: "", label: "— بدون مورد —" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="سعر الوحدة *" type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} required />
          <Input label="الكمية *" type="number" value={form.quantity_in} onChange={(e) => setForm({ ...form, quantity_in: e.target.value })} required />
        </div>
        {form.unit_price && form.quantity_in && <div className="bg-blue-50 p-3 rounded-lg text-sm">إجمالي التكلفة: <strong>{formatCurrency(Number(form.unit_price) * Number(form.quantity_in))}</strong></div>}
        <Textarea label="ملاحظات" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" loading={saving}>حفظ</Button>
        </div>
      </form>
    </>
  )
}


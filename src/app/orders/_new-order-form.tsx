"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApi } from "@/hooks/useApi"
import { useApiMutation } from "@/hooks/useApi"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { Input, Select, Textarea } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { formatCurrency } from "@/lib/format"

interface Item { id: string; name: string; code: string; remaining: number; price: number; category: "board" | "accessory"; }

type Tab = "info" | "materials" | "costs" | "external"

export default function NewOrderForm() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const editingId = params?.id
  const { user: profile } = useUserStore()

  const [tab, setTab] = useState<Tab>("info")
  const { mutate, loading: saving } = useApiMutation()
  const [error, setError] = useState<string | null>(null)

  const { data: branchesData } = useApi<{ items: any[] }>("/api/branches?limit=500")
  const { data: customersData } = useApi<{ items: any[] }>("/api/customers?limit=500")
  const { data: allOrdersData } = useApi<{ items: any[] }>("/api/orders?limit=200")
  const { data: contractorsData } = useApi<{ items: any[] }>("/api/contractors?limit=500")
  const { data: boardsData } = useApi<{ items: any[] }>("/api/boards?limit=500")
  const { data: accessoriesData } = useApi<{ items: any[] }>("/api/accessories?limit=500")

  const branches: any[] = branchesData?.items ?? []
  const customers: any[] = customersData?.items ?? []
  const allOrders: any[] = allOrdersData?.items ?? []
  const contractors: any[] = contractorsData?.items ?? []
  const boardsRaw: any[] = boardsData?.items ?? []
  const accessoriesRaw: any[] = accessoriesData?.items ?? []

  const [weekOverhead, setWeekOverhead] = useState(0)

  useEffect(() => {
    fetch("/api/overhead?limit=500").then((r) => r.json()).then((d) => {
      const items = d?.data?.expenses ?? d?.data?.items ?? []
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      setWeekOverhead(items.filter((x: any) => String(x.date) >= weekAgo).reduce((s: number, x: any) => s + Number(x.amount ?? 0), 0))
    })
  }, [])

  const [order, setOrder] = useState({
    order_name: "",
    customer_id: "",
    branch_id: "",
    order_type: "تصنيع جديد",
    parent_order_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    status: "مفتوح",
    workers_count: "",
    notes: "",
  })

  const items: Item[] = useMemo(() => [
    ...boardsRaw.map((b: any) => ({ id: b.id, name: b.item_name, code: b.code, remaining: Number(b.quantity_remaining ?? 0), price: Number(b.unit_price ?? 0), category: "board" as const })),
    ...accessoriesRaw.map((a: any) => ({ id: a.id, name: a.item_name, code: a.code, remaining: Number(a.quantity_remaining ?? 0), price: Number(a.unit_price ?? 0), category: "accessory" as const })),
  ], [boardsRaw, accessoriesRaw])

  const [searchItem, setSearchItem] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<"all" | "board" | "accessory">("all")
  const [usedItems, setUsedItems] = useState<{ id: string; category: "board" | "accessory"; quantity: number; original_quantity?: number; unit_price: number; name: string }[]>([])

  const [costs, setCosts] = useState({
    installation_cost: 0,
    installation_travel_days: 0,
    internal_transport_cost: 0,
    external_transport_cost: 0,
    factory_commission: 0,
  })

  // External work — types are now TEXT input with datalist
  const [externalWorks, setExternalWorks] = useState<{ work_type: string; contractor_id: string; amount: number; notes: string }[]>([])
  const [customWorkType, setCustomWorkType] = useState("")
  const [knownWorkTypes, setKnownWorkTypes] = useState<string[]>(["ألوميتال", "تنجيد", "دهان", "تركيب إضاءة", "نجارة خارجية"])

  // Extra costs — dynamic rows (type + amount + notes)
  const [extraCosts, setExtraCosts] = useState<{ cost_type: string; amount: number; notes: string }[]>([])
  const [knownCostTypes, setKnownCostTypes] = useState<string[]>(["أجور عمال", "كهرباء", "شحن", "صيانة", "أخرى"])

  function addCustomWorkType() {
    const t = customWorkType.trim()
    if (!t) return
    if (!knownWorkTypes.includes(t)) setKnownWorkTypes([...knownWorkTypes, t])
    setCustomWorkType("")
  }

  useEffect(() => {
    if (!editingId && !order.branch_id && branches.length > 0) {
      const defaultBranch = branches.find((b: any) => b.name === "مزايا" || b.name === "مازايا");
      if (defaultBranch) {
        setOrder(prev => ({ ...prev, branch_id: String(defaultBranch.id) }));
      }
    }
  }, [branches, editingId, order.branch_id]);

  useEffect(() => {
    if (!editingId) return
    ;(async () => {
      const [ordRes, matsRes, extRes, extraRes] = await Promise.all([
        fetch("/api/orders/" + editingId).then((r) => r.json()),
        fetch("/api/orders/" + editingId + "/materials").then((r) => r.json()),
        fetch("/api/orders/" + editingId + "/external-work").then((r) => r.json()),
        fetch("/api/orders/" + editingId + "/extra-costs").then((r) => r.json()),
      ])
      const ord = ordRes?.data
      if (ord) {
        setOrder({
          order_name: ord.order_name ?? "",
          customer_id: String(ord.customer_id ?? ""),
          branch_id: String(ord.branch_id ?? ""),
          order_type: ord.order_type ?? "تصنيع جديد",
          parent_order_id: String(ord.parent_order_id ?? ""),
          start_date: ord.start_date ? String(ord.start_date).slice(0, 10) : "",
          end_date: ord.end_date ? String(ord.end_date).slice(0, 10) : "",
          status: ord.status ?? "مفتوح",
          workers_count: ord.workers_count != null ? String(ord.workers_count) : "",
          notes: ord.notes ?? "",
        })
        setCosts({
          installation_cost: Number(ord.installation_cost ?? 0),
          // (F6) نقرأ القيمة الحقيقية من الـ API بدل ما نبقيها 0
          installation_travel_days: Number(ord.installation_travel_days ?? 0),
          internal_transport_cost: Number(ord.internal_transport_cost ?? 0),
          external_transport_cost: Number(ord.external_transport_cost ?? 0),
          factory_commission: Number(ord.factory_commission ?? 0),
        })
      }
      const mats = matsRes?.data ?? []
      setUsedItems(mats.map((m: any) => ({
        id: m.item_id,
        category: m.item_category === "accessories_inventory" ? "accessory" : "board",
        quantity: Number(m.quantity_used ?? 0),
        original_quantity: Number(m.quantity_used ?? 0),
        unit_price: Number(m.unit_price_snapshot ?? 0),
        name: m.item_name ?? "-",
      })))
      const ext = extRes?.data ?? []
      setExternalWorks(ext.map((e: any) => ({
        work_type: e.work_type ?? "",
        contractor_id: String(e.contractor_id ?? ""),
        amount: Number(e.amount ?? 0),
        notes: e.notes ?? "",
      })))
      const types = Array.from(new Set([...knownWorkTypes, ...ext.map((e: any) => e.work_type).filter(Boolean)]))
      setKnownWorkTypes(types)
      // Load extra costs
      const extra = extraRes?.data ?? []
      const loadedExtra = extra.map((e: any) => ({
        cost_type: e.cost_type ?? "",
        amount: Number(e.amount ?? 0),
        notes: e.notes ?? "",
      }))
      setExtraCosts(loadedExtra)
      const costTypes = Array.from(new Set([...knownCostTypes, ...loadedExtra.map((e) => e.cost_type).filter(Boolean)]))
      setKnownCostTypes(costTypes)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  function setCustomer(id: string) {
    setOrder((o) => {
      const c = customers.find((x) => String(x.id) === id)
      return { ...o, customer_id: id, branch_id: c?.branch_id ? String(c.branch_id) : o.branch_id }
    })
  }

  const filteredItems = useMemo(() => items.filter((i) => {
    const matchSearch = !searchItem || i.name.toLowerCase().includes(searchItem.toLowerCase()) || i.code.toLowerCase().includes(searchItem.toLowerCase())
    const matchCat = categoryFilter === "all" || i.category === categoryFilter
    return matchSearch && matchCat
  }).slice(0, 30), [items, searchItem, categoryFilter])

  function addItem(item: Item) {
    if (usedItems.some((u) => u.id === item.id && u.category === item.category)) return
    setUsedItems((s) => [...s, { id: item.id, category: item.category, quantity: 1, unit_price: item.price, name: item.name }])
  }
  function updateUsedQty(index: number, qty: number) { setUsedItems((s) => s.map((u, i) => i === index ? { ...u, quantity: qty } : u)) }
  function removeUsed(index: number) { setUsedItems((s) => s.filter((_, i) => i !== index)) }

  const boardsCost = usedItems.filter((u) => u.category === "board").reduce((s, u) => s + (u.quantity * u.unit_price), 0)
  const accessoriesCost = usedItems.filter((u) => u.category === "accessory").reduce((s, u) => s + (u.quantity * u.unit_price), 0)
  const extraCostsTotal = extraCosts.reduce((s, e) => s + (e.amount || 0), 0)
  const externalWorkTotal = externalWorks.reduce((s, e) => s + (e.amount || 0), 0)
  const orderTotal = boardsCost + accessoriesCost
    + (costs.installation_cost || 0) + (costs.internal_transport_cost || 0)
    + (costs.external_transport_cost || 0) + (costs.factory_commission || 0)
    + extraCostsTotal
    + externalWorkTotal

  async function onSubmit() {
    setError(null)
    if (!order.order_name.trim()) { setError("اسم الأوردر مطلوب"); setTab("info"); return }
    const payload: any = {
      order_name: order.order_name,
      // branch_id و customer_id في الـ DB نوعهم UUID (مش int)
      customer_id: order.customer_id || null,
      branch_id: order.branch_id || null,
      order_type: order.order_type,
      parent_order_id: order.parent_order_id || null,
      start_date: order.start_date || null,
      end_date: order.end_date || null,
      status: order.status,
      // (F6) — لازم نبعت كل التكاليف في الـ payload وإلا الـ PATCH
      // هيتجاهلها بسبب الـ allowed list
      installation_cost: Number(costs.installation_cost ?? 0),
      installation_travel_days: Number(costs.installation_travel_days ?? 0),
      internal_transport_cost: Number(costs.internal_transport_cost ?? 0),
      external_transport_cost: Number(costs.external_transport_cost ?? 0),
      factory_commission: Number(costs.factory_commission ?? 0),
      workers_count: order.workers_count ? Number(order.workers_count) : 0,
      notes: order.notes || null,
    }
    let orderId: string
    if (editingId) {
      const { error: err } = await mutate("PATCH", "/api/orders/" + editingId, payload)
      if (err) { setError(err); return }
      orderId = editingId
      await fetch("/api/orders/" + orderId + "/materials?material_id=all", { method: "DELETE" })
    } else {
      const { error: err, data: newOrder } = await mutate("POST", "/api/orders", payload)
      if (err) { setError(err); return }
      orderId = newOrder?.id
      if (!orderId) { setError("خطأ في الحفظ"); return }
    }

    if (usedItems.length > 0) {
      const mats = usedItems.map((u) => ({
        item_category: u.category === "board" ? "boards_inventory" : "accessories_inventory",
        item_id: u.id,
        quantity_used: u.quantity,
        unit_price_snapshot: u.unit_price,
      }))
      const matRes = await mutate("POST", "/api/orders/" + orderId + "/materials", mats)
      if (matRes.error) { setError("خطأ في حفظ المواد: " + matRes.error); return }
    }

    await mutate("PATCH", "/api/orders/" + orderId, costs)

    if (editingId) await fetch("/api/orders/" + orderId + "/external-work?external_id=all", { method: "DELETE" })
    if (externalWorks.length > 0) {
      const ext = externalWorks
        .filter((e) => e.work_type) // المقاول اختياري — نحفظ أي عمل عنده نوع
        .map((e) => ({
          order_id: orderId,
          work_type: e.work_type,
          contractor_id: e.contractor_id || null, // UUID نصي — من غير Number()
          amount: e.amount,
          notes: e.notes || null,
        }))
      if (ext.length > 0) await mutate("POST", "/api/orders/" + orderId + "/external-work", ext)
    }

    // Save extra costs
    if (editingId) await fetch("/api/orders/" + orderId + "/extra-costs?extra_id=all", { method: "DELETE" })
    if (extraCosts.length > 0) {
      const extCosts = extraCosts.filter((e) => e.cost_type && e.amount > 0).map((e) => ({
        cost_type: e.cost_type,
        amount: e.amount,
        notes: e.notes || null,
      }))
      if (extCosts.length > 0) await mutate("POST", "/api/orders/" + orderId + "/extra-costs", extCosts)
    }

    router.push("/orders/" + orderId)
    router.refresh()
  }

  if (!profile) return null

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "info", label: "بيانات أساسية", icon: "📋" },
    { key: "materials", label: "المواد (" + usedItems.length + ")", icon: "📦" },
    { key: "costs", label: "التكاليف", icon: "💰" },
    { key: "external", label: "أعمال خارجية", icon: "🔨" },
  ]

  return (
    <DashboardLayout profile={profile}>
      <PageHeader title={editingId ? "تعديل أوردر" : "أوردر جديد"} subtitle="أنشئ أوردر تصنيع أو صيانة وربطه بالخامات والعميل" backHref="/orders" actions={<Button onClick={onSubmit} loading={saving}>💾 حفظ الأوردر</Button>} />
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">⚠️ {error}</div>}
      <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={"px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap " + (tab === t.key ? "border-brand-orange text-brand-orange" : "border-transparent text-gray-500 hover:text-gray-800")}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="card max-w-3xl space-y-4">
          {/* Row 1: اسم الأوردر + المعرض */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="اسم الأوردر *" value={order.order_name} onChange={(e) => setOrder({ ...order, order_name: e.target.value })} placeholder="مثال: أوضة نوم محمد" required />
            <Select label="المعرض" value={order.branch_id} onChange={(e) => setOrder({ ...order, branch_id: e.target.value })} options={[{ value: "", label: "— اختر —" }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]} />
          </div>
          {/* Row 2: نوع الأوردر + الحالة + عدد العمال */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="نوع الأوردر" value={order.order_type} onChange={(e) => setOrder({ ...order, order_type: e.target.value })} options={[{ value: "تصنيع جديد", label: "تصنيع جديد" }, { value: "صيانة", label: "صيانة" }]} />
            <Select label="الحالة" value={order.status} onChange={(e) => setOrder({ ...order, status: e.target.value })} options={[{ value: "مفتوح", label: "مفتوح" }, { value: "قيد التنفيذ", label: "قيد التنفيذ" }, { value: "مكتمل", label: "مكتمل" }, { value: "تم التسليم", label: "تم التسليم" }]} />
            <Input label="عدد العمال" type="number" min="0" value={order.workers_count} onChange={(e) => setOrder({ ...order, workers_count: e.target.value })} placeholder="0" />
          </div>
          {order.order_type === "صيانة" && (
            <Select label="الأوردر الأصلي" value={order.parent_order_id} onChange={(e) => setOrder({ ...order, parent_order_id: e.target.value })} options={[{ value: "", label: "— اختر —" }, ...allOrders.map((o) => ({ value: String(o.id), label: o.order_name }))]} />
          )}
          {/* Row 3: العميل + تاريخ البدء + تاريخ الانتهاء */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="العميل" value={order.customer_id} onChange={(e) => setOrder({ ...order, customer_id: e.target.value })} options={[{ value: "", label: "— بدون عميل —" }, ...customers.map((c) => ({ value: String(c.id), label: c.name }))]} />
            <Input label="تاريخ البدء" type="date" value={order.start_date} onChange={(e) => setOrder({ ...order, start_date: e.target.value })} />
            <Input label="تاريخ الانتهاء" type="date" value={order.end_date} onChange={(e) => setOrder({ ...order, end_date: e.target.value })} />
          </div>
          <Textarea label="ملاحظات عامة" rows={4} value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} />
        </div>
      )}

      {tab === "materials" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="font-bold mb-3">🔍 بحث في المخزون</h3>
            <div className="flex gap-2 mb-3">
              <input type="search" value={searchItem} onChange={(e) => setSearchItem(e.target.value)} placeholder="ابحث بالاسم أو الكود..." className="flex-1 px-3 py-2 border rounded-lg" />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="px-3 py-2 border rounded-lg bg-white">
                <option value="all">الكل</option>
                <option value="board">ألواح</option>
                <option value="accessory">اكسسوارات</option>
              </select>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y">
              {filteredItems.map((it) => (
                <div key={it.category + "-" + it.id} className="flex items-center justify-between py-2 hover:bg-gray-50 px-2 rounded">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{it.name}</div>
                    <div className="text-xs text-gray-500">{it.code} • متوفر: <span className={it.remaining > 0 ? "text-green-600 font-semibold" : "text-red-600"}>{it.remaining}</span> • آخر سعر: <span className="text-brand-orange-dark font-semibold">{formatCurrency(it.price)}</span></div>
                  </div>
                  <button onClick={() => addItem(it)} disabled={it.remaining <= 0} className="text-xs px-3 py-1.5 bg-brand-orange text-white rounded-lg hover:bg-brand-orange-dark disabled:opacity-50">+ إضافة</button>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="font-bold mb-3">📦 المواد المستخدمة ({usedItems.length})</h3>
            {usedItems.length === 0 ? (
              <div className="text-gray-400 text-center py-8">لم تضف أي مواد بعد. ابحث من القائمة وأضف.</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {usedItems.map((u, i) => {
                  const item = items.find((x) => x.id === u.id)
                  const exceeds = item && u.quantity > (item.remaining + (u.original_quantity || 0))
                  return (
                    <div key={i} className={"p-3 rounded-lg border " + (exceeds ? "border-red-300 bg-red-50" : "border-gray-200")}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{u.name}</div>
                          <div className="text-xs text-gray-500">{u.category === "board" ? "لوح" : "اكسسوار"} • متوفر: <span className="text-green-600 font-semibold">{(item?.remaining ?? 0) + (u.original_quantity || 0)}</span> • آخر سعر: <span className="text-brand-orange-dark font-semibold">{formatCurrency(item?.price ?? u.unit_price)}</span></div>
                        </div>
                        <button onClick={() => removeUsed(i)} className="text-red-500 hover:bg-red-100 rounded px-2">✕</button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-xs text-gray-500">الكمية</label><input type="number" min={1} value={u.quantity} onChange={(e) => updateUsedQty(i, Number(e.target.value))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
                        <div><label className="text-xs text-gray-500">سعر الوحدة</label><input type="number" step="0.01" value={u.unit_price} onChange={(e) => setUsedItems((s) => s.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
                        <div><label className="text-xs text-gray-500">الإجمالي</label><div className="px-2 py-1.5 bg-gray-100 rounded text-sm font-bold">{formatCurrency(u.quantity * u.unit_price)}</div></div>
                      </div>
                      {exceeds && <div className="text-xs text-red-600 mt-1">⚠️ الكمية المطلوبة أكبر من المتاح ({(item?.remaining || 0) + (u.original_quantity || 0)})</div>}
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-4 pt-3 border-t space-y-1 text-sm">
              <div className="flex justify-between"><span>تكلفة الألواح:</span><strong>{formatCurrency(boardsCost)}</strong></div>
              <div className="flex justify-between"><span>تكلفة الاكسسوارات:</span><strong>{formatCurrency(accessoriesCost)}</strong></div>
              <div className="flex justify-between text-base font-bold pt-2 border-t mt-2"><span>إجمالي المواد:</span><span className="text-brand-orange">{formatCurrency(boardsCost + accessoriesCost)}</span></div>
            </div>
          </div>
        </div>
      )}

      {tab === "costs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <div className="card space-y-4">
            <h3 className="font-bold">💸 التكاليف التلقائية</h3>
            <div className="flex justify-between p-3 bg-gray-50 rounded"><span>الألواح:</span><strong>{formatCurrency(boardsCost)}</strong></div>
            <div className="flex justify-between p-3 bg-gray-50 rounded"><span>الاكسسوارات:</span><strong>{formatCurrency(accessoriesCost)}</strong></div>
          </div>
          <div className="card space-y-4">
            <h3 className="font-bold">🖊️ التكاليف اليدوية</h3>
            <Input label="تكلفة التركيبات" type="number" step="0.01" value={costs.installation_cost} onChange={(e) => setCosts({ ...costs, installation_cost: Number(e.target.value) })} hint="تشمل عمالة السفر" />
            <Input label="أيام سفر التركيب" type="number" value={costs.installation_travel_days} onChange={(e) => setCosts({ ...costs, installation_travel_days: Number(e.target.value) })} />
            <Input label="نقل داخلي" type="number" step="0.01" value={costs.internal_transport_cost} onChange={(e) => setCosts({ ...costs, internal_transport_cost: Number(e.target.value) })} />
            <Input label="نقل خارجي" type="number" step="0.01" value={costs.external_transport_cost} onChange={(e) => setCosts({ ...costs, external_transport_cost: Number(e.target.value) })} />
            <div>
              <Input label="عمولة المصنع" type="number" step="0.01" value={costs.factory_commission} onChange={(e) => setCosts({ ...costs, factory_commission: Number(e.target.value) })} />
            <Input label="نثريات" type="number" step="0.01" value={extraCosts.filter(e => e.cost_type === 'نثريات').reduce((s, e) => s + e.amount, 0)}
              onChange={(e) => {
                const val = Number(e.target.value);
                setExtraCosts(s => {
                  const without = s.filter(x => x.cost_type !== 'نثريات');
                  return val > 0 ? [...without, { cost_type: 'نثريات', amount: val, notes: '' }] : without;
                });
              }}
              hint="تكاليف متنوعة صغيرة"
            />
              <div className="text-xs text-gray-500 mt-1 bg-blue-50 p-2 rounded">
                💡 إجمالي النثريات آخر 7 أيام: <strong>{formatCurrency(weekOverhead)}</strong>
                <br />ده بس مرجع — التوزيع نفسه يدوي.
              </div>
            </div>
          </div>

          {/* تكاليف إضافية ديناميكية */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">➕ تكاليف إضافية</h3>
              <Button variant="secondary" onClick={() => setExtraCosts((s) => [...s, { cost_type: "", amount: 0, notes: "" }])}>+ إضافة</Button>
            </div>
            <p className="text-xs text-gray-500">أضف أي تكلفة إضافية مش موجودة في الحقول الثابتة (مثال: أجور عمال، كهرباء، شحن...).</p>
            {extraCosts.length === 0 ? (
              <div className="text-gray-400 text-center py-4 text-sm">لا توجد تكاليف إضافية</div>
            ) : (
              <div className="space-y-2">
                {extraCosts.map((e, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-lg bg-gray-50">
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500">نوع التكلفة</label>
                      <input
                        list="extra-cost-type-list"
                        type="text"
                        value={e.cost_type}
                        onChange={(ev) => {
                          const v = ev.target.value;
                          setExtraCosts((s) => s.map((x, j) => j === i ? { ...x, cost_type: v } : x));
                          if (v && !knownCostTypes.includes(v)) setKnownCostTypes((arr) => [...arr, v]);
                        }}
                        placeholder="مثال: أجور عمال"
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                      <datalist id="extra-cost-type-list">{knownCostTypes.map((t) => <option key={t} value={t} />)}</datalist>
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500">المبلغ</label>
                      <input
                        type="number"
                        step="0.01"
                        value={e.amount}
                        onChange={(ev) => setExtraCosts((s) => s.map((x, j) => j === i ? { ...x, amount: Number(ev.target.value) } : x))}
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-gray-500">ملاحظات</label>
                      <input
                        value={e.notes}
                        onChange={(ev) => setExtraCosts((s) => s.map((x, j) => j === i ? { ...x, notes: ev.target.value } : x))}
                        placeholder="اختياري"
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex items-end justify-center">
                      <button onClick={() => setExtraCosts((s) => s.filter((_, j) => j !== i))} className="text-red-500 hover:bg-red-100 rounded px-2 py-1.5 text-sm">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {extraCostsTotal > 0 && (
              <div className="flex justify-between p-2 bg-brand-orange-light border border-brand-orange/20 rounded text-sm text-brand-orange-dark">
                <span>إجمالي التكاليف الإضافية:</span>
                <strong>{formatCurrency(extraCostsTotal)}</strong>
              </div>
            )}
          </div>
          <div className="md:col-span-2 card bg-gradient-to-l from-brand-orange to-brand-orange-dark text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm opacity-90">الإجمالي الكلي للأوردر</div>
                <div className="text-3xl font-extrabold">{formatCurrency(orderTotal)}</div>
                <div className="text-xs opacity-80 mt-1">هذا هو المبلغ اللي المفروض المعرض يحوّله للمصنع</div>
              </div>
              <div className="text-6xl opacity-30">💰</div>
            </div>
          </div>
        </div>
      )}

      {tab === "external" && (
        <div className="card max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">🔨 أعمال خارجية (ألوميتال / تنجيد / أخرى)</h3>
            <Button variant="secondary" onClick={() => setExternalWorks((s) => [...s, { work_type: "", contractor_id: "", amount: 0, notes: "" }])}>+ إضافة عمل</Button>
          </div>
          <p className="text-xs text-gray-500">💡 المبالغ هنا بتدخل في إجمالي الأوردر والفاتورة. المقاول اختياري.</p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
            <input type="text" value={customWorkType} onChange={(e) => setCustomWorkType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomWorkType() } }} placeholder="اكتب نوع شغل جديد (مثال: نجارة خارجية)" className="flex-1 px-3 py-2 border rounded-lg text-sm" />
            <Button onClick={addCustomWorkType} variant="secondary">+ إضافة للقائمة</Button>
          </div>

          {externalWorks.length === 0 ? (
            <div className="text-gray-400 text-center py-6">لا توجد أعمال خارجية</div>
          ) : (
            <div className="space-y-3">
              {externalWorks.map((e, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 border rounded-lg">
                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-500">نوع الشغل</label>
                    <input list="work-type-list" type="text" value={e.work_type} onChange={(ev) => { const v = ev.target.value; setExternalWorks((s) => s.map((x, j) => j === i ? { ...x, work_type: v } : x)); if (v && !knownWorkTypes.includes(v)) setKnownWorkTypes((arr) => [...arr, v]) }} placeholder="مثال: ألوميتال" className="w-full px-2 py-1.5 border rounded text-sm" />
                    <datalist id="work-type-list">{knownWorkTypes.map((t) => <option key={t} value={t} />)}</datalist>
                  </div>
                  <div className="md:col-span-4">
                    <label className="text-xs text-gray-500">المقاول</label>
                    <select value={e.contractor_id} onChange={(ev) => setExternalWorks((s) => s.map((x, j) => j === i ? { ...x, contractor_id: ev.target.value } : x))} className="w-full px-2 py-1.5 border rounded text-sm">
                      <option value="">— اختر —</option>
                      {contractors.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2"><label className="text-xs text-gray-500">القيمة</label><input type="number" step="0.01" value={e.amount} onChange={(ev) => setExternalWorks((s) => s.map((x, j) => j === i ? { ...x, amount: Number(ev.target.value) } : x))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
                  <div className="md:col-span-2"><label className="text-xs text-gray-500">ملاحظات</label><input value={e.notes} onChange={(ev) => setExternalWorks((s) => s.map((x, j) => j === i ? { ...x, notes: ev.target.value } : x))} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
                  <div className="md:col-span-1 flex items-end"><button onClick={() => setExternalWorks((s) => s.filter((_, j) => j !== i))} className="text-red-500 hover:bg-red-100 rounded px-2 py-1.5">✕</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}


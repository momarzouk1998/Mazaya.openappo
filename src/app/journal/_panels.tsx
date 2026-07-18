"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Combobox from "@/components/ui/Combobox";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, ENTRY_TYPE_LABELS } from "@/lib/format";

const PAY_OPTS = Object.entries(PAYMENT_METHOD_LABELS)
  .filter(([k]) => k !== "both" && k !== "كلاهما")
  .map(([k, v]) => ({ value: k, label: v }));

const todayStr = () => new Date().toISOString().slice(0, 10);

/* ============================================================
 * فورم شراء/إضافة موحد (يُستخدم للألواح والإكسسوارات)
 * ============================================================ */
function UnifiedItemPurchaseForm({ cat, onSaved }: { cat: "board" | "accessory"; onSaved?: () => void }) {
  const catLabel = cat === "board" ? "لوح" : "إكسسوار";
  const apiList = cat === "board" ? "/api/boards?limit=500" : "/api/accessories?limit=500";
  const apiCreate = cat === "board" ? "/api/boards" : "/api/accessories";
  const apiPurchase = cat === "board" ? "/api/boards/purchase" : "/api/accessories/purchase";

  const [items, setItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [materialTypeId, setMaterialTypeId] = useState("");
  const [form, setForm] = useState({
    item_id: "", item_name: "", code: "", material_type: "",
    quantity: "", unit_price: "", supplier_id: "",
    payment_method: "نقدي", date: todayStr(), notes: "",
    order_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiList).then(r => r.json()).then(d => setItems(d?.data?.items ?? d?.items ?? []));
    fetch("/api/orders?limit=500").then(r => r.json()).then(d => setOrders(d?.data?.items ?? d?.items ?? []));
    fetch("/api/suppliers?limit=500").then(r => r.json()).then(d => setSuppliers(d?.data?.items ?? d?.items ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return items.filter(i => i.quantity_remaining > 0).slice(0, 15);
    const s = q.toLowerCase();
    return items.filter(i => (i.item_name?.toLowerCase().includes(s) || i.code?.toLowerCase().includes(s))).slice(0, 20);
  }, [items, q]);

  function pick(it: any) {
    setIsNew(false);
    setForm(f => ({
      ...f,
      item_id: it.id, item_name: it.item_name, code: it.code,
      material_type: it.material_type || "",
      unit_price: String(it.unit_price ?? ""),
      supplier_id: String(it.supplier_id ?? ""),
    }));
  }

  function handleQChange(val: string) {
    setQ(val);
    const s = val.toLowerCase();
    const found = items.some(i => i.item_name?.toLowerCase().includes(s) || i.code?.toLowerCase().includes(s));
    if (!found && val.trim().length > 1) {
      setIsNew(true);
      setForm(f => ({ ...f, item_id: "", item_name: val, code: "", material_type: "" }));
    } else {
      setIsNew(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);

    if (isNew) {
      // صنف جديد → أنشئه أولاً ثم اشتريه
      if (!form.item_name || !form.quantity) {
        setErr("الاسم والكمية مطلوبين");
        return;
      }
      setSaving(true);
      try {
        const createPayload: any = {
          item_name: form.item_name,
          supplier_id: form.supplier_id || null,
          unit_price: Number(form.unit_price || 0),
          quantity_in: Number(form.quantity),
          notes: form.notes || null,
        };
        if (cat === "board") {
          if (form.code) createPayload.code = form.code;
          createPayload.material_type = form.material_type || null;
        }

        const createRes = await fetch(apiCreate, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        const createData = await createRes.json();
        if (!createRes.ok) { setErr(createData?.error?.message || "خطأ في إنشاء الصنف"); return; }
        const newItem = createData?.data;
        const newItemId = newItem?.id;

        // تسجيل في اليومية
        if (Number(form.unit_price || 0) > 0 && Number(form.quantity) > 0) {
          await fetch("/api/journal", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: form.date,
              entry_type: "مشتريات",
              description: `شراء ${form.quantity} ${form.item_name} (جديد)`,
              amount: Number(form.quantity) * Number(form.unit_price || 0),
              payment_method: form.payment_method,
              party_type: form.supplier_id ? "supplier" : null,
              party_id: form.supplier_id || null,
              notes: form.notes || null,
            }),
          });
        }

        // لو اختار أوردر، ضع المادة في الأوردر
        if (form.order_id && newItemId) {
          try {
            await fetch("/api/orders/" + form.order_id + "/materials", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([{
                item_category: cat === "board" ? "boards_inventory" : "accessories_inventory",
                item_id: newItemId,
                quantity_used: Number(form.quantity),
                unit_price_snapshot: Number(form.unit_price || 0),
              }]),
            });
          } catch (e) { /* ignore */ }
        }

        setMsg(`✅ تم إضافة وشراء ${form.quantity} × ${form.item_name}${form.order_id ? " + إضافتها للأوردر" : ""}`);
        setForm(f => ({ ...f, item_id: "", item_name: "", code: "", material_type: "", quantity: "", notes: "", supplier_id: "", order_id: "" }));
        setMaterialTypeId("");
        setQ(""); setIsNew(false);
        onSaved?.();
      } finally { setSaving(false); }
    } else {
      // صنف موجود → اشترِ منه
      if (!form.item_id || !form.quantity) { setErr("اختر الصنف واكتب الكمية"); return; }
      setSaving(true);
      try {
        const res = await fetch(apiPurchase, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: form.item_id,
            quantity: Number(form.quantity),
            unit_price: Number(form.unit_price || 0),
            supplier_id: form.supplier_id || null,
            payment_method: form.payment_method,
            date: form.date,
            notes: form.notes || null,
            create_journal: true,
          }),
        });
        const j = await res.json();
        if (!res.ok) { setErr(j?.error?.message || "خطأ"); return; }

        // لو اختار أوردر، ضع المادة في الأوردر
        if (form.order_id && res.ok) {
          try {
            await fetch("/api/orders/" + form.order_id + "/materials", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify([{
                item_category: cat === "board" ? "boards_inventory" : "accessories_inventory",
                item_id: form.item_id,
                quantity_used: Number(form.quantity),
                unit_price_snapshot: Number(form.unit_price || 0),
              }]),
            });
          } catch (e) {
            // لو الإضافة للأوردر فشلت، الشراء نفسه نجح
          }
        }

        setMsg(`✅ تم شراء ${form.quantity} × ${form.item_name}${form.order_id ? " + إضافتها للأوردر" : ""}`);
        setForm(f => ({ ...f, item_id: "", item_name: "", code: "", material_type: "", quantity: "", notes: "", supplier_id: "", order_id: "" }));
        setMaterialTypeId("");
        setQ(""); setIsNew(false);
        onSaved?.();
      } finally { setSaving(false); }
    }
  }

  const total = Number(form.quantity || 0) * Number(form.unit_price || 0);

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* بحث + اختيار */}
      <div>
        <Input label={`ابحث عن ${catLabel}...`} value={q} onChange={e => handleQChange(e.target.value)}
          placeholder="اكتب الاسم لو موجود تختاره، لو مش موجود تضيفه" />
        {!isNew && q.trim() && (
          <div className="mt-1 max-h-40 overflow-y-auto divide-y border rounded-lg">
            {filtered.map(it => (
              <button type="button" key={it.id} onClick={() => pick(it)}
                className={`w-full text-right px-3 py-2 hover:bg-brand-orange/10 text-sm ${form.item_id === it.id ? "bg-brand-orange/10 font-semibold" : ""}`}>
                {it.item_name} <span className="text-xs text-gray-500">({it.code}) • متبقي: {it.quantity_remaining}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-2 text-gray-400 text-sm">لا توجد نتائج — اكتب التفاصيل وسيُنشأ صنف جديد</div>}
          </div>
        )}
      </div>

      {isNew && (
        <div className="bg-amber-50 border border-amber-200 p-2 rounded text-sm text-amber-700">
          🆕 <strong>{catLabel} جديد</strong> — اكتب التفاصيل وسيُنشأ تلقائياً
        </div>
      )}
      {!isNew && form.item_name && (
        <div className="bg-green-50 p-2 rounded text-sm">
          المختار: <strong>{form.item_name}</strong>
        </div>
      )}

      {/* حقول الصنف الجديد */}
      {isNew && cat === "board" && (
        <Input label="الكود (اختياري)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
          placeholder="مثال: S-620 — لو فارغ بيتولد تلقائياً" />
      )}
      {isNew && cat === "board" && (
        <Input label="اسم الصنف *" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} required />
      )}
      {isNew && cat === "board" && (
        <Combobox
          label="الخامة"
          placeholder="ابحث عن خامة أو اكتب جديدة..."
          endpoint="/api/material-types?category=board&limit=500"
          value={materialTypeId}
          onChange={(id, name) => { setMaterialTypeId(id); setForm(f => ({ ...f, material_type: name || "" })); }}
          createFields={{ category: "board" }}
          autoCreateOnBlur
          hint="💡 اختار خامة موجودة أو اكتب اسم جديد وهيتحفظ تلقائياً"
        />
      )}
      {isNew && cat === "accessory" && (
        <Input label="اسم الصنف *" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} required />
      )}

      {/* المورد */}
      <Combobox
        label="المورد"
        placeholder="ابحث عن مورد..."
        endpoint="/api/suppliers?limit=500"
        value={form.supplier_id}
        onChange={(id) => setForm({ ...form, supplier_id: id })}
        allowCreate={false}
        clearLabel="— بدون مورد —"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input label="الكمية *" type="number" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
        <Input label="سعر الوحدة" type="number" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })} />
      </div>

      {/* الأوردر (اختياري) */}
      <Combobox
        label="الأوردر (اختياري)"
        placeholder="🔍 ابحث باسم الأوردر..."
        endpoint="/api/orders?limit=500"
        value={form.order_id}
        onChange={(id) => setForm({ ...form, order_id: id })}
        allowCreate={false}
        nameKey="order_name"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input label="التاريخ" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        <Select label="طريقة الدفع" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} options={PAY_OPTS} />
      </div>
      {err && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{err}</div>}
      {msg && <div className="bg-brand-orange-light text-brand-orange-dark p-2 rounded text-sm">{msg}</div>}
      {total > 0 && (
        <div className="bg-brand-orange-light text-brand-orange-dark border border-brand-orange/20 p-2 rounded text-sm">الإجمالي: <strong>{formatCurrency(total)}</strong> — هيُسجل في اليومية تلقائياً</div>
      )}
      <Button type="submit" loading={saving} className="w-full">
        🛒 تسجيل {isNew ? "إضافة وشراء" : "الشراء"}
      </Button>
    </form>
  );
}

/* فورم شراء الألواح (بحث + إضافة جديد في مكان واحد) */
export function BoardPurchasePanel(props: any) { return <UnifiedItemPurchaseForm cat="board" {...props} />; }

/* فورم شراء الإكسسوارات (بحث + إضافة جديد في مكان واحد) */
export function AccessoryPurchasePanel(props: any) { return <UnifiedItemPurchaseForm cat="accessory" {...props} />; }

/* ============================================================
 * 3) نثريات (عامة — أجور العمال بتتسجل من /workers)
 * ============================================================ */
const CATS = [
  { value: "", label: "— اختر التصنيف —" },
  { value: "نثريات عامة", label: "نثريات عامة" },
  { value: "غداء", label: "غداء" },
  { value: "كهرباء", label: "كهرباء" },
  { value: "شحن", label: "شحن / نقل" },
  { value: "صيانة", label: "صيانة" },
  { value: "أخرى", label: "أخرى" },
];

export function OverheadPanel({ onSaved }: { onSaved?: () => void }) {
  const [form, setForm] = useState({
    date: todayStr(), category: "", description: "", amount: "",
    payment_method: "نقدي", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!form.description || !form.amount) { setErr("البيان والمبلغ مطلوبان"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/overhead?create_journal=true", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date, category: form.category || null, description: form.description,
          amount: Number(form.amount), payment_method: form.payment_method,
          notes: form.notes || null, worker_id: null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j?.error?.message || "خطأ"); return; }
      setMsg(`✅ تم تسجيل ${formatCurrency(Number(form.amount))}`);
      setForm(f => ({ ...f, description: "", amount: "", notes: "" }));
      onSaved?.();
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input label="التاريخ" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
      <Select label="التصنيف" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} options={CATS} />
      <Input label="البيان *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="مثال: كهرباء، شحن" required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="المبلغ *" type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
        <Select label="طريقة الدفع" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} options={PAY_OPTS} />
      </div>
      <Input label="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      {err && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{err}</div>}
      {msg && <div className="bg-brand-orange-light text-brand-orange-dark p-2 rounded text-sm">{msg}</div>}
      <Button type="submit" loading={saving} className="w-full">💾 تسجيل المصروف</Button>
    </form>
  );
}

/* ============================================================
 * 4) دفعة واردة من معرض (income)
 * ============================================================ */
export function IncomePanel({ onSaved }: { onSaved?: () => void }) {
  const [branches, setBranches] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [form, setForm] = useState({
    date: todayStr(), amount: "", payment_method: "تحويل",
    description: "دفعة واردة من معرض", notes: "", branch_id: "",
    direction: "in", // "in" = داخل المصنع | "out" = خارج للمورد
    supplier_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/branches?limit=500").then(r => r.json()).then(d => setBranches(d?.data?.items ?? d?.items ?? []));
    fetch("/api/suppliers?limit=500").then(r => r.json()).then(d => setSuppliers(d?.data?.items ?? d?.items ?? []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!form.amount) { setErr("المبلغ مطلوب"); return; }
    setSaving(true);
    try {
      const branchName = branches.find(b => String(b.id) === form.branch_id)?.name || "معرض";
      const supplierName = suppliers.find(s => s.id === form.supplier_id)?.name || "";

      if (form.direction === "out") {
        // تحويل تمريري: المعرض → المورد
        if (!form.branch_id) { setErr("اختار المعرض"); return; }
        if (!form.supplier_id) { setErr("اختار المورد"); return; }
        const body: any = {
          date: form.date,
          entry_type: "تحويل تمريري",
          description: `تحويل ${branchName} → ${supplierName}`,
          amount: Number(form.amount),
          payment_method: form.payment_method,
          notes: form.notes || null,
          is_passthrough: true,
          branch_id: form.branch_id,
          supplier_id: form.supplier_id,
        };
        const res = await fetch("/api/journal", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json();
        if (!res.ok) { setErr(j?.error?.message || "خطأ"); return; }
        setMsg(`✅ تم تسجيل تحويل ${formatCurrency(Number(form.amount))} من ${branchName} إلى ${supplierName}`);
      } else {
        // وارد عادي للمصنع
        const body: any = {
          date: form.date,
          entry_type: "دفعة واردة من معرض",
          description: form.branch_id
            ? `دفعة واردة من ${branchName}`
            : form.description,
          amount: Number(form.amount),
          payment_method: form.payment_method,
          notes: form.notes || null,
        };
        if (form.branch_id) {
          body.party_type = "branch";
          body.party_id = form.branch_id;
        }
        const res = await fetch("/api/journal", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json();
        if (!res.ok) { setErr(j?.error?.message || "خطأ"); return; }
        setMsg(`✅ تم تسجيل وارد ${formatCurrency(Number(form.amount))}`);
      }
      setForm(f => ({ ...f, amount: "", notes: "" }));
      onSaved?.();
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* اختيار الاتجاه */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">اتجاه التحويل</label>
        <div className="flex gap-3">
          <label className={`flex-1 cursor-pointer rounded-xl p-3 border-2 text-center transition ${form.direction === "in" ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
            <input type="radio" name="direction" value="in" checked={form.direction === "in"} onChange={() => setForm(f => ({ ...f, direction: "in" }))} className="hidden" />
            <div className="text-lg">🟢</div>
            <div className="text-sm font-bold">داخل المصنع</div>
            <div className="text-[10px] text-gray-500">وارد للمصنع</div>
          </label>
          <label className={`flex-1 cursor-pointer rounded-xl p-3 border-2 text-center transition ${form.direction === "out" ? "border-red-400 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
            <input type="radio" name="direction" value="out" checked={form.direction === "out"} onChange={() => setForm(f => ({ ...f, direction: "out" }))} className="hidden" />
            <div className="text-lg">🔴</div>
            <div className="text-sm font-bold">خارج للمورد</div>
            <div className="text-[10px] text-gray-500">تحويل من المعرض للمورد</div>
          </label>
        </div>
      </div>

      <Input label="التاريخ" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
      <Select label="المعرض" value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })}
        options={[{ value: "", label: "— اختر المعرض —" }, ...branches.map(b => ({ value: String(b.id), label: b.name }))]} />

      {form.direction === "out" && (
        <Select label="المورد *" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}
          options={[{ value: "", label: "— اختر المورد —" }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]} />
      )}

      <Input label="المبلغ *" type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
      <Select label="طريقة الدفع" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} options={PAY_OPTS} />
      <Input label="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      {err && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{err}</div>}
      {msg && <div className="bg-brand-orange-light text-brand-orange-dark p-2 rounded text-sm">{msg}</div>}
      <Button type="submit" loading={saving} className="w-full">{form.direction === "out" ? "🔄 تسجيل التحويل" : "📥 تسجيل الوارد"}</Button>
    </form>
  );
}

/* ============================================================
 * 5) بحث موحّد في المخزن (ألواح + إكسسوارات)
 * ============================================================ */
export function InventorySearchPanel({ onOpenPurchase }: { onOpenPurchase?: (cat: "board" | "accessory") => void }) {
  const [boards, setBoards] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/boards?limit=500").then(r => r.json()),
      fetch("/api/accessories?limit=500").then(r => r.json()),
    ]).then(([b, a]) => {
      setBoards(b?.data?.items ?? b?.items ?? []);
      setAccessories(a?.data?.items ?? a?.items ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    const all = [
      ...boards.map(x => ({ ...x, _type: "لوح" })),
      ...accessories.map(x => ({ ...x, _type: "إكسسوار" })),
    ];
    if (!q.trim()) return all.filter(x => x.quantity_remaining > 0).slice(0, 30);
    const s = q.toLowerCase();
    return all.filter(x =>
      x.item_name?.toLowerCase().includes(s) || x.code?.toLowerCase().includes(s)
    ).slice(0, 50);
  }, [boards, accessories, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input label="ابحث في المخزن" value={q} onChange={e => setQ(e.target.value)} placeholder="اسم الصنف أو الكود (مثال: مفصلة، K-100)..." />
        </div>
        {onOpenPurchase && (
          <div className="flex items-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => onOpenPurchase("board")}>🪵 دخول مخزون الألواح</Button>
            <Button variant="secondary" size="sm" onClick={() => onOpenPurchase("accessory")}>🔩 دخول مخزون الإكسسوارات</Button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="text-gray-400 text-sm py-4 text-center">جاري التحميل...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-right">النوع</th>
                <th className="px-2 py-2 text-right">البيان</th>
                <th className="px-2 py-2 text-right">الكود</th>
                <th className="px-2 py-2 text-right">المتبقي</th>
                <th className="px-2 py-2 text-right">السعر</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.map(x => (
                <tr key={x._type + x.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2"><span className={`badge border ${x._type === "لوح" ? "bg-brand-orange-light text-brand-orange-dark border-brand-orange/20" : "bg-white text-brand-black border-gray-200"}`}>{x._type}</span></td>
                  <td className="px-2 py-2 font-medium">{x.item_name}</td>
                  <td className="px-2 py-2"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{x.code}</code></td>
                  <td className={`px-2 py-2 font-bold ${x.quantity_remaining > 0 ? "text-green-600" : "text-red-500"}`}>{x.quantity_remaining}</td>
                  <td className="px-2 py-2">{formatCurrency(Number(x.unit_price ?? 0))}</td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td colSpan={5} className="px-2 py-6 text-center text-gray-400">لا توجد نتائج للبحث "{q}"</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-xs text-gray-500">النتائج: <strong>{results.length}</strong> — ابحث بالاسم أو الكود لمعرفة إذا كان الصنف موجوداً في المخزن.</div>
    </div>
  );
}

/* ============================================================
 * 6) تقرير العمال السريع (داخل اليومية) — مع فلتر زمني بالأسبوع
 * ============================================================ */
function getLastThursday(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diff = (day + 3) % 7; // أيام بعد الخميس (الخميس=4 → diff=0)
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function WorkersReportPanel() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // فلتر زمني — الافتراضي: من آخر خميس إلى اليوم
  const [dateFrom, setDateFrom] = useState(getLastThursday);
  const [dateTo, setDateTo] = useState(todayStr);

  useEffect(() => {
    Promise.all([
      fetch("/api/workers?limit=500").then(r => r.json()),
      fetch("/api/overhead?limit=2000").then(r => r.json()),
    ]).then(([w, o]) => {
      setWorkers(w?.data?.items ?? w?.items ?? []);
      setExpenses(o?.data?.expenses ?? o?.data?.items ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const m: Record<string, { total: number; count: number; last: string }> = {};
    for (const e of expenses) {
      if (!e.worker_id) continue;
      const d = String(e.date).slice(0, 10);
      // فلتر حسب التاريخ المختار
      if (dateFrom && d < dateFrom) continue;
      if (dateTo && d > dateTo) continue;
      const id = String(e.worker_id);
      if (!m[id]) m[id] = { total: 0, count: 0, last: "" };
      m[id].total += Number(e.amount || 0);
      m[id].count += 1;
      const ed = String(e.date).slice(0, 10);
      if (ed > m[id].last) m[id].last = ed;
    }
    return m;
  }, [expenses, dateFrom, dateTo]);

  const rows = workers.map(w => ({ ...w, ...(stats[w.id] || { total: 0, count: 0, last: "" }) }));
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  if (loading) return <div className="text-gray-400 text-sm py-4 text-center">جاري التحميل...</div>;

  return (
    <div className="space-y-3">
      {/* فلتر التاريخ */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">من</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">إلى</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm" />
        </div>
        <button onClick={() => { setDateFrom(getLastThursday()); setDateTo(todayStr()); }}
          className="mt-4 text-xs px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
          🔄 هذا الأسبوع
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white border-r-4 border-brand-orange p-3 rounded-lg text-center shadow-sm">
          <div className="text-xs text-gray-500 mb-1">إجمالي الأجور</div>
          <div className="font-extrabold text-xl text-brand-black">{formatCurrency(grandTotal)}</div>
        </div>
        <div className="bg-white border-r-4 border-brand-orange p-3 rounded-lg text-center shadow-sm">
          <div className="text-xs text-gray-500 mb-1">عدد العمال (لهم حركات)</div>
          <div className="font-extrabold text-xl text-brand-black">{rows.filter(r => r.count > 0).length}</div>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-right">العامل</th>
              <th className="px-2 py-2 text-right">عدد المصروفات</th>
              <th className="px-2 py-2 text-right">الإجمالي</th>
              <th className="px-2 py-2 text-right">آخر صرف</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-2 py-2 font-medium">{r.name}</td>
                <td className="px-2 py-2">{r.count || 0}</td>
                <td className="px-2 py-2 font-bold text-purple-700">{formatCurrency(r.total)}</td>
                <td className="px-2 py-2 text-xs">{r.last || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-2 py-6 text-center text-gray-400">لا يوجد عمال بعد. أضف عمال من تبويب "أجور عمال".</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

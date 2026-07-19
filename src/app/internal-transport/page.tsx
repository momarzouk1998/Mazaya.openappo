"use client";
import { useState } from "react";
import { useUserStore } from "@/store/user-store";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { useCan } from "@/hooks/useCan";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { canSeeModule } from "@/lib/auth";
import { PWAInstallButton } from "@/components/PWAInstallButton";

interface Entry {
  id: string;
  date: string;
  description: string;
  amount: number;
  payment_method: string | null;
  order_id: string | null;
  notes: string | null;
}
interface Order { id: string; order_name: string; customer?: { name: string }; }

const PAY_OPTS = [{ value: "نقدي", label: "نقدي" }, { value: "تحويل", label: "تحويل" }];
const EMPTY_FORM = {
  amount: "", payment_method: "نقدي",
  date: new Date().toISOString().slice(0, 10),
  order_id: "", notes: "",
};

export default function InternalTransportPage() {
  const { user: profile } = useUserStore();
  const { can } = useCan();
  const { data, loading, refetch } = useApi<{ entries: Entry[] }>("/api/internal-transport?limit=500");
  const { data: ordersData } = useApi<{ items: Order[] }>("/api/orders?limit=500");
  const { mutate, loading: saving } = useApiMutation();

  const entries = data?.entries ?? [];
  const orders = ordersData?.items ?? [];

  // فورم الإضافة
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  // modal التعديل
  const [editRow, setEditRow] = useState<Entry | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);

  if (!profile) return null;
  const canSee = canSeeModule(profile, "internal_transport");
  if (!canSee) {
    return (
      <DashboardLayout profile={profile}>
        <div className="card text-center text-gray-500 py-12">🔒 هذه الصفحة للمصنع فقط.</div>
      </DashboardLayout>
    );
  }

  const total = entries.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const withOrder = entries.filter(e => e.order_id).length;

  const rowsWithOrder = entries.map(e => ({
    ...e,
    order_name: e.order_id ? (orders.find(o => o.id === e.order_id)?.order_name || "—") : "—",
  }));

  // ── إضافة ──
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.amount || Number(form.amount) <= 0) { setError("المبلغ مطلوب ويجب أن يكون أكبر من صفر"); return; }
    const { error: err } = await mutate("POST", "/api/internal-transport", {
      amount: Number(form.amount),
      payment_method: form.payment_method,
      date: form.date,
      order_id: form.order_id || null,
      notes: form.notes || null,
    });
    if (err) { setError(err); return; }
    setShowForm(false);
    setForm(EMPTY_FORM);
    refetch();
  }

  // ── فتح modal التعديل ──
  function openEdit(row: Entry) {
    setEditRow(row);
    setEditError(null);
    // استخرج الملاحظات الأصلية من الـ description (بعد [نقل داخلي] )
    const rawNotes = row.description?.replace(/^\[نقل داخلي\]\s*/, "").replace(/نقل داخلي مرتبط بأوردر|نقل داخلي/g, "").trim();
    setEditForm({
      amount: String(row.amount),
      payment_method: row.payment_method || "نقدي",
      date: String(row.date).slice(0, 10),
      order_id: row.order_id || "",
      notes: row.notes || rawNotes || "",
    });
  }

  // ── حفظ التعديل ──
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    setEditError(null);
    if (!editForm.amount || Number(editForm.amount) <= 0) { setEditError("المبلغ يجب أن يكون أكبر من صفر"); return; }
    const { error: err } = await mutate("PATCH", `/api/internal-transport/${editRow.id}`, {
      amount: Number(editForm.amount),
      payment_method: editForm.payment_method,
      date: editForm.date,
      order_id: editForm.order_id || null,
      notes: editForm.notes || null,
    });
    if (err) { setEditError(err); return; }
    setEditRow(null);
    refetch();
  }

  // ── حذف ──
  async function remove(row: Entry) {
    const orderName = row.order_id ? orders.find(o => o.id === row.order_id)?.order_name : null;
    const msg = orderName
      ? `حذف نقل داخلي بمبلغ ${formatCurrency(row.amount)}؟\nسيتم خصم المبلغ من تكلفة الأوردر "${orderName}" تلقائياً.`
      : `حذف نقل داخلي بمبلغ ${formatCurrency(row.amount)}؟`;
    if (!confirm(msg)) return;
    const { error: err } = await mutate("DELETE", `/api/internal-transport/${row.id}`);
    if (err) { alert("❌ " + err); return; }
    refetch();
  }

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="النقل الداخلي"
        subtitle="نقل داخلي بين المصنع والمعارض — بيخصم من يومية المصنع، ولو ربطته بأوردر بيتحسب عليه"
        helpTitle="النقل الداخلي"
        helpDescription="كل نقل داخلي بيخصم من رصيد يومية المصنع كمصروف عادي. لو اخترت أوردر، المبلغ كمان بيتراكم على تكلفة النقل الداخلي بتاعة الأوردر. الحذف والتعديل بيعكسوا الأوردر تلقائياً."
        actions={<PWAInstallButton />}
      />

      {/* كروت ملخصة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="card bg-white border-r-4 border-brand-orange">
          <div className="text-xs text-gray-500">إجمالي النقل الداخلي</div>
          <div className="text-2xl font-extrabold text-brand-orange">{formatCurrency(total)}</div>
        </div>
        <div className="card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white">
          <div className="text-xs opacity-90">عدد الحركات</div>
          <div className="text-2xl font-extrabold">{entries.length}</div>
        </div>
        <div className="card bg-white border-r-4 border-brand-orange">
          <div className="text-xs text-gray-500">مرتبطة بأوردرات</div>
          <div className="text-2xl font-bold text-brand-black">{withOrder} حركة</div>
        </div>
      </div>

      {/* شريط الأدوات */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">
          آخر تحديث: {entries[0] ? formatDate(entries[0].date) : "—"}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportToExcel(rowsWithOrder as any, "internal-transport")} disabled={entries.length === 0}>📥 تصدير</Button>
          {can("internal_transport", "add") && (
            <Button size="sm" onClick={() => { setShowForm(v => !v); setError(null); }}>+ نقل داخلي جديد</Button>
          )}
        </div>
      </div>

      {/* فورم الإضافة */}
      {showForm && (
        <form onSubmit={submit} className="card mb-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Input label="المبلغ *" type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <Input label="التاريخ" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <Select label="طريقة الدفع" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} options={PAY_OPTS} />
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">الأوردر (اختياري)</label>
            <select value={form.order_id} onChange={e => setForm({ ...form, order_id: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg bg-white">
              <option value="">— بدون أوردر (مصروف عام) —</option>
              {orders.map(o => <option key={o.id} value={o.id}>{o.order_name}{o.customer?.name ? ` — ${o.customer.name}` : ""}</option>)}
            </select>
            {form.order_id && <p className="text-xs text-brand-orange-dark mt-1 bg-brand-orange-light p-2 rounded">✓ المبلغ هيتراكم على تكلفة "النقل الداخلي" بتاعة الأوردر.</p>}
          </div>
          <div className="md:col-span-3">
            <Input label="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="مثال: نقل لأوردر معين، توعية، إلخ" />
          </div>
          {error && <div className="md:col-span-3 bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
          <div className="md:col-span-3 flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button type="submit" loading={saving}>حفظ</Button>
          </div>
        </form>
      )}

      {/* الجدول */}
      {loading ? (
        <div className="card text-center text-gray-400 py-12">جاري التحميل...</div>
      ) : rowsWithOrder.length === 0 ? (
        <div className="card text-center text-gray-500 py-12">مفيش حركات نقل داخلي لسه. اضغط '+ نقل داخلي جديد'.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-right">التاريخ</th>
                <th className="p-3 text-right">المبلغ</th>
                <th className="p-3 text-right">الطريقة</th>
                <th className="p-3 text-right">الأوردر</th>
                <th className="p-3 text-right">ملاحظات</th>
                {(can("internal_transport", "edit") || can("internal_transport", "delete")) && (
                  <th className="p-3 text-center">إجراءات</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rowsWithOrder.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 transition">
                  <td className="p-3">{formatDate(row.date)}</td>
                  <td className="p-3 font-bold text-red-600">{formatCurrency(Number(row.amount ?? 0))}</td>
                  <td className="p-3">{row.payment_method || "—"}</td>
                  <td className="p-3">
                    <span className={row.order_id ? "font-semibold text-brand-orange" : "text-gray-400"}>{row.order_name}</span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{row.notes || "—"}</td>
                  {(can("internal_transport", "edit") || can("internal_transport", "delete")) && (
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        {can("internal_transport", "edit") && (
                          <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-blue-100 rounded transition" title="تعديل">✏️</button>
                        )}
                        {can("internal_transport", "delete") && (
                          <button onClick={() => remove(row)} className="p-1.5 hover:bg-red-100 rounded transition" title="حذف">🗑️</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* modal التعديل */}
      {editRow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !saving && setEditRow(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">✏️ تعديل نقل داخلي</h2>
              <button onClick={() => setEditRow(null)} className="p-1 hover:bg-gray-100 rounded-lg" disabled={saving}>✕</button>
            </div>
            <form onSubmit={saveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="المبلغ *" type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} required />
                <Input label="التاريخ" type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
              </div>
              <Select label="طريقة الدفع" value={editForm.payment_method} onChange={e => setEditForm({ ...editForm, payment_method: e.target.value })} options={PAY_OPTS} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الأوردر</label>
                <select value={editForm.order_id} onChange={e => setEditForm({ ...editForm, order_id: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg bg-white text-sm">
                  <option value="">— بدون أوردر —</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.order_name}{o.customer?.name ? ` — ${o.customer.name}` : ""}</option>)}
                </select>
                {editForm.order_id && editForm.order_id !== (editRow.order_id || "") && (
                  <p className="text-xs text-amber-600 mt-1 bg-amber-50 p-2 rounded">⚠️ تغيير الأوردر هيعكس المبلغ القديم ويضيفه للأوردر الجديد تلقائياً.</p>
                )}
              </div>
              <Input label="ملاحظات" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="ملاحظات..." />
              {editError && <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{editError}</div>}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="secondary" onClick={() => setEditRow(null)} disabled={saving}>إلغاء</Button>
                <Button type="submit" loading={saving}>💾 حفظ التعديلات</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

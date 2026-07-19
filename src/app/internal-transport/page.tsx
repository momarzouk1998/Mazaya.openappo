"use client";
import { useState } from "react";
import { useUserStore } from "@/store/user-store";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { useCan } from "@/hooks/useCan";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
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

export default function InternalTransportPage() {
  const { user: profile } = useUserStore();
  const { can } = useCan();
  const { data, loading, refetch } = useApi<{ entries: Entry[] }>("/api/internal-transport?limit=500");
  const { data: ordersData } = useApi<{ items: Order[] }>("/api/orders?limit=500");
  const { mutate, loading: saving } = useApiMutation();

  const entries = data?.entries ?? [];
  const orders = ordersData?.items ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    payment_method: "نقدي",
    date: new Date().toISOString().slice(0, 10),
    order_id: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.amount || Number(form.amount) <= 0) {
      setError("المبلغ مطلوب ويجب أن يكون أكبر من صفر");
      return;
    }
    const { error: err } = await mutate("POST", "/api/internal-transport", {
      amount: Number(form.amount),
      payment_method: form.payment_method,
      date: form.date,
      order_id: form.order_id || null,
      notes: form.notes || null,
    });
    if (err) { setError(err); return; }
    setShowForm(false);
    setForm(f => ({ ...f, amount: "", notes: "", order_id: "" }));
    refetch();
  }

  // اربط اسم الأوردر لكل قيد
  const rowsWithOrder = entries.map(e => ({
    ...e,
    order_name: e.order_id ? (orders.find(o => o.id === e.order_id)?.order_name || "—") : "—",
  }));

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="النقل الداخلي"
        subtitle="نقل داخلي بين المصنع والمعارض — بيخصم من يومية المصنع، ولو ربطته بأوردر بيتحسب عليه"
        helpTitle="النقل الداخلي"
        helpDescription="كل نقل داخلي بيخصم من رصيد يومية المصنع كمصروف عادي. لو اخترت أوردر، المبلغ كمان بيتراكم على تكلفة النقل الداخلي بتاعة الأوردر (والعميل هيدفعه بعدين في الفاتورة)."
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

      {/* زر إضافة */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">
          آخر تحديث: {entries[0] ? formatDate(entries[0].date) : "—"}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportToExcel(rowsWithOrder as any, "internal-transport")} disabled={entries.length === 0}>📥 تصدير</Button>
          {can("internal_transport", "add") && (
            <Button size="sm" onClick={() => setShowForm(v => !v)}>+ نقل داخلي جديد</Button>
          )}
        </div>
      </div>

      {/* فورم الإضافة */}
      {showForm && (
        <form onSubmit={submit} className="card mb-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Input
              label="المبلغ *"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Input
              label="التاريخ"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <Select
              label="طريقة الدفع"
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              options={[{ value: "نقدي", label: "نقدي" }, { value: "تحويل", label: "تحويل" }]}
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">الأوردر (اختياري)</label>
            <select
              value={form.order_id}
              onChange={(e) => setForm({ ...form, order_id: e.target.value })}
              className="w-full px-4 py-2.5 border rounded-lg bg-white"
            >
              <option value="">— بدون أوردر (مصروف عام) —</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.order_name}{o.customer?.name ? ` — ${o.customer.name}` : ""}
                </option>
              ))}
            </select>
            {form.order_id && (
              <p className="text-xs text-brand-orange-dark mt-1 bg-brand-orange-light p-2 rounded">
                ✓ المبلغ هيتراكم على تكلفة "النقل الداخلي" بتاعة الأوردر، والعميل هيدفعه في الفاتورة.
              </p>
            )}
          </div>
          <div className="md:col-span-3">
            <Input
              label="ملاحظات"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="مثال: نقل لأوردر معين، توعية، إلخ"
            />
          </div>
          <div className="md:col-span-3 flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button type="submit" loading={saving}>حفظ</Button>
          </div>
          {error && <div className="md:col-span-3 bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
        </form>
      )}

      {/* جدول الحركات */}
      <DataTable
        loading={loading}
        rows={rowsWithOrder}
        emptyMessage="مفيش حركات نقل داخلي لسه. اضغط '+ نقل داخلي جديد' عشان تسجل."
        columns={[
          { key: "date", label: "التاريخ", render: r => formatDate(r.date) },
          { key: "amount", label: "المبلغ", render: r => <span className="font-bold text-red-600">{formatCurrency(Number(r.amount ?? 0))}</span> },
          { key: "payment_method", label: "الطريقة" },
          { key: "order_name", label: "الأوردر", render: r => (
            <span className={r.order_id ? "font-semibold text-brand-orange" : "text-gray-400"}>{r.order_name}</span>
          ) },
          { key: "notes", label: "ملاحظات", render: r => r.notes || "-" },
        ]}
      />
    </DashboardLayout>
  );
}

"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApi";
import { useCan } from "@/hooks/useCan";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";

export default function PaymentsPage() {
  const { user: profile } = useUserStore();
  const { can } = useCan();
  const { data: paymentsData, loading, refetch } = useApi<{ items: any[] }>('/api/customer-payments?limit=500');
  const { data: customersData } = useApi<{ items: any[] }>('/api/customers?limit=500');
  const { mutate } = useApiMutation();

  const payments = paymentsData?.items ?? [];
  const customers = customersData?.items ?? [];

  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Add payment modal
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => payments.filter((p: any) => {
    const matchSearch = !search ||
      (p.customer?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.order?.order_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.notes || "").includes(search);
    const matchCust = !customerFilter || p.customer_id === customerFilter;
    const matchFrom = !fromDate || String(p.date ?? "") >= fromDate;
    const matchTo = !toDate || String(p.date ?? "") <= toDate;
    return matchSearch && matchCust && matchFrom && matchTo;
  }), [payments, search, customerFilter, fromDate, toDate]);

  const totalFiltered = filtered.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  if (!profile) return null;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="مدفوعات العملاء"
        subtitle={`${payments.length} دفعة مسجلة`}
        helpTitle="مدفوعات العملاء"
        helpDescription="تسجيل وتتبع مدفوعات العملاء. هذه البيانات للتوثيق فقط ولا تدخل في حسابات اليومية أو الأرباح."
        backHref="/customers"
        actions={<>
          <Button variant="secondary" onClick={() => exportToExcel(filtered.map((p: any) => ({
            التاريخ: p.date, العميل: p.customer?.name || "", الأوردر: p.order?.order_name || "عامة",
            المبلغ: Number(p.amount), "طريقة الدفع": p.payment_method, ملاحظات: p.notes || "",
          })), "customer_payments")}>📥 تصدير</Button>
          {can('payments', 'add') && <Button onClick={() => setShowAdd(true)}>💰 تسجيل دفعة</Button>}
        </>}
      />

      {payments.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="card bg-white border-r-4 border-brand-orange">
            <div className="text-xs text-gray-500">إجمالي المدفوعات</div>
            <div className="text-2xl font-extrabold text-brand-black">{formatCurrency(payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0))}</div>
          </div>
          <div className="card bg-white border-r-4 border-green-400">
            <div className="text-xs text-gray-500">عدد الدفعات</div>
            <div className="text-2xl font-extrabold text-green-600">{filtered.length}</div>
          </div>
          <div className="col-span-2 md:col-span-1 card bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white">
            <div className="text-xs opacity-90">إجمالي المعروض</div>
            <div className="text-2xl font-extrabold">{formatCurrency(totalFiltered)}</div>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="flex flex-wrap gap-2 items-center p-2">
          <div className="flex-1 min-w-[200px]">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الأوردر..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
            />
          </div>
          <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white">
            <option value="">كل العملاء</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg bg-white" />
          <div className="text-sm text-gray-500 mr-auto">النتائج: <strong>{filtered.length}</strong></div>
        </div>
      </div>

      <DataTable
        loading={loading}
        rows={filtered}
        emptyMessage="لا توجد مدفوعات مسجلة بعد"
        columns={[
          { key: "date", label: "التاريخ", render: (r: any) => formatDate(r.date) },
          { key: "customer", label: "العميل", render: (r: any) => <Link href={`/customers/${r.customer_id}`} className="font-semibold text-brand-orange hover:underline">{r.customer?.name || "-"}</Link> },
          { key: "order", label: "الأوردر", render: (r: any) => r.order
            ? <Link href={`/orders/${r.order_id}`} className="text-brand-orange hover:underline text-xs">{r.order.order_name}</Link>
            : <span className="text-gray-400">— عامة —</span>
          },
          { key: "amount", label: "المبلغ", render: (r: any) => <span className="font-bold text-green-600">{formatCurrency(Number(r.amount))}</span> },
          { key: "payment_method", label: "طريقة الدفع" },
          { key: "notes", label: "ملاحظات", render: (r: any) => r.notes || "-" },
          {
            key: "_actions", label: "",
            render: (r: any) => can('payments', 'delete') ? (
              <button
                onClick={async () => {
                  if (!confirm(`حذف هذه الدفعة؟`)) return;
                  await fetch(`/api/customer-payments/${r.id}`, { method: "DELETE" });
                  refetch();
                }}
                className="p-1.5 hover:bg-red-100 rounded"
                title="حذف"
              >🗑️</button>
            ) : null
          },
        ]}
      />

      {showAdd && <AddPaymentModal customers={customers} onClose={() => { setShowAdd(false); refetch(); }} />}
    </DashboardLayout>
  );
}

function AddPaymentModal({ customers, onClose }: { customers: any[]; onClose: () => void }) {
  const { mutate, loading: saving } = useApiMutation();
  const [customerId, setCustomerId] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [orderId, setOrderId] = useState("");
  const [form, setForm] = useState({ amount: "", payment_method: "نقدي", date: new Date().toISOString().slice(0, 10), notes: "" });
  const [error, setError] = useState<string | null>(null);

  // Fetch orders when customer changes
  async function onCustomerChange(id: string) {
    setCustomerId(id);
    setOrderId("");
    if (!id) { setOrders([]); return; }
    const res = await fetch(`/api/orders?limit=500&customer_id=${id}`);
    const json = await res.json();
    setOrders(json?.items ?? []);
  }

  async function submit() {
    setError(null);
    if (!customerId || !form.amount || Number(form.amount) <= 0) {
      setError("العميل والمبلغ مطلوبان");
      return;
    }
    const { error } = await mutate("POST", "/api/customer-payments", {
      customer_id: customerId,
      order_id: orderId || null,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      date: form.date || new Date().toISOString().slice(0, 10),
      notes: form.notes || null,
    });
    if (error) { setError(error); return; }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">💰 تسجيل دفعة جديدة</h2>
        <div className="space-y-3">
          <Select
            label="العميل *"
            value={customerId}
            onChange={e => onCustomerChange(e.target.value)}
            options={[{ value: "", label: "— اختر العميل —" }, ...customers.map((c: any) => ({ value: c.id, label: c.name }))]}
          />
          {orders.length > 0 && (
            <Select
              label="ربط بأوردر (اختياري)"
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
              options={[{ value: "", label: "— دفعة عامة —" }, ...orders.map((o: any) => ({ value: o.id, label: `${o.order_name} (${formatCurrency(o.total || 0)})` }))]}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="المبلغ *" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            <Select label="طريقة الدفع" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} options={[
              { value: "نقدي", label: "نقدي" },
              { value: "تحويل بنكي", label: "تحويل بنكي" },
              { value: "شيك", label: "شيك" },
              { value: "أخرى", label: "أخرى" },
            ]} />
          </div>
          <Input label="التاريخ" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <Input label="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="اختياري" />
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            💡 هذه الدفعة للتوثيق فقط — لا تدخل في حسابات اليومية أو الأرباح.
          </div>
          {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={submit} loading={saving}>💾 تسجيل الدفعة</Button>
        </div>
      </div>
    </div>
  );
}

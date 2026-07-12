"use client";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import { useApiMutation } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_COLORS, ORDER_TYPE_LABELS } from "@/lib/format";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: profile } = useUserStore();
  const { data: customerData, loading } = useApi<any>(`/api/customers/${id}`);
  const customer = customerData?.data ?? customerData;
  const { data: ordersRes } = useApi<{ items: any[] }>(`/api/orders?limit=500&customer_id=${id}`);
  const { data: paymentsRes, refetch: refetchPayments } = useApi<{ items: any[] }>(`/api/customer-payments?customer_id=${id}`);
  const orders = ordersRes?.items ?? [];
  const payments = paymentsRes?.items ?? [];

  // Add payment modal
  const [showPayment, setShowPayment] = useState(false);
  const { mutate, loading: saving } = useApiMutation();

  async function submitPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get("amount"));
    const orderId = form.get("order_id") as string;
    const paymentMethod = form.get("payment_method") as string;
    const date = form.get("date") as string;
    const notes = form.get("notes") as string;

    if (!amount || amount <= 0) return alert("أدخل مبلغ صحيح");

    const { error } = await mutate("POST", "/api/customer-payments", {
      customer_id: id,
      order_id: orderId || null,
      amount,
      payment_method: paymentMethod || "نقدي",
      date: date || new Date().toISOString().slice(0, 10),
      notes: notes || null,
    });

    if (error) return alert("خطأ: " + error);
    setShowPayment(false);
    refetchPayments();
    (e.target as HTMLFormElement).reset();
  }

  if (!profile) return null;
  if (!customer && !loading) return <DashboardLayout profile={profile}><div className="card">العميل غير موجود</div></DashboardLayout>;

  const totalCost = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const remaining = totalCost - totalPaid;

  // Calculate per-order payments
  const paymentsByOrder = useMemo(() => {
    const m: Record<string, number> = {};
    payments.forEach((p: any) => {
      if (p.order_id) {
        m[p.order_id] = (m[p.order_id] || 0) + Number(p.amount || 0);
      }
    });
    return m;
  }, [payments]);

  // Unlinked payments (not linked to any order)
  const unlinkedPayments = payments.filter((p: any) => !p.order_id);

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title={customer?.name ?? "..."}
        subtitle={customer?.branch_name ?? ""}
        backHref="/customers"
        actions={
          <Button onClick={() => setShowPayment(true)}>💰 تسجيل دفعة</Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-gray-500">رقم التواصل</div>
          <div className="text-lg font-bold">{customer?.phone || "-"}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">إجمالي التكلفة</div>
          <div className="text-2xl font-bold text-brand-orange">{formatCurrency(totalCost)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">إجمالي المدفوع</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
        </div>
        <div className={`card border-r-4 ${remaining > 0 ? "border-red-400" : "border-green-400"}`}>
          <div className="text-sm text-gray-500">المتبقي</div>
          <div className={`text-2xl font-extrabold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(remaining)}</div>
        </div>
      </div>

      {customer?.address && <div className="card mb-4">📍 {customer.address}</div>}
      {customer?.notes && <div className="card mb-4">📝 {customer.notes}</div>}

      <h3 className="font-bold text-lg mt-6 mb-3">📦 كل أوردرات العميل (تصنيع + صيانة)</h3>
      <DataTable
        rows={orders}
        emptyMessage="لا توجد أوردرات لهذا العميل بعد"
        columns={[
          { key: "order_name", label: "اسم الأوردر", render: r => <Link href={`/orders/${r.id}`} className="text-brand-orange hover:underline">{r.order_name}</Link> },
          { key: "order_type", label: "النوع", render: r => ORDER_TYPE_LABELS[r.order_type] || r.order_type },
          { key: "status", label: "الحالة", render: r => <span className={`badge ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status] || r.status}</span> },
          { key: "start_date", label: "تاريخ البدء", render: r => formatDate(r.start_date) },
          { key: "total", label: "التكلفة", render: r => <span className="font-bold">{formatCurrency(r.total)}</span> },
          {
            key: "paid", label: "المدفوع",
            render: r => {
              const paid = paymentsByOrder[r.id] || 0;
              const remaining = (r.total || 0) - paid;
              return (
                <div>
                  <div className="font-bold text-green-600">{formatCurrency(paid)}</div>
                  {remaining > 0 && <div className="text-xs text-red-500">متبقي: {formatCurrency(remaining)}</div>}
                </div>
              );
            }
          },
        ]}
      />

      <h3 className="font-bold text-lg mt-8 mb-3">💰 سجل المدفوعات ({payments.length})</h3>
      {payments.length > 0 ? (
        <DataTable
          rows={payments}
          emptyMessage="لا توجد مدفوعات مسجلة"
          columns={[
            { key: "date", label: "التاريخ", render: r => formatDate(r.date) },
            { key: "amount", label: "المبلغ", render: r => <span className="font-bold text-green-600">{formatCurrency(Number(r.amount))}</span> },
            { key: "payment_method", label: "طريقة الدفع" },
            {
              key: "order", label: "الأوردر",
              render: r => r.order
                ? <Link href={`/orders/${r.order_id}`} className="text-brand-orange hover:underline text-xs">{r.order.order_name}</Link>
                : <span className="text-gray-400 text-xs">— عامة —</span>
            },
            { key: "notes", label: "ملاحظات", render: r => r.notes || "-" },
            {
              key: "_actions", label: "",
              render: (r: any) => (
                <button
                  onClick={async () => {
                    if (!confirm(`حذف هذه الدفعة (${formatCurrency(Number(r.amount))})؟`)) return;
                    await fetch(`/api/customer-payments/${r.id}`, { method: "DELETE" });
                    refetchPayments();
                  }}
                  className="p-1 hover:bg-red-100 rounded"
                  title="حذف الدفعة"
                >🗑️</button>
              )
            },
          ]}
        />
      ) : (
        <div className="card text-center text-gray-400 py-8">
          <div className="text-4xl mb-2">💰</div>
          <div>لا توجد مدفوعات مسجلة لهذا العميل بعد</div>
        </div>
      )}

      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPayment(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">💰 تسجيل دفعة جديدة - {customer?.name}</h2>
            <form onSubmit={submitPayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="المبلغ *" name="amount" type="number" step="0.01" min="0" required placeholder="0.00" />
                <Select label="طريقة الدفع" name="payment_method" defaultValue="نقدي" options={[
                  { value: "نقدي", label: "نقدي" },
                  { value: "تحويل بنكي", label: "تحويل بنكي" },
                  { value: "شيك", label: "شيك" },
                  { value: "أخرى", label: "أخرى" },
                ]} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="التاريخ" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                <Select label="ربط بأوردر (اختياري)" name="order_id" defaultValue="" options={[
                  { value: "", label: "— دفعة عامة —" },
                  ...orders.map((o: any) => ({ value: o.id, label: o.order_name + ` (${formatCurrency(o.total || 0)})` })),
                ]} />
              </div>
              <Input label="ملاحظات" name="notes" placeholder="اختياري" />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                💡 هذه الدفعة للتوثيق فقط — لا تدخل في حسابات اليومية أو الأرباح.
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="secondary" type="button" onClick={() => setShowPayment(false)}>إلغاء</Button>
                <Button type="submit" loading={saving}>💾 تسجيل الدفعة</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

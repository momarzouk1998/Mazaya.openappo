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

interface RoadExpenseEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  payment_method: string | null;
  order_id: string | null;
  order_name: string | null;
  customer_name: string | null;
  notes: string | null;
}

interface Order {
  id: string;
  order_name: string;
  customer?: { name: string };
}

const PAY_OPTS = [{ value: "نقدي", label: "نقدي" }, { value: "تحويل", label: "تحويل" }];
const EMPTY_FORM = {
  amount: "",
  payment_method: "نقدي",
  date: new Date().toISOString().slice(0, 10),
  order_id: "",
  notes: "",
};

export default function RoadExpensesPage() {
  const { user: profile } = useUserStore();
  const { can } = useCan();
  const { data, loading, refetch } = useApi<{ entries: RoadExpenseEntry[] }>("/api/road-expenses?limit=500");
  const { data: ordersData } = useApi<{ items: Order[] }>("/api/orders?limit=500");
  const { mutate, loading: saving } = useApiMutation();

  const entries = data?.entries ?? [];
  const orders = ordersData?.items ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;
  const canSee = canSeeModule(profile, "road_expenses") || canSeeModule(profile, "overhead");
  if (!canSee) {
    return (
      <DashboardLayout profile={profile}>
        <div className="card text-center text-gray-500 py-12">🔒 هذه الصفحة للمصنع فقط.</div>
      </DashboardLayout>
    );
  }

  const total = entries.reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const withOrder = entries.filter((e) => e.order_id).length;

  const rowsWithOrder = entries.map((e) => ({
    ...e,
    order_name: e.order_name || (e.order_id ? orders.find((o) => o.id === e.order_id)?.order_name || "—" : "—"),
  }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.amount || Number(form.amount) <= 0) {
      setError("المبلغ مطلوب ويجب أن يكون أكبر من صفر");
      return;
    }
    const { error: err } = await mutate("POST", "/api/road-expenses", {
      amount: Number(form.amount),
      payment_method: form.payment_method,
      date: form.date,
      order_id: form.order_id || null,
      notes: form.notes || null,
    });
    if (err) {
      setError(err);
      return;
    }
    setShowForm(false);
    setForm(EMPTY_FORM);
    refetch();
  }

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="مصاريف الطريق والعمل بالمواقع"
        subtitle="مصاريف انتقالات، أكل، وشرب العمال في الطرق والمواقع — تخصم من خزينة المصنع وتحمل على الأوردر"
        helpTitle="مصاريف الطريق"
        helpDescription="تسجيل أي مبالغ تم صرفها كبدل طريق أو انتقالات أو إعاشة للعمال عند سفرهم أو عملهم خارج المصنع، مع إمكانية ربط الحركة بالأوردر المعني مباشرة لترحل لتكاليفه الحقيقية."
        actions={<PWAInstallButton />}
      />

      {/* كروت ملخصة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="card bg-white border-r-4 border-amber-500">
          <div className="text-xs text-gray-500">إجمالي مصاريف الطريق</div>
          <div className="text-2xl font-extrabold text-amber-600">{formatCurrency(total)}</div>
        </div>
        <div className="card bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <div className="text-xs opacity-90">عدد الحركات المصروفة</div>
          <div className="text-2xl font-extrabold">{entries.length}</div>
        </div>
        <div className="card bg-white border-r-4 border-amber-500">
          <div className="text-xs text-gray-500">حركات مرتبطة بأوردرات</div>
          <div className="text-2xl font-bold text-brand-black">{withOrder} حركة</div>
        </div>
      </div>

      {/* شريط الأدوات */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">
          آخر حركة: {entries[0] ? formatDate(entries[0].date) : "—"}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportToExcel(rowsWithOrder as any, "road-expenses")}
            disabled={entries.length === 0}
          >
            📥 تصدير
          </Button>
          <Button size="sm" onClick={() => { setShowForm((v) => !v); setError(null); }}>
            + مصروف طريق جديد
          </Button>
        </div>
      </div>

      {/* فورم الإضافة */}
      {showForm && (
        <form onSubmit={submit} className="card mb-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-amber-50/50 border border-amber-200">
          <Input
            label="المبلغ *"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
          />
          <Input
            label="التاريخ"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Select
            label="طريقة الدفع"
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            options={PAY_OPTS}
          />
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">الأوردر (اختياري)</label>
            <select
              value={form.order_id}
              onChange={(e) => setForm({ ...form, order_id: e.target.value })}
              className="w-full px-4 py-2.5 border rounded-lg bg-white"
            >
              <option value="">— بدون أوردر (مصروف طريق عام) —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  📦 {o.order_name} {o.customer?.name ? `(${o.customer.name})` : ""}
                </option>
              ))}
            </select>
            {form.order_id && (
              <p className="text-xs text-amber-800 mt-1 bg-amber-100 p-2 rounded">
                ✓ المبلغ يتراكم تلقائياً على تكاليف مصاريف الطريق الخاصة بالأوردر.
              </p>
            )}
          </div>
          <div className="md:col-span-3">
            <Input
              label="ملاحظات والتفاصيل"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="مثال: أكل وشرب للعمال في موقع القاهرة، مواصلات من وإلى الموقع..."
            />
          </div>
          {error && <div className="md:col-span-3 bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
          <div className="md:col-span-3 flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={saving}>
              حفظ المصروف
            </Button>
          </div>
        </form>
      )}

      {/* الجدول */}
      {loading ? (
        <div className="card text-center text-gray-400 py-12">جاري التحميل...</div>
      ) : rowsWithOrder.length === 0 ? (
        <div className="card text-center text-gray-500 py-12">مفيش مصاريف طريق مسجلة لسه. اضغط '+ مصروف طريق جديد'.</div>
      ) : (
        <div className="card overflow-hidden p-0 border shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-right">التاريخ</th>
                <th className="p-3 text-right">المبلغ</th>
                <th className="p-3 text-right">الطريقة</th>
                <th className="p-3 text-right">الأوردر / الموقع</th>
                <th className="p-3 text-right">ملاحظات والتفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rowsWithOrder.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition">
                  <td className="p-3">{formatDate(row.date)}</td>
                  <td className="p-3 font-extrabold text-amber-700">{formatCurrency(Number(row.amount ?? 0))}</td>
                  <td className="p-3">{row.payment_method || "—"}</td>
                  <td className="p-3">
                    <span className={row.order_id ? "font-bold text-brand-orange" : "text-gray-400"}>
                      {row.order_name}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 text-xs">{row.notes || row.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

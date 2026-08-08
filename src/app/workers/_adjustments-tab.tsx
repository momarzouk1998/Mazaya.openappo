"use client";
import { useState } from "react";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/format";

interface Worker { id: string; name: string; }
interface Bonus {
  id: string;
  worker_id: string;
  bonus_type: string;
  amount: number;
  reason: string;
  bonus_date: string;
  notes: string | null;
  worker?: { name: string };
}

export function AdjustmentsTab() {
  const { data: workersData } = useApi<{ items: Worker[] }>("/api/workers?limit=500");
  const { data: adjustmentsData, refetch } = useApi<{ items: Bonus[] }>("/api/workers/adjustments?limit=500");
  const { mutate, loading: saving } = useApiMutation();

  const workers = workersData?.items ?? [];
  const items = adjustmentsData?.items ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    worker_id: "",
    bonus_type: "مكافأة",
    amount: "",
    reason: "",
    bonus_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.worker_id || !form.amount) {
      setError("العامل والمبلغ مطلوبان");
      return;
    }

    const { error: err } = await mutate("POST", "/api/workers/adjustments", {
      worker_id: form.worker_id,
      bonus_type: form.bonus_type,
      amount: Number(form.amount),
      reason: form.reason || form.bonus_type,
      bonus_date: form.bonus_date,
      notes: form.notes || null,
    });

    if (err) {
      setError(err);
      return;
    }

    setShowForm(false);
    setForm({
      worker_id: "",
      bonus_type: "مكافأة",
      amount: "",
      reason: "",
      bonus_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت تأكد من الحذف؟")) return;
    const { error: err } = await mutate("DELETE", `/api/workers/adjustments?id=${id}`);
    if (err) alert("❌ " + err);
    else refetch();
  }

  const totalBonuses = items.filter((i) => i.bonus_type === "مكافأة").reduce((s, i) => s + Number(i.amount), 0);
  const totalDiscounts = items.filter((i) => i.bonus_type === "خصم").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          إجمالي المكافآت: <strong className="text-green-600 font-bold">{formatCurrency(totalBonuses)}</strong> — إجمالي
          الخصومات: <strong className="text-amber-700 font-bold">{formatCurrency(totalDiscounts)}</strong>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          + إضافة خصم أو مكافأة
        </Button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-gray-50 border">
          <Select
            label="العامل *"
            value={form.worker_id}
            onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
            options={[{ value: "", label: "— اختر العامل —" }, ...workers.map((w) => ({ value: w.id, label: w.name }))]}
          />
          <Select
            label="النوع *"
            value={form.bonus_type}
            onChange={(e) => setForm({ ...form, bonus_type: e.target.value })}
            options={[
              { value: "مكافأة", label: "🎁 مكافأة (بونص)" },
              { value: "خصم", label: "⚠️ خصم (جزاء)" },
            ]}
          />
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
            value={form.bonus_date}
            onChange={(e) => setForm({ ...form, bonus_date: e.target.value })}
          />
          <div className="md:col-span-3">
            <Input
              label="السبب / السبب المباشر"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="مثال: إنجاز سريعة في أوردر، تأخير، إلخ"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={saving} size="sm">
              حفظ
            </Button>
          </div>
          {error && <div className="md:col-span-4 bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
        </form>
      )}

      {/* الجدول */}
      <div className="card overflow-hidden p-0 border shadow-sm">
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-400">مفيش خصومات أو مكافآت مسجلة حتى الآن.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-right">التاريخ</th>
                  <th className="p-3 text-right">العامل</th>
                  <th className="p-3 text-center">النوع</th>
                  <th className="p-3 text-right">المبلغ</th>
                  <th className="p-3 text-right">السبب / التفاصيل</th>
                  <th className="p-3 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="p-3">{formatDate(row.bonus_date)}</td>
                    <td className="p-3 font-bold text-gray-800">{row.worker?.name}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`badge ${
                          row.bonus_type === "خصم" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {row.bonus_type === "خصم" ? "⚠️ خصم" : "🎁 مكافأة"}
                      </span>
                    </td>
                    <td
                      className={`p-3 font-bold ${row.bonus_type === "خصم" ? "text-amber-700" : "text-green-700"}`}
                    >
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="p-3 text-gray-600">{row.reason || row.notes || "—"}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="p-1 hover:bg-red-100 text-red-600 rounded transition"
                        title="حذف"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

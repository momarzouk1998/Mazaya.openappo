"use client";
import { useMemo, useState } from "react";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { useCan } from "@/hooks/useCan";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";

interface Worker { id: string; name: string; phone?: string; }
interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  payment_kind: string | null;
  worker_id: string;
  notes: string | null;
}

interface WorkerStats {
  qabd: number;
  salaf: number;
  last: string | null;
  entries: Expense[];
}

function getCurrentWeekSaturday() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day + 1) % 7;
  const sat = new Date(now);
  sat.setDate(now.getDate() - diff);
  return sat.toISOString().slice(0, 10);
}

export function WagesTab() {
  const { can } = useCan();
  const { data: workersData } = useApi<{ items: Worker[] }>("/api/workers?limit=500");
  const { data: ohData, refetch } = useApi<{ expenses: Expense[] }>("/api/overhead?limit=2000");
  const { mutate, loading: saving } = useApiMutation();

  const workers = workersData?.items ?? [];
  const allExpenses = ohData?.expenses ?? [];

  // فلاتر التاريخ والتقارير للأسبوع والشهر
  const [filterMode, setFilterMode] = useState<"current_week" | "current_month" | "all" | "custom">("current_week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const currentSaturday = useMemo(() => getCurrentWeekSaturday(), []);
  const currentMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }, []);

  // الفلترة حسب الفترة المختارة
  const filteredWages = useMemo(() => {
    return allExpenses.filter((e) => {
      if (!e.worker_id) return false;
      const d = String(e.date).slice(0, 10);
      if (filterMode === "current_week") {
        return d >= currentSaturday;
      }
      if (filterMode === "current_month") {
        return d >= currentMonthStart;
      }
      if (filterMode === "custom") {
        if (customStart && d < customStart) return false;
        if (customEnd && d > customEnd) return false;
        return true;
      }
      return true;
    });
  }, [allExpenses, filterMode, currentSaturday, currentMonthStart, customStart, customEnd]);

  // إحصائيات السلف الأسبوعية والشهري والإجمالية العامة
  const totalSalafThisWeek = useMemo(() => {
    return allExpenses
      .filter((e) => e.worker_id && e.payment_kind === "سلفة" && String(e.date).slice(0, 10) >= currentSaturday)
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [allExpenses, currentSaturday]);

  const totalSalafThisMonth = useMemo(() => {
    return allExpenses
      .filter((e) => e.worker_id && e.payment_kind === "سلفة" && String(e.date).slice(0, 10) >= currentMonthStart)
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [allExpenses, currentMonthStart]);

  const totalSalafAllTime = useMemo(() => {
    return allExpenses
      .filter((e) => e.worker_id && e.payment_kind === "سلفة")
      .reduce((s, e) => s + Number(e.amount), 0);
  }, [allExpenses]);

  // تجميع لكل عامل حسب الفلتر المختار
  const stats = useMemo(() => {
    const m: Record<string, WorkerStats> = {};
    for (const w of workers) m[w.id] = { qabd: 0, salaf: 0, last: null, entries: [] };
    for (const e of filteredWages) {
      if (!m[e.worker_id]) m[e.worker_id] = { qabd: 0, salaf: 0, last: null, entries: [] };
      const d = String(e.date).slice(0, 10);
      if (e.payment_kind === "سلفة") m[e.worker_id].salaf += Number(e.amount);
      else m[e.worker_id].qabd += Number(e.amount);
      if (!m[e.worker_id].last || d > (m[e.worker_id].last as string)) m[e.worker_id].last = d;
      m[e.worker_id].entries.push(e);
    }
    return m;
  }, [filteredWages, workers]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    worker_id: "",
    amount: "",
    payment_kind: "سلفة",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const rowsWithStats = workers
    .map((w) => ({
      ...w,
      qabd: stats[w.id]?.qabd ?? 0,
      salaf: stats[w.id]?.salaf ?? 0,
      net: (stats[w.id]?.qabd ?? 0) - (stats[w.id]?.salaf ?? 0),
      last: stats[w.id]?.last ?? null,
    }))
    .filter((w) => w.qabd > 0 || w.salaf > 0);

  async function submitWage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.worker_id || !form.amount) {
      setError("العامل والمبلغ مطلوبان");
      return;
    }
    const workerName = workers.find((w) => w.id === form.worker_id)?.name || "";
    const { error: err } = await mutate("POST", "/api/overhead?create_journal=true", {
      date: form.date,
      category: "أجور عمال",
      description: `${form.payment_kind === "سلفة" ? "سلفة عامل" : "أجر عامل"}: ${workerName}`,
      amount: Number(form.amount),
      payment_method: "نقدي",
      payment_kind: form.payment_kind,
      notes: form.notes || null,
      worker_id: form.worker_id,
    });
    if (err) {
      setError(err);
      return;
    }
    setShowForm(false);
    setForm((f) => ({ ...f, amount: "", notes: "" }));
    refetch();
  }

  const totalQabd = rowsWithStats.reduce((s, w) => s + w.qabd, 0);
  const totalSalaf = rowsWithStats.reduce((s, w) => s + w.salaf, 0);

  return (
    <div className="space-y-4">
      {/* كروت تقارير السلف الأسبوعية والشهري */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card bg-white border-r-4 border-red-500">
          <div className="text-xs text-gray-500">سلف الأسبوع الحالي (من السبت {formatDate(currentSaturday)})</div>
          <div className="text-2xl font-extrabold text-red-600">{formatCurrency(totalSalafThisWeek)}</div>
        </div>
        <div className="card bg-white border-r-4 border-amber-500">
          <div className="text-xs text-gray-500">سلف الشهر الحالي ({formatDate(currentMonthStart)})</div>
          <div className="text-2xl font-extrabold text-amber-700">{formatCurrency(totalSalafThisMonth)}</div>
        </div>
        <div className="card bg-white border-r-4 border-gray-700">
          <div className="text-xs text-gray-500">إجمالي كافة السلف المسجلة</div>
          <div className="text-2xl font-extrabold text-brand-black">{formatCurrency(totalSalafAllTime)}</div>
        </div>
      </div>

      {/* شريط الفلاتر والتقارير الزمانية */}
      <div className="card bg-gray-50 border p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-gray-700">📅 عرض الفترة:</span>
          <button
            onClick={() => setFilterMode("current_week")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterMode === "current_week" ? "bg-brand-orange text-white" : "bg-white border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🔄 الأسبوع الحالي (تصفير سلف)
          </button>
          <button
            onClick={() => setFilterMode("current_month")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterMode === "current_month" ? "bg-brand-orange text-white" : "bg-white border text-gray-700 hover:bg-gray-100"
            }`}
          >
            📆 الشهر الحالي
          </button>
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterMode === "all" ? "bg-brand-orange text-white" : "bg-white border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🌐 كل الفترات
          </button>
          <button
            onClick={() => setFilterMode("custom")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterMode === "custom" ? "bg-brand-orange text-white" : "bg-white border text-gray-700 hover:bg-gray-100"
            }`}
          >
            🔍 مدى مخصص
          </button>
        </div>

        {filterMode === "custom" && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 border rounded bg-white"
            />
            <span>إلى</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 border rounded bg-white"
            />
          </div>
        )}
      </div>

      {/* شريط الإحصائيات وزر الإضافة */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          عدد العمال بالفترة: <strong>{rowsWithStats.length}</strong> — إجمالي القبض:{" "}
          <strong className="text-green-600">{formatCurrency(totalQabd)}</strong> — إجمالي السلف للفترة:{" "}
          <strong className="text-red-600">{formatCurrency(totalSalaf)}</strong>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportToExcel(rowsWithStats as any, "workers-wages-report")}
            disabled={rowsWithStats.length === 0}
          >
            📥 تصدير التقرير
          </Button>
          {can("overhead", "add") && (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              + تسجيل سلفة / دفع لعامل
            </Button>
          )}
        </div>
      </div>

      {/* فورم الإضافة */}
      {showForm && (
        <form onSubmit={submitWage} className="card grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-gray-50 border">
          <div className="md:col-span-1">
            <Select
              label="العامل *"
              value={form.worker_id}
              onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
              options={[{ value: "", label: "— اختر —" }, ...workers.map((w) => ({ value: w.id, label: w.name }))]}
            />
          </div>
          <div>
            <Input
              label="المبلغ *"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
            />
          </div>
          <div>
            <Select
              label="النوع *"
              value={form.payment_kind}
              onChange={(e) => setForm({ ...form, payment_kind: e.target.value })}
              options={[
                { value: "سلفة", label: "🔴 سلفة (خصم)" },
                { value: "قبض", label: "🟢 قبض مستحق" },
              ]}
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
          <div className="flex gap-2">
            <Button type="submit" loading={saving} size="sm">
              حفظ
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
              إلغاء
            </Button>
          </div>
          <div className="md:col-span-5">
            <Input
              label="ملاحظات"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="سبب السلفة أو ملاحظة..."
            />
          </div>
          {error && <div className="md:col-span-5 bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
        </form>
      )}

      {/* الجدول */}
      <DataTable
        rows={rowsWithStats}
        emptyMessage="مفيش عمال بأجور أو سلف في هذه الفترة."
        columns={[
          { key: "name", label: "الاسم", render: (r) => <span className="font-semibold text-brand-orange">{r.name}</span> },
          { key: "qabd", label: "إجمالي القبض", render: (r) => <span className="font-bold text-green-600">{formatCurrency(r.qabd)}</span> },
          { key: "salaf", label: "إجمالي السلف", render: (r) => <span className="font-bold text-red-600">{formatCurrency(r.salaf)}</span> },
          {
            key: "net",
            label: "الصافي للفترة",
            render: (r) => (
              <span className={`font-bold ${r.net >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(r.net)}
              </span>
            ),
          },
          { key: "last", label: "آخر دفعة", render: (r) => (r.last ? formatDate(r.last) : "-") },
          {
            key: "_expand",
            label: "تفاصيل",
            render: (r) => (
              <Button size="sm" variant="secondary" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                📋
              </Button>
            ),
          },
        ]}
      />

      {expanded && stats[expanded] && (
        <div className="card border-brand-orange/30">
          <div className="font-bold mb-2 text-brand-orange">
            سجل حركة سلف وأجور: {workers.find((w) => w.id === expanded)?.name}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">النوع</th>
                <th className="p-2 text-right">المبلغ</th>
                <th className="p-2 text-right">ملاحظة</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats[expanded].entries
                .slice()
                .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                .map((e) => (
                  <tr key={e.id}>
                    <td className="p-2">{formatDate(String(e.date))}</td>
                    <td className="p-2">
                      <span
                        className={`badge ${
                          e.payment_kind === "سلفة"
                            ? "bg-red-100 text-red-700 border-red-300"
                            : "bg-green-100 text-green-700 border-green-300"
                        }`}
                      >
                        {e.payment_kind || "قبض"}
                      </span>
                    </td>
                    <td className={`p-2 font-bold ${e.payment_kind === "سلفة" ? "text-red-600" : "text-green-600"}`}>
                      {formatCurrency(Number(e.amount))}
                    </td>
                    <td className="p-2 text-gray-500">{e.notes || "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

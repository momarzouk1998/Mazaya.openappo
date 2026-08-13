"use client";
import { useEffect, useState } from "react";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/format";

interface Worker {
  id: string;
  name: string;
  daily_rate: number;
  travel_daily_rate: number;
}

interface Order {
  id: string;
  order_name: string;
  customer?: { name: string };
}

interface DailyLogEntry {
  worker_id: string;
  order_id: string;
  daily_rate: string | number;
  is_travel: boolean;
  notes: string;
}

interface SavedLog {
  id: string;
  worker_id: string;
  order_id: string | null;
  work_date: string;
  daily_rate: number;
  is_travel: boolean;
  notes: string | null;
  worker: { name: string };
  order?: { order_name: string };
}

export function DailyLogsTab() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const { data: workersData, loading: workersLoading, error: workersError, refetch: refetchWorkers } = useApi<{ items: Worker[] }>("/api/workers?limit=500");
  const { data: ordersData } = useApi<{ items: Order[] }>("/api/orders?limit=500");
  const { data: existingLogsData, refetch: refetchLogs } = useApi<{ items: SavedLog[] }>(
    `/api/workers/daily-logs?date=${selectedDate}`
  );
  const { mutate, loading: saving } = useApiMutation();

  const workers = workersData?.items ?? [];
  const orders = ordersData?.items ?? [];
  const existingLogs = existingLogsData?.items ?? [];

  // Form state indexed by worker_id
  const [logEntries, setLogEntries] = useState<Record<string, DailyLogEntry>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Initialize or update entries when date or workers or existingLogs change
  useEffect(() => {
    const map: Record<string, DailyLogEntry> = {};
    for (const w of workers) {
      const existing = existingLogs.find((l) => l.worker_id === w.id);
      if (existing) {
        map[w.id] = {
          worker_id: w.id,
          order_id: existing.order_id || "",
          daily_rate: existing.daily_rate,
          is_travel: existing.is_travel,
          notes: existing.notes || "",
        };
      } else {
        map[w.id] = {
          worker_id: w.id,
          order_id: "",
          daily_rate: Number(w.daily_rate || 0),
          is_travel: false,
          notes: "",
        };
      }
    }
    setLogEntries(map);
  }, [workers, existingLogs, selectedDate]);

  function handleRateTypeChange(workerId: string, isTravel: boolean) {
    const w = workers.find((item) => item.id === workerId);
    if (!w) return;
    setLogEntries((prev) => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        is_travel: isTravel,
        daily_rate: isTravel ? Number(w.travel_daily_rate || 0) : Number(w.daily_rate || 0),
      },
    }));
  }

  function updateEntry(workerId: string, field: keyof DailyLogEntry, value: any) {
    setLogEntries((prev) => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        [field]: value,
      },
    }));
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    // Collect entries that have either an order selected or a rate > 0
    const payload = Object.values(logEntries).filter(
      (entry) => entry.order_id || Number(entry.daily_rate) > 0 || entry.notes
    );

    if (payload.length === 0) {
      setMessage({ type: "error", text: "يرجى تحديد أوردر أو قيمة يومية لعامل واحد على الأقل قبل الحفظ." });
      return;
    }

    const { error } = await mutate("POST", "/api/workers/daily-logs", {
      date: selectedDate,
      entries: payload,
    });

    if (error) {
      setMessage({ type: "error", text: error });
    } else {
      setMessage({ type: "success", text: `تم حفظ يوميات يوم ${formatDate(selectedDate)} بنجاح 🎉` });
      refetchLogs();
    }
  }

  async function handleDeleteLog(id: string) {
    if (!confirm("هل أنت تأكد من حذف هذه اليومية؟")) return;
    const { error } = await mutate("DELETE", `/api/workers/daily-logs?id=${id}`);
    if (error) {
      alert("❌ " + error);
    } else {
      refetchLogs();
    }
  }

  const totalLoggedToday = Object.values(logEntries).reduce(
    (sum, entry) => sum + (entry.order_id || Number(entry.daily_rate) > 0 ? Number(entry.daily_rate || 0) : 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* شريط اختيار التاريخ والملخص */}
      <div className="card flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-brand-orange/20">
        <div className="flex items-center gap-3">
          <label className="font-bold text-gray-700 text-sm">📅 تاريخ اليومية:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-xl bg-white font-semibold text-gray-800 shadow-sm focus:ring-2 focus:ring-brand-orange"
          />
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div>
            عدد العمال المسجلين اليوم: <strong className="text-brand-black">{existingLogs.length}</strong>
          </div>
          <div className="h-4 w-px bg-gray-300" />
          <div>
            إجمالي أجور اليوم: <strong className="text-brand-orange font-bold text-base">{formatCurrency(totalLoggedToday)}</strong>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between ${
            message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* جدول التسجيل المباشر لكل العمال */}
      <form onSubmit={handleSaveAll} className="space-y-4">
        <div className="card overflow-hidden p-0 border shadow-sm">
          <div className="p-4 bg-brand-black text-white font-bold flex items-center justify-between">
            <span className="flex items-center gap-2">
              📝 تسكيل مكان وعمل العمال اليومي ({formatDate(selectedDate)})
            </span>
            <span className="text-xs text-white/70 font-normal">
              💡 يمكنك تعديل سعر اليومية أو يومية السفر لكل عامل في هذا اليوم حسب رغبتك.
            </span>
          </div>

          {workersLoading ? (
            <div className="p-8 text-center text-gray-500">جاري تحميل قائمة العمال...</div>
          ) : workersError ? (
            <div className="p-8 text-center text-red-600 font-semibold flex flex-col items-center gap-2">
              <div>⚠️ تعذر جلب قائمة العمال حالياً: {workersError}</div>
              <Button size="sm" variant="secondary" onClick={() => refetchWorkers()}>🔄 إعادة التحديث</Button>
            </div>
          ) : workers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">لا يوجد عمال مسجلين في النظام. أضف عمالاً أولاً.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b text-gray-700">
                  <tr>
                    <th className="p-3 text-right">العامل</th>
                    <th className="p-3 text-right">الأوردر / موقع العمل</th>
                    <th className="p-3 text-center">نوع العمل</th>
                    <th className="p-3 text-right">قيمة اليومية (قابل للتعديل)</th>
                    <th className="p-3 text-right">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {workers.map((w) => {
                    const entry = logEntries[w.id] || {
                      worker_id: w.id,
                      order_id: "",
                      daily_rate: Number(w.daily_rate || 0),
                      is_travel: false,
                      notes: "",
                    };

                    return (
                      <tr key={w.id} className="hover:bg-gray-50/80 transition">
                        {/* اسم العامل */}
                        <td className="p-3">
                          <div className="font-bold text-gray-900">{w.name}</div>
                          <div className="text-xs text-gray-400">
                            يومية افتراضية: {formatCurrency(w.daily_rate || 0)} | سفر: {formatCurrency(w.travel_daily_rate || 0)}
                          </div>
                        </td>

                        {/* اختار الأوردر */}
                        <td className="p-3 min-w-[220px]">
                          <select
                            value={entry.order_id}
                            onChange={(e) => updateEntry(w.id, "order_id", e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-brand-orange"
                          >
                            <option value="">— عمل عام في المصنع (بدون أوردر) —</option>
                            {orders.map((o) => (
                              <option key={o.id} value={o.id}>
                                📦 {o.order_name} {o.customer?.name ? `(${o.customer.name})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* عادي أم سفر */}
                        <td className="p-3 text-center min-w-[130px]">
                          <div className="inline-flex rounded-lg border bg-gray-100 p-0.5 text-xs font-semibold">
                            <button
                              type="button"
                              onClick={() => handleRateTypeChange(w.id, false)}
                              className={`px-3 py-1 rounded-md transition ${
                                !entry.is_travel ? "bg-white text-brand-orange shadow-sm font-bold" : "text-gray-600 hover:text-gray-900"
                              }`}
                            >
                              🏠 عادي
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRateTypeChange(w.id, true)}
                              className={`px-3 py-1 rounded-md transition ${
                                entry.is_travel ? "bg-brand-orange text-white shadow-sm font-bold" : "text-gray-600 hover:text-gray-900"
                              }`}
                            >
                              ✈️ سفر
                            </button>
                          </div>
                        </td>

                        {/* قيمة اليومية المخصصة لهذا اليوم */}
                        <td className="p-3 min-w-[140px]">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={entry.daily_rate}
                              onChange={(e) => updateEntry(w.id, "daily_rate", e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg bg-white font-bold text-green-700 text-sm focus:ring-2 focus:ring-brand-orange"
                              placeholder="0"
                            />
                            <span className="absolute left-2 top-2 text-xs text-gray-400">ج.م</span>
                          </div>
                        </td>

                        {/* ملاحظات */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={entry.notes}
                            onChange={(e) => updateEntry(w.id, "notes", e.target.value)}
                            placeholder="ملاحظة..."
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* زر حفظ الكل */}
        <div className="flex justify-end">
          <Button type="submit" loading={saving} size="lg" className="px-8 shadow-lg">
            💾 حفظ يوميات اليوم ({formatDate(selectedDate)})
          </Button>
        </div>
      </form>

      {/* سجل اليوميات المحفوظة لهذا اليوم */}
      {existingLogs.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-bold text-base text-brand-black flex items-center gap-2">
            📋 سجل اليوميات المحفوظة لتاريخ {formatDate(selectedDate)}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-gray-600">
                <tr>
                  <th className="p-2.5 text-right">العامل</th>
                  <th className="p-2.5 text-right">المكان / الأوردر</th>
                  <th className="p-2.5 text-center">نوع العمل</th>
                  <th className="p-2.5 text-right">المبلغ</th>
                  <th className="p-2.5 text-right">ملاحظات</th>
                  <th className="p-2.5 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {existingLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-2.5 font-bold text-gray-800">{log.worker?.name}</td>
                    <td className="p-2.5">
                      {log.order ? (
                        <span className="font-semibold text-brand-orange">📦 {log.order.order_name}</span>
                      ) : (
                        <span className="text-gray-400">عمل عام في المصنع</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`badge ${log.is_travel ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                        {log.is_travel ? "✈️ سفر" : "🏠 عادي"}
                      </span>
                    </td>
                    <td className="p-2.5 font-bold text-green-600">{formatCurrency(log.daily_rate)}</td>
                    <td className="p-2.5 text-gray-500 text-xs">{log.notes || "—"}</td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => handleDeleteLog(log.id)}
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
        </div>
      )}
    </div>
  );
}

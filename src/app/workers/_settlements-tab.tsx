"use client";
import { useMemo, useState } from "react";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";

interface Worker { id: string; name: string; }
interface DailyLog { worker_id: string; work_date: string; daily_rate: number; }
interface Bonus { worker_id: string; bonus_type: string; amount: number; bonus_date: string; }
interface Advance { worker_id: string; amount: number; payment_kind: string; date: string; }

interface Settlement {
  id: string;
  worker_id: string;
  period_start: string;
  period_end: string;
  total_days: number;
  total_wages: number;
  total_bonuses: number;
  total_discounts: number;
  total_advances: number;
  net_payable: number;
  settled_at: string;
  notes: string | null;
  worker: { name: string };
}

// Helper to compute recent Saturday to Thursday range
function getDefaultWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sun, 6 is Sat
  // Find last Saturday
  const diffToSat = (dayOfWeek + 1) % 7;
  const sat = new Date(now);
  sat.setDate(now.getDate() - diffToSat);

  // Find next Thursday
  const thu = new Date(sat);
  thu.setDate(sat.getDate() + 5);

  return {
    start: sat.toISOString().slice(0, 10),
    end: thu.toISOString().slice(0, 10),
  };
}

export function SettlementsTab() {
  const defaultRange = useMemo(() => getDefaultWeekRange(), []);
  const [periodStart, setPeriodStart] = useState<string>(defaultRange.start);
  const [periodEnd, setPeriodEnd] = useState<string>(defaultRange.end);

  const { data: workersData } = useApi<{ items: Worker[] }>("/api/workers?limit=500");
  const { data: logsData } = useApi<{ items: DailyLog[] }>(
    `/api/workers/daily-logs?start_date=${periodStart}&end_date=${periodEnd}`
  );
  const { data: bonusesData } = useApi<{ items: Bonus[] }>(
    `/api/workers/adjustments?start_date=${periodStart}&end_date=${periodEnd}`
  );
  const { data: ohData } = useApi<{ expenses: Advance[] }>("/api/overhead?limit=2000");
  const { data: pastSettlementsData, refetch: refetchSettlements } = useApi<{ items: Settlement[] }>(
    "/api/workers/settlements?limit=500"
  );

  const { mutate, loading: settling } = useApiMutation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [settlementNotes, setSettlementNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const workers = workersData?.items ?? [];
  const dailyLogs = logsData?.items ?? [];
  const bonuses = bonusesData?.items ?? [];
  const allExpenses = ohData?.expenses ?? [];
  const pastSettlements = pastSettlementsData?.items ?? [];

  // Filter advances in range
  const advances = useMemo(() => {
    return allExpenses.filter(
      (e) =>
        e.worker_id &&
        e.payment_kind === "سلفة" &&
        String(e.date).slice(0, 10) >= periodStart &&
        String(e.date).slice(0, 10) <= periodEnd
    );
  }, [allExpenses, periodStart, periodEnd]);

  // Calculate live stats per worker for current selected period
  const liveStats = useMemo(() => {
    return workers.map((w) => {
      const wLogs = dailyLogs.filter((l) => l.worker_id === w.id);
      const wBonuses = bonuses.filter((b) => b.worker_id === w.id);
      const wAdvances = advances.filter((a) => a.worker_id === w.id);

      const totalDays = wLogs.length;
      const totalWages = wLogs.reduce((s, l) => s + Number(l.daily_rate), 0);
      const totalBonuses = wBonuses
        .filter((b) => b.bonus_type === "مكافأة")
        .reduce((s, b) => s + Number(b.amount), 0);
      const totalDiscounts = wBonuses
        .filter((b) => b.bonus_type === "خصم")
        .reduce((s, b) => s + Number(b.amount), 0);
      const totalAdvances = wAdvances.reduce((s, a) => s + Number(a.amount), 0);

      const netPayable = totalWages + totalBonuses - totalDiscounts - totalAdvances;

      return {
        worker_id: w.id,
        name: w.name,
        totalDays,
        totalWages,
        totalBonuses,
        totalDiscounts,
        totalAdvances,
        netPayable,
      };
    });
  }, [workers, dailyLogs, bonuses, advances]);

  const activeStats = liveStats.filter(
    (s) => s.totalDays > 0 || s.totalBonuses > 0 || s.totalDiscounts > 0 || s.totalAdvances > 0
  );

  const grandNetPayable = activeStats.reduce((s, w) => s + w.netPayable, 0);
  const grandWages = activeStats.reduce((s, w) => s + w.totalWages, 0);
  const grandAdvances = activeStats.reduce((s, w) => s + w.totalAdvances, 0);

  async function handleSettleWeek() {
    setMessage(null);
    const { error } = await mutate("POST", "/api/workers/settlements", {
      period_start: periodStart,
      period_end: periodEnd,
      notes: settlementNotes || `تقفيل أسبوعي من ${formatDate(periodStart)} إلى ${formatDate(periodEnd)}`,
    });

    if (error) {
      alert("❌ " + error);
    } else {
      setShowConfirm(false);
      setMessage("✅ تم إجراء التقفيل الأسبوعي للعمال بنجاح وإصدار قيود الأجور والترحيل للأرشيف!");
      refetchSettlements();
    }
  }

  return (
    <div className="space-y-6">
      {/* شريط المدى الزمني للتقفيل الحاضر */}
      <div className="card bg-gradient-to-r from-slate-900 to-brand-black text-white p-5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            🔒 التقفيل الأسبوعي لحسابات العمال
          </h2>
          <p className="text-xs text-gray-300 mt-1">
            يُحسب الصافي الحالي للفترة (من السبت للخميس)، وعند التقفيل ينزل الصافي كقبض وتُبدأ الفترة التالية بصافي صفر.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white/10 p-2 rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70">من السبت:</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="px-2 py-1 rounded bg-white text-brand-black font-semibold text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/70">إلى الخميس:</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="px-2 py-1 rounded bg-white text-brand-black font-semibold text-xs"
            />
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm font-semibold border border-green-200">
          {message}
        </div>
      )}

      {/* كروت ملخصة للأسبوع الحاضر */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card bg-white border-r-4 border-blue-500">
          <div className="text-xs text-gray-500">إجمالي مستحقات اليوميات</div>
          <div className="text-xl font-extrabold text-blue-600">{formatCurrency(grandWages)}</div>
        </div>
        <div className="card bg-white border-r-4 border-red-500">
          <div className="text-xs text-gray-500">إجمالي السلف المخصومة</div>
          <div className="text-xl font-extrabold text-red-600">{formatCurrency(grandAdvances)}</div>
        </div>
        <div className="card bg-gradient-to-br from-brand-orange to-amber-500 text-white shadow-lg">
          <div className="text-xs opacity-90">صافي المستحق للتقفيل الأسبوعي</div>
          <div className="text-2xl font-extrabold">{formatCurrency(grandNetPayable)}</div>
        </div>
        <div className="card bg-white border-r-4 border-gray-700 flex items-center justify-center">
          <Button
            size="lg"
            onClick={() => setShowConfirm(true)}
            disabled={activeStats.length === 0}
            className="w-full font-bold bg-brand-black hover:bg-black text-white"
          >
            🔒 تقفيل وحساب الأسبوع
          </Button>
        </div>
      </div>

      {/* جدول الحساب الحالي الحاضر للعمال */}
      <div className="card overflow-hidden p-0 border shadow-sm">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">
            📊 حساب الأسبوع الحاضر ({formatDate(periodStart)} إلى {formatDate(periodEnd)})
          </h3>
          <span className="text-xs text-gray-500">عدد العمال النشطين هذا الأسبوع: {activeStats.length}</span>
        </div>

        {activeStats.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            مفيش حركة يوميات أو سلف مسجلة في هذا النطاق الزمني.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b text-gray-700">
                <tr>
                  <th className="p-3 text-right">العامل</th>
                  <th className="p-3 text-center">أيام العمل</th>
                  <th className="p-3 text-right">إجمالي اليوميات</th>
                  <th className="p-3 text-right text-green-700">مكافآت (+)</th>
                  <th className="p-3 text-right text-amber-700">خصومات (-)</th>
                  <th className="p-3 text-right text-red-600">سلف (-)</th>
                  <th className="p-3 text-right font-extrabold text-brand-orange">الصافي المستحق</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeStats.map((s) => (
                  <tr key={s.worker_id} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-900">{s.name}</td>
                    <td className="p-3 text-center font-bold">{s.totalDays} يوم</td>
                    <td className="p-3 font-semibold text-blue-700">{formatCurrency(s.totalWages)}</td>
                    <td className="p-3 text-green-600">{s.totalBonuses > 0 ? `+${formatCurrency(s.totalBonuses)}` : "—"}</td>
                    <td className="p-3 text-amber-700">{s.totalDiscounts > 0 ? `-${formatCurrency(s.totalDiscounts)}` : "—"}</td>
                    <td className="p-3 text-red-600 font-semibold">{s.totalAdvances > 0 ? `-${formatCurrency(s.totalAdvances)}` : "—"}</td>
                    <td className={`p-3 font-extrabold text-base ${s.netPayable >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {formatCurrency(s.netPayable)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* الأرشيف التاريخي للتقفيلات الأسبوعية السابقة */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <h3 className="font-bold text-lg text-brand-black flex items-center gap-2">
            📂 أرشيف التقفيلات الأسبوعية السابقة
          </h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportToExcel(pastSettlements as any, "worker-weekly-settlements")}
            disabled={pastSettlements.length === 0}
          >
            📥 تصدير الأرشيف
          </Button>
        </div>

        {pastSettlements.length === 0 ? (
          <div className="text-center text-gray-400 py-6">مفيش تقفيلات أسبوعية سابقة مؤرشفة حتى الآن.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-right">تاريخ التقفيل</th>
                  <th className="p-3 text-right">الفترة</th>
                  <th className="p-3 text-right">العامل</th>
                  <th className="p-3 text-center">أيام العمل</th>
                  <th className="p-3 text-right">اليوميات</th>
                  <th className="p-3 text-right">السلف</th>
                  <th className="p-3 text-right font-bold">الصافي المدفوع</th>
                  <th className="p-3 text-right">ملاحظة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pastSettlements.map((st) => (
                  <tr key={st.id} className="hover:bg-gray-50">
                    <td className="p-3">{formatDate(st.settled_at)}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {formatDate(st.period_start)} إلى {formatDate(st.period_end)}
                    </td>
                    <td className="p-3 font-bold text-brand-orange">{st.worker?.name}</td>
                    <td className="p-3 text-center">{st.total_days} يوم</td>
                    <td className="p-3">{formatCurrency(st.total_wages)}</td>
                    <td className="p-3 text-red-600">{formatCurrency(st.total_advances)}</td>
                    <td className="p-3 font-bold text-green-700">{formatCurrency(st.net_payable)}</td>
                    <td className="p-3 text-gray-500 text-xs">{st.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal التأكيد على التقفيل الأسبوعي */}
      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => !settling && setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg text-brand-black border-b pb-2">
              🔒 تأكيد التقفيل الأسبوعي للعمال
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              سيتم إغلاق حسابات الفترة من <strong className="text-brand-orange">{formatDate(periodStart)}</strong> إلى{" "}
              <strong className="text-brand-orange">{formatDate(periodEnd)}</strong>، وإصدار قيود صرف صافي المستحقات وقدرها{" "}
              <strong className="text-green-600 text-base">{formatCurrency(grandNetPayable)}</strong>.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">ملاحظة التقفيل</label>
              <input
                type="text"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                placeholder="ملاحظات ختام الأسبوع..."
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={settling}>
                إلغاء
              </Button>
              <Button onClick={handleSettleWeek} loading={settling} className="bg-brand-black text-white">
                تأكيد التقفيل والصرف ✓
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

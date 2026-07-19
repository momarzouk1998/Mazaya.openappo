"use client";
import { useState } from "react";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { canSeeModule } from "@/lib/auth";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { formatCurrency, formatDate, ENTRY_TYPE_LABELS, ENTRY_TYPE_COLORS, PAYMENT_METHOD_LABELS } from "@/lib/format";

interface DayEntry {
  id: string;
  date: string | Date;
  entry_type: string;
  description: string;
  amount: number;
  payment_method: string | null;
  party_name: string | null;
  is_pass_through?: boolean;
}
interface DayData {
  date: string;
  opening: number;
  income: number;     // تمريري صادر للمورد (وارد ألواح)
  expense: number;    // مشتريات ألواح
  closing: number;
  count: number;
  entries: DayEntry[];
}
interface WalletResponse {
  today: DayData;
  days: DayData[];
  current_balance: number;
  window: { from: string; to: string };
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const EMPTY_TODAY: DayData = {
  date: new Date().toISOString().slice(0, 10),
  opening: 0, income: 0, expense: 0, closing: 0, count: 0, entries: [],
};

function DayRow({ day, isOpen, onToggle }: { day: DayData; isOpen: boolean; onToggle: () => void }) {
  const dName = DAY_NAMES[new Date(day.date + "T00:00:00").getDay()];
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-orange-50 transition">
        <td className="p-3 font-semibold">
          {dName} {formatDate(day.date)}
          <span className="block text-xs text-gray-400">{day.count} حركة ▾</span>
        </td>
        <td className={`p-3 ${day.opening < 0 ? "text-red-600" : "text-gray-700"}`}>{formatCurrency(day.opening)}</td>
        <td className="p-3 text-green-600 font-bold">+{formatCurrency(day.income)}</td>
        <td className="p-3 text-red-600 font-bold">-{formatCurrency(day.expense)}</td>
        <td className={`p-3 font-extrabold ${day.closing < 0 ? "text-red-700" : "text-brand-orange-dark"}`}>
          {formatCurrency(day.closing)}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-orange-50/50">
          <td colSpan={5} className="p-3">
            <table className="w-full text-xs bg-white rounded-lg border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">البيان</th>
                  <th className="p-2 text-right">المورد/الجهة</th>
                  <th className="p-2 text-right">الطريقة</th>
                  <th className="p-2 text-right">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {day.entries.map((e) => {
                  const isIncome = e.entry_type === "دفعة صادرة لمورد" && e.is_pass_through;
                  return (
                    <tr key={e.id}>
                      <td className="p-2">
                        <span className={`badge ${isIncome ? "bg-green-100 text-green-700 border-green-300" : (ENTRY_TYPE_COLORS[e.entry_type] || "")}`}>
                          {isIncome ? "وارد (تمريري)" : (ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type)}
                        </span>
                      </td>
                      <td className="p-2">{e.description}</td>
                      <td className="p-2 text-gray-500">{e.party_name || "-"}</td>
                      <td className="p-2">{PAYMENT_METHOD_LABELS[e.payment_method] || "-"}</td>
                      <td className={`p-2 font-bold ${isIncome ? "text-green-600" : "text-red-600"}`}>
                        {isIncome ? "+" : "-"}{formatCurrency(e.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export default function BoardsWalletPage() {
  const { user: profile } = useUserStore();
  const [range, setRange] = useState<7 | 30>(7);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openDate, setOpenDate] = useState<string | null>(null);
  const useCustom = Boolean(fromDate && toDate);
  const query = useCustom
    ? `/api/boards-wallet?date_from=${fromDate}&date_to=${toDate}`
    : `/api/boards-wallet?days=${range}`;
  const { data, loading } = useApi<WalletResponse>(query);

  if (!profile) return null;
  const canSee = canSeeModule(profile, "boards_wallet");
  const today = data?.today ?? EMPTY_TODAY;
  const days = data?.days ?? [];

  if (!canSee) {
    return (
      <DashboardLayout profile={profile}>
        <div className="card text-center text-gray-500 py-12">🔒 هذه الصفحة للمصنع فقط.</div>
      </DashboardLayout>
    );
  }

  const isNeg = (n: number) => n < 0;
  const d = new Date(today.date + "T00:00:00");
  const dayName = isNaN(d.getTime()) ? "" : DAY_NAMES[d.getDay()];

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="يومية الألواح"
        subtitle="الألواح فقط — الوارد (تمريري من المعرض) والمشتريات"
        helpTitle="يومية الألواح"
        helpDescription="وارد = أي تحويل تمريري (المعرض دفع للمورد علشان ألواح بتدخل المخزن). مصروف = شراء ألواح عادي. الإكسسوارات مش هنا (دي في يومية المصنع)."
        actions={<PWAInstallButton />}
      />

      {/* فلتر المدى */}
      <div className="card mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm font-bold text-gray-600">المدى:</div>
        <Button variant={range === 7 && !useCustom ? "primary" : "secondary"} size="sm" onClick={() => { setRange(7); setFromDate(""); setToDate(""); }}>آخر 7 أيام</Button>
        <Button variant={range === 30 && !useCustom ? "primary" : "secondary"} size="sm" onClick={() => { setRange(30); setFromDate(""); setToDate(""); }}>آخر 30 يوم</Button>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-2 py-1 border rounded text-sm" />
          <span className="text-gray-400">→</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-2 py-1 border rounded text-sm" />
        </div>
        <div className="mr-auto">
          <Button variant="secondary" size="sm" onClick={() => exportToExcel(days as any, "boards-wallet")} disabled={days.length === 0}>📥 تصدير</Button>
        </div>
      </div>

      {/* كروت اليوم الحالي */}
      <div className="mb-6">
        <div className="text-sm font-bold text-gray-700 mb-2">📅 {dayName} {formatDate(today.date)} (اليوم الحالي)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card bg-white border-r-4 border-gray-300">
            <div className="text-xs text-gray-500 font-bold">بداية اليوم</div>
            <div className={`text-2xl font-extrabold mb-1 ${isNeg(today.opening) ? "text-red-600" : "text-gray-800"}`}>{formatCurrency(today.opening)}</div>
            <div className="text-xs text-gray-400">رصيد آخر يوم قبله</div>
          </div>
          <div className="card bg-white border-r-4 border-green-400">
            <div className="text-xs text-gray-500 font-bold">وارد (اليوم)</div>
            <div className="text-2xl font-extrabold mb-1 text-green-600">+{formatCurrency(today.income)}</div>
            <div className="text-xs text-green-500/70">تمريري من المعرض</div>
          </div>
          <div className="card bg-white border-r-4 border-red-400">
            <div className="text-xs text-gray-500 font-bold">مشتريات (اليوم)</div>
            <div className="text-2xl font-extrabold mb-1 text-red-600">-{formatCurrency(today.expense)}</div>
            <div className="text-xs text-red-400">شراء ألواح</div>
          </div>
          <div className={`card bg-gradient-to-br ${isNeg(today.closing) ? "from-red-500 to-red-700" : "from-brand-orange to-brand-orange-dark"} text-white`}>
            <div className="text-xs opacity-90 font-bold">رصيد النهاية (الحالي)</div>
            <div className="text-2xl font-extrabold mb-1">{formatCurrency(today.closing)}</div>
            <div className="text-xs opacity-80">بداية + وارد − مشتريات</div>
          </div>
        </div>
      </div>

      {/* الجدول اليومي */}
      <div className="text-sm font-bold text-gray-700 mb-2">📋 حركات الأيام</div>
      {loading ? (
        <div className="card text-center text-gray-400 py-12">جاري التحميل...</div>
      ) : days.length === 0 ? (
        <div className="card text-center text-gray-500 py-12">مفيش حركات ألواح في الفترة دي.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 text-right">التاريخ</th>
                <th className="p-3 text-right">بداية اليوم</th>
                <th className="p-3 text-right text-green-700">وارد</th>
                <th className="p-3 text-right text-red-700">مشتريات</th>
                <th className="p-3 text-right">رصيد النهاية</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {days.map((d) => (
                <DayRow
                  key={d.date}
                  day={d}
                  isOpen={openDate === d.date}
                  onToggle={() => setOpenDate(openDate === d.date ? null : d.date)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

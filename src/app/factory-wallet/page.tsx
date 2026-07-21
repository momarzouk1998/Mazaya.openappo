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
import { WalletCards } from "./_wallet-cards";
import { WalletTable } from "./_wallet-table";
import DateInput from "@/components/ui/DateInput";

interface DayData {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
  entries: any[];
}
interface WalletTotals {
  total_income: number;
  total_expense: number;
  total_payout: number;
  current_balance: number;
}
interface WalletResponse {
  today: DayData;
  days: DayData[];
  current_balance: number;
  totals: WalletTotals;
  window: { from: string; to: string };
}

const EMPTY_TODAY: DayData = {
  date: new Date().toISOString().slice(0, 10),
  opening: 0, income: 0, expense: 0, payout: 0, closing: 0, count: 0, entries: [],
};

export default function FactoryWalletPage() {
  const { user: profile } = useUserStore();
  const [range, setRange] = useState<7 | 30>(7);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const useCustom = Boolean(fromDate && toDate);
  const query = useCustom
    ? `/api/factory-wallet?date_from=${fromDate}&date_to=${toDate}`
    : `/api/factory-wallet?days=${range}`;
  const { data, loading } = useApi<WalletResponse>(query);

  if (!profile) return null;
  const canSee = canSeeModule(profile, "factory_wallet");

  const today = data?.today ?? EMPTY_TODAY;
  const days = data?.days ?? [];
  const totals = data?.totals ?? { total_income: 0, total_expense: 0, total_payout: 0, current_balance: 0 };

  if (!canSee) {
    return (
      <DashboardLayout profile={profile}>
        <div className="card text-center text-gray-500 py-12">🔒 هذه الصفحة للمصنع فقط.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="يومية المصنع"
        subtitle="الرصيد التراكمي اليومي — وارد من المعارض − مصروف"
        helpTitle="يومية المصنع"
        helpDescription="الكروت فوق بتعكس اليوم الحالي. الجدول تحته فيه كل الأيام (اضغط أي يوم يشوف تفاصيله). التحويل التمريري مش بيدخل هنا لأنه معدّش على المحفظة. مشتريات الألواح والإكسسوارات مش بتحسب هنا (دي في يومية الألواح)."
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
          <Button variant="secondary" size="sm" onClick={() => exportToExcel(days as any, "factory-wallet")} disabled={days.length === 0}>📥 تصدير</Button>
        </div>
      </div>

      {/* الكروت الأربعة — إجمالي تراكمي كامل */}
      <WalletCards totals={totals} />

      {/* الجدول اليومي المفصّل */}
      <div className="text-sm font-bold text-gray-700 mb-2">📋 حركات الأيام</div>
      {loading ? (
        <div className="card text-center text-gray-400 py-12">جاري التحميل...</div>
      ) : (
        <WalletTable days={days} />
      )}
    </DashboardLayout>
  );
}

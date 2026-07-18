"use client";
import { formatCurrency, formatDate } from "@/lib/format";

interface TodayData {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function WalletCards({ today }: { today: TodayData }) {
  const isNeg = (n: number) => n < 0;
  const d = new Date(today.date + "T00:00:00");
  const dayName = isNaN(d.getTime()) ? "" : DAY_NAMES[d.getDay()];

  return (
    <div className="mb-6">
      <div className="text-sm font-bold text-gray-700 mb-2">
        📅 {dayName} {formatDate(today.date)} (اليوم الحالي)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* بداية اليوم */}
        <div className="card bg-white border-r-4 border-gray-300">
          <div className="text-xs text-gray-500 font-bold">بداية اليوم</div>
          <div className={`text-2xl font-extrabold mb-1 ${isNeg(today.opening) ? "text-red-600" : "text-gray-800"}`}>
            {formatCurrency(today.opening)}
          </div>
          <div className="text-xs text-gray-400">رصيد آخر يوم قبله</div>
        </div>
        {/* وارد */}
        <div className="card bg-white border-r-4 border-green-400">
          <div className="text-xs text-gray-500 font-bold">وارد (اليوم)</div>
          <div className="text-2xl font-extrabold mb-1 text-green-600">
            +{formatCurrency(today.income)}
          </div>
          <div className="text-xs text-green-500/70">تحويلات المعارض</div>
        </div>
        {/* مصروف */}
        <div className="card bg-white border-r-4 border-red-400">
          <div className="text-xs text-gray-500 font-bold">مصروف (اليوم)</div>
          <div className="text-2xl font-extrabold mb-1 text-red-600">
            -{formatCurrency(today.expense)}
          </div>
          {today.payout > 0 && (
            <div className="text-xs text-red-400">منها {formatCurrency(today.payout)} للموردين</div>
          )}
        </div>
        {/* رصيد النهاية = الرصيد الحالي */}
        <div className={`card bg-gradient-to-br ${isNeg(today.closing) ? "from-red-500 to-red-700" : "from-brand-orange to-brand-orange-dark"} text-white`}>
          <div className="text-xs opacity-90 font-bold">رصيد النهاية (الحالي)</div>
          <div className="text-2xl font-extrabold mb-1">{formatCurrency(today.closing)}</div>
          <div className="text-xs opacity-80">بداية + وارد − مصروف</div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { formatCurrency } from "@/lib/format";

interface WalletTotals {
  total_income: number;
  total_expense: number;
  total_payout: number;
  current_balance: number;
}

export function WalletCards({ totals }: { totals: WalletTotals }) {
  const isNeg = (n: number) => n < 0;

  return (
    <div className="mb-6">
      <div className="text-sm font-bold text-gray-700 mb-2">📊 الإجمالي التراكمي الكامل (من أول يوم)</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* إجمالي الوارد */}
        <div className="card bg-white border-r-4 border-green-400">
          <div className="text-xs text-gray-500 font-bold">إجمالي الوارد</div>
          <div className="text-2xl font-extrabold mb-1 text-green-600">
            +{formatCurrency(totals.total_income)}
          </div>
          <div className="text-xs text-green-500/70">كل التحويلات من المعارض</div>
        </div>

        {/* إجمالي المصروف */}
        <div className="card bg-white border-r-4 border-red-400">
          <div className="text-xs text-gray-500 font-bold">إجمالي المصروف</div>
          <div className="text-2xl font-extrabold mb-1 text-red-600">
            -{formatCurrency(totals.total_expense)}
          </div>
          <div className="text-xs text-red-400">نثريات + أجور + إكسسوارات</div>
        </div>

        {/* إجمالي الدفعات للموردين */}
        <div className="card bg-white border-r-4 border-orange-400">
          <div className="text-xs text-gray-500 font-bold">دفعات للموردين</div>
          <div className="text-2xl font-extrabold mb-1 text-orange-600">
            -{formatCurrency(totals.total_payout)}
          </div>
          <div className="text-xs text-orange-400">كل الدفعات الصادرة</div>
        </div>

        {/* الرصيد الحالي */}
        <div className={`card bg-gradient-to-br ${isNeg(totals.current_balance) ? "from-red-500 to-red-700" : "from-brand-orange to-brand-orange-dark"} text-white`}>
          <div className="text-xs opacity-90 font-bold">الرصيد الحالي</div>
          <div className="text-2xl font-extrabold mb-1">{formatCurrency(totals.current_balance)}</div>
          <div className="text-xs opacity-80">وارد − مصروف − دفعات (كامل)</div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { formatCurrency, formatDate, ENTRY_TYPE_LABELS, ENTRY_TYPE_COLORS, PAYMENT_METHOD_LABELS } from "@/lib/format";

interface DayEntry {
  id: string;
  date: string | Date;
  entry_type: string;
  description: string;
  amount: number;
  payment_method: string | null;
  party_name: string | null;
}

interface DayData {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
  entries: DayEntry[];
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

import Link from "next/link";
import { useRouter } from "next/navigation";

// مكوّن منفصل لكل صف + تفاصيله الموسعة وزر التقرير
function DayRow({
  day,
  isOpen,
  onToggle,
}: {
  day: DayData;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const dName = DAY_NAMES[new Date(day.date + "T00:00:00").getDay()];

  return (
    <>
      <tr className="hover:bg-orange-50/60 transition group">
        <td className="p-3 font-semibold">
          <Link
            href={`/factory-wallet/${day.date}`}
            className="text-brand-black hover:text-brand-orange font-bold text-sm flex items-center gap-1.5 transition"
          >
            <span>📅</span>
            <span>{dName} {formatDate(day.date)}</span>
          </Link>
        </td>
        <td className={`p-3 text-center ${day.opening < 0 ? "text-red-600 font-bold" : "text-gray-700 font-medium"}`}>
          {formatCurrency(day.opening)}
        </td>
        <td className="p-3 text-center text-green-700 font-extrabold font-mono">
          +{formatCurrency(day.income)}
        </td>
        <td className="p-3 text-center text-red-600 font-extrabold font-mono">
          -{formatCurrency(day.expense)}
        </td>
        <td className={`p-3 text-center font-extrabold font-mono ${day.closing < 0 ? "text-red-700" : "text-brand-orange-dark"}`}>
          {formatCurrency(day.closing)}
        </td>
        <td className="p-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Link
              href={`/factory-wallet/${day.date}`}
              className="px-2.5 py-1 bg-brand-orange/10 hover:bg-brand-orange text-brand-orange-dark hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
              title="فتح تقرير اليوم الكامل مع الطباعة والـ PDF"
            >
              <span>📄</span>
              <span>التقرير</span>
            </Link>
            <button
              onClick={onToggle}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
              title={isOpen ? "إخفاء التفاصيل السريعة" : "عرض سريع"}
            >
              {isOpen ? "▲" : "▼"}
            </button>
          </div>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-orange-50/40">
          <td colSpan={6} className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-700">معاينة سريعة لحركات {dName} {formatDate(day.date)}:</span>
              <Link
                href={`/factory-wallet/${day.date}`}
                className="text-xs font-bold text-brand-orange hover:underline flex items-center gap-1"
              >
                <span>فتح تقرير اليوم الكامل والطباعة والـ PDF ←</span>
              </Link>
            </div>
            <table className="w-full text-xs bg-white rounded-lg border">
              <thead className="bg-gray-100/80">
                <tr>
                  <th className="p-2 text-center">النوع</th>
                  <th className="p-2 text-start">البيان</th>
                  <th className="p-2 text-center">الجهة</th>
                  <th className="p-2 text-center">طريقة الدفع</th>
                  <th className="p-2 text-center">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {day.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="p-2 text-center">
                      <span className={`badge ${ENTRY_TYPE_COLORS[e.entry_type] || ""}`}>
                        {ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}
                      </span>
                    </td>
                    <td className="p-2 font-semibold text-gray-800">{e.description}</td>
                    <td className="p-2 text-center text-gray-500">{e.party_name || "—"}</td>
                    <td className="p-2 text-center">{PAYMENT_METHOD_LABELS[e.payment_method || "نقدي"] || e.payment_method || "نقدي"}</td>
                    <td className={`p-2 text-center font-extrabold font-mono ${e.entry_type === "دفعة واردة من معرض" ? "text-green-600" : "text-red-600"}`}>
                      {e.entry_type === "دفعة واردة من معرض" ? `+${formatCurrency(e.amount)}` : `-${formatCurrency(e.amount)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export function WalletTable({ days }: { days: DayData[] }) {
  const [openDate, setOpenDate] = useState<string | null>(null);

  if (days.length === 0) {
    return (
      <div className="card text-center text-gray-500 py-12">
        مفيش حركات في الفترة دي. ابدأ بتسجيل دفعة من المعرض من صفحة اليومية.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0 border border-gray-200 shadow-sm rounded-xl bg-white mb-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-100/80 text-gray-800 border-b border-gray-200">
            <tr>
              <th className="p-3 text-start font-bold text-gray-700">التاريخ</th>
              <th className="p-3 text-center font-bold text-gray-700">رصيد أول اليوم</th>
              <th className="p-3 text-center font-bold text-emerald-800">الوارد (+)</th>
              <th className="p-3 text-center font-bold text-rose-800">المصروف (-)</th>
              <th className="p-3 text-center font-bold text-brand-orange-dark">رصيد الإغلاق</th>
              <th className="p-3 text-center font-bold text-gray-500 w-32">كشف الحساب</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
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
    </div>
  );
}

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

// مكوّن منفصل لكل صف + تفاصيله الموسعة (يحل مشكلة Fragment+key جوّا map)
function DayRow({
  day,
  isOpen,
  onToggle,
}: {
  day: DayData;
  isOpen: boolean;
  onToggle: () => void;
}) {
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
                  <th className="p-2 text-right">الجهة</th>
                  <th className="p-2 text-right">الطريقة</th>
                  <th className="p-2 text-right">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {day.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="p-2"><span className={`badge ${ENTRY_TYPE_COLORS[e.entry_type] || ""}`}>{ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}</span></td>
                    <td className="p-2">{e.description}</td>
                    <td className="p-2 text-gray-500">{e.party_name || "-"}</td>
                    <td className="p-2">{PAYMENT_METHOD_LABELS[e.payment_method] || "-"}</td>
                    <td className={`p-2 font-bold ${e.entry_type === "دفعة واردة من معرض" ? "text-green-600" : "text-red-600"}`}>{formatCurrency(e.amount)}</td>
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
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="p-3 text-right">التاريخ</th>
            <th className="p-3 text-right">بداية اليوم</th>
            <th className="p-3 text-right text-green-700">وارد</th>
            <th className="p-3 text-right text-red-700">مصروف</th>
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
  );
}

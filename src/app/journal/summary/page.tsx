'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { JournalEntry } from '@/types';

const dayNames: Record<number, string> = {
  6: 'السبت',
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
};

const dayOrder = [6, 0, 1, 2, 3, 4, 5]; // Sat first

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToSat = day === 6 ? 0 : -(day + 1);
  const sat = new Date(now);
  sat.setDate(now.getDate() + diffToSat);
  const fri = new Date(sat);
  fri.setDate(sat.getDate() + 6);
  return {
    start: sat.toISOString().split('T')[0],
    end: fri.toISOString().split('T')[0],
  };
}

const formatCurrency = (val: number) => `${val.toLocaleString('ar-EG')} ج.م`;
const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-EG');

export default function JournalSummaryPage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const weekRange = useMemo(() => getWeekRange(), []);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('journal_entries')
          .select('*')
          .gte('date', weekRange.start)
          .lte('date', weekRange.end)
          .order('date', { ascending: true });
        setEntries((data as JournalEntry[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase, weekRange]);

  const days = useMemo(() => {
    const map: Record<string, JournalEntry[]> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekRange.start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      map[key] = [];
    }
    entries.forEach((e) => {
      if (map[e.date]) map[e.date].push(e);
    });
    return map;
  }, [entries, weekRange]);

  const weekTotals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    entries.forEach((e) => {
      if (e.entry_type === 'دفعة واردة من معرض') {
        totalIn += e.amount;
      } else {
        totalOut += e.amount;
      }
    });
    return { totalIn, totalOut, remaining: totalIn - totalOut };
  }, [entries]);

  const dayTotals = useMemo(() => {
    const result: Record<string, { dayIn: number; dayOut: number }> = {};
    Object.entries(days).forEach(([date, dayEntries]) => {
      let dayIn = 0;
      let dayOut = 0;
      dayEntries.forEach((e) => {
        if (e.entry_type === 'دفعة واردة من معرض') {
          dayIn += e.amount;
        } else {
          dayOut += e.amount;
        }
      });
      result[date] = { dayIn, dayOut };
    });
    return result;
  }, [days]);

  const sortedDates = useMemo(() => {
    const dates = Object.keys(days).sort();
    const satIndex = dates.findIndex(
      (d) => new Date(d).getDay() === 6
    );
    if (satIndex === -1) return dates;
    return [...dates.slice(satIndex), ...dates.slice(0, satIndex)];
  }, [days]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Link href="/journal" className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
            ← اليومية المالية
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">الملخص الأسبوعي</h1>
          <p className="text-sm text-gray-500 mt-1">
            من {formatDate(weekRange.start)} إلى {formatDate(weekRange.end)}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs text-gray-500 mb-1">الرصيد (الوارد)</p>
                <p className="text-2xl font-bold text-green-700">{formatCurrency(weekTotals.totalIn)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs text-gray-500 mb-1">المصروف</p>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(weekTotals.totalOut)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs text-gray-500 mb-1">الباقي</p>
                <p className={`text-2xl font-bold ${weekTotals.remaining >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                  {formatCurrency(weekTotals.remaining)}
                </p>
              </div>
            </div>

            {/* Weekly Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">اليوم</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">الوارد</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">المصروف</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedDates.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                          لا توجد حركات مالية هذا الأسبوع
                        </td>
                      </tr>
                    ) : (
                      sortedDates.map((date) => {
                        const dt = new Date(date);
                        const dayName = dayNames[dt.getDay()] || '';
                        const totals = dayTotals[date] || { dayIn: 0, dayOut: 0 };
                        const dayTotal = totals.dayIn - totals.dayOut;
                        return (
                          <tr key={date} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-gray-900 font-medium">
                              {dayName} — {formatDate(date)}
                            </td>
                            <td className="px-4 py-3 text-green-700 font-medium">
                              {totals.dayIn > 0 ? formatCurrency(totals.dayIn) : '-'}
                            </td>
                            <td className="px-4 py-3 text-red-700 font-medium">
                              {totals.dayOut > 0 ? formatCurrency(totals.dayOut) : '-'}
                            </td>
                            <td className={`px-4 py-3 font-medium ${dayTotal >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                              {formatCurrency(dayTotal)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 border-t-2 border-gray-200">
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-900">الإجمالي</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-green-700">{formatCurrency(weekTotals.totalIn)}</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-red-700">{formatCurrency(weekTotals.totalOut)}</td>
                      <td className={`px-4 py-3.5 text-sm font-bold ${weekTotals.remaining >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                        {formatCurrency(weekTotals.remaining)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

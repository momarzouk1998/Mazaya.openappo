'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DataTable from '@/components/ui/DataTable';
import type { OverheadExpense } from '@/types';

const formatCurrency = (val: number) => `${val.toLocaleString('ar-EG')} ج.م`;
const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-EG');

export default function OverheadPage() {
  const router = useRouter();
  const supabase = createClient();
  const [expenses, setExpenses] = useState<OverheadExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('overhead_expenses')
          .select('*')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });
        setExpenses((data as OverheadExpense[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    let result = expenses;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.description.toLowerCase().includes(q));
    }
    if (dateFrom) result = result.filter((e) => e.date >= dateFrom);
    if (dateTo) result = result.filter((e) => e.date <= dateTo);
    return result;
  }, [expenses, searchQuery, dateFrom, dateTo]);

  const totalAmount = useMemo(
    () => filtered.reduce((sum, e) => sum + e.amount, 0),
    [filtered]
  );

  const columns = [
    {
      key: 'date',
      label: 'التاريخ',
      render: (item: OverheadExpense) => formatDate(item.date),
    },
    { key: 'description', label: 'البيان' },
    {
      key: 'amount',
      label: 'المبلغ',
      render: (item: OverheadExpense) => (
        <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
      ),
    },
    { key: 'notes', label: 'ملاحظات' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">النثريات</h1>
            <p className="text-sm text-gray-500 mt-1">تسجيل ومتابعة المصروفات النثرية</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          excelFileName="النثريات"
          filters={
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                placeholder="من تاريخ"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                placeholder="إلى تاريخ"
              />
            </div>
          }
          actions={
            <Link
              href="/overhead/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ➕ نثريات جديدة
            </Link>
          }
        />

        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
            <p className="text-sm text-gray-600">إجمالي النثريات المعروضة</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

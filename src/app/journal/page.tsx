'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DataTable from '@/components/ui/DataTable';
import type { JournalEntry, Supplier, Branch, Order } from '@/types';

const entryTypeColors: Record<string, string> = {
  مشتريات: 'bg-red-100 text-red-800',
  'دفعة واردة من معرض': 'bg-green-100 text-green-800',
  'دفعة صادرة لمورد': 'bg-yellow-100 text-yellow-800',
  'تحويل تمريري': 'bg-blue-100 text-blue-800',
  نثريات: 'bg-gray-100 text-gray-800',
};

const formatCurrency = (val: number) => `${val.toLocaleString('ar-EG')} ج.م`;
const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-EG');

export default function JournalPage() {
  const router = useRouter();
  const supabase = createClient();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEntryType, setFilterEntryType] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('journal_entries')
          .select('*')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });
        setEntries((data as JournalEntry[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    let result = entries;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.description.toLowerCase().includes(q));
    }
    if (filterEntryType) result = result.filter((e) => e.entry_type === filterEntryType);
    if (filterPaymentMethod) result = result.filter((e) => e.payment_method === filterPaymentMethod);
    if (dateFrom) result = result.filter((e) => e.date >= dateFrom);
    if (dateTo) result = result.filter((e) => e.date <= dateTo);
    return result;
  }, [entries, searchQuery, filterEntryType, filterPaymentMethod, dateFrom, dateTo]);

  const columns = [
    {
      key: 'date',
      label: 'التاريخ',
      render: (item: JournalEntry) => formatDate(item.date),
    },
    { key: 'description', label: 'البيان' },
    {
      key: 'entry_type',
      label: 'نوع الحركة',
      render: (item: JournalEntry) => (
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${entryTypeColors[item.entry_type] || 'bg-gray-100 text-gray-800'}`}>
          {item.entry_type}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'المبلغ',
      render: (item: JournalEntry) => (
        <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
      ),
    },
    { key: 'payment_method', label: 'طريقة الدفع' },
    { key: 'party_id', label: 'الجهة', render: () => '—' },
    { key: 'order_id', label: 'الأوردر', render: () => '—' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">اليومية المالية</h1>
            <p className="text-sm text-gray-500 mt-1">تسجيل ومتابعة جميع الحركات المالية</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          excelFileName="اليومية_المالية"
          filters={
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={filterEntryType}
                onChange={(e) => setFilterEntryType(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
              >
                <option value="">كل أنواع الحركة</option>
                <option value="مشتريات">مشتريات</option>
                <option value="دفعة واردة من معرض">دفعة واردة من معرض</option>
                <option value="دفعة صادرة لمورد">دفعة صادرة لمورد</option>
                <option value="تحويل تمريري">تحويل تمريري</option>
                <option value="نثريات">نثريات</option>
              </select>
              <select
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
              >
                <option value="">كل طرق الدفع</option>
                <option value="نقدي">نقدي</option>
                <option value="تحويل">تحويل</option>
              </select>
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
            <div className="flex gap-2">
              <Link
                href="/journal/summary"
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                📊 الملخص الأسبوعي
              </Link>
              <Link
                href="/journal/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                ➕ حركة جديدة
              </Link>
            </div>
          }
          onRowClick={(item) => router.push(`/journal/${item.id}`)}
        />
      </div>
    </DashboardLayout>
  );
}

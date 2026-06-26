'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DataTable from '@/components/ui/DataTable';
import type { Contractor } from '@/types';

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('contractors')
          .select('*')
          .order('created_at', { ascending: false });
        setContractors((data as Contractor[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    let result = contractors;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (filterType) {
      result = result.filter((c) => c.type === filterType);
    }
    return result;
  }, [contractors, searchQuery, filterType]);

  const columns = [
    { key: 'name', label: 'الاسم' },
    { key: 'type', label: 'النوع' },
    { key: 'phone', label: 'الهاتف' },
    { key: 'created_at', label: 'تاريخ الإضافة',
      render: (item: any) => new Date(item.created_at).toLocaleDateString('ar-EG')
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">المقاولين</h1>
            <p className="text-sm text-gray-500 mt-1">إدارة مقاولي الألوميتال والتنجيد</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          excelFileName="المقاولين"
          filters={
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
            >
              <option value="">كل الأنواع</option>
              <option value="ألوميتال">ألوميتال</option>
              <option value="تنجيد">تنجيد</option>
              <option value="أخرى">أخرى</option>
            </select>
          }
          actions={
            <Link
              href="/contractors/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ➕ إضافة مقاول
            </Link>
          }
          onRowClick={(item) => router.push(`/contractors/${item.id}`)}
        />
      </div>
    </DashboardLayout>
  );
}

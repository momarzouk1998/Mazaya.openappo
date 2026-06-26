'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DataTable from '@/components/ui/DataTable';
import type { Supplier } from '@/types';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<(Supplier & { codeCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('suppliers')
          .select('*')
          .order('created_at', { ascending: false });

        const enriched = await Promise.all(
          (data || []).map(async (s: Supplier) => {
            const { count: boardCount } = await supabase
              .from('boards_inventory')
              .select('*', { count: 'exact', head: true })
              .eq('supplier_id', s.id);
            const { count: accCount } = await supabase
              .from('accessories_inventory')
              .select('*', { count: 'exact', head: true })
              .eq('supplier_id', s.id);
            return { ...s, codeCount: (boardCount || 0) + (accCount || 0) };
          })
        );

        setSuppliers(enriched);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    let result = suppliers;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (filterType) {
      result = result.filter((s) => s.payment_type === filterType);
    }
    return result;
  }, [suppliers, searchQuery, filterType]);

  const columns = [
    { key: 'name', label: 'الاسم' },
    { key: 'payment_type', label: 'نوع التعامل' },
    { key: 'phone', label: 'الهاتف' },
    { key: 'codeCount', label: 'عدد الأكواد',
      render: (item: any) => String(item.codeCount ?? 0)
    },
    { key: 'created_at', label: 'تاريخ الإضافة',
      render: (item: any) => new Date(item.created_at).toLocaleDateString('ar-EG')
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الموردين</h1>
            <p className="text-sm text-gray-500 mt-1">إدارة الموردين والأكواد المرتبطة</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          excelFileName="الموردين"
          filters={
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
            >
              <option value="">كل الأنواع</option>
              <option value="نقدي">نقدي</option>
              <option value="تحويل">تحويل</option>
              <option value="كلاهما">كلاهما</option>
            </select>
          }
          actions={
            <Link
              href="/suppliers/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ➕ إضافة مورد
            </Link>
          }
          onRowClick={(item) => router.push(`/suppliers/${item.id}`)}
        />
      </div>
    </DashboardLayout>
  );
}

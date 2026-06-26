'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DataTable from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import type { Branch } from '@/types';

export default function BranchesPage() {
  const [branches, setBranches] = useState<
    (Branch & { customerCount?: number; orderCount?: number })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('branches')
          .select('*')
          .order('name');

        const enriched = await Promise.all(
          (data || []).map(async (b: Branch) => {
            const { count: customerCount } = await supabase
              .from('customers')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', b.id);
            const { count: orderCount } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', b.id);
            return { ...b, customerCount: customerCount || 0, orderCount: orderCount || 0 };
          })
        );

        setBranches(enriched);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    if (!searchQuery) return branches;
    const q = searchQuery.toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.location || '').toLowerCase().includes(q)
    );
  }, [branches, searchQuery]);

  const columns = [
    { key: 'name', label: 'الاسم' },
    { key: 'location', label: 'الموقع' },
    { key: 'phone', label: 'الهاتف' },
    { key: 'customerCount', label: 'العملاء',
      render: (item: any) => String(item.customerCount ?? 0)
    },
    { key: 'orderCount', label: 'الأوردرات',
      render: (item: any) => String(item.orderCount ?? 0)
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">المعارض</h1>
            <p className="text-sm text-gray-500 mt-1">إدارة المعارض والفروع</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          excelFileName="المعارض"
          actions={
            <Link
              href="/branches/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ➕ إضافة معرض
            </Link>
          }
          onRowClick={(item) => router.push(`/branches/${item.id}`)}
        />
      </div>
    </DashboardLayout>
  );
}

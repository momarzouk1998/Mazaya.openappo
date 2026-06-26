'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DataTable from '@/components/ui/DataTable';
import type { Customer, Branch } from '@/types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<
    (Customer & { branch_name?: string; orderCount?: number })[]
  >([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const [cRes, bRes] = await Promise.all([
          supabase.from('customers').select('*').order('created_at', { ascending: false }),
          supabase.from('branches').select('*').order('name'),
        ]);

        setBranches((bRes.data as Branch[]) || []);

        const enriched = await Promise.all(
          (cRes.data || []).map(async (c: Customer) => {
            const { count } = await supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .eq('customer_id', c.id);
            const branch = (bRes.data as Branch[] || []).find((b) => b.id === c.branch_id);
            return {
              ...c,
              branch_name: branch?.name || '-',
              orderCount: count || 0,
            };
          })
        );

        setCustomers(enriched);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    let result = customers;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone || '').includes(q)
      );
    }
    if (filterBranch) {
      result = result.filter((c) => c.branch_id === filterBranch);
    }
    return result;
  }, [customers, searchQuery, filterBranch]);

  const columns = [
    { key: 'name', label: 'الاسم' },
    { key: 'branch_name', label: 'المعرض' },
    { key: 'phone', label: 'الهاتف' },
    { key: 'address', label: 'العنوان' },
    { key: 'orderCount', label: 'الأوردرات',
      render: (item: any) => String(item.orderCount ?? 0)
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">العملاء</h1>
            <p className="text-sm text-gray-500 mt-1">إدارة العملاء والأوردرات المرتبطة</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          excelFileName="العملاء"
          filters={
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
            >
              <option value="">كل المعارض</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          }
          actions={
            <Link
              href="/customers/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ➕ إضافة عميل
            </Link>
          }
          onRowClick={(item) => router.push(`/customers/${item.id}`)}
        />
      </div>
    </DashboardLayout>
  );
}

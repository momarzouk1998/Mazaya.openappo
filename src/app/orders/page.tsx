'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DataTable from '@/components/ui/DataTable';
import type { Order, Customer, Branch } from '@/types';

interface OrderWithRelations extends Order {
  customer?: Customer;
  branch?: Branch;
}

export default function OrdersPage() {
  const router = useRouter();
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [oRes, bRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*, customer:customers(*), branch:branches(*)')
            .order('created_at', { ascending: false }),
          supabase.from('branches').select('*').order('name'),
        ]);
        setOrders((oRes.data as OrderWithRelations[]) || []);
        setBranches((bRes.data as Branch[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    let result = orders;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.order_name.toLowerCase().includes(q) ||
          (o.customer?.name || '').toLowerCase().includes(q)
      );
    }
    if (filterBranch) result = result.filter((o) => o.branch_id === filterBranch);
    if (filterStatus) result = result.filter((o) => o.status === filterStatus);
    if (filterType) result = result.filter((o) => o.order_type === filterType);
    if (dateFrom) result = result.filter((o) => o.start_date >= dateFrom);
    if (dateTo) result = result.filter((o) => (o.start_date || '') <= dateTo);
    return result;
  }, [orders, searchQuery, filterBranch, filterStatus, filterType, dateFrom, dateTo]);

  const formatCurrency = (val: number) => `${val.toLocaleString('ar-EG')} ج.م`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-EG');

  const statusColors: Record<string, string> = {
    مفتوح: 'bg-blue-100 text-blue-800',
    'قيد التنفيذ': 'bg-yellow-100 text-yellow-800',
    مكتمل: 'bg-green-100 text-green-800',
    'تم التسليم': 'bg-gray-100 text-gray-800',
  };

  const columns = [
    { key: 'order_name', label: 'اسم الأوردر' },
    {
      key: 'customer',
      label: 'العميل',
      render: (item: OrderWithRelations) => item.customer?.name || '-',
    },
    {
      key: 'branch',
      label: 'المعرض',
      render: (item: OrderWithRelations) => item.branch?.name || '-',
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (item: OrderWithRelations) => (
        <span
          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
            statusColors[item.status] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: 'start_date',
      label: 'تاريخ البدء',
      render: (item: OrderWithRelations) => formatDate(item.start_date),
    },
    {
      key: 'end_date',
      label: 'تاريخ الانتهاء',
      render: (item: OrderWithRelations) => (item.end_date ? formatDate(item.end_date) : '-'),
    },
    {
      key: 'order_total',
      label: 'الإجمالي',
      render: (item: OrderWithRelations) => formatCurrency(item.order_total),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">الأوردرات</h1>
            <p className="text-sm text-gray-500 mt-1">إدارة أوامر الشغل والتصنيع</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          excelFileName="الأوردرات"
          filters={
            <div className="flex flex-wrap gap-2 items-center">
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
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
              >
                <option value="">كل الحالات</option>
                <option value="مفتوح">مفتوح</option>
                <option value="قيد التنفيذ">قيد التنفيذ</option>
                <option value="مكتمل">مكتمل</option>
                <option value="تم التسليم">تم التسليم</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
              >
                <option value="">كل الأنواع</option>
                <option value="تصنيع جديد">تصنيع جديد</option>
                <option value="صيانة">صيانة</option>
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
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ➕ أوردر جديد
            </Link>
          }
          onRowClick={(item) => router.push(`/orders/${item.id}`)}
        />
      </div>
    </DashboardLayout>
  );
}

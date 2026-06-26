'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { JournalEntry } from '@/types';

const COLORS = ['#F2994A', '#1A1A1A', '#10B981', '#3B82F6', '#EF4444'];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [boardsValue, setBoardsValue] = useState(0);
  const [accessoriesValue, setAccessoriesValue] = useState(0);
  const [openOrders, setOpenOrders] = useState(0);
  const [closedThisMonth, setClosedThisMonth] = useState(0);
  const [recentJournal, setRecentJournal] = useState<JournalEntry[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [boardsRes, accessoriesRes, openCountRes, closedCountRes, journalRes, statusRes] =
          await Promise.all([
            supabase.from('boards_inventory').select('unit_price, quantity_remaining'),
            supabase.from('accessories_inventory').select('unit_price, quantity_remaining'),
            supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['مفتوح', 'قيد التنفيذ']),
            supabase
              .from('orders')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'تم التسليم')
              .gte('updated_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
            supabase
              .from('journal_entries')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(5),
            supabase
              .from('orders')
              .select('status'),
          ]);

        const bv = (boardsRes.data || []).reduce(
          (sum: number, item: { unit_price: number; quantity_remaining: number }) =>
            sum + (item.unit_price || 0) * (item.quantity_remaining || 0),
          0
        );
        const av = (accessoriesRes.data || []).reduce(
          (sum: number, item: { unit_price: number; quantity_remaining: number }) =>
            sum + (item.unit_price || 0) * (item.quantity_remaining || 0),
          0
        );

        setBoardsValue(bv);
        setAccessoriesValue(av);
        setOpenOrders(openCountRes.count || 0);
        setClosedThisMonth(closedCountRes.count || 0);
        setRecentJournal((journalRes.data as JournalEntry[]) || []);

        const statusMap: Record<string, number> = {};
        (statusRes.data || []).forEach((o: { status: string }) => {
          statusMap[o.status] = (statusMap[o.status] || 0) + 1;
        });
        setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [supabase]);

  const formatCurrency = (val: number) =>
    val.toLocaleString('ar-EG') + ' ج.م';

  const StatCard = ({
    title,
    value,
    subtitle,
    color,
    icon,
  }: {
    title: string;
    value: string;
    subtitle?: string;
    color: string;
    icon: string;
  }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold"
          style={{ backgroundColor: color }}
        >
          {value.replace(/[^0-9]/g, '').charAt(0) || '0'}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
            <p className="text-sm text-gray-500 mt-1">نظرة عامة على المصنع</p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="قيمة مخزون الألواح"
            value={formatCurrency(boardsValue)}
            color="#1A1A1A"
            icon="📋"
          />
          <StatCard
            title="قيمة مخزون الاكسسوارات"
            value={formatCurrency(accessoriesValue)}
            color="#F2994A"
            icon="🔩"
          />
          <StatCard
            title="الأوردرات المفتوحة"
            value={String(openOrders)}
            subtitle="مفتوح + قيد التنفيذ"
            color="#3B82F6"
            icon="📦"
          />
          <StatCard
            title="تم التسليم هذا الشهر"
            value={String(closedThisMonth)}
            color="#10B981"
            icon="✅"
          />
        </div>

        {/* Chart + Recent Journal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">حالة الأوردرات</h2>
            {statusData.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">لا توجد أوردرات</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={(props: any) =>
                      `${props.name} (${((props.percent ?? 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent Journal */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">آخر الحركات المالية</h2>
              <Link
                href="/journal"
                className="text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                عرض الكل ←
              </Link>
            </div>
            {recentJournal.length === 0 ? (
              <p className="text-gray-400 text-sm py-8 text-center">لا توجد حركات</p>
            ) : (
              <div className="space-y-3">
                {recentJournal.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {entry.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entry.entry_type} - {new Date(entry.date).toLocaleDateString('ar-EG')}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold whitespace-nowrap mr-3 ${
                        entry.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/orders/new"
            className="flex items-center justify-center gap-3 bg-white border-2 border-dashed border-gray-300 hover:border-orange-400 rounded-xl p-5 text-gray-700 hover:text-orange-700 hover:bg-orange-50/50 transition-all font-medium"
          >
            <span className="text-2xl">➕</span>
            <span>أوردر جديد</span>
          </Link>
          <Link
            href="/journal/new"
            className="flex items-center justify-center gap-3 bg-white border-2 border-dashed border-gray-300 hover:border-orange-400 rounded-xl p-5 text-gray-700 hover:text-orange-700 hover:bg-orange-50/50 transition-all font-medium"
          >
            <span className="text-2xl">💰</span>
            <span>حركة يومية جديدة</span>
          </Link>
          <Link
            href="/boards/new"
            className="flex items-center justify-center gap-3 bg-white border-2 border-dashed border-gray-300 hover:border-orange-400 rounded-xl p-5 text-gray-700 hover:text-orange-700 hover:bg-orange-50/50 transition-all font-medium"
          >
            <span className="text-2xl">🛒</span>
            <span>شراء جديد</span>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}

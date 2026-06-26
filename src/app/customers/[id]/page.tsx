'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { Customer, Branch, Order } from '@/types';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [customer, setCustomer] = useState<(Customer & { branch?: Branch }) | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [cRes, oRes] = await Promise.all([
          supabase.from('customers').select('*, branches(*)').eq('id', id).single(),
          supabase
            .from('orders')
            .select('*')
            .eq('customer_id', id)
            .order('created_at', { ascending: false }),
        ]);

        const cData = cRes.data as Customer & { branches?: Branch };
        setCustomer(cData ? { ...cData, branch: cData.branches } : null);
        setOrders((oRes.data as Order[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, supabase]);

  const formatCurrency = (val: number) => `${val.toLocaleString('ar-EG')} ج.م`;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">العميل غير موجود</p>
          <Link href="/customers" className="text-orange-600 hover:text-orange-700 mt-2 inline-block">
            ← العودة للعملاء
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const totalOrderValue = orders.reduce((s, o) => s + (o.order_total || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/customers" className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
              ← العملاء
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">المعرض</p>
            <p className="text-sm font-medium text-gray-900">
              {customer.branch?.name || 'بدون معرض'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">الهاتف</p>
            <p className="text-sm font-medium text-gray-900" dir="ltr">
              {customer.phone || '-'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">العنوان</p>
            <p className="text-sm font-medium text-gray-900">{customer.address || '-'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">إجمالي الأوردرات</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(totalOrderValue)}</p>
          </div>
        </div>

        {customer.notes && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">ملاحظات</p>
            <p className="text-sm text-gray-700">{customer.notes}</p>
          </div>
        )}

        {/* Orders */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">
              الأوردرات ({orders.length})
            </h2>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">لا توجد أوردرات لهذا العميل</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">اسم الأوردر</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الحالة</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">النوع</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">تاريخ البداية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/orders/${o.id}`)}
                      className="cursor-pointer hover:bg-orange-50/50 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-gray-900 font-medium">{o.order_name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          o.status === 'مفتوح' ? 'bg-blue-100 text-blue-700' :
                          o.status === 'قيد التنفيذ' ? 'bg-yellow-100 text-yellow-700' :
                          o.status === 'مكتمل' ? 'bg-gray-100 text-gray-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{o.order_type}</td>
                      <td className="px-3 py-2.5 text-gray-900 font-medium">
                        {formatCurrency(o.order_total || 0)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {new Date(o.start_date || o.created_at).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

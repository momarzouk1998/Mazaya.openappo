'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { Branch, Customer, Order, JournalEntry } from '@/types';

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [branch, setBranch] = useState<Branch | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [bRes, cRes, oRes, jRes] = await Promise.all([
          supabase.from('branches').select('*').eq('id', id).single(),
          supabase
            .from('customers')
            .select('*')
            .eq('branch_id', id)
            .order('name'),
          supabase
            .from('orders')
            .select('*')
            .eq('branch_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('journal_entries')
            .select('*')
            .eq('party_id', id)
            .eq('party_type', 'branch')
            .order('date', { ascending: false }),
        ]);

        setBranch(bRes.data as Branch);
        setCustomers((cRes.data as Customer[]) || []);
        setOrders((oRes.data as Order[]) || []);
        setPayments((jRes.data as JournalEntry[]) || []);
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

  if (!branch) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">المعرض غير موجود</p>
          <Link href="/branches" className="text-orange-600 hover:text-orange-700 mt-2 inline-block">
            ← العودة للمعارض
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const totalPayments = payments.reduce((s, e) => s + e.amount, 0);
  const openOrders = orders.filter((o) => o.status === 'مفتوح' || o.status === 'قيد التنفيذ').length;
  const completedOrders = orders.filter((o) => o.status === 'تم التسليم').length;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/branches" className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
              ← المعارض
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{branch.name}</h1>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">الموقع</p>
            <p className="text-sm font-medium text-gray-900">{branch.location || '-'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">الهاتف</p>
            <p className="text-sm font-medium text-gray-900" dir="ltr">{branch.phone || '-'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">العملاء</p>
            <p className="text-sm font-bold text-gray-900">{customers.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">إجمالي المدفوعات</p>
            <p className="text-sm font-bold text-green-700">{formatCurrency(totalPayments)}</p>
          </div>
        </div>

        {branch.notes && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">ملاحظات</p>
            <p className="text-sm text-gray-700">{branch.notes}</p>
          </div>
        )}

        {/* Orders Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            الأوردرات ({orders.length})
          </h2>
          <div className="flex gap-4 mb-4 text-sm">
            <span className="text-blue-600 font-medium">مفتوح: {openOrders}</span>
            <span className="text-green-600 font-medium">مكتمل: {completedOrders}</span>
          </div>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد أوردرات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الاسم</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الحالة</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">النوع</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/orders/${o.id}`)}
                      className="cursor-pointer hover:bg-orange-50/50 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-gray-900">{o.order_name}</td>
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
                        {new Date(o.created_at).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customers */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            العملاء ({customers.length})
          </h2>
          {customers.length === 0 ? (
            <p className="text-sm text-gray-400">لا يوجد عملاء</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الاسم</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الهاتف</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">العنوان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/customers/${c.id}`)}
                      className="cursor-pointer hover:bg-orange-50/50 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-gray-900">{c.name}</td>
                      <td className="px-3 py-2.5 text-gray-700" dir="ltr">{c.phone || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700">{c.address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payments */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            المدفوعات ({payments.length})
          </h2>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد مدفوعات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">التاريخ</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الوصف</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المبلغ</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الطريقة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((j) => (
                    <tr key={j.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 text-gray-700">
                        {new Date(j.date).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="px-3 py-2.5 text-gray-900">{j.description}</td>
                      <td className="px-3 py-2.5 text-gray-900 font-medium">
                        {formatCurrency(j.amount)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{j.payment_method}</td>
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

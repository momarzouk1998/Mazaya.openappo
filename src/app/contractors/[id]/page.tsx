'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { Contractor, OrderExternalWork, Order } from '@/types';

export default function ContractorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [works, setWorks] = useState<(OrderExternalWork & { order_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ctRes, wRes] = await Promise.all([
          supabase.from('contractors').select('*').eq('id', id).single(),
          supabase
            .from('order_external_work').select('*, order:orders(*)')
            .eq('contractor_id', id)
            .order('created_at', { ascending: false }),
        ]);

        setContractor(ctRes.data as Contractor);

        const wData = (wRes.data as (OrderExternalWork & { order?: Order })[]) || [];
        setWorks(
          wData.map((w) => ({
            ...w,
            order_name: w.order?.order_name || 'أوردر محذوف',
          }))
        );
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

  if (!contractor) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">المقاول غير موجود</p>
          <Link href="/contractors" className="text-orange-600 hover:text-orange-700 mt-2 inline-block">
            ← العودة للمقاولين
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const totalAmount = works.reduce((s, w) => s + w.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/contractors" className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
              ← المقاولين
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{contractor.name}</h1>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">النوع</p>
            <p className="text-sm font-medium text-gray-900">{contractor.type}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">الهاتف</p>
            <p className="text-sm font-medium text-gray-900" dir="ltr">
              {contractor.phone || '-'}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">إجمالي الأعمال</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {contractor.notes && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs text-gray-500 mb-1">ملاحظات</p>
            <p className="text-sm text-gray-700">{contractor.notes}</p>
          </div>
        )}

        {/* External Works */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            الأعمال الخارجية ({works.length})
          </h2>
          {works.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              لا توجد أعمال خارجية مسجلة لهذا المقاول
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الأوردر</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">نوع العمل</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المبلغ</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">ملاحظات</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {works.map((w) => (
                    <tr
                      key={w.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => router.push(`/orders/${w.order_id}`)}
                          className="text-orange-600 hover:text-orange-700 font-medium text-sm"
                        >
                          {w.order_name}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          w.work_type === 'ألوميتال' ? 'bg-blue-100 text-blue-700' :
                          w.work_type === 'تنجيد' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {w.work_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-900 font-medium">
                        {formatCurrency(w.amount)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{w.notes || '-'}</td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {new Date(w.created_at).toLocaleDateString('ar-EG')}
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

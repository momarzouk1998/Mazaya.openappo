'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { Order, Customer, Branch, OrderMaterial, OrderExternalWork, Contractor } from '@/types';

interface OrderFull extends Order {
  customer?: Customer;
  branch?: Branch;
  materials?: OrderMaterial[];
  external_works?: (OrderExternalWork & { contractor?: Contractor })[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [order, setOrder] = useState<OrderFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ role: string } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [oRes, mRes, extRes, userRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*, customer:customers(*), branch:branches(*)')
            .eq('id', id)
            .single(),
          supabase
            .from('order_materials')
            .select('*')
            .eq('order_id', id)
            .order('created_at', { ascending: true }),
          supabase
            .from('order_external_work')
            .select('*, contractor:contractors(*)')
            .eq('order_id', id)
            .order('created_at', { ascending: true }),
          supabase.auth.getUser(),
        ]);

        setOrder({
          ...(oRes.data as Order),
          customer: (oRes.data as any).customer,
          branch: (oRes.data as any).branch,
          materials: (mRes.data as OrderMaterial[]) || [],
          external_works: (extRes.data as (OrderExternalWork & { contractor?: Contractor })[]) || [],
        } as OrderFull);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userRes.data?.user?.id)
          .single();
        setProfile(profileData as { role: string } | null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, supabase]);

  const updateStatus = async (newStatus: string) => {
    setStatusLoading(true);
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
      if (!error) {
        setOrder((prev) => (prev ? { ...prev, status: newStatus as Order['status'] } : null));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatusLoading(false);
    }
  };

  const formatCurrency = (val: number) => `${val.toLocaleString('ar-EG')} ج.م`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-EG');

  const statusColors: Record<string, string> = {
    مفتوح: 'bg-blue-100 text-blue-800',
    'قيد التنفيذ': 'bg-yellow-100 text-yellow-800',
    مكتمل: 'bg-green-100 text-green-800',
    'تم التسليم': 'bg-gray-100 text-gray-800',
  };

  const statusOptions = ['مفتوح', 'قيد التنفيذ', 'مكتمل', 'تم التسليم'];
  const isAdmin = profile?.role === 'admin';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">الأوردر غير موجود</p>
          <Link href="/orders" className="text-orange-600 hover:text-orange-700 mt-2 inline-block">
            ← العودة للأوردرات
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/orders" className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
              ← الأوردرات
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{order.order_name}</h1>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <div className="flex gap-1">
                {statusOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={statusLoading || order.status === s}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      order.status === s
                        ? `${statusColors[s]} cursor-default`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <Link
              href={`/orders/${id}/edit`}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ✏️ تعديل
            </Link>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <InfoItem label="العميل" value={order.customer?.name || '-'} />
          <InfoItem label="المعرض" value={order.branch?.name || '-'} />
          <InfoItem label="النوع" value={order.order_type} />
          <InfoItem label="الحالة" value={order.status} />
          <InfoItem label="تاريخ البدء" value={formatDate(order.start_date)} />
          <InfoItem label="تاريخ الانتهاء" value={order.end_date ? formatDate(order.end_date) : '-'} />
          <InfoItem label="المدة (أيام)" value={order.duration_days ? String(order.duration_days) : '-'} />
          {order.parent_order_id && (
            <InfoItem label="الأوردر الأصلي" value={order.parent_order_id} />
          )}
          {order.notes && (
            <div className="col-span-full">
              <p className="text-xs text-gray-500 mb-1">ملاحظات</p>
              <p className="text-sm text-gray-700">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Materials Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            الخامات المستخدمة ({(order.materials || []).length})
          </h2>
          {(order.materials || []).length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد خامات مسجلة</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">النوع</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الصنف</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الكمية</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">سعر الوحدة</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(order.materials || []).map((mat) => (
                    <tr key={mat.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 text-gray-700">
                        {mat.item_category === 'board' ? 'لوح' : 'اكسسوار'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-900">
                        {mat.item_name || mat.item_id}
                      </td>
                      <td className="px-3 py-2.5 text-gray-900">{mat.quantity_used}</td>
                      <td className="px-3 py-2.5 text-gray-900">{formatCurrency(mat.unit_price_snapshot)}</td>
                      <td className="px-3 py-2.5 text-gray-900 font-medium">{formatCurrency(mat.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">تفاصيل التكاليف</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <CostItem label="تكلفة الألواح" value={order.boards_cost} />
            <CostItem label="تكلفة الاكسسوارات" value={order.accessories_cost} />
            <CostItem label="تكلفة التركيب" value={order.installation_cost} />
            <CostItem label="نقل داخلي" value={order.internal_transport_cost} />
            <CostItem label="نقل خارجي" value={order.external_transport_cost} />
            <CostItem label="عمولة المصنع" value={order.factory_commission} />
          </div>
          <div className="mt-4 bg-gray-900 text-white rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-medium">الإجمالي الكلي</p>
            <p className="text-xl font-bold">{formatCurrency(order.order_total)}</p>
          </div>
        </div>

        {/* External Work */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            العمالة الخارجية ({(order.external_works || []).length})
          </h2>
          {(order.external_works || []).length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد عمالة خارجية</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">نوع العمل</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المقاول</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المبلغ</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(order.external_works || []).map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 text-gray-900">{w.work_type}</td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {w.contractor?.name || w.contractor_id || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-900 font-medium">{formatCurrency(w.amount)}</td>
                      <td className="px-3 py-2.5 text-gray-500">{w.notes || '-'}</td>
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function CostItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-gray-900">
        {value.toLocaleString('ar-EG')} ج.م
      </p>
    </div>
  );
}

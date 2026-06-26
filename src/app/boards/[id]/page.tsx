'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { BoardsInventory, Supplier, OrderMaterial, Order } from '@/types';

interface BoardWithSupplier extends BoardsInventory {
  supplier?: Supplier;
}

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [item, setItem] = useState<BoardWithSupplier | null>(null);
  const [usageHistory, setUsageHistory] = useState<(OrderMaterial & { order?: Order })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [iRes, uRes] = await Promise.all([
          supabase
            .from('boards_inventory')
            .select('*, supplier:suppliers(*)')
            .eq('id', id)
            .single(),
          supabase
            .from('order_materials')
            .select('*')
            .eq('item_category', 'board')
            .eq('item_id', id)
            .order('created_at', { ascending: false }),
        ]);

        setItem(iRes.data as BoardWithSupplier);

        const materials = (uRes.data as OrderMaterial[]) || [];
        const orderIds = [...new Set(materials.map((m) => m.order_id))];
        let orderMap: Record<string, Order> = {};

        if (orderIds.length > 0) {
          const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .in('id', orderIds);
          for (const o of (orders as Order[]) || []) {
            orderMap[o.id] = o;
          }
        }

        setUsageHistory(
          materials.map((m) => ({
            ...m,
            order: orderMap[m.order_id],
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
  const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-EG');

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!item) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">الصنف غير موجود</p>
          <Link href="/boards" className="text-orange-600 hover:text-orange-700 mt-2 inline-block">
            ← العودة لمخزون الألواح
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/boards" className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
              ← مخزون الألواح
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{item.item_name}</h1>
            <p className="text-sm text-gray-500">{item.code}</p>
          </div>
          <Link
            href={`/boards/${id}/edit`}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            ✏️ تعديل
          </Link>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <InfoItem label="الخامة" value={item.material_type} />
          <InfoItem label="الشركة" value={item.supplier?.name || '-'} />
          <InfoItem label="السعر" value={formatCurrency(item.unit_price)} />
          <InfoItem label="العدد" value={String(item.quantity_in)} />
          <InfoItem label="الإجمالي" value={formatCurrency(item.total_price)} />
          <InfoItem label="تم استخدام" value={String(item.quantity_used)} />
          <InfoItem label="المتبقي" value={String(item.quantity_remaining)} />
          <InfoItem label="التاريخ" value={formatDate(item.date_added)} />
          {item.linked_order_id && (
            <InfoItem label="أمر الشغل المرتبط" value={item.linked_order_id} />
          )}
          {item.notes && (
            <div className="col-span-full">
              <p className="text-xs text-gray-500 mb-1">ملاحظات</p>
              <p className="text-sm text-gray-700">{item.notes}</p>
            </div>
          )}
        </div>

        {/* Usage History */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            سجل الاستخدام ({usageHistory.length})
          </h2>
          {usageHistory.length === 0 ? (
            <p className="text-sm text-gray-400">لا يوجد سجل استخدام</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">أمر الشغل</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الكمية المستخدمة</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">السعر</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usageHistory.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 text-gray-900">
                        {u.order ? (
                          <Link href={`/orders/${u.order_id}`} className="text-orange-600 hover:text-orange-700">
                            {u.order.order_name}
                          </Link>
                        ) : (
                          u.order_id
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-900">{u.quantity_used}</td>
                      <td className="px-3 py-2.5 text-gray-900">{formatCurrency(u.unit_price_snapshot)}</td>
                      <td className="px-3 py-2.5 text-gray-900">{formatCurrency(u.line_total)}</td>
                      <td className="px-3 py-2.5 text-gray-700">{formatDate(u.created_at)}</td>
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

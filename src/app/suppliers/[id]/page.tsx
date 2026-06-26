'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import type { Supplier, BoardsInventory, AccessoriesInventory, JournalEntry } from '@/types';

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [boards, setBoards] = useState<BoardsInventory[]>([]);
  const [accessories, setAccessories] = useState<AccessoriesInventory[]>([]);
  const [purchases, setPurchases] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sRes, bRes, aRes, jRes] = await Promise.all([
          supabase.from('suppliers').select('*').eq('id', id).single(),
          supabase
            .from('boards_inventory')
            .select('*')
            .eq('supplier_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('accessories_inventory')
            .select('*')
            .eq('supplier_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('journal_entries')
            .select('*')
            .eq('party_id', id)
            .eq('party_type', 'supplier')
            .order('date', { ascending: false }),
        ]);

        setSupplier(sRes.data as Supplier);
        setBoards((bRes.data as BoardsInventory[]) || []);
        setAccessories((aRes.data as AccessoriesInventory[]) || []);
        setPurchases((jRes.data as JournalEntry[]) || []);
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

  if (!supplier) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">المورد غير موجود</p>
          <Link href="/suppliers" className="text-orange-600 hover:text-orange-700 mt-2 inline-block">
            ← العودة للموردين
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const totalSpent = purchases.reduce((s, e) => s + e.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/suppliers" className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
              ← الموردين
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
          </div>
          <Link
            href={`/suppliers/${id}/edit`}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            ✏️ تعديل
          </Link>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">نوع التعامل</p>
            <p className="text-sm font-medium text-gray-900">{supplier.payment_type}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">الهاتف</p>
            <p className="text-sm font-medium text-gray-900" dir="ltr">{supplier.phone || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">إجمالي المشتريات</p>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(totalSpent)}</p>
          </div>
          {supplier.notes && (
            <div className="sm:col-span-3">
              <p className="text-xs text-gray-500 mb-1">ملاحظات</p>
              <p className="text-sm text-gray-700">{supplier.notes}</p>
            </div>
          )}
        </div>

        {/* Boards */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            الألواح الموردة ({boards.length})
          </h2>
          {boards.length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد ألواح</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الاسم</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الكود</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المتبقي</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">السعر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {boards.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 text-gray-900">{b.item_name}</td>
                      <td className="px-3 py-2.5 text-gray-600">{b.code}</td>
                      <td className="px-3 py-2.5 text-gray-900">{b.quantity_remaining}</td>
                      <td className="px-3 py-2.5 text-gray-900">{formatCurrency(b.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Accessories */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            الاكسسوارات الموردة ({accessories.length})
          </h2>
          {accessories.length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد اكسسوارات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الاسم</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الكود</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المتبقي</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">السعر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accessories.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 text-gray-900">{a.item_name}</td>
                      <td className="px-3 py-2.5 text-gray-600">{a.code}</td>
                      <td className="px-3 py-2.5 text-gray-900">{a.quantity_remaining}</td>
                      <td className="px-3 py-2.5 text-gray-900">{formatCurrency(a.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Purchase History */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            سجل المشتريات ({purchases.length})
          </h2>
          {purchases.length === 0 ? (
            <p className="text-sm text-gray-400">لا توجد مشتريات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">التاريخ</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الوصف</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المبلغ</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">طريقة الدفع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {purchases.map((j) => (
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

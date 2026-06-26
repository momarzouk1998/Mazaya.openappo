'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FormField from '@/components/ui/FormField';
import type { Supplier, Branch, Order } from '@/types';

const entryTypes = [
  { value: 'مشتريات', label: 'مشتريات' },
  { value: 'دفعة واردة من معرض', label: 'دفعة واردة من معرض' },
  { value: 'دفعة صادرة لمورد', label: 'دفعة صادرة لمورد' },
  { value: 'تحويل تمريري', label: 'تحويل تمريري' },
  { value: 'نثريات', label: 'نثريات' },
];

const paymentMethods = [
  { value: 'نقدي', label: 'نقدي' },
  { value: 'تحويل', label: 'تحويل' },
];

export default function NewJournalEntryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    entry_type: '',
    description: '',
    amount: 0,
    payment_method: '',
    party_id: '',
    order_id: '',
    is_pass_through: false,
    notes: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const [sRes, bRes, oRes] = await Promise.all([
          supabase.from('suppliers').select('*').order('name'),
          supabase.from('branches').select('*').order('name'),
          supabase.from('orders').select('*').order('order_name'),
        ]);
        setSuppliers((sRes.data as Supplier[]) || []);
        setBranches((bRes.data as Branch[]) || []);
        setOrders((oRes.data as Order[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setPageLoading(false);
      }
    }
    load();
  }, [supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const showPartySelect = form.entry_type && form.entry_type !== 'نثريات';
  const partyLabel =
    form.entry_type === 'مشتريات' || form.entry_type === 'دفعة صادرة لمورد'
      ? 'المورد'
      : form.entry_type === 'دفعة واردة من معرض' || form.entry_type === 'تحويل تمريري'
      ? 'المعرض'
      : '';
  const partyOptions =
    form.entry_type === 'مشتريات' || form.entry_type === 'دفعة صادرة لمورد'
      ? suppliers.map((s) => ({ value: s.id, label: s.name }))
      : form.entry_type === 'دفعة واردة من معرض' || form.entry_type === 'تحويل تمريري'
      ? branches.map((b) => ({ value: b.id, label: b.name }))
      : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.entry_type) { setError('نوع الحركة مطلوب'); return; }
    if (!form.description.trim()) { setError('البيان مطلوب'); return; }
    if (!form.amount || form.amount <= 0) { setError('المبلغ يجب أن يكون أكبر من صفر'); return; }
    if (!form.payment_method) { setError('طريقة الدفع مطلوبة'); return; }

    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('journal_entries').insert({
        date: form.date,
        entry_type: form.entry_type,
        description: form.description.trim(),
        amount: form.amount,
        payment_method: form.payment_method,
        party_id: form.party_id || null,
        party_type: form.party_id
          ? (form.entry_type === 'مشتريات' || form.entry_type === 'دفعة صادرة لمورد' ? 'supplier' : 'branch')
          : null,
        order_id: form.order_id || null,
        is_pass_through: form.is_pass_through,
        notes: form.notes.trim(),
      });

      if (insertError) {
        setError(insertError.message);
      } else {
        router.push('/journal');
        router.refresh();
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
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
      <div className="max-w-xl space-y-6">
        <div>
          <Link href="/journal" className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
            ← اليومية المالية
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">حركة مالية جديدة</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <FormField
            label="التاريخ"
            name="date"
            type="date"
            value={form.date}
            onChange={handleChange}
            required
          />

          <FormField
            label="نوع الحركة"
            name="entry_type"
            type="select"
            value={form.entry_type}
            onChange={handleChange}
            required
            options={entryTypes}
          />

          <FormField
            label="البيان"
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            placeholder="وصف الحركة"
          />

          <FormField
            label="المبلغ"
            name="amount"
            type="number"
            value={form.amount}
            onChange={handleChange}
            required
            min={0.01}
            step="0.01"
          />

          <FormField
            label="طريقة الدفع"
            name="payment_method"
            type="select"
            value={form.payment_method}
            onChange={handleChange}
            required
            options={paymentMethods}
          />

          {showPartySelect && (
            <FormField
              label={partyLabel}
              name="party_id"
              type="select"
              value={form.party_id}
              onChange={handleChange}
              options={partyOptions}
            />
          )}

          <FormField
            label="الأوردر (اختياري)"
            name="order_id"
            type="select"
            value={form.order_id}
            onChange={handleChange}
            options={orders.map((o) => ({ value: o.id, label: o.order_name }))}
          />

          {form.entry_type === 'تحويل تمريري' && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_pass_through"
                checked={form.is_pass_through}
                onChange={handleChange}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">تمريري (بدون إضافة للرصيد)</span>
            </label>
          )}

          <FormField
            label="ملاحظات"
            name="notes"
            type="textarea"
            value={form.notes}
            onChange={handleChange}
            placeholder="ملاحظات إضافية..."
          />

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'جاري الحفظ...' : '💾 حفظ'}
            </button>
            <Link
              href="/journal"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

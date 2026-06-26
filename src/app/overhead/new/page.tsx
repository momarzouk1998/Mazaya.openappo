'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FormField from '@/components/ui/FormField';

export default function NewOverheadPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    notes: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) { setError('البيان مطلوب'); return; }
    if (!form.amount || form.amount <= 0) { setError('المبلغ يجب أن يكون أكبر من صفر'); return; }

    setLoading(true);
    setError('');

    try {
      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          date: form.date,
          entry_type: 'نثريات',
          description: form.description.trim(),
          amount: form.amount,
          payment_method: 'نقدي',
          party_id: null,
          party_type: null,
          order_id: null,
          is_pass_through: false,
          notes: form.notes.trim(),
        })
        .select()
        .single();

      if (journalError) { setError(journalError.message); setLoading(false); return; }

      const { error: overheadError } = await supabase.from('overhead_expenses').insert({
        date: form.date,
        description: form.description.trim(),
        amount: form.amount,
        notes: form.notes.trim(),
        journal_entry_id: journalEntry.id,
      });

      if (overheadError) {
        setError(overheadError.message);
      } else {
        router.push('/overhead');
        router.refresh();
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-xl space-y-6">
        <div>
          <Link href="/overhead" className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
            ← النثريات
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">نثريات جديدة</h1>
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
            label="البيان"
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            placeholder="وصف النثريات"
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
              href="/overhead"
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

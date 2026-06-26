'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FormField from '@/components/ui/FormField';
import type { Supplier } from '@/types';

export default function EditSupplierPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    payment_type: '',
    phone: '',
    notes: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', id)
          .single();
        if (data) {
          const s = data as Supplier;
          setForm({
            name: s.name,
            payment_type: s.payment_type,
            phone: s.phone || '',
            notes: s.notes || '',
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setPageLoading(false);
      }
    }
    load();
  }, [id, supabase]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('الاسم مطلوب');
      return;
    }
    if (!form.payment_type) {
      setError('نوع التعامل مطلوب');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('suppliers')
        .update({
          name: form.name.trim(),
          payment_type: form.payment_type,
          phone: form.phone.trim(),
          notes: form.notes.trim(),
        })
        .eq('id', id);

      if (updateError) {
        setError(updateError.message);
      } else {
        router.push(`/suppliers/${id}`);
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
          <Link href={`/suppliers/${id}`} className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
            ← المورد
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">تعديل المورد</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <FormField
            label="الاسم"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="اسم المورد"
          />

          <FormField
            label="نوع التعامل"
            name="payment_type"
            type="select"
            value={form.payment_type}
            onChange={handleChange}
            required
            options={[
              { value: 'نقدي', label: 'نقدي' },
              { value: 'تحويل', label: 'تحويل' },
              { value: 'كلاهما', label: 'كلاهما' },
            ]}
          />

          <FormField
            label="الهاتف"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="رقم الهاتف"
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
              {loading ? 'جاري الحفظ...' : '💾 حفظ التغييرات'}
            </button>
            <Link
              href={`/suppliers/${id}`}
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

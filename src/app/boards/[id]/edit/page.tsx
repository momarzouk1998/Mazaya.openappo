'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FormField from '@/components/ui/FormField';
import type { BoardsInventory, Supplier, MaterialType, Order } from '@/types';

export default function EditBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({
    item_name: '',
    material_type: '',
    code: '',
    supplier_id: '',
    unit_price: '',
    quantity_in: '',
    date_added: '',
    linked_order_id: '',
    notes: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const [itemRes, supRes, matRes, ordRes] = await Promise.all([
          supabase.from('boards_inventory').select('*').eq('id', id).single(),
          supabase.from('suppliers').select('*').order('name'),
          supabase.from('material_types').select('*').order('name'),
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
        ]);

        const item = itemRes.data as BoardsInventory;
        if (item) {
          setForm({
            item_name: item.item_name,
            material_type: item.material_type,
            code: item.code,
            supplier_id: item.supplier_id || '',
            unit_price: String(item.unit_price),
            quantity_in: String(item.quantity_in),
            date_added: item.date_added,
            linked_order_id: item.linked_order_id || '',
            notes: item.notes || '',
          });
        }

        setSuppliers((supRes.data as Supplier[]) || []);
        setMaterialTypes((matRes.data as MaterialType[]) || []);
        setOrders((ordRes.data as Order[]) || []);
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
    if (!form.item_name.trim()) { setError('البيان مطلوب'); return; }
    if (!form.material_type) { setError('الخامة مطلوبة'); return; }
    if (!form.code.trim()) { setError('الكود مطلوب'); return; }

    setLoading(true);
    setError('');

    try {
      const unit_price = parseFloat(form.unit_price) || 0;
      const quantity_in = parseInt(form.quantity_in, 10) || 0;
      const total_price = unit_price * quantity_in;

      const { error: updateError } = await supabase
        .from('boards_inventory')
        .update({
          item_name: form.item_name.trim(),
          material_type: form.material_type,
          code: form.code.trim(),
          supplier_id: form.supplier_id || null,
          unit_price,
          quantity_in,
          total_price,
          date_added: form.date_added,
          linked_order_id: form.linked_order_id || null,
          notes: form.notes.trim(),
        })
        .eq('id', id);

      if (updateError) {
        setError(updateError.message);
      } else {
        router.push(`/boards/${id}`);
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
          <Link href={`/boards/${id}`} className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
            ← الصنف
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">تعديل الصنف</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <FormField label="البيان" name="item_name" value={form.item_name} onChange={handleChange} required placeholder="اسم الصنف" />
          <FormField
            label="الخامة"
            name="material_type"
            type="select"
            value={form.material_type}
            onChange={handleChange}
            required
            options={materialTypes.map((m) => ({ value: m.name, label: m.name }))}
          />
          <FormField label="الكود" name="code" value={form.code} onChange={handleChange} required placeholder="كود الصنف" />
          <FormField
            label="الشركة"
            name="supplier_id"
            type="select"
            value={form.supplier_id}
            onChange={handleChange}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
          <FormField label="السعر" name="unit_price" type="number" value={form.unit_price} onChange={handleChange} placeholder="سعر الوحدة" min={0} step="0.01" />
          <FormField label="العدد" name="quantity_in" type="number" value={form.quantity_in} onChange={handleChange} placeholder="الكمية" min={0} />
          <FormField label="التاريخ" name="date_added" type="date" value={form.date_added} onChange={handleChange} />
          <FormField
            label="أمر شغل مرتبط"
            name="linked_order_id"
            type="select"
            value={form.linked_order_id}
            onChange={handleChange}
            options={orders.map((o) => ({ value: o.id, label: o.order_name }))}
          />
          <FormField label="ملاحظات" name="notes" type="textarea" value={form.notes} onChange={handleChange} placeholder="ملاحظات إضافية..." />

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
              href={`/boards/${id}`}
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

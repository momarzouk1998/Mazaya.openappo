'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FormField from '@/components/ui/FormField';
import type {
  Customer, Branch, BoardsInventory, AccessoriesInventory,
  Contractor, Order, OrderMaterial, OrderExternalWork,
} from '@/types';

interface MaterialRow {
  tempId: string;
  dbId?: string;
  item_category: 'board' | 'accessory';
  item_id: string;
  item_name: string;
  quantity_used: number;
  quantity_remaining: number;
  unit_price_snapshot: number;
  line_total: number;
}

interface ExternalWorkRow {
  tempId: string;
  dbId?: string;
  work_type: 'ألوميتال' | 'تنجيد' | 'أخرى';
  contractor_id: string;
  contractor_name: string;
  amount: number;
  notes: string;
}

const emptyMaterial = (): MaterialRow => ({
  tempId: Math.random().toString(36).slice(2),
  item_category: 'board',
  item_id: '',
  item_name: '',
  quantity_used: 1,
  quantity_remaining: 0,
  unit_price_snapshot: 0,
  line_total: 0,
});

const emptyExternalWork = (): ExternalWorkRow => ({
  tempId: Math.random().toString(36).slice(2),
  work_type: 'ألوميتال',
  contractor_id: '',
  contractor_name: '',
  amount: 0,
  notes: '',
});

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [parentOrders, setParentOrders] = useState<Order[]>([]);
  const [boards, setBoards] = useState<BoardsInventory[]>([]);
  const [accessories, setAccessories] = useState<AccessoriesInventory[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [form, setForm] = useState({
    order_name: '',
    customer_id: '',
    branch_id: '',
    order_type: 'تصنيع جديد',
    parent_order_id: '',
    start_date: '',
    end_date: '',
    status: 'مفتوح',
    notes: '',
  });

  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [externalWorks, setExternalWorks] = useState<ExternalWorkRow[]>([]);
  const [installationCost, setInstallationCost] = useState(0);
  const [internalTransportCost, setInternalTransportCost] = useState(0);
  const [externalTransportCost, setExternalTransportCost] = useState(0);
  const [factoryCommission, setFactoryCommission] = useState(0);

  const filteredCustomers = customers.filter(
    (c) => c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  useEffect(() => {
    async function load() {
      try {
        const [
          oRes, cRes, bRes, conRes, pRes,
          boardRes, accRes,
        ] = await Promise.all([
          supabase.from('orders').select('*').eq('id', id).single(),
          supabase.from('customers').select('*, branch:branches(*)').order('name'),
          supabase.from('branches').select('*').order('name'),
          supabase.from('contractors').select('*').order('name'),
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          supabase.from('boards_inventory').select('*').order('item_name'),
          supabase.from('accessories_inventory').select('*').order('item_name'),
        ]);

        const order = oRes.data as Order;
        if (order) {
          const customer = (cRes.data as Customer[]).find((c) => c.id === order.customer_id);
          setForm({
            order_name: order.order_name,
            customer_id: order.customer_id || '',
            branch_id: order.branch_id || '',
            order_type: order.order_type,
            parent_order_id: order.parent_order_id || '',
            start_date: order.start_date,
            end_date: order.end_date || '',
            status: order.status,
            notes: order.notes || '',
          });
          setCustomerSearch(customer?.name || '');
          setInstallationCost(order.installation_cost);
          setInternalTransportCost(order.internal_transport_cost);
          setExternalTransportCost(order.external_transport_cost);
          setFactoryCommission(order.factory_commission);
        }

        setCustomers((cRes.data as Customer[]) || []);
        setBranches((bRes.data as Branch[]) || []);
        setContractors((conRes.data as Contractor[]) || []);
        setParentOrders((pRes.data as Order[]) || []);
        setBoards((boardRes.data as BoardsInventory[]) || []);
        setAccessories((accRes.data as AccessoriesInventory[]) || []);

        // Load materials and external work
        const [mRes, extRes] = await Promise.all([
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
        ]);

        setMaterials(
          ((mRes.data as OrderMaterial[]) || []).map((m) => {
            let quantity_remaining = 0;
            if (m.item_category === 'board') {
              const item = (boardRes.data as BoardsInventory[]).find((b) => b.id === m.item_id);
              if (item) quantity_remaining = item.quantity_remaining;
            } else {
              const item = (accRes.data as AccessoriesInventory[]).find((a) => a.id === m.item_id);
              if (item) quantity_remaining = item.quantity_remaining;
            }
            return {
              tempId: Math.random().toString(36).slice(2),
              dbId: m.id,
              item_category: m.item_category,
              item_id: m.item_id,
              item_name: m.item_name || '',
              quantity_used: m.quantity_used,
              quantity_remaining,
              unit_price_snapshot: m.unit_price_snapshot,
              line_total: m.line_total,
            };
          })
        );

        setExternalWorks(
          ((extRes.data as (OrderExternalWork & { contractor?: Contractor })[]) || []).map((w) => ({
            tempId: Math.random().toString(36).slice(2),
            dbId: w.id,
            work_type: w.work_type,
            contractor_id: w.contractor_id || '',
            contractor_name: w.contractor?.name || '',
            amount: w.amount,
            notes: w.notes || '',
          }))
        );
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
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'customer_id') {
      const customer = customers.find((c) => c.id === value);
      if (customer?.branch_id) {
        setForm((prev) => ({ ...prev, customer_id: value, branch_id: customer.branch_id! }));
      }
    }
  };

  const selectCustomer = (customer: Customer) => {
    setForm((prev) => ({
      ...prev,
      customer_id: customer.id,
      branch_id: customer.branch_id || '',
    }));
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const addMaterial = () => setMaterials((prev) => [...prev, emptyMaterial()]);
  const removeMaterial = (tempId: string) =>
    setMaterials((prev) => prev.filter((m) => m.tempId !== tempId));

  const updateMaterial = (tempId: string, field: keyof MaterialRow, value: any) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.tempId !== tempId) return m;
        const updated = { ...m, [field]: value };
        if (field === 'item_category') {
          updated.item_id = '';
          updated.item_name = '';
          updated.unit_price_snapshot = 0;
          updated.quantity_remaining = 0;
        }
        if (field === 'item_id') {
          if (updated.item_category === 'board') {
            const item = boards.find((b) => b.id === value);
            if (item) {
              updated.item_name = item.item_name;
              updated.unit_price_snapshot = item.unit_price;
              updated.quantity_remaining = item.quantity_remaining;
            }
          } else {
            const item = accessories.find((a) => a.id === value);
            if (item) {
              updated.item_name = item.item_name;
              updated.unit_price_snapshot = item.unit_price;
              updated.quantity_remaining = item.quantity_remaining;
            }
          }
        }
        updated.line_total = updated.quantity_used * updated.unit_price_snapshot;
        return updated;
      })
    );
  };

  const addExternalWork = () => setExternalWorks((prev) => [...prev, emptyExternalWork()]);
  const removeExternalWork = (tempId: string) =>
    setExternalWorks((prev) => prev.filter((w) => w.tempId !== tempId));

  const updateExternalWork = (tempId: string, field: keyof ExternalWorkRow, value: any) => {
    setExternalWorks((prev) =>
      prev.map((w) => {
        if (w.tempId !== tempId) return w;
        const updated = { ...w, [field]: value };
        if (field === 'contractor_id') {
          const contractor = contractors.find((c) => c.id === value);
          if (contractor) updated.contractor_name = contractor.name;
        }
        return updated;
      })
    );
  };

  const boardsCost = materials
    .filter((m) => m.item_category === 'board')
    .reduce((sum, m) => sum + m.line_total, 0);
  const accessoriesCost = materials
    .filter((m) => m.item_category === 'accessory')
    .reduce((sum, m) => sum + m.line_total, 0);
  const orderTotal =
    boardsCost +
    accessoriesCost +
    installationCost +
    internalTransportCost +
    externalTransportCost +
    factoryCommission +
    externalWorks.reduce((sum, w) => sum + w.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.order_name.trim()) { setError('اسم الأوردر مطلوب'); return; }
    if (!form.customer_id) { setError('العميل مطلوب'); return; }
    if (!form.branch_id) { setError('المعرض مطلوب'); return; }

    setLoading(true);
    setError('');

    try {
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          order_name: form.order_name.trim(),
          customer_id: form.customer_id,
          branch_id: form.branch_id,
          order_type: form.order_type,
          parent_order_id: form.parent_order_id || null,
          start_date: form.start_date,
          end_date: form.end_date || null,
          status: form.status,
          boards_cost: boardsCost,
          accessories_cost: accessoriesCost,
          installation_cost: installationCost,
          internal_transport_cost: internalTransportCost,
          external_transport_cost: externalTransportCost,
          factory_commission: factoryCommission,
          notes: form.notes.trim(),
        })
        .eq('id', id);

      if (orderError) { setError(orderError.message); setLoading(false); return; }

      // Replace materials: delete old, insert new
      const { error: delMatError } = await supabase
        .from('order_materials')
        .delete()
        .eq('order_id', id);
      if (delMatError) { setError(delMatError.message); setLoading(false); return; }

      if (materials.length > 0) {
        const { error: matError } = await supabase.from('order_materials').insert(
          materials.map((m) => ({
            order_id: id,
            item_category: m.item_category,
            item_id: m.item_id,
            quantity_used: m.quantity_used,
            unit_price_snapshot: m.unit_price_snapshot,
            line_total: m.line_total,
          }))
        );
        if (matError) { setError(matError.message); setLoading(false); return; }
      }

      // Replace external work: delete old, insert new
      const { error: delExtError } = await supabase
        .from('order_external_work')
        .delete()
        .eq('order_id', id);
      if (delExtError) { setError(delExtError.message); setLoading(false); return; }

      if (externalWorks.length > 0) {
        const { error: extError } = await supabase.from('order_external_work').insert(
          externalWorks.map((w) => ({
            order_id: id,
            work_type: w.work_type,
            contractor_id: w.contractor_id || null,
            amount: w.amount,
            notes: w.notes,
          }))
        );
        if (extError) { setError(extError.message); setLoading(false); return; }
      }

      router.push(`/orders/${id}`);
      router.refresh();
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
      <div className="max-w-4xl space-y-6">
        <div>
          <Link href={`/orders/${id}`} className="text-sm text-orange-600 hover:text-orange-700 mb-1 inline-block">
            ← الأوردر
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">تعديل الأوردر</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 pb-2 border-b border-gray-100">
              البيانات الأساسية
            </h2>

            <FormField label="اسم الأوردر" name="order_name" value={form.order_name} onChange={handleChange} required placeholder="اسم أمر الشغل" />

            <div className="space-y-1.5 relative">
              <label className="block text-sm font-medium text-gray-700">
                العميل <span className="text-red-500 mr-1">*</span>
              </label>
              <input
                type="text"
                placeholder="ابحث عن عميل..."
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
              />
              {showCustomerDropdown && customerSearch && (
                <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400">لا يوجد عملاء</div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-right px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 transition-colors"
                      >
                        {c.name} {c.phone ? `- ${c.phone}` : ''}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <FormField
              label="المعرض"
              name="branch_id"
              type="select"
              value={form.branch_id}
              onChange={handleChange}
              required
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
            <FormField
              label="نوع الأوردر"
              name="order_type"
              type="select"
              value={form.order_type}
              onChange={handleChange}
              options={[
                { value: 'تصنيع جديد', label: 'تصنيع جديد' },
                { value: 'صيانة', label: 'صيانة' },
              ]}
            />
            {form.order_type === 'صيانة' && (
              <FormField
                label="الأوردر الأصلي"
                name="parent_order_id"
                type="select"
                value={form.parent_order_id}
                onChange={handleChange}
                options={parentOrders.map((o) => ({ value: o.id, label: o.order_name }))}
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="تاريخ البدء" name="start_date" type="date" value={form.start_date} onChange={handleChange} required />
              <FormField label="تاريخ الانتهاء" name="end_date" type="date" value={form.end_date} onChange={handleChange} />
            </div>
            <FormField
              label="الحالة"
              name="status"
              type="select"
              value={form.status}
              onChange={handleChange}
              options={[
                { value: 'مفتوح', label: 'مفتوح' },
                { value: 'قيد التنفيذ', label: 'قيد التنفيذ' },
                { value: 'مكتمل', label: 'مكتمل' },
                { value: 'تم التسليم', label: 'تم التسليم' },
              ]}
            />
            <FormField label="ملاحظات" name="notes" type="textarea" value={form.notes} onChange={handleChange} placeholder="ملاحظات إضافية..." />
          </div>

          {/* Section 2: Materials */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">الخامات المستخدمة</h2>
              <button
                type="button"
                onClick={addMaterial}
                className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors"
              >
                + إضافة خامة
              </button>
            </div>

            {materials.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                لم يتم إضافة خامات — أضف خامات مستخدمة في هذا الأوردر
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">النوع</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الصنف</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الكمية</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المتبقي</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">سعر الوحدة</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {materials.map((mat) => (
                      <tr key={mat.tempId} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2">
                          <select
                            value={mat.item_category}
                            onChange={(e) => updateMaterial(mat.tempId, 'item_category', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                          >
                            <option value="board">لوح</option>
                            <option value="accessory">اكسسوار</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {mat.item_category === 'board' ? (
                            <select
                              value={mat.item_id}
                              onChange={(e) => updateMaterial(mat.tempId, 'item_id', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                            >
                              <option value="">-- اختر لوح --</option>
                              {boards
                                .filter((b) => b.quantity_remaining > 0 || b.id === mat.item_id)
                                .map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.item_name} (متبقي {b.quantity_remaining})
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <select
                              value={mat.item_id}
                              onChange={(e) => updateMaterial(mat.tempId, 'item_id', e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                            >
                              <option value="">-- اختر اكسسوار --</option>
                              {accessories
                                .filter((a) => a.quantity_remaining > 0 || a.id === mat.item_id)
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.item_name} (متبقي {a.quantity_remaining})
                                  </option>
                                ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            value={mat.quantity_used}
                            onChange={(e) => updateMaterial(mat.tempId, 'quantity_used', parseInt(e.target.value) || 0)}
                            className={`w-16 px-2 py-1.5 border rounded text-xs outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500 ${
                              mat.quantity_used > mat.quantity_remaining ? 'border-red-400 bg-red-50' : 'border-gray-300'
                            }`}
                          />
                          {mat.quantity_used > mat.quantity_remaining && mat.item_id && (
                            <p className="text-red-500 text-[10px] mt-0.5">أكثر من المتاح!</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs">{mat.quantity_remaining}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={mat.unit_price_snapshot}
                            onChange={(e) => updateMaterial(mat.tempId, 'unit_price_snapshot', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-900 font-medium text-xs">
                          {mat.line_total.toLocaleString('ar-EG')}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeMaterial(mat.tempId)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Cost Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 pb-2 border-b border-gray-100">
              تفاصيل التكاليف
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">تكلفة الألواح</p>
                <p className="text-lg font-bold text-gray-900">{boardsCost.toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">تكلفة الاكسسوارات</p>
                <p className="text-lg font-bold text-gray-900">{accessoriesCost.toLocaleString('ar-EG')} ج.م</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">تكلفة التركيب</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={installationCost}
                  onChange={(e) => setInstallationCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">نقل داخلي</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={internalTransportCost}
                  onChange={(e) => setInternalTransportCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">نقل خارجي</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={externalTransportCost}
                  onChange={(e) => setExternalTransportCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">عمولة المصنع</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={factoryCommission}
                  onChange={(e) => setFactoryCommission(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                />
              </div>
            </div>
            <div className="bg-gray-900 text-white rounded-lg px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-medium">الإجمالي الكلي</p>
              <p className="text-xl font-bold">{orderTotal.toLocaleString('ar-EG')} ج.م</p>
            </div>
          </div>

          {/* Section 4: External Work */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">عمالة خارجية (اختياري)</h2>
              <button
                type="button"
                onClick={addExternalWork}
                className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors"
              >
                + إضافة بند
              </button>
            </div>

            {externalWorks.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                لا توجد عمالة خارجية مضافة
              </p>
            ) : (
              <div className="space-y-3">
                {externalWorks.map((w) => (
                  <div key={w.tempId} className="flex flex-wrap gap-3 items-end p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs text-gray-500 mb-1">نوع العمل</label>
                      <select
                        value={w.work_type}
                        onChange={(e) => updateExternalWork(w.tempId, 'work_type', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                      >
                        <option value="ألوميتال">ألوميتال</option>
                        <option value="تنجيد">تنجيد</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs text-gray-500 mb-1">المقاول</label>
                      <select
                        value={w.contractor_id}
                        onChange={(e) => updateExternalWork(w.tempId, 'contractor_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                      >
                        <option value="">-- اختر مقاول --</option>
                        {contractors.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="block text-xs text-gray-500 mb-1">المبلغ</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={w.amount}
                        onChange={(e) => updateExternalWork(w.tempId, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                      />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-xs text-gray-500 mb-1">ملاحظات</label>
                      <input
                        type="text"
                        value={w.notes}
                        onChange={(e) => updateExternalWork(w.tempId, 'notes', e.target.value)}
                        placeholder="ملاحظات..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExternalWork(w.tempId)}
                      className="px-3 py-2 text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
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
              href={`/orders/${id}`}
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

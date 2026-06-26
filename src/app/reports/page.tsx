'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import * as XLSX from 'xlsx';
import ReportCard from '@/components/ui/ReportCard';

type ReportKey = 'inventory' | 'orders' | 'cashflow' | 'suppliers' | 'overhead';

interface SupplierTotal {
  supplier_id: string | null;
  supplier_name: string;
  total_value: number;
}

interface MaterialTotal {
  material_type: string;
  total_value: number;
  category: 'board' | 'accessory';
}

interface OrderRow {
  id: string;
  order_name: string;
  customer_name: string;
  branch_name: string;
  status: string;
  boards_cost: number;
  accessories_cost: number;
  installation_cost: number;
  internal_transport_cost: number;
  external_transport_cost: number;
  factory_commission: number;
  order_total: number;
}

interface CashFlowBreakdown {
  entry_type: string;
  total: number;
  count: number;
}

interface PaymentMethodTotal {
  payment_method: string;
  total: number;
}

interface SupplierPurchase {
  supplier_id: string | null;
  supplier_name: string;
  total: number;
  count: number;
}

interface OverheadRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  notes: string;
}

const formatCurrency = (val: number) =>
  val.toLocaleString('ar-EG') + ' ج.م';

const reportMeta: Record<ReportKey, { title: string; icon: string; desc: string }> = {
  inventory: { title: 'تقرير المخزون', icon: '📋', desc: 'قيمة المخزون المتبقي من الألواح والاكسسوارات' },
  orders: { title: 'تقرير الأوردرات', icon: '📦', desc: 'قائمة الأوردرات مع تفصيل التكاليف' },
  cashflow: { title: 'تقرير اليومية', icon: '💰', desc: 'الإيرادات والمصروفات وصافي التدفق النقدي' },
  suppliers: { title: 'تقرير الموردين', icon: '🏭', desc: 'إجمالي المشتريات لكل مورد' },
  overhead: { title: 'تقرير النثريات', icon: '📄', desc: 'إجمالي النثريات مصنفة حسب الوصف' },
};

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [expanded, setExpanded] = useState<Record<ReportKey, boolean>>({
    inventory: false, orders: false, cashflow: false, suppliers: false, overhead: false,
  });

  const supabase = createClient();

  const toggleCard = (key: ReportKey) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // --- Inventory Report ---
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');
  const [invBoardsValue, setInvBoardsValue] = useState(0);
  const [invAccessoriesValue, setInvAccessoriesValue] = useState(0);
  const [invSupplierBreakdown, setInvSupplierBreakdown] = useState<SupplierTotal[]>([]);
  const [invMaterialBreakdown, setInvMaterialBreakdown] = useState<MaterialTotal[]>([]);

  useEffect(() => {
    if (!expanded.inventory) return;
    setInvLoading(true);
    setInvError('');
    (async () => {
      try {
        const [boardsRes, accessoriesRes] = await Promise.all([
          supabase.from('boards_inventory').select('unit_price, quantity_remaining, supplier_id, material_type'),
          supabase.from('accessories_inventory').select('unit_price, quantity_remaining, supplier_id, accessory_type'),
        ]);
        if (boardsRes.error) throw boardsRes.error;
        if (accessoriesRes.error) throw accessoriesRes.error;

        const boards = boardsRes.data || [];
        const accessories = accessoriesRes.data || [];

        const bv = boards.reduce((s: number, i: any) => s + (i.unit_price || 0) * (i.quantity_remaining || 0), 0);
        const av = accessories.reduce((s: number, i: any) => s + (i.unit_price || 0) * (i.quantity_remaining || 0), 0);
        setInvBoardsValue(bv);
        setInvAccessoriesValue(av);

        const supplierMap = new Map<string, SupplierTotal>();
        boards.forEach((i: any) => {
          const id = i.supplier_id || 'بدون مورد';
          const existing = supplierMap.get(id) || { supplier_id: i.supplier_id, supplier_name: id, total_value: 0 };
          existing.total_value += (i.unit_price || 0) * (i.quantity_remaining || 0);
          supplierMap.set(id, existing);
        });
        accessories.forEach((i: any) => {
          const id = i.supplier_id || 'بدون مورد';
          const existing = supplierMap.get(id) || { supplier_id: i.supplier_id, supplier_name: id, total_value: 0 };
          existing.total_value += (i.unit_price || 0) * (i.quantity_remaining || 0);
          supplierMap.set(id, existing);
        });

        // Fetch supplier names for non-null IDs
        const supplierIds = [...supplierMap.keys()].filter((k) => k !== 'بدون مورد');
        if (supplierIds.length > 0) {
          const { data: suppliers } = await supabase.from('suppliers').select('id, name').in('id', supplierIds);
          const nameMap = new Map((suppliers || []).map((s: any) => [s.id, s.name]));
          for (const [key, val] of supplierMap) {
            if (key !== 'بدون مورد') {
              val.supplier_name = (nameMap.get(key) as string) || 'غير معروف';
            }
          }
        }
        setInvSupplierBreakdown([...supplierMap.values()].sort((a, b) => b.total_value - a.total_value));

        const materialMap = new Map<string, MaterialTotal>();
        boards.forEach((i: any) => {
          const key = `board::${i.material_type}`;
          const existing = materialMap.get(key) || { material_type: i.material_type, total_value: 0, category: 'board' as const };
          existing.total_value += (i.unit_price || 0) * (i.quantity_remaining || 0);
          materialMap.set(key, existing);
        });
        accessories.forEach((i: any) => {
          const key = `accessory::${i.accessory_type}`;
          const existing = materialMap.get(key) || { material_type: i.accessory_type, total_value: 0, category: 'accessory' as const };
          existing.total_value += (i.unit_price || 0) * (i.quantity_remaining || 0);
          materialMap.set(key, existing);
        });
        setInvMaterialBreakdown([...materialMap.values()].sort((a, b) => b.total_value - a.total_value));
      } catch (err: any) {
        setInvError(err.message || 'حدث خطأ في تحميل التقرير');
        console.error(err);
      } finally {
        setInvLoading(false);
      }
    })();
  }, [expanded.inventory, supabase]);

  // --- Orders Report ---
  const [ordLoading, setOrdLoading] = useState(false);
  const [ordError, setOrdError] = useState('');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordStatusFilter, setOrdStatusFilter] = useState('');
  const [ordBranchFilter, setOrdBranchFilter] = useState('');
  const [ordBranches, setOrdBranches] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!expanded.orders) return;
    setOrdLoading(true);
    setOrdError('');
    (async () => {
      try {
        const { data: branches } = await supabase.from('branches').select('id, name').order('name');
        setOrdBranches(branches || []);

        let query = supabase
          .from('orders')
          .select('id, order_name, status, boards_cost, accessories_cost, installation_cost, internal_transport_cost, external_transport_cost, factory_commission, order_total, customer_id, branch_id, created_at');

        if (ordStatusFilter) query = query.eq('status', ordStatusFilter);
        if (ordBranchFilter) query = query.eq('branch_id', ordBranchFilter);
        query = query.gte('created_at', dateFrom).lte('created_at', dateTo + 'T23:59:59');
        query = query.order('created_at', { ascending: false });

        const { data: ordersData, error } = await query;
        if (error) throw error;

        // Fetch customer and branch names
        const rows = (ordersData || []).map((o: any) => ({ ...o, customer_name: '', branch_name: '' }));
        const customerIds = [...new Set(rows.map((r: any) => r.customer_id).filter(Boolean))];
        const branchIds = [...new Set(rows.map((r: any) => r.branch_id).filter(Boolean))];

        const [customersRes, branchesRes] = await Promise.all([
          customerIds.length ? supabase.from('customers').select('id, name').in('id', customerIds) : { data: [] },
          branchIds.length ? supabase.from('branches').select('id, name').in('id', branchIds) : { data: [] },
        ]);

        const customerMap = new Map((customersRes.data || []).map((c: any) => [c.id, c.name]));
        const branchMap = new Map((branchesRes.data || []).map((b: any) => [b.id, b.name]));

        const finalRows: OrderRow[] = rows.map((o: any) => ({
          id: o.id,
          order_name: o.order_name,
          customer_name: customerMap.get(o.customer_id) || '-',
          branch_name: branchMap.get(o.branch_id) || '-',
          status: o.status,
          boards_cost: o.boards_cost || 0,
          accessories_cost: o.accessories_cost || 0,
          installation_cost: o.installation_cost || 0,
          internal_transport_cost: o.internal_transport_cost || 0,
          external_transport_cost: o.external_transport_cost || 0,
          factory_commission: o.factory_commission || 0,
          order_total: o.order_total || 0,
        }));

        setOrders(finalRows);
      } catch (err: any) {
        setOrdError(err.message || 'حدث خطأ في تحميل التقرير');
        console.error(err);
      } finally {
        setOrdLoading(false);
      }
    })();
  }, [expanded.orders, dateFrom, dateTo, ordStatusFilter, ordBranchFilter, supabase]);

  // --- Cash Flow Report ---
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState('');
  const [cfIncome, setCfIncome] = useState(0);
  const [cfExpenses, setCfExpenses] = useState(0);
  const [cfNet, setCfNet] = useState(0);
  const [cfBreakdown, setCfBreakdown] = useState<CashFlowBreakdown[]>([]);
  const [cfPaymentBreakdown, setCfPaymentBreakdown] = useState<PaymentMethodTotal[]>([]);

  useEffect(() => {
    if (!expanded.cashflow) return;
    setCfLoading(true);
    setCfError('');
    (async () => {
      try {
        const { data: entries, error } = await supabase
          .from('journal_entries')
          .select('entry_type, amount, payment_method')
          .gte('date', dateFrom)
          .lte('date', dateTo);
        if (error) throw error;

        const items = entries || [];
        let income = 0;
        let expenses = 0;

        items.forEach((e: any) => {
          if (e.entry_type === 'دفعة واردة من معرض') {
            income += e.amount || 0;
          } else {
            expenses += e.amount || 0;
          }
        });

        setCfIncome(income);
        setCfExpenses(expenses);
        setCfNet(income - expenses);

        const typeMap = new Map<string, CashFlowBreakdown>();
        items.forEach((e: any) => {
          const key = e.entry_type;
          const existing = typeMap.get(key) || { entry_type: key, total: 0, count: 0 };
          existing.total += e.amount || 0;
          existing.count += 1;
          typeMap.set(key, existing);
        });
        setCfBreakdown([...typeMap.values()].sort((a, b) => b.total - a.total));

        const payMap = new Map<string, PaymentMethodTotal>();
        items.forEach((e: any) => {
          const key = e.payment_method;
          const existing = payMap.get(key) || { payment_method: key || 'غير محدد', total: 0 };
          existing.total += e.amount || 0;
          payMap.set(key, existing);
        });
        setCfPaymentBreakdown([...payMap.values()].sort((a, b) => b.total - a.total));
      } catch (err: any) {
        setCfError(err.message || 'حدث خطأ في تحميل التقرير');
        console.error(err);
      } finally {
        setCfLoading(false);
      }
    })();
  }, [expanded.cashflow, dateFrom, dateTo, supabase]);

  // --- Suppliers Report ---
  const [supLoading, setSupLoading] = useState(false);
  const [supError, setSupError] = useState('');
  const [supPurchases, setSupPurchases] = useState<SupplierPurchase[]>([]);
  const [supSelectedId, setSupSelectedId] = useState<string | null>(null);
  const [supDetail, setSupDetail] = useState<any[]>([]);
  const [supDetailLoading, setSupDetailLoading] = useState(false);

  useEffect(() => {
    if (!expanded.suppliers) return;
    setSupLoading(true);
    setSupError('');
    (async () => {
      try {
        const { data, error } = await supabase
          .from('journal_entries')
          .select('party_id, amount, party_type')
          .eq('entry_type', 'مشتريات')
          .gte('date', dateFrom)
          .lte('date', dateTo);
        if (error) throw error;

        const entries = data || [];
        const supMap = new Map<string, SupplierPurchase>();

        entries.forEach((e: any) => {
          if (e.party_type !== 'supplier') return;
          const id = e.party_id || 'بدون';
          const existing = supMap.get(id) || { supplier_id: e.party_id, supplier_name: 'جاري التحميل...', total: 0, count: 0 };
          existing.total += e.amount || 0;
          existing.count += 1;
          supMap.set(id, existing);
        });

        const supplierIds = [...supMap.keys()].filter((k) => k !== 'بدون');
        if (supplierIds.length > 0) {
          const { data: suppliers } = await supabase.from('suppliers').select('id, name').in('id', supplierIds);
          const nameMap = new Map((suppliers || []).map((s: any) => [s.id, s.name]));
          for (const [key, val] of supMap) {
            if (key !== 'بدون') val.supplier_name = (nameMap.get(key) as string) || 'غير معروف';
          }
        }

        setSupPurchases([...supMap.values()].sort((a, b) => b.total - a.total));
      } catch (err: any) {
        setSupError(err.message || 'حدث خطأ في تحميل التقرير');
        console.error(err);
      } finally {
        setSupLoading(false);
      }
    })();
  }, [expanded.suppliers, dateFrom, dateTo, supabase]);

  const loadSupplierDetail = useCallback(async (supplierId: string) => {
    setSupSelectedId(supplierId);
    setSupDetailLoading(true);
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, date, description, amount, payment_method, notes')
        .eq('party_id', supplierId)
        .eq('entry_type', 'مشتريات')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false });
      if (error) throw error;
      setSupDetail(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSupDetailLoading(false);
    }
  }, [dateFrom, dateTo, supabase]);

  // --- Overhead Report ---
  const [ohLoading, setOhLoading] = useState(false);
  const [ohError, setOhError] = useState('');
  const [ohTotal, setOhTotal] = useState(0);
  const [ohItems, setOhItems] = useState<OverheadRow[]>([]);
  const [ohDescBreakdown, setOhDescBreakdown] = useState<{ description: string; total: number; count: number }[]>([]);

  useEffect(() => {
    if (!expanded.overhead) return;
    setOhLoading(true);
    setOhError('');
    (async () => {
      try {
        const { data, error } = await supabase
          .from('overhead_expenses')
          .select('*')
          .gte('date', dateFrom)
          .lte('date', dateTo)
          .order('date', { ascending: false });
        if (error) throw error;

        const items = (data || []) as OverheadRow[];
        setOhItems(items);

        const total = items.reduce((s, i) => s + (i.amount || 0), 0);
        setOhTotal(total);

        const descMap = new Map<string, { description: string; total: number; count: number }>();
        items.forEach((i) => {
          const key = i.description || 'بدون وصف';
          const existing = descMap.get(key) || { description: key, total: 0, count: 0 };
          existing.total += i.amount || 0;
          existing.count += 1;
          descMap.set(key, existing);
        });
        setOhDescBreakdown([...descMap.values()].sort((a, b) => b.total - a.total));
      } catch (err: any) {
        setOhError(err.message || 'حدث خطأ في تحميل التقرير');
        console.error(err);
      } finally {
        setOhLoading(false);
      }
    })();
  }, [expanded.overhead, dateFrom, dateTo, supabase]);

  // --- Helpers ---
  const exportExcel = (data: any[], fileName: string, headers: string[]) => {
    const rows = data.map((item) => {
      const obj: Record<string, any> = {};
      headers.forEach((h) => { obj[h] = item[h] || ''; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const statusOptions = ['مفتوح', 'قيد التنفيذ', 'مكتمل', 'تم التسليم'];

  // --- Render helpers ---
  const renderEmpty = (msg = 'لا توجد بيانات') => (
    <p className="text-gray-400 text-sm py-6 text-center">{msg}</p>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير</h1>
          <p className="text-sm text-gray-500 mt-1">تقارير شاملة عن المخزون والأوردرات والتدفقات المالية</p>
        </div>

        {/* Date Range Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 space-y-1">
              <label className="block text-sm font-medium text-gray-700">من تاريخ</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-sm font-medium text-gray-700">إلى تاريخ</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* 1. Inventory Report */}
        <ReportCard title={reportMeta.inventory.title} description={reportMeta.inventory.desc} icon={reportMeta.inventory.icon} isExpanded={expanded.inventory} onToggle={() => toggleCard('inventory')} loading={invLoading} error={invError}>
          <div className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">قيمة مخزون الألواح</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(invBoardsValue)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">قيمة مخزون الاكسسوارات</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(invAccessoriesValue)}</p>
              </div>
            </div>
            <div className="bg-gray-900 text-white px-4 py-2 rounded-lg text-center">
              <p className="text-xs opacity-80">إجمالي قيمة المخزون</p>
              <p className="text-xl font-bold">{formatCurrency(invBoardsValue + invAccessoriesValue)}</p>
            </div>

            {/* Supplier Breakdown */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">حسب المورد</h4>
              {invSupplierBreakdown.length === 0 ? renderEmpty() : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">المورد</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">القيمة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invSupplierBreakdown.map((s, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{s.supplier_name}</td>
                          <td className="px-3 py-2 text-gray-700 font-medium">{formatCurrency(s.total_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Material Type Breakdown */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">حسب النوع</h4>
              {invMaterialBreakdown.length === 0 ? renderEmpty() : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">النوع</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">التصنيف</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">القيمة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invMaterialBreakdown.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{m.material_type}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.category === 'board' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {m.category === 'board' ? 'لوح' : 'اكسسوار'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700 font-medium">{formatCurrency(m.total_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const invData = [
                  { البيان: 'قيمة مخزون الألواح', القيمة: invBoardsValue },
                  { البيان: 'قيمة مخزون الاكسسوارات', القيمة: invAccessoriesValue },
                  { البيان: 'الإجمالي', القيمة: invBoardsValue + invAccessoriesValue },
                ];
                exportExcel(invData, 'تقرير_المخزون', ['البيان', 'القيمة']);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              📥 تحميل Excel
            </button>
          </div>
        </ReportCard>

        {/* 2. Orders Report */}
        <ReportCard meta={reportMeta.orders} isExpanded={expanded.orders} onToggle={() => toggleCard('orders')} loading={ordLoading} error={ordError}>
          <div className="space-y-4 pt-3">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={ordStatusFilter}
                onChange={(e) => setOrdStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">كل الحالات</option>
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={ordBranchFilter}
                onChange={(e) => setOrdBranchFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">كل المعارض</option>
                {ordBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Table */}
            {orders.length === 0 ? renderEmpty('لا توجد أوردرات في هذا النطاق') : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الاسم</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">العميل</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المعرض</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الحالة</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">ألواح</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">اكسسوارات</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">تركيب</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">نقل داخلي</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">نقل خارجي</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">عمولة المصنع</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700 font-medium">{o.order_name}</td>
                        <td className="px-3 py-2 text-gray-700">{o.customer_name}</td>
                        <td className="px-3 py-2 text-gray-700">{o.branch_name}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            o.status === 'مكتمل' ? 'bg-green-100 text-green-700' :
                            o.status === 'تم التسليم' ? 'bg-blue-100 text-blue-700' :
                            o.status === 'قيد التنفيذ' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>{o.status}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{formatCurrency(o.boards_cost)}</td>
                        <td className="px-3 py-2 text-gray-700">{formatCurrency(o.accessories_cost)}</td>
                        <td className="px-3 py-2 text-gray-700">{formatCurrency(o.installation_cost)}</td>
                        <td className="px-3 py-2 text-gray-700">{formatCurrency(o.internal_transport_cost)}</td>
                        <td className="px-3 py-2 text-gray-700">{formatCurrency(o.external_transport_cost)}</td>
                        <td className="px-3 py-2 text-gray-700">{formatCurrency(o.factory_commission)}</td>
                        <td className="px-3 py-2 text-gray-900 font-bold">{formatCurrency(o.order_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Summary */}
            {orders.length > 0 && (
              <div className="bg-gray-900 text-white rounded-lg p-4">
                <h4 className="text-xs opacity-80 mb-2">ملخص التكاليف</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="opacity-60 text-xs">إجمالي الألواح</p>
                    <p className="font-bold">{formatCurrency(orders.reduce((s, o) => s + o.boards_cost, 0))}</p>
                  </div>
                  <div>
                    <p className="opacity-60 text-xs">إجمالي الاكسسوارات</p>
                    <p className="font-bold">{formatCurrency(orders.reduce((s, o) => s + o.accessories_cost, 0))}</p>
                  </div>
                  <div>
                    <p className="opacity-60 text-xs">إجمالي التركيب والنقل</p>
                    <p className="font-bold">{formatCurrency(orders.reduce((s, o) => s + o.installation_cost + o.internal_transport_cost + o.external_transport_cost, 0))}</p>
                  </div>
                  <div>
                    <p className="opacity-60 text-xs">إجمالي العمولة</p>
                    <p className="font-bold">{formatCurrency(orders.reduce((s, o) => s + o.factory_commission, 0))}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/20 text-center">
                  <p className="opacity-60 text-xs">الإجمالي الكلي</p>
                  <p className="text-xl font-bold">{formatCurrency(orders.reduce((s, o) => s + o.order_total, 0))}</p>
                </div>
              </div>
            )}

            <button
              onClick={() => exportExcel(orders.map(o => ({
                'اسم الأوردر': o.order_name,
                'العميل': o.customer_name,
                'المعرض': o.branch_name,
                'الحالة': o.status,
                'الألواح': o.boards_cost,
                'الاكسسوارات': o.accessories_cost,
                'التركيب': o.installation_cost,
                'نقل داخلي': o.internal_transport_cost,
                'نقل خارجي': o.external_transport_cost,
                'عمولة المصنع': o.factory_commission,
                'الإجمالي': o.order_total,
              })), 'تقرير_الأوردرات', ['اسم الأوردر', 'العميل', 'المعرض', 'الحالة', 'الألواح', 'الاكسسوارات', 'التركيب', 'نقل داخلي', 'نقل خارجي', 'عمولة المصنع', 'الإجمالي'])}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              📥 تحميل Excel
            </button>
          </div>
        </ReportCard>

        {/* 3. Cash Flow Report */}
        <ReportCard meta={reportMeta.cashflow} isExpanded={expanded.cashflow} onToggle={() => toggleCard('cashflow')} loading={cfLoading} error={cfError}>
          <div className="space-y-4 pt-3">
            {cfIncome === 0 && cfExpenses === 0 ? renderEmpty('لا توجد حركات مالية في هذا النطاق') : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-green-600 mb-1">إيرادات (دفعات واردة)</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(cfIncome)}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-xs text-red-600 mb-1">مصروفات</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(cfExpenses)}</p>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${cfNet >= 0 ? 'bg-blue-50 border border-blue-200' : 'bg-orange-50 border border-orange-200'}`}>
                    <p className={`text-xs mb-1 ${cfNet >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>صافي التدفق النقدي</p>
                    <p className={`text-lg font-bold ${cfNet >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(cfNet)}</p>
                  </div>
                </div>

                {/* Entry Type Breakdown */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">حسب نوع الحركة</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">النوع</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">عدد</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cfBreakdown.map((b, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{b.entry_type}</td>
                            <td className="px-3 py-2 text-gray-700">{b.count}</td>
                            <td className="px-3 py-2 text-gray-700 font-medium">{formatCurrency(b.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Method Breakdown */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">حسب طريقة الدفع</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">طريقة الدفع</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cfPaymentBreakdown.map((p, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{p.payment_method}</td>
                            <td className="px-3 py-2 text-gray-700 font-medium">{formatCurrency(p.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={() => {
                const cfData = [
                  { البيان: 'الإيرادات (دفعات واردة)', القيمة: cfIncome },
                  { البيان: 'المصروفات', القيمة: cfExpenses },
                  { البيان: 'صافي التدفق النقدي', القيمة: cfNet },
                  ...cfBreakdown.map((b) => ({ البيان: `حسب النوع: ${b.entry_type}`, القيمة: b.total })),
                  ...cfPaymentBreakdown.map((p) => ({ البيان: `حسب الدفع: ${p.payment_method}`, القيمة: p.total })),
                ];
                exportExcel(cfData, 'تقرير_اليومية', ['البيان', 'القيمة']);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              📥 تحميل Excel
            </button>
          </div>
        </ReportCard>

        {/* 4. Suppliers Report */}
        <ReportCard meta={reportMeta.suppliers} isExpanded={expanded.suppliers} onToggle={() => toggleCard('suppliers')} loading={supLoading} error={supError}>
          <div className="space-y-4 pt-3">
            {supPurchases.length === 0 ? renderEmpty('لا توجد مشتريات في هذا النطاق') : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">المورد</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">عدد المشتريات</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {supPurchases.map((s, i) => (
                        <tr
                          key={i}
                          onClick={() => loadSupplierDetail(s.supplier_id!)}
                          className="cursor-pointer hover:bg-orange-50/50 transition-colors"
                        >
                          <td className="px-3 py-2.5 text-gray-700 font-medium">{s.supplier_name}</td>
                          <td className="px-3 py-2.5 text-gray-700">{s.count}</td>
                          <td className="px-3 py-2.5 text-gray-700 font-bold">{formatCurrency(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Supplier Detail */}
                {supSelectedId && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-700">تفاصيل المشتريات</h4>
                      <button
                        onClick={() => setSupSelectedId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        إغلاق ✕
                      </button>
                    </div>
                    {supDetailLoading ? <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div> : supDetail.length === 0 ? renderEmpty() : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white border-b border-gray-200">
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">التاريخ</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">الوصف</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">المبلغ</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">طريقة الدفع</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {supDetail.map((d: any) => (
                              <tr key={d.id} className="bg-white hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-700">{new Date(d.date).toLocaleDateString('ar-EG')}</td>
                                <td className="px-3 py-2 text-gray-700">{d.description}</td>
                                <td className="px-3 py-2 text-gray-700 font-medium">{formatCurrency(d.amount)}</td>
                                <td className="px-3 py-2 text-gray-700">{d.payment_method}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => exportExcel(supPurchases.map(s => ({
                    'المورد': s.supplier_name,
                    'عدد المشتريات': s.count,
                    'الإجمالي': s.total,
                  })), 'تقرير_الموردين', ['المورد', 'عدد المشتريات', 'الإجمالي'])}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  📥 تحميل Excel
                </button>
              </>
            )}
          </div>
        </ReportCard>

        {/* 5. Overhead Report */}
        <ReportCard meta={reportMeta.overhead} isExpanded={expanded.overhead} onToggle={() => toggleCard('overhead')} loading={ohLoading} error={ohError}>
          <div className="space-y-4 pt-3">
            {ohItems.length === 0 ? renderEmpty('لا توجد نثريات في هذا النطاق') : (
              <>
                <div className="bg-gray-900 text-white rounded-lg p-4 text-center">
                  <p className="text-xs opacity-80">إجمالي النثريات</p>
                  <p className="text-xl font-bold">{formatCurrency(ohTotal)}</p>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">حسب الوصف</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">الوصف</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">عدد</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ohDescBreakdown.map((d, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{d.description}</td>
                            <td className="px-3 py-2 text-gray-700">{d.count}</td>
                            <td className="px-3 py-2 text-gray-700 font-medium">{formatCurrency(d.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-2">جميع النثريات</h4>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b border-gray-200">
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">التاريخ</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">الوصف</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">المبلغ</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ohItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{new Date(item.date).toLocaleDateString('ar-EG')}</td>
                            <td className="px-3 py-2 text-gray-700">{item.description}</td>
                            <td className="px-3 py-2 text-gray-700 font-medium">{formatCurrency(item.amount)}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{item.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button
                  onClick={() => exportExcel(ohItems.map(i => ({
                    'التاريخ': new Date(i.date).toLocaleDateString('ar-EG'),
                    'الوصف': i.description,
                    'المبلغ': i.amount,
                    'ملاحظات': i.notes || '',
                  })), 'تقرير_النثريات', ['التاريخ', 'الوصف', 'المبلغ', 'ملاحظات'])}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  📥 تحميل Excel
                </button>
              </>
            )}
          </div>
        </ReportCard>
      </div>
    </DashboardLayout>
  );
}

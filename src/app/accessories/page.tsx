'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DataTable from '@/components/ui/DataTable';
import * as XLSX from 'xlsx';
import type { AccessoriesInventory, Supplier, AccessoryType, Order } from '@/types';

interface AccessoryWithSupplier extends AccessoriesInventory {
  supplier?: Supplier;
}

export default function AccessoriesPage() {
  const [items, setItems] = useState<AccessoryWithSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accessoryTypes, setAccessoryTypes] = useState<AccessoryType[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        const [{ data: itemsData }, { data: supData }, { data: typeData }] = await Promise.all([
          supabase
            .from('accessories_inventory')
            .select('*, supplier:suppliers(*)')
            .order('created_at', { ascending: false }),
          supabase.from('suppliers').select('*').order('name'),
          supabase.from('accessory_types').select('*').order('name'),
        ]);
        setItems((itemsData as AccessoryWithSupplier[]) || []);
        setSuppliers((supData as Supplier[]) || []);
        setAccessoryTypes((typeData as AccessoryType[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.item_name.toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q)
      );
    }
    if (filterSupplier) result = result.filter((i) => i.supplier_id === filterSupplier);
    if (filterType) result = result.filter((i) => i.accessory_type === filterType);
    if (dateFrom) result = result.filter((i) => i.date_added >= dateFrom);
    if (dateTo) result = result.filter((i) => i.date_added <= dateTo);
    if (availableOnly) result = result.filter((i) => i.quantity_remaining > 0);
    return result;
  }, [items, searchQuery, filterSupplier, filterType, dateFrom, dateTo, availableOnly]);

  const formatCurrency = (val: number) => `${val.toLocaleString('ar-EG')} ج.م`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-EG');

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet);

      for (const row of rows) {
        const item_name = row['البيان'] || row['item_name'] || '';
        const accessory_type = row['النوع'] || row['accessory_type'] || '';
        const code = row['الكود'] || row['code'] || '';
        const supplierName = row['الشركة'] || row['supplier'] || '';
        const unit_price = parseFloat(row['السعر'] || row['unit_price'] || '0');
        const quantity_in = parseInt(row['العدد'] || row['quantity_in'] || '0', 10);
        const date_added = row['التاريخ'] || row['date_added'] || new Date().toISOString().split('T')[0];
        const notes = row['ملاحظات'] || row['notes'] || '';

        let supplier_id: string | null = null;
        if (supplierName) {
          const match = suppliers.find(
            (s) => s.name.toLowerCase() === supplierName.toLowerCase()
          );
          if (match) supplier_id = match.id;
        }

        const total_price = unit_price * quantity_in;
        const quantity_remaining = quantity_in;

        await supabase.from('accessories_inventory').insert({
          item_name,
          accessory_type,
          code,
          supplier_id,
          unit_price,
          quantity_in,
          total_price,
          quantity_remaining,
          date_added,
          notes,
        });
      }

      const { data: fresh } = await supabase
        .from('accessories_inventory')
        .select('*, supplier:suppliers(*)')
        .order('created_at', { ascending: false });
      setItems((fresh as AccessoryWithSupplier[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const columns = [
    {
      key: 'index',
      label: 'ت',
      render: (_: any, i?: number) => String((i ?? 0) + 1),
    },
    { key: 'item_name', label: 'البيان' },
    { key: 'accessory_type', label: 'النوع' },
    { key: 'code', label: 'الكود' },
    {
      key: 'supplier',
      label: 'الشركة',
      render: (item: AccessoryWithSupplier) => item.supplier?.name || '-',
    },
    {
      key: 'unit_price',
      label: 'السعر',
      render: (item: AccessoryWithSupplier) => formatCurrency(item.unit_price),
    },
    { key: 'quantity_in', label: 'العدد' },
    {
      key: 'total_price',
      label: 'الإجمالي',
      render: (item: AccessoryWithSupplier) => formatCurrency(item.total_price),
    },
    { key: 'quantity_used', label: 'تم استخدام' },
    { key: 'quantity_remaining', label: 'المتبقي' },
    {
      key: 'date_added',
      label: 'التاريخ',
      render: (item: AccessoryWithSupplier) => formatDate(item.date_added),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">مخزون الاكسسوارات</h1>
            <p className="text-sm text-gray-500 mt-1">إدارة مخزون الاكسسوارات والخامات</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          excelFileName="مخزون_الاكسسوارات"
          filters={
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
              >
                <option value="">كل الشركات</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
              >
                <option value="">كل الأنواع</option>
                {accessoryTypes.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                placeholder="من تاريخ"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                placeholder="إلى تاريخ"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                متوفر فقط
              </label>
            </div>
          }
          actions={
            <div className="flex gap-2">
              <Link
                href="/accessories/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                ➕ إضافة صنف جديد
              </Link>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {importing ? 'جاري الاستيراد...' : '📥 استيراد Excel'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          }
          onRowClick={(item) => router.push(`/accessories/${item.id}`)}
        />
      </div>
    </DashboardLayout>
  );
}

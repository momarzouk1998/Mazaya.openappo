'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function AdminMaterialTypesPage() {
  const [matLoading, setMatLoading] = useState(true);
  const [matError, setMatError] = useState('');
  const [materialTypes, setMaterialTypes] = useState<{ id: string; name: string }[]>([]);
  const [newMaterial, setNewMaterial] = useState('');
  const [addingMaterial, setAddingMaterial] = useState(false);

  const [accLoading, setAccLoading] = useState(true);
  const [accError, setAccError] = useState('');
  const [accessoryTypes, setAccessoryTypes] = useState<{ id: string; name: string }[]>([]);
  const [newAccessory, setNewAccessory] = useState('');
  const [addingAccessory, setAddingAccessory] = useState(false);

  const supabase = createClient();

  // --- Material Types ---
  const loadMaterialTypes = async () => {
    setMatLoading(true);
    setMatError('');
    try {
      const { data, error } = await supabase.from('material_types').select('*').order('name');
      if (error) throw error;
      setMaterialTypes(data || []);
    } catch (err: any) {
      setMatError(err.message || 'فشل تحميل أنواع الخامات');
      console.error(err);
    } finally {
      setMatLoading(false);
    }
  };

  const addMaterialType = async () => {
    const name = newMaterial.trim();
    if (!name) return;
    setAddingMaterial(true);
    try {
      const { error } = await supabase.from('material_types').insert({ name });
      if (error) throw error;
      setNewMaterial('');
      await loadMaterialTypes();
    } catch (err: any) {
      alert('فشل الإضافة: ' + (err.message || ''));
      console.error(err);
    } finally {
      setAddingMaterial(false);
    }
  };

  const deleteMaterialType = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا النوع؟')) return;
    try {
      const { error } = await supabase.from('material_types').delete().eq('id', id);
      if (error) throw error;
      setMaterialTypes((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert('فشل الحذف: ' + (err.message || ''));
      console.error(err);
    }
  };

  // --- Accessory Types ---
  const loadAccessoryTypes = async () => {
    setAccLoading(true);
    setAccError('');
    try {
      const { data, error } = await supabase.from('accessory_types').select('*').order('name');
      if (error) throw error;
      setAccessoryTypes(data || []);
    } catch (err: any) {
      setAccError(err.message || 'فشل تحميل أنواع الاكسسوارات');
      console.error(err);
    } finally {
      setAccLoading(false);
    }
  };

  const addAccessoryType = async () => {
    const name = newAccessory.trim();
    if (!name) return;
    setAddingAccessory(true);
    try {
      const { error } = await supabase.from('accessory_types').insert({ name });
      if (error) throw error;
      setNewAccessory('');
      await loadAccessoryTypes();
    } catch (err: any) {
      alert('فشل الإضافة: ' + (err.message || ''));
      console.error(err);
    } finally {
      setAddingAccessory(false);
    }
  };

  const deleteAccessoryType = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا النوع؟')) return;
    try {
      const { error } = await supabase.from('accessory_types').delete().eq('id', id);
      if (error) throw error;
      setAccessoryTypes((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert('فشل الحذف: ' + (err.message || ''));
      console.error(err);
    }
  };

  useEffect(() => {
    loadMaterialTypes();
    loadAccessoryTypes();
  }, [supabase]);

  const SectionCard = ({
    title,
    icon,
    loading,
    error,
    items,
    newValue,
    onNewValueChange,
    onAdd,
    adding,
    onDelete,
    placeholder,
  }: {
    title: string;
    icon: string;
    loading: boolean;
    error: string;
    items: { id: string; name: string }[];
    newValue: string;
    onNewValueChange: (v: string) => void;
    onAdd: () => void;
    adding: boolean;
    onDelete: (id: string) => void;
    placeholder: string;
  }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
        </div>
      </div>

      {/* Add Form */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={newValue}
            onChange={(e) => onNewValueChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
          />
          <button
            onClick={onAdd}
            disabled={adding || !newValue.trim()}
            className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {adding ? 'جاري...' : '➕ إضافة'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="px-5 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        ) : items.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center">لا توجد عناصر</p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <span className="text-sm text-gray-700">{item.name}</span>
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="حذف"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الأنواع</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة أنواع الخامات والاكسسوارات المستخدمة في المصنع</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Material Types */}
          <SectionCard
            title="أنواع الخامات"
            icon="📋"
            loading={matLoading}
            error={matError}
            items={materialTypes}
            newValue={newMaterial}
            onNewValueChange={setNewMaterial}
            onAdd={addMaterialType}
            adding={addingMaterial}
            onDelete={deleteMaterialType}
            placeholder="اسم الخامة الجديدة..."
          />

          {/* Accessory Types */}
          <SectionCard
            title="أنواع الاكسسوارات"
            icon="🔩"
            loading={accLoading}
            error={accError}
            items={accessoryTypes}
            newValue={newAccessory}
            onNewValueChange={setNewAccessory}
            onAdd={addAccessoryType}
            adding={addingAccessory}
            onDelete={deleteAccessoryType}
            placeholder="اسم الاكسسوار الجديد..."
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

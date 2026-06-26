'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface AdminPermissions {
  perm_dashboard: boolean;
  perm_orders: boolean;
  perm_journal: boolean;
  perm_reports: boolean;
  perm_inventory: boolean;
  perm_suppliers: boolean;
  perm_customers: boolean;
  perm_branches: boolean;
  perm_contractors: boolean;
  perm_overhead: boolean;
  perm_admin_users: boolean;
  perm_material_types: boolean;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: string;
  branch_id: string | null;
  branch_name: string;
  created_at: string;
  permissions: AdminPermissions | null;
}

interface Branch {
  id: string;
  name: string;
}

const PERMS_CONFIG: { key: keyof AdminPermissions; label: string; icon: string }[] = [
  { key: 'perm_dashboard', label: 'لوحة التحكم', icon: '📊' },
  { key: 'perm_orders', label: 'الأوردرات', icon: '📦' },
  { key: 'perm_journal', label: 'اليومية', icon: '💰' },
  { key: 'perm_reports', label: 'التقارير', icon: '📈' },
  { key: 'perm_inventory', label: 'المخزون', icon: '📋' },
  { key: 'perm_suppliers', label: 'الموردين', icon: '🏭' },
  { key: 'perm_customers', label: 'العملاء', icon: '👥' },
  { key: 'perm_branches', label: 'المعارض', icon: '🏪' },
  { key: 'perm_contractors', label: 'المقاولين', icon: '🔨' },
  { key: 'perm_overhead', label: 'النثريات', icon: '📄' },
  { key: 'perm_admin_users', label: 'المستخدمين', icon: '⚙️' },
  { key: 'perm_material_types', label: 'الأنواع', icon: '🏷️' },
];

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  const supabase = createClient();

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [profilesRes, branchesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('branches').select('id, name').order('name'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (branchesRes.error) throw branchesRes.error;

      const branchMap = new Map((branchesRes.data || []).map((b: Branch) => [b.id, b.name]));
      setBranches(branchesRes.data || []);

      const userIds = (profilesRes.data || []).map((p: any) => p.id);
      let permsMap = new Map<string, AdminPermissions>();

      if (userIds.length > 0) {
        const permsRes = await supabase
          .from('admin_permissions')
          .select('*')
          .in('user_id', userIds);
        if (!permsRes.error) {
          (permsRes.data || []).forEach((p: any) => {
            permsMap.set(p.user_id, {
              perm_dashboard: p.perm_dashboard,
              perm_orders: p.perm_orders,
              perm_journal: p.perm_journal,
              perm_reports: p.perm_reports,
              perm_inventory: p.perm_inventory,
              perm_suppliers: p.perm_suppliers,
              perm_customers: p.perm_customers,
              perm_branches: p.perm_branches,
              perm_contractors: p.perm_contractors,
              perm_overhead: p.perm_overhead,
              perm_admin_users: p.perm_admin_users,
              perm_material_types: p.perm_material_types,
            });
          });
        }
      }

      const rows: ProfileRow[] = (profilesRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name || '',
        email: p.email || '',
        role: p.role || 'branch',
        branch_id: p.branch_id,
        branch_name: branchMap.get(p.branch_id) || '-',
        created_at: p.created_at,
        permissions: permsMap.get(p.id) || null,
      }));

      setProfiles(rows);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في تحميل المستخدمين');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdating(userId);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      setProfiles((prev) => prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p)));
    } catch (err: any) {
      alert('فشل تغيير الدور: ' + (err.message || ''));
    } finally {
      setUpdating(null);
    }
  };

  const handleBranchChange = async (userId: string, branchId: string) => {
    setUpdating(userId);
    try {
      const newBranchId = branchId || null;
      const { error } = await supabase.from('profiles').update({ branch_id: newBranchId }).eq('id', userId);
      if (error) throw error;
      const branchName = branchId ? (branches.find((b) => b.id === branchId)?.name || '-') : '-';
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, branch_id: newBranchId, branch_name: branchName } : p))
      );
    } catch (err: any) {
      alert('فشل تغيير المعرض: ' + (err.message || ''));
    } finally {
      setUpdating(null);
    }
  };

  const togglePermission = async (userId: string, permKey: keyof AdminPermissions) => {
    setUpdating(userId);
    try {
      const profile = profiles.find((p) => p.id === userId);
      const currentVal = profile?.permissions?.[permKey] ?? true;
      const newVal = !currentVal;

      const { error } = await supabase
        .from('admin_permissions')
        .upsert({ user_id: userId, [permKey]: newVal }, { onConflict: 'user_id' });

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id !== userId) return p;
          const perms = p.permissions ? { ...p.permissions, [permKey]: newVal } : null;
          return { ...p, permissions: perms };
        })
      );
    } catch (err: any) {
      alert('فشل تحديث الصلاحية: ' + (err.message || ''));
    } finally {
      setUpdating(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password) {
      setAddError('جميع الحقول مطلوبة');
      return;
    }

    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addForm.email, password: addForm.password, name: addForm.name, role: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'حدث خطأ');
      } else {
        setAddSuccess(`تم إنشاء المستخدم ${addForm.name} بنجاح`);
        setAddForm({ name: '', email: '', password: '' });
        loadData();
      }
    } catch {
      setAddError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة المستخدمين</h1>
            <p className="text-sm text-gray-500 mt-1">عرض وتعديل صلاحيات المستخدمين</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
          >
            ➕ إضافة مستخدم
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-400">لا يوجد مستخدمين</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">الاسم</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">البريد</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">الدور</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">المعرض</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">الصلاحيات</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600">تاريخ التسجيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{profile.name}</td>
                      <td className="px-4 py-3 text-gray-600 dir-ltr text-left whitespace-nowrap" dir="ltr">{profile.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={profile.role}
                          onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                          disabled={updating === profile.id}
                          className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white disabled:opacity-50"
                        >
                          <option value="admin">مدير</option>
                          <option value="branch">معرض</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {profile.role === 'branch' ? (
                          <select
                            value={profile.branch_id || ''}
                            onChange={(e) => handleBranchChange(profile.id, e.target.value)}
                            disabled={updating === profile.id}
                            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white disabled:opacity-50 min-w-[120px]"
                          >
                            <option value="">-- بدون --</option>
                            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {profile.role === 'admin' ? (
                          <div className="flex flex-wrap gap-1.5 min-w-[300px]">
                            {PERMS_CONFIG.map((perm) => {
                              const checked = profile.permissions?.[perm.key] ?? true;
                              return (
                                <button
                                  key={perm.key}
                                  onClick={() => togglePermission(profile.id, perm.key)}
                                  disabled={updating === profile.id}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
                                    checked
                                      ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                                  } disabled:opacity-50`}
                                >
                                  <span>{perm.icon}</span>
                                  <span>{perm.label}</span>
                                  <span className={`text-xs ${checked ? 'text-green-500' : 'text-gray-300'}`}>
                                    {checked ? '✓' : '✕'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(profile.created_at).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">إضافة مستخدم جديد</h2>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم</label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="الاسم كاملاً"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    placeholder="email@example.com"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
                  <input
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>

                {addError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{addError}</div>
                )}
                {addSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{addSuccess}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {addLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {addLoading ? 'جاري الإنشاء...' : 'إنشاء مستخدم'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setAddError(''); setAddSuccess(''); }}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

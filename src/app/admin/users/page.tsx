"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { ALL_MODULES, ALL_PERMISSION_ACTIONS, PERMISSION_ACTION_ICONS, PERMISSION_ACTION_LABELS } from "@/lib/auth";

interface UserRow {
  id: number; auth_id: string | null; username: string;
  // The admin user-list API returns the contact (email/phone) under
  // `full_name` (legacy schema) — accept both names for forward-compat.
  email_or_phone?: string | null; full_name?: string | null;
  role: string; branch_id: number | null; branch_name?: string;
  visible_modules: string[]; permissions: Record<string, string[]>;
  is_active: boolean; notes: string | null;
}

// Detect whether the value is an email (contains @ and a dot) or a phone number.
// Phones are stored as digits (e.g. 01001234567) and the auth layer appends @mazaya.local.
// IMPORTANT: the value comes from the `full_name` column in the DB (legacy schema),
// so we must never trust it to be non-null without a guard.
function detectContactType(value: string | null | undefined): { type: 'email' | 'phone' | 'unknown'; icon: string; label: string } {
  const v = (value ?? '').toString().trim();
  if (!v) return { type: 'unknown', icon: '❔', label: 'غير محدد' };
  // Email: must contain @ AND a dot after the @, with no whitespace.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return { type: 'email', icon: '📧', label: 'إيميل' };
  }
  // Phone: keep only digits. Egyptian mobile is 11 digits (010/011/012/015),
  // international is up to 15 per E.164. We accept 7-15 digits to be safe.
  const digitsOnly = v.replace(/[^\d]/g, '');
  if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    return { type: 'phone', icon: '📱', label: 'رقم هاتف' };
  }
  return { type: 'unknown', icon: '❔', label: 'غير محدد' };
}

export default function UsersPage() {
  const router = useRouter();
  const { user: profile } = useUserStore();
  const { data: usersData, loading, refetch } = useApi<{ items: any[] }>('/api/admin/users?limit=500');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  useEffect(() => {
    if (usersData?.items) setUsers(usersData.items as UserRow[]);
  }, [usersData]);

  async function toggleModule(u: UserRow, modKey: string) {
    // The "view" axis now doubles as the module-visibility toggle:
    //   turning view ON  → module becomes visible (+ view permission)
    //   turning view OFF → module hidden + all permissions cleared
    const isVisible = u.visible_modules.includes(modKey);
    const newMods = isVisible
      ? u.visible_modules.filter(m => m !== modKey)
      : [...u.visible_modules, modKey];
    const newPerms = { ...u.permissions };
    if (!isVisible) {
      // enabling → grant view
      newPerms[modKey] = ["view"];
    } else {
      // disabling → drop module + its permissions
      delete newPerms[modKey];
    }
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible_modules: newMods, permissions: newPerms }),
    });
    setUsers(s => s.map(x => x.id === u.id ? { ...x, visible_modules: newMods, permissions: newPerms } : x));
  }

  async function togglePermission(u: UserRow, modKey: string, action: string) {
    // "view" is handled by toggleModule (it's the module-visibility switch).
    // add/edit/delete require the module to be visible (view on).
    if (action === "view") {
      toggleModule(u, modKey);
      return;
    }
    const perms = { ...u.permissions };
    const modulePerms = [...(perms[modKey] || [])];
    if (modulePerms.includes(action)) {
      const idx = modulePerms.indexOf(action);
      modulePerms.splice(idx, 1);
    } else {
      modulePerms.push(action);
      perms[modKey] = [...new Set(modulePerms)];
    }
    // keep view always present when module is visible
    if (!modulePerms.includes("view")) modulePerms.unshift("view");
    perms[modKey] = modulePerms;
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: perms }),
    });
    setUsers(s => s.map(x => x.id === u.id ? { ...x, permissions: perms } : x));
  }
  async function toggleActive(u: UserRow) {
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !u.is_active }),
    });
    setUsers(s => s.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function deleteUser(u: UserRow) {
    if (!confirm(`حذف "${u.username}"؟ لا يمكن التراجع.`)) return;
    await fetch(`/api/admin/users/${u.id}`, {
      method: "DELETE",
    });
    setUsers(s => s.filter(x => x.id !== u.id));
  }

  if (!profile) return null;
  const totalActive = users.filter(u => u.is_active).length;
  const branchCount = users.filter(u => u.role === "branch_user" && u.is_active).length;
  const adminCount = users.filter(u => u.role === "admin" && u.is_active).length;
  const disabledCount = users.filter(u => !u.is_active).length;

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="إدارة الموظفين"
        subtitle={`${users.length} موظف`}
        helpTitle="إدارة المستخدمين"
        helpDescription="من هنا تقدر تضيف موظفين جداد أو تعدل بيانات الموجودين، وتتحكم في الصفحات اللي يشوفها كل موظف من الـ Checkboxes، وتعطل حساب أو تريست الباسورد. كل موظف بيشوف بس الصفحات اللي مفعّلها."
        backHref="/journal"
        actions={<Button onClick={() => setShowAdd(true)}>+ إضافة موظف جديد</Button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="إجمالي الموظفين" value={users.length} icon="👥" />
        <StatCard label="الموظفون" value={branchCount} icon="👤" />
        <StatCard label="المدراء" value={adminCount} icon="👑" />
        <StatCard label="معطلة" value={disabledCount} icon="🔒" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-3 text-right font-semibold text-xs uppercase sticky right-0 bg-gray-50 z-10">الموظف</th>
              <th className="px-3 py-3 text-right font-semibold text-xs uppercase">الإيميل / الرقم</th>
              <th className="px-3 py-3 text-center font-semibold text-xs uppercase">الدور</th>
              {ALL_MODULES.map(m => (
                <th key={m.key} className="px-1 py-2 text-center font-semibold text-xs uppercase" title={m.label}>
                  <div className="text-lg">{m.icon}</div>
                  <div className="hidden lg:block text-[10px]">{m.label}</div>
                  <div className="flex justify-center gap-1 mt-1 text-[9px] text-gray-400">
                    {ALL_PERMISSION_ACTIONS.map(a => (
                      <span key={a} title={PERMISSION_ACTION_LABELS[a]}>{PERMISSION_ACTION_ICONS[a]}</span>
                    ))}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-center font-semibold text-xs uppercase">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={ALL_MODULES.length + 4} className="text-center py-8">جاري التحميل...</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={!u.is_active ? "bg-gray-50 opacity-60" : "hover:bg-gray-50"}>
                <td className="px-3 py-3 sticky right-0 bg-white align-middle">
                  <div className="font-semibold text-brand-black">{u.username}</div>
                  {u.branch_name && <div className="mt-1"><span className="badge bg-gray-100 text-gray-700">🏪 {u.branch_name}</span></div>}
                  {!u.is_active && <div className="mt-1"><span className="badge bg-red-100 text-red-800">معطل</span></div>}
                </td>
                <td className="px-3 py-3 align-middle" dir="ltr">
                  {(() => {
                    // The DB column is `full_name` (legacy schema stores the
                    // email/phone in this field). The admin user-list API
                    // returns it as `full_name`, not `email_or_phone`.
                    const raw = (u as any).email_or_phone ?? (u as any).full_name ?? '';
                    const c = detectContactType(raw);
                    return (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium ${c.type === 'email' ? 'bg-blue-50 text-blue-700' : c.type === 'phone' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`} title={c.label}>
                          <span>{c.icon}</span>
                          <span>{c.label}</span>
                        </span>
                        <span className="text-gray-800 truncate max-w-[220px]" dir="ltr">{raw || '—'}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-brand-orange-light text-brand-orange-dark border border-brand-orange/20" : "bg-gray-100 text-brand-black border border-gray-200"}`}>
                    <span>{u.role === "admin" ? "👑" : "👤"}</span>
                    <span>{u.role === "admin" ? "مدير المصنع" : "موظف"}</span>
                  </span>
                </td>
                {ALL_MODULES.map(m => {
                  const hasModule = u.visible_modules.includes(m.key);
                  const perms = u.permissions?.[m.key] || [];
                  return (
                    <td key={m.key} className={`px-1 py-1 text-center ${!hasModule ? "opacity-50" : ""}`}>
                      <div className="flex flex-col items-center gap-0.5">
                        {ALL_PERMISSION_ACTIONS.map(action => {
                          const isActive = action === 'view' ? hasModule : (hasModule && perms.includes(action));
                          const styles: Record<string, string> = {
                            view: 'bg-blue-500 text-white border-blue-600',
                            add: 'bg-emerald-500 text-white border-emerald-600',
                            edit: 'bg-yellow-500 text-white border-yellow-600',
                            delete: 'bg-red-500 text-white border-red-600',
                          };
                          return (
                            <button
                              key={action}
                              onClick={() => togglePermission(u, m.key, action)}
                              className={`w-7 h-6 rounded text-[11px] transition border ${isActive ? styles[action] : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"}`}
                              title={`${PERMISSION_ACTION_LABELS[action]} — ${m.label}`}
                            >{PERMISSION_ACTION_ICONS[action]}</button>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setEditing(u)} className="p-1.5 hover:bg-blue-100 rounded" title="تعديل">✏️</button>
                    <button onClick={() => toggleActive(u)} className="p-1.5 hover:bg-yellow-100 rounded" title={u.is_active ? "تعطيل" : "تفعيل"}>{u.is_active ? "🔒" : "🔓"}</button>
                    {u.id !== profile.id && (
                      <button onClick={() => deleteUser(u)} className="p-1.5 hover:bg-red-100 rounded" title="حذف">🗑️</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); refetch(); }} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); refetch(); }} />}
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="card bg-white border-r-4 border-brand-orange p-4 flex flex-col justify-between">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-extrabold text-brand-black">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    username: "", email_or_phone: "", password: "",
    role: "branch_user", branch_id: "",
    visible_modules: ["journal", "orders"] as string[],
    permissions: {} as Record<string, string[]>,
    is_active: true, notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMod(k: string) {
    setForm(f => {
      const hasMod = f.visible_modules.includes(k);
      const newMods = hasMod ? f.visible_modules.filter(x => x !== k) : [...f.visible_modules, k];
      const newPerms = { ...f.permissions };
      if (!hasMod) {
        newPerms[k] = ["view"];
      } else {
        delete newPerms[k];
      }
      return { ...f, visible_modules: newMods, permissions: newPerms };
    });
  }

  function togglePerm(k: string, action: string) {
    // "view" toggles the module visibility (handled by toggleMod).
    if (action === "view") {
      toggleMod(k);
      return;
    }
    setForm(f => {
      // add/edit/delete require the module to be visible
      if (!f.visible_modules.includes(k)) return f;
      const perms = { ...f.permissions };
      const modPerms = [...(perms[k] || ["view"])];
      const idx = modPerms.indexOf(action);
      if (idx >= 0) modPerms.splice(idx, 1);
      else modPerms.push(action);
      // keep "view" always present when module is visible
      if (!modPerms.includes("view")) modPerms.unshift("view");
      perms[k] = [...new Set(modPerms)];
      return { ...f, permissions: perms };
    });
  }

  async function submit() {
    setError(null);
    if (!form.username || !form.email_or_phone || !form.password) { setError("املأ الحقول المطلوبة"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/create-user", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, full_name: form.email_or_phone, branch_id: form.branch_id ? Number(form.branch_id) : null }),
    });
    setSaving(false);
    const j = await res.json();
    if (!res.ok) { setError(j.error); return; }
    onSuccess();
  }

  return (
    <ModalShell title="إضافة موظف جديد" onClose={onClose}>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <Input label="اسم المستخدم *" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        <Input label="البريد أو الهاتف *" value={form.email_or_phone} onChange={e => setForm({ ...form, email_or_phone: e.target.value })} hint="لو رقم هاتف، بيتسجل كـ @mazaya.local في Auth" />
        <Input label="كلمة السر *" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <Select label="الدور" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} options={[{ value: "admin", label: "مدير المصنع (يشوف كل حاجة)" }, { value: "branch_user", label: "موظف (حسب الصلاحيات)" }]} />
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">الصفحات والصلاحيات</label>
            <div className="flex gap-1">
              <button onClick={() => setForm(f => ({ ...f, visible_modules: ALL_MODULES.map(m => m.key), permissions: Object.fromEntries(ALL_MODULES.map(m => [m.key, ["view"]])) }))} className="text-xs px-2 py-1 border rounded hover:bg-gray-100">تحديد الكل</button>
              <button onClick={() => setForm(f => ({ ...f, visible_modules: [], permissions: {} }))} className="text-xs px-2 py-1 border rounded hover:bg-gray-100">إلغاء الكل</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_MODULES.map(m => {
              const hasMod = form.visible_modules.includes(m.key);
              const perms = form.permissions[m.key] || [];
              return (
                <div key={m.key} className={`p-2 border rounded-lg ${hasMod ? "bg-green-50 border-green-300" : "border-gray-200"}`}>
                  <div className="text-sm font-medium mb-1.5">{m.icon} {m.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_PERMISSION_ACTIONS.map(action => {
                      const isActive = action === 'view' ? hasMod : (hasMod && perms.includes(action));
                      const styles: Record<string, string> = {
                        view: 'bg-blue-500 text-white border-blue-600',
                        add: 'bg-emerald-500 text-white border-emerald-600',
                        edit: 'bg-yellow-500 text-white border-yellow-600',
                        delete: 'bg-red-500 text-white border-red-600',
                      };
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => togglePerm(m.key, action)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition ${isActive ? styles[action] : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"}`}
                        >{PERMISSION_ACTION_ICONS[action]} {PERMISSION_ACTION_LABELS[action]}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-orange" /><span className="text-sm">الحساب مفعّل</span></label>
        {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={submit} loading={saving}>حفظ</Button>
      </div>
    </ModalShell>
  );
}

function EditUserModal({ user, onClose, onSuccess }: { user: UserRow; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    username: user.username, email_or_phone: user.email_or_phone,
    role: user.role, branch_id: user.branch_id ? String(user.branch_id) : "",
    visible_modules: user.visible_modules,
    permissions: user.permissions || {},
    is_active: user.is_active, notes: user.notes ?? "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMod(k: string) {
    setForm(f => {
      const hasMod = f.visible_modules.includes(k);
      const newMods = hasMod ? f.visible_modules.filter(x => x !== k) : [...f.visible_modules, k];
      const newPerms = { ...f.permissions };
      if (!hasMod) {
        newPerms[k] = ["view"];
      } else {
        delete newPerms[k];
      }
      return { ...f, visible_modules: newMods, permissions: newPerms };
    });
  }

  function togglePerm(k: string, action: string) {
    // "view" toggles the module visibility (handled by toggleMod).
    if (action === "view") {
      toggleMod(k);
      return;
    }
    setForm(f => {
      // add/edit/delete require the module to be visible
      if (!f.visible_modules.includes(k)) return f;
      const perms = { ...f.permissions };
      const modPerms = [...(perms[k] || ["view"])];
      const idx = modPerms.indexOf(action);
      if (idx >= 0) modPerms.splice(idx, 1);
      else modPerms.push(action);
      // keep "view" always present when module is visible
      if (!modPerms.includes("view")) modPerms.unshift("view");
      perms[k] = [...new Set(modPerms)];
      return { ...f, permissions: perms };
    });
  }

  async function submit() {
    setError(null); setSaving(true);
    const payload: any = { full_name: form.email_or_phone, ...form };
    delete payload.email_or_phone;
    delete payload.username;
    if (!form.password) delete payload.password;
    payload.branch_id = form.branch_id ? Number(form.branch_id) : null;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    const j = await res.json();
    if (!res.ok) { setError(j.error); return; }
    onSuccess();
  }

  return (
    <ModalShell title={`تعديل: ${user.username}`} onClose={onClose}>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <Input label="اسم المستخدم" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        <Input label="البريد/الهاتف" value={form.email_or_phone} onChange={e => setForm({ ...form, email_or_phone: e.target.value })} />
        <Input label="كلمة سر جديدة (اتركها فارغة لو مش عايز تغير)" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <Select label="الدور" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} options={[{ value: "admin", label: "مدير" }, { value: "branch_user", label: "موظف" }]} />
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">الصفحات المرئية والصلاحيات</label>
            <div className="flex gap-1">
              <button onClick={() => setForm(f => ({ ...f, visible_modules: ALL_MODULES.map(m => m.key), permissions: Object.fromEntries(ALL_MODULES.map(m => [m.key, ["view"]])) }))} className="text-xs px-2 py-1 border rounded hover:bg-gray-100">تحديد الكل</button>
              <button onClick={() => setForm(f => ({ ...f, visible_modules: [], permissions: {} }))} className="text-xs px-2 py-1 border rounded hover:bg-gray-100">إلغاء الكل</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_MODULES.map(m => {
              const hasMod = form.visible_modules.includes(m.key);
              const perms = form.permissions[m.key] || [];
              return (
                <div key={m.key} className={`p-2 border rounded-lg ${hasMod ? "bg-green-50 border-green-300" : "border-gray-200"}`}>
                  <div className="text-sm font-medium mb-1.5">{m.icon} {m.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_PERMISSION_ACTIONS.map(action => {
                      const isActive = action === 'view' ? hasMod : (hasMod && perms.includes(action));
                      const styles: Record<string, string> = {
                        view: 'bg-blue-500 text-white border-blue-600',
                        add: 'bg-emerald-500 text-white border-emerald-600',
                        edit: 'bg-yellow-500 text-white border-yellow-600',
                        delete: 'bg-red-500 text-white border-red-600',
                      };
                      return (
                        <button
                          key={action}
                          type="button"
                          onClick={() => togglePerm(m.key, action)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition ${isActive ? styles[action] : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"}`}
                        >{PERMISSION_ACTION_ICONS[action]} {PERMISSION_ACTION_LABELS[action]}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-orange" /><span className="text-sm">مفعّل</span></label>
        {error && <div className="bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
      </div>
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button onClick={submit} loading={saving}>حفظ</Button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

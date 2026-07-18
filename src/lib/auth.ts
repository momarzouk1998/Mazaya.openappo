// Types + Constants + Client-safe helpers (NO server imports here)
// Server-only functions (getCurrentUser/requireAdmin/hasPermission) in auth-server.ts

export interface CurrentProfile {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'branch_user';
  branch_id: string | null;
  visible_modules: string[];
  permissions: Record<string, string[]>;
  is_active: boolean;
}

export const ALL_MODULES = [
  { key: 'journal', label: 'اليومية', icon: '💰', path: '/journal' },
  { key: 'factory_wallet', label: 'محفظة المصنع', icon: '👛', path: '/factory-wallet' },
  { key: 'budget', label: 'الميزانية', icon: '📊', path: '/budget' },
  { key: 'orders', label: 'الأوردرات', icon: '📦', path: '/orders' },
  { key: 'suppliers', label: 'الموردين', icon: '🏭', path: '/suppliers' },
  { key: 'boards_inventory', label: 'مخزون الألواح', icon: '📋', path: '/boards' },
  { key: 'accessories_inventory', label: 'مخزون الاكسسوارات', icon: '🔩', path: '/accessories' },
  { key: 'branches', label: 'المعارض', icon: '🏪', path: '/branches' },
  { key: 'customers', label: 'العملاء', icon: '👥', path: '/customers' },
  { key: 'payments', label: 'مدفوعات العملاء', icon: '💳', path: '/payments' },
  { key: 'overhead', label: 'النثريات', icon: '📄', path: '/overhead' },
  { key: 'workers', label: 'العمال', icon: '🧑‍🔧', path: '/workers' },
  { key: 'contractors', label: 'المقاولين', icon: '🔨', path: '/contractors' },
  { key: 'reports', label: 'التقارير', icon: '📈', path: '/reports' },
  { key: 'users', label: 'المستخدمين', icon: '⚙️', path: '/admin/users', adminOnly: true },
  { key: 'material_types', label: 'قوائم الاختيارات', icon: '🏷️', path: '/admin/material-types' },
] as const;

export const MODULE_KEYS = ALL_MODULES.map((m) => m.key);

/**
 * يتحقق إن الـ profile عنده صلاحية لموديول معيّن.
 * الـ admin دائماً true. الموظفين بيتحققوا من visible_modules،
 * ما عدا الموديولات adminOnly (زي المستخدمين) — دي أدمن-أونلي دائماً.
 */
export function canSeeModule(profile: CurrentProfile | null, moduleKey: string): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  const mod = ALL_MODULES.find((m) => m.key === moduleKey);
  if (mod && (mod as any).adminOnly) return false;
  return profile.visible_modules.includes(moduleKey);
}

export type PermissionAction = 'view' | 'add' | 'edit' | 'delete';

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = ['view', 'add', 'edit', 'delete'];

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'مشاهدة',
  add: 'إضافة',
  edit: 'تعديل',
  delete: 'حذف',
};

export const PERMISSION_ACTION_ICONS: Record<PermissionAction, string> = {
  view: '👁',
  add: '➕',
  edit: '✏️',
  delete: '🗑️',
};

/**
 * Client-side check: does the current profile have a specific permission
 * on a module? Admins always have every permission. `view` is implied by
 * having any other permission on the module.
 */
export function hasPermission(
  profile: CurrentProfile | null | undefined,
  moduleKey: string,
  action: PermissionAction
): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (!canSeeModule(profile, moduleKey)) return false;
  const modulePerms = profile.permissions?.[moduleKey];
  if (!Array.isArray(modulePerms) || modulePerms.length === 0) return false;
  if (modulePerms.includes(action)) return true;
  if (action === 'view') return true; // any permission implies view
  return false;
}

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
  { key: 'journal', label: 'لوحة التحكم', icon: '🏠', path: '/journal' },
  { key: 'wallets', label: 'اليوميات', icon: '💰', path: '/wallets' },
  { key: 'finances', label: 'الماليات', icon: '💸', path: '/finances' },
  { key: 'orders', label: 'الأوردرات', icon: '📦', path: '/orders' },
  { key: 'order_additions', label: 'إضافات الأوردرات', icon: '🧩', path: '/order-additions' },
  { key: 'inventory_hub', label: 'المخزون', icon: '📋', path: '/inventory-hub' },
  { key: 'customers_branches', label: 'العملاء والمعارض', icon: '👥', path: '/customers-branches' },
  { key: 'partners', label: 'الموردين والمقاولين', icon: '🏭', path: '/partners' },
  { key: 'workers', label: 'العمال', icon: '🧑‍🔧', path: '/workers' },
  { key: 'reports', label: 'التقارير', icon: '📈', path: '/reports' },
  { key: 'admin_settings', label: 'الإعدادات', icon: '⚙️', path: '/admin-settings', adminOnly: true },
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
  if (profile.visible_modules.includes(moduleKey)) return true;
  const hubMap: Record<string, string[]> = {
    factory_wallet: ['wallets'],
    boards_wallet: ['wallets'],
    overhead: ['finances'],
    budget: ['finances'],
    boards_inventory: ['inventory_hub'],
    accessories_inventory: ['inventory_hub'],
    customers: ['customers_branches'],
    payments: ['customers_branches'],
    branches: ['customers_branches'],
    suppliers: ['partners'],
    contractors: ['partners'],
    users: ['admin_settings'],
    material_types: ['admin_settings'],
  };
  const hubs = hubMap[moduleKey];
  if (hubs && hubs.some((h) => profile.visible_modules.includes(h))) return true;
  return false;
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

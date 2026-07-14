'use client';

import { useUserStore } from '@/store/user-store';
import { hasPermission, canSeeModule, type PermissionAction } from '@/lib/auth';

/**
 * Hook to check if the current user can perform an action on a module.
 *
 * Usage:
 *   const can = useCan();
 *   if (can('orders', 'add')) { ... }
 *   if (can('orders', 'edit')) { ... }
 *   if (can('orders', 'delete')) { ... }
 *   if (canSee('orders')) { ... }
 *
 * - Admins always return true.
 * - `view` is implied by having any other permission on the module.
 */
export function useCan() {
  const user = useUserStore((s) => s.user);

  return {
    /** Check if the user can perform a specific action on a module. */
    can: (moduleKey: string, action: PermissionAction): boolean =>
      hasPermission(user, moduleKey, action),
    /** Check if the user can see the module at all. */
    canSee: (moduleKey: string): boolean => canSeeModule(user, moduleKey),
  };
}

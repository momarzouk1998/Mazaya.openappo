'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

const navItems = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: '📊' },
  { href: '/suppliers', label: 'الموردين', icon: '🏭' },
  { href: '/boards', label: 'مخزون الألواح', icon: '📋' },
  { href: '/accessories', label: 'مخزون الاكسسوارات', icon: '🔩' },
  { href: '/branches', label: 'المعارض', icon: '🏪' },
  { href: '/customers', label: 'العملاء', icon: '👥' },
  { href: '/orders', label: 'الأوردرات', icon: '📦' },
  { href: '/journal', label: 'اليومية المالية', icon: '💰' },
  { href: '/overhead', label: 'النثريات', icon: '📄' },
  { href: '/contractors', label: 'المقاولين', icon: '🔨' },
  { href: '/reports', label: 'التقارير', icon: '📈' },
];

const adminNavItems = [
  { href: '/admin/users', label: 'المستخدمين', icon: '⚙️' },
  { href: '/admin/material-types', label: 'إدارة الأنواع', icon: '🏷️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (data) setProfile(data);
      }
    }
    loadProfile();
  }, [supabase]);

  useEffect(() => {
    async function loadPermissions() {
      const { data } = await supabase.rpc('get_my_permissions');
      if (data) setPermissions(data as Record<string, boolean>);
    }
    if (profile?.role === 'admin') {
      loadPermissions();
    }
  }, [profile, supabase]);

  const permMap: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/suppliers': 'suppliers',
    '/boards': 'inventory',
    '/accessories': 'inventory',
    '/branches': 'branches',
    '/customers': 'customers',
    '/orders': 'orders',
    '/journal': 'journal',
    '/overhead': 'overhead',
    '/contractors': 'contractors',
    '/reports': 'reports',
    '/admin/users': 'admin_users',
    '/admin/material-types': 'material_types',
  };

  const canAccess = (href: string) => {
    if (!permissions) return true;
    const permKey = permMap[href];
    if (!permKey) return true;
    return permissions[permKey] !== false;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-64 flex-col bg-white border-l border-gray-200 shadow-sm transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200">
          <div>
            <h1 className="text-lg font-bold text-gray-900">مصنع مزايا</h1>
            <p className="text-xs text-gray-500">نظام إدارة المصنع</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-gray-500 hover:text-gray-700 lg:hidden"
          >
            ✕
          </button>
        </div>

        {profile && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <p className="text-sm font-medium text-gray-900">{profile.name}</p>
            <p className="text-xs text-gray-500">
              {profile.role === 'admin' ? 'المصنع (مدير)' : 'المعرض'}
            </p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {navItems.filter((item) => canAccess(item.href)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive(item.href)
                  ? 'bg-orange-50 text-orange-700 font-medium border-r-2 border-orange-500'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

          {profile?.role === 'admin' && (
            <>
              <div className="pt-3 mt-3 border-t border-gray-200">
                <p className="px-3 pb-1 text-xs font-medium text-gray-500">إدارة</p>
              </div>
              {adminNavItems.filter((item) => canAccess(item.href)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive(item.href)
                      ? 'bg-orange-50 text-orange-700 font-medium border-r-2 border-orange-500'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-gray-200 space-y-1">
          <Link
            href="/profile"
            onClick={() => setSidebarOpen(false)}
            className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive('/profile')
                ? 'bg-orange-50 text-orange-700 font-medium border-r-2 border-orange-500'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>👤</span>
            <span>الملف الشخصي</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <span>🚪</span>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          >
            ☰
          </button>
          <h1 className="text-base font-bold text-gray-900">مصنع مزايا</h1>
          <div className="w-10" />
        </div>

        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

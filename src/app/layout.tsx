import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { UserInitializer } from "@/components/UserInitializer";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { COOKIE_NAME, verifySession } from "@/lib/db/auth";
import prisma from "@/lib/db/prisma";
import type { CurrentProfile } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "مصنع مزايا للأثاث - نظام الإدارة",
  description: "نظام إدارة مصنع مزايا للأثاث - دمياط. إدارة المخزون، الأوردرات، اليومية المالية، والمعارض.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Mazaya Furniture", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};
export const viewport: Viewport = {
  themeColor: "#F2994A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * Resolve the current user on the server. Runs once per request, on the
 * same machine that holds the DB, so there's no extra network hop and no
 * client-side race condition.
 */
async function getInitialUser(): Promise<CurrentProfile | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = await verifySession(token);
    if (!payload) return null;
    const user = await prisma.users.findFirst({
      where: { id: payload.sub, is_active: true },
      select: {
        id: true,
        username: true,
        full_name: true,
        role: true,
        branch_id: true,
        visible_modules: true,
        permissions: true,
        is_active: true,
      },
    });
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role as CurrentProfile["role"],
      branch_id: user.branch_id,
      is_active: user.is_active,
      visible_modules: user.visible_modules || [],
      permissions: (user.permissions as Record<string, string[]>) || {},
    };
  } catch {
    return null;
  }
}

async function checkSubscription(): Promise<{ active: boolean; status?: string; daysLeft?: number; graceDaysLeft?: number; message?: string }> {
  try {
    const adminUrl = process.env.ADMIN_API_URL || "https://admin.openappo.com";
    const systemName = process.env.SYSTEM_NAME || "mazaya-system";

    const res = await fetch(`${adminUrl}/api/subscription/verify?system=${systemName}`, {
      cache: "no-store", // Instant realtime checks on every refresh
    });
    
    if (!res.ok) return { active: true };
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Subscription check failed:", error);
    return { active: true }; // Do not block if admin server is unreachable
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const subStatus = await checkSubscription();

  if (!subStatus.active) {
    return (
      <html lang="ar" dir="rtl">
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
          <title>System Blocked</title>
        </head>
        <body className="min-h-screen bg-gray-50 flex items-center justify-center p-4" style={{ fontFamily: 'Cairo' }}>
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">انتهت صلاحية الاشتراك</h1>
            <p className="text-gray-600 mb-6">
              {subStatus.message || "عفواً، لقد انتهت صلاحية اشتراك هذا النظام. يرجى التواصل مع الإدارة لتجديد الاشتراك واستعادة الوصول."}
            </p>
          </div>
        </body>
      </html>
    );
  }

  const initialUser = await getInitialUser();
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col">
        {subStatus.status === "expiring_soon" && (
          <div className="bg-yellow-500 text-black px-4 py-2 text-center text-sm font-bold w-full shadow-sm print:hidden">
            {subStatus.message}
          </div>
        )}
        {subStatus.status === "grace_period" && (
          <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-bold w-full shadow-sm print:hidden">
            {subStatus.message}
          </div>
        )}
        <UserInitializer initialUser={initialUser} />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

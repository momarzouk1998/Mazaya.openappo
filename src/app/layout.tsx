import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { cookies } from "next/headers";
import { UserInitializer } from "@/components/UserInitializer";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SubscriptionBanner } from "@/components/SubscriptionBanner";
import { COOKIE_NAME, verifySession } from "@/lib/db/auth";
import prisma from "@/lib/db/prisma";
import type { CurrentProfile } from "@/lib/auth";
import "./globals.css";

// خط Cairo عبر next/font — يُستضاف محلياً (بدون <link> خارجي يقفل الرسم)
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-cairo",
});

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
 * Simple in-memory cache for user data to reduce database queries
 * Cache expires after 5 minutes
 */
const userCache = new Map<string, { data: CurrentProfile; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

    // Check cache first
    const cacheKey = `${payload.sub}`;
    const cached = userCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

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

    const userData = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role as CurrentProfile["role"],
      branch_id: user.branch_id,
      is_active: user.is_active,
      visible_modules: user.visible_modules || [],
      permissions: (user.permissions as Record<string, string[]>) || {},
    };

    // Cache the result
    userCache.set(cacheKey, {
      data: userData,
      expires: Date.now() + CACHE_TTL,
    });

    return userData;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // فحص الاشتراك اتنقل لـ src/middleware.ts (طريقة A) عشان ما يقفلش كل تنقّل.
  const initialUser = await getInitialUser();

  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="مصنع مزايا" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen flex flex-col">
        <SubscriptionBanner />
        <UserInitializer initialUser={initialUser} />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';

// ============================================================
// فحص الاشتراك — طريقة A (مركزية، لا تقفل أي تنقّل)
// ------------------------------------------------------------
// بدل ما كل صفحة كانت تعمل await لطلب admin.openappo.com في RootLayout
// مع كل ضغطة، الـ middleware ده بيفحص مرة كل 60 ثانية كحد أقصى لكل
// بروسيس، وبيكاش النتيجة في الذاكرة. لو الكاش قديم بيرجّع القيمة
// القديمة فوراً ويحدّث في الخلفية (stale-while-revalidate).
// النتيجة: مفيش أي request بيستنى السيرفر الخارجي.
// ============================================================

type SubStatus = {
  active: boolean;
  status?: string;
  message?: string;
};

const TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 2500;

const ADMIN_URL = process.env.ADMIN_API_URL || 'https://admin.openappo.com';
const SYSTEM_NAME = process.env.SYSTEM_NAME || 'mazaya-system';

// كاش على مستوى الموديول — بيعيش طول عمر البروسيس (سيرفر واحد على الدروبلت)
let cache: { data: SubStatus; checkedAt: number } | null = null;
let refreshing = false;

async function fetchStatus(): Promise<SubStatus> {
  try {
    const res = await fetch(`${ADMIN_URL}/api/subscription/verify?system=${SYSTEM_NAME}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { active: true };
    const data = (await res.json()) as SubStatus;
    return data ?? { active: true };
  } catch {
    // سيرفر الأدمن مش متاح — ما نقفلش النظام
    return { active: true };
  }
}

function triggerRefresh(event: NextFetchEvent) {
  if (refreshing) return;
  refreshing = true;
  const p = fetchStatus()
    .then((data) => {
      cache = { data, checkedAt: Date.now() };
    })
    .finally(() => {
      refreshing = false;
    });
  // خلي الـ runtime يكمّل الـ promise بعد ما الـ response يرجع
  try {
    event.waitUntil(p);
  } catch {
    /* waitUntil مش متاح — الـ promise هيكمّل عادي */
  }
}

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // صفحة الحظر نفسها — نعديها عشان ما يحصلش لوب
  if (pathname === '/blocked') return NextResponse.next();

  // بذرة تفاؤلية عند الإقلاع البارد: نعتبره شغّال ونجدول تحديث فوري
  if (!cache) cache = { data: { active: true }, checkedAt: 0 };

  if (Date.now() - cache.checkedAt >= TTL_MS) {
    triggerRefresh(event);
  }

  const sub = cache.data;

  if (sub.active === false) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { ok: false, error: { code: 'SUBSCRIPTION_INACTIVE', message: sub.message || 'انتهت صلاحية الاشتراك' } },
        { status: 403 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/blocked';
    url.search = '';
    const requestHeaders = new Headers(request.headers);
    if (sub.message) requestHeaders.set('x-sub-message', encodeURIComponent(sub.message));
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  const res = NextResponse.next();
  // بانر التحذير (قرب ينتهي / فترة سماح) — كوكي غير httpOnly تقرأه الواجهة
  if (sub.status && sub.status !== 'active') {
    res.cookies.set('mz_sub_status', sub.status, { maxAge: 120, sameSite: 'lax', path: '/' });
    res.cookies.set('mz_sub_msg', encodeURIComponent(sub.message || ''), { maxAge: 120, sameSite: 'lax', path: '/' });
  }
  return res;
}

export const config = {
  // كل المسارات ما عدا أصول Next الثابتة والملفات الساكنة
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|map)$).*)',
  ],
};

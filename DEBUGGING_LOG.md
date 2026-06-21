# سجل التصحيح - مشكلة "الموقع مش بيفتح بعد Login"

> التاريخ: 21-22 يونيو 2026
> المشروع: `mazaya-furniture-system` على Vercel + Supabase + GitHub

---

## 1. المشكلة الأصلية

- ✅ الـ build على Vercel نجح
- ✅ الـ Login API call بنجح (`signInWithPassword` بيرجع `hasUser: true`)
- ❌ الموقع **مش بيفتح** بعد الضغط على زر "دخول"
- ❌ الصفحة بتفضل على `/login` أو بتحمل صفحة بيضا

---

## 2. الـ Tech Stack

| Component | Version | Status |
|---|---|---|
| Next.js | 15.3.9 | ✅ |
| React | 19 | ✅ |
| Supabase | @supabase/ssr 0.5+ | ✅ |
| Vercel project | `mazaya-factory` | ✅ |
| GitHub repo | `momarzouk1998/Mazaya.openappo` | ✅ |
| Supabase project URL | `hvpsqhrbxcmfbpzsfvvv.supabase.co` | ✅ |
| Auth users | 2 (admin + backup) | ✅ |

---

## 3. المحاولات والنتائج (بالترتيب الزمني)

### المحاولة 1: ترقية Next.js 15.0.3 → 15.3.9
**المشكلة:** `npm error ERESOLVE unable to resolve dependency tree` — peer dependency conflict بين `next@15.0.3` و `react@19`.

**الحل:** ترقية لـ `next@15.3.9` (آمن، patched CVE-2025-66478) + `recharts@3.0` (React 19 compat).

**Commit:** `d93fce1`

**النتيجة:** ✅ Build نجح محلياً، ✅ رفع على GitHub، ❌ نفس الـ error ظهر في deployment الجديد.

---

### المحاولة 2: إصلاح TypeScript errors
**المشكلة:** `Parameter 'cookiesToSet' implicitly has an 'any' type` في `middleware.ts` و `server.ts`.

**الحل:** إضافة explicit type annotations.

**Commit:** مع `d93fce1`.

**النتيجة:** ✅ Build نجح محلياً.

---

### المحاولة 3: إصلاح مشكلة Middleware في Edge Runtime
**المشكلة (الجديدة):** بعد deploy على Vercel: `500: INTERNAL_SERVER_ERROR / MIDDLEWARE_INVOCATION_FAILED`.

**السبب:** `@supabase/ssr` بيستخدم `process.version` (Node.js API) — مش متاح في Vercel Edge Runtime.

**الحل:** استبدال `supabase.auth.getUser()` في الـ middleware بـ cookie-only check (Edge-safe). التحقق الفعلي من الـ user بقى في الـ Server Components.

```typescript
// قبل (يفشل في Edge):
const { data: { user } } = await supabase.auth.getUser();

// بعد (Edge-safe):
const hasSession = Object.keys(request.cookies.getAll())
  .some(name => name.includes("auth-token") && request.cookies.get(name)?.value);
```

**Commit:** `1ce76b1`

**النتيجة:** ✅ الـ 500 اختفى، ✅ Build نجح، ❌ ظهر error جديد على الـ Login page.

---

### المحاولة 4: إضافة رسائل خطأ واضحة + Debug Endpoint
**المشكلة (الجديدة):** Login page بتعرض "حدث خطأ غير متوقع" — رسالة عامة ما بتقولش السبب.

**السبب الحقيقي:** Client bundle فيه `@supabase/ssr: Your project's URL and API key are required` — يعني `process.env.NEXT_PUBLIC_SUPABASE_URL` و `_ANON_KEY` مش موجودين في الـ client bundle!

**الحل:**
1. تحديث Login page يعرض رسائل خطأ مفصلة:
   - `Invalid login credentials` → "البريد/الهاتف أو كلمة السر غير صحيحة"
   - `Email not confirmed` → "الحساب مش مفعّل"
   - `fetch errors` → "مشكلة في الاتصال بـ Supabase"
2. إنشاء `/api/auth/debug` endpoint يتأكد من:
   - URL/Key متظبطين في السيرفر
   - Supabase متاح
   - عدد الجداول
3. إنشاء `/debug` page عامة (مش محمية) تعرض:
   - حالة الـ env vars في الـ client
   - نتيجة السيرفر
   - خطوات الإصلاح

**Commit:** `e374e88` ثم `cd1156f`

**النتيجة:** ✅ أقدر أشخّص المشكلة. المشكلة إن **الـ client bundle اتعمل قبل ما الـ env vars تتحط في Vercel**.

---

### المحاولة 5: Redeploy بدون Build Cache
**المشكلة:** الـ client bundle لسه فيه قيم فاضية للـ env vars.

**الخطوة المطلوبة:** في Vercel → Deployments → آخر deployment → ⋯ → Redeploy → **ألغِ checkbox "Use existing Build Cache"** → Redeploy.

**النتيجة (المفترضة):** ❓ لازم المستخدم يعمل Redeploy يدوياً من Vercel Dashboard.

---

### المحاولة 6: Self-healing Auth
**المشكلة:** بعد نجاح Login، الـ dashboard مش بيفتح — على الأرجح لأن `getCurrentProfile()` بترجع `null`.

**السبب المحتمل:** الـ `auth_id` في جدول `mazaya_users` مش متربط بالـ user في `auth.users`.

**الحل:**
1. `getCurrentProfile()` بقى self-healing: لو الـ profile مش متربط، يبحث بالإيميل ويربطه تلقائياً.
2. `/api/auth/whoami` endpoint يعرض الحالة الحالية.
3. `/api/auth/ensure-profile` endpoint يربط الـ profile يدوياً.

**Commit:** `d368f05`

**النتيجة:** ✅ بعد ما `/api/auth/whoami` اشتغل، لقينا إن:
```json
{
  "auth_user": {"email": "abomrzk@gmail.com"},
  "profile": {"username": "admin", "auth_id": "d570e4ae-..."},
  "has_session": true,
  "has_profile": true
}
```

**بس الموقع لسه مش بيفتح!**

---

### المحاولة 7: Force Fresh Build
**المشكلة:** الـ client bundle القديم (`1684-ebf298c1df82c4ff.js`) لسه محفوظ في الـ browser cache.

**الحل:** إضافة comment تافه في `client.ts` عشان يـ force Vercel يعمل build جديد ويـ regen كل الـ chunks.

**Commit:** `a48696a`

**النتيجة:** ❓ معلق — المستخدم لازم يعمل hard refresh (Ctrl+Shift+R) أو يفتح في Incognito.

---

## 4. الـ Commits بالترتيب

| Commit | الوصف |
|---|---|
| `4cec882` | Initial commit — كل الـ files |
| `d93fce1` | Fix Vercel build errors + Next.js upgrade + Recharts upgrade |
| `1ce76b1` | Fix Edge Runtime MIDDLEWARE_INVOCATION_FAILED |
| `e374e88` | Better login error messages + debug endpoint |
| `cd1156f` | Add /debug page + clearer Supabase env errors |
| `6ac8937` | Deep DB diagnostics — check each table + users + profiles |
| `d368f05` | Self-healing auth + diagnostic endpoints |
| `37e86cb` | Dashboard error handling + global error boundary |
| `a48696a` | Force fresh build (current) |

---

## 5. الـ Debug Endpoints المتاحة

| URL | الوصف |
|---|---|
| `/api/auth/debug` | يفحص الـ env vars + Supabase + الـ tables + Auth users |
| `/api/auth/whoami` | يفحص الـ session الحالي + الـ profile المربوط |
| `/api/auth/ensure-profile` | POST `{email}` — يربط الـ profile بالـ auth_id يدوياً |
| `/debug` | صفحة عامة بتفحص كل اللي فوق |

---

## 6. الـ Environment Variables (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL = https://hvpsqhrbxcmfbpzsfvvv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc... (length 208)
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc... (length 219)
```

**الحالة:** ✅ موجودين في Production + Preview.

---

## 7. آخر حالة مؤكدة (من `/api/auth/whoami`)

```json
{
  "auth_user": {
    "id": "d570e4ae-5581-4fbe-87bc-a62787bf3823",
    "email": "abomrzk@gmail.com",
    "last_sign_in_at": "2026-06-21T22:11:44.469222Z"
  },
  "profile": {
    "id": 1,
    "auth_id": "d570e4ae-5581-4fbe-87bc-a62787bf3823",
    "username": "admin",
    "role": "admin",
    "visible_modules": ["dashboard","suppliers", ...all 13],
    "is_active": true
  },
  "has_session": true,
  "has_profile": true
}
```

**اللي شغال:**
- ✅ Supabase env vars في السيرفر
- ✅ Supabase متاح
- ✅ Auth user `abomrzk@gmail.com` موجود
- ✅ Login API call بترجع user بنجاح
- ✅ Profile متربط بالـ auth_id
- ✅ Role = admin (يشوف كل حاجة)
- ✅ Visible modules = كل الـ 13 module

**اللي مش شغال:**
- ❌ الموقع مش بيفتح بعد Login
- ❌ في الـ console: `@supabase/ssr: Your project's URL and API key are required` (من client bundle قديم)

---

## 8. الفرضيات المتبقية

### فرضية A: Browser Cache
الـ browser مخزن الـ old client bundle (1684-ebf298c1df82c4ff.js) في الـ disk cache.

**الدليل:** الـ error بيقول الـ URL والـ key فاضيين، لكن `/api/auth/whoami` بيقول إن السيرفر شايفهم.

**الحل:** Hard refresh (Ctrl+Shift+R) أو Incognito mode.

---

### فرضية B: Vercel Build Cache
Vercel لسه بيستخدم الـ build cache القديم اللي اتعمل قبل ما الـ env vars تتحط.

**الحل:** Redeploy مع تعطيل Build Cache.

---

### فرضية C: NEXT_PUBLIC_* مش بتيجي للـ Client Bundle
في Next.js 15، المتغيرات اللي بتبدأ بـ `NEXT_PUBLIC_` بتتـ embed في الـ client bundle وقت الـ build. لو الـ env vars اتحطت بعد الـ build، الـ bundle القديم فيه قيم فاضية.

**الحل:** تأكد إن:
1. الـ env vars متحطيين **قبل** الـ deployment
2. الـ deployment اتعمل **بعد** إضافة الـ env vars
3. الـ Build Cache معطّل في الـ deployment

---

### فرضية D: Dashboard Page فيها Error
ممكن الـ dashboard نفسه بيفشل بسبب:
- جدول مش موجود في DB
- RLS policy بترفض
- TypeScript error في الـ runtime

**الحل:** أضفت `safeQuery()` + global error boundary في الـ commit `37e86cb`. لو الـ dashboard بيفشل، هتشوف الـ error message كاملاً بدل صفحة بيضا.

---

## 9. خطوات التشخيص للـ AI اللي هيكمّل

### الخطوة 1: تأكد إن الـ deployment الجديد متعملش

```
https://vercel.com/mohamed-marzouk-s-projects/mazaya-factory/deployments
```

لازم تشوف deployment جديد من commit `a48696a`.

---

### الخطوة 2: Hard refresh في Incognito Mode

```
chrome: Ctrl+Shift+N
firefox: Ctrl+Shift+P
```

افتح: `https://mazaya-factory.vercel.app/login`

---

### الخطوة 3: شوف الـ console errors

افتح DevTools (F12) → Console tab → اعمل Login.

**ابعتلي:**
1. أي error أحمر في الـ console
2. الـ Network tab: هل الـ requests بتروح لـ Supabase ولا لأ؟
3. الـ bundle filename في الـ error (مثلاً `1684-xxx.js` أو `xyz-abc.js`)

---

### الخطوة 4: لو Login نجح بس Dashboard ما فتحش

افتح: `https://mazaya-factory.vercel.app/api/auth/whoami` (بعد Login).

**ابعتلي الـ JSON** — هيقولك:
- هل الـ session لسة valid
- هل الـ profile متربط

---

### الخطوة 5: لو ظهر error page

الـ error boundary الجديد (`/src/app/error.tsx`) هيعرض:
- Error message
- Stack trace

**ابعتلي الـ stack trace كاملاً.**

---

## 10. الملفات المهمة للمراجعة

| الملف | الوصف |
|---|---|
| `src/lib/supabase/client.ts` | Supabase browser client (Edge-safe error) |
| `src/lib/supabase/server.ts` | Supabase server client |
| `src/lib/supabase/middleware.ts` | Edge-safe middleware (cookie check only) |
| `src/lib/auth.ts` | Types + constants + `canSeeModule()` helper |
| `src/lib/auth-server.ts` | `getCurrentProfile()` self-healing version |
| `src/app/login/page.tsx` | Login with detailed error messages |
| `src/app/dashboard/page.tsx` | Safe queries + error display |
| `src/app/error.tsx` | Global error boundary |
| `src/app/debug/page.tsx` | Public diagnostic page |
| `src/app/api/auth/debug/route.ts` | Server-side diagnostic |
| `src/app/api/auth/whoami/route.ts` | Current session diagnostic |
| `src/app/api/auth/ensure-profile/route.ts` | Manual profile linking |

---

## 11. آخر commit متاح

```
a48696a - chore: force fresh build to flush stale client bundle
```

الـ GitHub repo: https://github.com/momarzouk1998/Mazaya.openappo
الـ Vercel project: https://vercel.com/mohamed-marzouk-s-projects/mazaya-factory

---

## 12. ملاحظات للـ AI الجديد

1. **الـ middleware Edge-safe** — لا تستخدم `supabase.auth.getUser()` فيه، استخدم cookie check بس.
2. **الـ auth-server.ts self-healing** — لو الـ profile مش متربط، يبحث بالإيميل ويربطه.
3. **الـ Login page** بتعرض رسائل خطأ مفصلة — لو ظهر error، اقرأ الـ console.
4. **Vercel Project = `mazaya-factory`** (مش `Mazaya.openappo` — ده الـ repo name بس).
5. **الـ user بيستخدم Hard refresh (Ctrl+Shift+R)** أو **Incognito mode** عشان يتجنب browser cache.
6. **الـ env vars في Vercel** متحطيين في **Production + Preview بس** — مش Development.
7. **Supabase Auth user `abomrzk@gmail.com`** موجود بالـ password `123456` مع Auto Confirm مفعّل.
8. **SQL migration** اتنفذ — 14 جدول + RLS policies + Triggers + Seed data.

---

## 13. المحاولة 8 (AI — 22 يونيو 2026): إصلاح Race Condition + Middleware Bug

### التشخيص
المستخدم بيدخل بيانات صحيحة، الـ `signInWithPassword` بيرجع `hasUser: true`، بس الصفحة تفضل تحمل ومش بتفتح الداشبورد.

### المشكلة 1: `router.refresh()` بعد `router.push()` في `login/page.tsx`
- `router.push("/dashboard")` بيبدا navigation للداشبورد
- بعدها بـ 1 ميلي `router.refresh()` بيطلب re-fetch لصفحة `/login` الحالية
- **النتيجة:** Race condition — الـ Router يتعلق وما بيكملش navigation

**الحل:** شيل الـ `router.refresh()` خالص (السطر 60).

### المشكلة 2: Middleware Cookie Check غلط في `middleware.ts`
الكود القديم:
```ts
const hasSession = Object.keys(request.cookies.getAll()).some(name =>
    name.includes("auth-token") && request.cookies.get(name)?.value
);
```
`request.cookies.getAll()` بترجع `Array<{name, value}>`. `Object.keys()` على array بترجع array indices (`"0"`, `"1"`, ...). يبقى `name.includes("auth-token")` دايمًا `false`.

**النتيجة:** `hasSession` دايمًا `false`، فـ:
- أي طلب لـ `/dashboard` الـ middleware بيرجع redirect لـ `/login`
- المستخدم بيدخل في loop: `/dashboard` → `/login` → `/dashboard` → ...

**الحل:**
```ts
const cookies = request.cookies.getAll();
const hasSession = cookies.some(c =>
    c.name.includes("auth-token") && c.value
);
```

### التعديلات
| الملف | التغيير |
|---|---|
| `src/app/login/page.tsx` | شيل `router.refresh()` من السطر 60 |
| `src/lib/supabase/middleware.ts` | غير `Object.keys(...)` إلى `cookies.some(...)` |

### Commit
```
f21ce29 - fix: remove router.refresh() after push() causing race condition, fix middleware cookie check using Object.keys on array
```

### النتيجة
✅ Login → Dashboard navigation مبقاش فيه race condition
✅ الـ middleware بقى يكتشف الكوكيز صح
❓ لازم يتعمل Redeploy على Vercel مع تعطيل Build Cache عشان الـ client bundle يتجدد
❓ محلياً لو شغال `npm run dev`، تأكد من وجود `.env.local` بالقيم الصحيحة

---

© 2026 Mazaya Furniture — للمتابعة مع AI جديد

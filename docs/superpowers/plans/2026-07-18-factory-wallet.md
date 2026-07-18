# محفظة المصنع + أجور العمال — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إضافة صفحة "محفظة المصنع" (`/factory-wallet`) كعرض تراكمي يومي للرصيد + تطوير صفحة `/workers` بتبويب "أجور العمال" منفصل عن النثريات.

**Architecture:** المحفظة = قراءة لجدول `journal_entries` الموجود (مفيش جدول جديد). نوع قيد جديد `أجور عمال` يدخل في `EXPENSE_TYPES` فيحسب تلقائيًا في المحفظة والميزانية. التمريري (`is_pass_through=true`) مستثنى من المحفظة فقط. أجور العمال مدخلها الوحيد صفحة `/workers` (تُشال من مداخل النثريات).

**Tech Stack:** Next.js 15 (App Router) + React 19 + Prisma 5 + PostgreSQL + Tailwind CSS 4. الاختبارات بـ `node --experimental-strip-types` و PrismaMock (نفس نمط `tests/inventory-flow.test.ts`).

**Spec:** `docs/superpowers/specs/2026-07-18-factory-wallet-design.md`

---

## ملاحظات للمُنفّذ

- المشروع على **Windows + Git Bash**. الأوامر `cd` بمسافات لازم تتقتب.
- النظام بـ RTL + عربي. كل النصوص الجديدة بالعربي.
- **DRY**: كل الحسابات المالية من `src/lib/finance.ts`. ما نكرّرش منطق `calcIncome`/`calcExpense` في صفحة جديدة.
- **Frequent commits**: كل task يتعمله commit منفصل.
- **No placeholders**: كل خطوة فيها الكود الكامل.
- قبل ما تبدأ، شغّل `npm run typecheck` و `npm run test:inventory` للتأكد إن الحالة سليمة.

---

## Task 1: إضافة نوع قيد "أجور عمال" في `finance.ts`

**Files:**
- Modify: `src/lib/finance.ts:17`
- Test: `tests/finance-wages.test.ts` (new)

- [ ] **Step 1: اكتب الاختبار الفاشل**

أنشئ `tests/finance-wages.test.ts`:

```ts
// ============================================================
// Unit test — finance.ts: نوع قيد "أجور عمال" جديد
// ============================================================
// "أجور عمال" لازم:
//   1) يدخل في calcExpense (يحسب في المحفظة والميزانية)
//   2) ميكونش income/payout
//   3) Tمريري (is_pass_through=true) مستثنى من كل الحسابات
//
// التشغيل: node --experimental-strip-types --no-warnings=ExperimentalWarning tests/finance-wages.test.ts
// ============================================================

import {
  EXPENSE_TYPES,
  VALID_ENTRY_TYPES,
  calcIncome,
  calcExpense,
  calcPayout,
  calcNet,
} from '../src/lib/finance.ts';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('❌ FAIL:', msg); failures++; }
  else console.log('✅ PASS:', msg);
}

// 1) "أجور عمال" داخل EXPENSE_TYPES و VALID_ENTRY_TYPES
assert(EXPENSE_TYPES.includes('أجور عمال' as any), '"أجور عمال" في EXPENSE_TYPES');
assert((VALID_ENTRY_TYPES as readonly string[]).includes('أجور عمال'), '"أجور عمال" في VALID_ENTRY_TYPES');

// 2) قيد أجور عمال بيدخل في المصروف
const rows = [
  { entry_type: 'أجور عمال', amount: 500, is_pass_through: false },
  { entry_type: 'مشتريات', amount: 300, is_pass_through: false },
];
assert(calcExpense(rows) === 800, `calcExpense = 800 (got ${calcExpense(rows)})`);

// 3) أجور عمال ميكونش income أو payout
assert(calcIncome(rows) === 0, `calcIncome = 0 (got ${calcIncome(rows)})`);
assert(calcPayout(rows) === 0, `calcPayout = 0 (got ${calcPayout(rows)})`);

// 4) التمريري مستثنى من المصروف حتى لو نوعه أجور عمال
const withPassthrough = [
  { entry_type: 'أجور عمال', amount: 500, is_pass_through: false },
  { entry_type: 'أجور عمال', amount: 1000, is_pass_through: true },
];
assert(calcExpense(withPassthrough) === 500, `pass-through excluded from expense (got ${calcExpense(withPassthrough)})`);

// 5) net = income - expense - payout
assert(calcNet(rows) === -800, `calcNet = -800 (got ${calcNet(rows)})`);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log('\n✅ All finance-wages tests passed');
  process.exit(0);
}
```

- [ ] **Step 2: شغّل الاختبار وتأكد إنه فشل**

Run: `node --experimental-strip-types --no-warnings=ExperimentalWarning tests/finance-wages.test.ts`
Expected: FAIL — `"أجور عمال" في EXPENSE_TYPES` (لأن النوع لسه مش موجود).

- [ ] **Step 3: عدّل `src/lib/finance.ts`**

عدّل السطر 17 (من `export const EXPENSE_TYPES = ['مشتريات', 'نثريات'] as const;`):

```ts
export const EXPENSE_TYPES = ['مشتريات', 'نثريات', 'أجور عمال'] as const;
```

`VALID_ENTRY_TYPES` بياخد من `EXPENSE_TYPES` تلقائيًا، فمفيش تعديل تاني محتاج.

- [ ] **Step 4: شغّل الاختبار وتأكد إنه عدى**

Run: `node --experimental-strip-types --no-warnings=ExperimentalWarning tests/finance-wages.test.ts`
Expected: PASS — `✅ All finance-wages tests passed`.

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء.

- [ ] **Step 6: Commit**

```bash
git add src/lib/finance.ts tests/finance-wages.test.ts
git commit -m "feat(finance): add 'أجور عمال' entry type to EXPENSE_TYPES"
```

---

## Task 2: إضافة labels/colors لـ "أجور عمال" في `format.ts`

**Files:**
- Modify: `src/lib/format.ts:45-51` (ENTRY_TYPE_LABELS)
- Modify: `src/lib/format.ts:72-83` (ENTRY_TYPE_COLORS)

- [ ] **Step 1: عدّل `ENTRY_TYPE_LABELS`**

في `src/lib/format.ts`، عدّل الكائن `ENTRY_TYPE_LABELS` (حيادي سطر "نثريات") وأضف بعده:

```ts
export const ENTRY_TYPE_LABELS: Record<string, string> = {
  "مشتريات": "مشتريات",
  "دفعة واردة من معرض": "دفعة واردة من معرض",
  "دفعة صادرة لمورد": "دفعة صادرة لمورد",
  "تحويل تمريري": "تحويل تمريري",
  "نثريات": "نثريات",
  "أجور عمال": "أجور عمال",
};
```

- [ ] **Step 2: عدّل `ENTRY_TYPE_COLORS`**

في نفس الملف، عدّل `ENTRY_TYPE_COLORS` وأضف مفتاح `أجور عمال`:

```ts
export const ENTRY_TYPE_COLORS: Record<string, string> = {
  "مشتريات": "bg-red-100 text-red-700 border-red-300",
  "دفعة واردة من معرض": "bg-green-100 text-green-700 border-green-300",
  "دفعة صادرة لمورد": "bg-red-100 text-red-700 border-red-300",
  "تحويل تمريري": "bg-orange-100 text-orange-700 border-orange-300",
  "نثريات": "bg-purple-100 text-purple-700 border-purple-300",
  "أجور عمال": "bg-amber-100 text-amber-700 border-amber-300",
  purchase: "bg-red-100 text-red-700 border-red-300",
  income: "bg-green-100 text-green-700 border-green-300",
  expense: "bg-red-100 text-red-700 border-red-300",
  transfer: "bg-orange-100 text-orange-700 border-orange-300",
  overhead: "bg-purple-100 text-purple-700 border-purple-300",
};
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء.

- [ ] **Step 4: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat(format): add label and color for 'أجور عمال' entry type"
```

---

## Task 3: Migration — إضافة `payment_kind` إلى `overhead_expenses`

**Files:**
- Modify: `prisma/schema.prisma:269-287` (overhead_expenses)
- Create: `prisma/migrations/20260718_add_overhead_payment_kind/migration.sql`
- Create: `prisma/migrations/20260718_add_overhead_payment_kind/migration.toml` (لو موجود كنمط — تشيك أول)

- [ ] **Step 1: عدّل `prisma/schema.prisma`**

في موديل `overhead_expenses`، أضف حقل `payment_kind` بعد حقل `payment_method`:

```prisma
model overhead_expenses {
  id              String             @id @default(uuid()) @db.Uuid
  date            DateTime           @default(now()) @db.Date
  category        String?            @db.Text
  description     String             @db.Text
  amount          Decimal            @default(0)
  payment_method  String?            @db.Text
  payment_kind    String?            @db.Text
  notes           String?            @db.Text
  journal_entry_id String?           @unique @db.Uuid
  worker_id       String?            @db.Uuid
  created_by      Int?
  created_at      DateTime?          @default(now()) @db.Timestamptz()
  updated_at      DateTime?          @default(now()) @db.Timestamptz()
  journal_entry   journal_entries?   @relation(fields: [journal_entry_id], references: [id])
  worker          workers?           @relation(fields: [worker_id], references: [id])

  @@map("overhead_expenses")
  @@schema("mazaya")
}
```

- [ ] **Step 2: أنشئ ملف الـ migration**

أنشئ `prisma/migrations/20260718_add_overhead_payment_kind/migration.sql`:

```sql
-- ============================================================
-- Migration: 20260718_add_overhead_payment_kind
-- Purpose: إضافة payment_kind لـ overhead_expenses عشان نفرّق
--          بين القبض والسلفة في أجور العمال.
--          القيم المسموحة: 'قبض' (افتراضي) أو 'سلفة'.
--          Nullable عشان السجلات القديمة.
-- ============================================================

ALTER TABLE "mazaya"."overhead_expenses"
  ADD COLUMN IF NOT EXISTS "payment_kind" Text;
```

- [ ] **Step 3: توليد Prisma Client**

Run: `npx prisma generate`
Expected: رسالة `✔ Generated Prisma Client` بدون أخطاء.

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260718_add_overhead_payment_kind/
git commit -m "feat(db): add payment_kind column to overhead_expenses"
```

> **ملاحظة للعميل/المُنفّذ:** الـ migration لازم يتعمله apply على DB الإنتاجي بـ
> `npx prisma migrate deploy` (أو يدويًا الـ SQL). مش بنعمل deploy من الخطة دي.

---

## Task 4: تعديل `/api/overhead` لربط category='أجور عمال' بـ entry_type

**Files:**
- Modify: `src/app/api/overhead/route.ts:78-105` (POST branch with createJournal)

- [ ] **Step 1: اقرأ الكود الحالي**

`src/app/api/overhead/route.ts` السطور 78-111 فيها الـ transaction اللي بينشئ
journal_entry بـ `entry_type: 'نثريات'`. محتاجين نغيّره بحيث:
- لو `category === 'أجور عمال'` و `worker_id` موجود → `entry_type: 'أجور عمال'`.
- غير كده → `'نثريات'` زي ما هو.

- [ ] **Step 2: عدّل POST handler**

في `src/app/api/overhead/route.ts`، عدّل داخِل الـ transaction (الجزء اللي بينشئ `journal_entries`):

دوّر على:
```ts
      if (createJournal) {
        const result = await prisma.$transaction(async (tx) => {
          const journalEntry = await tx.journal_entries.create({
            data: {
              date: date ? new Date(date) : new Date(),
              // SSoT (F8) — نستخدم المفتاح العربي 'نثريات' بدل 'overhead'
              // عشان كل الحسابات الموحدة في src/lib/finance.ts تشتغل صح
              entry_type: 'نثريات',
              description: description.trim(),
              amount,
              payment_method: payment_method || null,
              created_by: user.id,
            },
          });
```

استبدله بـ:
```ts
      if (createJournal) {
        // أجور العمال بـ entry_type خاص علشان يحسب صح في المحفظة والميزانية.
        // لو category='أجور عمال' و worker_id موجود → 'أجور عمال'، غير كده 'نثريات'.
        const isWages = category === 'أجور عمال' && Boolean(worker_id);
        const result = await prisma.$transaction(async (tx) => {
          const journalEntry = await tx.journal_entries.create({
            data: {
              date: date ? new Date(date) : new Date(),
              // SSoT — نستخدم المفاتيح العربية الموحدة في src/lib/finance.ts
              entry_type: isWages ? 'أجور عمال' : 'نثريات',
              description: description.trim(),
              amount,
              payment_method: payment_method || null,
              created_by: user.id,
            },
          });
```

- [ ] **Step 3: أضف `payment_kind` لإنشاء overhead_expenses**

في نفس الـ transaction، دوّر على `tx.overhead_expenses.create` وأضف `payment_kind`:

دوّر على:
```ts
        const expense = await tx.overhead_expenses.create({
          data: {
            date: date ? new Date(date) : new Date(),
            category: category || null,
            description: description.trim(),
            amount,
            payment_method: payment_method || null,
            journal_entry_id: journalEntry.id,
            created_by: user.id,
            notes: notes || null,
            worker_id: worker_id || null,
          },
        });
```

استبدله بـ:
```ts
        const expense = await tx.overhead_expenses.create({
          data: {
            date: date ? new Date(date) : new Date(),
            category: category || null,
            description: description.trim(),
            amount,
            payment_method: payment_method || null,
            payment_kind: body.payment_kind || null,
            journal_entry_id: journalEntry.id,
            created_by: user.id,
            notes: notes || null,
            worker_id: worker_id || null,
          },
        });
```

- [ ] **Step 4: نفس الشيء في الفرع اللي بدون createJournal**

دوّر على `const expense = await prisma.overhead_expenses.create({` (الفرع الثاني، بعد الـ transaction) وأضف `payment_kind: body.payment_kind || null,` لـ `data:` بنفس النمط.

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/overhead/route.ts
git commit -m "feat(api/overhead): use 'أجور عمال' entry_type for worker wages + persist payment_kind"
```

---

## Task 5: شيل "أجور عمال" من فورم النثريات (`/overhead/new`)

**Files:**
- Modify: `src/app/overhead/_new-overhead-form.tsx` (كامل — تبسيط)

- [ ] **Step 1: اقرأ الكود الحالي**

افتح `src/app/overhead/_new-overhead-form.tsx` كامل. الفورم ده فيه منطق `isWages`
(Combobox للعامل) لما category="أجور عمال". محتاجين نشيل ده لأن أجور العمال
مدخلها بقى `/workers` بس.

- [ ] **Step 2: استبدل محتوى الملف كامل**

استبدل `src/app/overhead/_new-overhead-form.tsx` كامل بـ:

```tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUserStore } from "@/store/user-store"
import { useApiMutation } from "@/hooks/useApi"
import DashboardLayout from "@/components/layout/DashboardLayout"
import PageHeader from "@/components/PageHeader"
import { Input, Textarea, Select } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { formatCurrency } from "@/lib/format"
import { PAYMENT_METHOD_LABELS } from "@/lib/format"

// النثريات العامة فقط — أجور العمال بتتسجل من /workers.
const CATEGORIES = [
  { value: "", label: "— اختر التصنيف —" },
  { value: "نثريات عامة", label: "نثريات عامة" },
  { value: "غداء", label: "غداء" },
  { value: "كهرباء", label: "كهرباء" },
  { value: "شحن", label: "شحن / نقل" },
  { value: "صيانة", label: "صيانة" },
  { value: "أخرى", label: "أخرى" },
]

export default function NewOverheadForm() {
  const router = useRouter()
  const { user: profile } = useUserStore()
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "",
    description: "",
    amount: "",
    payment_method: "نقدي",
    notes: "",
  })
  const { mutate, loading: saving } = useApiMutation()
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description || !form.amount) {
      setError("البيان والمبلغ مطلوبين")
      return
    }
    setError(null)
    const { error: err } = await mutate("POST", "/api/overhead?create_journal=true", {
      date: form.date,
      category: form.category || null,
      description: form.description,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      notes: form.notes || null,
      worker_id: null,
    })
    if (err) { setError(err); return }
    router.push("/overhead")
    router.refresh()
  }

  if (!profile) return null
  return (
    <DashboardLayout profile={profile}>
      <PageHeader title="نثريات جديدة" subtitle="نثريات عامة، كهرباء، شحن، إلخ" backHref="/overhead" />
      <form onSubmit={onSubmit} className="card max-w-xl space-y-4">
        <Input label="التاريخ" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        <Select label="التصنيف" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={CATEGORIES} />
        <Input label="البيان *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="مثال: كهرباء المصنع، شحن بضاعة" required />
        <Input label="المبلغ *" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        <Select label="طريقة الدفع" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} options={Object.entries(PAYMENT_METHOD_LABELS).filter(([k]) => k !== "both" && k !== "كلاهما").map(([k, v]) => ({ value: k, label: v }))} />
        <Textarea label="ملاحظات" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        {form.amount && <div className="bg-brand-orange-light border border-brand-orange/20 text-brand-orange-dark p-3 rounded-lg text-sm">سيتم تسجيل الحركة تلقائياً في اليومية بمبلغ <strong>{formatCurrency(Number(form.amount))}</strong></div>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" loading={saving}>حفظ</Button>
        </div>
      </form>
    </DashboardLayout>
  )
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء.

- [ ] **Step 4: Commit**

```bash
git add src/app/overhead/_new-overhead-form.tsx
git commit -m "refactor(overhead): remove worker wages from overhead form - now only via /workers"
```

---

## Task 6: شيل "أجور عمال" من OverheadPanel في `/journal`

**Files:**
- Modify: `src/app/journal/_panels.tsx:303-352` (CATS + OverheadPanel)

- [ ] **Step 1: عدّل `CATS` — شيل "أجور عمال"**

في `src/app/journal/_panels.tsx`، عدّل `CATS` (حيادي سطر 303):

```ts
const CATS = [
  { value: "", label: "— اختر التصنيف —" },
  { value: "نثريات عامة", label: "نثريات عامة" },
  { value: "غداء", label: "غداء" },
  { value: "كهرباء", label: "كهرباء" },
  { value: "شحن", label: "شحن / نقل" },
  { value: "صيانة", label: "صيانة" },
  { value: "أخرى", label: "أخرى" },
];
```

- [ ] **Step 2: أبسّط OverheadPanel — شيل منطق isWages**

دوّر على `export function OverheadPanel({ onSaved }: { onSaved?: () => void }) {` واستبدلها كاملة بـ:

```tsx
export function OverheadPanel({ onSaved }: { onSaved?: () => void }) {
  const [form, setForm] = useState({
    date: todayStr(), category: "", description: "", amount: "",
    payment_method: "نقدي", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!form.description || !form.amount) { setErr("البيان والمبلغ مطلوبان"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/overhead?create_journal=true", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date, category: form.category || null, description: form.description,
          amount: Number(form.amount), payment_method: form.payment_method,
          notes: form.notes || null, worker_id: null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j?.error?.message || "خطأ"); return; }
      setMsg(`✅ تم تسجيل ${formatCurrency(Number(form.amount))}`);
      setForm(f => ({ ...f, description: "", amount: "", notes: "" }));
      onSaved?.();
    } finally { setSaving(false); }
  }
```

> **تنبيه:** الخطوة دي بتعدّل بداية الدالة (قبل `return`) بس. الجزء `return (...)
> ... JSX` اللي بعدها لازم يتعدّل برضه في Step 3 عشان يشيل الـ Combobox وعلامات
> isWages. افتح الملف وشوف الـ JSX كامل بعد الـ `submit` وعدّله يدويًا — شيل أي
> `{isWages && ...}`، شيل أي `workerId`/`workerName` state، شيل Combobox import لو
> بقت مش مستخدمة.

- [ ] **Step 3: عدّل JSX الـ return في OverheadPanel**

افتح `src/app/journal/_panels.tsx` وعدّل الـ JSX بتاع OverheadPanel:
- شيل أي بلوكات شرطية `{isWages && (...)}`.
- شيل الـ Combobox الخاص بالعامل.
- سيب باقي الفورم (category/description/amount/payment_method/notes) زي ما هو.
- لو `Combobox` بقت مش مستخدمة في الملف كله بعد كده، شيل الـ import بتاعها.

> لو لقيت صعوبة في تحديد الجزء بالظبط، اقرأ OverheadPanel كاملة (من `export function OverheadPanel` لحد نهايتها قبل `export function` التالية) واكتبها من جديد بدون منطق isWages.

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء. لو فيه تحذير عن `Combobox` غير مستخدمة، شيل الـ import.

- [ ] **Step 5: Commit**

```bash
git add src/app/journal/_panels.tsx
git commit -m "refactor(journal): remove worker wages from OverheadPanel"
```

---

## Task 7: شيل فلتر العمال من صفحة `/overhead`

**Files:**
- Modify: `src/app/overhead/page.tsx:55-56` + الجزء الـ JSX المرتبط

- [ ] **Step 1: اقرأ الكود**

افتح `src/app/overhead/page.tsx`. فيه `showWorkerFilter = categoryFilter === "أجور عمال"`
(سطر 56) والـ Combobox للعامل في الـ JSX. محتاجين نشيلهم.

- [ ] **Step 2: شيل `showWorkerFilter` وstate المرتبطة**

في `src/app/overhead/page.tsx`:
- شيل السطر `const showWorkerFilter = categoryFilter === "أجور عمال"`.
- شيل أي state للـ worker filter (مثل `workerFilter`, `setWorkerFilter`) لو موجودة.
- شيل "أجور عمال" من قائمة الـ category options في الـ filter لو موجودة كـ `<option>`.

- [ ] **Step 3: شيل الـ Combobox بتاع فلتر العمال من الـ JSX**

دوّر على أي `<Combobox` مرتبط بـ `showWorkerFilter` في JSX واحذفه. لو الـ import
`import Combobox` بقى مش مستخدم، احذفه.

- [ ] **Step 4: عدّل النصوص الإرشادية**

دوّر على `helpDescription="...أجور عمال..."` في `PageHeader` وعدّلها لـ:

```tsx
helpDescription="نثريات عامة، كهرباء، شحن، إلخ. أجور العمال بتتسجل من صفحة العمال."
```

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء.

- [ ] **Step 6: Commit**

```bash
git add src/app/overhead/page.tsx
git commit -m "refactor(overhead): remove worker filter - wages now via /workers"
```

---

## Task 8: تسجيل الموديول `factory_wallet` في `auth.ts`

**Files:**
- Modify: `src/lib/auth.ts:15-31` (ALL_MODULES)

- [ ] **Step 1: أضف الموديول بعد 'journal'**

في `src/lib/auth.ts`، عدّل `ALL_MODULES` وأضف الموديول الجديد بعد سطر journal:

```ts
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
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): register 'factory_wallet' module"
```

---

## Task 9: API جديد `GET /api/factory-wallet`

**Files:**
- Create: `src/app/api/factory-wallet/route.ts`

- [ ] **Step 1: أنشئ الملف**

أنشئ `src/app/api/factory-wallet/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-server';
import prisma from '@/lib/db/prisma';
import { INCOME_TYPES, EXPENSE_TYPES, PAYOUT_TYPES } from '@/lib/finance';

// ============================================================
// GET /api/factory-wallet
// ملخص محفظة المصنع التراكمي اليومي.
//   - يستثني القيود التمريرية (is_pass_through=true) تمامًا.
//   - يرجع: today (ملخص اليوم الحالي للكروت) + days (للجدول).
// ============================================================

interface DayBucket {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
  entries: any[];
}

function toNum(v: any): number {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission('factory_wallet', 'view');
    void user; // admin/branch_user check done

    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '7');
    const date_from = searchParams.get('date_from') || '';
    const date_to = searchParams.get('date_to') || '';

    // نافذة العرض (للجدول). افتراضيًا آخر N يوم.
    const now = new Date();
    let windowFrom: Date;
    let windowTo: Date;
    if (date_from && date_to) {
      windowFrom = new Date(date_from);
      windowTo = new Date(date_to);
    } else {
      windowTo = now;
      windowFrom = new Date();
      windowFrom.setDate(windowFrom.getDate() - (daysParam - 1));
    }
    const windowFromStr = windowFrom.toISOString().slice(0, 10);
    const windowToStr = windowTo.toISOString().slice(0, 10);
    const todayKey = now.toISOString().slice(0, 10);

    // 1) الرصيد الافتتاحي = صافي كل القيود قبل windowFrom (تراكمي من أول النظام)
    //    يستثني التمريري.
    const openingRows: Array<{ net: number }> = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(
         CASE
           WHEN entry_type = ANY($1::text[]) AND is_pass_through = false THEN amount
           WHEN entry_type = ANY($2::text[]) AND is_pass_through = false THEN -amount
           WHEN entry_type = ANY($3::text[]) AND is_pass_through = false THEN -amount
           ELSE 0
         END
       ), 0)::float8 AS net
       FROM mazaya.journal_entries
       WHERE date < $4::date`,
      INCOME_TYPES as readonly string[],
      EXPENSE_TYPES as readonly string[],
      PAYOUT_TYPES as readonly string[],
      windowFromStr
    );
    let runningBalance = toNum(openingRows[0]?.net);

    // 2) كل القيود في النافذة (مرتبة تصاعديًا للحساب التراكمي) + بياناتها الكاملة
    const entries: any[] = await prisma.$queryRawUnsafe(
      `SELECT je.*,
          CASE
            WHEN je.party_type = 'supplier' THEN s.name
            WHEN je.party_type = 'branch' THEN b.name
            WHEN je.party_type = 'contractor' THEN c.name
            ELSE NULL
          END AS party_name
       FROM mazaya.journal_entries je
       LEFT JOIN mazaya.suppliers s ON je.party_type = 'supplier' AND je.party_id = s.id
       LEFT JOIN mazaya.branches b ON je.party_type = 'branch' AND je.party_id = b.id
       LEFT JOIN mazaya.contractors c ON je.party_type = 'contractor' AND je.party_id = c.id
       WHERE je.date >= $1::date AND je.date <= $2::date
       ORDER BY je.date ASC, je.created_at ASC`,
      windowFromStr, windowToStr
    );

    // 3) جمّع القيود حسب اليوم واحسب الأرصدة
    const byDay = new Map<string, any[]>();
    for (const e of entries) {
      const key = (e.date as Date).toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(e);
    }

    const dayBuckets: DayBucket[] = [];
    const sortedDates = Array.from(byDay.keys()).sort(); // تصاعدي

    for (const date of sortedDates) {
      const dayRows = byDay.get(date)!;
      const income = dayRows
        .filter(r => (INCOME_TYPES as readonly string[]).includes(r.entry_type) && !r.is_pass_through)
        .reduce((s, r) => s + toNum(r.amount), 0);
      const expense = dayRows
        .filter(r => (EXPENSE_TYPES as readonly string[]).includes(r.entry_type) && !r.is_pass_through)
        .reduce((s, r) => s + toNum(r.amount), 0);
      const payout = dayRows
        .filter(r => (PAYOUT_TYPES as readonly string[]).includes(r.entry_type) && !r.is_pass_through)
        .reduce((s, r) => s + toNum(r.amount), 0);
      const net = income - expense - payout;
      const opening = runningBalance;
      const closing = opening + net;
      runningBalance = closing;
      dayBuckets.push({
        date,
        opening: Math.round(opening * 100) / 100,
        income: Math.round(income * 100) / 100,
        expense: Math.round(expense * 100) / 100 + Math.round(payout * 100) / 100, // المصروف شامل المدفوعات
        payout: Math.round(payout * 100) / 100,
        closing: Math.round(closing * 100) / 100,
        count: dayRows.length,
        entries: dayRows.map(e => ({ ...e, amount: toNum(e.amount) })),
      });
    }

    // 4) ملخص اليوم الحالي (للكروت)
    let todayBucket: DayBucket = {
      date: todayKey, opening: 0, income: 0, expense: 0, payout: 0, closing: 0, count: 0, entries: [],
    };
    // لو اليوم موجود في النافذة، ناخده منها. لو لأ، نحسبه لوحده.
    const inWindow = dayBuckets.find(d => d.date === todayKey);
    if (inWindow) {
      todayBucket = inWindow;
    } else if (todayKey > windowToStr) {
      // اليوم بعد النافذة: الرصيد الافتتاحي لليوم = آخر running balance = closing آخر يوم في النافذة
      // (نفس runningBalance الحالي بعد اللوب)
      todayBucket = {
        date: todayKey,
        opening: Math.round(runningBalance * 100) / 100,
        income: 0, expense: 0, payout: 0,
        closing: Math.round(runningBalance * 100) / 100,
        count: 0, entries: [],
      };
    } else {
      // اليوم قبل النافذة: نحسب الـ opening من القيود قبل اليوم
      const beforeToday: Array<{ net: number }> = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(
             CASE
               WHEN entry_type = ANY($1::text[]) AND is_pass_through = false THEN amount
               WHEN entry_type = ANY($2::text[]) AND is_pass_through = false THEN -amount
               WHEN entry_type = ANY($3::text[]) AND is_pass_through = false THEN -amount
               ELSE 0
             END
           ), 0)::float8 AS net
         FROM mazaya.journal_entries
         WHERE date < $4::date`,
        INCOME_TYPES as readonly string[],
        EXPENSE_TYPES as readonly string[],
        PAYOUT_TYPES as readonly string[],
        todayKey
      );
      const openingToday = toNum(beforeToday[0]?.net);
      todayBucket = {
        date: todayKey,
        opening: Math.round(openingToday * 100) / 100,
        income: 0, expense: 0, payout: 0,
        closing: Math.round(openingToday * 100) / 100,
        count: 0, entries: [],
      };
    }

    // 5) رتّب الأيام تنازليًا (الأحدث فوق) للجدول
    const daysDesc = [...dayBuckets].sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      ok: true,
      data: {
        today: todayBucket,
        days: daysDesc,
        current_balance: todayBucket.closing,
        window: { from: windowFromStr, to: windowToStr },
      },
    });
  } catch (e: any) {
    if (e.status === 401) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'غير مسجل الدخول' } }, { status: 401 });
    if (e.status === 403) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'غير مصرح' } }, { status: 403 });
    console.error('Error:', e);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: e?.message || 'حدث خطأ' } }, { status: 500 });
  }
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء.

- [ ] **Step 3: اختبر يدويًا (اختياري لو فيه DB شغّال)**

شغّل dev server (`npm run dev`) وافتح `/api/factory-wallet` بعد تسجيل دخول admin.
Expected: JSON فيه `today` و`days` و`current_balance`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/factory-wallet/route.ts
git commit -m "feat(api): add GET /api/factory-wallet — cumulative daily wallet with passthrough excluded"
```

---

## Task 10: صفحة `/factory-wallet` — الكروت + الجدول

**Files:**
- Create: `src/app/factory-wallet/page.tsx`
- Create: `src/app/factory-wallet/_wallet-cards.tsx`
- Create: `src/app/factory-wallet/_wallet-table.tsx`

- [ ] **Step 1: أنشئ `_wallet-cards.tsx` — الكروت الأربعة الثابتة**

أنشئ `src/app/factory-wallet/_wallet-cards.tsx`:

```tsx
"use client";
import { formatCurrency, formatDate } from "@/lib/format";

interface TodayData {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
}

export function WalletCards({ today }: { today: TodayData }) {
  const isNeg = (n: number) => n < 0;
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const dayName = dayNames[new Date(today.date + "T00:00:00").getDay()];

  return (
    <div className="mb-6">
      <div className="text-sm font-bold text-gray-700 mb-2">
        📅 {dayName} {formatDate(today.date)} (اليوم الحالي)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* بداية اليوم */}
        <div className="card bg-white border-r-4 border-gray-300">
          <div className="text-xs text-gray-500 font-bold">بداية اليوم</div>
          <div className={`text-2xl font-extrabold mb-1 ${isNeg(today.opening) ? "text-red-600" : "text-gray-800"}`}>
            {formatCurrency(today.opening)}
          </div>
          <div className="text-xs text-gray-400">رصيد آخر يوم قبله</div>
        </div>
        {/* وارد */}
        <div className="card bg-white border-r-4 border-green-400">
          <div className="text-xs text-gray-500 font-bold">وارد (اليوم)</div>
          <div className="text-2xl font-extrabold mb-1 text-green-600">
            +{formatCurrency(today.income)}
          </div>
          <div className="text-xs text-green-500/70">تحويلات المعارض</div>
        </div>
        {/* مصروف */}
        <div className="card bg-white border-r-4 border-red-400">
          <div className="text-xs text-gray-500 font-bold">مصروف (اليوم)</div>
          <div className="text-2xl font-extrabold mb-1 text-red-600">
            -{formatCurrency(today.expense)}
          </div>
          {today.payout > 0 && (
            <div className="text-xs text-red-400">منها {formatCurrency(today.payout)} للموردين</div>
          )}
        </div>
        {/* رصيد النهاية = الرصيد الحالي */}
        <div className={`card bg-gradient-to-br ${isNeg(today.closing) ? "from-red-500 to-red-700" : "from-brand-orange to-brand-orange-dark"} text-white`}>
          <div className="text-xs opacity-90 font-bold">رصيد النهاية (الحالي)</div>
          <div className="text-2xl font-extrabold mb-1">{formatCurrency(today.closing)}</div>
          <div className="text-xs opacity-80">بداية + وارد − مصروف</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: أنشئ `_wallet-table.tsx` — الجدول الموسع**

أنشئ `src/app/factory-wallet/_wallet-table.tsx`:

```tsx
"use client";
import { useState } from "react";
import { formatCurrency, formatDate, ENTRY_TYPE_LABELS, ENTRY_TYPE_COLORS, PAYMENT_METHOD_LABELS } from "@/lib/format";

interface DayEntry {
  id: string;
  date: string | Date;
  entry_type: string;
  description: string;
  amount: number;
  payment_method: string | null;
  party_name: string | null;
}

interface DayData {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
  entries: DayEntry[];
}

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// مكوّن منفصل لكل صف + تفاصيله الموسعة (يحل مشكلة Fragment+key جوّا map)
function DayRow({
  day,
  isOpen,
  onToggle,
}: {
  day: DayData;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const dName = DAY_NAMES[new Date(day.date + "T00:00:00").getDay()];
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-orange-50 transition"
      >
        <td className="p-3 font-semibold">
          {dName} {formatDate(day.date)}
          <span className="block text-xs text-gray-400">{day.count} حركة ▾</span>
        </td>
        <td className={`p-3 ${day.opening < 0 ? "text-red-600" : "text-gray-700"}`}>{formatCurrency(day.opening)}</td>
        <td className="p-3 text-green-600 font-bold">+{formatCurrency(day.income)}</td>
        <td className="p-3 text-red-600 font-bold">-{formatCurrency(day.expense)}</td>
        <td className={`p-3 font-extrabold ${day.closing < 0 ? "text-red-700" : "text-brand-orange-dark"}`}>
          {formatCurrency(day.closing)}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-orange-50/50">
          <td colSpan={5} className="p-3">
            <table className="w-full text-xs bg-white rounded-lg border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-right">النوع</th>
                  <th className="p-2 text-right">البيان</th>
                  <th className="p-2 text-right">الجهة</th>
                  <th className="p-2 text-right">الطريقة</th>
                  <th className="p-2 text-right">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {day.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="p-2"><span className={`badge ${ENTRY_TYPE_COLORS[e.entry_type] || ""}`}>{ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type}</span></td>
                    <td className="p-2">{e.description}</td>
                    <td className="p-2 text-gray-500">{e.party_name || "-"}</td>
                    <td className="p-2">{PAYMENT_METHOD_LABELS[e.payment_method] || "-"}</td>
                    <td className={`p-2 font-bold ${e.entry_type === "دفعة واردة من معرض" ? "text-green-600" : "text-red-600"}`}>{formatCurrency(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

export function WalletTable({ days }: { days: DayData[] }) {
  const [openDate, setOpenDate] = useState<string | null>(null);

  if (days.length === 0) {
    return (
      <div className="card text-center text-gray-500 py-12">
        مفيش حركات في الفترة دي. ابدأ بتسجيل دفعة من المعرض من صفحة اليومية.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="p-3 text-right">التاريخ</th>
            <th className="p-3 text-right">بداية اليوم</th>
            <th className="p-3 text-right text-green-700">وارد</th>
            <th className="p-3 text-right text-red-700">مصروف</th>
            <th className="p-3 text-right">رصيد النهاية</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {days.map((d) => (
            <DayRow
              key={d.date}
              day={d}
              isOpen={openDate === d.date}
              onToggle={() => setOpenDate(openDate === d.date ? null : d.date)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

> **ملاحظة:** استخدمنا مكوّن `DayRow` منفصل بدل Fragment جوّا `map()` عشان نتجنب
> مشكلة الـ key على Fragment ونبقي الكود أنظف (React 19 best practice).

- [ ] **Step 3: أنشئ `page.tsx` — تجميع الصفحة**

أنشئ `src/app/factory-wallet/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useUserStore } from "@/store/user-store";
import { useApi } from "@/hooks/useApi";
import { useCan } from "@/hooks/useCan";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { exportToExcel } from "@/lib/excel";
import { canSeeModule } from "@/lib/auth";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { WalletCards } from "./_wallet-cards";
import { WalletTable } from "./_wallet-table";

interface DayData {
  date: string;
  opening: number;
  income: number;
  expense: number;
  payout: number;
  closing: number;
  count: number;
  entries: any[];
}
interface WalletResponse {
  today: DayData;
  days: DayData[];
  current_balance: number;
  window: { from: string; to: string };
}

export default function FactoryWalletPage() {
  const { user: profile } = useUserStore();
  const { can } = useCan();
  const [range, setRange] = useState<7 | 30>(7);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const useCustom = Boolean(fromDate && toDate);
  const query = useCustom
    ? `/api/factory-wallet?date_from=${fromDate}&date_to=${toDate}`
    : `/api/factory-wallet?days=${range}`;
  const { data, loading } = useApi<WalletResponse>(query);

  if (!profile) return null;
  const canSee = canSeeModule(profile, "factory_wallet");
  void can;

  const today = data?.today ?? { date: new Date().toISOString().slice(0,10), opening:0, income:0, expense:0, payout:0, closing:0, count:0, entries:[] };
  const days = data?.days ?? [];

  if (!canSee) {
    return (
      <DashboardLayout profile={profile}>
        <div className="card text-center text-gray-500 py-12">🔒 هذه الصفحة للمصنع فقط.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout profile={profile}>
      <PageHeader
        title="محفظة المصنع"
        subtitle="الرصيد التراكمي اليومي — وارد من المعارض − مصروف"
        helpTitle="محفظة المصنع"
        helpDescription="الكروت فوق بتعكس اليوم الحالي. الجدول تحته فيه كل الأيام (اضغط أي يوم يشوف تفاصيله). التحويل التمريري مش بيدخل هنا لأنه معدّش على المحفظة."
        actions={<PWAInstallButton />}
      />

      {/* فلتر المدى */}
      <div className="card mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm font-bold text-gray-600">المدى:</div>
        <Button variant={range === 7 && !useCustom ? "primary" : "secondary"} size="sm" onClick={() => { setRange(7); setFromDate(""); setToDate(""); }}>آخر 7 أيام</Button>
        <Button variant={range === 30 && !useCustom ? "primary" : "secondary"} size="sm" onClick={() => { setRange(30); setFromDate(""); setToDate(""); }}>آخر 30 يوم</Button>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-2 py-1 border rounded text-sm" />
          <span className="text-gray-400">→</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-2 py-1 border rounded text-sm" />
        </div>
        <div className="mr-auto">
          <Button variant="secondary" size="sm" onClick={() => exportToExcel(days as any, "factory-wallet")} disabled={days.length === 0}>📥 تصدير</Button>
        </div>
      </div>

      {/* الكروت الأربعة الثابتة (اليوم الحالي) */}
      <WalletCards today={today} />

      {/* الجدول اليومي المفصّل */}
      <div className="text-sm font-bold text-gray-700 mb-2">📋 حركات الأيام</div>
      {loading ? (
        <div className="card text-center text-gray-400 py-12">جاري التحميل...</div>
      ) : (
        <WalletTable days={days} />
      )}
    </DashboardLayout>
  );
}
```

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء. لو فيه تحذيرات Fragment/key، صلّحها.

- [ ] **Step 5: build check**

Run: `npm run build`
Expected: build ناجح بدون أخطاء.

- [ ] **Step 6: Commit**

```bash
git add src/app/factory-wallet/
git commit -m "feat(factory-wallet): add wallet page with fixed today cards + daily expandable table"
```

---

## Task 11: صفحة `/workers` — إضافة تبويب "أجور العمال"

**Files:**
- Modify: `src/app/workers/page.tsx` (إضافة tabs + تبويب أجور)
- Create: `src/app/workers/_wages-tab.tsx`

- [ ] **Step 1: أنشئ `_wages-tab.tsx` — تبويب أجور العمال**

أنشئ `src/app/workers/_wages-tab.tsx`:

```tsx
"use client";
import { useMemo, useState } from "react";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { useCan } from "@/hooks/useCan";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";

interface Worker { id: string; name: string; phone?: string; }
interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  payment_kind: string | null;
  worker_id: string;
  notes: string | null;
}

export function WagesTab() {
  const { can } = useCan();
  const { data: workersData } = useApi<{ items: Worker[] }>("/api/workers?limit=500");
  const { data: ohData, refetch } = useApi<{ expenses: Expense[] }>("/api/overhead?limit=2000");
  const { mutate, loading: saving } = useApiMutation();

  const workers = workersData?.items ?? [];
  const allExpenses = ohData?.expenses ?? [];
  // فقط المصروفات المرتبطة بعامل (أجور)
  const wages = useMemo(() => allExpenses.filter(e => e.worker_id), [allExpenses]);

  // تجميع لكل عامل
  const stats = useMemo(() => {
    const m: Record<string, { qabd: number; salaf: number; last: string | null; entries: Expense[] }> = {};
    for (const w of workers) m[w.id] = { qabd: 0, salaf: 0, last: null, entries: [] };
    for (const e of wages) {
      if (!m[e.worker_id]) m[e.worker_id] = { qabd: 0, salaf: 0, last: null, entries: [] };
      const d = String(e.date).slice(0, 10);
      if (e.payment_kind === "سلفة") m[e.worker_id].salaf += Number(e.amount);
      else m[e.worker_id].qabd += Number(e.amount);
      if (!m[e.worker_id].last || d > m[e.worker_id].last!) m[e.worker_id].last = d;
      m[e.worker_id].entries.push(e);
    }
    return m;
  }, [wages, workers]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    worker_id: "", amount: "", payment_kind: "قبض", date: new Date().toISOString().slice(0, 10), notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const rowsWithStats = workers.map(w => ({
    ...w,
    qabd: stats[w.id]?.qabd ?? 0,
    salaf: stats[w.id]?.salaf ?? 0,
    net: (stats[w.id]?.qabd ?? 0) - (stats[w.id]?.salaf ?? 0),
    last: stats[w.id]?.last ?? null,
  })).filter(w => w.qabd > 0 || w.salaf > 0); // بس اللي ليهم أجور

  async function submitWage(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.worker_id || !form.amount) { setError("العامل والمبلغ مطلوبان"); return; }
    const workerName = workers.find(w => w.id === form.worker_id)?.name || "";
    const { error: err } = await mutate("POST", "/api/overhead?create_journal=true", {
      date: form.date,
      category: "أجور عمال",
      description: `أجر عامل: ${workerName}`,
      amount: Number(form.amount),
      payment_method: "نقدي",
      payment_kind: form.payment_kind,
      notes: form.notes || null,
      worker_id: form.worker_id,
    });
    if (err) { setError(err); return; }
    setShowForm(false);
    setForm(f => ({ ...f, amount: "", notes: "" }));
    refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          عدد العمال بأجور: <strong>{rowsWithStats.length}</strong> — إجمالي القبض:{" "}
          <strong className="text-green-600">{formatCurrency(rowsWithStats.reduce((s, w) => s + w.qabd, 0))}</strong> —
          إجمالي السلف: <strong className="text-red-600">{formatCurrency(rowsWithStats.reduce((s, w) => s + w.salaf, 0))}</strong>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportToExcel(rowsWithStats as any, "workers-wages")} disabled={rowsWithStats.length === 0}>📥 تصدير</Button>
          {can("overhead", "add") && <Button size="sm" onClick={() => setShowForm(v => !v)}>+ دفعة لعامل</Button>}
        </div>
      </div>

      {showForm && (
        <form onSubmit={submitWage} className="card grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">العامل *</label>
            <Select value={form.worker_id} onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
              options={[{ value: "", label: "— اختر —" }, ...workers.map(w => ({ value: w.id, label: w.name }))]} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">المبلغ *</label>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">النوع</label>
            <Select value={form.payment_kind} onChange={(e) => setForm({ ...form, payment_kind: e.target.value })}
              options={[{ value: "قبض", label: "قبض" }, { value: "سلفة", label: "سلفة" }]} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">التاريخ</label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={saving} size="sm">حفظ</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>إلغاء</Button>
          </div>
          <div className="md:col-span-5">
            <Input label="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <div className="md:col-span-5 bg-red-50 text-red-700 p-2 rounded text-sm">{error}</div>}
        </form>
      )}

      <DataTable
        rows={rowsWithStats}
        emptyMessage="مفيش عمال بأجور لسه. اضغط '+ دفعة لعامل' عشان تسجل."
        columns={[
          { key: "name", label: "الاسم", render: r => <span className="font-semibold text-brand-orange">{r.name}</span> },
          { key: "qabd", label: "إجمالي القبض", render: r => <span className="font-bold text-green-600">{formatCurrency(r.qabd)}</span> },
          { key: "salaf", label: "إجمالي السلف", render: r => <span className="font-bold text-red-600">{formatCurrency(r.salaf)}</span> },
          { key: "net", label: "الصافي", render: r => <span className={`font-bold ${r.net >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(r.net)}</span> },
          { key: "last", label: "آخر دفعة", render: r => r.last ? formatDate(r.last) : "-" },
          {
            key: "_expand", label: "تفاصيل",
            render: r => <Button size="sm" variant="secondary" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>📋</Button>,
          },
        ]}
      />

      {expanded && stats[expanded] && (
        <div className="card">
          <div className="font-bold mb-2 text-brand-orange">
            سجل أجور: {workers.find(w => w.id === expanded)?.name}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="p-2 text-right">التاريخ</th>
              <th className="p-2 text-right">النوع</th>
              <th className="p-2 text-right">المبلغ</th>
              <th className="p-2 text-right">ملاحظة</th>
            </tr></thead>
            <tbody className="divide-y">
              {stats[expanded].entries
                .slice()
                .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                .map(e => (
                  <tr key={e.id}>
                    <td className="p-2">{formatDate(String(e.date))}</td>
                    <td className="p-2">
                      <span className={`badge ${e.payment_kind === "سلفة" ? "bg-red-100 text-red-700 border-red-300" : "bg-green-100 text-green-700 border-green-300"}`}>
                        {e.payment_kind || "قبض"}
                      </span>
                    </td>
                    <td className={`p-2 font-bold ${e.payment_kind === "سلفة" ? "text-red-600" : "text-green-600"}`}>{formatCurrency(Number(e.amount))}</td>
                    <td className="p-2 text-gray-500">{e.notes || "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: عدّل `src/app/workers/page.tsx` — أضف tabs**

افتح `src/app/workers/page.tsx` كامل. حوّلها لصفحة بتبوين. بعد سطر الـ imports،
أضف import:

```ts
import { WagesTab } from "./_wages-tab";
```

أضف state للتبويب بعد باقي الـ state (قريب من `const [search, setSearch] = useState("")`):

```ts
const [tab, setTab] = useState<"workers" | "wages">("workers");
```

دوّر على أول `<div className="card` بعد `</PageHeader>` (قبل كروت الإحصائيات أو بعدها)
وأضف قبل الجدول الرئيسي (قبل `<DataTable`) شريط التبويب:

```tsx
      {/* تبويبات */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setTab("workers")}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition ${tab === "workers" ? "border-brand-orange text-brand-orange" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          🧑‍🔧 العمال
        </button>
        <button
          onClick={() => setTab("wages")}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition ${tab === "wages" ? "border-brand-orange text-brand-orange" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          💵 أجور العمال
        </button>
      </div>
```

دوّر على `<DataTable` الرئيسي (بتاع العمال) ولفّه بشرط:

```tsx
      {tab === "workers" ? (
        <DataTable
          // ... كله زي ما هو
        />
      ) : (
        <WagesTab />
      )}
```

> ضع الـ `{tab === "workers" ? ( <DataTable .../> ) : ( <WagesTab /> )}` مكان
> `<DataTable .../>` الحالي بالظبط. سيب باقي الصفحة (كروت الإحصائيات، الفلتر) زي ما هي،
> بس ممكن تخفيهم في تبويب "أجور العمال" لو حاب — تفضيل. الأسهل: سيبهم ظاهرين للاتنين.

- [ ] **Step 3: عدّل helpDescription في workers/page.tsx**

دوّر على `helpDescription="قائمة عمال المصنع...` وعدّلها:

```tsx
helpDescription="قائمة عمال المصنع. أجور كل عامل بتتسجل من تبويب 'أجور العمال'. الإجمالي بيتجمّع تلقائيًا."
```

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: لا أخطاء.

- [ ] **Step 5: build check**

Run: `npm run build`
Expected: build ناجح.

- [ ] **Step 6: Commit**

```bash
git add src/app/workers/
git commit -m "feat(workers): add 'wages' tab with per-worker qabd/salaf tracking + entry form"
```

---

## Task 12: تحديث الصلاحيات الافتراضية + onboarding (اختياري لكن مهم)

**Files:**
- Modify: `scripts/apply_permissions.py` (لو فيه default perms)

- [ ] **Step 1: شيك `scripts/apply_permissions.py`**

افتح `scripts/apply_permissions.py` ودوّر إن كان فيه mapping للموديولات والصلاحيات
الافتراضية. لو فيه، أضف `factory_wallet` بنفس نمط `journal` (view للأدمن، وممكن
للمصنع).

> لو الملف معقّد أو مش واضح، اسأل العميل: "إيه الصلاحيات الافتراضية لـ factory_wallet
> لكل role؟". الإفتراضي الآمن: admin بس يقدر يشوفها.

- [ ] **Step 2: Commit (لو فيه تعديل)**

```bash
git add scripts/apply_permissions.py
git commit -m "chore(permissions): add default perms for factory_wallet module"
```

---

## Task 13: اختبار تكامل يدوي (سيناريو كامل)

**Files:** لا تعديل — اختبار فقط

- [ ] **Step 1: شغّل dev server**

Run: `npm run dev`

- [ ] **Step 2: سجّل دخول كأدمن**

افتح `http://localhost:3000/login` وسجّل دخول أدمن.

- [ ] **Step 3: سيناريو: محفظة من pierwsze dwie ruchki**

1. روح `/journal`، اضغط "دفعة من معرض"، سجّل دفعة 1000.
2. روح `/journal`، اضغط "نثريات"، سجّل مصروف 400.
3. روح `/factory-wallet`.
4. **تحقق:**
   - الكروت: بداية اليوم = 0، وارد = 1000، مصروف = 400، رصيد النهاية = 600.
   - الجدول: صف اليوم فيه نفس الأرقام، اضغط عليه يفتح التفاصيل بحركتين.

- [ ] **Step 4: سيناريو: التمريري مستثنى**

1. روح `/journal`، سجّل تحويل تمريري: المعرض يحوّل 500 للمورد مباشرة.
2. ارجع `/factory-wallet`.
3. **تحقق:** الرصيد لسه 600. التمريري مش ظاهر في تفاصيل اليوم.
4. روح `/journal` (صفحة اليومية العادية) — التمريري ظاهر هناك (قيدين).

- [ ] **Step 5: سيناريو: أجور العمال**

1. روح `/workers/new`، أضف عامل "أحمد".
2. روح `/workers`، اضغط تبويب "أجور العمال".
3. اضغط "+ دفعة لعامل"، اختر "أحمد"، 200، "قبض".
4. اضغط "+ دفعة لعامل" تاني، اختر "أحمد"، 50، "سلفة".
5. **تحقق:** صف أحمد يبيّن القبض 200، السلف 50، الصافي 150.
6. اضغط 📋 يفتح سجل تفصيلي بحركتين.
7. روح `/factory-wallet` — المصروف زاد بـ 250 (الأجرين دخلو في المصروف).

- [ ] **Step 6: سيناريو: النثريات بدون أجور عمال**

1. روح `/overhead/new`.
2. **تحقق:** قائمة التصنيف مفيهاش "أجور عمال".
3. سجّل نثريات عامة 100.
4. روح `/factory-wallet` — المصروف زاد بـ 100.

- [ ] **Step 7: سيناريو: رصيد سالب**

1. روح `/journal`، سجّل نثريات 2000 (مصروف كبير).
2. روح `/factory-wallet`.
3. **تحقق:** الرصيد النهائي بالسالب (أحمر)، الجدول كله أرقامه مظبوطة تراكميًا.

- [ ] **Step 8: Commit (لا تعديل كود — بس توثيق إن السيناريوهات عدت)**

اكتب في آخر رسالتك للعميل: "كل السيناريوهات السبعة عدت بنجاح."

---

## Self-Review (شيك أخير بعد التنفيذ)

- [ ] كل القيود (income/expense/payout) بتدخل في المحفظة تلقائيًا عبر `finance.ts`.
- [ ] التمريري (`is_pass_through=true`) مستثنى من `/api/factory-wallet` و `/factory-wallet`.
- [ ] نوع "أجور عمال" في `EXPENSE_TYPES` ويحسب في المحفظة والميزانية.
- [ ] "أجور عمال" مش موجود في فورم النثريات (`/overhead/new` و `/journal` OverheadPanel).
- [ ] تبويب "أجور العمال" في `/workers` يفرّق بين قبض/سلفة.
- [ ] الكروت الأربعة بتعكس اليوم الحالي فقط، الجدول بكل الأيام.
- [ ] الموديول `factory_wallet` مسجّل في `auth.ts` ويظهر في السايدبار للأدمن.
- [ ] `npm run typecheck` + `npm run build` بدون أخطاء.
- [ ] `npm run test:inventory` لسه يعدّي (مفيش كسر).

---

## ملخص الـ Tasks

| # | المهمة | الملفات |
|---|---|---|
| 1 | نوع قيد "أجور عمال" في finance.ts | `src/lib/finance.ts`, test |
| 2 | labels/colors في format.ts | `src/lib/format.ts` |
| 3 | Migration payment_kind | `prisma/` |
| 4 | ربط category → entry_type في /api/overhead | `src/app/api/overhead/route.ts` |
| 5 | شيل أجور عمال من فورم النثريات | `src/app/overhead/_new-overhead-form.tsx` |
| 6 | شيل أجور عمال من journal panel | `src/app/journal/_panels.tsx` |
| 7 | شيل فلتر العمال من صفحة النثريات | `src/app/overhead/page.tsx` |
| 8 | تسجيل موديول factory_wallet | `src/lib/auth.ts` |
| 9 | API /api/factory-wallet | `src/app/api/factory-wallet/route.ts` |
| 10 | صفحة /factory-wallet | `src/app/factory-wallet/*` |
| 11 | تبويب أجور العمال في /workers | `src/app/workers/*` |
| 12 | صلاحيات افتراضية (اختياري) | `scripts/apply_permissions.py` |
| 13 | اختبار تكامل يدوي | — |

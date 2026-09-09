"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/user-store";
import PageHeader from "@/components/PageHeader";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Field { name: string; label: string; type?: string; required?: boolean; select?: { value: string; label: string }[]; rows?: number; }

interface Props {
  title: string; backHref: string; table: string;
  fields: Field[];
  successRedirect?: string;
  defaultValues?: Record<string, any>;
}

export default function NewEntityForm({ title, backHref, table, fields, successRedirect, defaultValues = {} }: Props) {
  const router = useRouter();
  const { user: profile } = useUserStore();
  const [form, setForm] = useState<Record<string, any>>(
    Object.fromEntries(fields.map(f => [f.name, defaultValues[f.name] ?? ""]))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const payload: any = {};
    fields.forEach(f => {
      const v = form[f.name];
      if (v === "" || v == null) { if (!f.required) payload[f.name] = null; }
      else payload[f.name] = f.type === "number" ? Number(v) : v;
    });
    const res = await fetch(`/api/${table.replace('mazaya_', '')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setError(result?.error?.message || 'حدث خطأ'); return; }
    router.push(successRedirect || backHref);
    router.refresh();
  }

  if (!profile) return null;
  return (
    <>
      <PageHeader title={title} backHref={backHref} />
      <form onSubmit={onSubmit} className="card max-w-2xl space-y-4">
        {fields.map(f => {
          if (f.select) return <Select key={f.name} label={f.label + (f.required ? " *" : "")} value={form[f.name]} onChange={e => setForm({ ...form, [f.name]: e.target.value })} options={[{ value: "", label: "— اختر —" }, ...f.select]} required={f.required} />;
          if (f.rows) return <Textarea key={f.name} label={f.label} rows={f.rows} value={form[f.name]} onChange={e => setForm({ ...form, [f.name]: e.target.value })} />;
          return <Input key={f.name} label={f.label + (f.required ? " *" : "")} type={f.type ?? "text"} step={f.type === "number" ? "0.01" : undefined} value={form[f.name]} onChange={e => setForm({ ...form, [f.name]: e.target.value })} required={f.required} />;
        })}
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={() => router.back()}>إلغاء</Button>
          <Button type="submit" loading={saving}>حفظ</Button>
        </div>
      </form>
    </>
  );
}

"use client";
// RowEditor: combines Edit/Delete buttons + inline modal for editing any row.
// Usage:
//   <RowEditor
//     row={row}
//     apiBase="/api/suppliers"
//     fields={[{ name: "name", label: "الاسم", required: true }, ...]}
//     onChanged={() => load()}
//   />
import { useState } from "react";
import { Button } from "./Button";
import { Input, Select, Textarea } from "./Input";

export type FieldDef =
  | { name: string; label: string; type?: "text" | "number" | "date"; required?: boolean; rows?: number }
  | { name: string; label: string; options: { value: string; label: string }[]; required?: boolean };

interface Props {
  row: any;
  apiBase: string;
  fields: FieldDef[];
  entityLabel?: string;
  onChanged?: () => void;
  refreshPage?: boolean;
  confirmDelete?: (row: any) => string | null; // return null to skip confirmation
  deleteHint?: string;
  extraButtons?: React.ReactNode;
  /** Hide the edit button when false (e.g. user lacks edit permission). Default true. */
  canEdit?: boolean;
  /** Hide the delete button when false (e.g. user lacks delete permission). Default true. */
  canDelete?: boolean;
}

export default function RowEditor({
  row, apiBase, fields, entityLabel = "السجل", onChanged,
  refreshPage = true, confirmDelete, deleteHint,
  extraButtons,
  canEdit = true,
  canDelete = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    fields.forEach(f => {
      const raw = row[f.name] ?? "";
      const isDateField = !("options" in f) && (f as any).type === "date";
      init[f.name] = isDateField && raw ? String(raw).slice(0, 10) : raw;
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (refreshPage) location.reload();
    else onChanged?.();
  };

  function openEdit() {
    setError(null);
    const init: Record<string, any> = {};
    fields.forEach(f => {
      const raw = row[f.name] ?? "";
      // حقول التاريخ: نرجع YYYY-MM-DD بس، لأن input[type=date] ما بيقبلش ISO كامل
      const isDateField = !("options" in f) && (f as any).type === "date";
      if (isDateField && raw) {
        init[f.name] = String(raw).slice(0, 10);
      } else {
        init[f.name] = raw;
      }
    });
    setForm(init);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: any = {};
      fields.forEach(f => {
        const v = form[f.name];
        const ftype = "options" in f ? "options" : (f as any).type;
        if (ftype === "number" && v !== "" && v != null) payload[f.name] = Number(v);
        else if (v === "" || v == null) payload[f.name] = null;
        else payload[f.name] = v;
      });
      const res = await fetch(`${apiBase}/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
      setOpen(false);
      refresh();
    } catch (e: any) {
      setError(e?.message ?? "خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const msg = confirmDelete ? confirmDelete(row) : `هل تريد حذف ${entityLabel} "${row.name ?? row.item_name ?? row.username ?? row.id}"؟\nلا يمكن التراجع عن هذا الإجراء.`;
    if (msg === null) return;
    if (msg !== "OK" && !confirm(msg)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/${row.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (deleteHint) alert(`${deleteHint}\n\nالتفاصيل: ${json?.error?.message || res.status}`);
        else alert("❌ " + (json?.error?.message || "خطأ في الحذف"));
        return;
      }
      refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-center gap-1">
        {canEdit && (
          <button
            onClick={openEdit}
            className="p-1.5 hover:bg-blue-100 rounded transition text-base"
            title="تعديل"
            aria-label="تعديل"
          >✏️</button>
        )}
        {canDelete && (
          <button
            onClick={remove}
            disabled={deleting}
            className="p-1.5 hover:bg-red-100 rounded transition text-base disabled:opacity-50"
            title="حذف"
            aria-label="حذف"
          >🗑️</button>
        )}
        {extraButtons}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-brand-black flex items-center gap-2">
                <span>✏️</span> تعديل: {row.name ?? row.item_name ?? row.username ?? entityLabel}
              </h2>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg" disabled={saving}>✕</button>
            </div>
            <form onSubmit={save} className="space-y-3">
              {fields.map(f => {
                if ("options" in f) {
                  return (
                    <Select
                      key={f.name}
                      label={f.label + (f.required ? " *" : "")}
                      value={form[f.name] ?? ""}
                      onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                      options={[{ value: "", label: "— اختر —" }, ...f.options]}
                    />
                  );
                }
                if (f.rows) {
                  return (
                    <Textarea
                      key={f.name}
                      label={f.label + (f.required ? " *" : "")}
                      rows={f.rows}
                      value={form[f.name] ?? ""}
                      onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  );
                }
                return (
                  <Input
                    key={f.name}
                    label={f.label + (f.required ? " *" : "")}
                    type={f.type ?? "text"}
                    step={f.type === "number" ? "0.01" : undefined}
                    value={form[f.name] ?? ""}
                    onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                    required={f.required}
                  />
                );
              })}
              {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>إلغاء</Button>
                <Button type="submit" loading={saving}>💾 حفظ التعديلات</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

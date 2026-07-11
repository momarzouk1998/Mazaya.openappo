"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export interface ComboboxOption {
  id: string;
  name: string;
}

interface ComboboxProps {
  label?: string;
  placeholder?: string;
  /** Endpoint returning { ok, data: { items: {id,name}[] } } or { items: ... } */
  endpoint: string;
  /** Value = selected id */
  value: string;
  onChange: (id: string, name?: string) => void;
  /** Extra fields to send when creating a new option via POST */
  createFields?: Record<string, any>;
  /** Whether to allow creating new options inline (default true) */
  allowCreate?: boolean;
  /** Auto-create new option on blur (no button needed). Requires allowCreate=true */
  autoCreateOnBlur?: boolean;
  hint?: string;
  nameKey?: string;
}

/**
 * Combobox: input بحث + قائمة منسدلة من API.
 * لو الاسم مش موجود → يظهر خيار "➕ إضافة: <الاسم>" ينشئه فوراً (POST endpoint)
 * ثم يختاره.
 */
export default function Combobox({
  label,
  placeholder = "ابحث أو أضف جديد...",
  endpoint,
  value,
  onChange,
  createFields,
  allowCreate = true,
  autoCreateOnBlur = false,
  hint,
  nameKey = "name",
}: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load all options once + when endpoint changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        const items = json?.data?.items ?? json?.items ?? [];
        const seen = new Set<string>();
        const mapped: ComboboxOption[] = [];
        for (const it of items) {
          const rawName = (it[nameKey] || it.name || '').trim();
          const lowerName = rawName.toLowerCase();
          if (!seen.has(lowerName)) {
            seen.add(lowerName);
            mapped.push({ id: String(it.id), name: rawName });
          }
        }
        setOptions(mapped);
        // Sync the display name when value changes externally
        if (value) {
          const found = mapped.find((m: ComboboxOption) => m.id === value);
          if (found) setSelectedName(found.name);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  // Keep display name in sync if value changes from outside
  useEffect(() => {
    if (!value) {
      setSelectedName("");
      return;
    }
    const found = options.find((o) => o.id === value);
    if (found) setSelectedName(found.name);
  }, [value, options]);

  // Auto-create on blur helper
  async function autoCreateIfNeeded() {
    const name = query.trim();
    if (!name || !allowCreate || !autoCreateOnBlur) return;
    const exact = options.some((o) => o.name.trim().toLowerCase() === name.toLowerCase());
    if (exact) {
      // select existing match
      const match = options.find((o) => o.name.trim().toLowerCase() === name.toLowerCase())!;
      handleSelect(match);
      return;
    }
    // auto-create
    setCreating(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(createFields || {}) }),
      });
      const json = await res.json();
      if (json?.ok && json?.data?.id) {
        const newOpt: ComboboxOption = { id: String(json.data.id), name: json.data.name || name };
        setOptions((prev) => [...prev, newOpt]);
        setSelectedName(newOpt.name);
        setQuery("");
        setOpen(false);
        onChange(newOpt.id, newOpt.name);
      }
    } catch { /* silent */ } finally {
      setCreating(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        if (autoCreateOnBlur && query.trim()) {
          autoCreateIfNeeded();
        } else {
          // restore selected name if open and no selection made
          const found = options.find((o) => o.id === value);
          setQuery("");
          if (found) setSelectedName(found.name);
          else if (!value) setSelectedName("");
        }
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, value, query, autoCreateOnBlur]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options.slice(0, 20);
    const q = query.toLowerCase();
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 20);
  }, [options, query]);

  const exactMatch = useMemo(
    () => options.some((o) => o.name.trim().toLowerCase() === query.trim().toLowerCase()),
    [options, query]
  );
  const canCreate = allowCreate && query.trim().length > 0 && !exactMatch;

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(createFields || {}) }),
      });
      const json = await res.json();
      if (json?.ok && json?.data?.id) {
        const newOpt: ComboboxOption = { id: String(json.data.id), name: json.data.name || name };
        setOptions((prev) => [...prev, newOpt]);
        setSelectedName(newOpt.name);
        setQuery("");
        setOpen(false);
        onChange(newOpt.id, newOpt.name);
      } else {
        alert(json?.error?.message || "فشل الإضافة");
      }
    } catch {
      alert("حدث خطأ أثناء الإضافة");
    } finally {
      setCreating(false);
    }
  }

  function handleSelect(opt: ComboboxOption) {
    setSelectedName(opt.name);
    setQuery("");
    setOpen(false);
    onChange(opt.id, opt.name);
  }

  function clearSelection() {
    setSelectedName("");
    onChange("", "");
    setQuery("");
    setOpen(true);
  }

  return (
    <div className="space-y-1.5" ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        {value && !open ? (
          // Show selected as a chip-like display
          <div className="flex items-center justify-between w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white">
            <span className="font-medium text-gray-800 truncate">{selectedName}</span>
            <button type="button" onClick={clearSelection} className="text-gray-400 hover:text-red-500 mr-2 flex-shrink-0" title="تغيير">✕</button>
          </div>
        ) : (
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // delay to allow click events on dropdown items
              setTimeout(() => {
                if (autoCreateOnBlur && query.trim() && open) {
                  autoCreateIfNeeded();
                }
              }, 200);
            }}
            placeholder={selectedName || placeholder}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
          />
        )}

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {loading && <div className="px-4 py-3 text-sm text-gray-400">جاري التحميل...</div>}
            {!loading && filtered.length === 0 && !canCreate && (
              <div className="px-4 py-3 text-sm text-gray-400">لا توجد نتائج</div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`w-full text-right px-4 py-2.5 hover:bg-brand-orange/10 border-b border-gray-50 last:border-0 ${
                  opt.id === value ? "bg-brand-orange/5 font-semibold" : ""
                }`}
              >
                {opt.name}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full text-right px-4 py-2.5 hover:bg-green-50 text-green-700 font-medium border-t-2 border-gray-100"
              >
                {creating ? "جاري الإضافة..." : `➕ إضافة: ${query.trim()}`}
              </button>
            )}
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

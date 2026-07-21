"use client";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import DateInput from "./DateInput";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", type, onChange, value, required, disabled, placeholder, ...rest }, ref) => {
    // حقول التاريخ → DateInput (DD/MM/YYYY بدل MM/DD/YYYY)
    if (type === "date") {
      return (
        <DateInput
          label={label}
          value={String(value ?? "")}
          onChange={onChange as any}
          required={required}
          hint={hint}
          error={error}
          className={className}
          placeholder={placeholder}
          disabled={disabled}
        />
      );
    }
    return (
      <div className="space-y-1.5">
        {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
            error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-brand-orange/30 focus:border-brand-orange"
          } ${className}`}
          {...rest}
        />
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string; error?: string; hint?: string; options: { value: string; label: string }[];
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, className = "", ...rest }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <select
        ref={ref}
        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
          error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-brand-orange/30 focus:border-brand-orange"
        } ${className}`}
        {...rest}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
);
Select.displayName = "Select";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", ...rest }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <textarea
        ref={ref}
        className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-y ${
          error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-brand-orange/30 focus:border-brand-orange"
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
);
Textarea.displayName = "Textarea";

"use client";
import NewEntityForm from "@/app/_new-entity-form";

export default function NewWorkerPage() {
  return (
    <NewEntityForm
      title="عامل جديد"
      backHref="/workers"
      table="mazaya_workers"
      fields={[
        { name: "name", label: "اسم العامل", required: true },
        { name: "phone", label: "رقم التواصل" },
        { name: "daily_rate", label: "اليومية العادية الافتراضية (ج.م)", type: "number" },
        { name: "travel_daily_rate", label: "يومية السفر الافتراضية (ج.م)", type: "number" },
        { name: "notes", label: "ملاحظات", rows: 3 },
      ]}
    />
  );
}

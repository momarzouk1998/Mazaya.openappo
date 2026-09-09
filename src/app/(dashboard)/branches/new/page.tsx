import NewEntityForm from "@/app/_new-entity-form";
export default function NewBranchPage() {
  return (
    <NewEntityForm
      title="معرض / فرع جديد"
      backHref="/branches"
      table="mazaya_branches"
      fields={[
        { name: "name", label: "اسم المعرض", required: true },
        { name: "location", label: "الموقع" },
        { name: "phone", label: "رقم التواصل" },
        { name: "notes", label: "ملاحظات", rows: 3 },
      ]}
    />
  );
}

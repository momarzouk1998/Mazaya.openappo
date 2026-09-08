import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "انتهت صلاحية الاشتراك" };

const DEFAULT_MSG =
  "عفواً، لقد انتهت صلاحية اشتراك هذا النظام. يرجى التواصل مع الإدارة لتجديد الاشتراك واستعادة الوصول.";

export default async function BlockedPage() {
  const h = await headers();
  const raw = h.get("x-sub-message");
  let message = DEFAULT_MSG;
  if (raw) {
    try {
      message = decodeURIComponent(raw);
    } catch {
      message = raw;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">انتهت صلاحية الاشتراك</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

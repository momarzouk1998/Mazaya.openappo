"use client";
import { useState } from "react";
import { useUserStore } from "@/store/user-store";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatDate } from "@/lib/format";

export default function ProfilePage() {
  const { user, initialized } = useUserStore();

  // password change form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [changing, setChanging] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);

    if (!currentPw || !newPw || !confirmPw) {
      setPwMessage({ type: "error", text: "❌ كل الحقول مطلوبة" });
      return;
    }
    if (newPw.length < 6) {
      setPwMessage({ type: "error", text: "❌ كلمة السر الجديدة لازم 6 حروف على الأقل" });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMessage({ type: "error", text: "❌ كلمة السر الجديدة مش مطابقة للتأكيد" });
      return;
    }
    if (newPw === currentPw) {
      setPwMessage({ type: "error", text: "❌ كلمة السر الجديدة لازم تكون مختلفة عن الحالية" });
      return;
    }

    setChanging(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMessage({ type: "error", text: `❌ ${data?.error?.message || data?.error || "خطأ"}` });
        return;
      }
      setPwMessage({ type: "success", text: "✅ تم تغيير كلمة السر بنجاح! السجل هيفضل مفتوح." });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      setPwMessage({ type: "error", text: `❌ خطأ: ${err?.message ?? "غير متوقع"}` });
    } finally {
      setChanging(false);
    }
  }

  if (!initialized) return <div className="min-h-screen flex items-center justify-center text-gray-500">جاري التحميل...</div>;
  if (!user) return null;

  const roleLabel = user.role === "admin" ? "مدير المصنع" : "موظف";
  const roleColor = user.role === "admin" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800";

  return (
    <>
      <PageHeader
        title="الملف الشخصي"
        subtitle="إدارة بيانات حسابك وكلمة المرور"
        helpTitle="الملف الشخصي"
        helpDescription="من هنا تقدر تشوف بيانات حسابك، وتغير كلمة السر الخاصة بيك. لو عايز تغير اسمك أو الإيميل، تواصل مع مدير المصنع."
        backHref="/journal"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
        {/* Account Info */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-orange to-brand-orange-dark flex items-center justify-center text-white text-2xl font-extrabold shadow-md">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-xl text-brand-black">{user.full_name || user.username}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className={`badge ${roleColor}`}>{roleLabel}</span>
                {!user.is_active && (
                  <span className="badge bg-red-100 text-red-800">🔒 معطل</span>
                )}
              </div>
            </div>
          </div>

          <h3 className="font-bold text-sm text-gray-700 mb-3 border-b pb-2">معلومات الحساب</h3>
          <div className="space-y-2.5 text-sm">
            <Row label="اسم المستخدم" value={user.username} />
            <Row label="الاسم الكامل" value={user.full_name || "—"} />
            <div>
              <span className="text-gray-500">الصفحات المرئية:</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.visible_modules.length > 0 ? (
                  user.visible_modules.map(m => (
                    <span key={m} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                      ✓ {moduleLabel(m)}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400">لا يوجد</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔐</span>
            <h2 className="font-bold text-xl text-brand-black">تغيير كلمة المرور</h2>
          </div>

          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور الحالية</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-2.5 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور الجديدة</label>
              <input
                type={showPw ? "text" : "password"}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="6 حروف على الأقل"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <PasswordStrength password={newPw} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">تأكيد كلمة المرور الجديدة</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="اكتبها تاني"
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  confirmPw && confirmPw !== newPw
                    ? "border-red-400 focus:ring-red-200"
                    : "border-gray-300 focus:ring-brand-orange/30 focus:border-brand-orange"
                }`}
                required
                autoComplete="new-password"
              />
              {confirmPw && confirmPw !== newPw && (
                <p className="text-xs text-red-600 mt-1">❌ كلمة السر مش مطابقة</p>
              )}
              {confirmPw && confirmPw === newPw && newPw.length >= 6 && (
                <p className="text-xs text-green-600 mt-1">✅ مطابقة</p>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPw}
                onChange={e => setShowPw(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-orange"
              />
              <span className="text-sm text-gray-700">إظهار كلمات السر</span>
            </label>

            {pwMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                pwMessage.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>
                {pwMessage.text}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg text-xs">
              💡 <strong>نصيحة:</strong> استخدم كلمة سر قوية فيها حروف كبيرة وصغيرة وأرقام ورموز. متستخدمش نفس الباسورد بتاع حسابات تانية.
            </div>

            <Button type="submit" loading={changing} className="w-full">
              💾 حفظ كلمة المرور الجديدة
            </Button>
          </form>
        </div>
      </div>

      {/* Additional info */}
      <div className="card mt-6 max-w-5xl">
        <h3 className="font-bold mb-3">📊 معلومات إضافية</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <Mini label="عدد الصفحات المرئية" value={user.visible_modules.length} icon="📋" />
          <Mini label="نوع الحساب" value={user.role === "admin" ? "مدير" : "موظف"} icon="👤" />
          <Mini label="معرّف المستخدم" value={`#${user.id}`} icon="🆔" />
        </div>
      </div>
    </>
  );
}

// Helpers
function Row({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-500 min-w-[140px]">{label}:</span>
      <span className="font-medium flex-1">{value}</span>
    </div>
  );
}
function Mini({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-bold text-brand-black">{value}</div>
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const longEnough = password.length >= 8;

  const score = [hasLower, hasUpper, hasNumber, hasSymbol, longEnough].filter(Boolean).length;
  const levels = [
    { color: "bg-red-500", label: "ضعيفة جداً" },
    { color: "bg-red-400", label: "ضعيفة" },
    { color: "bg-yellow-400", label: "متوسطة" },
    { color: "bg-green-400", label: "جيدة" },
    { color: "bg-green-600", label: "قوية جداً" },
  ];
  const level = levels[Math.min(score, levels.length - 1)];

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? level.color : "bg-gray-200"}`} />
        ))}
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className="text-gray-500">قوة كلمة السر:</span>
        <span className="font-medium">{score > 0 ? level.label : "أدخل كلمة سر"}</span>
      </div>
    </div>
  );
}

function moduleLabel(key: string): string {
  const labels: Record<string, string> = {
    suppliers: "الموردين",
    boards_inventory: "مخزون الألواح",
    accessories_inventory: "مخزون الاكسسوارات",
    branches: "المعارض",
    customers: "العملاء",
    orders: "الأوردرات",
    journal: "اليومية",
    overhead: "النثريات",
    contractors: "المقاولين",
    reports: "التقارير",
    users: "المستخدمين",
    material_types: "قوائم الاختيارات",
  };
  return labels[key] ?? key;
}

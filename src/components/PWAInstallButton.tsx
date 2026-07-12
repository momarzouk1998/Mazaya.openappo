"use client";
import { useEffect, useState } from "react";

/**
 * زر "تثبيت البرنامج" — بيستخدم beforeinstallprompt event.
 *
 * - لو المتصفح وقّت التثبيت (Chrome/Edge/Android)، الزر يظهر.
 *   لما المستخدم يضغط، نستدعي prompt() ونتثبّت.
 * - بعد التثبيت، الزر يختفي.
 * - على iOS اللي مش بيدعم الـ event، نعرض زر بيفتح تعليمات بسيطة.
 * - لو البرنامج متثبت أصلاً (display-mode: standalone)، الـ event
 *   مش بيطلع من الأساس فالزر مش هيظهر — طبيعي من غير كود إضافي.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** زر تثبيت PWA — بيظهر في السايد بار وكل مكان */
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIOS =
    typeof window !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setDeferredPrompt(null);
    }
  }

  if (installed) return null;

  if (deferredPrompt) {
    return (
      <>
        <button
          onClick={handleInstall}
          className="inline-flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-sm"
        >
          📱 تثبيت البرنامج
        </button>
      </>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSHint(true)}
          className="inline-flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-sm"
        >
          📱 تثبيت البرنامج
        </button>
        {showIOSHint && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowIOSHint(false)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-lg mb-3 text-brand-black">📱 تثبيت البرنامج على iPhone</h3>
              <ol className="space-y-2 text-sm text-gray-700 list-decimal pr-5">
                <li>اضغط زر المشاركة <span className="font-bold">􀈂</span> تحت في Safari.</li>
                <li>اختار <span className="font-bold">«إضافة إلى شاشة الرئيسية»</span>.</li>
                <li>اضغط <span className="font-bold">«إضافة»</span>.</li>
              </ol>
              <button
                onClick={() => setShowIOSHint(false)}
                className="mt-4 w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold py-2 rounded-lg"
              >
                تمام
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

/** بانر تثبيت عائم — بيظهر في أسفل الشاشة في كل الصفحات */
export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    // نتحقق لو المستخدم قفل البانر قبل كده (localStorage)
    if (localStorage.getItem("pwa_banner_dismissed")) {
      setDismissed(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIOS =
    typeof window !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("pwa_banner_dismissed", "1");
  }

  // لو متثبت أو تم إغلاقه أو مش متاح → ما نظهرش
  if (installed || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      {/* بانر عائم في أسفل الشاشة */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-[slideUp_0.3s_ease-out]">
        <div className="bg-brand-black text-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
          {/* شريط ملون */}
          <div className="h-1.5 bg-gradient-to-r from-brand-orange to-yellow-400" />
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* أيقونة */}
              <div className="shrink-0 w-12 h-12 bg-brand-orange rounded-xl flex items-center justify-center text-2xl shadow-lg">
                📲
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base text-white">ثبّت البرنامج على جهازك</h3>
                <p className="text-xs text-white/70 mt-0.5 leading-relaxed">
                  أضف التطبيق لشاشة الرئيسية للوصول السريع والعمل بدون إنترنت
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition"
                title="إغلاق"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={deferredPrompt ? handleInstall : () => setShowIOSHint(true)}
                className="flex-1 bg-brand-orange hover:bg-brand-orange-dark text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                <span className="text-lg">⬇</span>
                تحميل وتثبيت
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 text-white/50 hover:text-white/80 text-sm rounded-xl hover:bg-white/5 transition"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* تعليمات iOS */}
      {showIOSHint && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
          onClick={() => setShowIOSHint(false)}
        >
          <div
            className="bg-white rounded-t-3xl p-6 max-w-sm w-full shadow-xl animate-[slideUp_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4" />
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-brand-orange rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg">
                📲
              </div>
              <h3 className="font-bold text-lg text-brand-black">تثبيت البرنامج</h3>
              <p className="text-sm text-gray-500 mt-1">اتبع الخطوات التالية</p>
            </div>
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center font-bold text-xs">1</span>
                <span>اضغط زر المشاركة <span className="font-bold">􀈂</span> تحت في متصفح Safari</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center font-bold text-xs">2</span>
                <span>اختار <span className="font-bold">«إضافة إلى شاشة الرئيسية»</span></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 bg-brand-orange/10 text-brand-orange rounded-full flex items-center justify-center font-bold text-xs">3</span>
                <span>اضغط <span className="font-bold">«إضافة»</span> وخلص! 🎉</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSHint(false)}
              className="mt-5 w-full bg-brand-orange hover:bg-brand-orange-dark text-white font-bold py-3 rounded-xl transition-all"
            >
              فهمت ✓
            </button>
          </div>
        </div>
      )}
    </>
  );
}

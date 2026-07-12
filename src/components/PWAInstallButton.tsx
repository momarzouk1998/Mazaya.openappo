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

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // لو شغّال كـ app (مثبت)، ما نظهرش الزر.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      // نمنع الـ mini-infobar الافتراضي عشان نستخدم زرنا
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

  // iOS مش بيدعم beforeinstallprompt — نتكشف عليه
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

  // لو متثبت أصلاً، ما نظهرش حاجة
  if (installed) return null;

  // لو عندنا beforeinstallprompt (Chrome/Edge/Android) → زر التثبيت
  if (deferredPrompt) {
    return (
      <button
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-sm"
      >
        📱 تثبيت البرنامج
      </button>
    );
  }

  // لو iOS ومش متثبت → زر بيفتح تعليمات
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

  // متصفح مش بيدعم التثبيت أو لسه ما وقّتش → مش نظهر حاجة
  return null;
}

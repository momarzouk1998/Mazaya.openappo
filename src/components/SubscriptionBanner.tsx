"use client";
import { useEffect, useState } from "react";

/**
 * بانر تحذير الاشتراك (قرب ينتهي / فترة سماح).
 * بيقرأ الحالة من كوكي بيكتبها src/middleware.ts — صفر تأثير على الـ SSR
 * أو سرعة التنقّل.
 */
export function SubscriptionBanner() {
  const [info, setInfo] = useState<{ status: string; msg: string } | null>(null);

  useEffect(() => {
    const readCookie = (key: string) => {
      const m = document.cookie.match(new RegExp("(?:^|; )" + key + "=([^;]*)"));
      if (!m) return "";
      try {
        return decodeURIComponent(m[1]);
      } catch {
        return m[1];
      }
    };
    const status = readCookie("mz_sub_status");
    if (status === "expiring_soon" || status === "grace_period") {
      setInfo({ status, msg: readCookie("mz_sub_msg") });
    }
  }, []);

  if (!info) return null;

  const isGrace = info.status === "grace_period";
  return (
    <div
      className={`${
        isGrace ? "bg-red-500 text-white" : "bg-yellow-500 text-black"
      } px-4 py-2 text-center text-sm font-bold w-full shadow-sm`}
    >
      {info.msg ||
        (isGrace
          ? "النظام في فترة السماح — يرجى تجديد الاشتراك"
          : "اشتراك النظام قارب على الانتهاء")}
    </div>
  );
}

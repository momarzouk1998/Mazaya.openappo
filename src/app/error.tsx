"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-8 border border-red-200">
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">حدث خطأ</h1>
          <p className="text-gray-700 mb-4">
            {typeof error?.message === 'object'
              ? JSON.stringify(error.message)
              : String(error?.message || "حدث خطأ غير متوقع")}
          </p>
          {error.digest && <p className="text-xs text-gray-500 mb-4">Digest: <code>{error.digest}</code></p>}
          <details className="mb-4 bg-gray-50 p-3 rounded text-xs">
            <summary className="cursor-pointer font-medium">Stack trace (للتشخيص)</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap" dir="ltr">{error.stack}</pre>
          </details>
          <button onClick={() => reset()} className="btn-primary w-full">حاول مرة أخرى</button>
          <a href="/debug" className="block text-center mt-3 text-sm text-blue-600 hover:underline">صفحة التشخيص</a>
        </div>
      </body>
    </html>
  );
}

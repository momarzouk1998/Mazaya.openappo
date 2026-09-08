/**
 * هيكل تحميل عام للصفحات — بيظهر فوراً وقت الانتقال بدل الشاشة البيضا،
 * لحد ما محتوى الصفحة يجهز. تستخدمه ملفات loading.tsx في مجلدات الصفحات.
 */
export default function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="animate-pulse space-y-4 max-w-6xl mx-auto">
        {/* عنوان الصفحة */}
        <div className="h-8 w-56 bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-200 rounded" />

        {/* كروت ملخّص */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-24 bg-gray-200 rounded-xl" />
        </div>

        {/* شريط أدوات */}
        <div className="h-10 bg-gray-200 rounded" />

        {/* صفوف جدول */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

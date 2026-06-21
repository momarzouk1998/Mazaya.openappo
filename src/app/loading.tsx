export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block w-16 h-16 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium">جاري التحميل...</p>
      </div>
    </div>
  );
}

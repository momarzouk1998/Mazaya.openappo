interface ReportMeta {
  title: string;
  desc: string;
  icon: string;
}

interface ReportCardProps {
  title?: string;
  description?: string;
  icon?: string;
  meta?: ReportMeta;
  isExpanded: boolean;
  onToggle: () => void;
  loading: boolean;
  error: string;
  children: React.ReactNode;
}

export default function ReportCard({
  title, description, icon, meta,
  isExpanded, onToggle,
  loading, error, children,
}: ReportCardProps) {
  const t = title || meta?.title || '';
  const d = description || meta?.desc || '';
  const i = icon || meta?.icon || '📊';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{i}</span>
          <div className="text-right">
            <h3 className="text-base font-bold text-gray-900">{t}</h3>
            <p className="text-xs text-gray-500">{d}</p>
          </div>
        </div>
        <span className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          ) : children}
        </div>
      )}
    </div>
  );
}

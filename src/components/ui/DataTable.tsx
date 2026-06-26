'use client';

import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Pagination from './Pagination';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchable?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  excelFileName?: string;
  pageSize?: number;
  paginated?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  searchable = true,
  searchQuery = '',
  onSearchChange,
  filters,
  actions,
  emptyMessage = 'لا توجد بيانات',
  onRowClick,
  excelFileName = 'تصدير',
  pageSize = 20,
  paginated = false,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);

  const totalPages = paginated ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;

  const displayData = useMemo(() => {
    if (!paginated) return data;
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize, paginated]);

  const safePage = paginated ? Math.min(page, totalPages) : 1;
  if (safePage !== page) setPage(totalPages);

  const exportToExcel = () => {
    const exportData = data.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col) => {
        obj[col.label] = row[col.key];
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${excelFileName}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Search + Filters + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3 flex-wrap items-center">
          {searchable && onSearchChange && (
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                🔍
              </span>
            </div>
          )}
          {filters}
        </div>
        <div className="flex gap-2">
          {actions}
          <button
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            📥 تحميل Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      <span>جاري التحميل...</span>
                    </div>
                  </td>
                </tr>
              ) : displayData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                displayData.map((item, index) => (
                  <tr
                    key={(item.id as string) || index}
                    onClick={() => onRowClick?.(item)}
                    className={`${
                      onRowClick ? 'cursor-pointer hover:bg-orange-50/50' : 'hover:bg-gray-50/50'
                    } transition-colors`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 text-gray-700 whitespace-nowrap"
                      >
                        {col.render
                          ? col.render(item)
                          : (item[col.key] as React.ReactNode) || '-'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && paginated && data.length > pageSize && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          total={data.length}
          onPageChange={setPage}
        />
      )}

      {/* Summary */}
      {!loading && data.length > 0 && !paginated && (
        <div className="text-xs text-gray-500">
          إجمالي: {data.length} سجل
        </div>
      )}
    </div>
  );
}

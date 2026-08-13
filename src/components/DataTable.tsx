"use client";
import { ReactNode, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  loading?: boolean;
  pageSize?: number;
  enablePagination?: boolean;
}

export function DataTable<T extends { id?: number | string }>({ 
  columns, 
  rows, 
  emptyMessage = "لا توجد بيانات", 
  loading,
  pageSize = 50,
  enablePagination = true
}: Props<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = enablePagination ? Math.ceil(rows.length / pageSize) : 1;
  const startIndex = enablePagination ? (currentPage - 1) * pageSize : 0;
  const endIndex = enablePagination ? startIndex + pageSize : rows.length;
  const displayedRows = enablePagination ? rows.slice(startIndex, endIndex) : rows;

  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden border border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map(c => (
                <th key={c.key} style={{ width: c.width }} className={`px-4 py-3 text-right font-semibold text-gray-700 text-xs uppercase tracking-wider ${c.className || ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={columns.length} className="text-center py-12 text-gray-400">
                <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full"></div>
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-12 text-gray-400">{emptyMessage}</td></tr>
            ) : displayedRows.map((row, i) => (
              <tr key={row.id ?? i} className="hover:bg-gray-50 transition">
                {columns.map(c => (
                  <td key={c.key} className={`px-4 py-3 text-gray-800 whitespace-nowrap ${c.className || ""}`}>
                    {c.render ? c.render(row) : (row as any)[c.key] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {enablePagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            عرض {startIndex + 1}-{Math.min(endIndex, rows.length)} من {rows.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              السابق
            </button>
            <span className="px-3 py-1 text-sm bg-brand-orange text-white rounded">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

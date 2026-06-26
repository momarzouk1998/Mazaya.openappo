'use client';

import { useState, useMemo } from 'react';

interface UsePaginationOptions<T> {
  data: T[];
  pageSize?: number;
}

export function usePagination<T>({ data, pageSize = 20 }: UsePaginationOptions<T>) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const safePage = Math.min(page, totalPages);
  if (safePage !== page) setPage(totalPages);

  return {
    page: Math.min(page, totalPages),
    totalPages,
    pageSize,
    data: paginatedData,
    total: data.length,
    setPage,
    nextPage: () => setPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setPage((p) => Math.max(p - 1, 1)),
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

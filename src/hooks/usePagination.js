import { useState } from 'react';

/** Lightweight client-side pagination state for filtered lists and grids. */
export function usePagination(items, initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const visible = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  const changePageSize = (nextSize) => {
    setPageSize(nextSize);
    setPage(1);
  };

  return { page: safePage, setPage, pageSize, setPageSize: changePageSize, pages, total, visible };
}

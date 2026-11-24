import { useEffect, useMemo, useState } from 'react';

/** Shared sort + pagination state for table and grid views. */
export function useSortedPaged(rows, columns, { initialSort = null, pageSize: initialSize = 10 } = {}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const get = col.sortValue || ((r) => r[col.key]);
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { setPage(1); }, [rows.length, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);
  const toggleSort = (key) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  return { sorted, visible, sort, setSort, toggleSort, page, setPage, pages, pageSize, setPageSize, total: rows.length };
}

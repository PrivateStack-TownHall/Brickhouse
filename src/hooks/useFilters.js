import { useMemo, useState } from 'react';

/** Search + named filter state for list pages. */
export function useFilters(initial = {}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(initial);
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const active = useMemo(() => !!search || Object.values(filters).some(Boolean), [search, filters]);
  const clear = () => { setSearch(''); setFilters(Object.fromEntries(Object.keys(initial).map((k) => [k, '']))); };
  return { search, setSearch, filters, setFilter, active, clear };
}

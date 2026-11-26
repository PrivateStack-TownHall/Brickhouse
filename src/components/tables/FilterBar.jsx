import { FilterX } from 'lucide-react';
import SearchInput from './SearchInput';

/** Search + filter row above a table, with a Clear filters action and optional right toolbar. */
export default function FilterBar({ search, onSearch, placeholder, searchSize, active, onClear, clearLabel = 'Clear filters', right, children }) {
  return (
    <div className="bh-filterbar">
      {onSearch && <SearchInput className="bh-search" size={searchSize} value={search} onChange={onSearch} placeholder={placeholder} />}
      {children}
      {active && <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}><FilterX size={15} />{clearLabel}</button>}
      {right && <div className="bh-toolbar-right">{right}</div>}
    </div>
  );
}

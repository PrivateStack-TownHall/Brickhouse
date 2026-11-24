import { FilterX } from 'lucide-react';
import SearchInput from './SearchInput';

/** Search + filter row above a table, with a Clear filters action when anything is set. */
export default function FilterBar({ search, onSearch, placeholder, active, onClear, children }) {
  return (
    <div className="bh-filterbar">
      <SearchInput className="bh-search" value={search} onChange={onSearch} placeholder={placeholder} />
      {children}
      {active && <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}><FilterX size={15} />Clear filters</button>}
    </div>
  );
}

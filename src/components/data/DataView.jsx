import { useState } from 'react';
import { ArrowDownAZ, ArrowUpZA, FilterX } from 'lucide-react';
import Table from '../tables/Table';
import TableFooter from '../tables/TableFooter';
import SearchInput from '../tables/SearchInput';
import EmptyState from '../common/EmptyState';
import ViewToggle from './ViewToggle';
import EntityCard from './EntityCard';
import { useSortedPaged } from '../../hooks/useSortedPaged';

const readView = (key) => { try { return localStorage.getItem(`brickhouse.view.${key}`) || 'table'; } catch { return 'table'; } };
const saveView = (key, v) => { try { localStorage.setItem(`brickhouse.view.${key}`, v); } catch { /* storage unavailable */ } };

/**
 * List page body with a Table / Grid switch. Both views share search, filters, sorting and paging.
 * columns: table columns (also the sort options in grid view)
 * card(row): EntityCard props for grid view
 * viewKey: remembers the chosen view per page
 */
export default function DataView({
  viewKey, columns, rows, card, rowKey = (r) => r.id, initialSort, onRowClick, empty, noun = 'records',
  search, onSearch, searchPlaceholder, filters, filtersActive, onClearFilters,
}) {
  const [view, setViewState] = useState(() => readView(viewKey));
  const setView = (v) => { setViewState(v); saveView(viewKey, v); sp.setPageSize(v === 'grid' ? 12 : 10); };
  const sp = useSortedPaged(rows, columns, { initialSort, pageSize: view === 'grid' ? 12 : 10 });
  const sortable = columns.filter((c) => c.sortable !== false && c.label);
  return (
    <div className="bh-card">
      <div className="bh-filterbar">
        {onSearch && <SearchInput className="bh-search" value={search} onChange={onSearch} placeholder={searchPlaceholder} />}
        {filters}
        {filtersActive && <button type="button" className="btn btn-ghost btn-sm" onClick={onClearFilters}><FilterX size={15} />Clear filters</button>}
        <div className="bh-toolbar-right">
          {view === 'grid' && sortable.length > 0 && (
            <div className="d-flex align-items-center gap-1">
              <select className="form-select" style={{ minWidth: 0, width: 'auto' }} aria-label="Sort by" value={sp.sort?.key || ''} onChange={(e) => sp.setSort(e.target.value ? { key: e.target.value, dir: sp.sort?.dir || 'asc' } : null)}>
                <option value="">Sort: default</option>
                {sortable.map((c) => <option key={c.key} value={c.key}>Sort: {c.label}</option>)}
              </select>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Toggle sort direction" title="Toggle sort direction" disabled={!sp.sort}
                onClick={() => sp.setSort((s) => (s ? { ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' } : s))}>
                {sp.sort?.dir === 'desc' ? <ArrowUpZA size={17} /> : <ArrowDownAZ size={17} />}
              </button>
            </div>
          )}
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>
      {view === 'table' ? (
        <Table columns={columns} rows={sp.visible} rowKey={rowKey} sort={sp.sort} onSort={sp.toggleSort} onRowClick={onRowClick} startIndex={(sp.page - 1) * sp.pageSize} />
      ) : (
        rows.length > 0 && <div className="bh-grid">{sp.visible.map((r) => <EntityCard key={rowKey(r)} {...card(r)} />)}</div>
      )}
      {rows.length === 0 && (empty || <EmptyState title="No records match" message="Try a different search or clear the filters." />)}
      <TableFooter page={sp.page} pageSize={sp.pageSize} total={rows.length} pages={sp.pages} onPage={sp.setPage} onPageSize={sp.setPageSize}
        pageSizeOptions={view === 'grid' ? [12, 24, 48] : [10, 25, 50]} noun={noun} />
    </div>
  );
}

import Table from './Table';
import TableFooter from './TableFooter';
import EmptyState from '../common/EmptyState';
import { useSortedPaged } from '../../hooks/useSortedPaged';

/** Table with sorting, pagination and rows-per-page (no grid). For list pages with a grid, use DataView. */
export default function DataTable({ columns, rows, rowKey = (r) => r.id, pageSize = 10, initialSort, empty, onRowClick, footerNote, noun, compact = false }) {
  const sp = useSortedPaged(rows, columns, { initialSort, pageSize });
  const options = [...new Set([pageSize, 10, 25, 50])].sort((a, b) => a - b);
  return (
    <>
      <Table columns={columns} rows={sp.visible} rowKey={rowKey} sort={sp.sort} onSort={sp.toggleSort} onRowClick={onRowClick} startIndex={(sp.page - 1) * sp.pageSize} compact={compact} />
      {rows.length === 0 && (empty || <EmptyState title="No records match" message="Try a different search or clear the filters." />)}
      <TableFooter page={sp.page} pageSize={sp.pageSize} total={rows.length} pages={sp.pages} onPage={sp.setPage} onPageSize={sp.setPageSize} pageSizeOptions={options} note={footerNote} noun={noun} />
    </>
  );
}

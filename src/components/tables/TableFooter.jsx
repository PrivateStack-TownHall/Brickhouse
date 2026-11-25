import Pagination from './Pagination';

/** "Showing x–y of n" + rows-per-page + pagination, shared by table and grid views. */
export default function TableFooter({ page, pageSize, total, pages, onPage, onPageSize, pageSizeOptions = [10, 25, 50], note, noun = 'records' }) {
  if (!total) return null;
  return (
    <div className="bh-table-footer d-flex align-items-center justify-content-between flex-wrap gap-2">
      <span className="text-muted small">
        Showing {(page - 1) * pageSize + 1} – {Math.min(page * pageSize, total)} of {total} {noun}{note ? ` · ${note}` : ''}
      </span>
      <div className="d-flex align-items-center gap-3 ms-auto justify-content-end flex-wrap">
        {onPageSize && (
          <label className="d-flex align-items-center gap-2 m-0 text-muted small">
            Rows per page:
            <select className="form-select form-select-sm" style={{ width: 'auto' }} value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <Pagination page={page} pages={pages} onChange={onPage} />
      </div>
    </div>
  );
}

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cx } from '../../helpers';

/**
 * Presentational table. columns: [{ key, label, sub?, render?, sortable?=true, align?, width?, className? }]
 * Sorting state lives outside (useSortedPaged).
 */
export default function Table({ columns, rows, rowKey = (r) => r.id, sort, onSort, onRowClick, startIndex = 0, compact = false }) {
  return (
    <div className="bh-table-wrap">
      <table className={cx('bh-table', compact && 'compact')}>
        <thead>
          <tr>
            {columns.map((c) => {
              const sortable = c.sortable !== false && !!c.label && !!onSort;
              return (
                <th key={c.key} className={cx(sortable && 'sortable')} style={{ width: c.width, textAlign: c.align }} onClick={sortable ? () => onSort(c.key) : undefined}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <span className="d-inline-flex align-items-center gap-1">
                    <span>{c.label}{c.sub && <span className="sub">{c.sub}</span>}</span>
                    {sortable && (sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} opacity={0.4} />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} style={onRowClick ? { cursor: 'pointer' } : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.className} style={{ textAlign: c.align }}>
                  {c.render ? c.render(r, startIndex + i) : (r[c.key] ?? <span className="text-subtle">—</span>)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

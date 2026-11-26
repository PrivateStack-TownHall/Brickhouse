import { cx } from '../../helpers';

/** Renders string or object items as `.bh-chip` pills, with optional truncation. */
export default function ChipList({ items = [], max, getKey = (x) => x, getLabel = (x) => x, className = '', style }) {
  if (!items || items.length === 0) return null;
  const shown = max ? items.slice(0, max) : items;
  const overflow = max ? items.length - shown.length : 0;
  return (
    <div className={cx('d-flex flex-wrap gap-1', className)} style={style}>
      {shown.map((item) => (
        <span key={getKey(item)} className="bh-chip">{getLabel(item)}</span>
      ))}
      {overflow > 0 && <span className="bh-chip">+{overflow}</span>}
    </div>
  );
}

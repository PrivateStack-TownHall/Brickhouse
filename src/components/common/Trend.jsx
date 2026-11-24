import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

/**
 * Change indicator. delta: number (absolute) or null; percent: show as %.
 * Positive is green, negative red, zero neutral. `label` follows in muted text.
 */
export default function Trend({ delta, percent = false, label, invert = false }) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return label ? <span className="text-muted small">{label}</span> : null;
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const good = invert ? dir === 'down' : dir === 'up';
  const cls = dir === 'flat' ? 'flat' : good ? 'up' : 'down';
  const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Minus;
  const v = percent ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : `${delta > 0 ? '+' : ''}${delta}`;
  return (
    <span className="d-inline-flex align-items-center gap-1 flex-wrap">
      <span className={`bh-trend ${cls}`}><Icon size={13} strokeWidth={2.6} />{v}</span>
      {label && <span className="text-muted" style={{ fontSize: 12.5 }}>{label}</span>}
    </span>
  );
}

/** % change between two totals, or null when there is no baseline. */
export const pctChange = (current, previous) => (previous > 0 ? ((current - previous) / previous) * 100 : null);

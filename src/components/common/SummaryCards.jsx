import StatCard from './StatCard';

/** A single scrollable row keeps list summaries above the table. */
export default function SummaryCards({ items, min = 150, size = 'md' }) {
  return (
    <div className="bh-summary-cards" style={{ '--bh-summary-min': `${Math.min(min, 136)}px` }} role="region" aria-label="Summary filters" tabIndex={0}>
      {items.map(({ key, ...it }) => <StatCard key={key || it.label} size={size} {...it} />)}
    </div>
  );
}

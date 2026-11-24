/** Horizontal 100% bar with % labels and a counted legend. data: [{ label, value, color }] */
export default function StackedBar({ data, onSelect }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <div className="text-subtle">No records yet.</div>;
  return (
    <div>
      <div className="bh-stacked" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join(', ')}>
        {data.filter((d) => d.value > 0).map((d) => {
          const pct = (d.value / total) * 100;
          return (
            <div key={d.label} style={{ width: `${pct}%`, background: d.color, color: d.text || '#fff', cursor: onSelect ? 'pointer' : 'default' }} title={`${d.label}: ${d.value} (${Math.round(pct)}%)`} onClick={() => onSelect?.(d)}>
              {pct >= 7 ? `${Math.round(pct)}%` : ''}
            </div>
          );
        })}
      </div>
      <div className="d-flex flex-wrap gap-3 mt-3" style={{ fontSize: 13.5 }}>
        {data.map((d) => (
          <span key={d.label} className="d-inline-flex align-items-center gap-2" style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(d)}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
            {d.label} <span className="text-muted">({d.value})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

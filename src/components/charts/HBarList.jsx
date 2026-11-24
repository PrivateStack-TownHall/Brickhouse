import ChartEmpty from './ChartEmpty';
import { BRAND_SERIES } from './palette';

/** Horizontal ranked bars (HTML). data: [{ label, value, sub?, color? }] */
export default function HBarList({ data, color = BRAND_SERIES, valueSuffix = '', emptyMessage }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (!data.length || max === 0) return <ChartEmpty height={160} message={emptyMessage} />;
  return (
    <div className="d-flex flex-column gap-3">
      {data.map((d) => (
        <div key={d.key || d.label} title={`${d.label}: ${d.value}${valueSuffix}`}>
          <div className="d-flex justify-content-between gap-2 mb-1" style={{ fontSize: 13 }}>
            <span className="text-truncate fw-semibold">{d.label}{d.sub && <span className="text-subtle fw-normal ms-2">{d.sub}</span>}</span>
            <span className="fw-semibold">{d.value}{valueSuffix}</span>
          </div>
          <div style={{ height: 8, background: 'var(--bh-surface-muted)', borderRadius: 4 }}>
            <div style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value ? 4 : 0, height: '100%', borderRadius: 4, background: d.color || color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

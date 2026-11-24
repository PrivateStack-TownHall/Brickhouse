import { useState } from 'react';
import ChartEmpty from './ChartEmpty';

/** Donut with legend. data: [{ label, value, color }] */
export default function DonutChart({ data, size = 170, thickness = 26, centerLabel = 'Total', onSelect, centerValue, legendValue }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <ChartEmpty height={size} />;
  const r = size / 2 - 2;
  const ir = r - thickness;
  const c = size / 2;
  let angle = -Math.PI / 2;
  const gap = data.filter((d) => d.value > 0).length > 1 ? 0.025 : 0;
  const arcs = data.map((d, i) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const a0 = angle + gap / 2;
    const a1 = angle + sweep - gap / 2;
    angle += sweep;
    if (d.value <= 0 || a1 <= a0) return null;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad, a) => `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`;
    const full = d.value === total;
    const path = full
      ? `M${c - r},${c} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 M${c - ir},${c} a${ir},${ir} 0 1,1 ${2 * ir},0 a${ir},${ir} 0 1,1 ${-2 * ir},0`
      : `M${p(r, a0)} A${r},${r} 0 ${large} 1 ${p(r, a1)} L${p(ir, a1)} A${ir},${ir} 0 ${large} 0 ${p(ir, a0)} Z`;
    return <path key={d.label} d={path} fill={d.color} fillRule="evenodd" opacity={hover === null || hover === i ? 1 : 0.4}
      onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(d)} style={{ cursor: onSelect ? 'pointer' : 'default' }} />;
  });
  const shown = hover !== null ? data[hover] : null;
  return (
    <div className="d-flex align-items-center gap-4 flex-wrap">
      <svg width={size} height={size} style={{ width: size }} className="bh-chart flex-shrink-0" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join(', ')}>
        {arcs}
        <text x={c} y={c - 4} textAnchor="middle" style={{ fontSize: 26, fontWeight: 800, fill: 'var(--bh-text)', fontFamily: 'var(--bh-font-serif)' }}>{shown ? shown.value : (centerValue ?? total)}</text>
        <text x={c} y={c + 16} textAnchor="middle" style={{ fontSize: 11.5 }}>{shown ? shown.label : centerLabel}</text>
      </svg>
      <div className="d-flex flex-column gap-2" style={{ flex: '1 1 150px', minWidth: 150 }}>
        {data.map((d, i) => (
          <div key={d.label} className="d-flex align-items-center justify-content-between gap-3" style={{ fontSize: 13, cursor: onSelect ? 'pointer' : 'default', opacity: hover === null || hover === i ? 1 : 0.6 }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(d)}>
            <span><span className="bh-legend-swatch" style={{ background: d.color }} />{d.label}</span>
            {legendValue ? <span className="fw-semibold">{legendValue(d, total)}</span> : <span className="fw-semibold">{d.value} <span className="text-subtle fw-normal">({Math.round((d.value / total) * 100)}%)</span></span>}
          </div>
        ))}
      </div>
    </div>
  );
}

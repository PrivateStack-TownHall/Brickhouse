import { useState } from 'react';
import { useWidth } from './useWidth';
import ChartEmpty from './ChartEmpty';

function niceMax(v) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Multi-series line chart with crosshair tooltip.
 * labels: [string], tooltipLabels?: [string], series: [{ name, color, values }] */
export default function LineChart({ labels, tooltipLabels, series, height = 240, area = false, maxTicks = 8, ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const all = series.flatMap((s) => s.values);
  if (!labels?.length || !all.some((v) => v > 0)) return <div ref={ref}><ChartEmpty height={height} /></div>;
  const pad = { t: 12, r: 12, b: 26, l: 34 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = niceMax(Math.max(...all));
  const x = (i) => pad.l + (labels.length === 1 ? w / 2 : (i / (labels.length - 1)) * w);
  const y = (v) => pad.t + h - (v / max) * h;
  const every = Math.ceil(labels.length / maxTicks);
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - rect.left - pad.l;
    const i = Math.round((rel / w) * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, i)));
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg className="bh-chart" width={width} height={height} role="img" aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line className="grid" x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % every === 0 ? <text key={i} x={x(i)} y={height - 8} textAnchor="middle">{l}</text> : null))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' L');
          return (
            <g key={s.name}>
              {area && <path d={`M${x(0)},${y(0)} L${pts} L${x(s.values.length - 1)},${y(0)} Z`} fill={s.color} opacity={0.12} />}
              <path d={`M${pts}`} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="var(--bh-gray-500)" strokeDasharray="3 3" />
            {series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} stroke="var(--bh-surface)" strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="bh-chart-tooltip" style={{ left: Math.min(Math.max(x(hover), 90), width - 90), top: pad.t + 10, transform: 'translate(-50%, 0)' }}>
          <div className="fw-semibold mb-1">{(tooltipLabels || labels)[hover]}</div>
          {series.map((s) => (
            <div key={s.name}><span className="bh-legend-swatch" style={{ background: s.color }} />{s.name}: <strong>{s.values[hover]}</strong></div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useId, useState } from 'react';
import { useWidth } from './useWidth';
import ChartEmpty from './ChartEmpty';
import { BRAND_SERIES } from './palette';

function niceMax(v) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Vertical bar chart. data: [{ label, value, tooltip? }] */
export default function BarChart({ data, height = 220, color = BRAND_SERIES, valueLabel = 'value', maxTicks = 8, ariaLabel, gradient = false, maxBar = 36 }) {
  const [ref, width] = useWidth();
  const gid = `bg${useId().replace(/:/g, '')}`;
  const [hover, setHover] = useState(null);
  if (!data?.length || data.every((d) => !d.value)) return <div ref={ref}><ChartEmpty height={height} /></div>;
  const pad = { t: 10, r: 6, b: 26, l: 34 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const slot = w / data.length;
  const bw = Math.max(2, Math.min(maxBar, slot - (slot > 12 ? 4 : 2)));
  const every = Math.ceil(data.length / maxTicks);
  const ticks = [0, max / 2, max];
  const y = (v) => pad.t + h - (v / max) * h;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <svg className="bh-chart" width={width} height={height} role="img" aria-label={ariaLabel}>
        {gradient && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8803f" />
              <stop offset="100%" stopColor="#f6c39d" />
            </linearGradient>
          </defs>
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2;
          const bh = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * h);
          const r = Math.min(4, bw / 2, bh);
          const top = pad.t + h - bh;
          const path = bh > 0 ? `M${x},${pad.t + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${pad.t + h} Z` : '';
          return (
            <g key={d.label + i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={h} fill="transparent" />
              {path && <path d={path} fill={gradient ? `url(#${gid})` : color} opacity={hover === null || hover === i ? 1 : 0.45} />}
              {i % every === 0 && <text x={x + bw / 2} y={height - 8} textAnchor="middle">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="bh-chart-tooltip" style={{ left: pad.l + hover * slot + slot / 2, top: y(data[hover].value) }}>
          <strong>{data[hover].value}</strong> {valueLabel} · {data[hover].tooltip || data[hover].label}
        </div>
      )}
    </div>
  );
}

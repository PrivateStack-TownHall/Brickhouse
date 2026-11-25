import { useId } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import ChartEmpty from './ChartEmpty';

function CustomLineTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const tooltipLabel = payload[0]?.payload?.tooltipLabel || label;
    return (
      <div className="bh-chart-tooltip" style={{ position: 'relative', transform: 'none' }}>
        <div className="fw-semibold mb-1">{tooltipLabel}</div>
        {payload.map((p) => (
          <div key={p.name} className="d-flex align-items-center gap-1">
            <span className="bh-legend-swatch" style={{ background: p.color }} />
            <span>{p.name}: <strong>{p.value}</strong></span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

/**
 * Recharts-powered Multi-series line chart with optional area fill,
 * preserving exact theme series colors and styles.
 * labels: [string], tooltipLabels?: [string], series: [{ name, color, values }]
 */
export default function LineChart({
  labels,
  tooltipLabels,
  series,
  height = 240,
  area = false,
  maxTicks = 8,
  ariaLabel,
}) {
  const idPrefix = useId().replace(/:/g, '');
  const all = series.flatMap((s) => s.values || []);

  if (!labels?.length || !all.some((v) => v > 0)) {
    return (
      <div style={{ height }}>
        <ChartEmpty height={height} />
      </div>
    );
  }

  const chartData = labels.map((label, i) => {
    const row = { label, tooltipLabel: tooltipLabels ? tooltipLabels[i] : label };
    series.forEach((s) => {
      row[s.name] = s.values[i] ?? 0;
    });
    return row;
  });

  const interval = Math.max(0, Math.ceil(labels.length / maxTicks) - 1);

  return (
    <div style={{ width: '100%', height, position: 'relative' }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 12, right: 12, left: -22, bottom: 4 }}
        >
          {area && (
            <defs>
              {series.map((s, idx) => {
                const gradId = `area-grad-${idPrefix}-${idx}`;
                return (
                  <linearGradient key={gradId} id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                );
              })}
            </defs>
          )}
          <CartesianGrid
            stroke="var(--bh-border)"
            strokeDasharray="3 4"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            interval={interval}
            tick={{ fill: 'var(--bh-text-subtle)', fontSize: 11, fontFamily: 'var(--bh-font-sans)' }}
            axisLine={{ stroke: 'var(--bh-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--bh-text-subtle)', fontSize: 11, fontFamily: 'var(--bh-font-sans)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomLineTooltip />} />
          {series.map((s, idx) => {
            const gradId = `area-grad-${idPrefix}-${idx}`;
            return area ? (
              <Area
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 5, fill: s.color, stroke: 'var(--bh-surface)', strokeWidth: 2 }}
              />
            ) : (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: s.color, stroke: 'var(--bh-surface)', strokeWidth: 2 }}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

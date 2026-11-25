import { useId } from 'react';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import ChartEmpty from './ChartEmpty';
import { BRAND_SERIES } from './palette';

function CustomBarTooltip({ active, payload, valueLabel }) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bh-chart-tooltip" style={{ position: 'relative', transform: 'none' }}>
        <strong>{item.value}</strong> {valueLabel} · {item.tooltip || item.label}
      </div>
    );
  }
  return null;
}

/**
 * Recharts-powered Bar Chart preserving exact Brickhouse theme tokens and colors.
 * data: [{ label, value, tooltip? }]
 */
export default function BarChart({
  data,
  height = 220,
  color = BRAND_SERIES,
  valueLabel = 'value',
  maxTicks = 8,
  ariaLabel,
  gradient = false,
  maxBar = 36,
}) {
  const gid = `bg${useId().replace(/:/g, '')}`;

  if (!data?.length || data.every((d) => !d.value)) {
    return (
      <div style={{ height }}>
        <ChartEmpty height={height} />
      </div>
    );
  }

  const interval = Math.max(0, Math.ceil(data.length / maxTicks) - 1);

  return (
    <div style={{ width: '100%', height, position: 'relative' }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 10, right: 10, left: -22, bottom: 4 }}
        >
          {gradient && (
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e8803f" />
                <stop offset="100%" stopColor="#f6c39d" />
              </linearGradient>
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
          <Tooltip
            cursor={{ fill: 'rgba(232, 128, 63, 0.08)' }}
            content={<CustomBarTooltip valueLabel={valueLabel} />}
          />
          <Bar
            dataKey="value"
            fill={gradient ? `url(#${gid})` : color}
            maxBarSize={maxBar}
            radius={[4, 4, 0, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

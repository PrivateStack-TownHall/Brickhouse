import { useState } from 'react';
import { HEAT_RAMP } from './palette';
import { formatDate } from '../../helpers';

const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

/** Calendar heatmap. cells: [{ date, count }] (oldest → newest). Sequential single-hue ramp. */
export default function Heatmap({ cells, cell = 13, gap = 3 }) {
  const [hover, setHover] = useState(null);
  if (!cells.length) return null;
  const max = Math.max(1, ...cells.map((c) => c.count));
  const level = (n) => (n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5)));
  const first = new Date(cells[0].date);
  const offset = (first.getDay() + 6) % 7; // Monday-first rows
  const cols = Math.ceil((cells.length + offset) / 7);
  const left = 30;
  const top = 16;
  const width = left + cols * (cell + gap);
  const height = top + 7 * (cell + gap);
  let lastMonth = -1;
  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg className="bh-chart bh-heatmap" width={width} height={height + 26} style={{ width, minWidth: width }}>
        {DAYS.map((d, i) => <text key={i} x={0} y={top + i * (cell + gap) + cell - 2}>{d}</text>)}
        {cells.map((c, i) => {
          const pos = i + offset;
          const col = Math.floor(pos / 7);
          const row = pos % 7;
          const d = new Date(c.date);
          const showMonth = row === 0 && d.getMonth() !== lastMonth && col > 0;
          if (showMonth) lastMonth = d.getMonth();
          return (
            <g key={i}>
              {showMonth && <text x={left + col * (cell + gap)} y={10}>{d.toLocaleString('en', { month: 'short' })}</text>}
              <rect x={left + col * (cell + gap)} y={top + row * (cell + gap)} width={cell} height={cell} rx={2}
                fill={HEAT_RAMP[level(c.count)]} stroke={hover === i ? 'var(--bh-navy)' : 'none'}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
        <g transform={`translate(${left}, ${height + 8})`}>
          <text x={0} y={10}>Less</text>
          {HEAT_RAMP.map((f, i) => <rect key={i} x={30 + i * (cell + 2)} y={0} width={cell} height={cell} rx={2} fill={f} />)}
          <text x={34 + HEAT_RAMP.length * (cell + 2)} y={10}>More</text>
        </g>
      </svg>
      {hover !== null && (
        <div className="bh-chart-tooltip" style={{ left: left + Math.floor((hover + offset) / 7) * (cell + gap) + cell / 2, top: top + ((hover + offset) % 7) * (cell + gap) }}>
          <strong>{cells[hover].count}</strong> commits · {formatDate(cells[hover].date)}
        </div>
      )}
    </div>
  );
}

/** Label / value / trend rows (Development Summary). rows: [{ icon, label, value, trend, tone }] */
export default function MetricList({ rows }) {
  return (
    <div>
      {rows.map(({ icon: Icon, label, value, trend, tone = 'orange' }) => (
        <div key={label} className="bh-metric-row">
          {Icon && <Icon size={17} color={`var(--bh-${tone === 'orange' ? 'orange' : tone})`} />}
          <span className="flex-grow-1">{label}</span>
          <strong className="text-end" style={{ minWidth: 54 }}>{value}</strong>
          <span className="text-end" style={{ minWidth: 74 }}>{trend}</span>
        </div>
      ))}
    </div>
  );
}

/** Thin horizontal bar (0–100). */
export default function ProgressBar({ value, color = 'var(--bh-orange)', label }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="d-flex align-items-center gap-2">
      <div className="bh-progress flex-grow-1" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="small fw-semibold" style={{ minWidth: 38, textAlign: 'right' }}>{Math.round(v)}%</span>
    </div>
  );
}

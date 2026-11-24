export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="bh-empty">
      <div className="spinner-border spinner-border-sm text-secondary me-2" role="status" />
      <span>{label}</span>
    </div>
  );
}

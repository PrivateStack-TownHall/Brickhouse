import { FlaskConical } from 'lucide-react';

/** Marks illustrative (non-live) data. */
export default function SampleDataBadge({ label = 'Sample data' }) {
  return (
    <span className="bh-badge bh-tone-warning" title="Illustrative values generated locally. No Git provider is connected.">
      <FlaskConical size={12} /> {label}
    </span>
  );
}

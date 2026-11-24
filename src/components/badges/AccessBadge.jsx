import StatusBadge from './StatusBadge';

/** Repository access check result. */
export default function AccessBadge({ value }) {
  const v = value || 'unknown';
  return <StatusBadge value={v} label={v === 'inaccessible' ? 'Inaccessible (404)' : v === 'accessible' ? 'Accessible' : 'Not checked'} />;
}

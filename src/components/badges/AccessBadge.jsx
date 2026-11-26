import StatusBadge from './StatusBadge';
import { ACCESS_STATUS_LABELS } from '../../constants/registry';

/** Repository access check result. */
export default function AccessBadge({ value }) {
  const v = value || 'unknown';
  return <StatusBadge value={v} label={ACCESS_STATUS_LABELS[v] || ACCESS_STATUS_LABELS.unknown} />;
}

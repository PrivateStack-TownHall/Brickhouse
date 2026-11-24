import { titleCase } from '../../helpers';

const TONES = {
  // lifecycle
  active: 'success', development: 'info', testing: 'warning', maintenance: 'orange', archived: 'gray', planning: 'navy',
  // deployments / infrastructure / technology
  failed: 'danger', inactive: 'gray', deprecated: 'warning', evaluating: 'info',
  // visibility
  private: 'navy', public: 'info', internal: 'gray', unknown: 'gray',
  // repository access
  accessible: 'success', inaccessible: 'danger',
  // pull requests
  open: 'info', merged: 'success', closed: 'gray',
  // environments
  production: 'success', staging: 'warning', preview: 'gray',
  // misc
  provider: 'orange', consumer: 'info', connected: 'success', 'not connected': 'gray',
  error: 'danger', warning: 'warning', ok: 'success',
};

export default function StatusBadge({ value, label, tone, dot = true }) {
  if (!value && !label) return <span className="text-subtle">—</span>;
  const t = tone || TONES[String(value).toLowerCase()] || 'gray';
  return (
    <span className={`bh-badge bh-tone-${t}`}>
      {dot && <span className="dot" />}
      {label || titleCase(value)}
    </span>
  );
}

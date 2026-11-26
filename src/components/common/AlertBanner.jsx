const TONE_STYLES = {
  warning: undefined,
  info: { background: 'var(--bh-info-soft)', borderColor: 'rgba(47,111,178,.3)' },
  danger: { background: 'var(--bh-danger-soft)', borderColor: 'rgba(225,85,84,.35)' },
  success: { background: 'var(--bh-success-soft)', borderColor: 'rgba(46,125,91,.3)' },
};

const TONE_ICON_COLORS = {
  warning: 'var(--bh-warning)',
  info: 'var(--bh-info)',
  danger: 'var(--bh-danger)',
  success: 'var(--bh-success)',
};

/** Consistent callout banner using `.bh-sample-banner` semantics. */
export default function AlertBanner({ tone = 'warning', icon: Icon, iconColor, className = '', style, actions, role, children }) {
  const mergedStyle = { ...(TONE_STYLES[tone] || {}), ...style };
  const resolvedIconColor = iconColor ?? (tone === 'warning' ? undefined : TONE_ICON_COLORS[tone]);
  return (
    <div className={`bh-sample-banner ${className}`.trim()} style={Object.keys(mergedStyle).length ? mergedStyle : undefined} role={role}>
      <div className="d-flex align-items-start gap-2 flex-grow-1 min-w-0">
        {Icon && <Icon size={18} color={resolvedIconColor} className="flex-shrink-0 mt-1" />}
        <div className="min-w-0 flex-grow-1">{children}</div>
      </div>
      {actions}
    </div>
  );
}

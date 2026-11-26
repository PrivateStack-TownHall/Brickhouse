import { cx } from '../../helpers';

export default function SectionCard({
  icon: Icon,
  title,
  subtitle,
  count,
  badge,
  actions,
  children,
  footer,
  variant = 'default',
  className = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  flush = true,
  noBody = false,
  fullHeight = true,
}) {
  const colored = variant === 'colored';
  const titleNode = (
    <h3 className="bh-card-title">
      {title}
      {count !== undefined && (
        <> <span className="bh-card-count">{typeof count === 'number' ? `(${count})` : count}</span></>
      )}
    </h3>
  );

  return (
    <div className={cx('bh-card d-flex flex-column min-w-0', fullHeight && 'h-100', className)} style={{ maxWidth: '100%' }}>
      <div className={cx('bh-card-header', colored ? 'colored' : flush && 'flush', headerClassName)}>
        {colored ? (
          <div className="d-flex align-items-center">
            {Icon && (
              <span className="bh-card-header-icon">
                <Icon size={18} />
              </span>
            )}
            <div>
              {badge ? (
                <div className="d-flex gap-2 align-items-center flex-wrap">
                  {titleNode}
                  {badge}
                </div>
              ) : titleNode}
              {subtitle && <p className="bh-card-sub">{subtitle}</p>}
            </div>
          </div>
        ) : (
          <div className="d-flex gap-3 align-items-start min-w-0">
            {Icon && <Icon size={26} className="bh-card-icon mt-1" strokeWidth={2} />}
            <div className="min-w-0">
              <div className="d-flex align-items-center gap-2 flex-wrap">{titleNode}{badge}</div>
              {subtitle && <p className="bh-card-sub">{subtitle}</p>}
            </div>
          </div>
        )}
        {actions && (colored ? actions : (
          <div className="d-flex gap-2 flex-wrap justify-content-end align-items-center">{actions}</div>
        ))}
      </div>
      {noBody ? (
        <div className="flex-grow-1 min-w-0 d-flex flex-column" style={{ maxWidth: '100%', overflowX: 'auto' }}>{children}</div>
      ) : (
        <div className={cx('bh-card-body flex-grow-1 min-w-0', bodyClassName)} style={{ maxWidth: '100%' }}>{children}</div>
      )}
      {footer && <div className={cx('bh-wizard-footer', footerClassName)}>{footer}</div>}
    </div>
  );
}

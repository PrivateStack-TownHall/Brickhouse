import { cx } from '../../helpers';

export default function SectionCard({ icon: Icon, title, subtitle, badge, actions, children, className = '', bodyClassName = '', flush = true, noBody = false, fullHeight = true }) {
  return (
    <div className={cx('bh-card d-flex flex-column min-w-0', fullHeight && 'h-100', className)} style={{ maxWidth: '100%' }}>
      <div className={cx('bh-card-header', flush && 'flush')}>
        <div className="d-flex gap-3 align-items-start min-w-0">
          {Icon && <Icon size={26} className="bh-card-icon mt-1" strokeWidth={2} />}
          <div className="min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap"><h3 className="bh-card-title">{title}</h3>{badge}</div>
            {subtitle && <p className="bh-card-sub">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="d-flex gap-2 flex-wrap justify-content-end align-items-center">{actions}</div>}
      </div>
      {noBody ? (
        <div className="flex-grow-1 min-w-0" style={{ maxWidth: '100%', overflowX: 'auto' }}>{children}</div>
      ) : (
        <div className={cx('bh-card-body flex-grow-1 min-w-0', bodyClassName)} style={{ maxWidth: '100%' }}>{children}</div>
      )}
    </div>
  );
}

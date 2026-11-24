import { cx } from '../../helpers';

/** Card with the mockup header: orange icon, serif title, subtitle, actions on the right. */
export default function SectionCard({ icon: Icon, title, subtitle, badge, actions, children, className = '', bodyClassName = '', flush = true, noBody = false }) {
  return (
    <div className={cx('bh-card h-100 d-flex flex-column', className)}>
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
      {noBody ? children : <div className={cx('bh-card-body flex-grow-1', bodyClassName)}>{children}</div>}
    </div>
  );
}

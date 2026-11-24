import { motion } from 'framer-motion';
import { cx } from '../../helpers';
import BrickPattern from './BrickPattern';

export default function StatCard({ label, value, icon: Icon, tone = 'orange', hint, trend, onClick, active, size = 'md', brick = true }) {
  const cls = cx('bh-card bh-stat', size === 'lg' ? 'lg' : 'md', onClick && 'clickable');
  const a11y = {
    onClick, role: onClick ? 'button' : undefined, tabIndex: onClick ? 0 : undefined, 'aria-pressed': onClick ? !!active : undefined,
    onKeyDown: onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined,
    style: active ? { borderColor: 'var(--bh-orange)', boxShadow: '0 0 0 3px var(--bh-orange-soft)' } : undefined,
  };
  const motionProps = onClick ? {
    whileHover: { y: -3, transition: { duration: 0.15 } },
    whileTap: { scale: 0.98 },
  } : {};

  if (size !== 'lg') {
    return (
      <motion.div className={cls} {...a11y} {...motionProps}>
        <div className="d-flex align-items-center gap-2 min-w-0">
          {Icon && <span className={`bh-stat-icon bh-tone-${tone}`}><Icon size={18} /></span>}
          <div className="bh-stat-label">{label}</div>
        </div>
        <div className="bh-stat-value" style={{ position: 'relative', zIndex: 1 }}>{value}</div>
        {trend && <div style={{ position: 'relative', zIndex: 1 }}>{trend}</div>}
        {hint && <div className="bh-stat-hint" style={{ position: 'relative', zIndex: 1, marginTop: 0 }}>{hint}</div>}
        {brick && <BrickPattern />}
      </motion.div>
    );
  }
  return (
    <motion.div className={cls} {...a11y} {...motionProps}>
      {Icon && <span className={`bh-stat-icon bh-tone-${tone}`}><Icon size={26} /></span>}
      <div className="min-w-0" style={{ position: 'relative', zIndex: 1 }}>
        <div className="bh-stat-label">{label}</div>
        <div className="bh-stat-value">{value}</div>
        {trend && <div className="mt-1">{trend}</div>}
        {hint && <div className="bh-stat-hint">{hint}</div>}
      </div>
      {brick && <BrickPattern />}
    </motion.div>
  );
}

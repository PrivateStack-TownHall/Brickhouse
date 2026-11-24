import { motion } from 'framer-motion';
import { cx } from '../../helpers';

export default function DetailTabs({ tabs, active, onChange }) {
  return (
    <div className="bh-tabs" role="tablist">
      {tabs.map(({ key, label, icon: Icon, count }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cx('bh-tab', isActive && 'active')}
            onClick={() => onChange(key)}
            style={{ position: 'relative' }}
          >
            {Icon && <Icon size={15} />}
            <span>{label}</span>
            {count !== undefined && <span className="count">{count}</span>}
            {isActive && (
              <motion.div
                layoutId="activeTabIndicator"
                style={{
                  position: 'absolute',
                  bottom: -1,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'var(--bh-orange)',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

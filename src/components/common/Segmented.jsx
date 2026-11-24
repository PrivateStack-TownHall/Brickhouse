import { motion } from 'framer-motion';
import { cx } from '../../helpers';

export default function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div className="bh-segment" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const isActive = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className={cx(isActive && 'active')}
            onClick={() => onChange(o.value)}
            aria-pressed={isActive}
            style={{ position: 'relative' }}
          >
            <span style={{ position: 'relative', zIndex: 1 }}>{o.label}</span>
            {isActive && (
              <motion.span
                layoutId="segmentedIndicator"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 6,
                  background: 'var(--bh-surface)',
                  boxShadow: 'var(--bh-shadow-xs)',
                  zIndex: 0,
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

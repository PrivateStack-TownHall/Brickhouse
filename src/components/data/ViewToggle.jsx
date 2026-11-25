import { motion } from 'framer-motion';
import { LayoutGrid, List } from 'lucide-react';

const OPTIONS = [
  { value: 'table', label: 'Table view', icon: List, size: 18 },
  { value: 'grid', label: 'Grid view', icon: LayoutGrid, size: 17 },
];

export default function ViewToggle({ value, onChange }) {
  return (
    <div className="bh-viewtoggle" role="group" aria-label="View">
      {OPTIONS.map(({ value: mode, label, icon: Icon, size }) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            className={active ? 'active' : ''}
            aria-pressed={active}
            title={label}
            aria-label={label}
            onClick={() => onChange(mode)}
            style={{ position: 'relative' }}
          >
            <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
              <Icon size={size} />
            </span>
            {active && (
              <motion.span
                layoutId="viewToggleIndicator"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 7,
                  background: 'var(--bh-navy)',
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

import { motion } from 'framer-motion';
import { LayoutGrid, List } from 'lucide-react';

export default function ViewToggle({ value, onChange }) {
  return (
    <div className="bh-viewtoggle" role="group" aria-label="View">
      <button
        type="button"
        className={value === 'table' ? 'active' : ''}
        aria-pressed={value === 'table'}
        title="Table view"
        aria-label="Table view"
        onClick={() => onChange('table')}
        style={{ position: 'relative' }}
      >
        <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
          <List size={18} />
        </span>
        {value === 'table' && (
          <motion.span
            layoutId="viewToggleIndicator"
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
      <button
        type="button"
        className={value === 'grid' ? 'active' : ''}
        aria-pressed={value === 'grid'}
        title="Grid view"
        aria-label="Grid view"
        onClick={() => onChange('grid')}
        style={{ position: 'relative' }}
      >
        <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
          <LayoutGrid size={17} />
        </span>
        {value === 'grid' && (
          <motion.span
            layoutId="viewToggleIndicator"
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
    </div>
  );
}

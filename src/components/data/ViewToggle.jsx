import { LayoutGrid, List } from 'lucide-react';

export default function ViewToggle({ value, onChange }) {
  return (
    <div className="bh-viewtoggle" role="group" aria-label="View">
      <button type="button" className={value === 'table' ? 'active' : ''} aria-pressed={value === 'table'} title="Table view" aria-label="Table view" onClick={() => onChange('table')}><List size={18} /></button>
      <button type="button" className={value === 'grid' ? 'active' : ''} aria-pressed={value === 'grid'} title="Grid view" aria-label="Grid view" onClick={() => onChange('grid')}><LayoutGrid size={17} /></button>
    </div>
  );
}

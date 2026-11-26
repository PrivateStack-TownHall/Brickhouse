import { Search } from 'lucide-react';
import { cx } from '../../helpers';

export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '', size }) {
  return (
    <div className={cx('bh-search', className)}>
      <Search size={15} />
      <input
        type="search"
        className={cx('form-control', size === 'sm' && 'form-control-sm')}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}

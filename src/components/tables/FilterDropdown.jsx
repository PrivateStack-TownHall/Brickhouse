import { titleCase } from '../../helpers';

/** Compact filter select. options: ['a'] or [{ value, label }]. Empty value = all. */
export default function FilterDropdown({ label, value, onChange, options, format = titleCase }) {
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: format(o) }));
  return (
    <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">All {label.toLowerCase()}</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

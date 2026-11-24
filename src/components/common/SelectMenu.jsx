/** Compact pill dropdown, e.g. "Last 30 Days". options: [{ value, label }] */
export default function SelectMenu({ value, onChange, options, ariaLabel }) {
  return (
    <select className="bh-select-pill" value={value} aria-label={ariaLabel} onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)?.value ?? e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

import { cx } from '../../helpers';

/** Small segmented control. options: [{ value, label }] */
export default function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div className="bh-segment" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" className={cx(o.value === value && 'active')} onClick={() => onChange(o.value)} aria-pressed={o.value === value}>{o.label}</button>
      ))}
    </div>
  );
}

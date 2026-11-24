import { useId } from 'react';
import { cx, titleCase } from '../../helpers';

/** options: ['a', 'b'] or [{ value, label }] */
export default function FormSelect({ label, required, error, help, options = [], placeholder = 'Select…', value, onChange, className = '', format = titleCase, disabled }) {
  const id = useId();
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: format(o) }));
  return (
    <div className={cx('mb-3', className)}>
      {label && <label className="form-label" htmlFor={id}>{label}{required && <span className="req" aria-hidden>*</span>}</label>}
      <select id={id} className={cx('form-select', error && 'is-invalid')} value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} disabled={disabled}>
        <option value="">{placeholder}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <div className="invalid-feedback d-block">{error}</div>}
      {!error && help && <div className="form-text">{help}</div>}
    </div>
  );
}

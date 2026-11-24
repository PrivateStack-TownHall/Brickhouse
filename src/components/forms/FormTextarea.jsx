import { useId } from 'react';
import { cx } from '../../helpers';

export default function FormTextarea({ label, required, error, help, rows = 3, className = '', ...rest }) {
  const id = useId();
  return (
    <div className={cx('mb-3', className)}>
      {label && <label className="form-label" htmlFor={id}>{label}{required && <span className="req" aria-hidden>*</span>}</label>}
      <textarea id={id} rows={rows} className={cx('form-control', error && 'is-invalid')} {...rest} value={rest.value ?? ''} />
      {error && <div className="invalid-feedback d-block">{error}</div>}
      {!error && help && <div className="form-text">{help}</div>}
    </div>
  );
}

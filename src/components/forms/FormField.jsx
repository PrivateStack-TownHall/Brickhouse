import { useId } from 'react';
import { cx } from '../../helpers';

/** Label + control + validation message. Renders an <input> unless children are given. */
export default function FormField({ label, required, error, help, children, className = '', id: idProp, ...input }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <div className={cx('mb-3', className)}>
      {label && <label className="form-label" htmlFor={id}>{label}{required && <span className="req" aria-hidden>*</span>}</label>}
      {children || (
        <input id={id} className={cx('form-control', error && 'is-invalid')} aria-invalid={!!error} aria-required={required} {...input}
          value={input.value ?? ''} />
      )}
      {error && <div className="invalid-feedback d-block">{error}</div>}
      {!error && help && <div className="form-text">{help}</div>}
    </div>
  );
}

import { useCallback, useMemo, useState } from 'react';

/** Form state for wizards: values, errors and a dirty flag. */
export function useWizardForm(initial) {
  const [start] = useState(initial);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = useCallback((key, v) => {
    setValues((s) => ({ ...s, [key]: v }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _drop, ...rest } = e;
      return rest;
    });
  }, []);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(start), [values, start]);
  /** Props for a text FormField bound to `key`. */
  const bind = (key) => ({ value: values[key] ?? '', onChange: (e) => set(key, e.target.value), error: errors[key] });
  const bindSelect = (key) => ({ value: values[key] ?? '', onChange: (v) => set(key, v), error: errors[key] });
  return { values, set, setValues, errors, setErrors, dirty, bind, bindSelect };
}

/** Build an errors object for blank required keys. */
export function requireFields(values, fields) {
  const errs = {};
  for (const [key, label] of fields) {
    const v = values[key];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) errs[key] = `${label} is required.`;
  }
  return errs;
}

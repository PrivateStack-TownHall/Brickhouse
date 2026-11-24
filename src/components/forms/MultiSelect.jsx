import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cx } from '../../helpers';

/**
 * Pick existing registry records (and optionally relationship attributes).
 * options: [{ value, label, meta }]
 * value: [{ targetId, ...extra }]
 * extraFields: [{ key, label, options? }] – edited per selected item (e.g. role, version)
 * single: only one selection allowed
 */
export default function MultiSelect({ label, help, error, options, value = [], onChange, extraFields = [], single = false, required, emptyText = 'No records available.' }) {
  const [q, setQ] = useState('');
  const selected = new Map(value.map((v) => [v.targetId, v]));
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => `${o.label} ${o.value} ${o.meta || ''}`.toLowerCase().includes(s)) : options;
  }, [options, q]);
  const toggle = (id) => {
    if (selected.has(id)) onChange(value.filter((v) => v.targetId !== id));
    else {
      const blank = Object.fromEntries(extraFields.map((f) => [f.key, f.default ?? '']));
      onChange(single ? [{ targetId: id, ...blank }] : [...value, { targetId: id, ...blank }]);
    }
  };
  const setExtra = (id, key, v) => onChange(value.map((x) => (x.targetId === id ? { ...x, [key]: v } : x)));
  const labelOf = (id) => options.find((o) => o.value === id)?.label || id;
  return (
    <div className="mb-3">
      {label && <label className="form-label">{label}{required && <span className="req">*</span>}</label>}
      <div className={cx('bh-multiselect', error && 'is-invalid')}>
        <div className="bh-ms-selected">
          {value.length === 0 && <span className="text-subtle small">Nothing selected</span>}
          {value.map((v) => (
            <span key={v.targetId} className="bh-chip">{labelOf(v.targetId)}<button type="button" aria-label="Remove" onClick={() => toggle(v.targetId)}><X size={12} /></button></span>
          ))}
        </div>
        {options.length > 6 && (
          <div className="bh-search p-2 border-bottom" style={{ borderColor: 'var(--bh-border)' }}>
            <Search size={14} style={{ left: 18 }} />
            <input className="form-control form-control-sm" placeholder="Search records…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <div className="bh-ms-list">
          {options.length === 0 && <div className="text-subtle small p-2">{emptyText}</div>}
          {filtered.map((o) => {
            const sel = selected.get(o.value);
            return (
              <div key={o.value}>
                <label className="bh-ms-option">
                  <input type={single ? 'radio' : 'checkbox'} className="form-check-input m-0" checked={!!sel} onChange={() => toggle(o.value)} />
                  <span className="flex-grow-1 min-w-0">
                    <span className="fw-semibold">{o.label}</span> <span className="bh-id ms-1">{o.value}</span>
                    {o.meta && <span className="text-subtle d-block" style={{ fontSize: 12 }}>{o.meta}</span>}
                  </span>
                </label>
                {sel && extraFields.length > 0 && (
                  <div className="bh-ms-extra">
                    {extraFields.map((f) => (f.options ? (
                      <select key={f.key} className="form-select form-select-sm" value={sel[f.key] ?? ''} onChange={(e) => setExtra(o.value, f.key, e.target.value)} aria-label={f.label}>
                        <option value="">{f.label}…</option>
                        {f.options.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    ) : (
                      <input key={f.key} className="form-control form-control-sm" placeholder={f.label} value={sel[f.key] ?? ''} onChange={(e) => setExtra(o.value, f.key, e.target.value)} aria-label={f.label} />
                    )))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {error && <div className="invalid-feedback d-block">{error}</div>}
      {!error && help && <div className="form-text">{help}</div>}
    </div>
  );
}

import { useId, useState } from 'react';
import { X } from 'lucide-react';

export default function TagInput({ label, value = [], onChange, placeholder = 'Type and press Enter', help }) {
  const id = useId();
  const [text, setText] = useState('');
  const add = () => {
    const parts = text.split(',').map((t) => t.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setText('');
  };
  return (
    <div className="mb-3">
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      <div className="bh-multiselect">
        <div className="bh-ms-selected" style={{ borderBottom: 0 }}>
          {value.map((t) => (
            <span key={t} className="bh-chip">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><X size={12} /></button></span>
          ))}
          <input id={id} className="border-0 flex-grow-1 bg-transparent" style={{ outline: 'none', minWidth: 140, color: 'var(--bh-text)' }} value={text} placeholder={placeholder}
            onChange={(e) => setText(e.target.value)} onBlur={add}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
              if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
            }} />
        </div>
      </div>
      {help && <div className="form-text">{help}</div>}
    </div>
  );
}

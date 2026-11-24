import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { MoreHorizontal } from 'lucide-react';

/**
 * "…" contextual menu. Rendered in a portal so table scroll containers never clip it.
 * items: [{ label, icon, to?, onClick?, danger?, separator? }]
 */
function placement(r, force = false) {
  if (!force && (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth)) return null;
  const below = window.innerHeight - r.bottom > 180;
  return { left: Math.min(Math.max(r.right, 190), window.innerWidth - 8), top: below ? r.bottom + 6 : undefined, bottom: below ? undefined : window.innerHeight - r.top + 6 };
}

export default function ActionMenu({ items, label = 'Actions' }) {
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const menu = useRef(null);
  const navigate = useNavigate();
  const close = () => setPos(null);
  useEffect(() => {
    if (!pos) return undefined;
    const onDoc = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') { close(); btn.current?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    // Follow the button while the page or a table scrolls; close once it leaves the viewport.
    const onScroll = (e) => {
      if (menu.current?.contains(e.target) || !btn.current) return;
      const next = placement(btn.current.getBoundingClientRect());
      if (next) setPos(next); else close();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    menu.current?.querySelector('button')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);
  const open = (e) => {
    e.stopPropagation();
    if (pos) { close(); return; }
    setPos(placement(btn.current.getBoundingClientRect()) || placement(btn.current.getBoundingClientRect(), true));
  };
  return (
    <>
      <button ref={btn} type="button" className="btn btn-ghost btn-icon" aria-label={label} aria-haspopup="menu" aria-expanded={!!pos} onClick={open}>
        <MoreHorizontal size={18} />
      </button>
      {pos && createPortal(
        <div ref={menu} className="bh-menu" role="menu" style={{ left: pos.left, top: pos.top, bottom: pos.bottom }} onClick={(e) => e.stopPropagation()}>
          {items.filter(Boolean).map((it, i) => (it.separator ? <div key={`s${i}`} className="bh-menu-sep" /> : (
            <button key={it.label} type="button" role="menuitem" className={`bh-menu-item ${it.danger ? 'danger' : ''}`}
              onClick={() => { close(); if (it.to) navigate(it.to); else it.onClick?.(); }}>
              {it.icon && <it.icon size={15} />}{it.label}
            </button>
          )))}
        </div>,
        document.body,
      )}
    </>
  );
}

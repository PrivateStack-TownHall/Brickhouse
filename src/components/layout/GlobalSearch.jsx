import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useRegistry } from '../../hooks/useRegistry';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { ENTITIES, routeFor } from '../../services/schema';
import { matchesSearch } from '../../services/query.service';
import EntityIcon from '../common/EntityIcon';

const SEARCHABLE = ['applications', 'components', 'repositories', 'deployments', 'apis', 'technologies', 'infrastructure', 'companies'];

export default function GlobalSearch() {
  const { data } = useRegistry();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const box = useOutsideClick(close);
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    return SEARCHABLE.flatMap((e) => (data[e] || [])
      .filter((r) => matchesSearch(r, q, ['id', 'name', 'code', 'description', 'tags', 'provider', 'topics']))
      .map((r) => ({ entity: e, record: r }))).slice(0, 12);
  }, [q, data]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); box.current?.querySelector('input')?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [box]);
  const go = (r) => {
    const to = routeFor(r.entity, r.record.id);
    if (to) navigate(to);
    setOpen(false);
    setQ('');
  };
  return (
    <div className="bh-global-search" ref={box}>
      <div className="bh-search">
        <Search size={18} />
        <input type="search" className="form-control" placeholder="Search applications, repositories, or IDs…" value={q} aria-label="Global search"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === 'Enter' && results[active]) go(results[active]);
            if (e.key === 'Escape') setOpen(false);
          }} />
        <span className="bh-kbd" aria-hidden>Ctrl K</span>
      </div>
      <AnimatePresence>
        {open && q.trim().length >= 2 && (
          <motion.div
            className="bh-search-results"
            role="listbox"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {results.length === 0 && <div className="p-3 text-subtle small">No records match “{q}”.</div>}
            {results.map((r, i) => (
              <div key={r.entity + r.record.id} role="option" aria-selected={i === active} className={`bh-search-item ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); go(r); }}>
                <EntityIcon entity={r.entity} boxed size={15} />
                <div className="min-w-0">
                  <div className="fw-semibold text-truncate">{r.record.name}</div>
                  <div className="text-subtle" style={{ fontSize: 12 }}><span className="bh-id">{r.record.id}</span> · {ENTITIES[r.entity].label}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

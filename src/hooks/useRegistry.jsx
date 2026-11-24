import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { initializeRegistry, persistDataset } from '../services/storage.service';

const RegistryContext = createContext(null);

/**
 * Holds the active dataset. All writes go through `run(serviceFn, ...args)`:
 * the service returns { dataset, result }; the provider persists and re-renders.
 */
export function RegistryProvider({ children }) {
  const init = useMemo(() => initializeRegistry(), []);
  const ref = useRef(init.dataset);
  const [data, setData] = useState(init.dataset);
  const [health, setHealth] = useState(init.health);

  const healthRef = useRef(init.health);

  const commit = useCallback((ds, { enablePersistence = false } = {}) => {
    ref.current = ds;
    const h = healthRef.current;
    if (h.persistence || enablePersistence) {
      const saved = persistDataset(ds);
      let next = h;
      if (!saved.ok) next = { status: 'error', persistence: true, message: saved.error };
      else if (enablePersistence || h.status === 'error') next = { status: 'ok', persistence: true, message: 'Saved to Local Storage.' };
      if (next !== h) { healthRef.current = next; setHealth(next); }
    }
    setData(ds);
  }, []);

  const run = useCallback((fn, ...args) => {
    const { dataset, result } = fn(ref.current, ...args);
    if (dataset !== ref.current) commit(dataset);
    return result;
  }, [commit]);

  /** Replace the whole dataset (restore / reset). Re-enables persistence. */
  const replaceDataset = useCallback((ds) => commit(ds, { enablePersistence: true }), [commit]);

  const value = useMemo(() => ({ data, health, run, replaceDataset, getData: () => ref.current }), [data, health, run, replaceDataset]);
  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

export function useRegistry() {
  const ctx = useContext(RegistryContext);
  if (!ctx) throw new Error('useRegistry must be used inside RegistryProvider');
  return ctx;
}

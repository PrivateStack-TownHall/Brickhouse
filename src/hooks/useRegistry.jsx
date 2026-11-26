import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  initializeRegistry,
  persistDataset,
  loadDatasetFromDisk,
  persistDatasetToDisk,
} from '../services/storage.service';

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
  const diskEnabledRef = useRef(false);
  const diskQueueRef = useRef(Promise.resolve());
  const hasWrittenRef = useRef(false);

  const syncDisk = useCallback((ds) => {
    diskQueueRef.current = diskQueueRef.current.then(async () => {
      const res = await persistDatasetToDisk(ds);
      if (!diskEnabledRef.current) return;
      if (!res.ok) {
        const next = {
          status: 'error',
          persistence: true,
          storageMode: 'json-files',
          message: res.error || 'Failed to save changes to database/*.json.',
        };
        healthRef.current = next;
        setHealth(next);
      } else if (healthRef.current.status === 'error' || healthRef.current.storageMode !== 'json-files') {
        const next = {
          status: 'ok',
          persistence: true,
          storageMode: 'json-files',
          message: 'Saved to database/*.json and Local Storage.',
        };
        healthRef.current = next;
        setHealth(next);
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    loadDatasetFromDisk().then((res) => {
      if (!active || !res.ok || !res.dataset) return;
      diskEnabledRef.current = true;
      // Avoid overwriting newer writes if the user already mutated state before load finished.
      if (!hasWrittenRef.current) {
        ref.current = res.dataset;
        setData(res.dataset);
        if (res.migrated) syncDisk(res.dataset);
      } else {
        syncDisk(ref.current);
      }
      const nextHealth = {
        status: 'ok',
        persistence: true,
        storageMode: 'json-files',
        message: 'Connected to database/*.json and Local Storage.',
      };
      healthRef.current = nextHealth;
      setHealth(nextHealth);
    });
    return () => { active = false; };
  }, [syncDisk]);

  const commit = useCallback((ds, { enablePersistence = false } = {}) => {
    hasWrittenRef.current = true;
    ref.current = ds;
    const h = healthRef.current;
    if (h.persistence || enablePersistence) {
      const saved = persistDataset(ds);
      let next = h;
      if (!saved.ok) next = { ...h, status: 'error', persistence: true, message: saved.error };
      else if (enablePersistence || h.status === 'error') {
        next = {
          ...h,
          status: 'ok',
          persistence: true,
          message: diskEnabledRef.current ? 'Saved to database/*.json and Local Storage.' : 'Saved to Local Storage.',
        };
      }
      if (next !== h) { healthRef.current = next; setHealth(next); }
    }
    if (diskEnabledRef.current) syncDisk(ds);
    setData(ds);
  }, [syncDisk]);

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

import { useEffect, useRef } from 'react';

/** Invoke `onOutside` on any mousedown outside the returned ref element. */
export function useOutsideClick(onOutside, active = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside, active]);
  return ref;
}

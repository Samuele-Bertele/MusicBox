import { useEffect, useRef, useState } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Aborts the previous request whenever a new one starts. */
export function useAbortController() {
  const ref = useRef<AbortController | null>(null);
  return () => {
    ref.current?.abort();
    ref.current = new AbortController();
    return ref.current.signal;
  };
}

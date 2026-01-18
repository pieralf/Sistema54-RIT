import { useCallback, useEffect, useRef, useState } from 'react';

type FocusKey = string;

export function useFocusRegistry(enabled: boolean, deps: any[] = []) {
  const refs = useRef(new Map<FocusKey, { current: HTMLElement | null }>());
  const [lastFocus, setLastFocus] = useState<FocusKey | null>(null);

  const getRef = useCallback((key: FocusKey) => {
    if (!refs.current.has(key)) {
      refs.current.set(key, { current: null });
    }
    return refs.current.get(key) as { current: HTMLElement | null };
  }, []);

  useEffect(() => {
    if (!enabled || !lastFocus) return;
    const targetRef = refs.current.get(lastFocus);
    if (targetRef?.current) {
      targetRef.current.focus();
    }
  }, [enabled, lastFocus, ...deps]);

  return { getRef, setLastFocus };
}

import { useEffect, useState } from 'react';
import { scheduleIdle } from './idle';

export function useDeferredReady(key: string, enabled: boolean, delay?: number) {
  const [readyKey, setReadyKey] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return scheduleIdle(() => setReadyKey(key), delay);
  }, [key, enabled, delay]);
  return enabled && readyKey === key;
}

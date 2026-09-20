import { useEffect, useState } from 'react';
import { scheduleIdle } from './idle';

export function useDeferredReady(key: string, enabled: boolean) {
  const [readyKey, setReadyKey] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return scheduleIdle(() => setReadyKey(key));
  }, [key, enabled]);
  return enabled && readyKey === key;
}

import { useEffect, useState } from 'react';
import { electionWindowAt, nextElectionBoundary } from './liveElection';

const MAX_TIMEOUT = 2 ** 31 - 1;

export function useElectionWindow() {
  const [window, setWindow] = useState(() => electionWindowAt(Date.now()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      const now = Date.now();
      setWindow(electionWindowAt(now));
      const next = nextElectionBoundary(now);
      if (next !== undefined) timer = setTimeout(update, Math.min(next - now, MAX_TIMEOUT));
    };
    update();
    document.addEventListener('visibilitychange', update);
    globalThis.window.addEventListener('focus', update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
      globalThis.window.removeEventListener('focus', update);
    };
  }, []);
  return window;
}

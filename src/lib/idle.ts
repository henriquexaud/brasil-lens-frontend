/** Agenda trabalho secundário sem disputar o primeiro desenho da tela. */
export function scheduleIdle(work: () => void, delay = 180): () => void {
  let idle: number | undefined;
  const timer = window.setTimeout(() => {
    if ('requestIdleCallback' in window) idle = window.requestIdleCallback(work, { timeout: 1200 });
    else work();
  }, delay);
  return () => {
    window.clearTimeout(timer);
    if (idle !== undefined) window.cancelIdleCallback(idle);
  };
}

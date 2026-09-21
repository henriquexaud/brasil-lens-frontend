/**
 * Exibição direta e imediata de texto e métricas numéricas.
 * Elimina loops de animação frame-a-frame para máxima seriedade e performance.
 */
export type RevealMode = 'text' | 'number';

export function revealText(el: HTMLElement, target: string, mode: RevealMode = 'text') {
  void mode;
  el.textContent = target;
  return () => {};
}

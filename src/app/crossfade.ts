// 'screen': troca de contexto, entrada e saída da conta.
export type CrossfadeKind = 'theme' | 'screen';

let runs = 0;

// Um único cross-fade da página inteira (View Transitions), feito pelo
// compositor: a tela anterior vira uma imagem e esmaece sobre a nova. `update`
// muda o DOM; se devolver uma promessa, a tela anterior fica parada até ela
// resolver. Enquanto dura, `data-crossfade` informa o motivo ao CSS. Sem
// suporte, ou com movimento reduzido, a mudança é seca. A promessa devolvida
// resolve quando `update` terminou, sem esperar a animação.
export function crossfade(
  kind: CrossfadeKind,
  update: () => void | Promise<void>,
): Promise<void> {
  const root = document.documentElement;
  const id = ++runs;
  const done = () => {
    if (id === runs) delete root.dataset.crossfade;
  };
  root.dataset.crossfade = kind;
  if (
    !('startViewTransition' in document) ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    // Dois quadros: o estado novo é pintado antes de as transições voltarem.
    const frame = (callback: () => void) =>
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame(callback)
        : setTimeout(callback);
    const updated = (async () => update())(); // `update` roda agora, de forma síncrona
    updated.then(() => frame(() => frame(done)), done);
    return updated;
  }
  const transition = document.startViewTransition(update);
  transition.ready.catch(() => {}); // aba oculta: o navegador pula a animação
  transition.finished.then(done, done);
  return transition.updateCallbackDone;
}

// Espera uma condição do DOM por um tempo curto; usada para a tela nova estar
// montada antes de o cross-fade começar.
export function waitFor(ready: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (ready() || Date.now() >= deadline) resolve();
      else setTimeout(check, 16);
    };
    check();
  });
}

// Animações de entrada (finitas) vão direto ao fim: quem aparece dentro de um
// cross-fade já entra pronto, sem somar um segundo movimento.
export function finishEntryAnimations(): void {
  for (const animation of document.getAnimations?.() ?? []) {
    const end = animation.effect?.getComputedTiming().endTime;
    if (typeof end === 'number' && Number.isFinite(end)) animation.finish();
  }
}

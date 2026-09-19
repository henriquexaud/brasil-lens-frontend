/**
 * Efeito "decodificando": embaralha caracteres e vai travando a posição certa
 * — não da esquerda pra direita em passo fixo, cada posição destrava num
 * instante levemente diferente — terminando no texto real.
 *
 * Existe para varreduras rápidas do cursor sobre municípios pequenos e
 * densos (centenas de polígonos vizinhos): sem ele, cada fronteira cruzada
 * trocava o nome do tooltip instantaneamente, e passar o mouse virava um
 * engasgo de nomes piscando um atrás do outro. Chamar de novo antes de uma
 * decodificação terminar cancela a anterior — é isso que faz uma passada
 * rápida do cursor parecer ruído fluido em vez de texto piscando, e só quem
 * para o cursor por tempo suficiente sobre um território vê o nome se formar.
 */
const SCRAMBLE_CHARS = '!<>-_\\/[]{}—=+*^?#$%&';
const DURATION_MS = 720;
// Símbolos não revelados trocam nesse ritmo, não a cada frame — a 60fps o
// ruído fica agitado demais; mais devagar lê como um "rádio fora de
// sintonia" em vez de estática.
const CHAR_UPDATE_INTERVAL_MS = 55;

const activeFrames = new WeakMap<HTMLElement, number>();

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

export function scrambleReveal(el: HTMLElement, target: string) {
  const previous = activeFrames.get(el);
  if (previous !== undefined) cancelAnimationFrame(previous);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target;
    return;
  }

  // Cada posição tem seu próprio instante de destravar: uma tendência da
  // esquerda pra direita (70%) mais um tanto de acaso (30%). Sem o acaso, a
  // decodificação lia como uma barra de progresso; com ele, parece orgânica.
  const revealAt = Array.from({ length: target.length }, (_, i) => {
    const base = target.length > 1 ? i / (target.length - 1) : 0;
    return Math.min(0.94, Math.max(0, base * 0.7 + Math.random() * 0.3));
  });

  let start: number | null = null;
  let lastCharUpdate = 0;
  let scrambled = target.split('').map(() => randomChar());

  const step = (timestamp: number) => {
    if (start === null) start = timestamp;
    const progress = Math.min((timestamp - start) / DURATION_MS, 1);

    if (timestamp - lastCharUpdate >= CHAR_UPDATE_INTERVAL_MS) {
      scrambled = scrambled.map(() => randomChar());
      lastCharUpdate = timestamp;
    }

    let output = '';
    for (let i = 0; i < target.length; i++) {
      const char = target[i] ?? '';
      output += char === ' ' || progress >= (revealAt[i] ?? 0) ? char : (scrambled[i] ?? char);
    }
    el.textContent = output;

    if (progress < 1) {
      activeFrames.set(el, requestAnimationFrame(step));
    } else {
      el.textContent = target;
      activeFrames.delete(el);
    }
  };

  activeFrames.set(el, requestAnimationFrame(step));
}

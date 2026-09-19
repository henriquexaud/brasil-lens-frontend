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
// Cada posição embaralha dentro da própria classe do caractere final: letra
// maiúscula mostra letra maiúscula aleatória, minúscula mostra minúscula,
// dígito mostra dígito. Símbolo e espaço não embaralham — não há "ruído" de
// pontuação, então essas posições aparecem direto (mesmo tratamento que
// espaço já tinha).
const SCRAMBLE_UPPER = 'AÁÂÃBCÇDEÉÊFGHIÍJKLMNOÓÔÕPQRSTUÚVWXYZ';
const SCRAMBLE_LOWER = SCRAMBLE_UPPER.toLowerCase();
const SCRAMBLE_DIGITS = '0123456789';
const DURATION_MS = 720;
// Caracteres não revelados trocam nesse ritmo, não a cada frame — a 60fps o
// ruído fica agitado demais; mais devagar lê como um "rádio fora de
// sintonia" em vez de estática.
const CHAR_UPDATE_INTERVAL_MS = 55;

const UPPER_LETTER_PATTERN = /\p{Lu}/u;
const LOWER_LETTER_PATTERN = /\p{Ll}/u;
const DIGIT_PATTERN = /[0-9]/;

const activeFrames = new WeakMap<HTMLElement, number>();

function randomFrom(pool: string) {
  return pool[Math.floor(Math.random() * pool.length)] ?? '';
}

/**
 * Ruído para uma posição, na classe do caractere final — mesma capitalização
 * inclusive. `null` quando a posição não embaralha (símbolo, espaço): o
 * chamador mostra o caractere real direto nesse caso.
 */
function randomCharFor(target: string): string | null {
  if (UPPER_LETTER_PATTERN.test(target)) return randomFrom(SCRAMBLE_UPPER);
  if (LOWER_LETTER_PATTERN.test(target)) return randomFrom(SCRAMBLE_LOWER);
  if (DIGIT_PATTERN.test(target)) return randomFrom(SCRAMBLE_DIGITS);
  return null;
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
  let scrambled = target.split('').map((char) => randomCharFor(char));

  const step = (timestamp: number) => {
    if (start === null) start = timestamp;
    const progress = Math.min((timestamp - start) / DURATION_MS, 1);

    if (timestamp - lastCharUpdate >= CHAR_UPDATE_INTERVAL_MS) {
      scrambled = scrambled.map((_, i) => randomCharFor(target[i] ?? ''));
      lastCharUpdate = timestamp;
    }

    let output = '';
    for (let i = 0; i < target.length; i++) {
      const char = target[i] ?? '';
      const noise = scrambled[i];
      output +=
        noise === null || noise === undefined || progress >= (revealAt[i] ?? 0) ? char : noise;
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

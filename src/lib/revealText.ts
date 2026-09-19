/** Digitação e contagem preservam o espaço final e a pontuação do conteúdo. */
export type RevealMode = 'text' | 'number';

const activeAnimations = new WeakMap<HTMLElement, () => void>();

export function revealText(el: HTMLElement, target: string, mode: RevealMode = 'text') {
  activeAnimations.get(el)?.();
  const finish = () => el.replaceChildren(document.createTextNode(target));
  const numericMatch = mode === 'number' ? /\d+(?:[.,]\d+)*/.exec(target) : null;
  if (
    !target ||
    (mode === 'number' && !numericMatch) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    finish();
    return () => {};
  }

  // Leitores de tela recebem o valor final uma única vez, sem cada frame.
  const accessible = document.createElement('span');
  accessible.className = 'sr-only';
  accessible.textContent = target;
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  visual.style.fontVariantNumeric = 'tabular-nums';
  const chars = Array.from(target);
  const slots = chars.map((char) => {
    const slot = document.createElement('span');
    slot.textContent = char;
    visual.append(slot);
    return slot;
  });
  el.replaceChildren(accessible, visual);

  // Apenas o primeiro valor é contado: unidades como /100 mil ficam intactas.
  const numberStart = numericMatch ? Array.from(target.slice(0, numericMatch.index)).length : 0;
  const digitSlots = numericMatch
    ? Array.from(numericMatch[0]).flatMap((char, index) =>
        /\d/.test(char) ? [numberStart + index] : [],
      )
    : [];
  const finalDigits = numericMatch?.[0].replace(/\D/g, '') ?? '0';
  const numericTarget = Number(finalDigits);
  const decimalIndex = numericMatch?.[0].indexOf(',') ?? -1;
  const integerDigits =
    decimalIndex < 0
      ? digitSlots.length
      : numericMatch![0].slice(0, decimalIndex).replace(/\D/g, '').length;
  const letters = chars.flatMap((char, index) => (/[\p{L}\p{N}]/u.test(char) ? [index] : []));
  const duration = numericMatch ? 850 : Math.min(900, Math.max(240, letters.length * 24));

  const render = (progress: number) => {
    if (numericMatch) {
      const digits = Math.floor(numericTarget * (1 - (1 - progress) ** 3))
        .toFixed(0)
        .padStart(finalDigits.length, '0');
      let leading = true;
      digitSlots.forEach((index, position) => {
        const digit = digits[position] ?? '0';
        leading = leading && digit === '0' && position < integerDigits - 1;
        slots[index]!.textContent = digit;
        slots[index]!.style.visibility = leading ? 'hidden' : 'visible';
      });
    } else {
      const revealed = Math.floor(progress * letters.length);
      letters.forEach((index, order) => {
        slots[index]!.style.visibility = order < revealed ? 'visible' : 'hidden';
      });
    }
  };

  render(0);
  let frame = 0;
  const start = performance.now();
  const cancel = () => {
    cancelAnimationFrame(frame);
    activeAnimations.delete(el);
    finish();
  };
  const step = (timestamp: number) => {
    const progress = Math.min((timestamp - start) / duration, 1);
    if (progress >= 1) {
      cancel();
      return;
    }
    render(progress);
    frame = requestAnimationFrame(step);
  };
  activeAnimations.set(el, cancel);
  frame = requestAnimationFrame(step);
  return cancel;
}

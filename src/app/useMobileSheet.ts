import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { flushSync } from 'react-dom';

// Mesmo breakpoint do CSS e de `scopeInsets`: abaixo dele o painel vira gaveta.
const MOBILE_QUERY = '(max-width: 900px)';
const DRAG_SLOP = 6;
// Quanto do movimento o gesto ainda "carrega" depois de soltar, como no iOS.
const PROJECTION_MS = 180;
const SETTLE_FALLBACK_MS = 600;
const INTERACTIVE = 'button, a, input, select, textarea, [role="tab"]';

export type SheetDetent = 'peek' | 'half' | 'full';
const DETENTS: SheetDetent[] = ['peek', 'half', 'full'];

interface Drag {
  pointerId: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
}

/**
 * Gaveta do painel no mobile, com três alturas como nos apps de mapa:
 * recolhida (alça, seletor de contexto e título do recorte), meia tela e
 * quase cheia. Abre e fecha com toque na alça ou arrastando o cabeçalho; ao
 * soltar, a velocidade do gesto escolhe a altura mais próxima.
 */
export function useMobileSheet() {
  const [detent, setDetent] = useState<SheetDetent>('half');
  const detentRef = useRef(detent);
  detentRef.current = detent;
  const slotRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const dragEndedAtRef = useRef(0);
  const settleTimerRef = useRef(0);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const header = headerRef.current;
    if (!slot || !header) return;
    const update = () => {
      // Recolhida, aparece até o título do recorte; os controles ficam para
      // quem abrir. Soma o respiro abaixo do título e a faixa do indicador de
      // início do iPhone (o padding inferior do painel é a safe area).
      const scope = header.querySelector('.scope');
      const panel = slot.querySelector('.panel');
      const safeBottom = panel ? parseFloat(getComputedStyle(panel).paddingBottom) || 0 : 0;
      const peek =
        (scope
          ? scope.getBoundingClientRect().bottom - header.getBoundingClientRect().top + 10
          : header.offsetHeight + 2) + safeBottom;
      slot.style.setProperty('--sheet-peek', `${Math.round(peek)}px`);
      // Cheia, a gaveta para abaixo da busca, que continua à mão.
      const parent = slot.parentElement;
      const search = parent?.querySelector('.search-slot')?.getBoundingClientRect();
      if (parent && search) {
        const gap = search.bottom - parent.getBoundingClientRect().top + 12;
        slot.style.setProperty('--sheet-top-gap', `${Math.round(gap)}px`);
      }
      slot.parentElement?.style.setProperty(
        '--sheet-height',
        `${slot.getBoundingClientRect().height}px`,
      );
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(header);
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    slotRef.current?.setAttribute('data-detent', detent);
  }, [detent]);

  // Altura de cada parada em px; meia e cheia nunca passam do conteúdo, para
  // a animação não gastar tempo no vazio acima dele.
  const heights = useCallback((): Record<SheetDetent, number> | null => {
    const slot = slotRef.current;
    const parent = slot?.parentElement;
    if (!slot || !parent) return null;
    const style = getComputedStyle(slot);
    const content = (slot.querySelector('.panel')?.scrollHeight ?? 0) + 2;
    const peek = parseFloat(style.getPropertyValue('--sheet-peek')) || 132;
    const top = parseFloat(style.getPropertyValue('--sheet-top-gap')) || 72;
    const available = parent.clientHeight;
    return {
      peek,
      half: Math.max(peek, Math.min(available * 0.5, content)),
      full: Math.max(peek, Math.min(available - top, content)),
    };
  }, []);

  const settle = useCallback(
    (next: SheetDetent) => {
      const slot = slotRef.current;
      const target = heights()?.[next];
      window.clearTimeout(settleTimerRef.current);
      if (slot && target !== undefined) {
        // Anima entre alturas reais e depois devolve o controle ao CSS da
        // parada, que acompanha o conteúdo e a rotação da tela.
        slot.style.maxHeight = `${slot.offsetHeight}px`;
        void slot.offsetHeight;
        slot.style.removeProperty('transition');
        slot.style.maxHeight = `${target}px`;
        const release = (event?: TransitionEvent) => {
          // transitionend sobe dos filhos (cor de botão etc.): só vale o do painel.
          if (event && (event.target !== slot || event.propertyName !== 'max-height')) return;
          window.clearTimeout(settleTimerRef.current);
          slot.removeEventListener('transitionend', release);
          if (!dragRef.current) slot.style.removeProperty('max-height');
        };
        slot.addEventListener('transitionend', release);
        settleTimerRef.current = window.setTimeout(() => release(), SETTLE_FALLBACK_MS);
        if (next === 'peek') slot.querySelector('.panel')?.scrollTo({ top: 0 });
      }
      flushSync(() => setDetent(next));
    },
    [heights],
  );

  const justDragged = () => performance.now() - dragEndedAtRef.current < 400;

  const toggle = useCallback(() => {
    if (!justDragged()) settle(detentRef.current === 'peek' ? 'half' : 'peek');
  }, [settle]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (!window.matchMedia(MOBILE_QUERY).matches) return;
    const target = event.target as Element;
    if (target.closest(INTERACTIVE) && !target.closest('.mobile-sheet-handle')) return;
    const slot = slotRef.current;
    if (!slot) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: slot.offsetHeight,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const slot = slotRef.current;
      if (!drag || !slot || event.pointerId !== drag.pointerId) return;
      const dy = event.clientY - drag.startY;
      if (!drag.moved) {
        if (Math.abs(dy) < DRAG_SLOP) return;
        drag.moved = true;
        // Captura só depois do limiar, para um toque simples ainda virar clique
        // no botão onde começou.
        event.currentTarget.setPointerCapture(event.pointerId);
        window.clearTimeout(settleTimerRef.current);
        slot.style.transition = 'none';
      }
      const dt = event.timeStamp - drag.lastTime;
      if (dt > 0) {
        drag.velocity = 0.7 * ((event.clientY - drag.lastY) / dt) + 0.3 * drag.velocity;
      }
      drag.lastY = event.clientY;
      drag.lastTime = event.timeStamp;
      const limits = heights();
      if (!limits) return;
      // Além das paradas, o painel resiste em vez de parar seco.
      let height = drag.startHeight - dy;
      if (height > limits.full) height = limits.full + (height - limits.full) * 0.25;
      if (height < limits.peek) height = limits.peek - (limits.peek - height) * 0.25;
      slot.style.maxHeight = `${height}px`;
    },
    [heights],
  );

  const endDrag = useCallback(
    (event: PointerEvent<HTMLElement>, cancelled: boolean) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      if (!drag.moved) return;
      dragEndedAtRef.current = performance.now();
      const limits = heights();
      if (cancelled || !limits) {
        settle(detentRef.current);
        return;
      }
      const projected =
        drag.startHeight - (event.clientY - drag.startY) - drag.velocity * PROJECTION_MS;
      const next = DETENTS.reduce((best, item) =>
        Math.abs(limits[item] - projected) < Math.abs(limits[best] - projected) ? item : best,
      );
      settle(next);
    },
    [heights, settle],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => endDrag(event, false),
    [endDrag],
  );
  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLElement>) => endDrag(event, true),
    [endDrag],
  );

  // Recolhida, um toque fora dos controles do cabeçalho abre a gaveta.
  const onClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (detentRef.current !== 'peek' || justDragged()) return;
      if ((event.target as Element).closest(INTERACTIVE)) return;
      settle('half');
    },
    [settle],
  );

  return {
    detent,
    collapsed: detent === 'peek',
    toggle,
    slotRef,
    headerRef,
    headerProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick },
  };
}

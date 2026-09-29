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
const SNAP_DISTANCE = 32;
const FLICK_VELOCITY = 0.35; // px/ms
const INTERACTIVE = 'button, a, input, select, textarea, [role="tab"]';

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
 * Gaveta do painel no mobile. Recolhida, mostra só o cabeçalho (alça, título,
 * seletor de camada e o resumo dela); a altura vem do próprio cabeçalho, medida
 * ao vivo. Abre e fecha com toque na alça ou arrastando o cabeçalho.
 */
export function useMobileSheet() {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const slotRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const dragEndedAtRef = useRef(0);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const header = headerRef.current;
    if (!slot || !header) return;
    // +2: bordas de cima e de baixo do painel.
    const update = () => slot.style.setProperty('--sheet-peek', `${header.offsetHeight + 2}px`);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Parte da altura real: max-height do CSS é um teto (52%), e sem fixar o
  // ponto de partida a transição gastaria tempo no vazio acima do conteúdo.
  const settle = useCallback((next: boolean) => {
    const slot = slotRef.current;
    if (slot) {
      slot.style.maxHeight = `${slot.offsetHeight}px`;
      void slot.offsetHeight;
      slot.style.removeProperty('transition');
    }
    flushSync(() => setCollapsed(next));
    slot?.style.removeProperty('max-height');
  }, []);

  const justDragged = () => performance.now() - dragEndedAtRef.current < 400;

  const toggle = useCallback(() => {
    if (!justDragged()) settle(!collapsedRef.current);
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

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const slot = slotRef.current;
    const header = headerRef.current;
    if (!drag || !slot || !header || event.pointerId !== drag.pointerId) return;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.abs(dy) < DRAG_SLOP) return;
      drag.moved = true;
      // Captura só depois do limiar, para um toque simples ainda virar clique
      // no botão onde começou.
      event.currentTarget.setPointerCapture(event.pointerId);
      slot.style.transition = 'none';
    }
    const dt = event.timeStamp - drag.lastTime;
    if (dt > 0) {
      drag.velocity = 0.7 * ((event.clientY - drag.lastY) / dt) + 0.3 * drag.velocity;
    }
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    const height = Math.max(header.offsetHeight + 2, drag.startHeight - dy);
    slot.style.maxHeight = `min(${height}px, var(--sheet-max))`;
  }, []);

  const endDrag = useCallback(
    (event: PointerEvent<HTMLElement>, cancelled: boolean) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      if (!drag.moved) return;
      dragEndedAtRef.current = performance.now();
      const dy = event.clientY - drag.startY;
      let next = collapsedRef.current;
      if (!cancelled) {
        if (drag.velocity > FLICK_VELOCITY) next = true;
        else if (drag.velocity < -FLICK_VELOCITY) next = false;
        else if (dy > SNAP_DISTANCE) next = true;
        else if (dy < -SNAP_DISTANCE) next = false;
      }
      settle(next);
    },
    [settle],
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
      if (!collapsedRef.current || justDragged()) return;
      if ((event.target as Element).closest(INTERACTIVE)) return;
      settle(false);
    },
    [settle],
  );

  return {
    collapsed,
    setCollapsed,
    toggle,
    slotRef,
    headerRef,
    headerProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick },
  };
}

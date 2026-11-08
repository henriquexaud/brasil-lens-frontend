import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { DataContext } from '@/api/types';

interface ContextOption {
  value: DataContext;
  label: string;
  icon: ReactNode;
}

// Traço de 1,6 em caixa 24, como os ícones do tema.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="context-select-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const CONTEXT_OPTIONS: ContextOption[] = [
  {
    value: 'climate',
    label: 'Clima',
    icon: (
      <Icon>
        <path d="M14 14.76V4a2 2 0 0 0-4 0v10.76a4 4 0 1 0 4 0Z" />
      </Icon>
    ),
  },
  {
    value: 'environment',
    label: 'Meio ambiente',
    icon: (
      <Icon>
        <path d="M5 19C5 11 10 5 19 5c0 9-6 14-14 14Z" />
        <path d="m4 20 9-9" />
      </Icon>
    ),
  },
  {
    value: 'socioeconomic',
    label: 'Socioeconômico',
    icon: (
      <Icon>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 13.6a5.5 5.5 0 0 1 3 5.4" />
      </Icon>
    ),
  },
  {
    value: 'political',
    label: 'Política',
    icon: (
      <Icon>
        <path d="M3.5 9 12 4.5 20.5 9Z" />
        <path d="M6.5 11.5v5.5M10.5 11.5v5.5M13.5 11.5v5.5M17.5 11.5v5.5M3.5 20h17" />
      </Icon>
    ),
  },
  {
    value: 'transport',
    label: 'Transporte',
    icon: (
      <Icon>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="5" r="2" />
        <path d="M8 18h7.5a3.25 3.25 0 0 0 0-6.5h-7a3.25 3.25 0 0 1 0-6.5H16" />
      </Icon>
    ),
  },
  {
    value: 'education',
    label: 'Educação',
    icon: (
      <Icon>
        <path d="M2.5 9 12 4.5 21.5 9 12 13.5Z" />
        <path d="M6.5 11.3V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.7M21.5 9v5" />
      </Icon>
    ),
  },
];

// O índice sempre vem da própria lista; o `as` só cala o acesso indexado.
const optionAt = (index: number) => CONTEXT_OPTIONS[index] as ContextOption;

const GAP = 6;
const EDGE = 8;

interface Props {
  value: DataContext;
  onChange: (value: DataContext) => void;
}

// Seletor de contexto: lista própria (padrão "select-only combobox" do WAI-ARIA)
// para mostrar o ícone de cada contexto. A lista vai para o body porque o painel
// rola e tem `transform`, o que cortaria e deslocaria um popover interno.
export function ContextSelect({ value, onChange }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const [placement, setPlacement] = useState<'below' | 'above'>('below');

  const selectedIndex = Math.max(
    0,
    CONTEXT_OPTIONS.findIndex((option) => option.value === value),
  );
  const selected = optionAt(selectedIndex);

  const show = (index = selectedIndex) => {
    setActive(index);
    setPosition({ visibility: 'hidden' });
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const choose = (index: number) => {
    close();
    const next = optionAt(index).value;
    if (next !== value) onChange(next);
  };

  // Abre para baixo; no mobile, com o painel no rodapé, abre para cima.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;
    const rect = trigger.getBoundingClientRect();
    const height = list.offsetHeight;
    const below = rect.bottom + GAP + height <= window.innerHeight - EDGE;
    const fitsAbove = rect.top - GAP - height >= EDGE;
    const side = below || !fitsAbove ? 'below' : 'above';
    setPlacement(side);
    setPosition({
      left: rect.left,
      width: rect.width,
      ...(side === 'below'
        ? { top: rect.bottom + GAP }
        : { bottom: window.innerHeight - rect.top + GAP }),
    });
  }, [open]);

  // Só depois de posicionada: um elemento com `visibility: hidden` não recebe foco.
  const placed = open && position.visibility !== 'hidden';
  useLayoutEffect(() => {
    if (placed) listRef.current?.focus({ preventScroll: true });
  }, [placed]);

  // Clique fora, rolagem do painel ou mudança de tamanho fecham sem escolher.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && listRef.current?.contains(event.target)) return;
      close(false);
    };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  // Digitar as primeiras letras leva à opção, como no select nativo.
  const typeahead = (key: string, from: number) => {
    const now = Date.now();
    const text = now - typed.current.at > 600 ? key : typed.current.text + key;
    typed.current = { text, at: now };
    const normalize = (label: string) =>
      label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const query = normalize(text);
    const count = CONTEXT_OPTIONS.length;
    const start = text.length === 1 ? from + 1 : from;
    for (let step = 0; step < count; step += 1) {
      const index = (start + step) % count;
      if (normalize(optionAt(index).label).startsWith(query)) return index;
    }
    return -1;
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = CONTEXT_OPTIONS.length - 1;
    const keys: Record<string, number> = {
      ArrowDown: selectedIndex,
      ArrowUp: selectedIndex,
      Enter: selectedIndex,
      ' ': selectedIndex,
      Home: 0,
      End: last,
    };
    const target = keys[event.key];
    if (target !== undefined) {
      event.preventDefault();
      show(target);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const index = typeahead(event.key, selectedIndex);
      if (index >= 0) show(index);
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = CONTEXT_OPTIONS.length - 1;
    const move: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
      PageDown: last,
      PageUp: 0,
    };
    const target = move[event.key];
    if (target !== undefined) {
      event.preventDefault();
      setActive(target);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const index = typeahead(event.key, active);
      if (index >= 0) setActive(index);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id="data-context"
        type="button"
        className="context-select-trigger"
        role="combobox"
        aria-label="Contexto do mapa"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : show())}
        onKeyDown={onTriggerKeyDown}
      >
        {selected.icon}
        <span className="context-select-label">{selected.label}</span>
        <svg
          className="context-select-chevron"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 6.5l4 3.5 4-3.5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            className="context-select-list"
            data-placement={placement}
            role="listbox"
            aria-label="Contexto do mapa"
            aria-activedescendant={`${id}-${active}`}
            tabIndex={-1}
            style={position}
            onKeyDown={onListKeyDown}
          >
            {CONTEXT_OPTIONS.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-${index}`}
                className="context-select-option"
                role="option"
                aria-selected={index === selectedIndex}
                data-active={index === active || undefined}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
              >
                {option.icon}
                <span className="context-select-label">{option.label}</span>
                {index === selectedIndex && (
                  <svg
                    className="context-select-check"
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m3.5 8.5 3 3 6-7" />
                  </svg>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}

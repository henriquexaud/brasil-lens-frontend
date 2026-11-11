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

export interface ListboxOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

const GAP = 6;
const EDGE = 8;

interface Props<T extends string> {
  /** Id do botão, para um `<label htmlFor>`. */
  id?: string;
  label: string;
  value: T;
  options: readonly ListboxOption<T>[];
  onChange: (value: T) => void;
  /** `context`: seletor de contexto; `field`: campo do painel; `inline`: ano e turno, sem moldura. */
  variant?: 'context' | 'field' | 'inline';
  disabled?: boolean;
  className?: string;
}

// Lista própria no lugar do <select> do sistema (padrão "select-only combobox" do
// WAI-ARIA): mesma aparência em todo aparelho e espaço para ícone. A lista vai para
// o body porque o painel rola e tem `transform`, o que cortaria um popover interno.
export function Listbox<T extends string>({
  id: triggerId,
  label,
  value,
  options,
  onChange,
  variant = 'field',
  disabled = false,
  className = '',
}: Props<T>) {
  const id = useId();
  // O índice sempre vem da própria lista; o `as` só cala o acesso indexado.
  const optionAt = (index: number) => options[index] as ListboxOption<T>;
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
    options.findIndex((option) => option.value === value),
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
      // O seletor compacto (ano, turno) é estreito: a lista alinha pela direita e cresce o que precisar.
      ...(variant === 'inline'
        ? { right: window.innerWidth - rect.right, minWidth: Math.max(rect.width, 96) }
        : { left: rect.left, width: rect.width }),
      ...(side === 'below'
        ? { top: rect.bottom + GAP }
        : { bottom: window.innerHeight - rect.top + GAP }),
    });
  }, [open, variant]);

  // Só depois de posicionada: um elemento com `visibility: hidden` não recebe foco.
  const placed = open && position.visibility !== 'hidden';
  useLayoutEffect(() => {
    if (placed) listRef.current?.focus({ preventScroll: true });
  }, [placed]);

  // Lista longa rola por dentro: a opção ativa fica à vista.
  useLayoutEffect(() => {
    if (placed) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [placed, active, id]);

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
      label
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
    const query = normalize(text);
    const count = options.length;
    const start = text.length === 1 ? from + 1 : from;
    for (let step = 0; step < count; step += 1) {
      const index = (start + step) % count;
      if (normalize(optionAt(index).label).startsWith(query)) return index;
    }
    return -1;
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
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
    const last = options.length - 1;
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
        id={triggerId}
        type="button"
        className={`context-select-trigger listbox-${variant} ${className}`}
        disabled={disabled}
        role="combobox"
        aria-label={label}
        value={value}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : show())}
        onKeyDown={onTriggerKeyDown}
      >
        {selected?.icon}
        <span className="context-select-label">{selected?.label}</span>
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
            className={`context-select-list listbox-list-${variant}`}
            data-placement={placement}
            role="listbox"
            aria-label={label}
            aria-activedescendant={`${id}-${active}`}
            tabIndex={-1}
            style={position}
            onKeyDown={onListKeyDown}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-${index}`}
                className="context-select-option"
                role="option"
                data-value={option.value}
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

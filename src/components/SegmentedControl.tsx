import { useRef } from 'react';

interface Segment {
  value: string;
  label: string;
  onIntent?: () => void;
}

interface Props {
  label: string;
  options: Segment[];
  value: string | null;
  onChange: (value: string | null) => void;
  allowDeselect?: boolean;
  className?: string;
}

export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  allowDeselect = false,
  className = '',
}: Props) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = options.findIndex((option) => option.value === value);
  if (!options.length) return null;

  return (
    <div className={`segmented-control ${className}`} role="tablist" aria-label={label}>
      <span
        className={`segmented-control-indicator ${activeIndex < 0 ? 'is-hidden' : ''}`}
        aria-hidden="true"
        style={{
          width: `calc((100% - ${6 + (options.length - 1) * 3}px) / ${options.length})`,
          transform: `translateX(calc(${Math.max(0, activeIndex) * 100}% + ${3 + Math.max(0, activeIndex) * 3}px))`,
        }}
      />
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(button) => {
            buttons.current[index] = button;
          }}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          tabIndex={index === Math.max(0, activeIndex) ? 0 : -1}
          className={`segmented-control-tab ${option.value === value ? 'is-active' : ''}`}
          onMouseEnter={option.onIntent}
          onFocus={option.onIntent}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
            else if (allowDeselect) onChange(null);
          }}
          onKeyDown={(event) => {
            const nextIndex =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : event.key === 'ArrowRight'
                    ? (index + 1) % options.length
                    : event.key === 'ArrowLeft'
                      ? (index - 1 + options.length) % options.length
                      : null;
            if (nextIndex === null) return;
            const nextOption = options[nextIndex];
            if (!nextOption) return;
            event.preventDefault();
            buttons.current[nextIndex]?.focus();
            onChange(nextOption.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

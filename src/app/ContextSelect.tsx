import type { ReactNode } from 'react';
import type { DataContext } from '@/api/types';
import { Icon as BaseIcon } from '@/components/Icon';
import { Listbox } from '@/components/Listbox';

interface ContextOption {
  value: DataContext;
  label: string;
  icon: ReactNode;
}

function Icon({ children }: { children: ReactNode }) {
  return <BaseIcon className="context-select-icon">{children}</BaseIcon>;
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
  {
    value: 'nature',
    label: 'Fauna e flora',
    icon: (
      <Icon>
        <path d="M5 19c0-8 5-13 14-14 0 9-4 14-12 14" />
        <path d="M5 19c2-5 5-8 9-10" />
      </Icon>
    ),
  },
  {
    value: 'resources',
    label: 'Minérios',
    icon: (
      <Icon>
        <path d="M7 4h10l4 6-9 10L3 10Z" />
        <path d="M3 10h18M9.5 10 12 20l2.5-10M7 4l2.5 6M17 4l-2.5 6" />
      </Icon>
    ),
  },
  {
    value: 'sports',
    label: 'Esportes',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5v17M6 6c2.2 1.7 3.4 3.7 3.4 6S8.2 16.3 6 18M18 6c-2.2 1.7-3.4 3.7-3.4 6s1.2 4.3 3.4 6" />
      </Icon>
    ),
  },
];

interface Props {
  value: DataContext;
  onChange: (value: DataContext) => void;
}

export function ContextSelect({ value, onChange }: Props) {
  return (
    <Listbox
      id="data-context"
      variant="context"
      label="Contexto do mapa"
      value={value}
      options={CONTEXT_OPTIONS}
      onChange={onChange}
    />
  );
}

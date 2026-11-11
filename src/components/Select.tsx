import type { ReactNode } from 'react';
import { Listbox } from './Listbox';

export interface Option {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;

  hideLabel?: boolean;
}

export function Select({ id, label, value, options, onChange, disabled, hideLabel }: Props) {
  return (
    <div>
      <label className={hideLabel ? 'field-label sr-only' : 'field-label'} htmlFor={id}>
        {label}
      </label>
      <Listbox
        id={id}
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

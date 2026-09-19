/** Select controlado, com rótulo acessível. */
interface Option {
  value: string;
  label: string;
}

interface Props {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Rótulo continua acessível, só sai da tela — para quando o próprio
   * controle (valor selecionado, posição no painel) já se explica. */
  hideLabel?: boolean;
}

export function Select({ id, label, value, options, onChange, disabled, hideLabel }: Props) {
  return (
    <div>
      <label className={hideLabel ? 'field-label sr-only' : 'field-label'} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="field-control"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

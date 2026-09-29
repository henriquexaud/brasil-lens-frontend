# Interface

- **Preserve a linguagem visual.** O dono gosta da interface atual. Mude aparência ou comportamento visível só por usabilidade, desempenho ou correção, e pergunte antes. Refatorar não justifica redesenhar.
- **Pouco, preciso, leve.** Uma camada nova usa contorno fino e mostra detalhes no clique. Nada de rótulos permanentes, legendas extras, animação ou malhas de ligação. Se uma relação derivada for duvidosa, não desenhe. Orçamento: algumas dezenas de nós no DOM e payload de dezenas de KB.
- **Dados honestos.**
  - Estimado leva um "≈" discreto (`EstimateMark`), "estimado" no tooltip e uma nota no painel.
  - `stale`/`partial` e fontes pausadas aparecem, com o horário da nova tentativa (`components/Feedback.tsx`).
  - Dado ausente é neutro: cinza, nunca "0".
- **Cores.** Use os tokens de `src/styles.css` (`--surface`, `--border`, `--text`, `--text-soft`, `--accent`, `--danger`, `--radius`, `--shadow`, `--ease-out`). As escalas ficam na feature: `map/colors.ts` (temperatura), `rainfall/rainScale.ts`, `fire/fireStyles.ts`, `map/hydroStyles.ts` e `weather/alertStyles.ts`. O contraste dos alertas é testado.
- **Movimento.** Poucas transições, todas pelos tokens de `src/styles.css`: `--motion-fast` (160 ms) para hover, foco e cor; `--motion-ui` (280 ms) para entrada e abertura de painéis; `--motion-map` (420 ms) para tinta do mapa; easing `--ease-out` (`--ease-in-out` só para cor). Nada de `transition: all`, duração solta, overshoot ou `animation-fill-mode: both` em elemento que muda `transform` depois. Prefira animar `opacity`, `transform` e cor. `prefers-reduced-motion` já é tratado em bloco único sob `.app`; não repita por componente.
- **Mobile (≤ 900px).** O painel vira gaveta na base (`app/useMobileSheet.ts`). O cabeçalho (alça, título, seletor de camada, fonte e resumo da camada) fica fixo ao rolar e é a altura da gaveta recolhida. Abre e fecha tocando na alça ou arrastando o cabeçalho; selecionar um território abre. Regras de mobile ficam em `@media (max-width: 900px)` e não mudam o desktop. Campo de texto com fonte ≥ 16px, senão o iOS dá zoom ao focar.
- **Texto.** Em pt-BR. Números com `toLocaleString('pt-BR')`, temperatura sem casas decimais, horário dos focos em UTC e identificado como UTC.

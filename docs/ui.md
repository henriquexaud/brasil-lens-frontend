# Interface

- **Preserve a linguagem visual.** O dono gosta da interface atual. Mude aparência ou comportamento visível só por usabilidade, desempenho ou correção, e pergunte antes. Refatorar não justifica redesenhar.
- **Pouco, preciso, leve.** Uma camada nova usa contorno fino e mostra detalhes no clique. Nada de rótulos permanentes, legendas extras, animação ou malhas de ligação. Se uma relação derivada for duvidosa, não desenhe. Orçamento: algumas dezenas de nós no DOM e payload de dezenas de KB.
- **Dados honestos.**
  - Estimado leva um "≈" discreto (`EstimateMark`), "estimado" no tooltip e uma nota no painel.
  - `stale`/`partial` e fontes pausadas aparecem, com o horário da nova tentativa (`components/Feedback.tsx`).
  - Dado ausente é neutro: cinza, nunca "0".
- **Cores.** Use os tokens de `src/styles.css` (`--surface`, `--border`, `--text`, `--text-soft`, `--accent`, `--danger`, `--radius`, `--shadow`, `--ease-out`). As escalas ficam na feature: `map/colors.ts` (temperatura), `rainfall/rainScale.ts`, `fire/fireStyles.ts`, `map/hydroStyles.ts` e `weather/alertStyles.ts`. O contraste dos alertas é testado.
- **Texto.** Em pt-BR. Números com `toLocaleString('pt-BR')`, temperatura sem casas decimais, horário dos focos em UTC e identificado como UTC.

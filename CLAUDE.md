# Frontend — guia para agentes

React 18 + TypeScript + Vite, Leaflet via react-leaflet 4, TanStack Query 5. Node 22. Regras gerais do projeto (direção, stack compartilhada, cotas) estão no `CLAUDE.md` da pasta acima, quando existir.

## Antes de mudar qualquer coisa visível

O dono gosta da interface atual. Preserve estrutura, comportamento e linguagem visual; mude aparência só com motivo claro de usabilidade, desempenho ou correção, e pergunte quando a mudança altera o que o usuário vê. Isto vale também para cores (`docs/COLOR_SYSTEM.md`) e para os tokens em `src/styles.css` (`--surface`, `--accent`, `--radius` etc.): reutilize-os, não crie cores soltas.

Camadas novas no mapa: poucos elementos, leves e certeiros. Prefira um contorno fino e detalhe no clique a rótulos permanentes, legendas extras, animações ou malhas de ligação. Relação duvidosa não é desenhada.

## Organização

- `src/App.tsx` compõe a experiência e coordena painéis. Não aumente mais este arquivo (já ~800 linhas): lógica nova vai para a feature.
- `src/features/<feature>/`: mapa, clima, chuva, focos, busca, acompanhamento. Estilos e escalas da camada ficam junto (`fireStyles.ts`, `rainScale.ts`, `hydroStyles.ts`).
- `src/api/`: `client.ts` (HTTP), `types.ts` (espelha os schemas do backend), `queries.ts`, `queryKeys.ts`. Toda chamada à API passa por aqui, via TanStack Query; nada de `fetch` direto em componente.
- Preferências de sessão: `src/lib/sessionStorage.ts`, chave `brasil_lens_session_v3`. Mudou o formato? Crie a v4 e adicione a v3 aos legados; não quebre sessões existentes.
- Import alias `@/` aponta para `src/`.

## Armadilhas conhecidas do Leaflet/React

- `Tooltip` permanente dentro de `Marker` não interativo derrubou o Chrome headless em zoom com muitos focos: use rótulo por `divIcon`.
- Elemento SVG animado no mesmo pane de milhares de paths força repaint do SVG inteiro a cada frame: dê a ele um `Pane` próprio.
- react-leaflet lança erro se já existe um `Pane` com o mesmo nome; panes condicionais precisam desmontar limpos.
- WMS do INPE: URL acima de ~8 KB dá 414. Mantenha `SLD_BODY` abaixo de ~5 KB codificado (aspas simples; `encodeURIComponent` não as escapa).

## Estilo

- Textos de interface em pt-BR; formatação numérica com `toLocaleString('pt-BR')`.
- Prettier: aspas simples, ponto e vírgula, linha de 100, trailing comma. ESLint com `react-hooks`.
- Quase sem comentários no código; não adicione comentários narrativos.

## Verificação

```sh
npm run lint     # eslint + tsc --noEmit
npm test         # node --test tests/*.test.mjs
```

- `tests/hydrography.test.mjs` e `tests/state-boundary.test.mjs` falham no Node 22.17 (importam `.ts` direto). Pré-existente, não é regressão.
- Testes que desmontam tarde travam o processo: desmonte os componentes antes de `client.clear()`; em testes com mutations use `mutations: { gcTime: Infinity }` no QueryClient. Na dúvida, rode com `--test-timeout`. (`timeout` não existe neste Mac.)
- Mudança visível: confirme no navegador com a skill `/browser-check` da pasta acima.

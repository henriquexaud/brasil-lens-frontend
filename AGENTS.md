# Brasil Lens — frontend

React 18 + TypeScript + Vite, react-leaflet 4 e TanStack Query 5: o mapa de clima e meio ambiente do Brasil. Consome só a API própria. A documentação de sistema (arquitetura, invariantes, domínios, decisões) fica no repositório backend (`../backend/docs/` no workspace).

**Antes de mudar algo visível, leia [docs/ui.md](docs/ui.md). O dono gosta da interface atual: pergunte antes de alterar a aparência.**

## Onde buscar contexto

| Vai mexer em | Leia antes e atualize junto |
|---|---|
| `src/api/`, `features/*/queries.ts`, `useWeatherMapData`, `sessionStorage`, camadas e panes, testes | [docs/architecture.md](docs/architecture.md) |
| cores, tokens, textos, marcação de estimado | [docs/ui.md](docs/ui.md) |
| `src/api/types.ts` (contrato) ou sequência de chamadas | `../backend/docs/architecture.md`; mude o schema do backend na mesma tarefa |

## Invariantes

1. Os dados passam só por `src/api` + TanStack Query, nunca por `fetch` em componente. Com terceiros, só tiles (Esri e o WMS do INPE, com URL e filtro vindos da API) e a inscrição Web Push nativa do navegador, autorizada pelo usuário (ADR-12 do backend). Notificações recebem o conteúdo enviado pelo backend, sem consultar fontes climáticas diretamente.
2. As constantes de frescor em `features/weather/queries.ts` (15 min, 30 min, 2 min) são as do backend. Mude os dois lados juntos.
3. Na fusão de leituras, a mais nova vence; no mesmo `observedAt`, a medida vence a estimada. Estimado sempre leva "≈". Teste: `tests/map-data.test.mjs`.
4. `stale`/`partial` e fontes pausadas ficam visíveis, e uma fonte pausada não bloqueia as outras. Teste: `tests/api-client.test.mjs`.
5. Resumo e identificação de focos mandam `at = metadata.windowEnd`, nunca `Date.now()`.
6. A chave de `sessionStorage` é versionada; uma sessão antiga não pode quebrar a carga inicial. Teste: `tests/sessionStorage.test.mjs`.

## Regras

- **Doc na mesma tarefa.** Uma mudança em contrato, fluxo de dados, consultas/cache ou comportamento de camada atualiza o doc da tabela acima. Se doc e código divergirem, o código vale.
- Camadas novas: poucas, leves e precisas. Lógica nova vai para a feature, não para `App.tsx`. Use os tokens de `styles.css`. Textos em pt-BR. Comentário só para o porquê que não é evidente.

## Verificar

```sh
npm run lint && npm test
```

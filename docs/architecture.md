# Arquitetura do frontend

A visão de sistema (API, fontes, fluxos entre repositórios) está em `../backend/docs/architecture.md`.

## Estrutura

- `src/App.tsx` orquestra escopo, camadas e painéis, e decide quando cada consulta roda: com a malha pronta, a aba visível e o mapa parado. Só coordena; lógica nova vai para a feature.
- `src/features/<feature>/`:
  - `map`: `MapView`, `TerritoryLayer`, `useTerritoryMap`, `useMapScope`, `ViewportObserver` e o mosaico de UFs visitadas;
  - `weather`: consultas, pontos, alertas e painel;
  - `rainfall` e `fire`: escalas, legendas e o WMS de focos;
  - `search` e `follow`.
- `src/api/`: `client.ts`, `types.ts` (espelho dos schemas do backend), `queries.ts`, `queryKeys.ts`, `queryLifecycle.ts`. `src/lib/`: formatação pt-BR, `sessionStorage`, `scheduleIdle`, visibilidade da página.
- Cálculo testável (escalas, cores, fusão) fica em `.ts` puro, sem React. O alias `@/` aponta para `src/`.

## Dados

- **Repasse da Open-Meteo (`api/open-meteo/v1/forecast.ts`):** função da Vercel usada só pela API em produção, porque o IP de saída do Render tem a cota da Open-Meteo esgotada por outros serviços (ADR-10 no backend). Exige `OPEN_METEO_RELAY_KEY` no header `x-relay-key`. Não entra no bundle nem no container local.
- **Cliente (`client.ts`):** `VITE_API_BASE_URL` é fixada no build. Erros viram `ApiError`, e só falhas passageiras (5xx, rede) são repetidas, até 2 vezes. A pausa é por fonte (`weather`, `fire`, `hydrography`): `provider_rate_limited` pausa até o usuário pedir nova tentativa; outras falhas, de 30 s a 5 min, com retomada automática. `requestForcedWeatherRefresh()` acrescenta `force=true` por 4 s.
- **Consultas:** as chaves incluem escopo, nível e LOD. A validade do clima segue a idade da leitura (`observedAt` + 15 ou 30 min, no mínimo 2 min), igual ao backend. Alertas: polling de 90 s, revalidado pelo navegador com o ETag da API (`304` sem corpo enquanto nada muda). Malha: `staleTime` de 30 min. Consultas desligadas são canceladas (`useCancelWhenDisabled`), páginas extras carregam quando o navegador está ocioso (`useIdleNextPage`) e leituras em lote semeiam o cache da seleção (`seedCityWeather`). No pan, o clima por viewport mostra a leitura anterior da mesma UF até a nova chegar.
- **Hidrografia (`useHydrography`):** é a camada de menor prioridade. A chave é só `(detalhe, área)`, sem UF. Ela espera o clima (inclusive o do viewport) e 500 ms de mapa parado. Reaproveita qualquer área já carregada no mesmo detalhe que cubra a vista; se não houver, pede o bbox numa grade grossa (`hydroArea`), e nenhum abaixo do zoom 6. Só uma requisição corre por vez e nenhuma é abortada, porque o servidor termina a consulta à ANA mesmo sem o cliente, e assim a resposta fica no cache. Enquanto a área nova não chega, os rios anteriores continuam na tela. Resposta `ok` não fica velha; `partial` vale 60 s.
- **Fusão (`useWeatherMapData.ts`):** dentro da UF, a leitura mais nova vence; se empatar, a medida vence a estimada. Trocar de UF limpa tudo.
- **Mutações** de acompanhamento são otimistas (`onMutate`), com rollback no `onError`.
- **Sessão:** `sessionStorage` na chave `brasil_lens_session_v3`. Se o formato mudar, a chave vira v4 e a v3 entra na lista de legadas, que são limpas.

## Camadas do mapa

Panes, de baixo para cima: `basemap` 200 (Esri, opacidade 0,32), território 400, `discovered-mosaic` 420, `hydrography` 425, `state-outline` 430, `fire-hotspots` 435 (WMS, zoom ≥ 9), `weather-alerts` 450, `territory-hover`/`territory-selection` 470/480, `weather-points` 490. Um pane novo precisa de nome único e deve respeitar essa ordem.

- `activeThematicLayer` (`climate`, `rainfall`, `fire`, `none`) define a pintura. Clima e chuva usam a mesma resposta. Focos aparecem como coroplética abaixo do zoom 9 e como pontos a partir dele (`fireMode`).
- A malha chega em `overview` e é trocada por `detail`. Com zoom ≥ 8 dentro da UF, o clima vem do viewport e o contorno fino, da malha canônica.
- **Armadilhas:**
  - SVG animado precisa de pane próprio; no mesmo pane de milhares de paths, repinta tudo a cada frame.
  - `Tooltip` permanente em `Marker` não interativo derruba o Chrome headless; use `divIcon`.
  - Pane com nome repetido faz o react-leaflet lançar erro.
  - O `SLD_BODY` precisa ficar abaixo de ~5 KB, com aspas simples.
  - Trabalho de fundo pausa enquanto o mapa se move.
  - O `GeoJSON` do react-leaflet reaplica o estilo em todas as feições quando `style` muda de identidade. Mantenha `style` estável (funções e objetos memoizados; `Set`/`Map` derivados também) e, no território, aplique só o que mudou por polígono. Com 800+ municípios, um `new Set()` por render bastava para repintar a malha a cada commit.
  - Rótulos numerosos são `Marker` com `divIcon` e conteúdo por portal, não `Tooltip` permanente, que mede o próprio tamanho a cada passo de zoom e a cada re-render. As pílulas usam opacidade 0,9, a da tooltip que tinham antes, e só re-renderizam quando muda o que desenham.
  - `backdrop-filter` em dezenas de elementos sobre o mapa custa ~1 em cada 4 quadros no zoom. Dentro de um ancestral com opacidade < 1, ele nem aparece.

## Testes

- `npm run lint` roda eslint e tsc. `node --test --test-timeout=60000 tests/*.test.mjs` roda os testes. Os que usam React compilam `src/` com esbuild e montam num DOM do jsdom (modelo: `tests/map-data.test.mjs`).
- Desmonte antes de `client.clear()`. Use `mutations: { gcTime: Infinity }` no QueryClient de teste. Sem isso, timers órfãos mantêm o processo vivo.
- `hydrography.test.mjs` e `state-boundary.test.mjs` falham no Node 22.17 porque importam `.ts`. É pré-existente, não é regressão.
- Mudança visível deve ser conferida no navegador com uma stack isolada (skill `/browser-check` do workspace), nunca na stack da porta 5173.

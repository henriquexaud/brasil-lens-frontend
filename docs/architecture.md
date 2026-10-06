# Arquitetura do frontend

A visão de sistema (API, fontes, fluxos entre repositórios) está em `../backend/docs/architecture.md`.

## Estrutura

- `src/App.tsx` orquestra escopo, camadas e painéis, e decide quando cada consulta roda: com a malha pronta, a aba visível e o mapa parado. Só coordena; lógica nova vai para a feature.
- `src/features/<feature>/`:
  - `map`: `MapView`, `TerritoryLayer`, `useTerritoryMap`, `useMapScope`, `ViewportObserver` e o mosaico de UFs visitadas;
  - `weather`: consultas, pontos, alertas e painel;
  - `rainfall` e `fire`: escalas, legendas e o WMS de focos;
  - `search`, `follow` e `auth` (tela, sessão e conta).
- `src/api/`: `client.ts`, `types.ts` (espelho dos schemas do backend), `queries.ts`, `queryKeys.ts`, `queryLifecycle.ts`. `src/lib/`: formatação pt-BR, `sessionStorage`, `scheduleIdle`, visibilidade da página.
- Cálculo testável (escalas, cores, fusão) fica em `.ts` puro, sem React. O alias `@/` aponta para `src/`.

## Dados

- **Repasse da Open-Meteo (`api/open-meteo/v1/forecast.ts`):** função da Vercel usada só pela API em produção, porque o IP de saída do Render tem a cota da Open-Meteo esgotada por outros serviços (ADR-10 no backend). Exige `OPEN_METEO_RELAY_KEY` no header `x-relay-key`. Não entra no bundle nem no container local.
- **Cliente (`client.ts`):** `VITE_API_BASE_URL` é fixada no build. Erros viram `ApiError`, e só falhas passageiras (5xx, rede) são repetidas, até 2 vezes. A pausa é por fonte (`weather`, `fire`, `hydrography`): `provider_rate_limited` pausa até o usuário pedir nova tentativa; outras falhas, de 30 s a 5 min, com retomada automática. `requestForcedWeatherRefresh()` acrescenta `force=true` por 4 s.
- **Consultas:** as chaves incluem escopo, nível e LOD. A validade do clima segue a idade da leitura (`observedAt` + 15 ou 30 min, no mínimo 2 min), igual ao backend. Alertas: polling de 90 s, revalidado pelo navegador com o ETag da API (`304` sem corpo enquanto nada muda). Malha: `staleTime` de 30 min. Consultas desligadas são canceladas (`useCancelWhenDisabled`), páginas extras carregam quando o navegador está ocioso (`useIdleNextPage`) e leituras em lote semeiam o cache da seleção (`seedCityWeather`). No pan, o clima por viewport mostra a leitura anterior da mesma UF até a nova chegar.
- **Hidrografia (`useHydrography`):** é a camada de menor prioridade. A chave é só `(detalhe, área)`, sem UF. Ela espera o clima (inclusive o do viewport) e 500 ms de mapa parado. Reaproveita qualquer área já carregada no mesmo detalhe que cubra a vista; se não houver, pede o bbox numa grade grossa (`hydroArea`), e nenhum abaixo do zoom 6. Só uma requisição corre por vez e nenhuma é abortada, porque o servidor termina a consulta à ANA mesmo sem o cliente, e assim a resposta fica no cache. Enquanto a área nova não chega, os rios anteriores continuam na tela. Resposta `ok` não fica velha; `partial` vale 60 s.
- **Fusão (`useWeatherMapData.ts`):** dentro da UF, a leitura mais nova vence; se empatar, a medida vence a estimada. Trocar de UF limpa tudo.
- **Autenticação:** `AuthProvider` consulta `/auth/me` antes de montar o mapa; 401 abre `AuthScreen`, erro de conexão oferece nova tentativa. Cadastro e login aplicam o tema salvo e montam o mapa; logout revoga a sessão e limpa consultas privadas. A API usa cookie HttpOnly; `client.ts` manda `credentials: include` e `X-Brasil-Lens-Client: web` nas escritas. Um 401 de `/me/*` retorna à tela de acesso. A conta é revalidada ao voltar à aba. `VITE_API_BASE_URL=/api/v1` usa o proxy do Vite/nginx no local e o rewrite da Vercel em produção, evitando cookies de terceiros. Senhas e tokens não ficam em localStorage/sessionStorage.
- **Acompanhamento:** as chaves privadas incluem o ID da conta (`['me', userId, 'followed-municipalities']`). A lista vem do banco ao montar o mapa; não há cópia em armazenamento local. **Mutações** são otimistas (`onMutate`), com rollback no `onError`; o logout espera escritas em andamento. A API decide a conta pelo cookie.
- **Sessão:** `sessionStorage` na chave `brasil_lens_session_v3`. Se o formato mudar, a chave vira v4 e a v3 entra na lista de legadas, que são limpas.
- **Tema:** `app/theme.ts` valida e persiste `light`/`dark` em `localStorage` (`brasil_lens_theme_v1`), separado da sessão do mapa; valor inválido ou armazenamento indisponível usa o claro. Um bootstrap no `index.html` aplica `data-theme` antes da primeira pintura. Após autenticar, o tema do banco prevalece e atualiza esse valor local. `ThemeSwitch` usa `useTheme`, atualiza os tokens da raiz e a meta `theme-color`, sincroniza alterações de outras abas por `storage` e as da conta por um evento local. Autenticado, cada troca salva `/me/preferences`; o controle aguarda a escrita, e falhas mostram nova tentativa junto à conta. Na tela de login a escolha é local e vira o tema inicial de novos cadastros. O mapa não consome o contexto da conta: Leaflet resolve os tokens nos atributos SVG sem reaplicar estilos por React nem animar paths.

## Instalação (PWA)

- O app é instalável no desktop e no celular só com `public/manifest.webmanifest` (`display: standalone`) e o `<link rel="manifest">` do `index.html`. Chrome e Edge não exigem service worker para instalar; no iOS e no Safari do macOS a instalação é manual (Compartilhar → Adicionar à Tela de Início / ao Dock).
- **Sem service worker, de propósito.** Sem a API o mapa não tem o que mostrar, e um cache de shell ou de respostas serviria bundle e leituras velhas por fora das regras de frescor do TanStack Query. Quem instalou recebe a versão nova a cada abertura, como no navegador.
- Ícones em `public/`: `icon-192.png` e `icon-512.png` (transparentes), `icon-maskable-512.png` (fundo branco, arte dentro da zona segura de 80%, para o Android recortar) e `apple-touch-icon.png` (fundo branco: o iOS pinta transparência de preto). Os dois últimos derivam do `icon-512.png`; se o logo mudar, gere-os de novo.
- `theme_color`/`background_color` do manifesto e o valor inicial do `<meta name="theme-color">` repetem `--surface-muted` do tema claro. Mude os três juntos. No escuro, o bootstrap e `app/theme.ts` atualizam a meta para a superfície do tema; o manifesto mantém os valores claros de instalação.

## Camadas do mapa

Panes, de baixo para cima: `basemap` 200 (Esri, opacidade 0,32), território 400, `discovered-mosaic` 420, `hydrography` 425, `state-outline` 430, `fire-hotspots` 435 (WMS, zoom ≥ 9), `weather-alerts` 450, `territory-hover`/`territory-selection` 470/480, `weather-points` 490. Um pane novo precisa de nome único e deve respeitar essa ordem.

O filtro noturno fica só no `basemap`, sem trocar provider ou URL. Contornos, neutros e skeleton usam tokens `--map-*`; escalas semânticas continuam nas features. O mosaico opaco mistura a cor original com `--map-land` do tema para evitar pintura dupla sobre a UF e manter sua aparência compatível com os territórios. No pane dos alertas, um segundo contorno neutro fica sob cada path original; sua opacidade CSS é zero no claro e discreta no escuro, sem alterar a severidade. No mobile, `scopeInsets` mede a distância entre a base do mapa e o topo real da gaveta, incluindo o espaço do switch e a área segura, com o mesmo limite de 40%.

- `activeThematicLayer` (`climate`, `rainfall`, `fire`, `none`) define a pintura. Clima e chuva usam a mesma resposta. Focos aparecem como coroplética abaixo do zoom 9 e como pontos a partir dele (`fireMode`).
- A malha chega em `overview` e é trocada por `detail`. Com zoom ≥ 8 dentro da UF, o clima vem do viewport e o contorno fino, da malha canônica.
- **Armadilhas:**
  - Nenhum path SVG do mapa leva `transition` ou `animation` CSS. O Leaflet põe `will-change: transform` em cada SVG, um por pane, e cada um vira uma camada de GPU do tamanho da tela mais 20% (~44 MB em DPR 2). Um path animado repinta a camada inteira a cada quadro, independentemente de quantos paths existam. Medido no Chrome com GPU (Roraima): com as animações de path, entrar no estado ou trocar Clima/Chuva produzia de 9 a 85 quadros com tiles faltando (a cor pisca, e busca e painel atrasam junto); sem elas, nenhum. Movimento no mapa só na opacidade do pane, que o compositor faz sem repintar: o skeleton de carga (`PendingTerritoriesLayer`) fica no pane `territory-pending` e pulsa assim; `loading` vem de `territoryDataLoading` em `App.tsx`.
  - O Leaflet projeta um path no zoom do quadro atual, mas o SVG do pane só adota o zoom novo no `zoomend`. Path criado ou reprojetado (`addData`, `setLatLngs`) no meio de um `flyTo` ou pinça aparecia deslocado em até ~1900 px até o fim do voo: era a "piscada" da malha ao entrar num estado. `map/RendererSync.tsx` realinha o renderer em todo `layeradd`; quem chama `setLatLngs` chama `realignRenderer` (`map/realignRenderer.ts`) em seguida.
  - `Tooltip` permanente em `Marker` não interativo derruba o Chrome headless; use `divIcon`.
  - Pane com nome repetido faz o react-leaflet lançar erro.
  - Roda e trackpad passam por `map/WheelGestures.tsx`, não pelo `scrollWheelZoom` do Leaflet (desligado): pinça (wheel + `ctrlKey`, ou `GestureEvent` no Safari) e roda do mouse dão zoom em volta do cursor; dois dedos arrastam. Durante o gesto usa o caminho interno da pinça do Leaflet (`_move` com `pinch`), que só transforma panes e SVG; `zoomend`/`moveend` saem uma vez, no fim.
  - O mosaico de estados explorados (pane 420) cobre a divisa branca da malha nacional; `TerritoryLayer` redesenha essas divisas no pane `covered-state-borders` (421).
  - O `SLD_BODY` precisa ficar abaixo de ~5 KB, com aspas simples.
  - Trabalho de fundo pausa enquanto o mapa se move.
  - O `GeoJSON` do react-leaflet reaplica o estilo em todas as feições quando `style` muda de identidade. Mantenha `style` estável (funções e objetos memoizados; `Set`/`Map` derivados também) e, no território, aplique só o que mudou por polígono. Com 800+ municípios, um `new Set()` por render bastava para repintar a malha a cada commit.
  - Rótulos numerosos são `Marker` com `divIcon` e conteúdo por portal, não `Tooltip` permanente, que mede o próprio tamanho a cada passo de zoom e a cada re-render. As pílulas usam opacidade 0,9, a da tooltip que tinham antes, e só re-renderizam quando muda o que desenham.
  - `backdrop-filter` em dezenas de elementos sobre o mapa custa ~1 em cada 4 quadros no zoom. Dentro de um ancestral com opacidade < 1, ele nem aparece.

## Testes

- `npm run lint` roda eslint e tsc. `npm test` roda os testes (`node --experimental-strip-types --test`: a flag deixa um teste importar `.ts` direto no Node 22.17; nas versões novas ela é o padrão). Os que usam React compilam `src/` com esbuild e montam num DOM do jsdom: o `tests/helpers/harness.mjs` faz isso (`installDom`, `loadModule`; modelo: `tests/app-state.test.mjs`). Os testes mais antigos ainda repetem o esbuild à mão.
- Desmonte antes de `client.clear()`. Use `mutations: { gcTime: Infinity }` no QueryClient de teste. Sem isso, timers órfãos mantêm o processo vivo.
- Sem teste dedicado: a composição de `App.tsx`, `MapView`, `TerritoryLayer`, `WheelGestures`, `SearchBox` e os painéis. Eles só são conferidos no navegador (`/browser-check`).
- Mudança visível deve ser conferida no navegador com uma stack isolada (skill `/browser-check` do workspace), nunca na stack da porta 5173.

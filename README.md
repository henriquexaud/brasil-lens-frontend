# Brasil Lens — frontend

Mapa coroplético interativo do Brasil: escolha um indicador e um ano, passe o
cursor sobre os estados, abra um estado para ver os municípios e salve os
recortes que quiser rever.

A API, o banco e a ingestão dos dados do IBGE estão no repositório principal,
**[brasil-lens-backend](https://github.com/henriquexaud/brasil-lens-backend)** —
que também sobe este frontend com um único comando.

**Princípio central:** o browser nunca fala com o IBGE. Todo dado vem da API do
projeto, que entrega GeoJSON já com valor, estatística e classes de coropleta —
este frontend renderiza sem transformar.

---

## Como rodar

### Aplicação completa (recomendado)

Banco + API + este frontend, a partir do repositório do backend — não é preciso
clonar este repositório:

```bash
git clone https://github.com/henriquexaud/brasil-lens-backend.git
cd brasil-lens-backend
docker compose up --build --wait
docker compose run --rm api python -m app.jobs.bootstrap    # dados do IBGE (~10 min, só na 1ª vez)
```

Abra <http://localhost:5173>.

### Só o frontend, com Docker

Com a API já no ar em `http://localhost:8000` (no backend:
`docker compose up --build --wait db api`):

```bash
git clone https://github.com/henriquexaud/brasil-lens-frontend.git
cd brasil-lens-frontend
docker compose up --build --wait     # http://localhost:5173
```

### Desenvolvimento, com Node

Requer Node 20+ (a imagem usa 22). Recarrega o navegador a cada edição:

```bash
npm install
npm run dev      # http://localhost:5173
```

---

## Arquitetura

```mermaid
flowchart LR
    IBGE["IBGE / SIDRA<br/>APIs públicas"]
    API["<b>brasil-lens-backend</b><br/>FastAPI + PostgreSQL/PostGIS"]
    WEB["<b>brasil-lens-frontend</b><br/>React + Leaflet"]

    IBGE -- "ingestão offline" --> API
    API -- "GET: GeoJSON, catálogo, detalhe" --> WEB
    WEB -- "POST · PUT · DELETE /views" --> API
    IBGE -. "nunca acessado pelo browser" .-x WEB
```

O diagrama completo, com as camadas do backend, está no
[README do backend](https://github.com/henriquexaud/brasil-lens-backend#arquitetura).

Stack: React 18 · Vite 6 · TypeScript 5.7 (strict) · TanStack Query 5 ·
Leaflet 1.9 · react-leaflet 4. Versões fixadas em [`package.json`](package.json).

Não há Redux nem store global: o único estado difícil do produto são respostas
de servidor cacheadas por (indicador, ano, escopo), que é exatamente o que o
TanStack Query resolve. O estado de interface (indicador escolhido, território
selecionado) mora em `useState` e em hooks locais.

---

## Configuração

Tudo tem default; para mudar, copie [`.env.example`](.env.example) para `.env`.

| Variável | Default | Observação |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | URL da API usada pelo **navegador** |
| `WEB_PORT` | `5173` | porta publicada pelo `docker-compose.yml` |

O Vite resolve `import.meta.env.VITE_*` em tempo de **build**: a URL é assada no
bundle. Mudá-la exige reconstruir (`docker compose up --build` ou
`npm run build`) — editar o `.env` com o bundle pronto não tem efeito. No
Docker, ela entra como `--build-arg`.

A API precisa listar a origem deste frontend em `CORS_ORIGINS` (o default do
backend já inclui `http://localhost:5173`), senão o navegador recusa
`POST`/`PUT`/`DELETE` já no preflight.

---

## O que o frontend consome

| Método | Rota | Onde |
|---|---|---|
| `GET` | `/map?level=&parent=&indicator=&year=` | camada do mapa (`useMapLayer`) |
| `GET` | `/indicators?level=` | seletores de indicador e ano (`useIndicators`) |
| `GET` | `/territories/{code}/overview` | painel de detalhe (`useTerritoryOverview`) |
| `GET` | `/territories?level=state` | nomes das UFs nas visualizações (`useTerritories`) |
| `GET` | `/views` | lista de visualizações salvas (`useSavedViews`) |
| `POST` | `/views` | "Salvar atual" (`useCreateSavedView`) |
| `PUT` | `/views/{id}` | renomear (`useUpdateSavedView`) |
| `DELETE` | `/views/{id}` | excluir, com confirmação (`useDeleteSavedView`) |

`src/api/client.ts` é o único lugar que conhece URLs; `src/api/types.ts` espelha
os schemas Pydantic do backend à mão, sem `any`, para uma mudança de contrato
aparecer na compilação e não em runtime.

Nenhuma escrita é otimista: cada mutação invalida a lista e a interface passa a
refletir o banco. Em uma lista de marcadores, mostrar uma linha que o servidor
recusou seria pior que esperar 40 ms.

---

## Estrutura

```
src/
  api/                client.ts (fetch + erros tipados), queries.ts (hooks), types.ts
  components/         Select.tsx, Feedback.tsx
  features/
    map/              MapView.tsx, ChoroplethLayer.tsx, Legend.tsx, colors.ts, useMapScope.ts
    controls/         ControlPanel.tsx — filtros de indicador e ano
    detail/           TerritoryDetailPanel.tsx
    views/            SavedViewsPanel.tsx — o CRUD de visualizações
  lib/format.ts       formatação pt-BR (números, moeda, unidades)
  styles.css          um único arquivo, com tokens em :root
  App.tsx, main.tsx
Dockerfile            build do Vite + nginx
nginx.conf            SPA fallback e cache dos assets com hash
docker-compose.yml    sobe só este frontend
```

Convenções: **componentes React em `PascalCase`** (arquivo e símbolo); hooks e
utilitários em `camelCase`; um diretório por *feature*, não por tipo de arquivo.

---

## Qualidade

```bash
npm run lint      # eslint + tsc --noEmit
npm test          # animações, disclosures e prioridade das consultas
npm run format    # prettier
npm run build     # tsc -b && vite build
```

TypeScript roda em `strict`, com `noUnusedLocals`, `noUncheckedIndexedAccess` e
`verbatimModuleSyntax`.

### Contexto de clima

Compartilha mapa, busca, seleção, destaque e navegação entre estados e
municípios com o contexto sociopolítico. O Brasil exibe temperaturas nas
capitais; selecionar uma UF mostra as condições da capital como referência.
Ao entrar na UF, `/weather/municipalities` carrega as condições atuais de
todos os municípios em lotes de 16, sem o antigo limite de duas etapas.
As 27 capitais chegam em lotes de seis, começando com referências das cinco regiões.
As consultas começam depois do mapa, usam os momentos ociosos do navegador
e pausam enquanto uma seleção ou previsão carrega. Sair do recorte cancela
o lote pendente; os já concluídos permanecem no cache.

Selecionar ou buscar um município reutiliza esses dados imediatamente,
consultando `/weather/current?territory=<IBGE>&forecast=false` se necessário.
As condições selecionadas e as capitais atualizam a cada cinco minutos;
o cache municipal é revalidado ao voltar a um recorte depois desse intervalo.
A previsão de três dias (`forecast=true`) só carrega ao abrir **Próximos dias**.

O painel mostra o dado principal. **Mais detalhes** reúne os outros valores,
horário e referência espacial. **Camadas e fontes** consulta os avisos INMET,
permite habilitar sua sobreposição e apresenta fontes e atualização manual.
Os avisos ficam abaixo das divisas e não interceptam cliques. Nenhuma chave
de API é necessária; a atribuição da Open-Meteo permanece no mapa.

### Hierarquia e carregamento

Mapa e catálogo do indicador iniciam juntos. O índice de busca é antecipado
depois do mapa, ou imediatamente quando a busca recebe foco. O valor principal
sociopolítico vem do próprio mapa; os demais indicadores só são consultados
ao expandir **Mais detalhes**. Ajustes de ano, informações da fonte e ações de
visualizações salvas ficam recolhidos. Painéis de detalhe e camadas climáticas
têm bundles separados, carregados quando entram em uso. Hover, seleção,
busca e botões contextuais orientam a navegação, sem textos instrucionais fixos.

### Clima, focos de calor e hidrografia

O clima é carregado primeiro, após a base cartográfica. **Camadas e fontes → Focos de
calor (INPE)** liga/desliga a pintura dominante, preservando a escolha na sessão.
No Brasil, ela pinta estados; dentro da UF, pinta municípios. Ambos usam a mesma
escala fixa de focos por 1.000 km², com áreas canônicas IBGE e totais INPE de 48h.
Ao desligar fogo, a temperatura volta a preencher o mapa. No zoom próximo (≥9),
os pontos WMS acrescentam os detalhes reais de cada detecção.

Tooltips informam contagens 24h/48h, densidade, área e última detecção. O ranking
fica recolhido por padrão. Detalhes de satélite, FRP e risco são buscados ao clicar
no ponto; não são tratados como área queimada ou probabilidade de incêndio.

O botão ao lado direito da busca solicita localização somente após clique, resolve
o município no backend e aproxima o mapa. Selecionar uma cidade pela busca ou pelo
mapa também a enquadra. No zoom ≥8 dentro de uma UF, malhas e clima de todos os
municípios visíveis são carregados em lotes, inclusive vizinhos de outros estados.
Arrastar cancela pedidos do viewport anterior e reaproveita dados já consultados.
O backend usa Redis para compartilhar e persistir temporariamente esses resultados.

Hidrografia permanece por último, depois das consultas principais e de um período
ocioso; rios simplificados chegam primeiro, lagos depois, sem loader invasivo. A
escala limita os dados baixados, e azul/espessura são secundários. Busca, seleção,
contornos e duplo clique territorial permanecem disponíveis.

### Contornos oficiais e atualização progressiva

No clima, a malha municipal usa o LOD `canonical` do IBGE, sem simplificação
adicional no navegador. Páginas de 24 municípios substituem o download integral
do estado. A capital vem primeiro na visão estadual; no zoom próximo, o centro
do viewport tem prioridade. Busca e seleção carregam uma geometria individual
quando necessário e reutilizam as que já chegaram.

Cada lote acrescenta os caminhos SVG ao mapa existente, preservando foco e
interação. Municípios sem clima carregado permanecem neutros, sem temperatura
emprestada de vizinhos. Movimento e seleção pausam os próximos lotes; mudança
de área cancela consultas antigas, e abas ocultas suspendem o trabalho secundário.
Alertas e camadas opcionais não bloqueiam o primeiro desenho nem aguardam todos
os municípios. A busca é antecipada após o primeiro lote climático.

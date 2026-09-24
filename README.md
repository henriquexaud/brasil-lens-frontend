# Brasil Lens — Interface Web (Frontend)

Interface web interativa da plataforma **Brasil Lens**, desenvolvida para visualização e análise espacial de dados socioeconômicos, demográficos e ambientais do Brasil através de mapas coropléticos em múltiplos níveis (País, Região, Estado e Município).

Este repositório contém a **Interface Web (SPA)** construída com React 18, TypeScript e Leaflet, empacotada com Vite e servida em produção através de container Nginx de alta performance.

> **Importante para Avaliação:**
> - **Dockerfile da Interface:** Presente na raiz deste repositório ([`Dockerfile`](Dockerfile)), utilizando build multi-estágio (Node 22 para compilação e Nginx Alpine leve para servir o bundle).
> - **Docker Compose da Interface:** Presente na raiz deste repositório ([`docker-compose.yml`](docker-compose.yml)), permitindo subir a interface isoladamente com um único comando. *(A aplicação completa — banco, redis, api e frontend — também pode ser orquestrada a partir da raiz do repositório da API).*

---

## Funcionalidades Principais

- **Mapa Coroplético Interativo:** Visualização de indicadores socioeconômicos com cálculo dinâmico de quantis e classificação cromática.
- **Navegação Multinível com Drill-Down:** Exploração contínua do Brasil até o nível de cada um dos 5.570 municípios.
- **Carregamento Progressivo (LOD):** Exibição instantânea com malha simplificada (`overview`) e refinamento em alta definição (`detail`) durante a ociosidade do navegador.
- **Camadas Ambientais em Tempo Real:** Visualização de temperatura, chuva acumulada (Open-Meteo), focos de queimadas e WMS (INPE) e alertas de risco (INMET/CEMADEN).
- **Painel de Controle e CRUD de Visualizações:** Filtros de indicador e ano, busca debounced de municípios e gerenciamento completo de recortes salvos pelo usuário.

---

## Instruções de Instalação e Execução

### Opção 1: Execução com Docker e Docker Compose (Recomendado)

Esta opção constrói o bundle de produção e disponibiliza a interface no Nginx:

#### 1. Clonar o repositório
```bash
git clone https://github.com/henriquexaud/brasil-lens-frontend.git
cd brasil-lens-frontend
```

#### 2. Subir o container
```bash
docker compose up --build --wait
```
*Acesse a aplicação em:* [`http://localhost:5173`](http://localhost:5173)

> **Nota:** Para que o mapa exiba os dados, a API backend deve estar em execução na porta `8000`. Para subir a solução inteira de uma vez (banco + API + frontend), use o repositório principal: [`brasil-lens-backend`](https://github.com/henriquexaud/brasil-lens-backend).

Para parar o container: `docker compose down`.

---

### Opção 2: Desenvolvimento Local com Node.js

Para desenvolvimento com recarga automática (*Hot Module Replacement*):

#### 1. Pré-requisitos
- Node.js versão 20 ou superior (versão recomendada: 22)
- Gerenciador de pacotes `npm`

#### 2. Instalar dependências
```bash
npm install
```

#### 3. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
*O Vite iniciará o servidor local em:* [`http://localhost:5173`](http://localhost:5173)

---

## Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor local de desenvolvimento com hot-reload |
| `npm run build` | Compila o TypeScript (`tsc -b`) e gera o bundle de produção minificado em `dist/` |
| `npm run lint` | Executa o ESLint e validação estrita de tipos com `tsc --noEmit` |
| `npm test` | Executa os testes automatizados da interface |
| `npm run format`| Formata o código-fonte de acordo com as regras do Prettier |

---

## Configuração (Variáveis de Ambiente)

As configurações são definidas no arquivo `.env` (baseado em [`.env.example`](.env.example)):

| Variável | Valor Padrão | Descrição |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | URL base da API REST consumida pelo navegador |
| `WEB_PORT` | `5173` | Porta publicada no host pelo Docker Compose |

> **Atenção:** Como o Vite processa as variáveis `VITE_*` durante a compilação do bundle (*build time*), qualquer alteração na URL da API requer uma nova compilação (`npm run build` ou `docker compose up --build`).

---

## Documentação Técnica Aprofundada

Para consultar a documentação detalhada sobre o funcionamento interno, arquitetura e convenções visuais, acesse a pasta [`docs/`](docs/):

- 🏛️ [**Arquitetura do Frontend (`docs/ARCHITECTURE.md`)**](docs/ARCHITECTURE.md): Organização por features, gerenciamento de estado com TanStack Query e estratégias de performance.
- 🗺️ [**Funcionalidades e Camadas do Mapa (`docs/FEATURES_AND_LAYERS.md`)**](docs/FEATURES_AND_LAYERS.md): Detalhamento do mapa coroplético, LOD, camadas climáticas, focos de calor do INPE e alertas.
- 🔌 [**Integração com a API (`docs/API_INTEGRATION.md`)**](docs/API_INTEGRATION.md): Cliente HTTP, tipagem estrita espelhando o backend, resiliência e invalidação cirúrgica de cache.
- 🎨 [**Sistema de Cores Cartográficas (`docs/COLOR_SYSTEM.md`)**](docs/COLOR_SYSTEM.md): Paletas temáticas por contexto (Socioeconômico, Clima e Queimadas) e acessibilidade.

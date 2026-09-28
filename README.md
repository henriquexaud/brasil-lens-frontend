# Brasil Lens — Frontend

Interface principal do Brasil Lens, uma aplicação para explorar clima e meio ambiente no Brasil. React, TypeScript, Leaflet e TanStack Query compõem o mapa territorial, as condições meteorológicas, chuva acumulada, alertas, focos de calor, hidrografia e municípios acompanhados.

## Dependências e instalação

Requisitos para desenvolvimento: Git, Node.js 22 e npm. A [API própria](https://github.com/henriquexaud/brasil-lens-backend) deve estar em execução e com os dados territoriais importados.

```sh
git clone https://github.com/henriquexaud/brasil-lens-frontend.git
cd brasil-lens-frontend
npm ci
npm run dev
```

A interface estará em `http://localhost:5173`. O backend oferece um Compose que sobe toda a aplicação, incluindo este frontend, PostgreSQL/PostGIS e Redis.

## Configuração

Copie `.env.example` para `.env` para personalizar:

- `VITE_API_BASE_URL`: URL acessível pelo navegador, por padrão `http://localhost:8000/api/v1` na execução isolada. No Compose completo, `/api/v1` usa o proxy Nginx para o serviço interno `api:8000`.
- `WEB_PORT`: porta publicada pelo Compose, por padrão `5173`.

As variáveis `VITE_*` são incorporadas durante o build. Após mudar a URL, reinicie o Vite em desenvolvimento ou reconstrua a imagem/bundle. Para acessar uma API em outra origem, inclua a origem da interface em `CORS_ORIGINS` no backend. Uma URL com `localhost` aponta para o computador de quem abre o navegador.

## Docker

Requisitos: Docker e Docker Compose v2. O Dockerfile compila com Node e serve o bundle com Nginx; Node e ferramentas de desenvolvimento não entram na imagem final.

```sh
docker compose up --build --wait
```

Este Compose sobe apenas a interface. O Nginx pode iniciar sem o serviço interno `api`; nesse modo o navegador usa a URL absoluta configurada da API. No Compose completo do backend, o mesmo Nginx resolve `api` pelo DNS do Docker e encaminha `/api/` à API. Para parar: `docker compose down`.

## Arquitetura e operações

A interface consome a API própria por REST (prefixo `/api/v1`). A API processa fontes públicas, como IBGE para geografia e Open-Meteo para clima, e entrega contratos prontos para o mapa, agregações e análises espaciais. Os municípios acompanhados ficam no PostgreSQL da API; ainda não há autenticação, então a lista pertence ao usuário único da instalação. Detalhes em [Integração com a API](docs/API_INTEGRATION.md).

## Comandos

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor local |
| `npm run build` | Verifica tipos e compila para produção |
| `npm run preview` | Serve o bundle produzido, para verificação local |
| `npm run lint` | Executa ESLint e TypeScript |
| `npm test` | Executa os testes da interface |

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Camadas do mapa](docs/FEATURES_AND_LAYERS.md)
- [Integração com a API](docs/API_INTEGRATION.md)
- [Cores do mapa](docs/COLOR_SYSTEM.md)

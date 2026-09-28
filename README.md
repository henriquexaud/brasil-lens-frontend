# Brasil Lens — Frontend

Interface do Brasil Lens: um mapa de clima e meio ambiente do Brasil (condições e previsão, chuva, alertas, focos de calor, hidrografia e municípios acompanhados), feito com React, TypeScript, Leaflet e TanStack Query.

## Rodar

Requisitos: Node.js 22 e a [API](https://github.com/henriquexaud/brasil-lens-backend) rodando, com os territórios importados. O Compose do backend sobe a aplicação inteira.

```sh
npm ci
npm run dev        # http://localhost:5173
npm run lint       # eslint + tsc
npm test           # node --test
npm run build
```

`VITE_API_BASE_URL` (em `.env`) é a URL da API vista pelo navegador. O padrão é `http://localhost:8000/api/v1`; atrás do nginx do Compose, `/api/v1`. O valor é fixado no build. Se a API estiver em outra origem, inclua esta origem em `CORS_ORIGINS` no backend.

Docker: `docker compose up --build --wait` sobe só a interface (bundle servido por nginx).

Vercel (preset Vite): defina `VITE_API_BASE_URL` com a URL absoluta da API e inclua o domínio da Vercel em `CORS_ORIGINS` no backend. O `vercel.json` só dá cache longo aos assets com hash. Passo a passo: `../backend/docs/development.md#deploy`.

## Documentação

[AGENTS.md](AGENTS.md) é o mapa do projeto: arquitetura, invariantes, UI e testes. A documentação de sistema fica no [backend](https://github.com/henriquexaud/brasil-lens-backend/tree/main/docs).

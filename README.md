# Brasil Lens — Frontend

Brasil Lens é uma aplicação web para explorar clima e meio ambiente no Brasil. O frontend usa React, TypeScript e Leaflet para apresentar o mapa territorial, observações meteorológicas, precipitação, alertas, focos de calor e hidrografia.

## Executar localmente

Requisitos: Node.js 20 ou superior e npm.

```bash
npm install
npm run dev
```

A interface estará em `http://localhost:5173`. Configure `VITE_API_BASE_URL` no arquivo `.env` para apontar para o backend; o valor padrão é `http://localhost:8000/api/v1`.

## Docker

O Dockerfile e o Docker Compose permitem servir a interface com Nginx. `docker compose up --build --wait` compila a aplicação e inicia o serviço web.

## Comandos

| Comando | Descrição |
|---|---|
| `npm run dev` | inicia o servidor local |
| `npm run build` | verifica tipos e compila para produção |
| `npm run lint` | executa ESLint e TypeScript |
| `npm test` | executa os testes da interface |

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Camadas do mapa](docs/FEATURES_AND_LAYERS.md)
- [Integração com a API](docs/API_INTEGRATION.md)
- [Cores do mapa](docs/COLOR_SYSTEM.md)

# Integração com a API

O cliente em `src/api/` centraliza chamadas HTTP, contratos TypeScript e consultas TanStack Query. O mapa busca geometrias territoriais em `/map`; as funcionalidades ambientais usam endpoints próprios para clima, precipitação, alertas, focos de calor e hidrografia.

As chaves de consulta incluem os parâmetros de escopo territorial e nível de detalhe geométrico. Isso permite atualizar o mapa conforme o usuário navega entre o país, estados e municípios, sem misturar respostas de recortes diferentes.

Erros HTTP são convertidos em `ApiError`. Consultas transitórias podem ser repetidas pelo TanStack Query, enquanto limites temporários dos provedores ambientais são apresentados na interface para que a pessoa tente novamente.


## Operações e persistência

A interface usa GET para ler mapa, clima e municípios acompanhados; POST em `/territories/locate` para encontrar o município por coordenadas; PUT em `/me/followed-municipalities/{code}` para acompanhar; e DELETE na mesma rota para remover. POST em `/{code}/notifications` configura a preferência de avisos do acompanhamento. A API persiste esses vínculos e preferências no PostgreSQL; não há entrega de notificações por push, e-mail ou outro canal. O MVP usa um usuário fixo `local`, sem autenticação: a lista de acompanhamento é compartilhada por quem acessa a mesma instalação.

## Endereço da API

Na execução isolada, `VITE_API_BASE_URL` é uma URL absoluta acessível pelo navegador. No Compose completo, `/api/v1` usa o proxy do Nginx para `api:8000`. O upstream é resolvido dinamicamente pelo DNS do Docker, preservando conexões reutilizáveis e permitindo iniciar o frontend isolado. A URL é definida durante o build do Vite e exige reconstrução para mudar.

Os dados externos são obtidos e processados no backend: geografia do IBGE, meteorologia e fontes ambientais viram contratos usados pela interface. A camada WMS de focos também consulta diretamente o INPE para renderizar pontos; os resumos e a identificação continuam processados pela API própria.

# Integração com a API

O cliente em `src/api/` centraliza chamadas HTTP, contratos TypeScript e consultas TanStack Query. O mapa busca geometrias territoriais em `/map`; as funcionalidades ambientais usam endpoints próprios para clima, precipitação, alertas, focos de calor e hidrografia.

As chaves de consulta incluem os parâmetros de escopo territorial e nível de detalhe geométrico. Isso permite atualizar o mapa conforme o usuário navega entre o país, estados e municípios, sem misturar respostas de recortes diferentes.

Erros HTTP são convertidos em `ApiError`. Consultas transitórias podem ser repetidas pelo TanStack Query, enquanto limites temporários dos provedores ambientais são apresentados na interface para que a pessoa tente novamente.


## Operações e persistência

`POST /territories/locate` encontra o município pelas coordenadas do navegador. O acompanhamento usa `PUT` e `DELETE` em `/me/followed-municipalities/{code}` e `POST /{code}/notifications` para a preferência de avisos. As mutações atualizam o cache do TanStack Query de forma otimista. A API persiste vínculos e preferências no PostgreSQL; nenhum aviso é enviado por enquanto. Sem autenticação, a lista pertence ao usuário único da instalação (`local`).

## Endereço da API

Na execução isolada, `VITE_API_BASE_URL` é uma URL absoluta acessível pelo navegador. No Compose completo, `/api/v1` usa o proxy do Nginx para `api:8000`. O upstream é resolvido dinamicamente pelo DNS do Docker, preservando conexões reutilizáveis e permitindo iniciar o frontend isolado. A URL é definida durante o build do Vite e exige reconstrução para mudar.

Os dados externos são obtidos e processados no backend: geografia do IBGE, meteorologia e fontes ambientais viram contratos usados pela interface. A camada WMS de focos também consulta diretamente o INPE para renderizar pontos; os resumos e a identificação continuam processados pela API própria.

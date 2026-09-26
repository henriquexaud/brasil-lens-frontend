# Integração com a API

O cliente em `src/api/` centraliza chamadas HTTP, contratos TypeScript e consultas TanStack Query. O mapa busca geometrias territoriais em `/map`; as funcionalidades ambientais usam endpoints próprios para clima, precipitação, alertas, focos de calor e hidrografia.

As chaves de consulta incluem os parâmetros de escopo territorial e nível de detalhe geométrico. Isso permite atualizar o mapa conforme o usuário navega entre o país, estados e municípios, sem misturar respostas de recortes diferentes.

Erros HTTP são convertidos em `ApiError`. Consultas transitórias podem ser repetidas pelo TanStack Query, enquanto limites temporários dos provedores ambientais são apresentados na interface para que a pessoa tente novamente.

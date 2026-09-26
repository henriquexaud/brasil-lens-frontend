# Arquitetura do frontend

O frontend tem uma experiência principal: exploração de clima e meio ambiente sobre o mapa do Brasil. A organização por `features/` separa funcionalidades de mapa, clima, precipitação, alertas, focos de calor, hidrografia, busca e municípios acompanhados.

`App.tsx` compõe a experiência e coordena os painéis. `features/map/useTerritoryMap.ts` mantém escopo e geometrias; componentes ambientais adicionam as camadas ao Leaflet. `api/` contém o cliente HTTP, tipos de resposta e consultas TanStack Query. `app/useAppPreferences.ts` e `lib/sessionStorage.ts` persistem preferências da interface.

As geometrias são carregadas em níveis de detalhe progressivos. Os dados ambientais são consultados pelas funcionalidades que os exibem e podem ser ativados a partir dos controles do mapa. As geometrias e os códigos territoriais são infraestrutura espacial compartilhada, não um domínio temático da interface.

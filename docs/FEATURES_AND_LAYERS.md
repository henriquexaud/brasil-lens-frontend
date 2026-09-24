# Funcionalidades e Camadas do Mapa — Brasil Lens Frontend

Este documento descreve as funcionalidades de interface e a implementação das camadas interativas da plataforma **Brasil Lens**.

---

## 1. Navegação Cartográfica Multinível

A navegação foi projetada para ser fluida e intuitiva, permitindo explorar o território nacional em diferentes granularidades:

- **Nível Nacional (País):** Exibição das 27 Unidades Federativas (UFs).
- **Drill-Down Estadual:** Ao clicar duas vezes ou selecionar um estado, o mapa aproxima automaticamente e carrega a malha municipal daquela UF.
- **Detalhamento Municipal:** Cada município exibe valores do indicador selecionado, permitindo seleção para abertura do painel de métricas detalhadas.
- **Busca Territorial:** Campo de pesquisa debounced (com tolerância a acentos) que localiza estados e municípios instantaneamente, aproximando a câmera e destacando a geometria.

---

## 2. Carregamento Progressivo de Geometrias (LOD)

Para evitar lentidão no carregamento de malhas densas (como os 853 municípios de Minas Gerais ou 645 de São Paulo), o frontend adota uma estratégia em dois estágios:

1. **Primeiro Desenho (`lod=overview`):** A API entrega geometrias simplificadas (cerca de 6x mais leves em KB). O mapa é renderizado em fração de segundos.
2. **Refinamento em Ociosidade (`lod=detail`):** Quando a thread principal do navegador fica ociosa, a malha de alta precisão é carregada em segundo plano e substitui os polígonos suavemente, sem piscar a interface e sem reiniciar o zoom do usuário.

---

## 3. Camadas de Clima e Precipitação

O contexto climático opera em paralelo aos dados socioeconômicos e pode ser alternado a qualquer momento:

- **Temperatura e Clima Geral:**
  - Em visão nacional, exibe inicialmente as 27 capitais (`/weather/current`).
  - Em seguida, calcula a média ponderada estadual por área territorial (método dos polígonos de Thiessen calculado no PostGIS) via `/weather/states`.
  - Ao entrar em um estado, busca as leituras da malha municipal via `/weather/viewport`.
- **Precipitação e Chuva Acumulada (24h):**
  - Mapeia o volume de chuva das últimas 24 horas.
  - Indicador dinâmico de "Chovendo agora" (identifica se houve chuva detectada nos últimos 15 minutos em cada ponto).
- **Previsão para 3 Dias:** Carregada de forma assíncrona apenas quando o usuário expande a seção "Próximos dias" no painel de detalhes.

---

## 4. Focos de Calor e Queimadas (INPE / BDQueimadas)

Disponível no menu **Camadas e fontes → Focos de calor (INPE)**:

- **Densidade em Zoom Amplo:** Pinta estados e municípios segundo a escala fixa de **focos por 1.000 km²**, utilizando áreas geodésicas canônicas calculadas pelo PostGIS.
- **Pontos Reais via WMS (Zoom $\ge$ 9):** Ao aproximar o mapa, o componente ativa a camada WMS oficial do BDQueimadas, desenhando os pontos exatos de fogo detectados por satélites.
- **Identificação ao Clique:** Clicar próximo a um foco consulta o backend (`/fire-hotspots/identify`) e exibe satélite sensor, FRP (potência radiativa do fogo em MW) e horário exato da detecção.

---

## 5. Alertas de Riscos e Desastres (INMET / CEMADEN)

- Sobreposição vetorial no mapa indicando polígonos de alertas ativos.
- Alertas meteorológicos do INMET (chuvas intensas, tempestades, ventos fortes).
- Riscos geo-hidrológicos do CEMADEN (alagamentos, enxurradas e deslizamentos de encostas).
- Código visual por cores intuitivas baseado no nível de severidade normalizado (`potential`, `danger`, `extreme`).

---

## 6. Persistência de Visualizações Salvas (CRUD)

O painel de visualizações permite salvar o estado completo do mapa:
- **Salvar Recorte:** Grava nome, indicador, ano selecionado, nível territorial e território pai.
- **Restaurar:** Um clique em qualquer item da lista repõe imediatamente todos os filtros e centraliza a visualização.
- **Editar e Excluir:** Permite renomear ou excluir o recorte salvo, com confirmação prévia para evitar deleções acidentais.


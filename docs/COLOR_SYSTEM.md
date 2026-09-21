# Sistema de cores — Brasil Lens

Documento de decisões, no mesmo espírito de `backend/docs/ARCHITECTURE.md`:
descreve o que foi escolhido e por quê, não é um tutorial de como usar cor.
Fonte da verdade em código: `frontend/src/features/map/colors.ts`
(`PALETTES` e `INDICATOR_PALETTES`). Se este documento e o código
divergirem, o código está desatualizado — corrija-o para bater com aqui.

## Princípio

Não é "uma cor por contexto". É: cada **contexto** tem uma família visual
predominante, e cada **variável/indicador** dentro do contexto escolhe a
subpaleta que faz sentido para o que ela representa. População e PIB estão
ambos no contexto Socioeconômico, mas usam famílias diferentes porque
significam coisas diferentes (volume demográfico vs. força econômica).

Toda família tem exatamente **5 tons**, do mais claro/baixo ao mais
escuro/alto — mesma granularidade de legenda em qualquer indicador, mesmo
quando a classificação real usa menos classes (a amostragem em
`classColors`/`colorForClass` já lida com isso).

## Famílias definidas

### Socioeconômico

**Verde Brasil** — demografia e indicadores territoriais gerais. Remete ao
Brasil sem cair no exagero das cores da bandeira; funciona bem tanto em
mapas de UF quanto de município.

| Faixa | Cor |
|---|---|
| 1 | `#EAF6ED` |
| 2 | `#C3E4CB` |
| 3 | `#7BC48B` |
| 4 | `#2E9C57` |
| 5 | `#0B6B33` |

**Jade Econômico** — economia e mercado de trabalho. Separa "força
econômica" de "demografia geral" sem sair do universo institucional do
contexto.

| Faixa | Cor |
|---|---|
| 1 | `#EDF7F5` |
| 2 | `#C8E7DF` |
| 3 | `#86C8B7` |
| 4 | `#3C9F88` |
| 5 | `#176A59` |

**Diverging eleições (`electionDiverging`)** — **reservada, sem uso hoje**
(não existe indicador de eleição no catálogo). Ao contrário das demais, não é
sequencial mínimo→máximo: é uma escala **divergente** em torno de um centro
neutro ("equilíbrio"), pensada para representar **margem de vitória**, não
"quem venceu" de forma binária.

| Posição | Significado pretendido | Cor |
|---|---|---|
| 1 | Lado A, vitória forte | `#1D4E89` |
| 2 | Lado A, vitória apertada | `#7FA9D6` |
| 3 | Equilíbrio / disputa apertada | `#E8E3DC` |
| 4 | Lado B, vitória apertada | `#D98C8C` |
| 5 | Lado B, vitória forte | `#A63232` |

Quando esse indicador existir: o centro (`#E8E3DC`, neutro **quente**, não
cinza puro) representa disputa equilibrada, não ausência de dado — vai
precisar de uma classificação simétrica em torno de zero (margem de vitória),
diferente do `quantile` que `MapClassification` usa hoje para as demais
coropletas. Isso é trabalho de contrato de API futuro, não só de paleta.

### Clima

Cada fenômeno tem sua família, para não competir visualmente entre si
quando aparecerem juntos no mesmo painel.

**Chuva (`rain`)** — azul; usada na camada e escala de precipitação
(ver `features/rainfall/rainScale.ts`), por
interpolação contínua sobre o volume de chuva, não por classe de quantil.

| Faixa | Cor |
|---|---|
| 1 | `#EDF6FD` |
| 2 | `#BFDDF4` |
| 3 | `#78B8E6` |
| 4 | `#2D87C8` |
| 5 | `#0E5A96` |

**Temperatura (`temperature`)** — escala térmica fixa de 9 faixas em intervalos de 5°C, inspirada em cartografia meteorológica com transição do azul profundo ao vermelho intenso:

| Faixa | Intervalo | Rótulo | Cor | Tonalidade |
|---|---|---|---|---|
| 1 | ≤ 0°C | `≤0°` | `#2454C6` | Azul profundo |
| 2 | 0°C a 5°C | `0–5°` | `#2F7DE1` | Azul médio |
| 3 | 5°C a 10°C | `5–10°` | `#47B3E8` | Azul celeste |
| 4 | 10°C a 15°C | `10–15°` | `#79DCE2` | Ciano / Azul claro |
| 5 | 15°C a 20°C | `15–20°` | `#D8F4F0` | Menta / Ciano muito claro |
| 6 | 20°C a 25°C | `20–25°` | `#FFF5A6` | Amarelo claro |
| 7 | 25°C a 30°C | `25–30°` | `#FFD447` | Amarelo dourado |
| 8 | 30°C a 35°C | `30–35°` | `#FF9B38` | Laranja |
| 9 | > 35°C | `>35°` | `#F04432` | Vermelho intenso |

**Umidade (`humidity`)** — teal, para diferenciar de chuva mas manter a
sensação "aquosa". **Reservada, sem uso hoje** — só há um lugar óbvio para
ela (um segundo modo de cor no marcador de estação), e não foi pedido ainda.

| Faixa | Cor |
|---|---|
| 1 | `#EDF9F8` |
| 2 | `#BFE9E4` |
| 3 | `#75CFC2` |
| 4 | `#2EA79A` |
| 5 | `#176D67` |

**Vento (`wind`)** — azul acinzentado/lavanda. **Reservada, sem uso hoje** —
vento fica fora da Fase 1 do painel meteorológico (ver
`backend/docs/ARCHITECTURE.md` e o plano de implementação do contexto Clima)
até existir um produto em grade real (numérico ou satélite) para representar
com precisão.

| Faixa | Cor |
|---|---|
| 1 | `#F1F4FA` |
| 2 | `#D3DDF0` |
| 3 | `#A5B8DE` |
| 4 | `#718EC4` |
| 5 | `#46659E` |

**Seca (`drought`)** — terra/areia/ocre, para estiagem, desertificação e
vulnerabilidade hídrica. **Reservada, sem uso hoje** — nenhuma fonte de
seca/estiagem está integrada ainda.

| Faixa | Cor |
|---|---|
| 1 | `#FBF6E9` |
| 2 | `#EFD9A8` |
| 3 | `#D9B56A` |
| 4 | `#B88734` |
| 5 | `#7F5A1E` |

### Biodiversidade

Deliberadamente fora do verde institucional do Socioeconômico — mais
orgânico/vivo. **Todas as três reservadas, sem uso hoje**: o contexto
Biodiversidade tem zero providers registrados (`app/providers/registry.py`
no backend), então não há indicador algum para colorir ainda.

**Flora (`flora`)** — vegetação e cobertura vegetal; verde mais "vivo" que
o institucional.

| Faixa | Cor |
|---|---|
| 1 | `#EEF7EA` |
| 2 | `#CBE5BE` |
| 3 | `#95C97B` |
| 4 | `#4D9D4A` |
| 5 | `#216B2E` |

**Fauna (`fauna`)** — âmbar/musgo/oliva, para riqueza de espécies,
distribuição e ocorrência animal.

| Faixa | Cor |
|---|---|
| 1 | `#FAF4E6` |
| 2 | `#E8D3A1` |
| 3 | `#C9AE63` |
| 4 | `#9A7B31` |
| 5 | `#664F1D` |

**Conservação (`conservation`)** — ponte entre verde e azul-esverdeado, para
biomas, áreas protegidas e integridade ambiental.

| Faixa | Cor |
|---|---|
| 1 | `#EDF8F4` |
| 2 | `#C8E7DB` |
| 3 | `#84C7AA` |
| 4 | `#3F9B77` |
| 5 | `#1E6651` |

## Mapeamento indicador → família (hoje)

Espelha `INDICATOR_PALETTES` em `colors.ts`. Qualquer indicador não listado
aqui usa a rampa neutra de fallback (`DEFAULT_RAMP`, o azul-teal original do
produto).

| Indicador | Família |
|---|---|
| `population`, `population_growth`, `area_km2`, `population_density`, `urban_population`, `urbanization_rate` | `greenBrasil` |
| `gdp`, `gdp_per_capita`, `gdp_share_national`, `gdp_agriculture`, `gdp_industry`, `gdp_services`, `household_income_per_capita`, `unemployment_rate` | `jadeEconomico` |
| `disaster_affected_people` | *(sem entrada — fallback)* |

`disaster_affected_people` fica fora de propósito: nenhuma das famílias de
clima descreve bem "pessoas afetadas por desastre" (não é chuva, temperatura,
umidade, vento ou seca em si), e o contexto Clima está deixando de usar
coroplética como visão principal — ver a reformulação do contexto Clima em
`backend/docs/ARCHITECTURE.md`. Decisão explícita, não esquecimento; revisitar
se esse indicador ganhar um lugar definido na nova experiência de clima.

## Dois usos diferentes da mesma paleta

A maioria das famílias é consumida por `classColors`/`colorForClass`
(coroplética: N classes de quantil, calculadas pelo backend). As famílias de
clima com uso real hoje (`temperature`, `rain`) também são consumidas por
`interpolatePalette` (estações meteorológicas: um valor contínuo — ex. 18,4°C
— mapeado para um ponto entre os 5 tons, sem "classe"). São dois algoritmos
diferentes sobre o mesmo array de 5 cores — a família é a mesma fonte da
verdade, o consumidor decide como amostrá-la.

## Notas de UX (do pedido original, para quando forem relevantes)

- Mapa base neutro, bordas de território discretas.
- Sempre 5 blocos na legenda, mesmo sentido de intensidade (claro→escuro =
  baixo→alto) em qualquer contexto.
- Eleições, quando implementadas: legenda explícita "lado A → equilíbrio →
  lado B", nunca só "azul vs. vermelho" sem centro.
- Fora de escopo por ora: cor de contorno/hover/seleção (`BORDER_COLOR`,
  `HOVER_COLOR`, `SELECTED_COLOR` em `colors.ts`) não foi pedida para mudar —
  isto documenta paleta de **dado**, não o cromo do mapa.

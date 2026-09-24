# Sistema de Cores e Cartografia — Brasil Lens

Este documento define as especificações das paletas de cores utilizadas na plataforma **Brasil Lens**. A implementação de referência está concentrada em [`frontend/src/features/map/colors.ts`](file:///Users/henriquexaud/Documents/Software/Pós/brasil-lens/frontend/src/features/map/colors.ts).

---

## 1. Princípios de Aplicação

- **Uniformidade Quantitativa:** As paletas coropléticas operam com **5 faixas** ordenadas por intensidade perceptual (do tom mais claro/baixo ao mais escuro/alto), alinhadas às quebras estatísticas por quantil calculadas pelo backend.
- **Diferenciação por Contexto:** Indicadores socioeconômicos e ambientais utilizam famílias cromáticas distintas para evitar ambiguidades analíticas na navegação.
- **Escalas Contínuas para Séries Físicas:** Variáveis meteorológicas contínuas (como temperatura e precipitação) empregam escalas fixas com significado meteorológico padronizado, independentemente do recorte territorial selecionado.

---

## 2. Paletas Definidas

### 2.1 Contexto Socioeconômico

- **Verde Brasil (`greenBrasil`):** Utilizada para demografia e métricas territoriais gerais.
  | Faixa | Cor | Descrição |
  |---|---|---|
  | 1 | `#EAF6ED` | Muito Baixo |
  | 2 | `#C3E4CB` | Baixo |
  | 3 | `#7BC48B` | Médio |
  | 4 | `#2E9C57` | Alto |
  | 5 | `#0B6B33` | Muito Alto |

- **Jade Econômico (`jadeEconomico`):** Utilizada para economia, finanças e mercado de trabalho.
  | Faixa | Cor | Descrição |
  |---|---|---|
  | 1 | `#EDF7F5` | Muito Baixo |
  | 2 | `#C8E7DF` | Baixo |
  | 3 | `#86C8B7` | Médio |
  | 4 | `#3C9F88` | Alto |
  | 5 | `#176A59` | Muito Alto |

---

### 2.2 Contexto Climático e Ambiental

- **Precipitação (`rain`):** Escala azul aplicada por interpolação sobre o volume acumulado de chuva (0 a 100+ mm).
  | Faixa | Cor | Rótulo |
  |---|---|---|
  | 1 | `#EDF6FD` | 0 mm |
  | 2 | `#BFDDF4` | 1–10 mm |
  | 3 | `#78B8E6` | 10–25 mm |
  | 4 | `#2D87C8` | 25–50 mm |
  | 5 | `#0E5A96` | > 50 mm |

- **Temperatura (`temperature`):** Escala térmica padrão de 9 classes em intervalos de 5°C:
  | Faixa | Intervalo | Rótulo | Cor | Tonalidade |
  |---|---|---|---|---|
  | 1 | $\le$ 0°C | `≤0°` | `#2454C6` | Azul profundo |
  | 2 | 0°C a 5°C | `0–5°` | `#2F7DE1` | Azul médio |
  | 3 | 5°C a 10°C | `5–10°` | `#47B3E8` | Azul celeste |
  | 4 | 10°C a 15°C | `10–15°` | `#79DCE2` | Ciano claro |
  | 5 | 15°C a 20°C | `15–20°` | `#D8F4F0` | Ciano pastel |
  | 6 | 20°C a 25°C | `20–25°` | `#FFF5A6` | Amarelo claro |
  | 7 | 25°C a 30°C | `25–30°` | `#FFD447` | Amarelo dourado |
  | 8 | 30°C a 35°C | `30–35°` | `#FF9B38` | Laranja |
  | 9 | > 35°C | `>35°` | `#F04432` | Vermelho intenso |

---

## 3. Mapeamento de Indicadores

| Indicador | Família Visual |
|---|---|
| `population`, `population_growth`, `area_km2`, `population_density`, `urban_population`, `urbanization_rate` | `greenBrasil` |
| `gdp`, `gdp_per_capita`, `gdp_share_national`, `gdp_agriculture`, `gdp_industry`, `gdp_services`, `household_income_per_capita`, `unemployment_rate` | `jadeEconomico` |
| Indicadores não mapeados (fallback padrão) | `DEFAULT_RAMP` (Tonalidade azul-petróleo neutra) |

---

## 4. Elementos Visuais e Interatividade do Mapa

- **Bordas Territoriais:** `#64748b` (espessura 1px para divisas municipais e 1.5px para estaduais).
- **Destaque em Hover:** Traçado escurecido com borda de 2.5px (`#0f172a`).
- **Território Selecionado:** Borda sólida azul cobalto (`#2563eb`) com espessura 3px e preenchimento realçado.
- **Ausência de Dados:** Cinza neutro suave (`#e2e8f0`) com padrão visual de transparência.

# Integração com a API — Brasil Lens Frontend

Este documento descreve como o frontend se comunica com a API REST do **Brasil Lens**, incluindo o cliente HTTP tipado, o gerenciamento de cache e o tratamento de erros.

---

## 1. Estrutura da Camada de API (`src/api/`)

A comunicação com o backend é concentrada em três arquivos essenciais:

```
src/api/
├── client.ts    # Instância do cliente fetch, tratamento de erros e envelope de resposta
├── queries.ts   # Hooks do TanStack Query para todas as rotas de leitura e escrita
└── types.ts     # Tipagem TypeScript estrita que espelha os contratos Pydantic do backend
```

---

## 2. Tipagem Estrita e Ausência de `any`

Todas as respostas e requisições são estritamente tipadas em `types.ts`. Se um modelo da API mudar (por exemplo, um novo campo em `SavedView` ou alteração no schema de `/map`), o compilador do TypeScript aponta os erros imediatamente em tempo de build, antes do código ir para produção:

- **Identificadores Públicos:** Códigos IBGE tratados uniformemente como `string` para preservar zeros à esquerda (ex.: `"01"` para capitais ou estados com dígito inicial zero).
- **Enums Sincronizados:** `TerritoryLevel` (`country`, `region`, `state`, `municipality`), `IndicatorKey`, etc.
- **Envelope de Erro:** Tipado como `ApiErrorResponse` contendo `{ error: { code, message, details } }`.

---

## 3. Gerenciamento de Cache com TanStack Query

As chaves de consulta (`queryKey`) no TanStack Query são parametrizadas de forma estrita para evitar sobreposição ou dados inconsistentes:

- `["map", { level, parent, indicator, year, lod }]`
- `["indicators", { level, context }]`
- `["territory-overview", ibgeCode, year]`
- `["saved-views"]`

### Otimização na Troca de Indicadores (`/map/values`)

Ao alternar entre indicadores ou anos sem modificar o território em exibição, o hook `useMapLayer` executa uma consulta otimizada para `/map/values`. Essa rota não transfere polígonos GeoJSON, reaproveitando as geometrias já desenhadas e atualizando apenas as cores da coropleta e a legenda.

### Mutações e Invalidação Cirúrgica

As operações de escrita no CRUD de visualizações (`POST`, `PUT`, `DELETE /views`) e de municípios seguidos utilizam `useMutation`. Após a confirmação da operação pelo servidor:

```typescript
// Exemplo de invalidação no hook de criação de visualização salva
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["saved-views"] });
}
```

A lista é atualizada automaticamente a partir da resposta oficial do banco, eliminando estados inconsistentes de UI.

---

## 4. Tratamento de Erros e Resiliência

1. **Erros de Validação (4xx):** Não são reenviados pelo cliente. São convertidos na classe `DomainError` e apresentados de forma clara nos formulários ou toasts da interface.
2. **Falhas Transitórias (5xx e Falhas de Rede):** O TanStack Query realiza até duas novas tentativas automáticas com espera crescente.
3. **Limite de Requisições de Provedores Externos:** Caso um provedor externo (como Open-Meteo) retorne código de limite atingido (`provider_rate_limited`), o cliente pausa as consultas automáticas para aquele serviço e exibe um botão de "Tentar novamente" manual no rodapé das camadas.


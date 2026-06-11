/**
 * Tipos de domínio reutilizáveis para representar dados dinâmicos JSON
 * (configurações de templates, layouts visuais, payloads de placeholders etc.)
 * sem recorrer a `Record<string, any>` ou `any`.
 *
 * Use `JsonObject` para "objeto JSON arbitrário, mas tipado" — equivale ao
 * que aceita o `JSON.stringify`, garantindo que nunca caiam funções, símbolos
 * ou Dates não serializados em campos jsonb do banco.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

/** Configuração genérica de mapas/templates (orientação, agrupamento, etc.). */
export type DocumentoConfig = JsonObject;

/** Estrutura serializada do builder visual de mapas (TipTap → JSON). */
export type LayoutJson = JsonObject;

/**
 * Dados achatados consumidos por `renderPlaceholders` para resolver
 * `{{caminho.aninhado}}` em runtime. Aceita primitivos serializáveis
 * em qualquer profundidade.
 */
export type PlaceholderData = JsonObject;

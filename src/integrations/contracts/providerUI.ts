/**
 * Provider UI Registry — modelo declarativo multi-provider.
 *
 * Cada provider declara seus campos de configuração, ações de consulta e
 * gate de feature-flag em um único objeto. A tela `IntegracoesApoioTab`
 * NUNCA deve ter `if (provider === ...)`: ela apenas itera o registry.
 *
 * Capacidades técnicas continuam em `capabilities.ts`.
 */

import type { IntegrationProvider } from "./providers";
import type { CapabilityKey } from "./capabilities";
import type { FeatureFlagKey } from "@/lib/featureFlags";

export type ProviderFieldType = "text" | "password" | "url" | "select" | "switch";

export interface ProviderFieldOption {
  value: string;
  label: string;
}

export interface ProviderField {
  /**
   * Caminho do valor:
   *   - "mode" | "endpoint_url" | "client_code"  → coluna direta de `integrations`
   *   - "username" | "password"                  → tabela `integration_credentials`
   *   - "config.<chave>"                         → jsonb `integrations.config`
   */
  key: string;
  label: string;
  type: ProviderFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: ProviderFieldOption[];
  secret?: boolean;
  /** layout: 1 = metade da linha, 2 = linha cheia (default 1). */
  colSpan?: 1 | 2;
  /** Se true, o campo só aparece quando "Configurações avançadas" está aberto. */
  advanced?: boolean;
}

export interface ProviderActionDef {
  /** Identificador estável usado pelo dispatcher de jobs. */
  key: string;
  label: string;
  /**
   * Capability necessária — se ausente no provider, a ação some da UI.
   * Aceita chave canônica (preferencial) ou alias legado (compat).
   */
  capability: CapabilityKey;
  /** Ícone opcional (lucide-react name). */
  icon?: string;
}

export type ProviderUIStatus =
  | "disponivel"
  | "preview"
  | "preparacao"
  | "em_breve";

export interface ProviderUIConfig {
  provider: IntegrationProvider;
  display_name: string;
  short: string;
  description: string;
  status: ProviderUIStatus;
  /** Se setado, o card só renderiza quando a flag estiver ON para o tenant. */
  featureFlag?: FeatureFlagKey;
  fields: ProviderField[];
  /** Ações disponíveis na seção "Consulta por protocolo" deste provider. */
  consultActions?: ProviderActionDef[];
  /**
   * Edge function que executa o "Testar conexão" do provider.
   * Quando ausente, o botão fica visível mas desabilitado (provider em preparação).
   */
  testConnectionEdge?: string;
}

const _registry = new Map<IntegrationProvider, ProviderUIConfig>();

export function registerProviderUI(cfg: ProviderUIConfig): void {
  _registry.set(cfg.provider, cfg);
}

export function getProviderUI(provider: IntegrationProvider): ProviderUIConfig | undefined {
  return _registry.get(provider);
}

export function listProviderUIs(): ProviderUIConfig[] {
  return Array.from(_registry.values());
}
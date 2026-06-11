/**
 * UI declarativa do provider Hermes Pardini.
 *
 * Registra capacidades e schema visual no registry global.
 * Não contém JSX — apenas declaração.
 */

import { registerCapabilities, type ProviderCapabilities } from "../../contracts/capabilities";
import { registerProviderUI, type ProviderUIConfig } from "../../contracts/providerUI";

const HERMES_CAPABILITIES: ProviderCapabilities = {
  send_order: true,
  polling: true,
  fetch_pdf: true,
  fetch_pending: true,
  fetch_trace: true,
  fetch_label: false,
  cancel_exam: false,
  cancel_sample: false,
  webhook: false,
};

registerCapabilities("HERMES_PARDINI", HERMES_CAPABILITIES);

export const HERMES_UI: ProviderUIConfig = {
  provider: "HERMES_PARDINI",
  display_name: "Hermes Pardini",
  short: "HP",
  description: "SOAP/XML — envio, resultados, PDF, pendências, rastreio",
  status: "disponivel",
  testConnectionEdge: "integration-test-connection",
  fields: [
    {
      key: "mode",
      label: "Ambiente",
      type: "select",
      required: true,
      options: [
        { value: "MOCK", label: "MOCK (sem credenciais)" },
        { value: "HOMOLOG", label: "HOMOLOG" },
        { value: "PROD", label: "PROD" },
      ],
    },
    {
      key: "endpoint_url",
      label: "Endpoint SOAP",
      type: "url",
      placeholder: "https://multiapoio.hermespardini.com.br/...",
    },
    { key: "client_code", label: "Código do cliente", type: "text" },
    { key: "username", label: "Usuário", type: "text" },
    {
      key: "password",
      label: "Senha (deixe em branco para manter)",
      type: "password",
      secret: true,
      colSpan: 2,
    },
    {
      key: "config.papel_timbrado",
      label: "Papel timbrado (laudo personalizado)",
      type: "switch",
      helpText:
        "Solicita ao Hermes Pardini o laudo já com identidade visual personalizada (envia papelTimbrado=true).",
    },
    {
      key: "config.valor_referencia",
      label: "Valor de referência individualizado",
      type: "switch",
      helpText:
        "Recebe valores de referência específicos do paciente quando disponíveis (envia valorReferencia=1).",
    },
  ],
  consultActions: [
    { key: "POLL_RESULT", label: "Atualizar resultado", capability: "polling" },
    { key: "FETCH_PDF", label: "Baixar PDF", capability: "fetch_pdf", icon: "FileText" },
    { key: "FETCH_PENDING", label: "Pendências", capability: "fetch_pending", icon: "AlertTriangle" },
    { key: "FETCH_TRACE", label: "Rastreio", capability: "fetch_trace", icon: "Clock" },
  ],
};

registerProviderUI(HERMES_UI);
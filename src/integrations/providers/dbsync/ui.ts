/**
 * UI declarativa do provider DBSync (DB Diagnósticos).
 *
 * Provider DORMENTE: registrar este schema NÃO ativa dispatch, polling,
 * jobs, SOAP real. Renderização do card é gated por `dbsync_enabled`.
 */

import { registerProviderUI, type ProviderUIConfig } from "../../contracts/providerUI";
import "./index"; // garante registro de capabilities

export const DBSYNC_UI: ProviderUIConfig = {
  provider: "DB_DIAGNOSTICOS",
  display_name: "DB Diagnósticos",
  short: "DB",
  description:
    "SOAP/XML — envio, amostras, resultados, PDF, pendências, etiquetas e rastreabilidade.",
  status: "disponivel",
  testConnectionEdge: "dbsync-test-connection",
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
      placeholder: "https://wsdbsync.dbdiagnosticos.com.br/...",
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
    // ---- Avançado (opcionais futuros, persistem em config jsonb) ----
    {
      key: "config.timeout_ms",
      label: "Timeout (ms)",
      type: "text",
      placeholder: "30000",
      helpText: "Tempo máximo de resposta do apoio. Padrão 30s.",
      advanced: true,
    },
    {
      key: "config.url_fallback",
      label: "Endpoint alternativo (fallback)",
      type: "url",
      placeholder: "URL secundária usada em caso de indisponibilidade",
      colSpan: 2,
      advanced: true,
    },
    {
      key: "config.ws_security_mode",
      label: "Modo WS-Security",
      type: "select",
      options: [
        { value: "USERNAME_TOKEN", label: "UsernameToken (padrão)" },
        { value: "SIGNED", label: "Assinado (futuro)" },
        { value: "NONE", label: "Nenhum (apenas MOCK)" },
      ],
      helpText: "Definir junto com o time de homologação do laboratório.",
      advanced: true,
    },
    {
      key: "config.ssl_strict",
      label: "SSL estrito",
      type: "switch",
      helpText: "Recusa certificados inválidos. Recomendado em PROD.",
      advanced: true,
    },
    {
      key: "config.reprint_enabled",
      label: "Reimpressão de etiquetas",
      type: "switch",
      helpText: "Permite reimprimir etiquetas térmicas após o envio.",
      advanced: true,
    },
    {
      key: "config.pending_workflow_enabled",
      label: "Workflow de pendências",
      type: "switch",
      helpText: "Habilita tratamento estruturado das pendências técnicas.",
      advanced: true,
    },
  ],
  consultActions: [
    { key: "POLL_RESULT", label: "Atualizar resultado", capability: "polling" },
    { key: "FETCH_PDF", label: "Baixar PDF", capability: "fetch_pdf", icon: "FileText" },
    { key: "FETCH_PENDING", label: "Pendências", capability: "fetch_pending", icon: "AlertTriangle" },
    { key: "FETCH_TRACE", label: "Rastreio", capability: "fetch_trace", icon: "Clock" },
    { key: "FETCH_LABEL", label: "Reimprimir etiqueta", capability: "fetch_label", icon: "Tag" },
  ],
};

registerProviderUI(DBSYNC_UI);
// Resolução oficial do código de integração de um exame (SISLAC).
//
// Regra arquitetural canônica:
//   integration_exam_map (override por integração/tenant)
//     → fallback exames_catalogo.codigo_exame_apoio (default operacional)
//       → erro controlado (sem código)
//
// Use este helper SEMPRE que precisar do código do exame no apoio. Não duplicar
// a lógica em outros lugares — qualquer ajuste futuro de precedência deve
// passar por aqui.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type ExamResolutionSource = "MAP_OVERRIDE" | "CATALOG_DEFAULT" | "NONE";

export interface ResolvedExamIntegration {
  /** Código do exame no apoio (string vazia se não resolvido). */
  codigoApoio: string;
  /** Fonte da resolução para auditoria/log. */
  source: ExamResolutionSource;
  /** Linha do mapa, quando override. */
  mapId?: string;
  /** Material informado no map (override) — pode ser usado pelo dispatch. */
  materialOverride?: string | null;
  /** Nome do exame no apoio (override do map). */
  nomeApoioOverride?: string | null;
}

export interface ResolveExamIntegrationInput {
  tenantId: string;
  integrationId: string;
  exameSislacId: string | number | null | undefined;
}

export async function resolveExamIntegrationConfig(
  admin: SupabaseClient,
  input: ResolveExamIntegrationInput,
): Promise<ResolvedExamIntegration> {
  const exameId = input.exameSislacId == null ? "" : String(input.exameSislacId);
  if (!exameId) return { codigoApoio: "", source: "NONE" };

  // 1) Override explícito no integration_exam_map
  const { data: mapRow } = await admin
    .from("integration_exam_map")
    .select("id, exame_apoio_codigo, exame_apoio_nome, material, ativo")
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .eq("exame_sislac_id", exameId)
    .eq("ativo", true)
    .maybeSingle();

  if (mapRow?.exame_apoio_codigo) {
    return {
      codigoApoio: String(mapRow.exame_apoio_codigo),
      source: "MAP_OVERRIDE",
      mapId: String(mapRow.id),
      materialOverride: (mapRow.material as string | null) ?? null,
      nomeApoioOverride: (mapRow.exame_apoio_nome as string | null) ?? null,
    };
  }

  // 2) Default operacional do catálogo
  // exames_catalogo.id é uuid (string); aceita id direto.
  const { data: cat } = await admin
    .from("exames_catalogo")
    .select("codigo_exame_apoio")
    .eq("tenant_id", input.tenantId)
    .eq("id", exameId)
    .maybeSingle();

  const def = (cat?.codigo_exame_apoio as string | null | undefined) ?? "";
  if (def && def.trim()) {
    return { codigoApoio: def.trim(), source: "CATALOG_DEFAULT" };
  }

  return { codigoApoio: "", source: "NONE" };
}
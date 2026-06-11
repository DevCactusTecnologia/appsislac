// Testes da edge function update-atendimento.
// Foco: garantir que a permissão exigida é decidida corretamente conforme o payload.
// Visibility is UX. Authorization is security. Esta função é o guarda real de RBAC.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { requiredPermissionForUpdate } from "./index.ts";

Deno.test("cancelamento via cancelar_tudo → cancelar_atendimento", () => {
  assertEquals(
    requiredPermissionForUpdate({ atendimento_id: 1, cancelar_tudo: true }),
    "cancelar_atendimento",
  );
});

Deno.test("cancelamento via motivo_cancel → cancelar_atendimento", () => {
  assertEquals(
    requiredPermissionForUpdate({ atendimento_id: 1, motivo_cancel: "duplicado" }),
    "cancelar_atendimento",
  );
});

Deno.test("cancelamento via patch.statusAtendimento → cancelar_atendimento", () => {
  assertEquals(
    requiredPermissionForUpdate({
      atendimento_id: 1,
      patch: { statusAtendimento: { label: "Pedido cancelado" } },
    }),
    "cancelar_atendimento",
  );
});

Deno.test("apenas pagamentos → registrar_pagamento", () => {
  assertEquals(
    requiredPermissionForUpdate({
      atendimento_id: 1,
      pagamentos: [{ tipo: "PIX", valor: 100 }],
    }),
    "registrar_pagamento",
  );
});

Deno.test("patch geral → editar_atendimento", () => {
  assertEquals(
    requiredPermissionForUpdate({
      atendimento_id: 1,
      patch: { paciente_nome: "Novo Nome" },
    }),
    "editar_atendimento",
  );
});

Deno.test("exames + patch → editar_atendimento", () => {
  assertEquals(
    requiredPermissionForUpdate({
      atendimento_id: 1,
      patch: { solicitante: "Dr X" },
      exames: [{ nome_exame: "Hemograma" }],
    }),
    "editar_atendimento",
  );
});

Deno.test("payload vazio (sem patch/exames/pagamentos/cancel) → editar_atendimento (fallback seguro)", () => {
  // Default seguro: cai em editar_atendimento. Analista (que não tem editar) será bloqueado.
  assertEquals(
    requiredPermissionForUpdate({ atendimento_id: 1 }),
    "editar_atendimento",
  );
});
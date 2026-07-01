#!/usr/bin/env bash
# Runtime 2.0 — Data-plane routing guardrail.
#
# Falha o build se uma edge function do allowlist (data-plane migrado)
# importar `createClient` direto do chokepoint em vez de rotear via
# `getTenantClient` / `getUserTenantClient`.
#
# À medida que novos domínios forem migrados (Slice 3+), acrescente o
# path da função em EDGE_DATA_PLANE_ALLOWLIST abaixo.

set -euo pipefail

EDGE_DATA_PLANE_ALLOWLIST=(
  # Slice 2 — Atendimento
  "supabase/functions/create-atendimento/index.ts"
  "supabase/functions/update-atendimento/index.ts"
  # Slice 3 — Resultado + PDF
  "supabase/functions/sign-resultado/index.ts"
  "supabase/functions/assinatura-url/index.ts"
  "supabase/functions/comprovante-shortlink/index.ts"
  "supabase/functions/image-url/index.ts"
  "supabase/functions/integration-pdf-resolve/index.ts"
  "supabase/functions/integration-pdf-url/index.ts"
  "supabase/functions/lab-apoio-upload-pdf/index.ts"
  "supabase/functions/upload-assinatura/index.ts"
  "supabase/functions/upload-image/index.ts"
  "supabase/functions/upload-pdf/index.ts"
)

fail=0
for f in "${EDGE_DATA_PLANE_ALLOWLIST[@]}"; do
  if [ ! -f "$f" ]; then
    echo "guardrail: arquivo não encontrado: $f" >&2
    fail=1
    continue
  fi
  if grep -qE 'from "\.\./_shared/runtime/createClient\.ts"' "$f"; then
    echo "guardrail: $f importa createClient direto — use getTenantClient/getUserTenantClient" >&2
    fail=1
  fi
  if ! grep -qE 'getTenantClient|getUserTenantClient' "$f"; then
    echo "guardrail: $f não usa getTenantClient/getUserTenantClient" >&2
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "Data-plane routing violado. Consulte docs/database-runtime/dedicated-runtime/03-edge-functions.md" >&2
  exit 1
fi
echo "guardrail: data-plane routing OK (${#EDGE_DATA_PLANE_ALLOWLIST[@]} functions)"

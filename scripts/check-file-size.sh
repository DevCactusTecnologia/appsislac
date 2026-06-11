#!/usr/bin/env bash
# Governança de tamanho de arquivo — §12 docs/IA_ARCHITECTURE_RULES.md
#
# Níveis:
#   🟡 > 600 linhas  — aviso (review arquitetural recomendado)
#   🟠 > 800 linhas  — aviso forte (requer justificativa explícita / allowlist)
#   🔴 > 1000 linhas — BLOQUEIA o build (critical review obrigatório)
#
# Allowlist:
#   scripts/file-size-allowlist.txt — um path por linha (relativo à raiz).
#   Linhas começando com '#' são comentários. Use SOMENTE com justificativa
#   registrada no PR/ADR. Arquivos listados não bloqueiam mas continuam
#   aparecendo no relatório.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WARN=600
STRONG=800
BLOCK=1000

ALLOWLIST_FILE="scripts/file-size-allowlist.txt"
ALLOW=()
if [ -f "$ALLOWLIST_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    ALLOW+=("$line")
  done < "$ALLOWLIST_FILE"
fi

is_allowed() {
  local f="$1"
  for a in "${ALLOW[@]:-}"; do
    [ "$f" = "$a" ] && return 0
  done
  return 1
}

# Coleta arquivos de código (src/ e supabase/functions/), exclui testes,
# tipos gerados e o cliente Supabase auto-gerado.
mapfile -t FILES < <(find src supabase/functions \
  -type f \( -name '*.ts' -o -name '*.tsx' \) \
  ! -name '*.test.ts' ! -name '*.test.tsx' \
  ! -name '*.spec.ts' ! -name '*.spec.tsx' \
  ! -path 'src/integrations/supabase/types.ts' \
  ! -path 'src/integrations/supabase/client.ts' \
  2>/dev/null | sort)

yellow=0; orange=0; red=0; blocked=0
yellow_list=(); orange_list=(); red_list=()

for f in "${FILES[@]}"; do
  lines=$(wc -l < "$f")
  if [ "$lines" -gt "$BLOCK" ]; then
    red=$((red+1))
    red_list+=("$lines  $f")
    if ! is_allowed "$f"; then blocked=$((blocked+1)); fi
  elif [ "$lines" -gt "$STRONG" ]; then
    orange=$((orange+1))
    orange_list+=("$lines  $f")
  elif [ "$lines" -gt "$WARN" ]; then
    yellow=$((yellow+1))
    yellow_list+=("$lines  $f")
  fi
done

print_section() {
  local title="$1"; shift
  local -n arr=$1
  [ "${#arr[@]}" -eq 0 ] && return
  echo
  echo "$title"
  printf '  %s\n' "${arr[@]}"
}

print_section "🟡  > ${WARN} linhas (review recomendado):" yellow_list
print_section "🟠  > ${STRONG} linhas (justificativa explícita):" orange_list
print_section "🔴  > ${BLOCK} linhas (critical review obrigatório):" red_list

echo
echo "Resumo: 🟡 ${yellow}  🟠 ${orange}  🔴 ${red}"

if [ "$blocked" -gt 0 ]; then
  echo
  echo "❌ Build bloqueado: ${blocked} arquivo(s) acima de ${BLOCK} linhas sem entrada em ${ALLOWLIST_FILE}."
  echo "   Refatore (slicing incremental, ver §12) ou adicione à allowlist com justificativa no PR."
  exit 1
fi

echo "✅ Tamanho de arquivos dentro dos limites de bloqueio."
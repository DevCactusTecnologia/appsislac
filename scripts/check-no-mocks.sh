#!/usr/bin/env bash
# Bloqueia qualquer reintrodução de dados fictícios no código fonte.
# - Procura por palavras-chave (palavra inteira) em src/ e supabase/migrations/.
# - Ignora arquivos de teste (*.test.*, *.spec.*) e o próprio script.
# - Sai com código != 0 se encontrar ocorrência.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) é necessário para a checagem." >&2
  exit 2
fi

# Padrões proibidos. \b força palavra inteira para evitar 'fastest', 'latest', etc.
# 'mockData' é específico do legado e bloqueado mesmo como substring.
PATTERNS=(
  'mockData'
  '\bmock[A-Z][A-Za-z0-9_]*'   # mockPacientes, mockExames, ...
  '\bfakeData\b'
  '\bfakeUser\b'
  '\bdemoTenant\b'
  '\bsampleData\b'
  '\bexemploDados\b'
)

# Arquivos / diretórios isentos.
IGNORE_GLOBS=(
  '!**/node_modules/**'
  '!**/dist/**'
  '!**/*.test.ts'
  '!**/*.test.tsx'
  '!**/*.spec.ts'
  '!**/*.spec.tsx'
  '!scripts/check-no-mocks.sh'
  '!src/test/**'
)

TARGETS=(src supabase/migrations)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  hits=$(rg --no-messages --line-number --color=never \
    "${IGNORE_GLOBS[@]/#/-g}" \
    -e "$pattern" "${TARGETS[@]}" || true)
  if [ -n "$hits" ]; then
    FOUND=1
    echo "❌ Padrão proibido encontrado: $pattern"
    echo "$hits"
    echo
  fi
done

if [ "$FOUND" -ne 0 ]; then
  echo "Build bloqueado: remova as ocorrências acima ou ajuste a whitelist em scripts/check-no-mocks.sh."
  exit 1
fi

echo "✅ Nenhuma referência fictícia encontrada."

#!/usr/bin/env bash
#
# count-service-client.sh — Fuente oficial única de métrica de `createServiceClient` en código productivo
#
# Referenciado por: docs-private/VISION_2026_CAMINO_ELEGIDO.md §7.6
#
# Reglas:
#   - Cuenta llamadas o importaciones de `createServiceClient` en código TypeScript productivo
#   - Excluye __tests__/, archivos .legacy.*, next-env.d.ts
#   - Excluye el archivo que define la función (src/lib/supabase/server.ts)
#
# Uso:
#   ./scripts/count-service-client.sh             # número total
#   ./scripts/count-service-client.sh --by-file   # top 30 archivos con más ocurrencias
#   ./scripts/count-service-client.sh --all-files # todos los archivos con al menos una ocurrencia

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SC_REGEX='createServiceClient'

MODE="${1:-total}"

list_files() {
  grep -rlE "$SC_REGEX" src \
    --include="*.ts" --include="*.tsx" \
    2>/dev/null \
    | grep -v "__tests__" \
    | grep -v "\.legacy\." \
    | grep -v "next-env.d.ts" \
    | grep -v "src/lib/supabase/server.ts"
}

count_total() {
  local total=0
  while IFS= read -r f; do
    local c
    c=$(grep -cE "$SC_REGEX" "$f" 2>/dev/null || true)
    c="${c:-0}"
    total=$((total + c))
  done < <(list_files)
  echo "$total"
}

count_by_file() {
  local limit="${1:-30}"
  while IFS= read -r f; do
    local c
    c=$(grep -cE "$SC_REGEX" "$f" 2>/dev/null || true)
    c="${c:-0}"
    if [ "$c" -gt 0 ]; then
      printf "%4d  %s\n" "$c" "$f"
    fi
  done < <(list_files) | sort -rn | head -n "$limit"
}

count_all_files() {
  while IFS= read -r f; do
    local c
    c=$(grep -cE "$SC_REGEX" "$f" 2>/dev/null || true)
    c="${c:-0}"
    if [ "$c" -gt 0 ]; then
      printf "%4d  %s\n" "$c" "$f"
    fi
  done < <(list_files) | sort -rn
}

case "$MODE" in
  total|--total)
    count_total
    ;;
  --by-file|by-file)
    count_by_file 30
    ;;
  --all-files|all-files)
    count_all_files
    ;;
  --help|-h|help)
    sed -n '2,15p' "$0"
    ;;
  *)
    echo "Uso: $0 [total|--by-file|--all-files|--help]" >&2
    exit 1
    ;;
esac

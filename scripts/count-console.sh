#!/usr/bin/env bash
#
# count-console.sh — Fuente oficial única de métrica de `console.*` en código productivo
#
# Referenciado por: docs-private/VISION_2026_CAMINO_ELEGIDO.md §7.6
#
# Reglas:
#   - Cuenta llamadas a `console.log`, `console.warn`, `console.info`, `console.debug`
#   - Permite `console.error` solo dentro de catch blocks (no se cuenta en el total principal)
#   - Excluye __tests__/, archivos .legacy.*, next-env.d.ts, archivos de scripts locales
#   - Excluye archivos declarativos como `*.config.*` y `*.d.ts`
#
# Uso:
#   ./scripts/count-console.sh             # total de console.log/warn/info/debug
#   ./scripts/count-console.sh --by-file   # top 30 archivos con más ocurrencias
#   ./scripts/count-console.sh --all-files # todos los archivos con al menos una ocurrencia
#   ./scripts/count-console.sh --with-error # incluye también console.error en el total
#
# Política: `console.error` dentro de catch es aceptable. `console.log/warn/info/debug` debe migrar a logger.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONSOLE_REGEX='console\.(log|warn|info|debug)'
CONSOLE_REGEX_ALL='console\.(log|warn|info|debug|error)'

MODE="${1:-total}"

list_files() {
  grep -rlE "$CONSOLE_REGEX_ALL" src \
    --include="*.ts" --include="*.tsx" \
    2>/dev/null \
    | grep -v "__tests__" \
    | grep -v "\.legacy\." \
    | grep -v "next-env.d.ts" \
    | grep -v "\.config\." \
    | grep -v "\.d\.ts$"
}

count_total() {
  local regex="$1"
  local total=0
  while IFS= read -r f; do
    local c
    c=$(grep -cE "$regex" "$f" 2>/dev/null || true)
    c="${c:-0}"
    total=$((total + c))
  done < <(list_files)
  echo "$total"
}

count_by_file() {
  local regex="$1"
  local limit="${2:-30}"
  while IFS= read -r f; do
    local c
    c=$(grep -cE "$regex" "$f" 2>/dev/null || true)
    c="${c:-0}"
    if [ "$c" -gt 0 ]; then
      printf "%4d  %s\n" "$c" "$f"
    fi
  done < <(list_files) | sort -rn | head -n "$limit"
}

count_all_files() {
  local regex="$1"
  while IFS= read -r f; do
    local c
    c=$(grep -cE "$regex" "$f" 2>/dev/null || true)
    c="${c:-0}"
    if [ "$c" -gt 0 ]; then
      printf "%4d  %s\n" "$c" "$f"
    fi
  done < <(list_files) | sort -rn
}

case "$MODE" in
  total|--total)
    count_total "$CONSOLE_REGEX"
    ;;
  --with-error)
    count_total "$CONSOLE_REGEX_ALL"
    ;;
  --by-file|by-file)
    count_by_file "$CONSOLE_REGEX" 30
    ;;
  --all-files|all-files)
    count_all_files "$CONSOLE_REGEX"
    ;;
  --help|-h|help)
    sed -n '2,20p' "$0"
    ;;
  *)
    echo "Uso: $0 [total|--with-error|--by-file|--all-files|--help]" >&2
    exit 1
    ;;
esac

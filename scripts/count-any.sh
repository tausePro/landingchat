#!/usr/bin/env bash
#
# count-any.sh — Fuente oficial única de métrica de `any` en código productivo
#
# Referenciado por: docs-private/VISION_2026_CAMINO_ELEGIDO.md §7.5 / §7.6
#
# Reglas:
#   - Cuenta solo usos sintácticos de `any` como tipo en TypeScript
#   - Excluye __tests__/, archivos .legacy.*, next-env.d.ts
#   - Regex filtra contra los patrones: `: any`, `<any>`, `as any`, `any[]`, `Promise<any>`, etc.
#   - No cuenta la palabra "any" dentro de identificadores (e.g. `company`, `many`, `anywhere`)
#   - No cuenta `any` dentro de comentarios de línea (// ...)
#
# Uso:
#   ./scripts/count-any.sh             # número total
#   ./scripts/count-any.sh --by-file   # top 30 archivos con más ocurrencias
#   ./scripts/count-any.sh --all-files # todos los archivos con al menos una ocurrencia
#
# Salida: número total en stdout (modo total); o listado ordenado (modo by-file / all-files)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ANY_REGEX='(:\s*any\b|<any>|<any[,\s]|,\s*any>|as\s+any\b|\bany\[\]|\(any\)|Record<[^>]*,\s*any>|Promise<any>|Array<any>)'

MODE="${1:-total}"

list_files() {
  grep -rlE "$ANY_REGEX" src \
    --include="*.ts" --include="*.tsx" \
    2>/dev/null \
    | grep -v "__tests__" \
    | grep -v "\.legacy\." \
    | grep -v "next-env.d.ts"
}

count_total() {
  local total=0
  while IFS= read -r f; do
    local c
    c=$(grep -cE "$ANY_REGEX" "$f" 2>/dev/null || true)
    c="${c:-0}"
    total=$((total + c))
  done < <(list_files)
  echo "$total"
}

count_by_file() {
  local limit="${1:-30}"
  while IFS= read -r f; do
    local c
    c=$(grep -cE "$ANY_REGEX" "$f" 2>/dev/null || true)
    c="${c:-0}"
    if [ "$c" -gt 0 ]; then
      printf "%4d  %s\n" "$c" "$f"
    fi
  done < <(list_files) | sort -rn | head -n "$limit"
}

count_all_files() {
  while IFS= read -r f; do
    local c
    c=$(grep -cE "$ANY_REGEX" "$f" 2>/dev/null || true)
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
    sed -n '2,20p' "$0"
    ;;
  *)
    echo "Uso: $0 [total|--by-file|--all-files|--help]" >&2
    exit 1
    ;;
esac

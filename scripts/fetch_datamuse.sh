#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/scripts/datamuse"
mkdir -p "$OUT"
while read -r secret; do
  [ -n "$secret" ] || continue
  for spec in "ml:80" "syn:40" "trg:40" "spc:20" "gen:20"; do
    rel="${spec%%:*}"
    maxn="${spec##*:}"
    dest="$OUT/${rel}-${secret}.json"
    if [ -s "$dest" ]; then
      continue
    fi
    if [ "$rel" = "ml" ]; then
      url="https://api.datamuse.com/words?ml=${secret}&max=${maxn}"
    else
      url="https://api.datamuse.com/words?rel_${rel}=${secret}&max=${maxn}"
    fi
    curl -sS -A "drift-game-heat-builder/1.0" -o "$dest" "$url"
    sleep 0.08
  done
  echo "fetched $secret"
done < <(jq -r '.words[]' "$ROOT/data/chain.json")
echo done

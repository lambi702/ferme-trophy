#!/bin/bash
# Gel du classement PUBLIC pendant la fin de course (règle Caddy, voir AGENTS.md).
#   freeze-classement.sh freeze     → photographie le classement maintenant et le fige pour le public
#   freeze-classement.sh unfreeze   → révèle le vrai classement (retour au live)
#   freeze-classement.sh status
# Le chrono continue de compter normalement ; organisateurs/comité voient le vrai live.
set -euo pipefail
DIR=/srv/ft-freeze
FILE=$DIR/live.json
case "${1:-status}" in
  freeze)
    if [ -f "$FILE" ] && [ "${2:-}" != "--refresh" ]; then
      echo "Déjà gelé depuis $(date -r "$FILE" +%H:%M:%S). (--refresh pour reprendre une nouvelle photo)"; exit 0
    fi
    mkdir -p "$DIR"; chmod 755 "$DIR"
    tmp=$(mktemp "$DIR/.live.XXXXXX")
    curl -sf --max-time 10 http://127.0.0.1:8092/api/live -o "$tmp"
    python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert isinstance(d.get('bikes'), list)" "$tmp"
    chmod 644 "$tmp"; mv -f "$tmp" "$FILE"
    echo "🧊 Classement public GELÉ à $(date +%H:%M:%S) — révéler : $0 unfreeze"
    ;;
  unfreeze)
    rm -f "$FILE"
    echo "🏁 Classement RÉVÉLÉ à $(date +%H:%M:%S) — les écrans repassent en live d'ici ~15 s"
    ;;
  status)
    if [ -f "$FILE" ]; then echo "🧊 GELÉ depuis $(date -r "$FILE" +%H:%M:%S)"; else echo "🟢 LIVE (pas de gel)"; fi
    ;;
  *) echo "usage: $0 freeze|unfreeze|status"; exit 1 ;;
esac

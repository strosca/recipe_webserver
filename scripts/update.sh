#!/usr/bin/env bash
# Holt neue Rezepte (git pull --ff-only), baut web/rezepte.json und spiegelt web/ ins Web-Root.
# Idempotent – kann beliebig oft laufen. Ein Lockfile (flock) verhindert überlappende Läufe.
#
# Umgebungsvariablen (alle optional):
#   REPO_DIR   Repo-Verzeichnis       (Standard: Verzeichnis über diesem Skript)
#   WEB_ROOT   Ziel für die Webseite  (Standard: /var/www/rezepte)
#   LOCK_FILE  Lockfile               (Standard: <REPO_DIR>/.git/rezepte-update.lock)
#
# Exit-Code: 0 = alles ok, 1 = Fehler (z. B. git pull fehlgeschlagen – veröffentlicht wird trotzdem
# der vorhandene Stand, damit die Seite nie leer bleibt).
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}
WEB_ROOT=${WEB_ROOT:-/var/www/rezepte}
LOCK_FILE=${LOCK_FILE:-$REPO_DIR/.git/rezepte-update.lock}

log() { printf '%s [update] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
trap 'log "FEHLER: Zeile $LINENO, Befehl „$BASH_COMMAND“ (Exit $?)"' ERR

for cmd in git flock rsync python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "FEHLER: '$cmd' fehlt (sudo apt install git rsync python3 util-linux)."
    exit 1
  fi
done

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Ein anderer Lauf ist noch aktiv – nichts zu tun."
  exit 0
fi

status=0
log "Start (Repo: $REPO_DIR → Web-Root: $WEB_ROOT)"
cd "$REPO_DIR"

# 1) Neue Rezepte holen
before=$(git rev-parse --short HEAD 2>/dev/null || echo "")
if git pull --ff-only --quiet; then
  after=$(git rev-parse --short HEAD)
  if [[ "$before" == "$after" ]]; then
    log "Git: keine Änderungen ($after)."
  else
    log "Git: ${before:-leer} → $after"
    if [[ -n "$before" ]]; then
      git --no-pager log --format='           %h %s' "$before..$after" || true
    fi
  fi
else
  log "WARNUNG: git pull --ff-only fehlgeschlagen – veröffentliche den vorhandenen Stand."
  status=1
fi

# 2) Index bauen (bricht bei kaputten Rezeptdateien nicht ab, nur bei Umgebungsfehlern)
if ! "$SCRIPT_DIR/build-index.sh"; then
  log "FEHLER: build-index.sh fehlgeschlagen – Web-Root bleibt unverändert."
  exit 1
fi

# 3) Veröffentlichen (Dateien werden erst am Ende gemeinsam ausgetauscht)
if ! mkdir -p "$WEB_ROOT" 2>/dev/null || [[ ! -w "$WEB_ROOT" ]]; then
  log "FEHLER: Web-Root $WEB_ROOT fehlt oder ist nicht beschreibbar."
  exit 1
fi
rsync -a --delete --delay-updates --exclude='.*' --chmod=D755,F644 \
  --out-format='           + %n' \
  "$REPO_DIR/web/" "$WEB_ROOT/"

log "Fertig (Exit $status)."
exit "$status"

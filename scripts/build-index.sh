#!/usr/bin/env bash
# Fasst alle gültigen rezepte/*.json zu web/rezepte.json zusammen (neueste zuerst).
#
#   scripts/build-index.sh              # normaler Lauf (ignoriert Dateien mit "_" am Anfang)
#   scripts/build-index.sh --mit-tests  # nimmt auch _beispiel.json und _test-*.json mit (lokales Testen)
#
# Ungültige Dateien/Rezepte werden mit Warnung übersprungen – der Build bricht deswegen nie ab.
# Umgebungsvariablen: SRC_DIR (Standard: <repo>/rezepte), OUT_FILE (Standard: <repo>/web/rezepte.json)
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
SRC_DIR=${SRC_DIR:-$REPO_DIR/rezepte}
OUT_FILE=${OUT_FILE:-$REPO_DIR/web/rezepte.json}
INCLUDE_UNDERSCORE=0

usage() { sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case $1 in
    --mit-tests|--alle) INCLUDE_UNDERSCORE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[build] Unbekannte Option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "[build] FEHLER: python3 nicht gefunden (sudo apt install python3)." >&2
  exit 1
fi

exec python3 - "$SRC_DIR" "$OUT_FILE" "$INCLUDE_UNDERSCORE" <<'PY'
import datetime as dt
import json
import os
import re
import sys
import tempfile
from pathlib import Path

src, out, include_underscore = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3] == "1"

def log(msg):
    print(f"[build] {msg}", file=sys.stderr, flush=True)

def warn(msg):
    log(f"WARNUNG: {msg}")

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

def valid_date(value):
    if not isinstance(value, str) or not DATE_RE.match(value):
        return False
    try:
        dt.date.fromisoformat(value)
        return True
    except ValueError:
        return False

def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0

def str_list(v):
    return isinstance(v, list) and all(isinstance(x, str) and x.strip() for x in v)

RECOMMENDED = ("beschreibung", "kueche", "typ", "zeit_aktiv_min", "zeit_passiv_min", "portionen")

def clean_recipe(r, where):
    if not isinstance(r, dict):
        warn(f"{where}: ist kein Objekt – Rezept übersprungen")
        return None
    name = r.get("name")
    if not isinstance(name, str) or not name.strip():
        warn(f"{where}: 'name' fehlt – Rezept übersprungen")
        return None
    name = name.strip()
    where = f"{where} „{name}“"

    zutaten = r.get("zutaten")
    if not str_list(zutaten) or not zutaten:
        warn(f"{where}: 'zutaten' fehlt oder ist keine Liste von Texten – Rezept übersprungen")
        return None

    raw_steps = r.get("schritte")
    if not isinstance(raw_steps, list) or not raw_steps:
        warn(f"{where}: 'schritte' fehlt oder ist leer – Rezept übersprungen")
        return None
    schritte = []
    for i, s in enumerate(raw_steps, 1):
        if isinstance(s, str) and s.strip():
            schritte.append(s.strip())
        elif isinstance(s, dict) and isinstance(s.get("text"), str) and s["text"].strip():
            step = {"text": s["text"].strip()}
            if "timer_min" in s:
                if is_num(s["timer_min"]) and s["timer_min"] > 0:
                    step["timer_min"] = s["timer_min"]
                else:
                    warn(f"{where}: Schritt {i}: 'timer_min' ungültig – ignoriert")
            schritte.append(step)
        else:
            warn(f"{where}: Schritt {i} ist weder Text noch {{\"text\": …}} – Rezept übersprungen")
            return None

    result = {"name": name}
    for key in ("beschreibung", "kueche", "typ", "region"):
        v = r.get(key)
        if v is None:
            continue
        if isinstance(v, str):
            if v.strip():
                result[key] = v.strip()
        else:
            warn(f"{where}: '{key}' ist kein Text – ignoriert")
    for key in ("zeit_aktiv_min", "zeit_passiv_min"):
        v = r.get(key)
        if v is None:
            continue
        if is_num(v):
            result[key] = v
        else:
            warn(f"{where}: '{key}' ist keine Zahl ≥ 0 – ignoriert")
    v = r.get("portionen")
    if v is not None:
        if is_num(v) and v > 0:
            result["portionen"] = v
        else:
            warn(f"{where}: 'portionen' ist keine Zahl > 0 – ignoriert")

    result["zutaten"] = [z.strip() for z in zutaten]
    result["schritte"] = schritte

    for key in ("tags", "ablauf", "utensilien", "vorab"):
        v = r.get(key)
        if v is None:
            continue
        if str_list(v):
            result[key] = [x.strip() for x in v]
        else:
            warn(f"{where}: '{key}' ist keine Liste von Texten – ignoriert")

    missing = [k for k in RECOMMENDED if k not in result]
    if missing:
        log(f"Hinweis: {where}: empfohlene Felder fehlen: {', '.join(missing)}")
    return result

days = {}
files_ok = files_skipped = 0

if not src.is_dir():
    warn(f"Ordner {src} existiert nicht – erzeuge leeren Index")
    files = []
else:
    files = sorted(p for p in src.glob("*.json") if p.is_file())

for path in files:
    if path.name.startswith("_") and not include_underscore:
        continue
    rel = f"{src.name}/{path.name}"
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        warn(f"{rel}: ungültiges JSON (Zeile {e.lineno}, Spalte {e.colno}: {e.msg}) – Datei übersprungen")
        files_skipped += 1
        continue
    except (OSError, UnicodeDecodeError) as e:
        warn(f"{rel}: nicht lesbar ({e}) – Datei übersprungen")
        files_skipped += 1
        continue

    if not isinstance(data, dict):
        warn(f"{rel}: oberste Ebene ist kein Objekt – Datei übersprungen")
        files_skipped += 1
        continue
    datum = data.get("datum")
    if not valid_date(datum):
        warn(f"{rel}: 'datum' fehlt oder ist kein gültiges Datum (YYYY-MM-DD) – Datei übersprungen")
        files_skipped += 1
        continue
    m = re.search(r"\d{4}-\d{2}-\d{2}", path.stem)
    if m and m.group(0) != datum:
        warn(f"{rel}: Dateiname passt nicht zu \"datum\": \"{datum}\" – verwende {datum}")
    rezepte = data.get("rezepte")
    if not isinstance(rezepte, list) or not rezepte:
        warn(f"{rel}: 'rezepte' fehlt oder ist leer – Datei übersprungen")
        files_skipped += 1
        continue

    good = []
    for i, r in enumerate(rezepte, 1):
        cleaned = clean_recipe(r, f"{rel} Rezept {i}")
        if cleaned:
            good.append(cleaned)
    if not good:
        warn(f"{rel}: kein gültiges Rezept – Datei übersprungen")
        files_skipped += 1
        continue
    days.setdefault(datum, []).extend(good)
    files_ok += 1

total = sum(len(v) for v in days.values())
index = {
    "generiert": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
    "anzahl": total,
    "tage": [{"datum": d, "rezepte": days[d]} for d in sorted(days, reverse=True)],
}

out.parent.mkdir(parents=True, exist_ok=True)
fd, tmp = tempfile.mkstemp(prefix=".rezepte-", suffix=".json", dir=out.parent)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    os.chmod(tmp, 0o644)
    os.replace(tmp, out)
except BaseException:
    try:
        os.unlink(tmp)
    except OSError:
        pass
    raise

log(f"{total} Rezepte aus {files_ok} Dateien → {out}" + (f" ({files_skipped} übersprungen)" if files_skipped else ""))
PY

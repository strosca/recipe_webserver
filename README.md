# Rezepte – statische Webansicht

Jeden Morgen legt eine geplante Claude-Aufgabe eine JSON-Datei mit 2 Rezepten in dieses Repo. Der Server zieht das Repo stündlich, baut daraus `web/rezepte.json` und liefert eine statische Web-App aus. Es gibt kein Backend und keine Datenbank, nur Git, einen systemd-Timer und statische Dateien.

```
Claude-Aufgabe ──push──▶ GitHub (privat) ◀──git pull── Server: scripts/update.sh (systemd-Timer)
                                                        ├─ scripts/build-index.sh → web/rezepte.json
                                                        └─ rsync web/ → /var/www/rezepte ──▶ nginx/Apache ──▶ iPhone
```

## Inhalt

| Pfad | Zweck |
|---|---|
| [`SCHEMA.md`](SCHEMA.md) | verbindliches Datenformat und Prompt-Baustein für die Claude-Aufgabe |
| `rezepte/YYYY-MM-DD.json` | eine Datei pro Tag (von der Claude-Aufgabe) |
| `rezepte/_*.json` | Beispiel und Testdaten, werden normal **ignoriert** |
| `web/` | die App: `index.html`, `style.css`, `app.js`, `sw.js`, Manifest und Icons (ohne Build-Schritt, ohne CDN) |
| `scripts/build-index.sh` | fasst alle gültigen Rezepte zu `web/rezepte.json` zusammen (python3) |
| `scripts/update.sh` | `git pull --ff-only` → Build → `rsync` ins Web-Root, mit Lockfile |
| `deploy/` | systemd-Service und Timer, nginx- und Apache-Konfiguration |

## Funktionen der Web-App

- **Startseite:** Rezepte nach Tag gruppiert (Heute, Gestern …). Suche nach Name und Zutaten, auch ohne Umlaute („kase“ findet „Käse“). Regionen-Chips („Worauf hast du Lust?“), Filter nach Küche, Typ, aktiver Zeit, Merkmalen und „nur Favoriten“, dazu ein **Zufall**-Button.
- **Favoriten** per Herz, mit eigenem Tab.
- **Rezept:** Hat eine eigene, teilbare URL (`#/r/2026-11-21/kartoffel-lauch-gratin`) und enthält:
  - **Auf einen Blick:** der Kochablauf in wenigen Zeilen, Wartezeiten markiert
  - **Bereitstellen:** Utensilien und was vorab erledigt werden muss
  - Zutaten mit **Portionsrechner** und Abhaken
  - nummerierte Schritte mit **Timer-Buttons**
  - eine persönliche Notiz und „gekocht“-Markierung
- **Kochmodus:** ein Schritt pro Bildschirm in großer Schrift, Blättern per Wischen oder Pfeiltasten. Davor kommt eine Vorbereitungsseite. Der Bildschirm bleibt an (nur über HTTPS, siehe unten).
- **Timer:** mehrere parallel, mit Pause, Ton und Alarm. Sie laufen auch nach einem Neuladen weiter.
- **Einkaufsliste:** Zutaten aus Rezepten übernehmen. Was man meist im Haus hat (Salz, Öl …), ist vorab abgewählt. Gleiche Zutaten werden addiert und alles wird nach Supermarkt-Gängen sortiert.
  - **Unterwegs abhaken:** „Kopieren“ tippen und in **Erinnerungen** einfügen, dann wird jede Zeile eine eigene Erinnerung. Alternativ in Notizen einfügen und als Checkliste formatieren. Beides synchronisiert über iCloud.
- Druckansicht für einzelne Rezepte, hell und dunkel nach Systemeinstellung, als App auf den Homescreen legbar.

Favoriten, Einkaufsliste, Notizen und Timer liegen im `localStorage` **des jeweiligen Geräts**. Abhaken und Portionen gelten nur für die aktuelle Sitzung. Achtung iOS: Die Homescreen-App und Safari haben **getrennten** Speicher.

---

## Server-Setup (Debian)

Annahmen: Debian 12 oder neuer, die Seite läuft nur im Heimnetz auf **Port 8080**, ohne Login. Alle Befehle als normaler Nutzer mit `sudo`.

### 1. Pakete

```bash
sudo apt update
sudo apt install git rsync python3 nginx     # oder apache2 statt nginx
```

`flock` gehört zu `util-linux` und ist immer installiert.

### 2. Eigener Systemnutzer ohne Root-Rechte

```bash
sudo adduser --system --group --home /var/lib/rezepte --shell /usr/sbin/nologin rezepte
sudo install -d -o rezepte -g rezepte -m 700 /var/lib/rezepte/.ssh
sudo install -d -o rezepte -g rezepte /opt/rezepte
sudo install -d -o rezepte -g rezepte -m 755 /var/www/rezepte
```

### 3. Deploy-Key (nur lesen)

```bash
sudo -u rezepte ssh-keygen -t ed25519 -N "" -C "rezepte-deploy@$(hostname)" -f /var/lib/rezepte/.ssh/rezepte_deploy
sudo cat /var/lib/rezepte/.ssh/rezepte_deploy.pub
```

Den ausgegebenen öffentlichen Schlüssel (`ssh-ed25519 AAAA… rezepte-deploy@…`) auf GitHub eintragen:

**github.com/strosca/recipe_webserver → Settings → Deploy keys → Add deploy key**
- Title: z. B. `Debian-Server (nur lesen)`
- Key: den Inhalt einfügen
- **„Allow write access“ NICHT anhaken**

Host-Alias in der SSH-Konfiguration des Nutzers `rezepte` anlegen:

```bash
sudo -u rezepte tee /var/lib/rezepte/.ssh/config >/dev/null <<'EOF'
Host github-rezepte
    HostName github.com
    User git
    IdentityFile ~/.ssh/rezepte_deploy
    IdentitiesOnly yes
EOF
sudo chmod 600 /var/lib/rezepte/.ssh/config
```

GitHubs Host-Schlüssel hinterlegen und den Fingerabdruck prüfen:

```bash
ssh-keyscan -t ed25519 github.com 2>/dev/null | sudo -u rezepte tee /var/lib/rezepte/.ssh/known_hosts >/dev/null
sudo -u rezepte ssh-keygen -lf /var/lib/rezepte/.ssh/known_hosts
#   muss lauten: SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU
#   (vgl. https://docs.github.com/de/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
```

Verbindung testen:

```bash
sudo -u rezepte -H ssh -T github-rezepte
#   Hi strosca/recipe_webserver! You've successfully authenticated, but GitHub does not provide shell access.
```

### 4. Repo klonen

```bash
sudo -u rezepte -H git clone git@github-rezepte:strosca/recipe_webserver.git /opt/rezepte
```

### 5. Einmal manuell aktualisieren

```bash
sudo -u rezepte -H /opt/rezepte/scripts/update.sh
ls -l /var/www/rezepte        # index.html, app.js, rezepte.json …
```

### 6. systemd-Timer (stündlich und um 08:50 Uhr Europe/Berlin)

```bash
sudo install -m 644 /opt/rezepte/deploy/rezepte-update.service /opt/rezepte/deploy/rezepte-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rezepte-update.timer
systemctl list-timers rezepte-update.timer
```

Die Units werden **kopiert**, damit ein `git pull` sie nicht still verändert. Wenn sie sich im Repo ändern, den `install`-Befehl erneut ausführen und `daemon-reload` aufrufen.

### 7a. Webserver: nginx

```bash
sudo install -m 644 /opt/rezepte/deploy/nginx-rezepte.conf /etc/nginx/sites-available/rezepte
sudo ln -s /etc/nginx/sites-available/rezepte /etc/nginx/sites-enabled/rezepte
sudo nginx -t && sudo systemctl reload nginx
```

### 7b. Webserver: Apache (statt nginx)

```bash
sudo a2enmod headers deflate
sudo install -m 644 /opt/rezepte/deploy/apache-rezepte.conf /etc/apache2/sites-available/rezepte.conf
sudo a2ensite rezepte
sudo apache2ctl configtest && sudo systemctl reload apache2
```

**Port:** Die Configs nutzen 8080. Ist der Port belegt (`sudo ss -ltnp | grep :8080`), in der Config einen anderen eintragen. Plex (32400) kommt sich damit nicht in die Quere.

**Cache-Header:** `rezepte.json`, HTML, JS und CSS bekommen `Cache-Control: no-cache`. Der Browser fragt also jedes Mal nach und bekommt meist ein schnelles `304`. Icons werden eine Woche gecacht.

### 8. Auf dem iPhone einrichten

1. Safari öffnen: `http://<IP-des-Servers>:8080`. Am besten im Router eine feste IP für den Thin Client vergeben. Mit `sudo apt install avahi-daemon` geht auch `http://<hostname>.local:8080`.
2. Teilen → **Zum Home-Bildschirm**. Die Seite startet dann wie eine App, ohne Safari-Leisten.

---

## Wie teste ich das?

**Lokal (ohne Server):**

```bash
scripts/build-index.sh --mit-tests       # nimmt rezepte/_beispiel.json und _test-*.json mit
python3 -m http.server -d web 8000       # → http://localhost:8000
```

`--mit-tests` erzeugt absichtlich zwei Warnungen (ein Rezept ohne Zutaten, eine kaputte JSON-Datei). Beide werden übersprungen, ohne dass der Build abbricht. Danach den echten Index wieder bauen: `scripts/build-index.sh`.

**Auf dem Server:**

```bash
sudo systemctl start rezepte-update.service            # Update sofort auslösen
systemctl status rezepte-update.service --no-pager     # letzter Lauf ok?
curl -sI http://localhost:8080/rezepte.json | grep -iE 'HTTP|cache-control'
#   HTTP/1.1 200 OK
#   Cache-Control: no-cache
python3 -c "import json;d=json.load(open('/var/www/rezepte/rezepte.json'));print(d['anzahl'],'Rezepte, Stand',d['generiert'])"
```

**Eine Rezeptdatei prüfen**, bevor sie ins Repo kommt:

```bash
python3 -m json.tool rezepte/2026-11-21.json >/dev/null && echo "JSON ok"
SRC_DIR=$PWD/rezepte OUT_FILE=/tmp/test.json scripts/build-index.sh   # zeigt Warnungen
```

## Wo sehe ich die Logs?

```bash
journalctl -u rezepte-update.service -n 50 --no-pager     # letzte Läufe
journalctl -u rezepte-update.service -f                   # live mitlesen
journalctl -u rezepte-update.service --since today | grep -E 'WARNUNG|FEHLER'
systemctl list-timers rezepte-update.timer                # wann läuft es das nächste Mal?
sudo tail -f /var/log/nginx/rezepte.access.log /var/log/nginx/rezepte.error.log
```

Ein typischer Lauf:

```
2026-11-21 08:50:01 [update] Start (Repo: /opt/rezepte → Web-Root: /var/www/rezepte)
2026-11-21 08:50:02 [update] Git: 38ecdb8 → 9a1f2c4
           9a1f2c4 Rezepte 2026-11-21
[build] 9 Rezepte aus 5 Dateien → /opt/rezepte/web/rezepte.json
           + rezepte.json
2026-11-21 08:50:02 [update] Fertig (Exit 0).
```

## Verhalten im Fehlerfall

| Situation | Was passiert |
|---|---|
| Kaputte JSON-Datei oder ungültiges Rezept | Warnung im Log, der Rest wird normal veröffentlicht |
| GitHub nicht erreichbar oder Deploy-Key falsch | Warnung, der **vorhandene** Stand wird veröffentlicht, Exit 1 (Service-Status zeigt „failed“) |
| `git pull --ff-only` scheitert (Historie umgeschrieben) | wie oben. Lösung: `sudo -u rezepte git -C /opt/rezepte reset --hard origin/main` |
| Zwei Läufe gleichzeitig | Der zweite beendet sich sofort (Lock in `/opt/rezepte/.git/rezepte-update.lock`) |
| `rezepte.json` fehlt oder ist leer | Die App zeigt einen Fehler- bzw. Leerzustand mit „Erneut versuchen“ |

## Optional: HTTPS und Zugriff von unterwegs

Ohne HTTPS funktionieren auf dem iPhone ein paar Komfortfunktionen nicht: „Bildschirm bleibt an“ im Kochmodus, das Teilen-Menü für die Einkaufsliste, das Offline-Caching und automatisches Kopieren. Fürs Kopieren gibt es einen Ersatz: Lässt sich nicht automatisch kopieren, zeigt die App den Text zum manuellen Kopieren an.

Am einfachsten ohne eigene Domain geht es mit **Tailscale**: auf Server und iPhone installieren, dann

```bash
sudo tailscale serve --bg 8080
```

Damit ist die Seite unter `https://<servername>.<tailnet>.ts.net` erreichbar, mit gültigem Zertifikat, auch unterwegs und ohne Portfreigabe im Router.

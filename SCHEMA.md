# Rezept-Datenformat

Die geplante Claude-Aufgabe legt **jeden Morgen genau eine Datei** an:

```
rezepte/YYYY-MM-DD.json
```

- Kodierung UTF-8, gültiges JSON (keine Kommentare, keine abschließenden Kommas).
- Der Dateiname enthält dasselbe Datum wie das Feld `datum`.
- Dateien, deren Name mit `_` beginnt (z. B. `_beispiel.json`), werden beim Bauen **ignoriert**.
- Ein vollständiges Beispiel liegt unter [`rezepte/_beispiel.json`](rezepte/_beispiel.json).

## Pflichtformat

```json
{
  "datum": "2026-11-21",
  "rezepte": [
    {
      "name": "Kartoffel-Lauch-Gratin",
      "beschreibung": "Cremiges Ofengericht mit Lauch und Bergkäse.",
      "kueche": "französisch",
      "typ": "Ofengericht",
      "zeit_aktiv_min": 20,
      "zeit_passiv_min": 40,
      "portionen": 2,
      "zutaten": ["500 g festkochende Kartoffeln", "1 Stange Lauch", "..."],
      "schritte": ["Ofen auf 200 °C vorheizen.", "..."],
      "tags": ["vegetarisch"]
    }
  ]
}
```

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---|---|
| `datum` | Text `YYYY-MM-DD` | ja | Tag, für den die Rezepte gedacht sind |
| `rezepte` | Liste | ja | normalerweise 2 Rezepte |
| `name` | Text | **ja** | Name des Gerichts |
| `zutaten` | Liste von Texten | **ja** | eine Zutat pro Eintrag, **Menge zuerst**: `"500 g Kartoffeln"`, `"1 Stange Lauch"`, `"Salz, Pfeffer"` |
| `schritte` | Liste von Texten | **ja** | ein Arbeitsschritt pro Eintrag, in Kochreihenfolge |
| `beschreibung` | Text | empfohlen | ein bis zwei Sätze |
| `kueche` | Text | empfohlen | kleingeschrieben, z. B. `"italienisch"`, `"thailändisch"` |
| `typ` | Text | empfohlen | z. B. `"Pasta"`, `"Curry"`, `"Ofengericht"`, `"Suppe"`, `"Salat"` |
| `zeit_aktiv_min` | Zahl | empfohlen | Minuten, in denen man wirklich etwas tut |
| `zeit_passiv_min` | Zahl | empfohlen | Minuten Back-, Schmor- oder Ruhezeit |
| `portionen` | Zahl | empfohlen | die Web-App rechnet die Zutaten danach um |
| `tags` | Liste von Texten | optional | z. B. `"vegetarisch"`, `"vegan"`, `"scharf"`, `"meal-prep"` |

**Mengen-Schreibweise:** Zahl, dann Einheit, dann Zutat (`"200 ml Sahne"`, `"2 EL Olivenöl"`, `"½ TL Zimt"`, `"2–3 Zehen Knoblauch"`). Nur so lassen sich Portionen umrechnen und Mengen auf der Einkaufsliste zusammenfassen. Erkannte Einheiten: g, kg, ml, l, EL, TL, Prise, Stück, Bund, Dose, Zehe, Stange, Becher, Packung, Scheibe, Zweig, Handvoll, Glas, Kopf, Knolle, Blatt u. a.

## Optionale Zusatzfelder (für Kochablauf, Bereitstellen und Timer)

Alle Zusatzfelder sind **optional**. Fehlen sie, leitet die Web-App die Infos selbst aus den Schritten ab. Mit ihnen wird das Ergebnis aber deutlich besser.

| Feld | Typ | Bedeutung |
|---|---|---|
| `ablauf` | Liste von Texten | **Kochablauf auf einen Blick**: 3–6 kurze Phasen, z. B. `"Ofen vorheizen, Kartoffeln hobeln"`, `"40 min backen – Zeit zum Aufräumen"` |
| `utensilien` | Liste von Texten | was man rausstellen muss: `"Auflaufform (20 × 30 cm)"`, `"Gemüsehobel"` |
| `vorab` | Liste von Texten | Dinge, die vor dem Start passieren müssen: `"Butter 30 min vorher rausstellen"`, `"Linsen 2 h einweichen"` |
| `region` | Text | überschreibt die automatisch aus `kueche` abgeleitete Region (Mittelmeer, Asien, Indien, Orient & Nordafrika, Deutsch & Alpen, Europa, Amerika, Afrika) |
| `schritte[i]` als Objekt | `{"text": "...", "timer_min": 40}` | statt eines Texts darf ein Schritt ein Objekt sein. `timer_min` legt den Timer für diesen Schritt fest |

Beispiel für einen Schritt mit festem Timer:

```json
"schritte": [
  "Ofen auf 200 °C vorheizen.",
  { "text": "Gratin 35–40 Minuten goldbraun backen.", "timer_min": 35 }
]
```

Ohne `timer_min` erkennt die App Zeitangaben wie „20 Minuten“, „1 Std.“ oder „5–7 min“ im Text und bietet dafür einen Timer an.

## Validierung beim Bauen

`scripts/build-index.sh` prüft jede Datei:

- **Ungültiges JSON** oder fehlendes bzw. falsches `datum`: Die Datei wird übersprungen, mit Warnung im Log.
- Rezept ohne `name`, `zutaten` oder `schritte`: Nur dieses Rezept wird übersprungen.
- Optionales Feld mit falschem Typ: Das Feld wird ignoriert, das Rezept bleibt.
- Der Build bricht wegen kaputter Daten **nie** ab.

## Baustein für den Prompt der Claude-Aufgabe

> Lege die Datei `rezepte/<heutiges Datum YYYY-MM-DD>.json` an, mit exakt dem Format aus `SCHEMA.md` im Repo (2 Rezepte). Zutaten immer im Format „Menge Einheit Zutat“. Fülle zusätzlich die optionalen Felder `ablauf` (3–6 kurze Phasen, passive Wartezeiten als solche benennen), `utensilien` und `vorab`. Gib Schritten mit Wartezeit (Backen, Köcheln, Ruhen) die Form `{"text": "...", "timer_min": <Minuten>}`. Prüfe vor dem Commit, dass die Datei gültiges JSON ist.

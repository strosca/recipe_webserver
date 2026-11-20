/* Rezepte – statische Webansicht. Kein Framework, kein Build, keine externen Abhängigkeiten.
 *
 * Routen (Hash):
 *   #/                         Liste
 *   #/favoriten                nur Favoriten
 *   #/einkauf                  Einkaufsliste
 *   #/r/<datum>/<slug>         Rezept
 *   #/r/<datum>/<slug>/kochen[/<schritt>]  Kochmodus
 */
'use strict';

(() => {
  // ======================================================================
  // Hilfsfunktionen
  // ======================================================================

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const main = $('#main');

  /** Kleiner DOM-Builder. Texte werden immer als Textknoten eingefügt (kein XSS). */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v; // nur für statische Icons
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'style' && typeof v === 'object') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value' || k === 'checked' || k === 'selected') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false || kid === '') continue;
      el.append(kid instanceof Node ? kid : String(kid));
    }
    return el;
  }

  const ICONS = {
    heart: '<path d="M12 20.3s-7.6-4.5-9.4-9.1C1.3 7.9 3.3 4.4 6.9 4.4c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.4 9.1-9.4 9.1z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M6 11v7.5A2 2 0 0 0 8 20.5h8a2 2 0 0 0 2-2V11"/>',
    print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
    cart: '<path d="M3 4h2.2l2.2 11h10.4l2-7.5H6.4"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M9.5 3h5M18.5 7l1.3-1.3"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    pause: '<path d="M9 5.5v13M15 5.5v13"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    chevR: '<path d="m9 5 7 7-7 7"/>',
    chevL: '<path d="m15 5-7 7 7 7"/>',
    chef: '<path d="M7 14.5V20h10v-5.5"/><path d="M7 14.5a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3.5a5 5 0 0 1 5.6 3.1A4 4 0 0 1 17 14.5z"/><path d="M7 17h10"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4 6.5h.01M4 12h.01M4 17.5h.01" stroke-width="2.6"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    pot: '<path d="M3 10h18M5 10v7.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V10"/><path d="M9 7c0-1.2 1-1.6 1-2.8M14 7c0-1.2 1-1.6 1-2.8"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19 13 11"/>',
  };
  function icon(name, cls = '') {
    return h('span', {
      class: `ico ${cls}`.trim(), 'aria-hidden': 'true',
      html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`,
    });
  }
  const CHECK_SVG = '<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

  /** Speicher – jeder Zugriff in try/catch (privater Modus, volle Quota, gesperrte Cookies). */
  const PREFIX = 'rezepte:';
  function makeStore(getStorage) {
    return {
      get(key, fallback) {
        try {
          const raw = getStorage().getItem(PREFIX + key);
          return raw == null ? fallback : JSON.parse(raw);
        } catch { return fallback; }
      },
      set(key, value) {
        try { getStorage().setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
      },
    };
  }
  const local = makeStore(() => window.localStorage);
  const session = makeStore(() => window.sessionStorage);

  /** Kleinschreibung ohne Akzente/Umlaute – für Suche und Heuristiken. */
  const fold = (s) => String(s ?? '').toLocaleLowerCase('de-DE').replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cap = (s) => (s ? s.charAt(0).toLocaleUpperCase('de-DE') + s.slice(1) : '');
  function slugify(s) {
    return String(s).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }
  const num = (v) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : null);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function fmtMin(m) {
    if (m == null) return '–';
    m = Math.round(m);
    if (m < 60) return `${m} min`;
    const hh = Math.floor(m / 60), mm = m % 60;
    return mm ? `${hh} h ${mm} min` : `${hh} h`;
  }
  function fmtDur(min) {
    if (min < 1) return `${Math.round(min * 60)} s`;
    return fmtMin(min);
  }
  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = (x) => String(x).padStart(2, '0');
    return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${mm}:${p(ss)}`;
  }

  // Datum
  function isoDay(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtDayYear = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtDateShort = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
  function dayLabel(iso) {
    const date = parseDay(iso);
    const rel = iso === isoDay() ? 'Heute' : iso === isoDay(-1) ? 'Gestern' : iso === isoDay(1) ? 'Morgen' : '';
    const full = (date.getFullYear() === new Date().getFullYear() ? fmtDayLong : fmtDayYear).format(date);
    return { rel, full };
  }

  // ======================================================================
  // Fachlogik: Regionen, Zutaten, Timer, Heuristiken
  // ======================================================================

  const REGIONS = [
    { key: 'mittelmeer', label: 'Mittelmeer', match: ['italien', 'griech', 'spani', 'portug', 'mediterran', 'provenzal', 'sizilian', 'toskan', 'katalan', 'kret', 'zypri', 'sardi', 'baskisch'] },
    { key: 'orient', label: 'Orient & Nordafrika', match: ['turk', 'libanes', 'israel', 'persi', 'iran', 'marokk', 'tunes', 'alger', 'nordafrik', 'levant', 'arab', 'orient', 'syri', 'agypt', 'jordan', 'kurd', 'jemen'] },
    { key: 'asien', label: 'Asien', match: ['japan', 'chines', 'thai', 'vietnam', 'korea', 'indones', 'malay', 'philippin', 'asiat', 'kanton', 'sichuan', 'taiwan', 'kambodsch', 'burmes', 'singapur', 'laot', 'hawaii'] },
    { key: 'indien', label: 'Indien', match: ['indisch', 'indien', 'pakistan', 'sri lank', 'sri-lank', 'bengal', 'nepal', 'punjab', 'goa'] },
    { key: 'deutsch', label: 'Deutsch & Alpen', match: ['deutsch', 'osterreich', 'schweiz', 'bayer', 'schwab', 'frank', 'alpen', 'tirol', 'badisch', 'rheinisch', 'sachs', 'westfal', 'elsass', 'pfalz', 'hessisch', 'berlin', 'hambur', 'wiener'] },
    { key: 'europa', label: 'Europa', match: ['franzos', 'britisch', 'englisch', 'irisch', 'schott', 'belgisch', 'niederland', 'holland', 'skandinav', 'schwed', 'norweg', 'danisch', 'finn', 'europ', 'polnisch', 'ungar', 'russisch', 'ukrain', 'tschech', 'balkan', 'kroat', 'serb', 'ruman', 'bulgar', 'georg', 'bretonisch', 'nordisch'] },
    { key: 'amerika', label: 'Amerika', match: ['mexik', 'amerik', 'usa', 'tex', 'cajun', 'karib', 'brasil', 'peru', 'argentin', 'chilen', 'kolumbi', 'kuban', 'latein', 'kanad', 'sudstaaten', 'jamaika', 'venezol'] },
    { key: 'afrika', label: 'Afrika', match: ['athiop', 'afrik', 'senegal', 'nigeria', 'ghana', 'kenia', 'eritre'] },
  ];
  const REGION_OTHER = { key: 'weitere', label: 'Weitere' };
  function regionOf(r) {
    if (r.region) {
      const f = fold(r.region);
      return REGIONS.find((x) => x.key === f || fold(x.label) === f) || { key: slugify(r.region) || 'weitere', label: r.region, custom: true };
    }
    const k = fold(r.kueche);
    if (k) for (const reg of REGIONS) if (reg.match.some((m) => k.includes(m))) return reg;
    return REGION_OTHER;
  }
  const tintVar = (region) => `var(--r-${region.key}, var(--r-weitere))`;

  // --- Zutaten: Menge erkennen, skalieren, formatieren ---
  const FRAC = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8 };
  const UNITS = ['Packungen', 'Päckchen', 'Packung', 'Handvoll', 'Scheiben', 'Scheibe', 'Stangen', 'Stange', 'Knollen', 'Knolle',
    'Zweige', 'Zweig', 'Tassen', 'Tasse', 'Becher', 'Prisen', 'Prise', 'Dosen', 'Dose', 'Zehen', 'Zehe', 'Stücke', 'Stück',
    'Stiele', 'Stiel', 'Bund', 'Gläser', 'Glas', 'Köpfe', 'Kopf', 'Blätter', 'Blatt', 'Würfel', 'Schuss', 'Spritzer', 'Tropfen',
    'Beutel', 'Msp.', 'Pck.', 'Stk.', 'Bd.', 'kg', 'mg', 'ml', 'cl', 'dl', 'EL', 'TL', 'cm', 'g', 'l'];
  const PLURAL = { Stange: 'Stangen', Zehe: 'Zehen', Dose: 'Dosen', Prise: 'Prisen', Scheibe: 'Scheiben', Zweig: 'Zweige', Packung: 'Packungen',
    Knolle: 'Knollen', Tasse: 'Tassen', Stiel: 'Stiele', Kopf: 'Köpfe', Glas: 'Gläser', Blatt: 'Blätter' };
  const SINGULAR = Object.fromEntries(Object.entries(PLURAL).map(([s, p]) => [p, s]));
  const NUM_SRC = '(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:[.,]\\d+)?\\s?[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])';
  const UNIT_SRC = UNITS.slice().sort((a, b) => b.length - a.length).map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const ING_RE = new RegExp(`^\\s*(ca\\.?\\s+)?(${NUM_SRC})(?:\\s*(?:-|–|bis)\\s*(${NUM_SRC}))?\\s*(?:(${UNIT_SRC})(?![\\p{L}]))?\\s*(.*)$`, 'iu');

  function parseNum(s) {
    s = s.trim();
    let m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
    if ((m = s.match(/^(\d+(?:[.,]\d+)?)?\s?([½¼¾⅓⅔⅛])?$/u)) && (m[1] || m[2])) {
      return (m[1] ? parseFloat(m[1].replace(',', '.')) : 0) + (m[2] ? FRAC[m[2]] : 0);
    }
    return NaN;
  }
  function parseIngredient(text) {
    const m = ING_RE.exec(text);
    if (!m || !m[5] || !m[5].trim()) return { text, qty: null, name: text };
    const qty = parseNum(m[2]);
    if (!(qty > 0)) return { text, qty: null, name: text };
    const qty2 = m[3] ? parseNum(m[3]) : NaN;
    // Einheit normalisieren (z. B. "el" → "EL")
    const unit = m[4] ? (UNITS.find((u) => u.toLowerCase() === m[4].toLowerCase()) || m[4]) : '';
    return { text, approx: !!m[1], qty, qty2: qty2 > 0 ? qty2 : null, unit, name: m[5].trim(), prefixLen: text.length - m[5].length };
  }
  const METRIC = new Set(['g', 'kg', 'mg', 'ml', 'l', 'cl', 'dl', 'cm']);
  const GLYPHS = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '']];
  function fmtQty(n, unit) {
    const u = (unit || '').toLowerCase();
    if (METRIC.has(u)) {
      if ((u === 'g' || u === 'ml') && n >= 10) n = Math.round(n);
      return n.toLocaleString('de-DE', { maximumFractionDigits: n < 1 ? 2 : 1 });
    }
    const whole = Math.floor(n + 1e-9);
    const frac = n - whole;
    let best = GLYPHS[0], diff = Infinity;
    for (const g of GLYPHS) { const d = Math.abs(frac - g[0]); if (d < diff) { diff = d; best = g; } }
    if (diff < 0.07) {
      const w = whole + (best[0] === 1 ? 1 : 0);
      if (!best[1]) return String(w || 1);
      return w ? `${w}${best[1]}` : best[1];
    }
    return n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  }
  function unitFor(unit, qty) {
    if (!unit) return '';
    const base = SINGULAR[unit] || unit;
    return qty > 1 ? (PLURAL[base] || unit) : base;
  }
  /** Zerlegt eine Zutat in {amount, name} – optional skaliert. */
  function ingredientParts(text, factor = 1) {
    const p = parseIngredient(text);
    if (p.qty == null) return { amount: '', name: text };
    if (factor === 1) return { amount: text.slice(0, p.prefixLen).trim(), name: p.name };
    const q1 = p.qty * factor, q2 = p.qty2 != null ? p.qty2 * factor : null;
    const amount = `${p.approx ? 'ca. ' : ''}${fmtQty(q1, p.unit)}${q2 != null ? `–${fmtQty(q2, p.unit)}` : ''}${p.unit ? ' ' + unitFor(p.unit, q2 ?? q1) : ''}`;
    return { amount, name: p.name };
  }
  const scaledText = (text, factor) => { const { amount, name } = ingredientParts(text, factor); return amount ? `${amount} ${name}` : name; };

  // --- Supermarkt-Gänge für die Einkaufsliste ---
  const AISLES = [
    { key: 'gewuerz', label: 'Vorrat & Gewürze', re: /salz|pfeffer(?!oni)|pulver|gewurz|kreuzkummel|kumin|kurkuma|zimt|muskat|chiliflocken|garam masala|ras el hanout|zatar|sumach|lorbeer|nelken|kardamom|sternanis|vanille|ol\b|essig|soja ?sauce|sojasosse|fischsauce|austernsauce|senf|honig|zucker(?!schote|mais)|sirup|tahin|currypaste|miso|worcester|sambal|sriracha|harissa|tomatenmark|bruhe|fond\b|hefe|backpulver|natron|starke|getrocknet|chipotle|paste\b/ },
    { key: 'tk', label: 'Tiefkühl', re: /tiefkuhl|\btk\b|\btk-/ },
    { key: 'konserve', label: 'Konserven & Gläser', re: /\bdose|passiert|gehackte tomaten|stuckige tomaten|kokosmilch|kichererbsen|kidney|weisse bohnen|schwarze bohnen|oliven|kapern|eingelegt|pesto|\bglas\b/ },
    { key: 'kuehl', label: 'Kühlregal', re: /milch(?!reis)|sahne|schmand|creme fraiche|creme double|joghurt|quark|butter|kase|parmesan|pecorino|mozzarella|feta|ricotta|mascarpone|halloumi|burrata|gouda|\beier?\b|eigelb|eiweiss|tofu|tempeh|frischkase/ },
    { key: 'fleisch', label: 'Fleisch & Fisch', re: /fleisch|\bhack|rind|schwein|huhn|hahnchen|huhnchen|pute|lamm|speck|schinken|wurst|chorizo|salami|lachs|fisch|thunfisch|garnele|shrimp|kabeljau|seelachs|forelle|dorade|muschel|filet|bacon|ente\b|steak|schnitzel/ },
    { key: 'brot', label: 'Brot & Backwaren', re: /brot|brotchen|baguette|ciabatta|toast|tortilla|wrap|pita|naan|blatterteig|pizzateig|semmel|panko|paniermehl|brosel/ },
    { key: 'trocken', label: 'Nudeln, Reis & Trockenes', re: /\breis|basmati|jasmin|risotto|milchreis|nudel|pasta|spaghetti|penne|fusilli|tagliatelle|linguine|rigatoni|lasagne|gnocchi|couscous|bulgur|quinoa|linsen|mehl|griess|haferflocken|polenta|nuss|nusse|mandel|cashew|erdnuss|pinienkern|sesam|kerne|rosinen|datteln|schokolade|kakao|udon|soba|ramen|graupen|hirse|spatzle/ },
    { key: 'gemuese', label: 'Obst & Gemüse', re: /kartoffel|zwiebel|schalotte|knoblauch|lauch|porree|mohre|karotte|paprika|tomate|gurke|zucchini|aubergine|kurbis|hokkaido|spinat|mangold|salat|rucola|kohl|brokkoli|sellerie|fenchel|pastinake|rote bete|radieschen|rettich|pilz|champignon|ingwer|chili|zitrone|limette|orange|apfel|birne|banane|beere|avocado|mango|ananas|frucht|obst|gemuse|mais|erbsen|bohnen|petersilie|koriander|basilikum|schnittlauch|dill|minze|thymian|rosmarin|salbei|krauter|zitronengras|spargel|kohlrabi|okra|batate|edamame|sprossen|lauchzwiebel/ },
  ];
  const AISLE_ORDER = ['gemuese', 'brot', 'kuehl', 'fleisch', 'tk', 'trocken', 'konserve', 'gewuerz', 'sonst'];
  const AISLE_LABEL = Object.fromEntries([...AISLES.map((a) => [a.key, a.label]), ['sonst', 'Sonstiges']]);
  function aisleOf(name) {
    const f = fold(name);
    for (const a of AISLES) if (a.re.test(f)) return a.key;
    return 'sonst';
  }
  /** Dinge, die man meist im Haus hat – im „Auf die Liste“-Dialog standardmäßig abgewählt. */
  const PANTRY_RE = /\b(salz|pfeffer|wasser)\b|^(neutrales |natives )?(oliven|raps|sonnenblumen|pflanzen)?ol\b|^zucker$/;
  const isPantry = (text) => PANTRY_RE.test(fold(ingredientParts(text).name));

  // --- Timer im Schritttext erkennen ---
  const DUR_RE = /(\d+(?:[.,]\d+)?|\beine[rn]?\b|½)\s*(?:(?:-|–|bis)\s*(\d+(?:[.,]\d+)?)\s*)?(Stunden|Stunde|Std\.?|h|Minuten|Minute|Min\.?|Sekunden|Sekunde|Sek\.?)(?![\p{L}])/giu;
  const TEMP_RE = /\d+\s*°\s*C?|\b(?:Ober-?\/Unterhitze|Umluft)\b/g;
  function durationsIn(text) {
    const out = [];
    for (const m of text.matchAll(DUR_RE)) {
      const raw = m[1].toLowerCase();
      const v1 = /^ein/.test(raw) ? 1 : raw === '½' ? 0.5 : parseFloat(raw.replace(',', '.'));
      const v2 = m[2] ? parseFloat(m[2].replace(',', '.')) : null;
      const u = m[3].toLowerCase();
      const f = /^(stunde|std|h)/.test(u) ? 60 : /^sek/.test(u) ? 1 / 60 : 1;
      if (!(v1 > 0)) continue;
      // „1 Minute kürzer als angegeben“ ist keine Garzeit
      if (/^\s*(kürzer|länger|früher|später|vorher|weniger|mehr)\b/i.test(text.slice(m.index + m[0].length))) continue;
      out.push({ min: v1 * f, max: v2 ? v2 * f : null, match: m[0], index: m.index });
    }
    return out;
  }
  function stepTimers(step) {
    if (step.timer_min) return [{ min: step.timer_min, label: fmtDur(step.timer_min) }];
    const seen = new Set();
    return durationsIn(step.text)
      .filter((d) => d.min >= 0.25 && d.min <= 24 * 60)
      .filter((d) => (seen.has(d.min) ? false : seen.add(d.min)))
      .slice(0, 3)
      .map((d) => ({ min: d.min, label: d.max ? `${fmtDur(d.min).replace(/ (min|h|s)$/, '')}–${fmtDur(d.max)}` : fmtDur(d.min) }));
  }

  /** Text mit hervorgehobenen Zeiten und Temperaturen. */
  function richText(text) {
    const marks = [];
    for (const m of text.matchAll(DUR_RE)) marks.push({ i: m.index, len: m[0].length, cls: 'dur' });
    for (const m of text.matchAll(TEMP_RE)) marks.push({ i: m.index, len: m[0].length, cls: 'temp' });
    marks.sort((a, b) => a.i - b.i);
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const mk of marks) {
      if (mk.i < pos) continue;
      frag.append(text.slice(pos, mk.i), h('mark', { class: mk.cls }, text.slice(mk.i, mk.i + mk.len)));
      pos = mk.i + mk.len;
    }
    frag.append(text.slice(pos));
    return frag;
  }

  // --- Kochablauf & Bereitstellen (Fallback-Heuristiken) ---
  const PASSIVE_RE = /back|kochel|\bgar(en|t)\b|ziehen|ruhen|schmor|marinier|gehen lassen|abkuhl|kuhl stellen|im ofen|quellen|simmer|einweich|stocken|kochen lassen/;
  function shortText(t) {
    const protectedText = t.replace(/\b(ca|evtl|ggf|bzw|z\.B|Min|Std|Pck|Msp|Sek|Ca)\.\s/g, '$1.⁠');
    const m = protectedText.match(/^(.+?)(?:[.!?;](?:\s|$)|,\s(?:dann|danach|anschließend)\s|\s[–-]\s)/);
    let s = (m ? m[1] : protectedText).replace(/⁠/g, ' ').replace(/[.;!]$/, '').trim();
    if (s.length > 72) s = s.slice(0, 70).replace(/\s+\S*$/, '') + ' …';
    return s;
  }
  function overviewOf(rec) {
    if (rec.ablauf && rec.ablauf.length) {
      return rec.ablauf.map((text) => {
        const d = durationsIn(text)[0];
        return { text, min: d ? d.min : null, passive: !!d && d.min >= 5 && PASSIVE_RE.test(fold(text)) };
      });
    }
    return rec.schritte.map((s) => {
      const t = stepTimers(s)[0];
      return { text: shortText(s.text), min: t ? t.min : null, passive: !!t && t.min >= 5 && PASSIVE_RE.test(fold(s.text)) };
    });
  }
  const TOOLS = [
    [/backofen|\bofen\b/, 'Backofen'],
    [/auflaufform|ofenform|gratinform/, 'Auflaufform'],
    [/backblech|\bblech\b/, 'Backblech'],
    [/backpapier/, 'Backpapier'],
    [/\bwok\b/, 'Wok'],
    [/pfanne/, 'Pfanne'],
    [/brater|schmortopf/, 'Bräter'],
    [/topf|salzwasser/, 'Topf'],
    [/\bsieb|abgiess|abtropfen/, 'Sieb'],
    [/schussel/, 'Schüssel'],
    [/reibe|\breiben\b|abreiben/, 'Reibe'],
    [/hobel/, 'Gemüsehobel'],
    [/purierstab|purieren/, 'Pürierstab'],
    [/mixer|mixen/, 'Mixer'],
    [/schneebesen|verquirl|aufschlag/, 'Schneebesen'],
    [/morser/, 'Mörser'],
    [/nudelholz|ausrollen/, 'Nudelholz'],
    [/spatzlepresse|spatzlehobel/, 'Spätzlepresse'],
    [/schaumkelle/, 'Schaumkelle'],
    [/knoblauchpresse|gepresst/, 'Knoblauchpresse'],
    [/alufolie/, 'Alufolie'],
    [/thermometer/, 'Thermometer'],
  ];
  function toolsOf(rec) {
    if (rec.utensilien && rec.utensilien.length) return rec.utensilien;
    const all = fold(rec.schritte.map((s) => s.text).join(' '));
    return [...new Set(TOOLS.filter(([re]) => re.test(all)).map(([, label]) => label))];
  }
  function vorabOf(rec) {
    if (rec.vorab && rec.vorab.length) return rec.vorab;
    const out = [];
    for (const s of rec.schritte) {
      const m = s.text.match(/[^.;]*vorheizen[^.;]*/i);
      if (m) out.push(cap(m[0].trim()));
      const soak = s.text.match(/[^.;]*(einweichen|über Nacht|marinieren)[^.;]*/i);
      if (soak) out.push(cap(soak[0].trim()));
    }
    for (const z of rec.zutaten) {
      if (/zimmerwarm|zimmertemperatur|raumtemperatur|\bweiche?n?\b/i.test(z)) out.push(`${z} – rechtzeitig aus dem Kühlschrank nehmen`);
    }
    if (rec.schritte.some((s) => /salzwasser|wasser (zum kochen|aufsetzen|aufkochen)/i.test(s.text)) && !out.some((x) => /wasser/i.test(x))) {
      out.push('Wasser für Nudeln/Spätzle früh aufsetzen');
    }
    return [...new Set(out)];
  }

  // ======================================================================
  // Zustand
  // ======================================================================

  const S = {
    status: 'loading', // loading | ok | empty | error
    error: null,
    recipes: [],
    byId: new Map(),
    generated: null,
    lastLoad: 0,
    cuisines: [], types: [], tags: [], regions: [],
    filters: Object.assign({ q: '', kueche: '', typ: '', region: '', maxAktiv: 0, tags: [], nurFav: false }, session.get('filter', {})),
    listLimit: 14,
    route: { name: 'boot' },
    listScroll: 0,
    navStack: [],
  };
  let favs = new Set(local.get('favoriten', []));
  let shop = local.get('einkauf', []);
  if (!Array.isArray(shop)) shop = [];
  let notes = local.get('notizen', {});
  let cooked = local.get('gekocht', {});
  let checks = session.get('haken', {});
  let portions = session.get('portionen', {});
  let cleanups = [];

  const saveFilters = () => session.set('filter', S.filters);

  function ingest(data) {
    const tage = Array.isArray(data && data.tage) ? data.tage : [];
    const recipes = [];
    const byId = new Map();
    const cuisines = new Map(), types = new Map(), tags = new Map(), regions = new Map();
    for (const tag of tage) {
      if (!tag || typeof tag.datum !== 'string' || !Array.isArray(tag.rezepte)) continue;
      tag.rezepte.forEach((r, i) => {
        if (!r || typeof r.name !== 'string' || !Array.isArray(r.zutaten) || !Array.isArray(r.schritte)) return;
        const base = slugify(r.name) || `rezept-${i + 1}`;
        let slug = base, n = 2;
        while (byId.has(`${tag.datum}/${slug}`)) slug = `${base}-${n++}`;
        const region = regionOf(r);
        const rec = {
          ...r,
          id: `${tag.datum}/${slug}`,
          datum: tag.datum,
          region,
          aktiv: num(r.zeit_aktiv_min),
          passiv: num(r.zeit_passiv_min),
          portionen: num(r.portionen) || null,
          zutaten: r.zutaten.filter((z) => typeof z === 'string'),
          schritte: r.schritte
            .map((s) => (typeof s === 'string' ? { text: s } : s && typeof s.text === 'string' ? { text: s.text, timer_min: num(s.timer_min) || null } : null))
            .filter(Boolean),
          tags: Array.isArray(r.tags) ? r.tags.filter((t) => typeof t === 'string') : [],
          kuecheKey: fold(r.kueche || ''),
          typKey: fold(r.typ || ''),
        };
        rec.tagKeys = rec.tags.map(fold);
        rec.haystack = fold([rec.name, rec.beschreibung, rec.kueche, rec.typ, rec.tags.join(' '), rec.zutaten.join(' '), region.label].join(' \n '));
        recipes.push(rec);
        byId.set(rec.id, rec);
        const count = (map, key, label) => { if (!key) return; const e = map.get(key) || { key, label, n: 0 }; e.n++; map.set(key, e); };
        count(cuisines, rec.kuecheKey, cap(rec.kueche || ''));
        count(types, rec.typKey, cap(rec.typ || ''));
        rec.tags.forEach((t, j) => count(tags, rec.tagKeys[j], t));
        count(regions, region.key, region.label);
      });
    }
    recipes.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
    const byLabel = (a, b) => a.label.localeCompare(b.label, 'de');
    S.recipes = recipes;
    S.byId = byId;
    S.generated = typeof data?.generiert === 'string' ? new Date(data.generiert) : null;
    S.cuisines = [...cuisines.values()].sort(byLabel);
    S.types = [...types.values()].sort(byLabel);
    S.tags = [...tags.values()].sort((a, b) => b.n - a.n || byLabel(a, b));
    const order = [...REGIONS.map((r) => r.key), 'weitere'];
    S.regions = [...regions.values()].sort((a, b) => (order.indexOf(a.key) + 99) % 99 - (order.indexOf(b.key) + 99) % 99 || byLabel(a, b));
  }

  async function load() {
    try {
      const res = await fetch('rezepte.json', { cache: 'no-cache' });
      if (res.status === 404) { const e = new Error('Die Datei rezepte.json wurde nicht gefunden.'); e.code = 404; throw e; }
      if (!res.ok) throw new Error(`Der Server antwortete mit Status ${res.status}.`);
      let data;
      try { data = await res.json(); } catch { throw new Error('rezepte.json ist kein gültiges JSON.'); }
      ingest(data);
      S.status = S.recipes.length ? 'ok' : 'empty';
      S.error = null;
    } catch (err) {
      if (S.recipes.length) toast('Aktualisieren fehlgeschlagen – zeige letzten Stand.');
      else { S.status = 'error'; S.error = err; }
    }
    S.lastLoad = Date.now();
  }

  // Favoriten
  function toggleFav(id, btn) {
    const rec = S.byId.get(id);
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    local.set('favoriten', [...favs]);
    const on = favs.has(id);
    $$(`.fav-btn[data-id="${CSS.escape(id)}"]`).forEach((b) => updateFavBtn(b, id));
    if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    toast(on ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt', on ? null : { label: 'Rückgängig', run: () => toggleFav(id) });
    if (S.route.name === 'list' && (S.route.fav || S.filters.nurFav)) renderResults();
    return rec;
  }
  function updateFavBtn(btn, id) {
    const on = favs.has(id);
    const name = S.byId.get(id)?.name || 'Rezept';
    btn.classList.toggle('is-fav', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', `${name} ${on ? 'aus Favoriten entfernen' : 'zu Favoriten hinzufügen'}`);
  }
  function favButton(rec, cls = '') {
    const b = h('button', { type: 'button', class: `icon-btn fav-btn ${cls}`, dataset: { id: rec.id }, onclick: (e) => { e.preventDefault(); e.stopPropagation(); toggleFav(rec.id, b); } }, icon('heart'));
    updateFavBtn(b, rec.id);
    return b;
  }

  // Abhaken (nur Sitzung)
  function getChecks(id) { return checks[id] || (checks[id] = { z: [], s: [], v: [] }); }
  function setCheck(id, kind, idx, on) {
    const c = getChecks(id);
    const set = new Set(c[kind] || []);
    if (on) set.add(idx); else set.delete(idx);
    c[kind] = [...set];
    session.set('haken', checks);
  }
  const isChecked = (id, kind, idx) => (checks[id]?.[kind] || []).includes(idx);

  function getPortions(rec) { return portions[rec.id] || rec.portionen || null; }
  function factorOf(rec) { const p = getPortions(rec); return rec.portionen && p ? p / rec.portionen : 1; }

  // ======================================================================
  // UI-Bausteine
  // ======================================================================

  let toastTimer = null;
  function toast(msg, action) {
    const el = $('#toast');
    el.replaceChildren(h('span', null, msg));
    if (action) el.append(h('button', { type: 'button', class: 'toast-action', onclick: () => { hideToast(); action.run(); } }, action.label));
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 5000 : 2400);
  }
  function hideToast() { $('#toast').classList.remove('show'); }

  let sheetCounter = 0;
  function openSheet({ title, body, footer, onClose, label }) {
    const id = `sheet-title-${++sheetCounter}`;
    const dlg = h('dialog', { class: 'sheet', 'aria-labelledby': id },
      h('div', { class: 'sheet-inner' },
        h('div', { class: 'sheet-head' },
          h('h2', { id, tabindex: '-1', autofocus: true }, title),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': label || 'Schließen', onclick: () => dlg.close() }, icon('close'))),
        h('div', { class: 'sheet-body' }, body),
        footer ? h('div', { class: 'sheet-foot' }, footer) : null));
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { dlg.remove(); if (onClose) onClose(); });
    document.body.append(dlg);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('h2', dlg).focus({ preventScroll: true }); // Fokus an den Anfang, ohne Fokusring am Schließen-Button
    return dlg;
  }

  function checkItem({ checked, onChange, content, label, boxClass = 'box', boxContent }) {
    const input = h('input', { type: 'checkbox', checked, 'aria-label': label || null, onchange: (e) => onChange(e.target.checked, e) });
    const box = h('span', { class: boxClass, 'aria-hidden': 'true', html: boxContent ?? CHECK_SVG });
    return h('label', { class: 'check' }, input, box, h('span', { class: 'txt' }, content));
  }

  function stateView({ title, text, art = 'pot', actions = [] }) {
    const svgs = {
      pot: '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 42h68M20 42v26a10 10 0 0 0 10 10h36a10 10 0 0 0 10-10V42"/><path d="M38 30c0-5 4-6 4-11M50 30c0-5 4-6 4-11M62 30c0-5 4-6 4-11" opacity=".6"/></svg>',
      search: '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="42" cy="42" r="24"/><path d="M60 60l18 18M34 42h16"/></svg>',
      heart: '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M48 80S18 62 11 44C6 31 14 17 28 17c8 0 14 5 20 12 6-7 12-12 20-12 14 0 22 14 17 27-7 18-37 36-37 36z"/></svg>',
      error: '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="48" cy="48" r="32"/><path d="M48 32v20M48 63v1"/></svg>',
      cart: '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16h9l9 44h42l8-30H25"/><circle cx="36" cy="76" r="5"/><circle cx="66" cy="76" r="5"/></svg>',
    };
    return h('div', { class: 'state' }, h('span', { html: svgs[art] || svgs.pot, 'aria-hidden': 'true' }), h('h2', { tabindex: '-1' }, title), text ? h('p', null, text) : null, actions);
  }

  function dataStateOrNull() {
    if (S.status === 'loading') return h('div', null, h('div', { class: 'state state-loading', 'aria-busy': 'true' }, h('p', null, 'Rezepte werden geladen')), h('div', { class: 'skeleton', 'aria-hidden': 'true' }, h('div'), h('div'), h('div')));
    if (S.status === 'error') {
      const is404 = S.error && S.error.code === 404;
      return stateView({
        art: 'error',
        title: 'Rezepte konnten nicht geladen werden',
        text: is404 ? h('span', null, 'Die Datei ', h('code', null, 'rezepte.json'), ' fehlt. Läuft ', h('code', null, 'scripts/update.sh'), ' auf dem Server?') : (S.error?.message || 'Unbekannter Fehler.'),
        actions: [h('button', { type: 'button', class: 'btn btn-primary', onclick: retry }, icon('refresh'), 'Erneut versuchen')],
      });
    }
    if (S.status === 'empty') {
      return stateView({ title: 'Noch keine Rezepte', text: 'Sobald die ersten Rezepte da sind, erscheinen sie hier – jeden Morgen kommen zwei neue dazu.', actions: [h('button', { type: 'button', class: 'btn', onclick: retry }, icon('refresh'), 'Neu laden')] });
    }
    return null;
  }
  async function retry() {
    S.status = 'loading';
    render();
    await load();
    render();
  }

  // ======================================================================
  // Navigation
  // ======================================================================

  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
    if (!parts.length) return { name: 'list', fav: false };
    if (parts[0] === 'favoriten') return { name: 'list', fav: true };
    if (parts[0] === 'einkauf') return { name: 'shop' };
    if (parts[0] === 'r' && parts.length >= 3) {
      const id = `${parts[1]}/${parts[2]}`;
      if (parts[3] === 'kochen') return { name: 'cook', id, step: parseInt(parts[4], 10) || 0 };
      return { name: 'detail', id };
    }
    return { name: 'notfound' };
  }
  const recipeHref = (id, suffix = '') => `#/r/${id.split('/').map(encodeURIComponent).join('/')}${suffix}`;

  function navBack(fallback) {
    if (S.navStack.length > 1) history.back();
    else { S.replacing = true; location.replace(fallback); }
  }

  function onHashChange() {
    const h0 = location.hash || '#/';
    const st = S.navStack;
    if (S.replacing) { S.replacing = false; st[st.length - 1] = h0; }
    else if (st.length > 1 && st[st.length - 2] === h0) st.pop();
    else if (st[st.length - 1] !== h0) st.push(h0);
    if (st.length > 50) st.splice(0, st.length - 50);
    render({ nav: true });
  }

  function updateTabbar() {
    const r = S.route;
    const active = r.name === 'shop' ? 'shop' : r.name === 'list' ? (r.fav ? 'fav' : 'list') : null;
    $$('.tabbar a').forEach((a) => { if (a.dataset.tab === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const open = shop.filter((i) => !i.done).length;
    const badge = $('.tabbar .tab-badge');
    badge.hidden = !open;
    badge.textContent = open > 99 ? '99+' : String(open);
    badge.setAttribute('aria-label', `${open} offen`);
  }

  function render(opts = {}) {
    const prev = S.route;
    if (prev.name === 'list') S.listScroll = window.scrollY;
    cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    cleanups = [];
    $$('dialog.sheet').forEach((d) => (typeof d.close === 'function' ? d.close() : d.remove()));

    const r = parseRoute();
    S.route = r;
    document.body.dataset.view = r.name;
    if (r.name !== 'cook') keepAwake(false);

    if (r.name === 'list') renderList(r.fav);
    else if (r.name === 'detail') renderDetail(r);
    else if (r.name === 'cook') renderCook(r);
    else if (r.name === 'shop') renderShop();
    else {
      document.title = 'Nicht gefunden · Rezepte';
      main.replaceChildren(stateView({ art: 'search', title: 'Seite nicht gefunden', actions: [h('a', { class: 'btn btn-primary', href: '#/' }, 'Zu den Rezepten')] }));
    }
    updateTabbar();
    renderDock();

    // Scroll & Fokus
    const sameView = prev.name === r.name && prev.id === r.id && prev.fav === r.fav;
    if (r.name === 'list' && opts.nav && !sameView) requestAnimationFrame(() => window.scrollTo(0, S.listScroll || 0));
    else if (opts.nav && !sameView) window.scrollTo(0, 0);
    if (opts.nav && !sameView) {
      const target = $('h1', main) || $('h2', main);
      if (target) { if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    }
  }

  // ======================================================================
  // Ansicht: Liste
  // ======================================================================

  function activeFilterCount() {
    const f = S.filters;
    return (f.kueche ? 1 : 0) + (f.typ ? 1 : 0) + (f.maxAktiv ? 1 : 0) + f.tags.length + (f.nurFav ? 1 : 0);
  }
  function anyFilter() { return activeFilterCount() > 0 || !!S.filters.region || !!S.filters.q.trim(); }
  function resetFilters() {
    S.filters = { q: '', kueche: '', typ: '', region: '', maxAktiv: 0, tags: [], nurFav: false };
    saveFilters();
  }

  function filtered(favOnly) {
    const f = S.filters;
    const words = fold(f.q).split(/\s+/).filter(Boolean);
    return S.recipes.filter((r) =>
      (!favOnly || favs.has(r.id)) &&
      (!f.nurFav || favs.has(r.id)) &&
      (!f.kueche || r.kuecheKey === f.kueche) &&
      (!f.typ || r.typKey === f.typ) &&
      (!f.region || r.region.key === f.region) &&
      (!f.maxAktiv || (r.aktiv != null && r.aktiv <= f.maxAktiv)) &&
      f.tags.every((t) => r.tagKeys.includes(t)) &&
      words.every((w) => r.haystack.includes(w)));
  }

  function renderList(favOnly) {
    document.title = favOnly ? 'Favoriten · Rezepte' : 'Rezepte';
    const hour = new Date().getHours();
    const greet = hour < 11 ? 'Guten Morgen' : hour < 17 ? 'Hallo' : 'Guten Abend';
    const header = h('header', { class: 'topbar' },
      h('div', null,
        h('p', { class: 'eyebrow' }, favOnly ? `${plural(favs.size, 'Lieblingsrezept', 'Lieblingsrezepte')}` : greet),
        h('h1', { tabindex: '-1' }, favOnly ? 'Favoriten' : 'Worauf hast du Lust?')),
      h('button', { type: 'button', class: 'btn btn-soft random-btn', onclick: () => randomRecipe(favOnly) }, icon('dice'), 'Zufall'));

    const state = dataStateOrNull();
    if (state) { main.replaceChildren(header, state); return; }

    let debounce;
    const input = h('input', {
      type: 'search', inputmode: 'search', enterkeyhint: 'search', autocomplete: 'off', autocorrect: 'off',
      placeholder: 'Rezept oder Zutat suchen', 'aria-label': 'Rezepte durchsuchen (Name, Zutaten)', value: S.filters.q,
      oninput: (e) => {
        S.filters.q = e.target.value;
        clearBtn.hidden = !e.target.value;
        clearTimeout(debounce);
        debounce = setTimeout(() => { saveFilters(); renderResults(); }, 120);
      },
      onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
    });
    const clearBtn = h('button', { type: 'button', class: 'icon-btn clear', 'aria-label': 'Suche leeren', hidden: !S.filters.q, onclick: () => { S.filters.q = ''; input.value = ''; clearBtn.hidden = true; saveFilters(); renderResults(); input.focus(); } }, icon('close'));
    const search = h('div', { class: 'search-row' },
      h('label', { class: 'search' }, icon('search'), input, clearBtn),
      h('button', { type: 'button', class: 'btn filter-btn', id: 'filter-btn', onclick: () => openFilters(favOnly), 'aria-haspopup': 'dialog' }, icon('sliders'), h('span', null, 'Filter'), h('span', { class: 'count', id: 'filter-count', hidden: true })));

    const regionChips = S.regions.length > 1
      ? h('div', { class: 'chips', role: 'group', 'aria-label': 'Nach Region filtern' },
        h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!S.filters.region), onclick: () => setRegion('') }, 'Alle'),
        S.regions.map((reg) => h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(S.filters.region === reg.key), style: { '--tint': tintVar(reg) },
          onclick: () => setRegion(S.filters.region === reg.key ? '' : reg.key),
        }, h('span', { class: 'dot', 'aria-hidden': 'true' }), reg.label, h('small', null, reg.n))))
      : null;

    const footer = h('p', { class: 'stand' },
      S.generated && !isNaN(S.generated) ? `Stand: ${fmtDateShort.format(S.generated)}, ${fmtTime.format(S.generated)} · ` : '',
      h('button', { type: 'button', class: 'link-btn', onclick: async () => { await load(); render(); toast('Aktualisiert'); } }, 'Aktualisieren'));

    main.replaceChildren(header, search, regionChips || '', h('div', { id: 'results', 'aria-live': 'polite' }), footer);
    renderResults();
  }

  function setRegion(key) {
    S.filters.region = key;
    saveFilters();
    $$('.chips .chip').forEach((c, i) => {
      const k = i === 0 ? '' : S.regions[i - 1].key;
      c.setAttribute('aria-pressed', String(k === key));
    });
    renderResults();
  }

  function renderResults() {
    const box = $('#results');
    if (!box) return;
    const favOnly = !!S.route.fav;
    const list = filtered(favOnly);
    const n = activeFilterCount();
    const countEl = $('#filter-count');
    if (countEl) { countEl.hidden = !n; countEl.textContent = n; }
    $('#filter-btn')?.setAttribute('aria-label', n ? `Filter, ${n} aktiv` : 'Filter');

    const kids = [];
    if (!list.length) {
      if (favOnly && !favs.size) {
        kids.push(stateView({ art: 'heart', title: 'Noch keine Favoriten', text: 'Tippe bei einem Rezept auf das Herz, dann landet es hier.', actions: [h('a', { class: 'btn btn-primary', href: '#/' }, 'Rezepte entdecken')] }));
      } else {
        kids.push(stateView({ art: 'search', title: 'Nichts gefunden', text: 'Probier einen anderen Suchbegriff oder lockere die Filter.', actions: [h('button', { type: 'button', class: 'btn btn-primary', onclick: () => { resetFilters(); render(); } }, 'Filter zurücksetzen')] }));
      }
      box.replaceChildren(...kids);
      return;
    }

    kids.push(h('div', { class: 'results-meta' },
      h('span', null, plural(list.length, 'Rezept', 'Rezepte')),
      anyFilter() ? h('button', { type: 'button', class: 'link-btn', onclick: () => { resetFilters(); render(); } }, 'Filter zurücksetzen') : null));

    // Nach Datum gruppieren
    const groups = [];
    for (const r of list) {
      const g = groups[groups.length - 1];
      if (g && g.datum === r.datum) g.items.push(r); else groups.push({ datum: r.datum, items: [r] });
    }
    const limit = anyFilter() ? Infinity : S.listLimit;
    groups.slice(0, limit).forEach((g) => {
      const lbl = dayLabel(g.datum);
      const headId = `day-${g.datum}`;
      kids.push(h('section', { class: 'day', 'aria-labelledby': headId },
        h('div', { class: 'day-head' },
          h('h2', { id: headId }, lbl.rel || lbl.full),
          lbl.rel ? h('span', { class: 'sub' }, lbl.full) : null,
          g.datum === isoDay() ? h('span', { class: 'new' }, 'Neu') : null),
        h('div', { class: 'cards' }, g.items.map(card))));
    });
    if (groups.length > limit) {
      kids.push(h('button', { type: 'button', class: 'btn more', onclick: () => { S.listLimit += 14; renderResults(); } }, 'Ältere Rezepte anzeigen'));
    }
    box.replaceChildren(...kids);
  }

  function card(r) {
    const meta = [];
    if (r.aktiv != null) meta.push(h('span', { class: 'pill' }, icon('clock'), `${fmtMin(r.aktiv)} aktiv`));
    if (r.passiv) meta.push(h('span', { class: 'pill passive' }, `+ ${fmtMin(r.passiv)} passiv`));
    r.tags.slice(0, 2).forEach((t) => meta.push(h('span', { class: 'pill tag' }, t)));
    if (cooked[r.id]?.length) meta.push(h('span', { class: 'pill cooked' }, icon('check'), 'gekocht'));
    const eyebrow = [r.kueche && cap(r.kueche), r.typ].filter(Boolean).join(' · ') || r.region.label;
    return h('article', { class: 'card', style: { '--tint': tintVar(r.region) } },
      h('p', { class: 'eyebrow' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), eyebrow),
      h('h3', null, h('a', { href: recipeHref(r.id) }, r.name)),
      r.beschreibung ? h('p', { class: 'desc' }, r.beschreibung) : null,
      meta.length ? h('div', { class: 'card-meta' }, meta) : null,
      favButton(r));
  }

  function randomRecipe(favOnly) {
    let pool = filtered(favOnly);
    if (!pool.length) pool = S.recipes;
    if (!pool.length) { toast('Noch keine Rezepte vorhanden'); return; }
    const last = session.get('zufall', null);
    if (pool.length > 1) pool = pool.filter((r) => r.id !== last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    session.set('zufall', pick.id);
    location.hash = recipeHref(pick.id);
  }

  function openFilters(favOnly) {
    const f = S.filters;
    const countBtn = h('button', { type: 'button', class: 'btn btn-primary' });
    const updateCount = () => { countBtn.textContent = `${plural(filtered(favOnly).length, 'Rezept', 'Rezepte')} anzeigen`; };
    const apply = () => { saveFilters(); renderResults(); updateCount(); };

    const select = (labelText, id, items, value, onChange) => h('div', { class: 'field' },
      h('label', { for: id }, labelText),
      h('select', { id, class: 'select', onchange: (e) => onChange(e.target.value) },
        h('option', { value: '' }, 'Alle'),
        items.map((it) => h('option', { value: it.key, selected: it.key === value }, `${it.label} (${it.n})`))));

    const timeOpts = [[0, 'Egal'], [15, '≤ 15 min'], [30, '≤ 30 min'], [45, '≤ 45 min'], [60, '≤ 60 min']];
    const body = h('div', null,
      select('Küche', 'f-kueche', S.cuisines, f.kueche, (v) => { f.kueche = v; apply(); }),
      select('Typ', 'f-typ', S.types, f.typ, (v) => { f.typ = v; apply(); }),
      h('fieldset', { class: 'field', style: { border: '0', padding: '0', margin: '16px 0 0' } },
        h('legend', { class: 'label', style: { 'font-weight': '650', 'font-size': '15px', 'margin-bottom': '8px', padding: '0' } }, 'Aktive Arbeitszeit'),
        h('div', { class: 'segmented' }, timeOpts.map(([v, l]) => h('label', { class: 'chip' },
          h('input', { type: 'radio', name: 'f-zeit', value: String(v), checked: f.maxAktiv === v, onchange: () => { f.maxAktiv = v; apply(); } }), l)))),
      S.tags.length ? h('fieldset', { class: 'field', style: { border: '0', padding: '0', margin: '16px 0 0' } },
        h('legend', { class: 'label', style: { 'font-weight': '650', 'font-size': '15px', 'margin-bottom': '8px', padding: '0' } }, 'Merkmale'),
        h('div', { class: 'chip-wrap' }, S.tags.map((t) => h('label', { class: 'chip' },
          h('input', { type: 'checkbox', value: t.key, checked: f.tags.includes(t.key), onchange: (e) => { f.tags = e.target.checked ? [...f.tags, t.key] : f.tags.filter((x) => x !== t.key); apply(); } }), t.label)))) : null,
      favOnly ? null : h('div', { class: 'field switch-row' },
        h('label', { for: 'f-fav' }, 'Nur Favoriten'),
        h('span', { class: 'switch' }, h('input', { type: 'checkbox', id: 'f-fav', role: 'switch', checked: f.nurFav, onchange: (e) => { f.nurFav = e.target.checked; apply(); } }), h('span', { 'aria-hidden': 'true' }))));

    const dlg = openSheet({
      title: 'Filter',
      body,
      footer: [
        h('button', { type: 'button', class: 'btn', onclick: () => { const q = f.q, region = f.region; resetFilters(); S.filters.q = q; S.filters.region = region; saveFilters(); dlg.close(); render(); } }, 'Zurücksetzen'),
        countBtn,
      ],
    });
    countBtn.addEventListener('click', () => dlg.close());
    updateCount();
  }

  // ======================================================================
  // Ansicht: Rezept
  // ======================================================================

  function notFoundRecipe() {
    document.title = 'Rezept nicht gefunden · Rezepte';
    main.replaceChildren(stateView({ art: 'search', title: 'Rezept nicht gefunden', text: 'Vielleicht wurde es umbenannt oder der Link ist unvollständig.', actions: [h('a', { class: 'btn btn-primary', href: '#/' }, 'Zu den Rezepten')] }));
  }

  function renderDetail(route) {
    const state = dataStateOrNull();
    if (state) { main.replaceChildren(state); return; }
    const rec = S.byId.get(route.id);
    if (!rec) { notFoundRecipe(); return; }
    document.title = `${rec.name} · Rezepte`;

    const barTitle = h('span', { class: 'bar-title', 'aria-hidden': 'true' }, rec.name);
    const bar = h('div', { class: 'detail-bar' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Zurück', onclick: () => navBack('#/') }, icon('back')),
      barTitle,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Rezept teilen', onclick: () => shareRecipe(rec) }, icon('share')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Rezept drucken', onclick: () => window.print() }, icon('print')),
      favButton(rec));
    const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener('scroll', onScroll));

    const lbl = dayLabel(rec.datum);
    const total = (rec.aktiv || 0) + (rec.passiv || 0);
    const meta = rec.tags.map((t) => h('span', { class: 'pill tag' }, t));

    const hero = h('header', { class: 'recipe-hero', style: { '--tint': tintVar(rec.region) } },
      h('p', { class: 'eyebrow' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), [rec.kueche && cap(rec.kueche), rec.typ, rec.region.label].filter(Boolean).join(' · ')),
      h('h1', { tabindex: '-1' }, rec.name),
      rec.beschreibung ? h('p', { class: 'lead' }, rec.beschreibung) : null,
      meta.length ? h('div', { class: 'card-meta' }, meta) : null,
      h('dl', { class: 'facts' },
        h('div', null, h('dt', null, 'Aktiv'), h('dd', null, fmtMin(rec.aktiv))),
        h('div', null, h('dt', null, 'Passiv'), h('dd', null, fmtMin(rec.passiv))),
        h('div', null, h('dt', null, 'Gesamt'), h('dd', null, total ? fmtMin(total) : '–'))));

    const actions = h('div', { class: 'actions' },
      h('a', { class: 'btn btn-primary', href: recipeHref(rec.id, '/kochen') }, icon('chef'), 'Jetzt kochen'),
      h('button', { type: 'button', class: 'btn', onclick: () => openAddToShop(rec) }, icon('cart'), 'Einkaufsliste'));

    // Auf einen Blick
    const ov = overviewOf(rec);
    const overview = h('section', { class: 'block', 'aria-labelledby': 'h-ablauf' },
      h('div', { class: 'block-head' }, h('h2', { id: 'h-ablauf' }, 'Auf einen Blick'), h('span', { class: 'hint' }, rec.ablauf?.length ? 'Kochablauf' : 'aus den Schritten')),
      h('div', { class: 'panel' }, timeline(ov), total ? h('p', { class: 'timeline-total' }, `Fertig nach etwa ${fmtMin(total)}`) : null));

    // Bereitstellen
    const tools = toolsOf(rec), vorab = vorabOf(rec);
    const prep = tools.length || vorab.length ? h('section', { class: 'block', 'aria-labelledby': 'h-prep' },
      h('div', { class: 'block-head' }, h('h2', { id: 'h-prep' }, 'Bereitstellen')),
      h('div', { class: 'panel' },
        tools.length ? h('div', null, h('p', { class: 'prep-sub' }, 'Rausholen'), h('ul', { class: 'prep-tools', 'aria-label': 'Utensilien' }, tools.map((t) => h('li', { class: 'pill' }, t)))) : null,
        vorab.length ? h('div', null, h('p', { class: 'prep-sub' }, 'Vorab erledigen'), h('ul', { class: 'prep-list' }, vorab.map((v) => h('li', null, icon('bolt'), h('span', null, v))))) : null)) : null;

    // Zutaten
    const ingList = h('ul', { class: 'checklist' });
    const paintIngredients = () => {
      const factor = factorOf(rec);
      ingList.replaceChildren(...rec.zutaten.map((z, i) => {
        const { amount, name } = ingredientParts(z, factor);
        return h('li', null, checkItem({
          checked: isChecked(rec.id, 'z', i),
          onChange: (on) => setCheck(rec.id, 'z', i, on),
          content: [amount ? h('span', { class: 'amount' }, amount, ' ') : null, name],
        }));
      }));
    };
    paintIngredients();
    const ingredients = h('section', { class: 'block', 'aria-labelledby': 'h-zutaten' },
      h('div', { class: 'block-head' }, h('h2', { id: 'h-zutaten' }, 'Zutaten'), portionStepper(rec, paintIngredients)),
      h('div', { class: 'panel' }, ingList));

    // Schritte
    const steps = h('section', { class: 'block', 'aria-labelledby': 'h-schritte' },
      h('div', { class: 'block-head' }, h('h2', { id: 'h-schritte' }, 'Zubereitung'), h('span', { class: 'hint' }, plural(rec.schritte.length, 'Schritt', 'Schritte'))),
      h('ol', { class: 'steps' }, rec.schritte.map((s, i) => stepItem(rec, s, i))));

    // Notiz & gekocht
    const noteVal = notes[rec.id] || '';
    const printNote = h('p', { class: 'print-only' }, noteVal);
    let noteTimer;
    const note = h('section', { class: `block note ${noteVal ? '' : 'no-print'}`, 'aria-labelledby': 'h-notiz' },
      h('div', { class: 'block-head' }, h('h2', { id: 'h-notiz' }, 'Meine Notiz')),
      h('textarea', {
        'aria-labelledby': 'h-notiz', placeholder: 'z. B. „Nächstes Mal mehr Knoblauch“ – bleibt auf diesem Gerät.', value: noteVal,
        oninput: (e) => {
          const v = e.target.value;
          printNote.textContent = v;
          note.classList.toggle('no-print', !v.trim());
          clearTimeout(noteTimer);
          noteTimer = setTimeout(() => { if (v.trim()) notes[rec.id] = v; else delete notes[rec.id]; local.set('notizen', notes); }, 300);
        },
      }),
      printNote,
      cookedLine(rec));

    main.replaceChildren(bar, h('article', { class: 'recipe' }, hero, actions, overview, prep, ingredients, steps, note,
      h('p', { class: 'stand' }, `Rezept vom ${lbl.full}`)));
  }

  function timeline(items) {
    return h('ol', { class: 'timeline' }, items.map((it) => h('li', { class: it.passive ? 'passive' : '' },
      h('span', { class: 'tl-text' }, it.text),
      it.min ? h('span', { class: 'tl-time' }, icon(it.passive ? 'timer' : 'clock'), fmtDur(it.min), it.passive ? h('span', { class: 'visually-hidden' }, ' (Wartezeit)') : null) : null)));
  }

  function portionStepper(rec, onChange) {
    if (!rec.portionen) return null;
    const out = h('output', { 'aria-live': 'polite' });
    const paint = () => { const p = getPortions(rec); out.textContent = plural(p, 'Portion', 'Portionen'); };
    const change = (d) => {
      const p = clamp(getPortions(rec) + d, 1, 24);
      if (p === rec.portionen) delete portions[rec.id]; else portions[rec.id] = p;
      session.set('portionen', portions);
      paint();
      onChange();
    };
    paint();
    return h('div', { class: 'stepper', role: 'group', 'aria-label': 'Portionen' },
      h('button', { type: 'button', 'aria-label': 'Eine Portion weniger', onclick: () => change(-1) }, icon('minus')),
      out,
      h('button', { type: 'button', 'aria-label': 'Eine Portion mehr', onclick: () => change(1) }, icon('plus')));
  }

  function stepItem(rec, step, i) {
    const timersHere = stepTimers(step);
    const li = h('li', { class: isChecked(rec.id, 's', i) ? 'done' : '' });
    const input = h('input', { type: 'checkbox', checked: isChecked(rec.id, 's', i), 'aria-label': `Schritt ${i + 1} erledigt`, onchange: (e) => { setCheck(rec.id, 's', i, e.target.checked); li.classList.toggle('done', e.target.checked); } });
    li.append(
      h('label', { class: 'check' }, input,
        h('span', { class: 'num', 'aria-hidden': 'true', html: `<span>${i + 1}</span>${CHECK_SVG}` }),
        h('span', { class: 'txt' }, richText(step.text))),
      timersHere.length ? h('div', { class: 'step-tools' }, timersHere.map((t) => timerButton(rec, i, t))) : '');
    return li;
  }

  function timerButton(rec, stepIdx, t) {
    return h('button', {
      type: 'button', class: 'timer-btn', 'aria-label': `Timer ${t.label} für Schritt ${stepIdx + 1} starten`,
      onclick: () => startTimer({ min: t.min, label: `Schritt ${stepIdx + 1} · ${rec.name}`, recipeId: rec.id }),
    }, icon('timer'), t.label);
  }

  function cookedLine(rec) {
    const wrap = h('p', { class: 'cooked-line' });
    const paint = () => {
      const l = cooked[rec.id] || [];
      wrap.replaceChildren(
        l.length ? h('span', null, `${plural(l.length, 'Mal', 'Mal')} gekocht, zuletzt am ${fmtDateShort.format(new Date(l[l.length - 1]))}.`) : h('span', null, 'Noch nicht gekocht.'),
        h('button', { type: 'button', class: 'link-btn', onclick: () => { markCooked(rec); paint(); } }, 'Heute gekocht'));
    };
    paint();
    return wrap;
  }
  function markCooked(rec) {
    const l = cooked[rec.id] || [];
    l.push(new Date().toISOString());
    cooked[rec.id] = l.slice(-50);
    local.set('gekocht', cooked);
    toast('Als gekocht markiert – guten Appetit!');
  }

  async function shareRecipe(rec) {
    const url = location.href.split('#')[0] + recipeHref(rec.id);
    if (navigator.share) {
      try { await navigator.share({ title: rec.name, text: rec.beschreibung || rec.name, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    if (await copyText(url)) toast('Link kopiert'); else showCopyDialog('Link zum Rezept', url);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* Fallback unten */ }
    const ta = h('textarea', { readonly: true, style: { position: 'fixed', top: '0', left: '0', opacity: '0', 'font-size': '16px' } });
    ta.value = text;
    document.body.append(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  function showCopyDialog(title, text) {
    const ta = h('textarea', { class: 'copy-area', readonly: true, 'aria-label': title });
    ta.value = text;
    openSheet({ title, body: [h('p', { class: 'muted' }, 'Automatisches Kopieren ist hier nicht möglich. Text lange antippen → „Alles auswählen“ → „Kopieren“.'), ta] });
    setTimeout(() => { ta.focus(); ta.select(); }, 50);
  }

  // ======================================================================
  // Einkaufsliste
  // ======================================================================

  const saveShop = () => { local.set('einkauf', shop); updateTabbar(); };
  function shopItemText(it) {
    if (it.qty == null) return it.name;
    const q = `${fmtQty(it.qty, it.unit)}${it.qty2 != null ? `–${fmtQty(it.qty2, it.unit)}` : ''}`;
    return `${q}${it.unit ? ' ' + unitFor(it.unit, it.qty2 ?? it.qty) : ''} ${it.name}`;
  }
  const shopKey = (p) => (p.qty != null ? `${fold(SINGULAR[p.unit] || p.unit)}|${fold(p.name)}` : `|${fold(p.name)}`);

  function addToShop(texts, source) {
    let added = 0;
    for (const text of texts) {
      const p = parseIngredient(text);
      const item = p.qty != null
        ? { qty: p.qty, qty2: p.qty2, unit: p.unit, name: p.name }
        : { qty: null, qty2: null, unit: '', name: text.trim() };
      if (!item.name) continue;
      const key = shopKey(item);
      const existing = shop.find((x) => !x.done && shopKey(x) === key);
      if (existing) {
        if (existing.qty != null && item.qty != null) {
          const hadRange = existing.qty2 != null || item.qty2 != null;
          const newQ2 = hadRange ? (existing.qty2 ?? existing.qty) + (item.qty2 ?? item.qty) : null;
          existing.qty += item.qty;
          existing.qty2 = newQ2;
        }
        if (source && !existing.from.includes(source)) existing.from.push(source);
      } else {
        shop.push({ id: uid(), ...item, aisle: aisleOf(item.name), from: source ? [source] : [], done: false });
      }
      added++;
    }
    saveShop();
    return added;
  }

  function openAddToShop(rec) {
    const factor = factorOf(rec);
    const rows = rec.zutaten.map((z) => ({ text: scaledText(z, factor), on: !isPantry(z) }));
    const btn = h('button', { type: 'button', class: 'btn btn-primary' });
    const paintBtn = () => { const n = rows.filter((r) => r.on).length; btn.textContent = n ? `${plural(n, 'Zutat', 'Zutaten')} hinzufügen` : 'Nichts ausgewählt'; btn.disabled = !n; };
    const list = h('ul', { class: 'checklist' }, rows.map((r) => {
      const { amount, name } = ingredientParts(r.text);
      return h('li', null, checkItem({ checked: r.on, onChange: (on) => { r.on = on; paintBtn(); }, content: [amount ? h('span', { class: 'amount' }, amount, ' ') : null, name] }));
    }));
    const p = getPortions(rec);
    const dlg = openSheet({
      title: 'Auf die Einkaufsliste',
      body: [h('p', { class: 'muted' }, `${rec.name}${p ? ` · für ${plural(p, 'Portion', 'Portionen')}` : ''}. Was du schon da hast, einfach abwählen.`), list],
      footer: [btn],
    });
    btn.addEventListener('click', () => {
      const n = addToShop(rows.filter((r) => r.on).map((r) => r.text), rec.name);
      dlg.close();
      toast(`${plural(n, 'Zutat', 'Zutaten')} auf der Liste`, { label: 'Ansehen', run: () => { location.hash = '#/einkauf'; } });
    });
    paintBtn();
  }

  function shopExportText() {
    const open = shop.filter((i) => !i.done);
    open.sort((a, b) => AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle));
    return open.map(shopItemText).join('\n');
  }

  function renderShop() {
    document.title = 'Einkaufsliste · Rezepte';
    const open = shop.filter((i) => !i.done);
    const done = shop.filter((i) => i.done);
    const focusId = document.activeElement?.closest?.('[data-item]')?.dataset.item;

    const input = h('input', { type: 'text', placeholder: 'Etwas hinzufügen …', 'aria-label': 'Eintrag hinzufügen', enterkeyhint: 'done', autocomplete: 'off' });
    const form = h('form', {
      class: 'shop-add', onsubmit: (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v) return;
        addToShop([v], '');
        renderShop();
        $('.shop-add input')?.focus();
      },
    }, input, h('button', { type: 'submit', class: 'btn btn-primary', 'aria-label': 'Hinzufügen' }, icon('plus')));

    const header = h('header', { class: 'topbar' },
      h('div', null, h('p', { class: 'eyebrow' }, open.length ? `${open.length} offen` : 'Alles erledigt'), h('h1', { tabindex: '-1' }, 'Einkaufsliste')));

    const kids = [header, form];

    if (!shop.length) {
      kids.push(stateView({ art: 'cart', title: 'Die Liste ist leer', text: 'Öffne ein Rezept und tippe auf „Einkaufsliste“ – oder trag oben selbst etwas ein.', actions: [h('a', { class: 'btn', href: '#/' }, 'Zu den Rezepten')] }));
    } else {
      // Offene Einträge nach Gang gruppiert
      for (const key of AISLE_ORDER) {
        const items = open.filter((i) => (i.aisle || 'sonst') === key);
        if (!items.length) continue;
        kids.push(h('section', { class: 'aisle', 'aria-label': AISLE_LABEL[key] },
          h('h2', null, AISLE_LABEL[key]),
          h('ul', { class: 'shop-list checklist' }, items.map(shopRow))));
      }
      if (done.length) {
        kids.push(h('details', { class: 'shop-done', open: !open.length },
          h('summary', null, icon('chevR'), `Erledigt (${done.length})`),
          h('ul', { class: 'shop-list checklist' }, done.map(shopRow))));
      }
      const canShare = !!navigator.share;
      kids.push(h('div', { class: 'shop-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', disabled: !open.length, onclick: copyShop }, icon('copy'), 'Kopieren'),
        canShare ? h('button', { type: 'button', class: 'btn', disabled: !open.length, onclick: shareShop }, icon('share'), 'Teilen') : h('button', { type: 'button', class: 'btn', disabled: !done.length, onclick: clearDone }, icon('check'), 'Erledigte weg'),
        canShare ? h('button', { type: 'button', class: 'btn', disabled: !done.length, onclick: clearDone }, icon('check'), 'Erledigte weg') : null,
        h('button', { type: 'button', class: `btn btn-ghost ${canShare ? '' : 'wide'}`, onclick: clearAll }, icon('trash'), 'Alles leeren')));
      kids.push(h('aside', { class: 'hint-card' },
        h('h3', null, 'Unterwegs abhaken (iPhone)'),
        h('p', null, 'Diese Liste liegt nur auf diesem Gerät. Für den Supermarkt:'),
        h('ol', null,
          h('li', null, '„Kopieren“ tippen'),
          h('li', null, 'In ', h('b', null, 'Erinnerungen'), ' eine Liste öffnen, neue Erinnerung anlegen und einfügen – jede Zeile wird ein eigener Punkt.'),
          h('li', null, 'Alternativ in ', h('b', null, 'Notizen'), ' einfügen, alles markieren und „Checkliste“ antippen.')),
        h('p', { style: { 'margin-top': '6px' } }, 'Beides synchronisiert per iCloud – abhaken klappt dann überall.')));
    }
    main.replaceChildren(...kids);
    if (focusId) $(`[data-item="${CSS.escape(focusId)}"] input`)?.focus({ preventScroll: true });
  }

  function shopRow(it) {
    return h('li', { class: 'shop-item', dataset: { item: it.id } },
      checkItem({
        checked: it.done,
        onChange: (on) => { it.done = on; saveShop(); setTimeout(renderShop, on ? 280 : 0); },
        content: (() => {
          const { amount, name } = it.qty != null ? ingredientParts(shopItemText(it)) : { amount: '', name: it.name };
          return [amount ? h('span', { class: 'amount' }, amount, ' ') : null, name, it.from?.length ? h('span', { class: 'from' }, it.from.join(', ')) : null];
        })(),
      }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${shopItemText(it)} entfernen`, onclick: () => removeShopItem(it) }, icon('close')));
  }
  function removeShopItem(it) {
    const idx = shop.indexOf(it);
    if (idx < 0) return;
    shop.splice(idx, 1);
    saveShop();
    renderShop();
    toast(`„${it.name}“ entfernt`, { label: 'Rückgängig', run: () => { shop.splice(Math.min(idx, shop.length), 0, it); saveShop(); if (S.route.name === 'shop') renderShop(); } });
  }
  async function copyShop() {
    const text = shopExportText();
    if (await copyText(text)) toast('Kopiert – jetzt in Erinnerungen oder Notizen einfügen');
    else showCopyDialog('Einkaufsliste', text);
  }
  async function shareShop() {
    try { await navigator.share({ title: 'Einkaufsliste', text: shopExportText() }); } catch (e) { if (!e || e.name !== 'AbortError') copyShop(); }
  }
  function clearDone() {
    const before = shop.slice();
    shop = shop.filter((i) => !i.done);
    saveShop();
    renderShop();
    toast('Erledigte entfernt', { label: 'Rückgängig', run: () => { shop = before; saveShop(); if (S.route.name === 'shop') renderShop(); } });
  }
  function clearAll() {
    if (!shop.length) return;
    const before = shop.slice();
    shop = [];
    saveShop();
    renderShop();
    toast('Liste geleert', { label: 'Rückgängig', run: () => { shop = before; saveShop(); if (S.route.name === 'shop') renderShop(); } });
  }

  // ======================================================================
  // Kochmodus
  // ======================================================================

  function renderCook(route) {
    const state = dataStateOrNull();
    if (state) { main.replaceChildren(state); return; }
    const rec = S.byId.get(route.id);
    if (!rec) { notFoundRecipe(); return; }
    document.title = `Kochen: ${rec.name}`;
    keepAwake(true);

    const N = rec.schritte.length;
    const last = N + 1; // 0 = Bereitstellen, 1..N = Schritte, N+1 = Fertig
    let idx = clamp(route.step || 0, 0, last);

    const stepLabel = h('p', null);
    const progressBar = h('span');
    const body = h('section', { class: 'cook-body', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const prevBtn = h('button', { type: 'button', class: 'btn prev', 'aria-label': 'Vorheriger Schritt', onclick: () => go(idx - 1) }, icon('chevL'));
    const nextBtn = h('button', { type: 'button', class: 'btn btn-primary next' }); // onclick wird in paint() gesetzt

    const view = h('div', { class: 'cook' },
      h('header', { class: 'cook-head' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Kochmodus beenden', onclick: () => navBack(recipeHref(rec.id)) }, icon('close')),
        h('div', { class: 'title' }, stepLabel, h('h1', { tabindex: '-1' }, rec.name)),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Zutaten anzeigen', onclick: () => openIngredientsSheet(rec) }, icon('list'))),
      h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Fortschritt', 'aria-valuemin': '0', 'aria-valuemax': String(last) }, progressBar),
      body,
      h('footer', { class: 'cook-foot' }, prevBtn, nextBtn));

    function go(i, dir) {
      const next = clamp(i, 0, last);
      if (next === idx) return;
      if (next > idx && idx >= 1 && idx <= N) setCheck(rec.id, 's', idx - 1, true); // Schritt beim Weitergehen abhaken
      const back = next < idx;
      idx = next;
      history.replaceState(null, '', recipeHref(rec.id, `/kochen/${idx}`));
      const top = S.navStack.length - 1;
      if (top >= 0) S.navStack[top] = location.hash;
      paint(dir ?? (back ? 'back' : 'fwd'));
    }

    function paint(dir) {
      $('.progress', view).setAttribute('aria-valuenow', String(idx));
      progressBar.style.width = `${(idx / last) * 100}%`;
      stepLabel.textContent = idx === 0 ? 'Vorbereitung' : idx === last ? 'Fertig' : `Schritt ${idx} von ${N}`;
      prevBtn.disabled = idx === 0;
      nextBtn.replaceChildren(...(idx === 0 ? ['Los geht’s', icon('chevR')] : idx === N ? ['Fertig', icon('check')] : idx === last ? ['Zurück zum Rezept'] : ['Weiter', icon('chevR')]));
      nextBtn.onclick = idx === last ? () => navBack(recipeHref(rec.id)) : () => go(idx + 1);

      body.classList.remove('anim', 'back');
      void body.offsetWidth;
      if (dir) body.classList.add('anim', dir === 'back' ? 'back' : 'fwd');
      body.scrollTop = 0;

      const content = idx === 0 ? cookPrep(rec) : idx === last ? cookDone(rec) : cookStep(rec, idx - 1);
      body.replaceChildren(...content.filter(Boolean));
    }

    // Tastatur & Wischen
    const onKey = (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select, dialog')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); if (idx < last) go(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'Escape' && !$('dialog[open]')) navBack(recipeHref(rec.id));
    };
    document.addEventListener('keydown', onKey);
    let sx = null, sy = null;
    body.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    body.addEventListener('touchend', (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      sx = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0 && idx < last) go(idx + 1); else if (dx > 0) go(idx - 1); }
    }, { passive: true });
    cleanups.push(() => document.removeEventListener('keydown', onKey));

    main.replaceChildren(view);
    paint(null);
  }

  function cookPrep(rec) {
    const tools = toolsOf(rec), vorab = vorabOf(rec);
    const factor = factorOf(rec);
    const p = getPortions(rec);
    return [
      h('p', { class: 'cook-step-no' }, icon('pot'), 'Bevor du loslegst'),
      h('h2', null, 'Alles bereit?'),
      h('p', { class: 'sub' }, `Erst rausstellen, dann entspannt kochen${p ? ` – für ${plural(p, 'Portion', 'Portionen')}` : ''}.`),
      vorab.length ? h('div', { class: 'cook-section' }, h('p', { class: 'prep-sub' }, 'Vorab erledigen'),
        h('div', { class: 'panel' }, h('ul', { class: 'checklist' }, vorab.map((v, i) => h('li', null, checkItem({ checked: isChecked(rec.id, 'v', i), onChange: (on) => setCheck(rec.id, 'v', i, on), content: v })))))) : null,
      tools.length ? h('div', { class: 'cook-section' }, h('p', { class: 'prep-sub' }, 'Rausholen'), h('ul', { class: 'prep-tools' }, tools.map((t) => h('li', { class: 'pill' }, t)))) : null,
      h('div', { class: 'cook-section' }, h('p', { class: 'prep-sub' }, 'Zutaten'),
        h('div', { class: 'panel' }, h('ul', { class: 'checklist' }, rec.zutaten.map((z, i) => {
          const { amount, name } = ingredientParts(z, factor);
          return h('li', null, checkItem({ checked: isChecked(rec.id, 'z', i), onChange: (on) => setCheck(rec.id, 'z', i, on), content: [amount ? h('span', { class: 'amount' }, amount, ' ') : null, name] }));
        })))),
      h('div', { class: 'cook-section' }, h('p', { class: 'prep-sub' }, 'Ablauf'), h('div', { class: 'panel' }, timeline(overviewOf(rec)))),
      wakeHint(),
    ];
  }

  function cookStep(rec, i) {
    const step = rec.schritte[i];
    const timersHere = stepTimers(step);
    const next = rec.schritte[i + 1];
    return [
      h('p', { class: 'cook-step-no' }, `Schritt ${i + 1}`),
      h('p', { class: 'cook-text' }, richText(step.text)),
      timersHere.length ? h('div', { class: 'cook-timers' }, timersHere.map((t) => timerButton(rec, i, t))) : null,
      next ? h('div', { class: 'next-up' }, h('b', null, 'Danach'), shortText(next.text)) : h('div', { class: 'next-up' }, h('b', null, 'Danach'), 'Das war der letzte Schritt.'),
      wakeHint(),
    ];
  }

  function cookDone(rec) {
    return [h('div', { class: 'cook-done' },
      h('p', { class: 'big', 'aria-hidden': 'true' }, '🍽️'),
      h('h2', null, 'Guten Appetit!'),
      h('p', { class: 'sub' }, `${rec.name} ist fertig.`),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: (e) => { markCooked(rec); e.currentTarget.disabled = true; e.currentTarget.textContent = 'Gespeichert ✓'; } }, icon('check'), 'Als gekocht markieren'),
      h('div', { style: { 'margin-top': '12px', display: 'flex', 'justify-content': 'center' } }, favButton(rec, 'solid')))];
  }

  function openIngredientsSheet(rec) {
    const factor = factorOf(rec);
    openSheet({
      title: 'Zutaten',
      body: h('ul', { class: 'checklist' }, rec.zutaten.map((z, i) => {
        const { amount, name } = ingredientParts(z, factor);
        return h('li', null, checkItem({ checked: isChecked(rec.id, 'z', i), onChange: (on) => setCheck(rec.id, 'z', i, on), content: [amount ? h('span', { class: 'amount' }, amount, ' ') : null, name] }));
      })),
    });
  }

  // Bildschirm anlassen
  let wakeLock = null;
  let wakeState = 'off'; // off | on | unsupported
  async function keepAwake(on) {
    try {
      if (on) {
        if (!('wakeLock' in navigator)) { wakeState = 'unsupported'; return; }
        if (wakeLock) return;
        wakeLock = await navigator.wakeLock.request('screen');
        wakeState = 'on';
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (wakeLock) {
        const l = wakeLock; wakeLock = null; wakeState = 'off';
        await l.release();
      }
    } catch { wakeState = 'unsupported'; }
  }
  function wakeHint() {
    if (wakeState === 'on') return h('p', { class: 'wake-hint' }, 'Bildschirm bleibt an, solange du kochst.');
    if (!window.isSecureContext || !('wakeLock' in navigator)) return h('p', { class: 'wake-hint' }, 'Tipp: Wischen oder Pfeiltasten blättern durch die Schritte.');
    return null;
  }

  // ======================================================================
  // Timer
  // ======================================================================

  let timers = local.get('timer', []);
  if (!Array.isArray(timers)) timers = [];
  let tickHandle = null;
  let audioCtx = null;
  let lastBeep = 0;
  const baseTitle = () => document.title.replace(/^⏰ /, '');

  const saveTimers = () => local.set('timer', timers);
  const remainingMs = (t) => (t.paused ? t.left : Math.max(0, t.endsAt - Date.now()));

  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const b = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = b; src.connect(audioCtx.destination); src.start(0);
    } catch { /* kein Audio */ }
  }
  function beep() {
    try {
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t0 = audioCtx.currentTime;
      [0, 0.32, 0.64].forEach((off, k) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = k === 2 ? 1046.5 : 880;
        g.gain.setValueAtTime(0.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.26);
        o.connect(g).connect(audioCtx.destination);
        o.start(t0 + off);
        o.stop(t0 + off + 0.3);
      });
    } catch { /* ignore */ }
    try { navigator.vibrate?.([300, 120, 300]); } catch { /* ignore */ }
  }

  function startTimer({ min, label, recipeId }) {
    unlockAudio();
    const ms = Math.round(min * 60000);
    timers.push({ id: uid(), label, recipeId, total: ms, endsAt: Date.now() + ms, left: ms, paused: false, done: false, doneAt: 0 });
    saveTimers();
    renderDock();
    ensureTick();
    toast(`Timer läuft: ${fmtClock(ms)}`);
  }
  function ensureTick() {
    if (timers.length && !tickHandle) tickHandle = setInterval(tick, 500);
    if (!timers.length && tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }
  function tick() {
    let changed = false;
    for (const t of timers) {
      if (!t.done && !t.paused && t.endsAt <= Date.now()) { t.done = true; t.doneAt = Date.now(); changed = true; }
    }
    if (changed) { saveTimers(); renderDock(); beep(); lastBeep = Date.now(); }
    const ringing = timers.filter((t) => t.done && Date.now() - t.doneAt < 120000);
    if (ringing.length && Date.now() - lastBeep > 2600) { beep(); lastBeep = Date.now(); }
    if (timers.some((t) => t.done)) { if (!document.title.startsWith('⏰')) document.title = `⏰ ${document.title}`; }
    else if (document.title.startsWith('⏰')) document.title = baseTitle();
    for (const el of $$('.timer-chip[data-id]')) {
      const t = timers.find((x) => x.id === el.dataset.id);
      const timeEl = el.querySelector('.t-time');
      if (t && timeEl && !t.done) timeEl.textContent = fmtClock(remainingMs(t));
    }
  }
  function removeTimer(id) {
    timers = timers.filter((t) => t.id !== id);
    saveTimers();
    renderDock();
    ensureTick();
    if (!timers.some((t) => t.done) && document.title.startsWith('⏰')) document.title = baseTitle();
  }
  function togglePause(id) {
    const t = timers.find((x) => x.id === id);
    if (!t || t.done) return;
    if (t.paused) { t.endsAt = Date.now() + t.left; t.paused = false; } else { t.left = remainingMs(t); t.paused = true; }
    unlockAudio();
    saveTimers();
    renderDock();
  }
  function renderDock() {
    const dock = $('#timer-dock');
    if (!timers.length) { dock.hidden = true; dock.replaceChildren(); return; }
    dock.hidden = false;
    dock.replaceChildren(...timers.map((t) => {
      if (t.done) {
        return h('div', { class: 'timer-chip done', dataset: { id: t.id }, role: 'alert' },
          h('div', { class: 't-main' }, h('p', { class: 't-label' }, t.label), h('p', { class: 't-time' }, 'Zeit ist um!')),
          h('button', { type: 'button', class: 'btn btn-small', onclick: () => removeTimer(t.id) }, 'OK'));
      }
      return h('div', { class: `timer-chip ${t.paused ? 'paused' : ''}`, dataset: { id: t.id } },
        h('div', { class: 't-main' }, h('p', { class: 't-label' }, t.label), h('p', { class: 't-time', 'aria-label': 'Restzeit' }, fmtClock(remainingMs(t)))),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': t.paused ? 'Timer fortsetzen' : 'Timer pausieren', onclick: () => togglePause(t.id) }, icon(t.paused ? 'play' : 'pause')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Timer abbrechen', onclick: () => removeTimer(t.id) }, icon('close')));
    }));
  }

  // ======================================================================
  // Start
  // ======================================================================

  async function init() {
    S.navStack = [location.hash || '#/'];
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return;
      tick();
      if (S.route.name === 'cook') keepAwake(true);
      if (Date.now() - S.lastLoad > 10 * 60 * 1000) {
        const before = S.recipes.length;
        await load();
        if (S.route.name === 'list' && S.recipes.length !== before) render();
      }
    });
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(PREFIX)) return;
      favs = new Set(local.get('favoriten', []));
      shop = local.get('einkauf', []);
      timers = local.get('timer', []);
      renderDock(); ensureTick(); updateTabbar();
    });

    render();
    await load();
    render({ nav: false });
    ensureTick();
    tick();

    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* optional */ });
    }
  }

  init();
})();

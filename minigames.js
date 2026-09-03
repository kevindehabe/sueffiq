'use strict';

const DRAW_PROMPTS = [
  'Bierflasche','Shotglas','Bierpong','Discokugel','DJ','Kater','Döner','Pizza','Taxi','Sonnenbrille',
  'High Heel','Badeente','Toilette','Kühlschrank','Karaoke','Mikrofon','Festival','Zelt','Campingstuhl','Pool',
  'Palme','Cocktail','Limette','Champagner','Konfetti','Luftballon','Geburtstagstorte','Partyhut','Selfie','Handy',
  'Powerbank','Kopfhörer','Lautsprecher','Gitarre','Trommel','Tanzfläche','Security','Türsteher','Polizei','Blitzer',
  'Fußball','Handball','Basketball','Pokal','Trikot','Schiedsrichter','Boxhandschuh','Hantel','Laufschuh','Fahrrad',
  'Auto','Cabrio','Motorrad','Flugzeug','Koffer','Reisepass','Hotel','Schlüssel','Aufzug','Balkon',
  'Strand','Sonnenschirm','Wassermelone','Ananas','Banane','Pommes','Burger','Hotdog','Eis','Kaffee',
  'Wecker','Bett','Sofa','Dusche','Zahnbürste','Waschmaschine','Staubsauger','Mülleimer','Kerze','Feuerzeug',
  'Rakete','Alien','Geist','Zombie','Vampir','Superheld','Krone','Diamant','Geldsack','Liebesbrief',
  'Herz','Kuss','Ring','Hochzeit','Baby','Hund','Katze','Hai','Pinguin','Einhorn',
  'Mario-Kart-Abend','Zu spät kommen','Katerfrühstück','Urlaubsflirt','Letzter Bus','Handy verloren','Tanzen auf dem Tisch','Falscher Chat','Peinliches Selfie','Nachts Döner holen'
];

// Reihenfolge ist gleichzeitig die Standardauswahl in der Lobby.
// Logo-Raten ist eine normale Spielkategorie und gehört deshalb nicht hier hinein.
const MINI_TYPES = ['zeichnen', 'allemalen', 'reaktion', 'taps', 'farbfolge', 'zeitgefuehl', 'pong', 'blackjack'];
const COLOR_NAMES = ['Lila', 'Grün', 'Orange', 'Blau'];

function randomSequence(length = 6) {
  return Array.from({ length }, () => Math.floor(Math.random() * 4));
}

function rankRows(entries, higherIsBetter = false) {
  return [...entries].sort((a, b) => {
    const d = higherIsBetter ? Number(b.value) - Number(a.value) : Number(a.value) - Number(b.value);
    return d || String(a.id).localeCompare(String(b.id));
  });
}

function gentleRankSips(rows) {
  const n = rows.length;
  if (!n) return {};
  const out = {};
  rows.forEach((row, index) => {
    const pct = n <= 1 ? 0 : index / (n - 1);
    out[row.id] = pct < 0.34 ? 0 : pct < 0.75 ? 1 : 2;
  });
  return out;
}

function reactionResults(map) {
  const falseStarts = [];
  const valid = [];
  for (const [id, item] of Object.entries(map || {})) {
    if (item && item.falseStart) falseStarts.push({ id, value: Number(item.ms) || 0, falseStart: true });
    else if (item && Number.isFinite(Number(item.ms))) valid.push({ id, value: Number(item.ms), falseStart: false });
  }
  const ranked = rankRows(valid, false);
  const sips = gentleRankSips(ranked);
  falseStarts.forEach((row) => { sips[row.id] = 2; });
  return { ranked: [...ranked, ...falseStarts], sips };
}

function tapResults(counts) {
  const rows = Object.entries(counts || {}).map(([id, value]) => ({ id, value: Number(value) || 0 }));
  const ranked = rankRows(rows, true);
  return { ranked, sips: gentleRankSips(ranked) };
}

function memoryResults(scores, length) {
  const rows = Object.entries(scores || {}).map(([id, item]) => ({
    id,
    value: Number(item && item.score) || 0,
    ms: Number(item && item.ms) || 0,
  })).sort((a, b) => b.value - a.value || a.ms - b.ms || a.id.localeCompare(b.id));
  const sips = {};
  rows.forEach((row) => {
    const missed = Math.max(0, Number(length) - row.value);
    sips[row.id] = missed === 0 ? 0 : missed <= 2 ? 1 : 2;
  });
  return { ranked: rows, sips };
}

function blindTimerResults(results, targetMs) {
  const target = Math.max(1, Number(targetMs) || 3000);
  const rows = Object.entries(results || {}).map(([id, item]) => {
    const raw = item && item.elapsed;
    const elapsed = Number.isFinite(Number(raw)) && raw !== null ? Math.max(0, Number(raw)) : null;
    return { id, elapsed, delta: elapsed === null ? Infinity : Math.abs(elapsed - target) };
  }).sort((a, b) => a.delta - b.delta || (a.elapsed ?? Infinity) - (b.elapsed ?? Infinity) || a.id.localeCompare(b.id));
  const valid = rows.filter((row) => Number.isFinite(row.delta));
  const rankedSips = gentleRankSips(valid.map((row) => ({ id: row.id, value: row.delta })));
  const sips = {};
  rows.forEach((row, index) => {
    if (!Number.isFinite(row.delta)) { sips[row.id] = 2; return; }
    if (index > 0 && row.delta === rows[index - 1].delta) sips[row.id] = sips[rows[index - 1].id];
    else sips[row.id] = rankedSips[row.id] || 0;
  });
  return { ranked: rows, sips };
}

module.exports = {
  DRAW_PROMPTS,
  MINI_TYPES,
  COLOR_NAMES,
  randomSequence,
  reactionResults,
  tapResults,
  memoryResults,
  blindTimerResults,
  gentleRankSips,
};

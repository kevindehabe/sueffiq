'use strict';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const balancedMax = (maxSips) => clamp(Number(maxSips) || 0, 0, 3);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Optimal-string-alignment distance: normal spelling errors plus one adjacent
// letter swap count as a single typo (e.g. "brintey" vs "britney").
function levenshtein(a, b) {
  a = normalizeText(a);
  b = normalizeText(b);
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) d[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) d[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (
        i > 1 && j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function similarity(a, b) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  const maxLen = Math.max(x.length, y.length);
  if (!maxLen) return 1;
  return 1 - levenshtein(x, y) / maxLen;
}

function acceptedPersonNames(person) {
  const source = [person.name, ...(person.aliases || [])];
  const result = new Set();
  for (const raw of source) {
    const n = normalizeText(raw);
    if (!n) continue;
    result.add(n);
    const parts = n.split(' ').filter((part) => part.length >= 3);
    for (const part of parts) result.add(part);
  }
  return [...result];
}

function matchPersonGuess(person, guess) {
  const normalizedGuess = normalizeText(guess);
  if (normalizedGuess.length < 2) return { status: 'wrong', score: 0 };
  const accepted = acceptedPersonNames(person);
  if (accepted.includes(normalizedGuess)) return { status: 'correct', score: 1 };

  let best = 0;
  for (const candidate of accepted) {
    const score = similarity(candidate, normalizedGuess);
    best = Math.max(best, score);
    if (
      normalizedGuess.length >= 4 &&
      candidate.length >= 4 &&
      (candidate.startsWith(normalizedGuess) || normalizedGuess.startsWith(candidate))
    ) {
      best = Math.max(best, 0.82);
    }
  }
  return { status: best >= 0.72 ? 'near' : 'wrong', score: best };
}

function voteSipMap(votes, maxSips = 5) {
  maxSips = balancedMax(maxSips);
  const counts = {};
  for (const target of Object.values(votes || {})) {
    if (!target) continue;
    counts[target] = (counts[target] || 0) + 1;
  }
  const sips = {};
  for (const [id, count] of Object.entries(counts)) sips[id] = clamp(count, 0, maxSips);
  return { counts, sips };
}

function estimateResults(guesses, correct, maxSips = 5) {
  maxSips = balancedMax(maxSips);
  const rows = Object.entries(guesses || {})
    .map(([id, guess]) => ({ id, guess: Number(guess), diff: Math.abs(Number(guess) - Number(correct)) }))
    .filter((row) => Number.isFinite(row.guess) && Number.isFinite(row.diff))
    .sort((a, b) => a.diff - b.diff || a.id.localeCompare(b.id));

  if (!rows.length) return [];
  const bestDiff = rows[0].diff;
  const distinctWorse = [...new Set(rows.filter((r) => r.diff > bestDiff).map((r) => r.diff))].sort((a, b) => a - b);
  const denominator = Math.max(1, distinctWorse.length);

  return rows.map((row) => {
    if (row.diff === bestDiff) return { ...row, sips: 0 };
    const tier = distinctWorse.indexOf(row.diff) + 1;
    const sips = clamp(Math.ceil((tier / denominator) * maxSips), 1, maxSips);
    return { ...row, sips };
  });
}

function binaryMinority(votes, maxSips = 3) {
  maxSips = balancedMax(maxSips);
  const values = Object.values(votes || {});
  const counts = new Map();
  values.forEach((v) => counts.set(String(v), (counts.get(String(v)) || 0) + 1));
  if (counts.size < 2) return { counts: Object.fromEntries(counts), sipsByPlayer: {} };
  const maxCount = Math.max(...counts.values());
  const minCount = Math.min(...counts.values());
  if (maxCount === minCount) return { counts: Object.fromEntries(counts), sipsByPlayer: {} };
  const strength = clamp(Math.ceil((maxCount / Math.max(1, values.length)) * maxSips), 1, maxSips);
  const sipsByPlayer = {};
  for (const [id, value] of Object.entries(votes || {})) {
    if ((counts.get(String(value)) || 0) === minCount) sipsByPlayer[id] = strength;
  }
  return { counts: Object.fromEntries(counts), sipsByPlayer };
}

function majorityResults(votes, maxSips = 5) {
  maxSips = balancedMax(maxSips);
  const values = Object.values(votes || {}).map(String);
  const counts = {};
  values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  const maxCount = Math.max(0, ...Object.values(counts));
  const winners = new Set(Object.keys(counts).filter((v) => counts[v] === maxCount));
  const sipsByPlayer = {};
  for (const [id, value] of Object.entries(votes || {})) {
    const count = counts[String(value)] || 0;
    if (!winners.has(String(value))) sipsByPlayer[id] = clamp(maxCount - count, 1, maxSips);
  }
  return { counts, winners: [...winners], sipsByPlayer };
}

function median(values) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function scaleResults(votes, maxSips = 5) {
  maxSips = balancedMax(maxSips);
  const center = median(Object.values(votes || {}));
  if (center === null) return { median: null, rows: [] };
  const rows = Object.entries(votes || {}).map(([id, value]) => {
    const n = Number(value);
    const diff = Math.abs(n - center);
    return { id, value: n, diff, sips: diff <= 1 ? 0 : clamp(Math.ceil(diff / 2), 1, maxSips) };
  });
  return { median: center, rows };
}

module.exports = {
  normalizeText,
  levenshtein,
  similarity,
  acceptedPersonNames,
  matchPersonGuess,
  voteSipMap,
  estimateResults,
  binaryMinority,
  majorityResults,
  median,
  scaleResults,
};

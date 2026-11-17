// Logika testu: výběr otázek, kontrola odpovědí, maskování nápovědy.

export function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Normalizace pro porovnání: malá písmena, jednotné mezery a pomlčky. */
export function normalize(s, { diacritics = true } = {}) {
  let t = s.toLowerCase().trim();
  t = t.replace(/[–—‑]/g, '-').replace(/[.,;:!?()"'’]/g, ' ').replace(/\s*\/\s*/g, '/');
  t = t.replace(/\s+/g, ' ').trim();
  if (!diacritics) t = stripDiacritics(t);
  return t;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const SIDE_WORDS = new Set([
  'pravý', 'pravá', 'pravé', 'levý', 'levá', 'levé', 'pravy', 'prava', 'prave', 'levy', 'leva', 'leve',
  'right', 'left', 'dexter', 'dextra', 'dextrum', 'sinister', 'sinistra', 'sinistrum', 'dx', 'sin',
]);
const removeSide = (s) => s.split(' ').filter((w) => !SIDE_WORDS.has(w)).join(' ');

/** Přijatelné odpovědi (bez strany) pro danou položku a jazyk. */
export function acceptedAnswers(entry, lang) {
  const list = [entry.base[lang], ...(entry.alt[lang] || [])].filter(Boolean);
  return [...new Set(list)];
}

/**
 * Vyhodnotí odpověď. Strana (pravá/levá) se nepožaduje, ale nevadí.
 * @returns {{result: 'correct'|'almost'|'wrong', expected: string}}
 *   almost = shoda bez diakritiky nebo drobný překlep
 */
export function checkAnswer(entry, lang, input, difficulty) {
  const expected = entry.base[lang];
  const raw = removeSide(normalize(input));
  if (!raw) return { result: 'wrong', expected };
  const answers = acceptedAnswers(entry, lang).map((a) => normalize(a));

  if (answers.includes(raw)) return { result: 'correct', expected };

  const r = stripDiacritics(raw);
  for (const a of answers.map(stripDiacritics)) {
    if (r === a) return { result: 'almost', expected };
    const tol = difficulty === 'easy' ? (a.length >= 6 ? 1 : 0) : a.length >= 14 ? 2 : a.length >= 6 ? 1 : 0;
    if (tol && levenshtein(r, a) <= tol) return { result: 'almost', expected };
  }
  return { result: 'wrong', expected };
}

/** Pro střední obtížnost: odhalí ~35 % písmen (minimálně první písmeno slova není garantováno). */
export function maskName(name, seed = Math.random) {
  const chars = [...name];
  const letterIdx = chars.map((c, i) => (/[\p{L}\p{N}]/u.test(c) ? i : -1)).filter((i) => i >= 0);
  const revealCount = Math.max(1, Math.round(letterIdx.length * 0.35));
  const shuffled = [...letterIdx].sort(() => seed() - 0.5);
  const reveal = new Set(shuffled.slice(0, revealCount));
  return chars.map((c, i) => ({ char: c, letter: /[\p{L}\p{N}]/u.test(c), shown: !/[\p{L}\p{N}]/u.test(c) || reveal.has(i) }));
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

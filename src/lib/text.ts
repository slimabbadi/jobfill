/**
 * Lowercase, spell out umlauts, drop accents and punctuation, collapse whitespace.
 * All matching runs on this form, so rules are written as "strasse", "waehlen", "fuer".
 */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "job_application[firstName]" -> "job application first name" */
export function splitIdentifier(s: string): string {
  return norm(s.replace(/([a-z])([A-Z])/g, '$1 $2'));
}

/** Collapse whitespace and strip required-field asterisks for display. */
export function cleanLabel(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s*\*+\s*$/, '').replace(/^\*+\s*/, '').trim();
}

const STOP = new Set(
  (
    'a an the of to you your are do does is in for and or please what this we our with on at be if any have will can would us me my i ' +
    'der die das und oder sie du ihr ihre deine dein ein eine einen bei mit fuer zu von an auf ist sind haben hast wie was bitte'
  ).split(' '),
);

function tokenSet(s: string): Set<string> {
  return new Set(norm(s).split(' ').filter((t) => t && !STOP.has(t)));
}

/** Jaccard similarity of meaningful words, 0..1. */
export function similarity(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

const PLACEHOLDER_OPTION =
  /^(select|choose|please select|please choose|pick|none selected|bitte (aus)?waehlen|auswaehlen|waehlen sie|waehle|bitte eine? auswahl)\b|^$|^-+$/;

export function isPlaceholderOption(text: string): boolean {
  return PLACEHOLDER_OPTION.test(norm(text));
}

/**
 * Pick the option that best represents `value`. When `matcher` is given (enum fields
 * such as veteran status), it wins over text similarity because option wording varies
 * wildly between employers. Returns -1 when nothing is a confident match.
 */
export function chooseOption(options: string[], value: string, matcher?: RegExp): number {
  const normed = options.map(norm);
  const candidates = normed
    .map((text, i) => ({ text, i }))
    .filter(({ text }) => !isPlaceholderOption(text));

  if (matcher) {
    const hit = candidates.find(({ text }) => matcher.test(text));
    if (hit) return hit.i;
  }

  const v = norm(value);
  if (!v) return -1;
  const exact = candidates.find(({ text }) => text === v);
  if (exact) return exact.i;
  const starts = candidates.find(({ text }) => text.startsWith(v + ' ') || v.startsWith(text + ' '));
  if (starts) return starts.i;
  if (v.length > 2) {
    const contains = candidates.find(({ text }) => text.includes(v));
    if (contains) return contains.i;
  }
  let best = -1;
  let bestScore = 0.6;
  for (const { text, i } of candidates) {
    const score = similarity(text, v);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

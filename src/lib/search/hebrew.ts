/**
 * Hebrew-aware text normalization for search.
 * Mirrors the SQL function `public.normalize_he` in supabase/migrations/0003_search.sql —
 * keep both in sync.
 */
const NIQQUD = /[֑-ׇ]/g; // cantillation + vowel points
const FINAL_LETTERS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
const PREFIXES = ["ו", "ה", "ב", "ל", "מ", "ש", "כ"];

export function normalizeHe(input: string): string {
  return input
    .toLowerCase()
    .replace(NIQQUD, "")
    .replace(/[״"׳'`\-_.]/g, " ")
    .replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c] ?? c)
    .replace(/\s+/g, " ")
    .trim();
}

/** Word variants: the word itself + the word with one leading Hebrew prefix letter removed. */
export function wordVariants(word: string): string[] {
  const out = [word];
  if (word.length > 3 && PREFIXES.includes(word[0])) out.push(word.slice(1));
  return out;
}

/** Character trigrams, used for typo-tolerant matching. */
function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  return set;
}

export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared || 1);
}

/**
 * Score how well a query matches a list of haystack strings (0 = no match).
 * Substring hits score highest, then per-word trigram similarity.
 */
export function matchScore(query: string, haystacks: string[]): number {
  const q = normalizeHe(query);
  if (!q) return 1;
  const hs = haystacks.map(normalizeHe);
  if (hs.some((h) => h.includes(q))) return 1;

  const qWords = q.split(" ");
  let total = 0;
  for (const qw of qWords) {
    let best = 0;
    for (const variant of wordVariants(qw)) {
      for (const h of hs) {
        if (h.includes(variant)) best = Math.max(best, 0.9);
        for (const hw of h.split(" ")) best = Math.max(best, similarity(variant, hw));
      }
    }
    total += best;
  }
  const score = total / qWords.length;
  return score >= 0.35 ? score : 0;
}

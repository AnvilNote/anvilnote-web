// Minimal subsequence fuzzy match (fzf-style): every character of `query`
// must appear in `target`, in order, case-insensitively — not necessarily
// contiguous. No ranking/scoring, just a filter predicate.
export function fuzzyMatch(query: string, target: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = target.toLowerCase();

  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

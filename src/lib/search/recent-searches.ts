export const RECENT_SEARCH_LIMIT = 5;

function searchIdentity(query: string): string {
  return query.normalize("NFKC").trim().toLocaleLowerCase();
}

export function addRecentSearch(
  searches: string[],
  query: string,
): string[] {
  const trimmed = query.trim();
  const identity = searchIdentity(trimmed);
  if (!identity) return searches;

  return [
    trimmed,
    ...searches.filter((item) => searchIdentity(item) !== identity),
  ].slice(0, RECENT_SEARCH_LIMIT);
}

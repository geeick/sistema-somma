function cleanListItem(value: string) {
  return value
    .trim()
    .replace(/^[\s"'{\x5B]+/, "")
    .replace(/[\s"'}\x5D]+$/, "")
    .trim();
}

/**
 * Normalizes arrays returned as JSON, PostgreSQL array literals, or CSV text.
 * It also cleans malformed array items such as "{instagram" and
 * "youtube_shorts}" so presentation code never exposes storage syntax.
 */
export function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map(cleanListItem)
      .filter(Boolean);
  }

  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return normalizeStringList(parsed);
  } catch {
    // The API can return PostgreSQL array literals, which are not valid JSON.
  }

  const withoutOuterBraces = trimmed.replace(/^\{(.*)\}$/, "$1");
  return withoutOuterBraces
    .split(",")
    .map(cleanListItem)
    .filter(Boolean);
}

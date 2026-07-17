/** Lightweight deterministic id for browser (aligned with server slice length). */
export function resolveBrowserEventId(parts: Array<string | number | undefined>): string {
  const source = parts
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter((part) => part.length > 0)
    .join("|");

  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  // Expand with a second pass for 32-char stability similar to server slice.
  let hash2 = 5381;
  for (let i = 0; i < source.length; i += 1) {
    hash2 = (hash2 * 33) ^ source.charCodeAt(i);
  }
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  return `${hex}${hex2}${hex}${hex2}`.slice(0, 32);
}

/** Short-window dedupe for storefront emits (form+fetch double fires, SPA re-entries). */
const recent = new Map<string, number>();
const DEFAULT_TTL_MS = 1500;

export function shouldEmitOnce(key: string, ttlMs = DEFAULT_TTL_MS): boolean {
  const now = Date.now();
  // Opportunistic cleanup
  if (recent.size > 200) {
    for (const [k, ts] of recent) {
      if (now - ts > ttlMs * 4) recent.delete(k);
    }
  }
  const prev = recent.get(key);
  if (prev != null && now - prev < ttlMs) return false;
  recent.set(key, now);
  return true;
}

/** Test helper */
export function resetEmitDedupeForTests(): void {
  recent.clear();
}

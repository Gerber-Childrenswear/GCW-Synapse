export class IdempotencyStore {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  isDuplicate(key: string): boolean {
    const now = Date.now();
    this.prune(now);

    const expiresAt = this.seen.get(key);
    if (!expiresAt) {
      return false;
    }

    if (expiresAt <= now) {
      this.seen.delete(key);
      return false;
    }

    return true;
  }

  markProcessed(key: string): void {
    this.prune(Date.now());
    this.seen.set(key, Date.now() + this.ttlMs);
  }

  private prune(now: number): void {
    for (const [key, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) {
        this.seen.delete(key);
      }
    }
  }
}

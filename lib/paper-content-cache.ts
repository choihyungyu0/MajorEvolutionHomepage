export const PAPER_CONTENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const PAPER_CONTENT_NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1_000;

type CacheOptions = {
  now?: () => number;
  maxEntries?: number;
};

export function createPaperContentCache<T>({
  now = Date.now,
  maxEntries = 500,
}: CacheOptions = {}) {
  const values = new Map<string, { value: T; expiresAt: number }>();
  return {
    get(key: string): T | undefined {
      const entry = values.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        values.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T, ttlMs = PAPER_CONTENT_CACHE_TTL_MS): void {
      if (values.size >= maxEntries && !values.has(key)) {
        const oldestKey = values.keys().next().value;
        if (typeof oldestKey === "string") values.delete(oldestKey);
      }
      values.set(key, { value, expiresAt: now() + Math.max(1, ttlMs) });
    },
  };
}

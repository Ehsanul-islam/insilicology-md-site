import { unstable_cache } from "next/cache";

export const CACHE_SECONDS = 3600;

/**
 * Cache a public database read. Entries are tagged so an approval (see /api/revalidate) can drop them
 * at once; otherwise they refresh hourly. Arguments become part of the cache key.
 */
export function cachedRead<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, tags: string[]) {
  return unstable_cache(fn, [key], { revalidate: CACHE_SECONDS, tags });
}

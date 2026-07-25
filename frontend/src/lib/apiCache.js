// Session-lived TTL cache for API reads. Module scope means entries survive
// route unmounts (leaving Step 7 and coming back renders instantly from cache)
// but reset on a full page reload — the freshness/latency tradeoff a
// monitoring dashboard wants. Not for writes, and not for anything that must
// be visible across tabs.
const store = new Map()

export async function cachedFetch(key, ttlMs, fetcher) {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data
  const data = await fetcher()
  store.set(key, { at: Date.now(), data })
  return data
}

// Drop one entry so the next cachedFetch refetches — used by manual refresh
// buttons, which exist precisely to bypass the cache.
export function invalidate(key) {
  store.delete(key)
}

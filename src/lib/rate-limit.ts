type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as unknown as { __rateLimitBuckets?: Map<string, Bucket> };

function buckets() {
  if (!globalStore.__rateLimitBuckets) globalStore.__rateLimitBuckets = new Map();
  return globalStore.__rateLimitBuckets;
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const store = buckets();
  if (store.size > 5000) {
    for (const [name, bucket] of store) if (bucket.resetAt <= now) store.delete(name);
  }
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1, retryAfter: 0 };
  }
  if (current.count >= limit) {
    return {
      ok: false as const,
      remaining: 0,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }
  current.count += 1;
  return { ok: true as const, remaining: limit - current.count, retryAfter: 0 };
}

export function clientIp(request: Request) {
  // Platform-provided headers are trusted; x-forwarded-for is a last resort.
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

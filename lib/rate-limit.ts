// lib/rate-limit.ts
// Lekki limiter zapytań (sliding window) w pamięci procesu Node.js.
// Chroni wrażliwe endpointy API (upload plików, formularze, edycję pinów)
// przed nadużyciami bez konieczności utrzymywania zewnętrznego Redisa.

export interface RateLimitOptions {
  /** Maksymalna liczba żądań w zadanym oknie czasowym. */
  limit: number;
  /** Długość okna czasowego w milisekundach. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  timestamps: number[];
  expiresAt: number;
}

const buckets = new Map<string, Bucket>();

// Okresowe czyszczenie wygasłych wpisów, aby mapa nie rosła w pamięci RAM
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.expiresAt <= now) {
      buckets.delete(key);
    }
  }
}

/**
 * Sprawdza i rejestruje pojedyncze wywołanie dla klucza `key` (np. `upload:${userId}`).
 */
export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now = Date.now(),
): RateLimitResult {
  cleanupExpired(now);

  const windowStart = now - windowMs;
  const existing = buckets.get(key);
  const validTimestamps = existing
    ? existing.timestamps.filter((ts) => ts > windowStart)
    : [];

  if (validTimestamps.length >= limit) {
    const oldestInWindow = validTimestamps[0];
    const retryAfterMs = Math.max(1000, oldestInWindow + windowMs - now);
    buckets.set(key, {
      timestamps: validTimestamps,
      expiresAt: now + windowMs,
    });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  validTimestamps.push(now);
  buckets.set(key, {
    timestamps: validTimestamps,
    expiresAt: now + windowMs,
  });

  return {
    allowed: true,
    remaining: Math.max(0, limit - validTimestamps.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Pomocnicza funkcja odczytująca adres IP klienta z nagłówków proxy (Cloudflare / Render).
 */
export function getClientIp(request: Request): string {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp.trim();

  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return "unknown";
}

/** Czyści stan limitera (przydatne w testach jednostkowych). */
export function resetRateLimitStore(): void {
  buckets.clear();
}


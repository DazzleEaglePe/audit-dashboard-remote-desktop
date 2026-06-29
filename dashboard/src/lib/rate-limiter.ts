// src/lib/rate-limiter.ts
interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitInfo>();

/**
 * Basic in-memory rate limiter
 * @param key Identifier for the user (e.g. IP address or username)
 * @param limit Maximum number of requests allowed within the window
 * @param windowMs Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
export function rateLimit(key: string, limit: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const info = store.get(key);

  if (!info) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  // If the window has passed, reset
  if (now > info.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  // Still within the window, check the count
  if (info.count >= limit) {
    return false; // Rate limited
  }

  // Increment the count
  info.count += 1;
  return true;
}

// Cleanup function to avoid memory leaks over time
setInterval(() => {
  const now = Date.now();
  store.forEach((info, key) => {
    if (now > info.resetTime) {
      store.delete(key);
    }
  });
}, 60000); // Clean up every minute

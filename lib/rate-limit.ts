// A small counter. It says whether a key (for example a visitor) has already
// used all its places in the last while. It keeps its numbers in the memory of
// the running server only. Nothing is written to disk, and a restart starts
// again from zero.

export type RateLimiterOptions = {
  // How many places one key may use inside the window.
  limit: number;
  // How long a used place counts, in milliseconds.
  windowMs: number;
  // How many keys are remembered at most. The ones not used for the longest
  // time are forgotten first, so the memory can never grow without end.
  maxKeys: number;
};

// A place that was used. Calling refund gives it back, but only once.
export type Permit = { refund: () => void };

export type TakeResult =
  | { ok: true; permit: Permit }
  | { ok: false; retryAfterMs: number };

export type RateLimiter = {
  take: (key: string, now: Date) => TakeResult;
  // How many keys are remembered right now.
  remembered: () => number;
};

function wholeNumber(name: string, value: number): void {
  if (Number.isInteger(value) === false || value < 1) {
    throw new RangeError(`${name} must be a whole number of at least 1.`);
  }
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs, maxKeys } = options;
  wholeNumber("limit", limit);
  wholeNumber("windowMs", windowMs);
  wholeNumber("maxKeys", maxKeys);

  // For each key: the moments (in milliseconds) of the places that still count,
  // the oldest first. The keys are kept in the order of their last use.
  const entries = new Map<string, number[]>();

  // A key whose newest place is a full window old has nothing left to count.
  function forgetOld(at: number): void {
    for (const [key, moments] of entries) {
      if (moments[moments.length - 1] <= at - windowMs) entries.delete(key);
    }
  }

  function makeRoom(at: number): void {
    if (entries.size <= maxKeys) return;
    forgetOld(at);
    while (entries.size > maxKeys) {
      const first = entries.keys().next();
      if (first.done) return;
      entries.delete(first.value);
    }
  }

  function take(key: string, now: Date): TakeResult {
    const at = now.getTime();
    const counted = (entries.get(key) ?? []).filter(
      (moment) => moment > at - windowMs,
    );
    if (counted.length >= limit) {
      // Asking again while blocked does not make the wait any longer.
      entries.delete(key);
      entries.set(key, counted);
      // A clock that jumped back must not promise a wait longer than the window.
      const wait = counted[0] + windowMs - at;
      return { ok: false, retryAfterMs: Math.min(windowMs, wait) };
    }
    counted.push(at);
    counted.sort((a, b) => a - b);
    entries.delete(key);
    entries.set(key, counted);
    makeRoom(at);

    let given = false;
    function refund(): void {
      if (given) return;
      given = true;
      const current = entries.get(key);
      if (current === undefined) return;
      const index = current.indexOf(at);
      if (index < 0) return;
      current.splice(index, 1);
      if (current.length === 0) entries.delete(key);
    }
    return { ok: true, permit: { refund } };
  }

  return { take, remembered: () => entries.size };
}

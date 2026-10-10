/**
 * Per-provider circuit breaker for the LLM generation waterfall.
 *
 * ── The problem this solves ────────────────────────────────────────────────
 * The waterfall is sequential: Gemini, then Groq-1, then Groq-2. When the
 * primary is healthy the cost is one fast call. But when it is *slow* rather
 * than *failing* — the observed case, where Gemini took 32-104 s to answer
 * "what is the capital of France" — every single request still pays the full
 * first-provider timeout before falling through to a fallback that would have
 * answered in about a second.
 *
 * A timeout that always costs the same is indistinguishable from no timeout
 * at all. Measured on the live system: 15-17 s per request, essentially all
 * of it spent waiting on a provider that was never going to answer in time.
 *
 * ── The fix ────────────────────────────────────────────────────────────────
 * Track consecutive failures per provider. After `failureThreshold`
 * consecutive failures the circuit opens and that provider is skipped
 * entirely for `cooldownMs`. Once the cooldown expires a single probe request
 * is allowed through (half-open) to test whether it has recovered.
 *
 * This keeps the existing priority order intact when things work, and removes
 * the penalty entirely when they don't: one request pays the timeout, and
 * every subsequent request goes straight to the healthy provider.
 *
 * ── Scope ──────────────────────────────────────────────────────────────────
 * Process-local. That is correct for a single-instance deployment and is the
 * common case here. Behind multiple instances each one learns independently,
 * which is acceptable — the worst case is a few extra timeouts per instance
 * after a provider recovers.
 */

export type ProviderState = "closed" | "open" | "half-open";

interface Circuit {
  state: ProviderState;
  /** Consecutive failures since the last success. */
  failures: number;
  /** Timestamp (ms) at which an open circuit may be probed again. */
  openedAt: number;
}

/** Failures needed to trip the breaker. 2 so one blip doesn't do it. */
const FAILURE_THRESHOLD = 2;

/**
 * How long a tripped provider is skipped.
 * 30 s: long enough to ride out a rate-limit window, short enough that a
 * recovered provider is picked up quickly without a manual restart.
 */
const COOLDOWN_MS = 30_000;

/**
 * A "successful" call slower than this is treated as a FAILURE.
 *
 * The dominant real-world failure mode here is not an error — it is a
 * provider that answers correctly but takes many seconds. Recording that as a
 * success resets the failure count and hands the primary slot straight back to
 * the slow provider, so the next request pays the same penalty again.
 *
 * Measured: a healthy fallback answers in 1-2 s, and the degraded primary was
 * taking 15 s+ to first token. 6 s cleanly separates those.
 */
const SLOW_CALL_MS = 6_000;

const circuits = new Map<string, Circuit>();

function getCircuit(name: string): Circuit {
  let c = circuits.get(name);
  if (!c) {
    c = { state: "closed", failures: 0, openedAt: 0 };
    circuits.set(name, c);
  }
  return c;
}

/**
 * Returns true if this provider should be attempted right now.
 *
 * Side effect: moving an expired `open` circuit to `half-open` and reserving
 * the probe slot, so N concurrent requests don't all probe at once — only the
 * first gets through and the rest keep skipping until it reports back.
 */
export function isProviderUsable(name: string): boolean {
  const c = getCircuit(name);

  if (c.state === "closed") return true;

  if (c.state === "open") {
    if (Date.now() - c.openedAt >= COOLDOWN_MS) {
      c.state = "half-open";
      return true; // this caller owns the probe
    }
    return false;
  }

  // half-open: a probe is already in flight, let it decide.
  return false;
}

/**
 * Records a successful call, closing the circuit.
 *
 * A call that "succeeded" but took longer than SLOW_CALL_MS is counted as a
 * failure instead — see the note on that constant. This is what keeps a
 * technically-working but unusably-slow provider from reclaiming the primary
 * slot on every request.
 */
export function recordProviderSuccess(name: string, durationMs?: number): void {
  if (durationMs !== undefined && durationMs > SLOW_CALL_MS) {
    recordProviderFailure(name);
    return;
  }

  const c = getCircuit(name);
  c.state = "closed";
  c.failures = 0;
}

/**
 * Records a failure. Trips the breaker once `FAILURE_THRESHOLD`
 * consecutive failures have accumulated.
 */
export function recordProviderFailure(name: string): void {
  const c = getCircuit(name);
  c.failures++;

  if (c.state === "half-open") {
    // The probe failed — straight back to open, with a fresh cooldown.
    c.state = "open";
    c.openedAt = Date.now();
    return;
  }

  if (c.failures >= FAILURE_THRESHOLD) {
    c.state = "open";
    c.openedAt = Date.now();
  }
}

/** Current state, for logging and tests. */
export function getProviderState(name: string): ProviderState {
  return getCircuit(name).state;
}

/** Clears every circuit. Test seam. */
export function resetCircuits(): void {
  circuits.clear();
}

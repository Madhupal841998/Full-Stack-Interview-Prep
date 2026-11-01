# Phase 13 — Error Handling and Resilience

This phase is about keeping a backend system correct and available when
things go wrong — because in production, things always go wrong: networks
drop packets, databases time out, dependencies go down, and code has bugs.
Resilience engineering is not about preventing every failure; it is about
containing failure so it doesn't cascade into a full outage.

Each topic below follows the standard learning order: definition, simple
meaning, why it's needed, internals, syntax/API, example, real backend
usage, edge cases, common mistakes, interview answer, practice problem, and
production considerations.

------------------------------------------------------------------------

## 13.1 Operational vs Programmer Errors, Error Classification, Centralized Error Handling, Typed Errors

**Definition:** An *operational error* is a known, expected failure mode
of a correctly written program (a database is unreachable, a user sends
invalid input, a file doesn't exist). A *programmer error* is a bug — a
null pointer access, a broken invariant, calling a function with the wrong
type. **Error classification** is the practice of tagging errors by cause
(validation, auth, not-found, downstream-timeout, internal) so callers and
monitoring systems can react appropriately. **Centralized error handling**
means every error funnels through one place (e.g., one Express error
middleware) that decides the response shape, status code, and logging,
instead of every route handling errors differently. **Typed errors** are
custom error classes/subclasses (or a `Result`/`Either` type) that carry
structured metadata instead of a bare string message.

**Simple meaning:** Operational errors are "the system said no, and that's
expected." Programmer errors are "the code is wrong." Classification is
sorting errors into buckets. Centralizing means one funnel, one format.
Typed errors mean `error.code` and `error.statusCode`, not `error.message`
guessing games.

**Why it's needed:** Without classification, every error looks the same to
your alerting and to your client — a 500 for a typo in a request body looks
identical to a 500 for a crashed database, which makes triage slow and
noisy. Programmer errors generally should crash the process (fail fast,
restart), because the process is in an unknown state; operational errors
should be caught and handled gracefully, because they're expected and
recoverable.

**How it works internally:** Centralized handling relies on a framework's
error propagation mechanism — in Express, calling `next(err)` from any
middleware routes the error to a final error-handling middleware
`(err, req, res, next)`. In async code, every `await` that can reject must
be wrapped (or caught by a global `unhandledRejection` handler as a
last-resort safety net, not a primary strategy). Typed errors work through
class inheritance: a base `AppError` class carries `statusCode`,
`errorCode`, `isOperational`, and subclasses like `NotFoundError`,
`ValidationError` set sensible defaults.

**Syntax and API (example in TypeScript/Node.js):**

```typescript
class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public errorCode: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

class ValidationError extends AppError {
  constructor(details: { field: string; reason: string }[]) {
    super("Invalid request", 400, "VALIDATION_ERROR");
    this.details = details;
  }
  details: { field: string; reason: string }[];
}
```

**Centralized error middleware:**

```typescript
function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.errorCode, message: err.message, requestId: req.id },
    });
  }
  // Unknown / programmer error — log full detail, hide internals from client
  logger.error("Unhandled error", { err, requestId: req.id });
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong", requestId: req.id },
  });
}
```

**Small example:** A route that looks up a user by ID throws
`new NotFoundError("User")` when the row doesn't exist. The centralized
handler catches it, sees `isOperational: true`, and returns a clean 404
JSON body — no stack trace leaked, no crash.

**Real backend usage:** Every production API uses this pattern: controllers
throw typed errors, services never touch `res` directly, and one error
middleware (or one `try/catch` wrapper around the whole request lifecycle
in non-Express frameworks) is the single place that maps errors to HTTP
responses and logs.

**Edge cases:** Errors thrown inside asynchronous callbacks (e.g., inside
`setTimeout`, or inside a stream's `data` event) do **not** propagate to
Express's error handling automatically — they must be caught explicitly and
passed to `next(err)`. Errors thrown during error handling itself (a bug in
the error handler) need a final safety net. Third-party library errors
often aren't typed the way you'd like — wrap and re-throw as your own typed
error at the boundary where you call the library.

**Common mistakes:** Treating every error as a 500. Leaking stack traces or
internal messages to clients. Using `isOperational` incorrectly and
crashing on expected errors (or worse, swallowing programmer errors and
continuing in a corrupted state). Catching an error just to `console.log`
it and continue, hiding the failure from monitoring.

**Interview answer:** "I distinguish operational errors — expected
failures like a 404 or invalid input — from programmer errors, which are
bugs. Operational errors are caught and returned as clean, typed responses;
programmer errors are logged with full context and the process is allowed
to fail fast rather than continue in an unknown state. I centralize this
through one error-handling layer so response shape and logging are
consistent everywhere."

**Practice problem:** Build an `AppError` hierarchy with at least five
subclasses (`NotFoundError`, `ValidationError`, `UnauthorizedError`,
`ConflictError`, `RateLimitError`), wire them into one Express error
middleware, and write tests asserting the correct status code and error
code for each.

**Production considerations:** Include a `requestId`/correlation ID in
every error response so a client-reported error can be traced to server
logs. Never expose stack traces or SQL/query details in production
responses. Decide and document a policy: does a programmer error crash the
process (recommended, with a process manager restarting it), or does it
get caught and the request just returns a 500? Log operational errors at a
lower severity than programmer errors so alerting isn't drowned in noise.

------------------------------------------------------------------------

## 13.2 Timeouts

**Definition:** A timeout is an upper bound on how long a system will wait
for an operation — a network call, a database query, a lock acquisition —
before giving up and treating it as a failure.

**Simple meaning:** "Don't wait forever." If a dependency doesn't respond
in a reasonable time, stop waiting and handle it as an error.

**Why it's needed:** Without timeouts, a single slow or hung dependency can
tie up all available connections/threads/event-loop capacity in the
calling service, exhausting resources and taking down services that
depend on it too — a classic cause of cascading outages.

**How it works internally:** In Node.js, timeouts on outbound HTTP calls
are implemented with `AbortController`, which signals an in-flight
`fetch`/HTTP request to abort; the underlying socket is destroyed and the
promise rejects. Database drivers expose their own `statement_timeout` /
`connectionTimeoutMillis` settings that the driver enforces at the
protocol or socket level. A timeout does **not** guarantee the remote
operation stopped — it only guarantees your process stopped waiting; the
database might still finish the write after you've already timed out
(important for idempotency).

**Syntax and API:**

```typescript
async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

**Small example:** Calling a payment provider's API with a 3-second
timeout; if it doesn't respond in time, the request is aborted and the
caller treats it as "unknown outcome," not "failed" — because the payment
might still have gone through server-side.

**Real backend usage:** Every outbound call in a backend — HTTP calls to
other services, database queries, cache lookups, message broker
publishes — should have an explicit timeout tuned to that dependency's
expected latency (e.g., p99 + margin), not left at the client library's
default (which is often "no timeout" or an unreasonably long one).

**Edge cases:** A timeout that's too aggressive causes false failures
under normal load spikes; too generous, and it doesn't protect you.
Timeouts must be layered — an inner call's timeout should be shorter than
the outer request's overall deadline, or the outer request times out
first without the inner call ever getting a chance to fail cleanly.
Timing out a *write* operation is dangerous: the write may have succeeded
downstream even though your client gave up.

**Common mistakes:** Setting timeouts only on the outermost HTTP framework
and assuming that protects internal calls. Using the same fixed timeout
for every dependency regardless of its normal latency profile. Not
distinguishing "timed out" from "failed" when deciding whether a retry is
safe.

**Interview answer:** "Every network call I make has an explicit timeout
tuned to that dependency's expected latency, because an unbounded wait on
one slow dependency can exhaust connections and cascade into an outage
across the system. I treat a timeout as 'unknown outcome' for writes, not
as a confirmed failure, because the operation might have completed on the
other side."

**Practice problem:** Wrap an HTTP client so every call has a configurable
timeout, write a test using a mock server that delays its response, and
verify the call aborts and rejects at the configured time, not the
server's actual response time.

**Production considerations:** Track timeout rate as its own metric,
separate from error rate — a spike in timeouts (versus explicit errors)
usually points to a downstream capacity or network problem. Set database
statement timeouts server-side too, not just client-side, so a runaway
query can't hold a lock indefinitely even if the client gave up.

------------------------------------------------------------------------

## 13.3 Retries, Exponential Backoff, and Jitter

**Definition:** A retry re-attempts a failed operation. **Exponential
backoff** increases the wait time between retries exponentially (e.g., 1s,
2s, 4s, 8s) instead of retrying immediately. **Jitter** adds randomness to
that wait time to prevent many clients from retrying in synchronized
waves.

**Simple meaning:** If something fails, try again — but wait longer each
time, and don't let everyone retry at exactly the same moment.

**Why it's needed:** Transient failures (a brief network blip, a momentary
overload) often succeed on retry. But retrying immediately and
aggressively during an outage makes it worse — a "retry storm" where every
client hammers a struggling service at once, delaying its recovery.
Backoff spaces requests out; jitter prevents the synchronized-wave problem
(thundering herd).

**How it works internally:** A backoff function computes
`delay = min(baseDelay * 2^attempt, maxDelay)`, then jitter multiplies or
offsets that by a random factor. "Full jitter" (`random(0, delay)`) is
generally preferred over "equal jitter" because it spreads retries more
evenly and reduces the total load on the recovering service.

**Syntax and API:**

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  { maxAttempts = 5, baseDelayMs = 200, maxDelayMs = 10000 } = {}
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      const exp = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const delay = Math.random() * exp; // full jitter
      await sleep(delay);
    }
  }
}
```

**Small example:** A call to a downstream inventory service fails with a
503. The client retries after ~200ms, then ~400–800ms (jittered), then
~800ms–1.6s, up to a cap — instead of retrying instantly three times in a
row.

**Real backend usage:** Message queue consumers, HTTP clients calling
other microservices, and database reconnect logic all use backoff-with-
jitter as the default retry strategy rather than fixed-interval retries.

**Edge cases:** Retrying a non-idempotent operation (e.g., "charge this
card," "send this email") can duplicate side effects if the first attempt
actually succeeded but the response was lost — this is why retries must be
paired with idempotency keys (see the important rule below). Retrying
every error type is wrong: a 400 (bad request) will never succeed on
retry, only 5xx/timeout/network errors are generally retryable.

**Common mistakes:** Retrying without backoff (hammering a struggling
service). Retrying without jitter (synchronized retry storms). Retrying
non-idempotent writes without an idempotency key. Retrying indefinitely
with no max-attempts cap, hiding a permanent failure behind endless
retries.

**Interview answer:** "I retry only errors classified as transient — not
validation or auth errors — using exponential backoff with jitter, capped
at a small number of attempts, and only when the operation is idempotent
or protected by an idempotency key. Blind retries without backoff can
turn a brief blip into a full outage by overwhelming a recovering
service."

**Practice problem:** Build a retry helper with configurable
max attempts, base delay, and jitter strategy; simulate a flaky
dependency that fails the first N times then succeeds, and verify the
helper succeeds within the attempt budget and the delays follow the
expected exponential curve.

**Production considerations:** Cap total retry time against the caller's
own deadline — retries shouldn't make a request take longer than the
client is willing to wait. Emit a metric for retry count per request so
you can see when a dependency is degrading before it fully fails. Combine
retries with a circuit breaker so retries stop entirely once a dependency
is confirmed down, rather than continuing to retry a dead service.

> **Important rule:** Never retry blindly. Retries must consider
> idempotency, error type, timeout, and system capacity.

------------------------------------------------------------------------

## 13.4 Circuit Breakers

**Definition:** A circuit breaker is a stateful guard in front of a
dependency call that stops sending requests to a dependency once failures
cross a threshold, giving it time to recover, and periodically tests
whether it has recovered before resuming normal traffic.

**Simple meaning:** Like an electrical circuit breaker — if something's
clearly broken, stop sending current (requests) to it for a while instead
of continuing to hammer it.

**Why it's needed:** Without a circuit breaker, retries keep hitting a
failing dependency, wasting resources on both sides, adding latency to
every caller (each still has to wait out its timeout), and delaying the
failing service's recovery. A breaker fails fast instead, protecting both
the caller and the callee.

**How it works internally:** Three states — **Closed** (normal, requests
flow through, failures are counted), **Open** (failure threshold exceeded,
requests are rejected immediately without calling the dependency, error
returned instantly), and **Half-Open** (after a cooldown period, a limited
number of test requests are allowed through; if they succeed, the breaker
closes again, if they fail, it reopens). The threshold is usually
computed over a rolling window (e.g., "50% failure rate over the last 20
requests") rather than a simple consecutive-failure count, to avoid
flapping.

**Syntax and API (simplified state machine):**

```typescript
type State = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  private state: State = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;

  constructor(
    private threshold = 5,
    private cooldownMs = 30000
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = "HALF_OPEN";
      } else {
        throw new AppError("Service unavailable", 503, "CIRCUIT_OPEN");
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) this.state = "OPEN";
  }
}
```

**Small example:** A recommendation service calls a third-party ML
scoring API. After five consecutive failures, the breaker opens; for the
next 30 seconds, calls fail instantly with a fallback response instead of
waiting out a timeout on every request. After 30 seconds, one test request
is let through — if it succeeds, normal traffic resumes.

**Real backend usage:** Circuit breakers sit in front of any external
dependency call — third-party APIs, internal microservices, sometimes even
database calls — usually implemented via a library (e.g., `opossum` in
Node.js) rather than hand-rolled, wired with metrics and alerting on state
transitions.

**Edge cases:** A breaker per-dependency is correct; a single global
breaker for "all outbound calls" is wrong, since one dead dependency
shouldn't block calls to healthy ones. Under low traffic, the rolling
window may take a long time to detect failures — some implementations use
a minimum request count before evaluating the threshold. Half-open state
needs care: letting too many test requests through at once can re-trigger
the original overload.

**Common mistakes:** Combining retries and a circuit breaker in a way
that retries happen *inside* the breaker's failure count, distorting the
threshold. Not adding a fallback behind the breaker (the breaker just
becomes "fail fast with an error," which is better than nothing but
misses the opportunity for graceful degradation). Forgetting to alert on
breaker state changes, so an open breaker goes unnoticed.

**Interview answer:** "A circuit breaker tracks failure rate for a
dependency and, once it crosses a threshold, stops calling that dependency
for a cooldown period, failing fast instead. This protects the caller from
wasting time on a dependency that's known to be down, and gives the
dependency room to recover instead of being hammered by continued
traffic. After the cooldown, it lets a small number of test requests
through to check if the dependency has recovered before resuming full
traffic."

**Practice problem:** Implement the three-state breaker above, write
tests that push it from closed → open (via repeated failures), verify it
rejects immediately while open, then verify it transitions to half-open
after the cooldown and closes again on a successful test call.

**Production considerations:** Expose breaker state as a metric/dashboard
per dependency. Tune the threshold and cooldown per dependency based on
its normal failure rate and recovery characteristics — a flaky-by-nature
dependency needs a higher threshold than a normally rock-solid one. Pair
every breaker with a documented fallback behavior.

------------------------------------------------------------------------

## 13.5 Bulkhead Isolation

**Definition:** Bulkhead isolation partitions system resources (thread
pools, connection pools, queues) per dependency or per feature, so that
one overloaded or slow dependency can only exhaust *its own* resource
pool, not the resources shared by the rest of the system.

**Simple meaning:** Named after a ship's bulkheads — watertight
compartments that keep one flooded section from sinking the whole ship.
Isolate resource pools so one failure doesn't drain capacity from
everything else.

**Why it's needed:** If every outbound call shares one connection pool,
a single slow dependency can consume all available connections waiting
for responses, starving unrelated calls to healthy dependencies — even
though those dependencies are fine. This is one of the most common causes
of a "one slow dependency takes down the whole service" incident.

**How it works internally:** Each dependency (or each class of
operation — e.g., "reads" vs "writes," or "critical path" vs
"non-critical") gets its own bounded resource: a separate database
connection pool, a separate `Agent` with a `maxSockets` limit for HTTP
calls, or a separate worker pool for CPU-bound tasks. When that pool is
exhausted, new requests to that dependency queue or fail fast — they don't
compete with, or starve, requests to other dependencies.

**Syntax and API:**

```typescript
import http from "node:http";

// Separate HTTP agents per dependency, each with its own connection cap
const paymentAgent = new http.Agent({ maxSockets: 10 });
const inventoryAgent = new http.Agent({ maxSockets: 20 });

// Separate DB pools for reporting (long, expensive queries) vs
// transactional (fast, latency-sensitive) workloads
const reportingPool = new Pool({ max: 5 });
const transactionalPool = new Pool({ max: 20 });
```

**Small example:** An e-commerce checkout service calls both a payment
provider and a recommendations service. Each gets its own connection pool
with its own cap. When the recommendations API slows down and fills its
pool, checkout calls to the payment provider are unaffected because they
draw from a separate pool.

**Real backend usage:** Common bulkhead boundaries in backend systems:
separate DB connection pools for read-heavy reporting queries versus
transactional writes; separate thread/worker pools for CPU-bound
background jobs versus request-handling; per-tenant resource caps in
multi-tenant systems so one noisy tenant can't starve others.

**Edge cases:** Over-partitioning wastes resources (many small,
underutilized pools instead of one well-sized shared pool) — bulkheads
are a tradeoff between isolation and efficiency, applied where blast
radius matters most, not everywhere uniformly. Bulkheads don't fix the
underlying slow dependency; they only contain the damage — they're used
together with timeouts and circuit breakers, not instead of them.

**Common mistakes:** Sizing every pool the same regardless of the
dependency's actual traffic and latency profile. Treating bulkheads as a
replacement for timeouts (a full pool with no timeout on individual
calls will still degrade badly, just within a smaller blast radius).
Forgetting that in-process bulkheads (like separate agents) don't help if
requests are also competing for the shared Node.js event loop under
CPU-bound work — that requires worker threads or process-level
isolation instead.

**Interview answer:** "Bulkhead isolation means giving each dependency,
or each class of workload, its own bounded resource pool — a separate
connection pool or thread pool — so that if one dependency slows down and
exhausts its pool, it can't also starve requests to unrelated, healthy
dependencies. It's the difference between one slow dependency degrading
one feature versus taking down the entire service."

**Practice problem:** Configure two separate database connection pools
for a service — one for a reporting endpoint that runs slow aggregate
queries, one for the transactional API — and write a load test that
saturates the reporting pool while verifying transactional endpoints
remain responsive.

**Production considerations:** Monitor pool utilization (active vs
idle vs waiting connections) per pool, not just in aggregate, so you can
see which specific dependency is under pressure. Size pools based on
measured concurrency needs and the downstream dependency's own capacity
limits (a pool larger than the dependency can actually handle just moves
the bottleneck).

------------------------------------------------------------------------

## 13.6 Rate Limiting and Load Shedding

**Definition:** **Rate limiting** restricts how many requests a client
(or the system as a whole) can make in a given time window, rejecting
requests beyond that limit. **Load shedding** is a system, under
overload, deliberately dropping or rejecting a portion of incoming
requests to protect its ability to serve the rest.

**Simple meaning:** Rate limiting controls *who* can send how much.
Load shedding is the system saying "I'm full, I'm rejecting some
requests on purpose to stay alive for the others" — a self-protection
mechanism rather than a per-client policy.

**Why it's needed:** Rate limiting protects against abuse, runaway
clients, and unfair resource consumption by one caller. Load shedding
protects the system itself: without it, a traffic spike pushes latency up
for *every* request until the whole system falls over (all requests slow,
none succeed) — shedding some requests early keeps the rest fast and
successful, which is a better outcome than everyone getting a slow,
eventual failure.

**How it works internally:** Common rate-limiting algorithms: **token
bucket** (a bucket refills at a fixed rate; each request consumes a
token; empty bucket = reject or queue), **sliding window log/counter**
(count requests in a rolling time window), and **fixed window counter**
(simplest, but has boundary burst issues). Distributed rate limiting
across multiple server instances typically uses Redis with atomic
increment-and-expire operations so all instances share one counter. Load
shedding is usually implemented by monitoring a signal of overload (queue
depth, event-loop lag, CPU, or in-flight request count) and rejecting new
requests with a 503 once that signal crosses a threshold, often
prioritizing by request type (shed low-priority traffic before
high-priority/critical-path traffic).

**Syntax and API (token bucket via Redis, conceptual):**

```typescript
async function isAllowed(userId: string, limit: number, windowSec: number) {
  const key = `ratelimit:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  return count <= limit;
}
```

**Load shedding based on event-loop lag:**

```typescript
let eventLoopLagMs = 0;
setInterval(() => {
  const start = Date.now();
  setImmediate(() => { eventLoopLagMs = Date.now() - start; });
}, 100);

app.use((req, res, next) => {
  if (eventLoopLagMs > 200) {
    return res.status(503).json({ error: { code: "OVERLOADED" } });
  }
  next();
});
```

**Small example:** A public API allows 100 requests/minute per API key
using a token bucket in Redis; a client sending 150 requests in a minute
gets 429s for the last 50. Separately, during a traffic spike, the
service sheds new non-critical analytics-tracking requests while
continuing to serve checkout requests.

**Real backend usage:** Rate limiting is applied at the API gateway or
edge (per API key/user/IP) and often again per internal service to
protect it from any single caller. Load shedding is used in high-traffic
systems (payment processors, ad servers, ticket-sale flash-sale systems)
where protecting overall system health under extreme spikes matters more
than serving every single request.

**Edge cases:** Rate limiting by IP breaks for users behind shared NAT/
corporate proxies (many users, one IP) — API-key or user-ID based limits
are usually better where authentication exists. Fixed-window counters
allow a burst of up to 2x the limit right at the window boundary
(request at 0:59 and 1:00 both count fresh). Load shedding needs to
distinguish request priority — shedding checkout requests to protect a
recommendations widget is backwards.

**Common mistakes:** Rate limiting only at one layer and assuming it's
enough (a gateway limit doesn't protect an internal service called by
other internal services). Returning a generic 500 instead of 429 (rate
limit) or 503 (overloaded) with a `Retry-After` header, which tells well-
behaved clients how to react. Shedding load reactively so late that the
system has already started failing everything.

**Interview answer:** "Rate limiting protects against a specific client
sending too much traffic, usually implemented with a token bucket per
API key, often backed by Redis for consistency across instances. Load
shedding is different — it's the system protecting itself under overall
overload by rejecting a portion of requests, chosen by priority, so the
rest can still succeed quickly, rather than letting queueing and latency
degrade until everything times out."

**Practice problem:** Implement a Redis-backed token-bucket rate limiter
middleware, return a `429` with a `Retry-After` header when the limit is
exceeded, and write a load test proving requests beyond the limit are
rejected while requests within it succeed.

**Production considerations:** Always return `Retry-After` on 429/503 so
clients can back off correctly. Rate limit at multiple layers (edge and
internal). Use a signal like queue depth or event-loop lag — not just raw
request count — to trigger load shedding, since the right threshold
depends on actual system capacity, not an arbitrary number.

------------------------------------------------------------------------

## 13.7 Graceful Degradation and Fallbacks

**Definition:** Graceful degradation is designing a system so that when a
non-critical dependency fails, the system continues serving reduced or
approximate functionality instead of failing the entire request. A
**fallback** is the specific alternate behavior used in that case — a
cached value, a default, a simplified response, or a "feature
temporarily unavailable" state instead of an error.

**Simple meaning:** If a part breaks, don't break everything — do less,
but keep working.

**Why it's needed:** Many features depend on non-essential services
(recommendations, personalization, analytics, "related items"). If a
failure in one of these takes down the whole page/request, the system is
far more fragile than it needs to be. Degrading gracefully keeps the core
value proposition (e.g., "view the product and buy it") working even when
secondary features aren't.

**How it works internally:** At the call site for a non-critical
dependency, wrap the call so that on failure (or on circuit-breaker-open,
or on timeout) it returns a fallback value instead of propagating the
error up: a cached/stale version of the data, a hardcoded default, or an
empty result with a flag the frontend can use to hide that section. The
key design decision is *classifying* which dependencies are critical
(must succeed, no fallback possible — e.g., "look up the price") versus
non-critical (can degrade — e.g., "show related products").

**Syntax and API:**

```typescript
async function getRecommendations(userId: string): Promise<Product[]> {
  try {
    return await circuitBreaker.call(() => recommendationClient.get(userId));
  } catch (err) {
    logger.warn("Recommendations unavailable, using fallback", { err });
    return getCachedRecommendations(userId) ?? getDefaultPopularProducts();
  }
}
```

**Small example:** A product page calls a personalization service for
"recommended for you." If that call fails or times out, the page falls
back to a generic "popular items" list instead of showing an error or a
blank section — the checkout flow itself is unaffected either way.

**Real backend usage:** E-commerce product pages, news feeds, and
dashboards routinely wrap every non-essential widget's data fetch in a
fallback so one slow/broken microservice degrades one section of the UI
rather than the whole page. API aggregation layers (BFFs) commonly return
partial responses with a `degraded: true` flag for sections that
fell back.

**Edge cases:** Fallback data can go stale — a cached fallback served for
too long can itself become misleading (e.g., showing a price that's since
changed). Some fallbacks are unsafe for critical data (never fall back to
a "safe-looking default" for a security/authorization check — a fallback
that defaults to "allowed" instead of "denied" is a serious vulnerability
class). Distinguishing "fallback served" from "success" in logging/metrics
matters — otherwise degraded responses look identical to healthy ones in
dashboards.

**Common mistakes:** Applying fallbacks to critical-path operations
(payment, auth) where a wrong-but-plausible fallback is worse than an
honest error. Not expiring/refreshing cached fallback data, so it
silently goes stale. Not surfacing degraded state anywhere (logs,
metrics, or the response itself), making it invisible when it's
happening in production.

**Interview answer:** "I classify each dependency a request touches as
critical or non-critical. For non-critical ones, I wrap the call with a
fallback — often a cached or default value — so a failure there degrades
that one feature instead of failing the whole request. For critical
dependencies, like a payment or auth check, I don't apply a plausible-
looking fallback, because returning an honest error is safer than
guessing."

**Practice problem:** Build an endpoint that aggregates data from two
sources — one critical (must fail the whole request on error) and one
non-critical (fails gracefully to a fallback). Simulate each source
failing independently and verify the correct behavior for each case.

**Production considerations:** Track "fallback served" as its own metric
so degraded-mode usage is visible, not silent. Set a max age on cached
fallback data and prefer returning a clearly-marked "unavailable" state
over serving very stale data as if it were fresh. Document, per
dependency, whether it's allowed to have a fallback at all.

------------------------------------------------------------------------

## 13.8 Health Checks: Readiness vs Liveness

**Definition:** A **liveness check** answers "is this process alive and
not deadlocked?" — if it fails, the process should be restarted. A
**readiness check** answers "is this instance currently able to serve
traffic?" — if it fails, traffic should stop being routed to it, but the
process should *not* necessarily be restarted.

**Simple meaning:** Liveness = "are you alive?" Readiness = "are you
ready to take work right now?" A service can be alive but not ready (e.g.,
still warming up, or its database connection just dropped).

**Why it's needed:** Without this distinction, orchestrators (Kubernetes,
load balancers) either restart healthy-but-temporarily-busy instances
unnecessarily (causing more disruption) or keep routing traffic to
instances that are alive but can't actually serve requests (causing
errors for users). Separating the two lets the platform make the right
decision for each failure mode.

**How it works internally:** Both are usually simple HTTP endpoints
(`/healthz/live`, `/healthz/ready`) polled on an interval by the
orchestrator. The liveness handler does minimal work — just confirms the
process is responding (a hung event loop or deadlock will fail to respond
at all, which is the actual failure signal). The readiness handler
actively checks the instance's ability to do its job: can it reach the
database, is a required cache connection up, has startup/warm-up
completed, is it not currently in a "draining" state during shutdown.

**Syntax and API:**

```typescript
app.get("/healthz/live", (req, res) => {
  res.status(200).send("OK"); // just confirms the process can respond
});

app.get("/healthz/ready", async (req, res) => {
  const checks = await Promise.allSettled([
    db.query("SELECT 1"),
    redis.ping(),
  ]);
  const allHealthy = checks.every((c) => c.status === "fulfilled");
  res.status(allHealthy ? 200 : 503).json({ ready: allHealthy });
});
```

**Small example:** An instance whose database connection pool has been
exhausted returns `200` on `/healthz/live` (the process itself is fine)
but `503` on `/healthz/ready` — the load balancer stops sending it new
traffic without the orchestrator killing and restarting a perfectly
healthy process.

**Real backend usage:** Kubernetes `livenessProbe` and `readinessProbe`
configurations map directly onto these two endpoints; load balancers and
service meshes use readiness to control traffic routing during deploys,
scaling events, and transient dependency issues.

**Edge cases:** A readiness check that queries the database on every poll
can itself add load or fail under DB slowness, causing a cascading
"everything looks unready" state — some systems cache the last readiness
result for a short TTL instead of hitting dependencies on every single
probe. During graceful shutdown, readiness should flip to `false`
immediately (stop new traffic) while liveness stays `true` until in-flight
requests finish (don't get killed mid-shutdown).

**Common mistakes:** Making liveness checks that verify downstream
dependencies (a database blip incorrectly triggers a process restart,
which doesn't fix a database problem and adds restart churn). Not
implementing readiness at all and relying only on liveness, so instances
that can't serve traffic keep receiving it. Forgetting to flip readiness
to `false` during graceful shutdown before the process actually stops.

**Interview answer:** "Liveness answers whether the process itself is
responsive — if it fails, restart it. Readiness answers whether this
instance can currently handle traffic — if it fails, stop routing to it,
but don't restart, because the underlying issue, like a database being
briefly unavailable, isn't fixed by a restart. I keep liveness checks
cheap and internal-only, and make readiness checks actually verify the
dependencies the service needs to function."

**Practice problem:** Implement both endpoints for a service with a
database and a cache dependency; simulate the database going down and
verify readiness correctly returns 503 while liveness stays 200; then
simulate a graceful shutdown sequence and verify readiness flips to false
before the process stops accepting new connections.

**Production considerations:** Tune probe intervals and failure
thresholds to avoid flapping (a single slow response shouldn't
immediately mark an instance unready). Ensure the readiness check doesn't
itself become a load-amplification problem under dependency stress. Always
implement the readiness-false-before-shutdown sequence to avoid dropped
requests during deploys.

------------------------------------------------------------------------

## 13.9 Dead-Letter Queues and Poison Messages

**Definition:** A **poison message** is a message in a queue that
repeatedly fails processing — not due to a transient issue, but because
something about the message itself (malformed data, a bug it triggers) is
what causes the failure, so retrying it endlessly will never succeed. A
**dead-letter queue (DLQ)** is a separate queue where such messages are
routed after exceeding a retry limit, instead of blocking or looping
forever in the main queue.

**Simple meaning:** Some messages will never process successfully no
matter how many times you retry them. Instead of retrying forever (which
can block other messages behind it, or waste resources indefinitely),
move it aside into a "problem pile" for later inspection.

**Why it's needed:** Without a DLQ, a poison message in a FIFO/ordered
queue can block every message behind it forever (head-of-line blocking),
or a worker can burn CPU and I/O endlessly retrying something that will
never succeed, starving processing of good messages.

**How it works internally:** The consumer/broker tracks a delivery/retry
count per message. Once that count exceeds a configured threshold, the
message is moved (by the broker automatically, e.g., SQS redrive
policies, or explicitly by consumer code) to a separate DLQ topic/queue
instead of being redelivered to the main queue. The DLQ is typically
monitored separately, with alerting, so a human or automated process can
inspect and decide: fix and replay, or discard.

**Syntax and API (conceptual, generic queue consumer):**

```typescript
async function processMessage(msg: QueueMessage) {
  try {
    await handle(msg);
    await ack(msg);
  } catch (err) {
    if (msg.deliveryCount >= MAX_RETRIES) {
      await sendToDeadLetterQueue(msg, { reason: String(err) });
      await ack(msg); // remove from main queue, it's been dead-lettered
    } else {
      await nack(msg); // let it be redelivered per the queue's retry/backoff policy
    }
  }
}
```

**Small example:** An order-processing worker receives a message with a
corrupted JSON payload from a buggy upstream producer. Every attempt to
parse it throws. After 5 failed delivery attempts, the broker
automatically moves it to `orders-dlq`, freeing the main queue to keep
processing subsequent valid orders.

**Real backend usage:** Any at-least-once messaging system (SQS, Kafka
with manual offset management, RabbitMQ) in production uses DLQs for
order-processing pipelines, email/notification workers, and event-driven
architectures, so one bad event doesn't stall an entire pipeline.

**Edge cases:** A message can look "poison" but actually just needs a
longer backoff (a downstream dependency was down for an extended
period) — distinguishing "will never succeed" from "needs more time" is
imperfect; some systems separate transient-retry counts from
poison-detection more carefully (e.g., only dead-letter on specific
non-retryable error types, not on generic exceptions). Messages sitting
in a DLQ still need a retention/replay/cleanup policy, or the DLQ itself
becomes an unbounded, unmonitored liability.

**Common mistakes:** No DLQ at all — poison messages loop forever, or get
silently dropped after some client-library default, losing the data.
Setting the DLQ up but never monitoring or alerting on it, so failures
accumulate invisibly. Replaying DLQ messages back into the main queue
without fixing the underlying cause, causing the same failure loop again.

**Interview answer:** "A dead-letter queue exists because some messages
will never process successfully no matter how many times you retry —
usually because the message itself is malformed or triggers a bug, not
because of a transient failure. After a bounded number of delivery
attempts, I move the message to a DLQ instead of retrying indefinitely,
so it doesn't block other messages or waste processing resources, and I
alert on DLQ depth so failures are investigated rather than silently
piling up."

**Practice problem:** Build a queue consumer with a configurable max-
retry count, wire it to move messages exceeding that count into a
separate dead-letter queue with the failure reason attached, and write a
test that verifies a permanently-failing message is dead-lettered after
exactly N attempts, while a message that succeeds on attempt 2 is not.

**Production considerations:** Alert on DLQ depth and growth rate, not
just its existence. Store enough context with the dead-lettered message
(original payload, error, timestamp, attempt count) to actually debug and
potentially replay it. Set a retention policy for the DLQ so it doesn't
grow unbounded.

------------------------------------------------------------------------

## 13.10 Failure Budgets

**Definition:** A failure budget (closely related to an "error budget" in
SRE practice) is an explicitly allowed amount of failure/downtime over a
period, derived from an availability target (e.g., 99.9% uptime allows
about 43 minutes of downtime per month) — a quantitative, agreed-upon
tolerance for things going wrong.

**Simple meaning:** Instead of pretending the goal is "zero failures,"
decide up front how much failure is acceptable, track it, and use it to
make decisions.

**Why it's needed:** "Zero failures" is not a real target for any
non-trivial distributed system, and treating it as one leads to either
paralysis (too afraid to ship changes) or burnout (constant firefighting
with no honest accounting of risk). A failure budget makes reliability a
measurable, negotiable resource: if you're within budget, you can take
more risk (ship faster, run bolder experiments); if you've burned through
it, the team's priority shifts to stability work until the budget
recovers.

**How it works internally:** Derived from an SLO (e.g., 99.9% availability
over 30 days). The budget is the inverse: 0.1% of that period is
"spendable" failure. Every incident, elevated error rate, or missed SLI
(service-level indicator, like request success rate) consumes budget.
Teams track budget consumption on a dashboard and set policies tied to
it — e.g., "if the error budget for this quarter is exhausted, feature
releases pause until an agreed level of stability work is done."

**Syntax and API (illustrative budget calculation):**

```text
SLO: 99.9% availability over 30 days
Total minutes in 30 days: 43,200
Allowed downtime (budget): 43,200 * 0.001 = 43.2 minutes

If an incident causes 20 minutes of full downtime:
Remaining budget for the period: 43.2 - 20 = 23.2 minutes
```

**Small example:** A team's checkout service has a 99.95% availability
SLO. After a 15-minute outage this month, they've used roughly 70% of
their monthly error budget. The team agrees to postpone a risky
infrastructure migration until next month rather than risk exhausting the
remaining budget.

**Real backend usage:** SRE-driven organizations use error budgets to
balance the tension between "ship features fast" and "keep the system
reliable" — it turns an emotional/political debate about risk into a
shared, numeric one, and gives teams explicit permission to take
calculated risks as long as they're within budget.

**Edge cases:** A budget defined only around uptime misses partial
degradation (a service that's "up" but serving 20% errors is failing
its users even if it's technically not "down") — good SLOs are usually
based on request success rate or latency SLIs, not simple binary
up/down. Multiple dependent services each burning their own budget
independently can combine into a worse user-facing experience than any
single budget suggests.

**Common mistakes:** Setting an SLO/budget that doesn't reflect actual
user expectations (99.99% for an internal admin tool no one needs
five-nines for) — wasted engineering effort chasing unnecessary
reliability. Tracking the budget but never actually acting on it (no
real policy change when it's exhausted, making it a vanity metric).
Confusing the error budget with an SLA (a customer-facing contractual
commitment, often with financial penalties) — they're related but serve
different purposes.

**Interview answer:** "A failure budget comes from an availability or
reliability SLO — say 99.9% — which mathematically implies an allowed
amount of downtime or errors over a period. Tracking consumption against
that budget turns reliability into a measurable resource: if we're
within budget, the team can ship faster and take more risk; if the
budget's exhausted, the priority shifts to stability work. It replaces an
unrealistic 'never fail' expectation with an explicit, agreed tolerance."

**Practice problem:** Given a service's SLO and a log of incident
durations over a month, write a script that computes the allowed budget,
subtracts consumed downtime per incident, and outputs remaining budget
and a recommendation (ship freely / caution / freeze non-critical
releases) based on remaining percentage.

**Production considerations:** Base SLOs on metrics users actually feel
(success rate, latency percentiles) rather than infrastructure-level
metrics alone. Review and adjust the SLO periodically as the system and
its usage evolve — a budget set once and never revisited stops being
meaningful. Tie budget exhaustion to a real, pre-agreed policy change, not
just a dashboard number nobody acts on.

------------------------------------------------------------------------

## Practice (Phase Summary)

- Add a timeout to an HTTP client and verify it aborts correctly under a
  simulated slow dependency.
- Build a retry helper with exponential backoff and jitter; prove it
  respects a max-attempt cap and only retries classified-retryable
  errors.
- Implement a simple circuit breaker (closed → open → half-open) with
  unit tests covering all three transitions.
- Handle a failing downstream service end-to-end: timeout → retry →
  circuit breaker → fallback, wired together in one request path, with
  metrics/logging at each stage.

## Priority

**MUST KNOW**

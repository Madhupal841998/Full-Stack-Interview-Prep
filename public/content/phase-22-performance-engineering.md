# Phase 22 — Performance Engineering
**Priority: IMPORTANT**

> Framework applied to each topic: Definition → Simple meaning → Why it's needed → How it works internally → Syntax/API → Small example → Real backend usage → Edge cases → Common mistakes → Interview answer → Practice problem → Production considerations

> **Guiding principle (from the roadmap's Expert-Level Habits):** Measure performance instead of guessing. Every optimization in this phase should start with a profile or a benchmark, not an assumption.

---

## 22.1 CPU Profiling

**Definition:** The practice of measuring where a process spends its CPU time, function by function, to find hot paths worth optimizing.

**Why needed:** In Node.js, JS execution is single-threaded — a CPU-heavy function (large JSON transforms, complex regex, synchronous crypto/hashing, image processing) blocks the event loop for *every* concurrent request, not just the one that triggered it. CPU profiling is how you find that function instead of guessing.

**How it works internally:** V8 supports sampling profilers that periodically capture the call stack, building a picture of which functions are "on-CPU" most often. Node exposes this via `--prof` (writes a V8 log processed with `--prof-process`) and via the Inspector protocol (`--inspect`, consumed by Chrome DevTools or `clinic.js`).

**Syntax/API:**
```bash
node --prof server.js
# ... generate load ...
node --prof-process isolate-0x*.log > profile.txt

# Or, for a visual flame graph:
node --inspect server.js   # open chrome://inspect, go to Profiler tab
```

**Real backend usage:** Profiling reveals that a "slow endpoint" is actually spending 90% of its time in a synchronous `JSON.parse` on a huge payload, or in a poorly-written regex with catastrophic backtracking — not in the database call you assumed was the bottleneck.

**Edge cases:** Profiling in production adds overhead — sampling profilers are relatively cheap, but always profile against representative load in a staging environment first, and treat production profiling as a targeted, time-boxed diagnostic action, not a default-on setting.

**Common mistakes:** Optimizing code based on intuition ("this loop looks slow") without profiling first — the actual bottleneck is very often somewhere unexpected; profiling under a load pattern that doesn't match production (e.g. profiling a single request when the real problem only appears under concurrent load).

**Interview answer:** "I'd use a sampling profiler — Node's built-in `--prof` or the Inspector-based flame graph in Chrome DevTools — to find which functions are actually consuming CPU time under realistic load, rather than guessing. Node's single-threaded execution model means any CPU-bound hot path blocks the whole event loop, so profiling is the difference between fixing the real bottleneck and optimizing code that was never the problem."

**Practice problem:** Write a deliberately inefficient function (e.g. a naive O(n²) duplicate-finder over a large array) inside an endpoint, profile the endpoint under load with `--prof` or DevTools, confirm the function shows up as the hot path, then replace it with an O(n) version using a `Set` and re-profile to confirm the fix.

---

## 22.2 Memory Profiling and Memory Leaks

**Definition:** Measuring how memory is allocated and retained over the life of a process, to find objects that should have been garbage-collected but weren't.

**Why needed:** A slow memory leak doesn't crash a process immediately — it degrades performance gradually (more GC pauses as the heap grows) until an eventual out-of-memory crash, often hours or days after deploy, making it one of the harder production issues to diagnose without the right tooling.

**How it works internally:** V8's garbage collector reclaims objects with no reachable references. A "leak" in a garbage-collected language means something is still *reachable* that shouldn't be — a common cause is a global cache/array that only grows, or event listeners that are added repeatedly and never removed, keeping their closures (and everything those closures reference) alive.

**Syntax/API:**
```js
console.log(process.memoryUsage());
// { rss, heapTotal, heapUsed, external, arrayBuffers }
```
```bash
node --inspect server.js
# Chrome DevTools → Memory tab → take heap snapshot, generate load, take a second snapshot, compare
```

**Common leak sources in Node.js backends:**
- An in-memory cache (`Map`/object) with no eviction policy or TTL.
- Event listeners attached on every request without ever being removed (`emitter.on` inside a request handler instead of at startup).
- Closures unintentionally capturing large objects (e.g. a callback referencing an entire request object long after it's needed).
- Unbounded arrays used as ad-hoc queues/logs that are never trimmed.

**Common mistakes:** Diagnosing a "leak" from a single memory snapshot (memory naturally grows and shrinks with GC cycles) instead of comparing multiple snapshots over time under sustained load to see if a *trend* exists; treating high memory usage as automatically a leak, when it may just be a legitimately large but bounded cache.

**Production considerations:** Set container/process memory limits with monitoring and alerting on sustained upward trend (not just absolute value), so a leak is caught before an OOM kill in production; restart-on-schedule (e.g. via PM2 or an orchestrator) is a mitigation, not a fix — it buys time but the underlying leak still needs to be found.

**Practice problem:** Build an endpoint that pushes to a module-level array on every call and never clears it. Hit it repeatedly, log `process.memoryUsage().heapUsed` over time to observe the growth, take two heap snapshots in DevTools to confirm the growing array is the retained object, then fix it with a bounded structure (e.g. an LRU cache) and confirm memory stabilizes.

---

## 22.3 Event Loop Lag

**Definition:** The delay between when a scheduled callback (e.g. `setTimeout`, `setImmediate`, a Promise microtask) *should* run and when it actually runs — a direct measurement of how "busy" or blocked the event loop currently is.

**Why needed:** Event loop lag is the single clearest signal that synchronous CPU-bound work is starving I/O handling — high lag means requests are queued behind blocking code, even though the server "looks" like it's running.

**Syntax/API:**
```js
import { monitorEventLoopDelay } from 'perf_hooks';

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

setInterval(() => {
  console.log('p50:', histogram.percentile(50), 'p99:', histogram.percentile(99));
  histogram.reset();
}, 5000);
```

**Real backend usage:** Exposing event loop lag as a metric (alongside request latency) in your monitoring dashboard makes it possible to distinguish "the database is slow" from "our own process is CPU-blocked" — two very different problems with different fixes.

**Common mistakes:** Only monitoring request latency and never event loop lag directly — a spike in request latency caused by event loop blocking looks identical, from the outside, to a spike caused by a slow downstream dependency, but the fix is completely different (move CPU work off the main thread vs. fix/scale the dependency).

**Interview answer:** "Event loop lag measures the gap between when a timer should fire and when it actually does — it's the most direct way to detect that synchronous work is blocking I/O handling. I'd monitor it with `perf_hooks.monitorEventLoopDelay` and alert on p99 lag, since a rising lag under load is usually the first sign that a CPU-heavy code path needs to move to a worker thread."

---

## 22.4 Database Query Profiling and Connection Pool Sizing

**Learn:** `EXPLAIN`/`EXPLAIN ANALYZE` for query plans (deep-dived in the MySQL phase), slow query logs, identifying missing indexes from actual production query patterns rather than guesses, connection pool sizing (too small → requests queue waiting for a connection; too large → the database itself becomes the bottleneck under connection overhead).

**How it works internally (pool sizing):** Each open DB connection consumes memory and a worker/thread on the database server; a pool that's too large across many app instances can overwhelm the database far below the app's own capacity limit. A common starting formula (not a universal rule) is to size pools relative to available DB connections divided by number of app instances, then tune from observed wait times, not a fixed guess.

**Common mistakes:** Setting an arbitrarily large connection pool "to be safe," which can starve the database of resources when multiplied across many horizontally-scaled app instances; not measuring actual connection **wait time** (time spent queued for a pool connection) as a distinct metric from query execution time — a slow endpoint might be spending most of its time waiting for a free connection, not running the query itself.

**Production considerations:** Track pool wait time, active connections, and idle connections as first-class metrics; when scaling app instances horizontally, revisit total connection count against the database's max — this is a very common scaling cliff (100 healthy app instances × a pool of 20 each can silently exceed the database's connection limit).

---

## 22.5 Load Testing

**Definition:** Deliberately generating traffic against a system to measure its behavior — throughput, latency, and error rate — under realistic or intentionally extreme conditions, before real users do it for you.

**Why needed:** Assumptions about capacity ("this should handle 1000 req/s") are frequently wrong; load testing turns that assumption into a measured, reproducible number, and reveals *where* the system degrades (CPU, DB connections, memory, a specific slow endpoint) before it happens in production.

**Syntax/API (conceptual — tool-agnostic, e.g. k6, Artillery, autocannon):**
```bash
autocannon -c 100 -d 30 http://localhost:3000/api/learners
# 100 concurrent connections, 30 seconds
```

**What to capture:** Throughput (requests/sec), latency percentiles (see 22.6), error rate under load, and the resource metric that first becomes the bottleneck (CPU, event loop lag, DB connection pool, memory).

**Common mistakes:** Load testing only the "happy path" endpoint with no auth/DB writes, which doesn't represent real traffic; running a single load test and treating the result as permanent, instead of re-running after significant code or infrastructure changes; testing against a staging environment with dramatically different resources than production and treating the numbers as directly comparable.

**Practice problem:** Load test a simple CRUD endpoint at increasing concurrency levels (10, 50, 100, 500), recording throughput, p95/p99 latency, and error rate at each level; identify the concurrency level where latency starts degrading sharply (the practical capacity ceiling) and correlate it with a specific resource metric (CPU, event loop lag, or DB pool wait time) captured at the same time.

---

## 22.6 Latency Percentiles — p50, p95, p99

**Definition:** Percentile latency describes the response time below which a given percentage of requests fall. p50 (median) is the "typical" request; p95 and p99 describe the slower tail.

**Simple meaning:** p99 = 100ms means 99% of requests finished in 100ms or less, and 1% took longer.

**Why needed:** Averages hide tail latency. A system with a 50ms average but a 5-second p99 is failing 1% of users badly — averages alone would never surface this, and that "1%" can be a large absolute number of real users at scale.

**Real backend usage:** SLOs are almost always defined on a percentile (e.g. "p99 latency under 300ms"), not an average, because the tail is what users actually notice as "the app is slow" — and it's the tail that correlates with things like an under-provisioned connection pool or GC pauses.

**Common mistakes:** Reporting and optimizing only for average latency; not segmenting percentiles by endpoint (a slow batch-export endpoint dragging down an aggregate p99 can mask that your core user-facing endpoints are actually fine, or vice versa).

**Interview answer:** "p99 latency tells you what the slowest 1% of your users experience, which is what averages hide entirely. I'd set SLOs on p95/p99 rather than average latency, because a good average can coexist with a genuinely bad experience for a meaningful chunk of real traffic."

---

## 22.7 Garbage Collection Impact

**Learn:** V8's generational GC (young generation "Scavenge" for short-lived objects, old generation "Mark-Sweep-Compact" for long-lived ones), GC pauses as a source of latency spikes and event loop lag, how excessive object allocation (e.g. creating large temporary objects per request) increases GC pressure.

**Common mistakes:** Allocating large temporary objects/arrays inside hot request-handling paths unnecessarily (e.g. re-parsing/re-serializing the same data repeatedly); not correlating latency spikes with GC activity when investigating tail-latency issues — a periodic p99 spike that doesn't correlate with traffic or DB load is a classic GC-pause signature.

**Production considerations:** `--max-old-space-size` tunes V8's heap ceiling; GC behavior can be observed via `--trace-gc` or Inspector's Performance tab when diagnosing latency spikes that don't correlate with external dependencies.

---

## 22.8 Cache Hit Rate

**Definition:** The proportion of read requests served from cache versus requiring the underlying (slower) data source.

**Why needed:** Cache hit rate is the metric that tells you whether a cache is actually doing its job — a cache with a low hit rate adds complexity (invalidation, consistency risk) without delivering the latency/load benefit it's meant to provide.

**Real backend usage:** Tracking hit rate per cache key pattern (not just globally) reveals which specific data is poorly suited to caching (e.g. highly personalized, rarely-repeated queries) versus which is a strong caching candidate (shared, frequently-read, infrequently-changed data).

**Common mistakes:** Adding caching to an endpoint without measuring the resulting hit rate, and assuming it's helping; caching data with a change frequency that makes the invalidation logic more complex/error-prone than the performance gain justifies.

---

## 22.9 Horizontal vs Vertical Scaling

| | Vertical scaling | Horizontal scaling |
|---|---|---|
| **Definition** | Increase resources (CPU/RAM) on a single instance | Add more instances, distribute load across them |
| **Ceiling** | Hard ceiling — a single machine's max spec | Effectively unbounded, limited by architecture (shared DB, etc.) |
| **Complexity** | Simple — no distribution concerns | Requires statelessness, load balancing, shared session/cache strategy |
| **Node.js relevance** | Doesn't help a single-threaded CPU bottleneck beyond one core | `cluster`/multiple instances directly address single-core JS execution limits |

**Why it matters for Node specifically:** Because JS execution is single-threaded, vertical scaling (bigger machine) does **not** proportionally help CPU-bound work unless you also use `cluster`/multiple processes to actually use the extra cores — this is a frequent point of confusion.

**Production considerations:** Horizontal scaling requires the application to be stateless (no in-memory session/cache that isn't also available to other instances) — this is why the multi-tenant/SaaS phase's guidance to keep tenant context in verified, re-derivable claims (not sticky in-memory state) also pays off here.

---

## 22.10 Bottleneck Analysis

**Definition:** The systematic process of identifying which single resource (CPU, memory, DB connections, network, disk I/O) is currently limiting throughput, since optimizing a non-bottleneck resource yields no improvement.

**Method:**
1. Load test while capturing CPU, event loop lag, memory, DB pool wait time, and per-endpoint latency simultaneously.
2. Identify which metric saturates first (hits its ceiling) as load increases — that's the current bottleneck.
3. Fix that specific bottleneck.
4. Re-test — the bottleneck often *moves* to a different resource after the first fix, requiring another round.

**Common mistakes:** Optimizing the first thing that looks suspicious instead of the resource that's actually saturating first; treating a single bottleneck-analysis pass as final — systems commonly hit a second, different bottleneck immediately after the first is resolved (e.g. fixing CPU contention reveals the DB connection pool was the next limit all along).

**Interview answer:** "Bottleneck analysis means measuring every candidate resource under the same load test simultaneously, and fixing whichever one saturates first — optimizing anything else at that point won't move the needle. It's also iterative: removing one bottleneck commonly exposes the next one, so I'd re-test after each fix rather than assuming one round is sufficient."

---

## Practice: End-to-End Performance Investigation

1. **Load test** a realistic CRUD API at increasing concurrency; capture throughput, p50/p95/p99 latency, and error rate at each level.
2. **Instrument** the app with event loop lag monitoring (`monitorEventLoopDelay`) and expose it alongside request latency.
3. **Identify the bottleneck** at the concurrency level where latency degrades — correlate against CPU profile, event loop lag, memory, and DB pool wait time captured during the same test.
4. **Fix the identified bottleneck** (e.g. move a CPU-heavy transform to a worker thread, add a missing index, resize the connection pool, add caching to a hot read path).
5. **Re-run the load test** and compare before/after p95/p99 and throughput at the same concurrency level to confirm — and check whether a new bottleneck has emerged.

---

## Phase 22 Interview Quick-Reference

- **Always measure before optimizing** — profiling/load testing over intuition.
- **Event loop lag** is the clearest Node-specific signal of CPU-bound blocking.
- **p95/p99, not average**, is what SLOs and real user experience are built on.
- **Horizontal scaling ≠ automatic fix** for Node CPU-bound work — needs `cluster`/multiple processes to use more cores.
- **Bottleneck analysis is iterative** — fixing one limit commonly reveals the next.
- **Connection pool sizing is a system-wide concern**, not a per-instance tuning knob — total connections across all instances matters.

## Phase 22 Completion Checklist
- [ ] Can profile CPU usage and identify a hot function using `--prof` or DevTools
- [ ] Can take and compare heap snapshots to diagnose a memory leak
- [ ] Can monitor and interpret event loop lag under load
- [ ] Can run a load test and read throughput/latency-percentile/error-rate results
- [ ] Can explain why p99 matters more than average latency for SLOs
- [ ] Can size a DB connection pool considering total connections across all app instances
- [ ] Can explain why vertical scaling alone doesn't fix Node's single-threaded CPU bottlenecks
- [ ] Can perform a full bottleneck-analysis cycle: measure → fix → re-measure

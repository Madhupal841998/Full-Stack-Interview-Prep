# Phase 14 --- Caching

## Caching from Zero to Production-Grade Backend Usage

**Stack context:** Node.js, TypeScript, MySQL, Redis

**Priority for the whole phase:** MUST KNOW

**Prerequisites:** Phase 4 (Node.js Core), Phase 6 (MySQL and Indexes),
Phase 12 (API Design: ETags, conditional requests), Phase 13 (Error
Handling and Resilience: timeouts, retries, graceful degradation).

**Leads into:** Phase 15 (Background Jobs), Phase 17 (Distributed
Systems), Phase 22 (Performance Engineering).

------------------------------------------------------------------------

## How to Study This Phase

For every topic, follow the same 12-step order from the master guide:

1.  Proper definition
2.  Simple meaning
3.  Why it is needed
4.  How it works internally
5.  Syntax and API
6.  Small example
7.  Real backend usage
8.  Edge cases
9.  Common mistakes
10. Interview answer
11. Practice problem
12. Production considerations

Suggested duration: **2 to 3 weeks** at 1--2 hours daily.

| Week | Focus |
|------|-------|
| Week 1 | 14.1 to 14.5 (concepts, layers, patterns, TTL, eviction, invalidation) |
| Week 2 | 14.6 to 14.9 (failure modes, Redis, key design, locks) |
| Week 3 | 14.10 to 14.14 (consistency, HTTP caching, metrics, production, projects) |

------------------------------------------------------------------------

## Core Principle

> A cache is a **copy** of data. Every copy can become **stale**.
> Caching is a trade: you exchange **freshness and simplicity** for
> **speed and reduced load**. Never add a cache before you know what
> problem it solves.

Two famous difficulties in computer science are naming things and cache
invalidation. This phase is mostly about handling the second one safely.

------------------------------------------------------------------------

# 14.1 Caching Fundamentals

## Proper Definition

Caching is the technique of storing the result of an expensive operation
(a database query, a computation, a remote API call) in a faster storage
location so that future requests for the same result can be served
without repeating the expensive work.

## Simple Meaning

Keep a copy of frequently needed data close to where it is used, so you
do not go to the slow source every time.

## Why It Is Needed

-   Reduce latency (memory access is microseconds; a database query is
    milliseconds; a cross-region API call can be hundreds of
    milliseconds).
-   Reduce database load and protect it from read spikes.
-   Increase throughput without adding hardware.
-   Reduce cost of repeated computation or paid third-party API calls.
-   Improve availability when the source is slow or briefly unavailable
    (serving stale data as a fallback).

## Learn

-   Latency numbers: memory vs SSD vs network vs database
-   Cache hit, cache miss, hit ratio, miss penalty
-   Working set and locality of reference (temporal and spatial)
-   Read-heavy vs write-heavy workloads
-   What is cacheable: data that is read often, changes rarely, is
    expensive to compute, and tolerates some staleness
-   What is **not** safe to cache blindly: user-specific private data
    without a user-scoped key, balances, inventory counts during
    checkout, permission decisions with long TTLs, anything requiring
    strict read-after-write consistency
-   Amdahl-style thinking: caching helps only when the cached portion is
    a significant part of total latency
-   Cache as an optimization, never as the source of truth

## Key Formula

```text
Effective latency = (hit ratio x cache latency) + (miss ratio x (cache latency + source latency))
```

Example: cache = 1 ms, database = 50 ms, hit ratio = 90%

```text
0.90 x 1 + 0.10 x (1 + 50) = 0.9 + 5.1 = 6.0 ms average
```

A hit ratio drop from 90% to 70% raises the average to about 16.3 ms.
Small hit-ratio changes have large effects.

## Edge Cases

-   Low hit ratio makes the cache pure overhead (extra network hop with
    no benefit).
-   Cache sits in the critical path: if it is slow, the whole API is
    slow (always set timeouts).
-   Cold cache after deployment or restart can overload the database.

## Common Mistakes

-   Caching before measuring where the time is actually spent.
-   Caching data that is unique per request (hit ratio near zero).
-   Treating the cache as durable storage.
-   Having no plan for invalidation.

## Interview Answer

> "Caching stores computed or fetched data in a faster layer to reduce
> latency and backend load. It works when reads dominate writes and the
> data can tolerate bounded staleness. The cost is complexity:
> invalidation, consistency, and new failure modes such as stampedes."

## Practice

-   Profile an endpoint and record how much time is spent in database
    queries versus application code.
-   Compute the average latency for hit ratios of 50%, 80%, 95%, 99%.
-   List 10 pieces of data in a sample application and classify each as
    "cache safely", "cache with care", or "never cache".

------------------------------------------------------------------------

# 14.2 Cache Layers

A request can be served from many layers. Understand each one and what
it is good for.

| Layer | Location | Good for | Main risk |
|-------|----------|----------|-----------|
| Browser cache | Client | Static assets, GET responses with cache headers | Cannot be invalidated by server directly |
| CDN cache | Edge network | Static files, public media, cacheable public API responses | Purging delay, leaking private data |
| Reverse proxy cache | Nginx / gateway | Public GET responses | Cache key mistakes (missing Vary) |
| Application in-memory cache | Inside Node.js process | Tiny hot data, config, computed lookups | Per-instance copies diverge, memory growth |
| Distributed cache | Redis / Memcached | Shared cache across instances | Network hop, new failure point |
| Database internal cache | MySQL buffer pool | Hot pages | Not controlled by application code |
| Materialized/precomputed data | DB table or store | Reports, aggregates | Refresh lag |

## Learn

-   Local (in-process) cache vs distributed cache tradeoffs
-   Multi-level caching (L1 in-process + L2 Redis) and its consistency
    cost
-   Why in-process caches diverge when you run multiple Node.js
    instances or cluster workers
-   Bounding in-process cache size (LRU with max entries and max memory)
-   Memcached vs Redis (simple key-value vs rich data structures,
    persistence, replication)
-   MySQL: the old query cache was removed in MySQL 8.0. Do not rely on
    it. Use application-level caching and good indexes instead.

## Real Backend Usage

-   Feature flags and tenant configuration: small, read constantly,
    change rarely (short-TTL in-process cache).
-   Product catalog and user profile reads: Redis cache-aside.
-   Public marketing pages and media: CDN.
-   Rate limiting counters: Redis (this is state, not a cache, but
    shares the infrastructure).

## Common Mistakes

-   Using an unbounded `Map` as a cache (memory leak).
-   Assuming an in-memory cache is shared between instances.
-   Caching private per-user responses at a CDN or shared proxy.

## Practice

-   Implement a small in-process LRU cache class in TypeScript with
    max size and TTL.
-   Run two instances of your API and demonstrate stale data divergence
    between their local caches.
-   Add an L1 (in-process, 5--10 s TTL) plus L2 (Redis) cache and
    measure the difference.

------------------------------------------------------------------------

# 14.3 Caching Strategies and Patterns

## 14.3.1 Cache-Aside (Lazy Loading)

**Definition:** The application checks the cache first. On a miss, it
reads from the database, writes the result to the cache, and returns it.
The application owns all cache logic.

```text
Read:   app -> cache (hit? return) -> miss -> DB -> write cache -> return
Write:  app -> DB -> invalidate (delete) cache key
```

```ts
async function getProduct(id: string): Promise<Product | null> {
  const key = `product:v1:${id}`;

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as Product;

  const product = await productRepo.findById(id);
  if (product) {
    await redis.set(key, JSON.stringify(product), "EX", 300);
  }
  return product;
}

async function updateProduct(id: string, data: UpdateProductDto) {
  const updated = await productRepo.update(id, data);
  await redis.del(`product:v1:${id}`); // delete, do not update in place
  return updated;
}
```

**Why delete instead of update on write?** Updating the cache with the
new value races with concurrent readers and writers. Deleting is simpler
and safer; the next read repopulates from the source of truth.

**Pros:** Simple, resilient (cache failure falls back to the database),
caches only what is requested.
**Cons:** First request is always a miss, stale window exists, every
caller must follow the pattern (put it in one service or wrapper).

**Priority:** MUST KNOW (the default pattern for backend APIs)

## 14.3.2 Read-Through

**Definition:** The application asks the cache layer for data. The cache
layer itself loads from the database on a miss.

**Difference from cache-aside:** Loading logic lives in the cache
abstraction, not at every call site. In Node.js you typically build this
yourself as a `getOrLoad(key, loader)` helper.

```ts
async function getOrLoad<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const value = await loader();
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  return value;
}
```

**Priority:** MUST KNOW

## 14.3.3 Write-Through

**Definition:** Every write goes to the cache and the database
synchronously as one logical operation. The cache is always up to date
after a successful write.

**Pros:** Reads after writes hit fresh data.
**Cons:** Higher write latency, caches data that may never be read,
two-system write means partial failure must be handled (what if the DB
write succeeds and the cache write fails?).

**Priority:** IMPORTANT

## 14.3.4 Write-Behind (Write-Back)

**Definition:** Writes go to the cache first and are flushed to the
database asynchronously in batches.

**Pros:** Very fast writes, batching reduces database load.
**Cons:** Data loss risk if the cache node dies before flush, harder
ordering and consistency, complex recovery. Use only when loss of recent
writes is acceptable (counters, view counts) or when backed by a durable
queue.

**Priority:** IMPORTANT (know the risk; rarely the right choice for
business-critical data)

## 14.3.5 Write-Around

**Definition:** Writes go directly to the database and skip the cache.
The cache is filled only on reads.

**Good for:** Data written once and rarely read afterwards (logs,
audit records).

**Priority:** GOOD TO KNOW

## 14.3.6 Refresh-Ahead

**Definition:** The system refreshes a popular entry before it expires,
so users never pay the miss penalty.

**Good for:** Very hot keys with predictable access, expensive loads.
**Risk:** Refreshing data nobody needs anymore wastes resources.

**Priority:** IMPORTANT

## Strategy Comparison

| Strategy | Read latency | Write latency | Staleness risk | Complexity | Typical use |
|----------|--------------|---------------|----------------|------------|-------------|
| Cache-aside | Miss = slow first time | Normal | Bounded by TTL/invalidation | Low | Default for APIs |
| Read-through | Same as cache-aside | Normal | Same | Low-Medium | Shared loader abstraction |
| Write-through | Fast | Slower | Low | Medium | Read-after-write sensitive data |
| Write-behind | Fast | Very fast | Data loss risk | High | Counters, analytics |
| Write-around | Miss on first read | Normal | Low | Low | Write-once data |
| Refresh-ahead | Consistently fast | Normal | Low | Medium | Hot, expensive keys |

## Interview Answer (Strategy Choice)

> "I default to cache-aside with TTL plus explicit invalidation on
> write, because it is simple and the database stays the source of
> truth. I only move to write-through when read-after-write freshness
> is required, and I avoid write-behind for anything where losing a
> write is unacceptable."

## Practice

-   Implement cache-aside and read-through helpers in TypeScript.
-   Simulate a crash between the DB write and the cache invalidation.
    What stale window results? How does TTL bound it?
-   Implement a write-behind counter that flushes to MySQL every N
    seconds. Kill the process and observe the loss.

------------------------------------------------------------------------

# 14.4 TTL and Eviction

## TTL (Time To Live)

**Definition:** A duration after which a cached entry is treated as
expired and removed.

**Why it matters:** TTL is your **safety net**. Even if invalidation
logic has a bug, stale data disappears after the TTL.

## Learn

-   Absolute TTL vs sliding TTL (refresh on access)
-   Choosing TTL by data type:
    -   Static reference data: hours to days
    -   Product/catalog data: minutes
    -   User profile: minutes
    -   Permissions/roles: seconds to short minutes (security-sensitive)
    -   Negative results: short (seconds to a minute)
-   TTL jitter: add random variation so many keys do not expire at the
    same instant

```ts
function ttlWithJitter(baseSeconds: number, jitterRatio = 0.1): number {
  const jitter = baseSeconds * jitterRatio * (Math.random() * 2 - 1);
  return Math.max(1, Math.round(baseSeconds + jitter));
}
```

-   Redis expiry commands: `EXPIRE`, `PEXPIRE`, `TTL`, `PTTL`,
    `SET key value EX seconds`, `PERSIST`
-   Redis expiry is implemented with lazy expiration (on access) plus
    periodic active sampling, so expired keys are not always removed the
    instant they expire

## Eviction Policies

When memory is full, the cache must decide what to remove.

| Policy | Meaning |
|--------|---------|
| LRU | Evict least recently used |
| LFU | Evict least frequently used |
| FIFO | Evict oldest inserted |
| TTL-based | Evict entries closest to expiry |
| Random | Evict random entries |

Redis `maxmemory-policy` options to know:

-   `noeviction`: reject writes when full (default in many setups)
-   `allkeys-lru`, `allkeys-lfu`, `allkeys-random`
-   `volatile-lru`, `volatile-lfu`, `volatile-random`, `volatile-ttl`
    (only keys that have a TTL are candidates)

Redis LRU/LFU are **approximated** using sampling, not exact.

## Real Backend Usage

-   Pure cache Redis instance: `allkeys-lru` or `allkeys-lfu` with
    `maxmemory` set.
-   Redis shared with queues or locks: **do not** let important keys be
    evicted. Separate the instances (cache vs queue/state), or use
    `volatile-*` policies carefully.

## Common Mistakes

-   Not setting `maxmemory`, so Redis grows until the host runs out of
    memory.
-   No TTL on any key, plus `noeviction`, leading to write failures.
-   Same TTL for everything, causing synchronized expiry.
-   Using one Redis instance for both cache and critical job queues with
    an eviction policy that can delete queue data.

## Practice

-   Set `maxmemory` and `allkeys-lru` locally, fill Redis, and observe
    evictions with `INFO stats` (`evicted_keys`).
-   Compare hit ratio for LRU vs LFU with a skewed access pattern.
-   Add jitter to TTLs and show the expiry distribution.

------------------------------------------------------------------------

# 14.5 Cache Invalidation

> Invalidation is the hardest part of caching. Stale data is not a
> cache bug by itself; **unbounded** or **unexpected** staleness is.

## Learn

-   Time-based invalidation (TTL only)
-   Explicit invalidation (delete on write)
-   Event-driven invalidation (publish an event; subscribers evict)
-   Versioned keys (change the version, old keys become unreachable)
-   Tag/group-based invalidation (invalidate all keys for a tenant or
    category)
-   Write-through update
-   CDC-based invalidation (database change events trigger eviction;
    see Phase 23)

## Techniques in Detail

### 1. Delete on write (most common)

```ts
await db.transaction(async (trx) => {
  await productRepo.update(id, data, trx);
});
// Delete AFTER the transaction commits
await redis.del(`product:v1:${id}`);
```

**Important:** Invalidate **after commit**. If you delete the key before
the transaction commits, a concurrent reader can reload the old row and
re-cache stale data.

### 2. Versioned keys

```ts
// Store a version number per entity or per tenant
const version = (await redis.get(`tenant:${tenantId}:catalog:ver`)) ?? "1";
const key = `tenant:${tenantId}:catalog:v${version}:list:page:${page}`;

// To invalidate every catalog list for the tenant:
await redis.incr(`tenant:${tenantId}:catalog:ver`);
```

Old keys are never read again and eventually expire by TTL. This avoids
scanning and deleting many keys.

### 3. Tag-based invalidation with Redis Sets

```ts
await redis.sadd(`tag:category:${categoryId}`, key);
// Later
const keys = await redis.smembers(`tag:category:${categoryId}`);
if (keys.length) await redis.unlink(...keys);
await redis.del(`tag:category:${categoryId}`);
```

### 4. Pattern deletion: use with extreme care

-   Never use `KEYS pattern` in production. It is O(N) and blocks the
    single-threaded Redis server.
-   Use `SCAN` with `MATCH` and `COUNT` (incremental, non-blocking), or
    prefer versioned keys or tag sets.
-   Prefer `UNLINK` over `DEL` for large keys (non-blocking free).

## The Race Condition You Must Understand

```text
1. Reader A: cache miss, reads DB (old value v1)
2. Writer B: updates DB to v2, deletes cache key
3. Reader A: writes v1 into cache   <-- stale value cached until TTL
```

Mitigations:

-   Always use a TTL so the stale value is bounded.
-   Use short TTLs for frequently changing data.
-   Use versioned values or compare version numbers before writing to
    cache.
-   Use "delayed double delete" (delete again shortly after the write)
    as a pragmatic mitigation, knowing it narrows but does not eliminate
    the race.

## Common Mistakes

-   Invalidating the entity key but forgetting list, search, and
    aggregate keys that include it.
-   Invalidating before commit.
-   Using `KEYS *` to clear caches in production.
-   Relying only on invalidation with no TTL.

## Interview Answer

> "I combine TTL as a safety net with explicit invalidation after the
> transaction commits. For groups of keys I use versioned keys or tag
> sets instead of scanning. I accept bounded staleness and design the
> TTL to match how much staleness the business tolerates."

## Practice

-   Cache a product detail and a product list. Update a product and make
    sure both are correct afterwards.
-   Reproduce the stale-write race with two scripts and fix it.
-   Implement tenant-wide invalidation using a version counter.

------------------------------------------------------------------------

# 14.6 Cache Failure Problems

## 14.6.1 Cache Stampede (Thundering Herd / Dogpile)

**Definition:** A popular key expires (or is missing) and many
concurrent requests all miss and hit the database at once to rebuild the
same value.

**Why it is dangerous:** The database load spikes exactly when the cache
was supposed to protect it, and it can cascade into an outage.

**Protections (know all of them):**

1.  **In-process single-flight (request coalescing):** concurrent
    requests inside one Node.js instance share one in-flight load.

```ts
const inflight = new Map<string, Promise<unknown>>();

async function singleFlight<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = loader().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
```

2.  **Distributed lock (mutex) per key:** only one instance rebuilds;
    others wait briefly, retry the cache, or serve stale.

```ts
async function getWithLock<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const lockKey = `lock:${key}`;
  const token = crypto.randomUUID();
  const acquired = await redis.set(lockKey, token, "PX", 10_000, "NX");

  if (acquired) {
    try {
      const value = await loader();
      await redis.set(key, JSON.stringify(value), "EX", ttl);
      return value;
    } finally {
      await releaseLock(lockKey, token); // compare-and-delete, see 14.9
    }
  }

  // Someone else is rebuilding: wait a little and re-check the cache
  await sleep(50 + Math.random() * 50);
  const retry = await redis.get(key);
  if (retry) return JSON.parse(retry);
  return loader(); // final fallback; bound this in real code
}
```

3.  **Stale-while-revalidate:** store a soft expiry inside the value.
    After soft expiry, serve the stale value immediately and refresh in
    the background.
4.  **Probabilistic early expiration (XFetch):** each request has a
    small, growing probability of refreshing before actual expiry,
    spreading the reload.
5.  **TTL jitter** to avoid many different keys expiring together.
6.  **Pre-warming** hot keys on deploy or via a scheduled job.

## 14.6.2 Cache Penetration

**Definition:** Requests for keys that **do not exist** anywhere (random
IDs, malicious probing). Every request misses the cache and hits the
database, and there is never anything to cache.

**Protections:**

-   **Negative caching:** cache the "not found" result with a short TTL.

```ts
const NOT_FOUND = "__NULL__";

const cached = await redis.get(key);
if (cached === NOT_FOUND) return null;
if (cached) return JSON.parse(cached);

const row = await repo.findById(id);
if (!row) {
  await redis.set(key, NOT_FOUND, "EX", 30); // short TTL
  return null;
}
```

-   **Input validation** before touching cache or database (reject
    malformed IDs early).
-   **Bloom filter** in front of the cache for existence checks
    (probabilistic: no false negatives, some false positives).
-   **Rate limiting** per client or IP.

**Caution:** Negative caching with a long TTL can hide a record that was
just created. Keep it short and invalidate on create.

## 14.6.3 Cache Avalanche

**Definition:** A large number of keys expire at the same time, or the
cache layer goes down entirely, and the database receives the full
traffic at once.

**Protections:**

-   TTL jitter
-   Redis high availability (replica + failover, or managed HA)
-   Circuit breaker and load shedding to protect the database (Phase 13)
-   Graceful degradation: serve reduced functionality rather than
    letting the database collapse
-   Warm-up strategy after restarts
-   Multi-level cache (local L1 absorbs some load if Redis is down)

## 14.6.4 Hot Key Problem

**Definition:** One key receives a disproportionate amount of traffic,
overloading a single Redis node or shard.

**Protections:** short-lived in-process L1 copy of the hot key, key
replication (`key:1..N` and random read), request coalescing.

## 14.6.5 Big Key Problem

**Definition:** A single value is very large (huge JSON, giant list or
set). Reading, deleting, or expiring it blocks Redis and burns network
bandwidth.

**Protections:** cap value size, paginate/split large collections, use
`UNLINK`, monitor with `redis-cli --bigkeys` or `MEMORY USAGE`.

## 14.6.6 Cache Warming and Cold Start

**Definition:** After a restart, deploy, or failover the cache is empty
and the first wave of traffic goes to the database.

**Protections:** preload known hot data, ramp traffic gradually, keep
Redis persistence for cache if restart warmness matters, and rely on
stampede protection.

## Failure Summary

| Problem | Trigger | Main defense |
|---------|---------|--------------|
| Stampede | One hot key expires | Single-flight, lock, SWR, early refresh |
| Penetration | Requests for non-existent data | Negative cache, validation, Bloom filter |
| Avalanche | Mass expiry or cache outage | TTL jitter, HA, circuit breaker |
| Hot key | Skewed traffic to one key | L1 cache, key replication |
| Big key | Oversized value | Size limits, splitting, UNLINK |
| Cold start | Empty cache | Warming, gradual ramp |

## Interview Answer (Stampede)

> "A stampede happens when a hot key expires and many requests rebuild
> it concurrently. I prevent it with request coalescing per instance, a
> short distributed lock for cross-instance protection, stale-while-
> revalidate so users get slightly stale data instead of waiting, and
> TTL jitter."

## Practice

-   Load-test an endpoint whose cache expires under 500 concurrent
    requests. Count the database queries with and without protection.
-   Send 10,000 requests for random non-existent IDs. Measure database
    load before and after negative caching.
-   Expire 1,000 keys simultaneously, then repeat with jitter, and
    compare database query rate.

------------------------------------------------------------------------

# 14.7 Redis for Backend Engineers

## Proper Definition

Redis is an in-memory data structure server that supports optional
persistence and replication. It is commonly used as a cache, but also
for rate limiting, sessions, queues, leaderboards, pub/sub, and
short-lived coordination state.

## Why Redis Is Fast

-   Data lives in memory.
-   Efficient data structures.
-   Commands execute on a single main thread, so individual commands are
    atomic and there is no lock contention between commands (I/O
    threading exists in newer versions, but command execution remains
    serialized).
-   Simple protocol and pipelining support.

**Consequence:** one slow command (for example `KEYS *`, a huge `SMEMBERS`,
or a long Lua script) blocks **every** client.

## Data Structures

| Type | Use in backend | Key commands |
|------|----------------|--------------|
| String | Cached JSON, counters, locks, tokens | `GET`, `SET`, `INCR`, `SET NX EX` |
| Hash | Object with fields (user profile, session) | `HSET`, `HGET`, `HGETALL`, `HINCRBY` |
| List | Simple queues, recent items | `LPUSH`, `RPOP`, `LRANGE`, `BRPOP` |
| Set | Tags, unique members, cache tag groups | `SADD`, `SMEMBERS`, `SISMEMBER` |
| Sorted Set | Leaderboards, time-ordered data, rate-limit windows | `ZADD`, `ZRANGE`, `ZREMRANGEBYSCORE` |
| Stream | Event log, consumer groups (see Phase 15) | `XADD`, `XREADGROUP`, `XACK` |
| Bitmap / HyperLogLog | Flags, approximate unique counts | `SETBIT`, `PFADD`, `PFCOUNT` |

## Learn

-   Strings vs hashes for cached objects (hash allows partial reads and
    updates; JSON string is simpler)
-   Atomic operations: `INCR`, `SET NX`, `GETSET`-style patterns,
    `SET ... GET`
-   Pipelining: send many commands in one round trip
-   Transactions: `MULTI` / `EXEC` (no rollback; commands are queued
    and run together) and `WATCH` for optimistic locking
-   Lua scripting (`EVAL`) for multi-step atomic logic
-   Pub/Sub: fire-and-forget messaging, no persistence (useful for
    cache-invalidation broadcast between instances)
-   Persistence: RDB snapshots vs AOF log; when a cache does not need
    either
-   Replication and Sentinel; Redis Cluster hash slots and hash tags
    (`{tenant42}:...` to keep related keys on one slot)
-   `SCAN` family instead of `KEYS`
-   Connection management in Node.js: reuse one client, configure
    reconnect strategy, command timeouts, and error listeners
-   Security: authentication, TLS, private network, never expose Redis
    publicly

## Node.js Example (ioredis)

```ts
import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  connectTimeout: 2000,
  commandTimeout: 200,          // fail fast; cache must never hang the API
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 100, 2000),
});

redis.on("error", (err) => logger.error({ err }, "redis error"));
```

Pipelining example:

```ts
const pipeline = redis.pipeline();
ids.forEach((id) => pipeline.get(`product:v1:${id}`));
const results = await pipeline.exec(); // one round trip for N keys
```

## Common Mistakes

-   Using `KEYS` in production.
-   Creating a new Redis connection per request.
-   No command timeout, so a Redis stall freezes the API.
-   Storing huge values.
-   Treating Redis as the primary database without persistence and
    replication planning.
-   Exposing Redis to the internet without authentication.

## Practice

-   Store a user profile as a JSON string and as a hash. Compare partial
    update and read patterns.
-   Implement a fixed-window and a sliding-window rate limiter with
    Redis.
-   Use pipelining to fetch 100 keys and compare with 100 sequential
    calls.
-   Write a Lua script that atomically checks and decrements a counter.

------------------------------------------------------------------------

# 14.8 Key Design and Serialization

## Key Design

A good key is **predictable, namespaced, versioned, and scoped**.

```text
{app}:{env}:{tenant}:{entity}:{version}:{id}

Examples
shop:prod:t42:product:v2:1001
shop:prod:t42:user:v1:557:permissions
shop:prod:t42:product-list:v3:cat=12:page=2:size=20:sort=price_asc
```

Rules:

-   Include the **tenant ID** in every tenant-scoped key. A missing
    tenant in a key is a cross-tenant data leak (see Phase 18).
-   Include every parameter that changes the response (filters, sort,
    page, language, user role) in the key, or you will serve the wrong
    data.
-   Include a **schema version** so a deployment that changes the
    cached shape does not read incompatible old data.
-   Keep keys reasonably short (they consume memory) but readable.
-   Normalize parameters (sorted query params, lowercase where
    appropriate) so equivalent requests share one key.
-   Never put unsanitized user input into keys without validation
    (key injection, unbounded key space).

## Serialization

-   JSON: simple, readable, but larger and loses types (Dates become
    strings, `undefined` disappears, `BigInt` throws, `Map`/`Set` are
    lost).
-   MessagePack, Protocol Buffers: compact and faster, but less
    readable.
-   Compression (gzip, zstd) for large values, with the CPU tradeoff.
-   Validate data read from cache before trusting it. A schema change or
    a bad write can leave malformed data behind.

```ts
import { z } from "zod";

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  updatedAt: z.coerce.date(),
});

const raw = await redis.get(key);
if (raw) {
  const parsed = ProductSchema.safeParse(JSON.parse(raw));
  if (parsed.success) return parsed.data;
  await redis.del(key); // corrupt or old-shape entry: discard and reload
}
```

## Security Considerations

-   Never cache secrets, raw passwords, or full payment data.
-   Be careful caching PII. Apply TTL, minimize fields, and encrypt if
    required by policy.
-   Never cache an authorization decision for longer than you can
    tolerate a revoked permission staying active.

## Common Mistakes

-   Cache key missing a filter, causing users to see wrong data.
-   Cache key missing the user or tenant on private data.
-   Changing the cached shape without bumping the version.
-   Dates or decimals corrupted by JSON round trip.

## Practice

-   Design the cache keys for a product listing with filters, sorting,
    pagination, and multi-tenancy.
-   Write a key builder function that normalizes query parameters.
-   Bump a schema version and confirm old entries are ignored safely.

------------------------------------------------------------------------

# 14.9 Distributed Locks

## Proper Definition

A distributed lock is a mutual-exclusion mechanism that lets only one
process across multiple servers perform a critical action at a time.

## Simple Meaning

A shared "only I am doing this right now" flag that lives outside any one
application instance.

## Why It Is Needed

-   Prevent multiple instances from rebuilding the same expensive cache
    entry (stampede control).
-   Ensure a scheduled job runs on only one instance.
-   Serialize access to a resource that lacks its own concurrency
    control.

## Correct Basic Lock with Redis

Acquire (atomic, with expiry so a crashed holder cannot block forever):

```text
SET lock:resource <unique-token> NX PX 10000
```

Release (only if you still own it, using compare-and-delete in Lua):

```ts
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

async function releaseLock(key: string, token: string) {
  return redis.eval(RELEASE_SCRIPT, 1, key, token);
}
```

## Why Each Part Matters

-   `NX`: set only if not already present (mutual exclusion).
-   `PX` expiry: prevents a permanent lock if the holder crashes.
-   Unique token: prevents client A from deleting a lock that
    expired and was re-acquired by client B.
-   Lua compare-and-delete: makes check and delete atomic.

## Edge Cases and Hard Truths

-   **Lock expiry vs long work:** if work takes longer than the TTL, two
    holders can run concurrently. Use a lock lease renewal ("watchdog"),
    keep work short, or design the operation to be idempotent.
-   **Clock and pause problems:** a process can pause (GC, network
    stall) after acquiring the lock and resume after it expired.
-   **Fencing tokens:** for correctness-critical work, have the lock
    issue an increasing token and make the protected resource reject
    older tokens. A lock alone cannot guarantee safety.
-   **Failover:** an asynchronously replicated Redis primary can fail
    over and lose a lock that a replica never received.
-   **Redlock:** a multi-node algorithm that reduces some risks; it is
    debated for correctness-critical use. Know that it exists and that
    experts disagree on its safety guarantees.

## When Not to Use a Redis Lock

-   When the database can enforce the rule itself: unique constraints,
    row locks (`SELECT ... FOR UPDATE`), optimistic locking with a
    version column, or idempotency keys.
-   For financial correctness. Use database transactions and
    constraints as the authority; use locks only as an efficiency
    optimization.

> **Rule:** Use a lock for **efficiency** (avoid duplicate work), not
> for **correctness**. Correctness belongs in the database.

## Common Mistakes

-   `SETNX` followed by a separate `EXPIRE` (a crash between them leaves
    a permanent lock). Always use a single atomic `SET NX PX`.
-   Releasing with plain `DEL` (can delete another client's lock).
-   No timeout or retry limit when waiting for a lock.
-   Assuming a lock makes a non-idempotent operation safe.

## Practice

-   Implement `acquireLock`, `releaseLock`, and a `withLock` helper.
-   Demonstrate the bug when the token check is missing.
-   Simulate a lock that expires mid-operation and show the double
    execution, then mitigate with idempotency.

------------------------------------------------------------------------

# 14.10 Cache Consistency

## Learn

-   Strong consistency vs eventual consistency in the context of caches
-   Bounded staleness: define the maximum acceptable staleness per data
    type
-   Read-your-writes consistency: a user who just updated data must not
    see the old value
-   Monotonic reads: a user should not see data go "backwards"
-   Dual-write problem: updating the database and the cache are two
    operations that can partially fail
-   Cache and database cannot be updated atomically together
-   Replica lag interaction: reading from a read replica and caching the
    result can cache stale data
-   Multi-instance L1 caches: invalidation across instances
    (pub/sub broadcast or short TTLs)
-   Multi-region caches and replication delay

## Practical Approaches

| Need | Approach |
|------|----------|
| Tolerates seconds/minutes of staleness | TTL only |
| Should update soon after change | Delete on write + TTL |
| Must read own writes | After a write, bypass cache for that user briefly, or write-through, or return updated data directly from the write response |
| Must be exactly correct | Do not cache; read from the database (or cache only immutable data) |

## Read-Your-Writes Example

```ts
// After an update, return the fresh row from the write path and
// invalidate; do not immediately re-read from a lagging replica.
const updated = await repo.updateAndReturn(id, data); // from primary
await redis.del(key);
return updated;
```

## Common Mistakes

-   Caching a value read from a lagging replica right after a write.
-   Believing "delete then write" or "write then delete" is atomic. It
    is not.
-   Never defining how stale is acceptable, so everyone guesses.
-   Caching computed permissions for too long.

## Interview Answer

> "A cache and a database cannot be updated atomically, so I design for
> bounded staleness. I choose TTL and invalidation based on the
> business tolerance for each type of data. Where a user must see their
> own write, I return the fresh value from the write path and avoid
> re-caching data read from a lagging replica."

## Practice

-   Write a table that assigns an allowed staleness to every cached
    entity in a sample application.
-   Reproduce a stale read caused by replica lag and fix it.
-   Implement pub/sub-based L1 invalidation across two API instances.

------------------------------------------------------------------------

# 14.11 HTTP Caching (Client, CDN, Proxy)

This connects directly to Phase 12 (ETags and conditional requests).

## Learn

-   `Cache-Control` directives: `max-age`, `s-maxage`, `no-cache`,
    `no-store`, `public`, `private`, `must-revalidate`, `immutable`
-   `stale-while-revalidate` and `stale-if-error`
-   Important distinction: `no-cache` means "revalidate before use", not
    "do not store". `no-store` means "do not store at all".
-   `ETag` and `If-None-Match` (returns `304 Not Modified`)
-   `Last-Modified` and `If-Modified-Since`
-   `Vary` header (cache key includes listed request headers, e.g.
    `Accept-Encoding`, `Accept-Language`)
-   Cache busting for static assets with content hashes in file names
-   CDN behavior: edge TTL, purge/invalidation, origin shield
-   Private data: use `Cache-Control: private` or `no-store`, never
    let shared caches store user-specific responses
-   Authenticated responses and `Authorization` header behavior in
    shared caches

## Example Headers

```text
# Public, versioned static asset
Cache-Control: public, max-age=31536000, immutable

# Public API list, short shared-cache life
Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=30

# Private user data
Cache-Control: private, no-store

# Revalidate every time using ETag
Cache-Control: no-cache
ETag: "v42-abc123"
```

## Express Example (ETag with conditional request)

```ts
app.get("/products/:id", async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) return res.status(404).json({ success: false });

  const etag = `"${product.id}-${product.updatedAt.getTime()}"`;
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  res.set({
    "Cache-Control": "private, no-cache",
    ETag: etag,
  });
  return res.json({ success: true, data: product });
});
```

## Common Mistakes

-   Confusing `no-cache` with `no-store`.
-   Missing `Vary`, causing a CDN to serve the wrong language or
    encoding.
-   Letting a CDN cache an authenticated response.
-   Setting long `max-age` on files without content-hashed names.

## Practice

-   Add ETag support to a GET endpoint and verify `304` in DevTools.
-   Set correct headers for static assets, a public API, and a private
    API.
-   Demonstrate a `Vary` bug and fix it.

------------------------------------------------------------------------

# 14.12 Measuring Cache Effectiveness

> Measure, do not guess. A cache with no metrics is a liability.

## Metrics to Track

-   **Hit ratio** = hits / (hits + misses)
-   Miss rate and miss latency
-   Cache latency (p50, p95, p99) for Redis calls
-   Eviction count and expired key count
-   Memory usage and memory fragmentation
-   Key count and average value size
-   Connection count and command rate
-   Error rate and timeouts against Redis
-   Database query rate before vs after caching
-   Stampede indicators: concurrent rebuilds of the same key
-   Hot keys and big keys

## Redis Commands and Tools

```text
INFO stats           keyspace_hits, keyspace_misses, evicted_keys, expired_keys
INFO memory          used_memory, maxmemory, fragmentation ratio
INFO commandstats    per-command call counts and time
SLOWLOG GET          slow commands
MEMORY USAGE key     size of a key
redis-cli --bigkeys  large key discovery
redis-cli --latency  latency check
MONITOR              debugging only, never leave running in production
```

## Instrumentation Example

```ts
async function cachedGet<T>(key: string, loader: () => Promise<T>, ttl: number): Promise<T> {
  const start = performance.now();
  const cached = await redis.get(key);

  if (cached) {
    metrics.increment("cache.hit", { prefix: keyPrefix(key) });
    metrics.timing("cache.get_ms", performance.now() - start);
    return JSON.parse(cached);
  }

  metrics.increment("cache.miss", { prefix: keyPrefix(key) });
  const value = await loader();
  await redis.set(key, JSON.stringify(value), "EX", ttl);
  return value;
}
```

Use a **key prefix or entity name** as the metric label, never the full
key (unbounded cardinality would overload the metrics system).

## Interpreting the Numbers

-   Low hit ratio: keys too specific, TTL too short, working set larger
    than memory, or data not cache-worthy.
-   High evictions: not enough memory or values too large.
-   High latency: big keys, slow commands, network issues, saturated
    CPU, or too many connections.
-   Hit ratio is not the only goal. Also confirm the database load and
    end-to-end latency actually improved.

## Practice

-   Add hit/miss counters and a latency histogram to your cache helper.
-   Build a dashboard: hit ratio per entity, Redis latency, evictions.
-   Load-test before and after caching and record p50/p95/p99 and
    database queries per second.

------------------------------------------------------------------------

# 14.13 Production Considerations

## Resilience (connects to Phase 13)

-   **The cache must never take the API down.** Wrap cache calls with
    short timeouts and treat errors as a miss.
-   Circuit breaker around Redis so a failing cache is skipped quickly.
-   Protect the database when the cache is down: load shedding, rate
    limiting, request coalescing.
-   Decide fail-open (serve from database) vs fail-closed per use case.
    Rate limiters and security checks may need a different policy than
    product caches.

```ts
async function safeCacheGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (err) {
    logger.warn({ err, key }, "cache get failed, treating as miss");
    metrics.increment("cache.error");
    return null;
  }
}
```

## Operations

-   Run Redis with high availability (replication + automatic failover,
    or a managed service).
-   Set `maxmemory`, an eviction policy, and memory alerts.
-   Separate cache instances from queue/lock/session instances where
    eviction behavior differs.
-   Use TLS and authentication; keep Redis in a private network.
-   Plan capacity: estimate number of keys x average size x overhead.
-   Plan deployments: schema-versioned keys, warm-up, and gradual
    rollout.
-   Provide an admin/runbook procedure for safe cache purging (by
    namespace or version, not `FLUSHALL`).
-   Document TTL and invalidation rules for each cached entity.

## Multi-Tenant Safety (connects to Phase 18)

-   Tenant ID in every tenant-scoped key.
-   Test that tenant A can never read tenant B's cache entries.
-   Consider per-tenant quotas so one tenant cannot evict everyone
    else's cache.

## Security

-   No secrets or full sensitive data in cache.
-   Encrypt or avoid caching regulated data (PII, financial).
-   Cache poisoning: validate what you store; do not build keys or
    values from unchecked user input.
-   Do not cache authorization decisions with long TTLs.

## When NOT to Cache

-   Data requiring strict, immediate consistency (account balances,
    stock during checkout, payment status).
-   Data that is rarely read or unique per request.
-   Cheap queries that are already fast and indexed.
-   When the real fix is a missing index or a better query. Fix the
    query first, cache second.

## Decision Checklist Before Adding a Cache

1.  Have I measured that this operation is a real bottleneck?
2.  Is the data read far more often than it changes?
3.  How much staleness is acceptable, and who decided?
4.  What is the exact cache key, and does it include every varying
    input (tenant, user, filters, version)?
5.  What is the TTL, and is there jitter?
6.  How is it invalidated on write, and after commit?
7.  What happens on a miss under heavy concurrency (stampede)?
8.  What happens for non-existent keys (penetration)?
9.  What happens when Redis is slow or down?
10. What metrics prove the cache works?

------------------------------------------------------------------------

# 14.14 Practice Projects

## Project A: Cached Product API (Core)

Build a Node.js + TypeScript + MySQL + Redis product API.

Requirements:

-   `GET /products/:id` using cache-aside
-   `GET /products` with filters, sort, and pagination, cached by a
    normalized key
-   `PUT /products/:id` invalidates the detail key and affected list
    keys (use versioned keys)
-   TTL with jitter
-   Negative caching for unknown IDs
-   Stampede protection (single-flight + distributed lock)
-   Cache hit/miss metrics and a hit-ratio endpoint or dashboard
-   Timeouts and fail-open behavior when Redis is down

Verification:

-   Load test with and without cache and record p50/p95/p99.
-   Kill Redis during the test and confirm the API stays up.
-   Expire a hot key under load and confirm only one database rebuild.

## Project B: Multi-Level Cache

-   L1 in-process LRU (short TTL) + L2 Redis.
-   Redis pub/sub to broadcast invalidations to all instances.
-   Demonstrate consistency between two running instances.

## Project C: Rate Limiter with Redis

-   Fixed window, sliding window log (sorted set), and token bucket
    (Lua script).
-   Compare accuracy, memory use, and atomicity.

## Project D: Read-Your-Writes Demo

-   Use a primary and a (simulated) lagging replica.
-   Show the stale-cache bug, then fix it.

## Project E: Cache Observability

-   Export hit ratio, latency, evictions, and hot keys.
-   Add an alert for a hit ratio drop and for high eviction rate.

------------------------------------------------------------------------

# 14.15 Interview Preparation

## Concept Questions

1.  What is caching, and when should you avoid it?
2.  Explain cache-aside, read-through, write-through, write-behind, and
    write-around, with tradeoffs.
3.  Why do we usually delete the cache entry on update instead of
    updating it?
4.  What is a cache stampede, and how do you prevent it?
5.  Difference between cache penetration, breakdown (stampede), and
    avalanche?
6.  How do you choose a TTL?
7.  LRU vs LFU, and how does Redis approximate them?
8.  Why is `KEYS *` dangerous in production?
9.  How do you implement a safe distributed lock in Redis? What can
    still go wrong?
10. How do you keep cache and database consistent?
11. `no-cache` vs `no-store` in HTTP.
12. How do you cache data in a multi-tenant system safely?
13. What happens to your API if Redis goes down?
14. How do you measure whether a cache is working?
15. Why is Redis fast, and what kind of command can hurt it?

## Scenario Questions

-   "Your product page is slow at peak hours. Walk me through how you
    would add caching."
-   "After a deploy, the database CPU spikes to 100% for two minutes.
    What happened and how do you prevent it?"
-   "A user updates their profile but still sees the old data. Debug
    it."
-   "An attacker requests random product IDs and overloads the
    database. What do you do?"
-   "Design caching for a leaderboard with millions of users."

## Design Exercise Template

For any caching design answer, cover:

1.  What is cached and why (measured bottleneck)
2.  Cache key format
3.  Strategy (cache-aside, etc.)
4.  TTL and eviction
5.  Invalidation
6.  Stampede, penetration, avalanche protection
7.  Consistency and staleness tolerance
8.  Failure behavior when the cache is down
9.  Metrics and alerts
10. Security and tenant isolation

------------------------------------------------------------------------

# 14.16 Phase 14 Mastery Checklist

You have completed Phase 14 when you can:

-   Explain why caching helps and calculate the effect of hit ratio on
    latency.
-   Choose between cache-aside, read-through, write-through,
    write-behind, and write-around with reasons.
-   Design safe cache keys that include tenant, filters, and version.
-   Set TTLs with jitter and explain the eviction policy you chose.
-   Invalidate correctly after a database commit, and explain the
    stale-write race.
-   Implement stampede protection using single-flight, locks, and
    stale-while-revalidate.
-   Protect against cache penetration and avalanche.
-   Use Redis data structures, pipelines, Lua scripts, and `SCAN`
    correctly.
-   Implement a Redis lock with token and atomic release, and state its
    limits.
-   Explain bounded staleness and read-your-writes.
-   Set correct HTTP cache headers and use ETags.
-   Measure hit ratio, latency, and evictions, and interpret them.
-   Make the API survive a Redis outage.
-   Decide when **not** to cache.
-   Explain all of the above clearly in an interview.

## Final Principle for This Phase

```text
Cache only what you have measured.
Bound every staleness you accept.
Protect the database from your own cache.
Never let the cache become a single point of failure.
```

------------------------------------------------------------------------

**Next:** Phase 15 --- Background Jobs and Messaging

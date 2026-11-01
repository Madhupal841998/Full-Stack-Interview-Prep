# Phase 11 — High-Level Design (HLD)

**Stack context:** Node.js, TypeScript, MySQL, plus the infrastructure around them
**Prerequisite:** Phases 6 (MySQL), 9 (architecture), 10 (LLD)
**Priority:** 11.1 to 11.3 — MUST KNOW · 11.4 — practice until the process is automatic

---

## What This Phase Is Really About

Phase 10 was the shape of classes inside one process. Phase 11 is the shape of
**services, data stores and traffic across many machines** — and, more than
anything, the shape of the conversation you have about them.

HLD has no correct answer. There is no design a panel is waiting for you to
produce. What is being assessed is:

1. **Do you get requirements before designing?** Candidates who start drawing
   boxes in minute one fail, however good the boxes are.
2. **Can you do arithmetic?** Rough numbers determine whether you need one server
   or a thousand, one database or a sharded fleet. Skipping estimation means every
   later decision is unjustified.
3. **Do you name trade-offs?** Every component you add buys something and costs
   something. Saying "I'll add Redis" is weak; "I'll add Redis, accepting stale
   reads up to 60 seconds, to cut p99 from 200ms to 15ms" is the answer.
4. **Do you know where it breaks?** A design without a stated bottleneck is a
   design you have not thought about.

The most common failure is **premature complexity**: reaching for Kafka, sharding
and microservices for a system that serves 50 requests per second. A senior
answer often ends with "one Node service, one MySQL primary with a read replica,
and Redis — here's the number of users at which that stops working." Knowing when
*not* to distribute is a stronger signal than knowing how to.

### The relationship to everything before this

HLD is not a separate skill bolted on top. It is the same reasoning as Phase 9,
one level up:

| Phase 9 (in-process) | Phase 11 (across machines) |
|---|---|
| Module boundary | Service boundary |
| In-process event bus | Message broker (Kafka, SQS) |
| Direct call between modules | Network call — can fail, time out, retry |
| Database transaction | Saga with compensating actions |
| Repository port | Service API contract |

Everything gets harder at this level for one reason: **the network can fail
partially**. A call that neither succeeds nor fails but simply never answers is
the defining problem of distributed systems, and most of Phase 11 is downstream
of it.

---

## 11.1 HLD Fundamentals

### 1. Proper definition

High-level design specifies a system's major components, their responsibilities,
the interfaces between them, the data flows connecting them, and the deployment
topology — chosen to satisfy stated functional and non-functional requirements
within cost constraints.

### 2. Simple meaning

Functional requirements say **what the system does**. Non-functional requirements
say **how well it must do it**. Almost every interesting architectural decision is
driven by the second, not the first.

"Users can post a message" is satisfied by a PHP script on one box. "Users can
post a message, 500,000 times a second, visible globally within 200ms, never
losing one" is a completely different system. Same functional requirement.

### 3. Why it is needed

- **NFRs drive architecture.** You cannot choose a database without knowing the
  read/write ratio, the consistency requirement and the data size.
- **Estimation prevents both over- and under-building.** Numbers tell you whether
  this is a single-server problem or a sharded one.
- **Explicit trade-offs survive turnover.** "We chose eventual consistency for the
  feed because the product accepts 5-second staleness" is a decision a future
  engineer can revisit. An undocumented choice becomes folklore.
- **It is the interview.** The 13-step process in 11.3 is essentially a structured
  walk through this section.

### 4. How it works internally

#### Functional vs non-functional requirements

**Functional** — features. "A user can shorten a URL", "a user can see their
feed", "an admin can refund an order."

**Non-functional** — the qualities. Always ask for these explicitly, because
interviewers (and product managers) rarely volunteer them:

| NFR | The question to ask | What it changes |
|---|---|---|
| **Scale** | How many users? Requests per second? | Number of servers, sharding, caching |
| **Latency** | p50, p95, p99 targets? | Caching, CDN, denormalisation, region placement |
| **Availability** | 99.9%? 99.99%? | Redundancy, failover, multi-region |
| **Consistency** | Can a read be stale? For how long? | SQL vs NoSQL, replication, cache TTL |
| **Durability** | Is losing one record acceptable? | Replication factor, backup strategy, WAL |
| **Read/write ratio** | 100:1? 1:1? | Read replicas, cache, CQRS |
| **Data size & growth** | Total now, growth per year? | Sharding, archival, storage tier |
| **Security** | PII? PCI? Regulatory residency? | Encryption, isolation, audit, region pinning |
| **Cost** | What budget? | Every single choice |

#### The core NFRs defined precisely

**Latency vs throughput.** Latency is time per request; throughput is requests
per unit time. They are not the same and often trade against each other — batching
raises throughput while raising latency. Always quote latency as **percentiles**,
never averages: an average of 50ms with a p99 of 4 seconds means 1 in 100 users
has a terrible experience, and averages hide that completely.

**Availability** is uptime, usually expressed in nines:

| Availability | Downtime/year | Downtime/month | Implication |
|---|---|---|---|
| 99% | 3.65 days | 7.2 hours | Single server, manual recovery |
| 99.9% | 8.76 hours | 43 minutes | Redundancy + automated restart |
| 99.99% | 52.6 minutes | 4.3 minutes | Multi-AZ, automated failover |
| 99.999% | 5.26 minutes | 26 seconds | Multi-region, no manual steps possible |

Two facts worth stating in an interview: dependencies **multiply** (a service
depending on three 99.9% services has at best 99.7% availability), and every nine
costs roughly an order of magnitude more than the last.

**Reliability** is the probability of correct operation over time — broader than
availability. A system that is up but returns wrong answers is available and
unreliable.

**Durability** is the probability data survives once written. It is a *storage*
property, distinct from availability: S3 famously offers very high durability
(data is not lost) with lower availability (it may be briefly unreachable).

**Scalability** — vertical (bigger machine: simple, has a ceiling, usually means
downtime to resize) vs horizontal (more machines: no ceiling, requires
statelessness and introduces coordination problems). The practical rule: scale
vertically until it hurts, because horizontal scaling costs engineering time that
a small system cannot spare. But **design for horizontal from day one** by keeping
app servers stateless — sessions in Redis, files in object storage, no local disk
state.

**Consistency.** The CAP theorem says that during a **network partition** you must
choose between consistency and availability. The common misreading is that it's a
permanent three-way choice; it is not — when there is no partition you get both.
More useful day-to-day is **PACELC**: during a Partition choose Availability or
Consistency, Else (normal operation) choose Latency or Consistency. That "else"
branch is where most real decisions live: synchronous replication costs latency,
asynchronous replication costs consistency.

The consistency models you should be able to name:

- **Strong** — every read sees the latest write. Needed for: account balances,
  inventory decrements, unique-constraint enforcement.
- **Eventual** — replicas converge given time. Fine for: feeds, view counts,
  search indexes, recommendations.
- **Read-your-own-writes** — a user always sees their own changes even if others
  see stale data. The usual pragmatic compromise; implement by routing a user's
  reads to the primary briefly after they write.

**Security and cost** are NFRs, not afterthoughts. PII changes your storage and
logging design; a regulatory residency requirement changes your region topology;
cost decides whether you keep 90 days of logs or 7.

#### Capacity estimation

The point is order of magnitude, not precision. Round aggressively; say your
numbers out loud.

**Numbers worth memorising:**

```
1 day            ≈ 86,400 s  ≈ 10^5 s        (use 100,000 — it simplifies everything)
1 million/day    ≈ 12 requests/s
1 billion/day    ≈ 12,000 requests/s
1 KB × 1M        = 1 GB
1 KB × 1B        = 1 TB
Peak traffic     ≈ 2–3× average
```

**Latency ladder (approximate, orders of magnitude are what matter):**

```
L1 cache reference            ~1 ns
Main memory reference         ~100 ns
SSD random read               ~100 µs        (1,000× slower than RAM)
Network round trip, same DC   ~0.5 ms
MySQL indexed query, same DC  ~1–10 ms
Disk (HDD) seek               ~10 ms
Network round trip, cross-continent ~150 ms
```

The lesson encoded here: a cache hit is ~100× faster than a database query, and a
cross-region call costs more than 100 local queries. That single comparison
justifies most caching and data-locality decisions you will make.

**A worked estimation — a URL shortener:**

```
Given:   100M new URLs/day, 100:1 read:write ratio, 5-year retention

Writes:  100M / 100,000 s   = 1,000 writes/s
         peak (3×)          = 3,000 writes/s
Reads:   1,000 × 100        = 100,000 reads/s
         peak               = 300,000 reads/s

Storage: 500 bytes/record × 100M/day = 50 GB/day
         × 365 × 5                   = ~90 TB over 5 years

Cache:   80/20 rule — 20% of URLs serve 80% of traffic
         daily reads ≈ 8.6B; hot set ≈ 20% of a day's URLs
         100M × 20% × 500 B          = 10 GB → fits comfortably in Redis

Bandwidth: 3,000 writes/s × 500 B    = 1.5 MB/s in
           300,000 reads/s × 500 B   = 150 MB/s out
```

Now every subsequent decision is justified by a number: 300k reads/s means a
single MySQL primary cannot serve reads (so: cache + replicas); 90 TB means a
single instance cannot hold the data (so: sharding or a different store); 10 GB
of hot data means the cache is cheap and obviously worth it.

### 5. The estimation template

Ask for, or assume and state: **DAU**, **actions per user per day**, **read:write
ratio**, **average record size**, **retention period**, **peak multiplier**. Six
numbers give you everything above.

### 6. Small example — how one NFR changes the design

Same feature — "user posts a message, followers see it":

| NFR | Resulting design |
|---|---|
| 1k users, staleness fine | One Node service, one MySQL, query on read (fan-out on read) |
| 10M users, 200ms p99 | Precompute feeds on write into Redis (fan-out on write) |
| 10M users, one has 100M followers | Hybrid: fan-out on write for normal users, on read for celebrities |
| Must never lose a post | Write to durable store first, fan out asynchronously from a queue |
| Global audience | Multi-region with regional read replicas and a CDN for media |

Nothing about the feature changed. Every row is a different system.

### 7. Real backend usage

- Choosing read replicas versus caching based on a measured read:write ratio.
- Setting a cache TTL from an agreed staleness budget rather than a guess.
- Justifying a second availability zone with a downtime-cost calculation.
- Rejecting a Kafka proposal because 200 events/s does not need it.

### 8. Edge cases

- **Peak vs average.** A system sized for average traffic fails at 9am Monday.
  Always apply a peak multiplier, and consider *spikes* separately (a flash sale,
  a push notification sent to 10M users at once — that is not 3×, it is 100×).
- **Hot keys.** Average load can be fine while one key melts one shard — a
  celebrity account, a single viral URL. Uniform-distribution assumptions are
  usually wrong.
- **The tail dominates user experience.** A page making 20 backend calls, each with
  a 1% chance of being slow, is slow about 18% of the time. This is why p99 of
  *dependencies* matters more than it seems.
- **Growth changes the answer.** A design correct for 10k users and one correct for
  10M are different; state which you are designing for and where the boundary is.
- **Availability of composites.** Adding a dependency lowers your ceiling. Every
  synchronous external call in the request path is a new failure mode.

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Designing before asking for NFRs | Every choice is unjustified | Spend the first 5 minutes on requirements |
| Quoting average latency | Hides the tail where users actually suffer | Always p95/p99 |
| Skipping estimation | Cannot justify sharding, caching or replica count | Do the arithmetic out loud |
| Assuming uniform load | Real traffic is hot-key skewed and spiky | Consider hot keys and spikes explicitly |
| Reaching for Kafka/microservices/sharding by default | Enormous complexity for no benefit | State the scale at which the simple design fails |
| Treating CAP as a permanent three-way choice | Misunderstands the theorem | Use PACELC framing |
| Ignoring cost | Designs that are technically fine and unaffordable | Sanity-check the machine count |
| Not stating assumptions | Interviewer cannot follow your reasoning | Say every assumption aloud |

### 10. Interview answer

> I start by separating functional from non-functional requirements, because the
> architecture is driven almost entirely by the non-functional ones — scale,
> latency percentiles, availability target, consistency tolerance, read/write
> ratio and data size. Then I do a rough capacity estimate: daily active users,
> actions per user, read:write ratio, record size and retention give me requests
> per second, storage over the retention window and the hot-set size for caching.
> Those numbers justify every later decision. On consistency I use PACELC rather
> than CAP, because the interesting trade-off usually isn't during a partition,
> it's the everyday one between replication latency and staleness. And I try to
> state the scale at which my simple design stops working, rather than starting
> complicated.

### 11. Practice problems

1. Estimate QPS, storage over 5 years and hot-set size for: Twitter posts,
   WhatsApp messages, Uber ride requests, YouTube uploads. Do each in under 5
   minutes using the round numbers above.
2. For a service with 99.9% availability calling three dependencies each at 99.9%,
   compute the composite availability. Then compute it with a cache fallback that
   works when one dependency is down.
3. Take a feature you have built and write its NFR table. Then identify which NFR,
   if tightened 10×, would force a redesign.
4. Calculate the monthly cost of storing 90 TB in object storage versus a managed
   relational database. Note the factor.
5. For a system you know, compute what percentage of requests are slow if a page
   makes N backend calls each with a 1% slow rate, for N = 5, 20, 50.

### 12. Production considerations

- **Measure before you estimate.** In a real system you have data; use p99 from
  your metrics, not guesses. Estimation is for systems that do not exist yet.
- **Define SLIs and SLOs**, not vague goals: "99.9% of GET /orders return in under
  300ms, measured over 30 days." An error budget derived from the SLO tells you
  when to stop shipping features and fix reliability.
- **Load-test against the estimate.** An estimate nobody validated is a hypothesis.
- **Re-estimate on growth.** Revisit when traffic changes by 10×, not when
  something breaks.
- **Record the decision.** A short ADR ("we chose eventual consistency for feeds,
  accepting 5s staleness, because…") saves the next engineer a month.

---

## 11.2 Core Components

Each component below follows the same shape: **what it is**, **the problem it
solves**, **how it works**, **backend usage**, and **when not to use it**. The
last one matters most — a design is judged as much by what you left out.

---

### Load Balancer

**What.** Distributes incoming traffic across multiple backend instances.

**Problem solved.** One server has a capacity ceiling and is a single point of
failure.

**How it works.** Two layers matter:

- **L4 (transport)** — routes by IP and port without reading the request. Fast,
  protocol-agnostic, cheap. Used for raw TCP, databases, very high throughput.
- **L7 (application)** — reads the HTTP request, so it can route by path, host or
  header, terminate TLS, retry idempotent requests and do canary splits. Slightly
  slower, far more capable. This is what you usually want for an API.

Algorithms: round robin, weighted round robin, **least connections** (best default
for variable request durations), IP hash (sticky by client), consistent hashing
(for cache affinity).

**Health checks** are the part people forget — the load balancer must remove an
unhealthy instance automatically. Distinguish *liveness* (is the process alive?)
from *readiness* (can it serve traffic right now? — dependencies up, warm-up done).
Getting readiness wrong causes deploys that send traffic to instances that aren't
ready yet.

**Backend usage.** In front of your Node fleet; between services; in front of
read replicas.

**When not to use it.** A single instance with no availability requirement, or
where a managed platform already provides it. Also note Node's own `cluster`
module balances across CPU cores on *one* machine — that is a different concern and
does not replace a load balancer.

---

### Reverse Proxy

**What.** A server sitting in front of application servers, receiving client
requests on their behalf.

**Problem solved.** Cross-cutting concerns — TLS, compression, static files,
buffering, header manipulation — that you do not want in application code.

**How it works.** Nginx/Envoy/Caddy terminate TLS, serve static assets directly
from disk, gzip/brotli responses, buffer slow client uploads so your Node process
isn't tied up, and forward the rest upstream. Node is single-threaded per process,
so offloading TLS and compression genuinely matters.

**Relationship to a load balancer:** overlapping but not identical. Every load
balancer is a reverse proxy; not every reverse proxy balances load. In practice
one Nginx/Envoy instance often does both.

**Backend usage.** Nginx in front of Node; Envoy as a service-mesh sidecar.

**When not to use it.** Behind a managed L7 load balancer that already does TLS
and compression — a second proxy adds a hop for nothing.

---

### API Gateway

**What.** A single entry point for clients that handles concerns shared across
many services.

**Problem solved.** Without it, every service re-implements authentication, rate
limiting, versioning and request logging — and clients must know about each
service's address.

**How it works.** Routes by path to backend services, and centralises:
authentication and token validation, rate limiting and quotas, request/response
transformation, API-key management, request ID injection, usage analytics, and
sometimes response aggregation (one client call fanning out to three services).

**Backend usage.** Public APIs with tiered plans; mobile clients (a BFF —
backend-for-frontend — is a gateway shaped for one client type); multi-service
architectures.

**When not to use it.** A single monolithic service — the gateway is then just
another hop and another thing to operate. Also beware it becoming a god
component: business logic in the gateway is the classic anti-pattern, because it
becomes a deployment bottleneck every team must coordinate through.

---

### Application Servers

**What.** The processes running your business logic — your Node/Express services.

**How it works, and the one rule.** **Keep them stateless.** No session data in
process memory, no uploaded files on local disk, no in-memory counters that
matter. Statelessness is what makes horizontal scaling, rolling deploys and
instance replacement trivial. Push state to Redis, object storage or the database.

Node specifics worth knowing: one process uses one CPU core for JavaScript, so run
one process per core (via `cluster`, PM2 or, better, one container per core
managed by the orchestrator). CPU-bound work blocks the event loop and destroys
tail latency — move it to a worker thread or a separate job service (Phase 15).
Implement **graceful shutdown**: stop accepting new connections on `SIGTERM`, drain
in-flight requests, close the DB pool, then exit. Without it, every deploy drops
requests.

**When not to use more of them.** When the bottleneck is the database. Adding app
servers in front of a saturated MySQL primary makes things worse, not better —
more connections, more contention. Identify the actual bottleneck first.

---

### Cache

**What.** A fast store holding frequently-accessed data closer to the consumer.

**Problem solved.** Databases are ~100× slower than memory and much harder to
scale horizontally.

**How it works.** Where caches live, from client outward: browser → CDN → API
gateway → application memory → distributed cache (Redis) → database buffer pool.

**Patterns:**

- **Cache-aside (lazy loading)** — the app checks the cache, misses, reads the DB,
  writes the cache. The default. Simple; first request after a miss is slow; can
  serve stale data until TTL.
- **Read-through** — the cache itself loads on miss. Same behaviour, logic moved
  into the cache layer.
- **Write-through** — write to cache and DB together. Cache always fresh; writes
  are slower.
- **Write-behind** — write to cache, flush to DB asynchronously. Fast writes; risk
  of data loss on crash.
- **Refresh-ahead** — proactively refresh hot keys before expiry.

**Eviction:** LRU (default, good general choice), LFU (better for stable hot
sets), TTL (the safety net — set one on everything).

**The three failure modes you must be able to name:**

- **Cache stampede / thundering herd** — a hot key expires and 10,000 requests hit
  the database simultaneously. Fix: a per-key lock so one request repopulates
  while others wait, or probabilistic early expiry, or never expiring hot keys and
  refreshing them out of band.
- **Cache penetration** — repeated requests for a key that does not exist bypass
  the cache every time. Fix: cache the negative result with a short TTL, or a
  Bloom filter.
- **Cache avalanche** — many keys expire at the same moment (common when a batch
  job populated them). Fix: randomised jitter on TTLs.

**Invalidation:** TTL-based (simple, bounded staleness), event-based (precise,
more machinery), or versioned keys (`user:123:v7` — never invalidate, just bump
the version; my usual recommendation because it avoids the delete-race entirely).

**Backend usage.** Session storage, rate-limiter counters, hot entity reads,
computed feeds, query-result caching, idempotency keys, distributed locks.

**When not to use it.** Write-heavy data with low re-read rates (you pay
invalidation cost for no hit rate), data requiring strict consistency, or data so
cheap to compute that the network round trip to Redis costs more than the query.
Also: a cache is not a database. If losing it takes your system down, you have
built a database with no durability guarantees.

---

### Relational Database

**What.** Structured tables with a schema, relationships and ACID transactions.

**Problem solved.** Correctness under concurrency, enforced by the storage layer
rather than hoped for in application code.

**How it works (the parts relevant to HLD — details in Phase 6):** B+tree indexes,
a write-ahead log for durability, MVCC for concurrent reads, and the ACID
guarantees. The HLD-level scaling ladder:

1. **Indexes and query tuning** — by far the highest return; most "we need to
   shard" conclusions are actually missing indexes.
2. **Vertical scaling** — a bigger box gets you remarkably far. A well-tuned MySQL
   instance handles thousands of writes/s and tens of thousands of reads/s.
3. **Read replicas** — asynchronous replication scales reads. Cost: replication
   lag, so reads can be stale by milliseconds to seconds. Handle
   read-your-own-writes by routing a user's reads to the primary for a few seconds
   after they write.
4. **Caching** — offload repeated reads entirely.
5. **Vertical partitioning** — split tables by column groups or move a table group
   to its own instance.
6. **Sharding** — horizontal partitioning across instances. The last resort,
   because it costs you: cross-shard joins, cross-shard transactions,
   resharding pain, and hot-shard risk. Choose the shard key on access pattern
   (`tenant_id`, `user_id`) and prefer **consistent hashing** so adding a shard
   moves ~1/N of the data rather than all of it.

**When not to use it.** Genuinely schemaless data, extreme write volume of
low-value events (metrics, logs, clickstreams), or documents whose access pattern
is always "fetch the whole thing by ID". Note the modern caveat: PostgreSQL and
MySQL both handle JSON columns well, so "we need NoSQL for flexible fields" is
usually false.

---

### NoSQL Databases

**What.** Non-relational stores, each trading a relational guarantee for a
specific benefit.

**The families:**

| Type | Model | Good at | Examples | Backend use |
|---|---|---|---|---|
| **Key-value** | `key → blob` | O(1) lookup, huge throughput | Redis, DynamoDB | Sessions, counters, caches |
| **Document** | JSON documents | Flexible schema, whole-object reads | MongoDB | Catalogues, CMS, user profiles |
| **Wide-column** | Row key + column families | Massive write throughput, time-series | Cassandra, HBase | Event logs, messages, metrics |
| **Graph** | Nodes and edges | Multi-hop relationship traversal | Neo4j | Social graphs, fraud rings, recommendations |
| **Time-series** | Timestamped points | Time-range queries, downsampling | InfluxDB, Timescale | Metrics, IoT, monitoring |

**The real trade-off.** NoSQL stores generally give you horizontal scale and
flexible schema, and take away: multi-key ACID transactions (mostly), ad-hoc
queries (you must design the table around the query, not the other way round),
joins, and — with eventual consistency — read-your-own-writes by default.

**The decision heuristic.** Start relational. Move a *specific workload* to a
specialised store when it has a specific need: a write-heavy event stream to
Cassandra, a session store to Redis, a search workload to Elasticsearch. Polyglot
persistence per workload is normal; replacing your primary store wholesale rarely
is.

**When not to use it.** When you need transactions across entities, when your
query patterns are still changing, or when the team has no operational experience
with it. "NoSQL scales better" is not a reason on its own.

---

### Object Storage

**What.** Flat storage of immutable blobs addressed by key, over HTTP.

**Problem solved.** Files do not belong in a database (bloats backups, wastes
buffer pool, slow) and do not belong on app-server disks (breaks statelessness).

**How it works.** Practically unlimited capacity, extremely high durability
(replicated internally), cheap, with storage classes trading retrieval latency
for cost. Key patterns for backend work:

- **Pre-signed URLs** — the client uploads directly to storage and downloads
  directly from it, bypassing your servers entirely. This is the single most
  important object-storage pattern: it removes your bandwidth and your event loop
  from the file path. Your API only issues a time-limited signed URL.
- **Multipart upload** for large files with resumability.
- **Lifecycle policies** to move old objects to cold tiers or delete them.
- Metadata lives in your database; the blob lives in storage; the DB row holds the
  key.

**Backend usage.** User uploads, generated reports and exports, video/image
originals, backups, data-lake storage.

**When not to use it.** Small, frequently-mutated values (it is immutable-oriented
and each operation is an HTTP call), or anything needing a query more complex than
"get by key" — object storage has no query language.

---

### CDN

**What.** Geographically distributed edge servers caching content near users.

**Problem solved.** The speed of light. A round trip from Mumbai to Virginia costs
~200ms no matter how fast your server is.

**How it works.** The user resolves to the nearest edge; on a cache hit, the edge
responds directly; on a miss, it fetches from origin and caches per your
`Cache-Control` headers. Beyond static assets, modern CDNs terminate TLS at the
edge, absorb DDoS traffic, and can run edge compute.

Controls to know: `Cache-Control: max-age` / `s-maxage`, `stale-while-revalidate`
(serve stale while refreshing — excellent for perceived latency), cache keys
(careful: varying on a cookie destroys your hit rate), and purging/invalidation
(slow and often rate-limited, which is why **content-hashed filenames**
(`app.7f3a9c.js`) are the standard answer — never invalidate, just change the URL).

**Backend usage.** Static assets, images and video, public API responses that
tolerate staleness, signed-URL media delivery.

**When not to use it.** Personalised or authenticated responses (hit rate near
zero, and a misconfigured cache key leaks one user's data to another — a real and
severe failure mode), or rapidly-changing data.

---

### Message Broker

**What.** Middleware that accepts messages from producers and delivers them to
consumers, decoupling the two in time.

**Problem solved.** Synchronous coupling. If checkout must wait for email sending,
email downtime breaks checkout, and a traffic spike in one propagates to all.

**Two models:**

- **Queue (point-to-point)** — each message is processed by one consumer. Work
  distribution. RabbitMQ, SQS, BullMQ (Redis-based, common in Node).
- **Log / pub-sub (Kafka)** — messages are appended to a partitioned, retained log;
  multiple independent consumer groups read at their own offsets, and can replay.
  Kafka's distinguishing features are retention and replay, plus ordering *within a
  partition*.

**The guarantees you must be able to discuss:**

- **At-most-once** — may lose messages. Rarely acceptable.
- **At-least-once** — may deliver duplicates. **The realistic default.**
- **Exactly-once** — extremely hard end-to-end; what is usually meant is
  at-least-once delivery plus **idempotent consumers**. Say it that way.

Because duplicates are a certainty, **every consumer must be idempotent** — keyed
by a message or business ID, with the processed set recorded. This is the single
most important operational fact about queues.

Also required: **dead-letter queues** for messages that fail repeatedly (otherwise
one poison message blocks the partition forever), **retry with exponential backoff
and jitter**, and **consumer lag monitoring** — lag is the metric that tells you
consumers cannot keep up, and it is the first thing to alert on.

**Backend usage.** Email/SMS dispatch, image and video processing, webhooks,
search indexing, audit trails, cross-service events, smoothing traffic spikes.

**When not to use it.** When the caller needs the result immediately (that's an
RPC), for low volumes where a database-backed job table is simpler to operate, or
when ordering requirements are strict and global — global ordering across
partitions is not something brokers give you cheaply.

---

### Search Engine

**What.** An inverted-index store built for full-text relevance queries.

**Problem solved.** `LIKE '%term%'` cannot use an index, does not rank results,
does not handle typos, stemming, synonyms or faceting, and gets slower linearly
with data size.

**How it works.** Documents are analysed (tokenised, lowercased, stemmed, stop
words removed) into an inverted index mapping term → document list, then scored by
relevance (BM25). Elasticsearch/OpenSearch add distributed sharding, aggregations
for facets, and fuzzy matching for typo tolerance.

**The critical design point:** the search index is a **derived store**, never the
source of truth. Your database owns the data; the index is populated from it
asynchronously (via CDC or an event stream), which means it is eventually
consistent, and it must be rebuildable from scratch. Treat a lost index as an
inconvenience, not a data loss.

**Backend usage.** Product search, log search, autocomplete, faceted filtering,
analytics aggregations.

**When not to use it.** Exact-match lookups by ID (the DB is faster and simpler),
as a primary datastore, or when MySQL full-text indexes or PostgreSQL `tsvector`
would suffice — for a modest catalogue they often do, and the operational burden
of Elasticsearch is significant.

---

### Monitoring System

**What.** The infrastructure that tells you what your system is doing.

**Problem solved.** You cannot operate what you cannot see, and "users told us"
is not a detection mechanism.

**The three pillars:**

- **Metrics** — numeric time series, cheap and aggregatable. Prometheus/StatsD.
  Best for: rates, error percentages, latency percentiles, saturation.
- **Logs** — discrete structured events. Best for: explaining *why* one specific
  request behaved oddly. Must be structured JSON with a correlation ID, or they
  are not searchable at scale.
- **Traces** — one request's path across services with timing per hop. OpenTelemetry.
  Best for: finding which of eleven services caused a slow request.

**What to actually measure.** The **four golden signals**: latency (percentiles,
split by success and failure), traffic, errors, saturation (how full is the
resource — CPU, memory, connection pool, queue depth). For Node specifically, add
**event-loop lag** — it is the single most diagnostic Node metric, because a
blocked event loop shows up as universal slowness with idle CPU-per-request.

**Alerting.** Alert on **symptoms users feel** (error rate, latency SLO burn),
not on causes (CPU at 80% is not a problem if latency is fine). Every alert should
be actionable and have a runbook; alerts that fire regularly and are ignored are
worse than no alerts, because they train the team to ignore the ones that matter.

**When not to use more of it.** Tracing every request at full sample rate is
expensive — sample, but always keep errors and slow requests. Logging every
request body is both costly and a PII liability.

---

### Component selection summary

| Symptom | Component |
|---|---|
| One server can't handle traffic / is a SPOF | Load balancer + more stateless instances |
| TLS, compression, static files in app code | Reverse proxy |
| Every service re-implements auth and rate limiting | API gateway |
| Same DB query repeated thousands of times/s | Cache |
| Reads outgrow one DB instance | Read replicas (then cache, then shard) |
| Users far from your region are slow | CDN |
| A slow side effect blocks the main request | Message broker + worker |
| Files bloating the database | Object storage + pre-signed URLs |
| `LIKE '%x%'` is slow and unranked | Search engine |
| "Is it down?" answered by users | Monitoring |

---

## 11.3 System Design Process

The 13-step sequence from the roadmap, with what each step actually means, the
time to spend on it in a 45-minute interview, and then a complete worked example.

### The sequence

| # | Step | Time | What it means |
|---|---|---|---|
| 1 | Clarify requirements | 4 min | Ask; never assume silently |
| 2 | Define scope | 2 min | Say what you are *not* building |
| 3 | Estimate traffic and storage | 4 min | Six numbers → QPS, storage, cache size |
| 4 | Define APIs | 3 min | The contract; reveals the data model |
| 5 | Define data model | 4 min | Tables/collections, keys, indexes |
| 6 | Draw high-level architecture | 5 min | Boxes and arrows, simplest version first |
| 7 | Explain request flow | 3 min | Walk one read and one write end to end |
| 8 | Identify bottlenecks | 4 min | Where does this break first? |
| 9 | Add scaling strategy | 5 min | Fix the bottleneck you just named |
| 10 | Explain failure handling | 4 min | What happens when each box dies |
| 11 | Explain security | 2 min | Auth, data protection, abuse |
| 12 | Explain monitoring | 2 min | What you'd alert on |
| 13 | Discuss trade-offs | 3 min | What you chose and what it cost |

**The two rules that matter more than the steps.** First, **start simple and
evolve**: draw the three-box version, then let bottlenecks force each addition.
A design that arrives fully distributed looks memorised; a design that grows
under pressure looks understood. Second, **narrate**. Silence is unassessable. Say
"I'm assuming X", "this will break at Y", "I'm choosing A over B because C".

---

### Worked example: URL Shortener, all 13 steps

#### 1. Clarify requirements

*Asked:* Custom aliases? Expiry? Analytics? Authenticated users? Link deletion or
editing? Redirect type? Global audience?

*Answers assumed and stated:* custom aliases optional; links expire after 5 years
by default; click counts needed but may be approximate and delayed; anonymous
creation allowed with rate limits; no editing; 302 redirects (so we keep counting
clicks); global audience.

**Functional:** shorten a long URL to a short one; redirect; optional custom
alias; optional expiry; click analytics.

**Non-functional:** 100M new URLs/day; 100:1 read:write; redirect p99 under 100ms
globally; 99.99% availability for redirects (higher than for creation — a nice
distinction to raise); short codes must never collide; click counts may be
eventually consistent.

#### 2. Define scope

**In:** creation, redirection, custom aliases, basic click counting, rate limiting.
**Out:** user accounts and dashboards, link editing, QR generation, fraud/malware
scanning (mentioned as a real-world necessity), detailed geo/device analytics.

#### 3. Estimate

As computed in 11.1: **1,000 writes/s** (3,000 peak), **100,000 reads/s** (300,000
peak), **~90 TB over 5 years**, **~10 GB hot cache set**, **150 MB/s egress**.

Key conclusion to say out loud: *reads are 100× writes, and the hot set fits in
memory — so this is fundamentally a caching problem, not a database problem.*

Short-code length: base62 (`a-zA-Z0-9`). 62^7 ≈ 3.5 trillion. We need 100M/day ×
365 × 5 ≈ 180 billion. **7 characters** is sufficient with room to spare.

#### 4. Define APIs

```
POST /api/v1/urls
  body:    { "longUrl": "https://...", "customAlias?": "my-link", "expiresAt?": "..." }
  201:     { "shortUrl": "https://sho.rt/aB3xK9p", "code": "aB3xK9p", "expiresAt": "..." }
  409:     alias already taken
  400:     invalid URL
  429:     rate limited

GET /{code}
  302:     Location: <longUrl>     (Cache-Control: private, max-age=0)
  404:     unknown or expired code

GET /api/v1/urls/{code}/stats
  200:     { "code": "...", "clicks": 10423, "createdAt": "...", "lastClickAt": "..." }
```

#### 5. Data model

```sql
CREATE TABLE urls (
  code          VARCHAR(16)  NOT NULL,
  long_url      VARCHAR(2048) NOT NULL,
  created_at    DATETIME(3)  NOT NULL,
  expires_at    DATETIME(3)  NULL,
  creator_ip    VARBINARY(16) NULL,
  PRIMARY KEY (code)
) ENGINE=InnoDB;

CREATE TABLE click_counts (
  code          VARCHAR(16) NOT NULL,
  day           DATE        NOT NULL,
  clicks        BIGINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (code, day)
);
```

Design points to state: the primary key **is** the code, so the lookup is a
single clustered-index read with no secondary index hop. Click counts are a
separate table because they are write-heavy and would otherwise cause row
contention and cache invalidation on the hot `urls` rows. There is deliberately
no index on `long_url` — deduplicating identical long URLs would require one, and
it is not worth 90 TB of index for a marginal saving.

#### 6. High-level architecture

Simplest version that satisfies the requirements:

```
                          ┌──────────┐
   Client ───▶ CDN/edge ─▶│   LB     │
                          └────┬─────┘
                               │
                   ┌───────────┴───────────┐
                   ▼                       ▼
            ┌─────────────┐         ┌─────────────┐
            │ Redirect    │         │ Write       │
            │ service (N) │         │ service (M) │   M ≪ N
            └──────┬──────┘         └──────┬──────┘
                   │                       │
            ┌──────▼──────┐                │
            │   Redis     │                │
            │  (hot set)  │                │
            └──────┬──────┘                │
                   │  miss                 │ writes
            ┌──────▼───────────────────────▼──────┐
            │     Sharded MySQL (by code hash)    │
            │     primary + read replicas         │
            └─────────────────────────────────────┘
                   │
            ┌──────▼──────┐      ┌──────────────┐
            │ Click queue │ ───▶ │ Analytics    │
            │  (Kafka)    │      │ aggregator   │
            └─────────────┘      └──────────────┘
```

Note the read and write paths are **separate services** — they have a 100:1
traffic ratio, different availability targets and different scaling profiles.
Splitting them is justified by the numbers, not by fashion.

#### 7. Request flow

**Write (create):**
1. Client `POST /api/v1/urls`.
2. Gateway rate-limits by IP.
3. Service validates the URL (scheme, length, blocklist).
4. Generates a code (see below) or validates the requested custom alias.
5. `INSERT` with the code as primary key — a duplicate-key error is the collision
   check, done by the database rather than a racy `SELECT` first.
6. Writes into Redis optimistically (new links are often clicked immediately).
7. Returns 201.

**Read (redirect):**
1. Client `GET /aB3xK9p`.
2. Redis lookup — ~95% hit rate expected. Hit → 302 immediately.
3. Miss → read from the shard holding that code, populate Redis with TTL, 302.
4. Not found or expired → 404 (and cache the negative result briefly, to stop
   penetration attacks from scanning random codes).
5. Emit a click event to Kafka **after** responding (never block the redirect on
   analytics).

**Code generation** — three options worth comparing out loud:

| Approach | Pros | Cons |
|---|---|---|
| Random base62 + retry on collision | Stateless, unguessable | Collisions rise as space fills; extra DB check |
| Hash of URL (MD5, truncated) | Deduplicates identical URLs | Collisions need handling; guessable; same URL → same code (a privacy issue) |
| **Counter + base62 encode** | No collisions at all, short codes | Needs a distributed counter; sequential codes are enumerable |

My pick: **pre-generated key ranges**. A key-generation service hands each write
instance a block of 10,000 codes from a central counter; the instance serves from
its block in memory. This gives zero collisions, no per-write coordination, and no
database round trip for generation. Codes are shuffled within the block to avoid
trivial enumeration. State the cost: a crashed instance loses its unused block —
which is fine, because the space is 3.5 trillion.

#### 8. Bottlenecks

- **Redirect QPS (300k peak)** — no single instance or database serves this.
- **Database storage (90 TB)** — exceeds a single instance.
- **Click writes (300k/s)** — cannot be synchronous `UPDATE ... SET clicks = clicks+1`;
  that row would be a contention hotspot even before the volume issue.
- **Hot keys** — one viral link can concentrate a large fraction of all traffic on
  a single Redis key and a single shard.
- **Global latency** — a user in Sydney hitting a US origin cannot make 100ms p99.

#### 9. Scaling strategy

- **Cache first.** Redis cluster holding the 10 GB hot set; ~95% of redirects
  never touch MySQL. This single decision removes most of the load.
- **Shard MySQL by `hash(code)`** — the access pattern is always by primary key, so
  there are no cross-shard queries at all. This is the ideal sharding case and
  worth saying so.
- **Read replicas** per shard for cache-miss reads.
- **Click counts through Kafka**, aggregated in batches and written periodically.
  300k events/s of "increment" become a few thousand batched updates/s. Trade-off:
  counts lag by a minute — which we agreed was acceptable in step 1.
- **Hot keys:** an in-process LRU (a few thousand entries) in front of Redis
  absorbs the viral link entirely at the application layer.
- **Geography:** deploy redirect service + Redis replicas in multiple regions, with
  GeoDNS/anycast routing. The URL mapping is immutable once created, which makes
  global replication trivially safe — a very convenient property to point out.
- **Scale read and write fleets independently**, at roughly 100:1.

#### 10. Failure handling

| Failure | Behaviour |
|---|---|
| Redis down | Fail open to MySQL — degraded latency, still correct. Circuit-break to avoid piling connections onto the DB. |
| One shard down | Only codes on that shard 404/503; the rest serve normally. Blast radius = 1/N. |
| MySQL primary down | Automatic failover to replica; writes pause briefly; **redirects continue from cache** — which is why redirect availability can exceed creation availability. |
| Kafka down | Buffer click events locally with bounded size, drop on overflow. Analytics is lossy by agreement; redirects are unaffected. |
| Region down | GeoDNS routes to the next region. |
| Cache stampede after a Redis restart | Staggered warm-up + per-key locks + negative caching. |

The theme to articulate: **the redirect path degrades but never breaks**, because
it is the only thing with a 99.99% requirement.

#### 11. Security

- Rate limit creation per IP and per API key; abuse of a shortener for spam is the
  primary threat.
- Validate and normalise URLs; block `javascript:`, `data:`, internal/private IP
  ranges (**SSRF** — critical if you ever fetch the target for previews), and
  localhost.
- Integrate a malware/phishing blocklist; shorteners are a classic phishing vector.
- Do not leak the creator's identity or IP through the stats API.
- HTTPS everywhere; short codes are unguessable enough to be unlisted but should
  never be treated as a security boundary — say explicitly that a short link is
  not a secret.
- Use 302 rather than 301 so browsers do not cache the mapping forever (which
  would prevent both analytics and any future takedown).

#### 12. Monitoring

- **Golden signals per service:** redirect p50/p95/p99, error rate, RPS, saturation.
- **Cache hit ratio** — the single most important business metric here; a drop
  from 95% to 80% quadruples database load.
- **Kafka consumer lag** for the analytics pipeline.
- **Per-shard QPS and storage** — to detect hot shards and plan resharding.
- **404 rate** — a spike means either enumeration attacks or an expiry bug.
- **Alert on:** redirect error rate above 0.1%, p99 above 100ms, cache hit ratio
  below 90%, replication lag, consumer lag growth.

#### 13. Trade-offs

| Decision | Gained | Cost |
|---|---|---|
| Cache-aside with TTL | ~95% of reads never hit the DB | Brief staleness after expiry (irrelevant — mappings are immutable) |
| Async click counting | Redirect stays fast; DB survives | Counts lag ~1 minute and are lossy under failure |
| Sharding by code hash | Linear read/write scaling, no cross-shard queries | No efficient "list all URLs by creator" query |
| Pre-generated key blocks | Zero collisions, no coordination per write | Unused codes lost on crash (acceptable) |
| No URL deduplication | No huge secondary index on a 2KB column | Same URL stored many times |
| 302 over 301 | Analytics work; takedown possible | Every click hits our infrastructure (higher cost) |
| Separate read/write services | Independent scaling, isolated failure | Two deployables instead of one |

**The honest closing note** — worth saying in an interview: at 1,000 writes/s and
a 10 GB hot set, a single well-provisioned MySQL instance with Redis in front of
it would actually serve this. Sharding becomes necessary around the 90 TB storage
figure and the multi-region latency requirement, not because of QPS. Naming the
threshold at which complexity becomes necessary is the strongest thing you can do
in step 13.

---

### 11.3 — Common mistakes

| Mistake | Fix |
|---|---|
| Drawing boxes before asking questions | Requirements first, always |
| Designing the fully-distributed version immediately | Start simple; let bottlenecks force each addition |
| Silence while thinking | Narrate assumptions and reasoning continuously |
| No numbers | Six inputs → QPS, storage, cache size; do it out loud |
| Listing components without justification | Every box answers a named bottleneck |
| Ignoring the failure section | It is where senior candidates separate themselves |
| Refusing to name a trade-off | "It depends" without naming what it depends on is a non-answer |
| Over-indexing on your favourite technology | Choose from requirements, not familiarity |

---

## 11.4 HLD Practice Systems

For each: the **core difficulty** (what the problem is really testing), the
**key decisions**, and the **follow-up** you should expect. Work each one through
all 13 steps; the notes here are the skeleton, not the answer.

---

**1. URL shortener** — worked fully in 11.3.
*Core difficulty:* read-heavy caching and code generation without collisions.

---

**2. File storage platform** (Dropbox/Drive)
*Core difficulty:* large binary transfer and sync, not database design.
*Key decisions:* **pre-signed URLs so bytes never touch your servers**; chunked
upload (4–8 MB) with resumability; content-addressed chunks (SHA-256) enabling
**deduplication** — identical chunks stored once across all users; metadata DB
(file tree, versions, permissions) separate from blob storage; sync via a
per-user change journal with a monotonically increasing cursor.
*Follow-up:* "Two devices edit the same file offline." Conflict resolution —
last-writer-wins with conflict copies is the honest answer; operational
transforms/CRDTs only for collaborative documents.

---

**3. Social media feed** (Twitter/Instagram)
*Core difficulty:* the fan-out problem and the celebrity outlier.
*Key decisions:* **fan-out on write** (precompute each follower's feed into Redis
at post time — fast reads, expensive writes) vs **fan-out on read** (query
followees' posts at read time — cheap writes, slow reads). The real answer is
**hybrid**: fan-out on write for normal users, on read for accounts above a
follower threshold, merged at request time. Feed stored as a capped list of post
IDs; post bodies hydrated from cache.
*Follow-up:* "A user with 100M followers posts." That single write becomes 100M
list insertions — which is exactly why they're excluded from fan-out on write.
Also expect ranking/chronology and pagination-with-shifting-data (use cursors,
not offsets).

---

**4. Chat system** (WhatsApp/Slack)
*Core difficulty:* persistent connections, delivery semantics and ordering.
*Key decisions:* WebSocket connections held by a gateway fleet; a **connection
registry** (user → which gateway node) in Redis so messages can be routed to the
right node; messages persisted before acknowledgement; per-conversation sequence
numbers for ordering; delivery receipts (sent/delivered/read) as separate state;
offline messages queued and delivered on reconnect.
*Follow-up:* "How do you scale WebSockets?" — each node holds ~50–100k
connections; sticky routing; and the hard part, cross-node message delivery via
pub/sub. Also: group messages fan out per member; and end-to-end encryption
changes the design substantially (server can't index or search content).

---

**5. Notification service**
*Core difficulty:* multi-channel delivery with retries, preferences and rate
limits, at spiky volume.
*Key decisions:* a queue per channel; provider adapters behind one interface
(Phase 10 Adapter); template rendering separated from delivery; user preference
and quiet-hours checks in a pipeline (Chain of Responsibility); deduplication by
idempotency key; exponential backoff with a DLQ; per-user rate limiting to avoid
notification spam.
*Follow-up:* "You must send 10M push notifications in 5 minutes." Batching,
provider rate limits, partitioned parallel workers — and the realisation that
your provider, not your system, is the bottleneck.

---

**6. Video processing platform** (YouTube)
*Core difficulty:* long-running, expensive, failure-prone async pipelines.
*Key decisions:* upload direct to object storage; a job pipeline (validate →
transcode to multiple bitrates → generate thumbnails → package HLS/DASH →
publish); a worker fleet with autoscaling on queue depth; per-stage idempotency
and checkpointing so a failed 2-hour transcode resumes rather than restarts; CDN
for delivery with adaptive bitrate.
*Follow-up:* "A transcode fails at 90%." Checkpointing and per-segment processing
— split the video into segments, transcode in parallel, reassemble. This also
answers "make it faster".

---

**7. Ride booking system** (Uber)
*Core difficulty:* geospatial matching with continuously moving entities.
*Key decisions:* driver location updates every few seconds (very high write
volume → Redis/in-memory, not your primary DB); **geospatial indexing** with
geohash, S2 cells or H3 to find nearby drivers by prefix query; a matching
service holding supply state per cell; trip state machine (Phase 10); surge
pricing computed per cell on a delay; payment after trip completion via a saga.
*Follow-up:* "Two riders match the same driver simultaneously." A distributed
lock or an atomic conditional claim on the driver record — the same concurrency
answer as Phase 10's parking lot, one level up.

---

**8. E-commerce platform**
*Core difficulty:* inventory correctness under concurrency, spanning many services.
*Key decisions:* catalogue in a read-optimised store + search engine; **inventory
requires strong consistency** — reserve stock with a conditional update
(`UPDATE ... SET reserved = reserved + 1 WHERE available > reserved`) checking
affected rows, with a reservation TTL; cart in Redis; orders in MySQL with a
saga across payment, inventory and fulfilment; idempotency keys on checkout.
*Follow-up:* "Flash sale: 10,000 users, 100 items." Queue-based admission,
pre-reserved inventory tokens, and accepting that most requests must be rejected
fast rather than queued slow.

---

**9. Payment system**
*Core difficulty:* correctness under partial failure. This is the strictest
problem on the list.
*Key decisions:* **idempotency keys on every mutating operation**, stored with the
result so a retry returns the original response; **double-entry ledger** (every
transaction is balanced debits and credits, append-only, never updated) as the
source of truth; payment state machine with explicit `PENDING`; provider webhooks
for asynchronous confirmation, themselves idempotent and signature-verified; a
**reconciliation job** comparing your ledger to the provider's daily.
*Follow-up:* "The network drops after you charge but before the response
arrives." The canonical answer: the operation is idempotent by key, the state is
`PENDING` not `FAILED`, a reconciliation job resolves it, and you never
auto-retry a charge without the same idempotency key. Also expect: "how do you
ensure you never double-charge?" and "PCI scope — why you don't store card numbers."

---

**10. Learning management system**
*Core difficulty:* mostly a modelling and access-control problem, not a scale one.
*Key decisions:* course/module/lesson hierarchy; enrolment and progress tracking
(high write volume of small updates → batch them); video via CDN with signed URLs
so content can't be shared; quiz/assessment state; certificate generation as an
async job; RBAC across instructor/student/admin.
*Follow-up:* "Prevent course content piracy." Signed, short-lived, per-user URLs;
DRM if genuinely required; watermarking — and the honest admission that
determined piracy cannot be fully prevented.

---

**11. Live training platform**
*Core difficulty:* real-time media at scale, which is a different discipline from
request/response.
*Key decisions:* WebRTC for small interactive sessions (mesh up to ~4, SFU beyond);
HLS/LL-HLS for one-to-many broadcast with thousands of viewers (higher latency,
far cheaper); recording pipeline reusing the video-processing design; chat and
Q&A over WebSockets; attendance and engagement events to an analytics stream.
*Follow-up:* "500 participants, all with video." An SFU with simulcast and
selective forwarding — and the recognition that you must limit visible streams,
because the bottleneck is client bandwidth and decoding, not your server.

---

**12. Library management system**
*Core difficulty:* the gentlest system here; it tests clean modelling and honest
simplicity.
*Key decisions:* `Book` (title) vs `BookCopy` (physical item) — the same
distinction as Phase 10; loan and reservation state machines; fine calculation as
a strategy; notification for due dates via a scheduled job.
*Follow-up:* "Do you need microservices?" **No.** The right answer is a modular
monolith with MySQL, and the ability to say so confidently is the point of this
problem appearing on the list.

---

**13. Search autocomplete**
*Core difficulty:* extremely low latency (under ~50ms) on every keystroke.
*Key decisions:* a **trie** of prefixes with the top-k completions precomputed and
stored **at each node** (the central trick — no ranking work at query time);
served from memory, replicated to every node; built offline from query logs and
rebuilt periodically rather than updated live; debouncing on the client; results
cached at the CDN/edge for popular prefixes; personalisation layered on top as a
re-rank of the precomputed set.
*Follow-up:* "How do trending queries appear within minutes?" A fast path that
merges a small real-time layer over the offline-built trie.

---

**14. API analytics platform**
*Core difficulty:* enormous write volume of low-value events, queried as
aggregates.
*Key decisions:* events to Kafka, never directly to a database; stream processing
for pre-aggregation into time buckets; a **time-series or columnar store**
(ClickHouse, Timescale) rather than row-oriented MySQL; downsampling and retention
tiers (per-second for 24h, per-minute for 7d, per-hour for a year); approximate
algorithms where exactness isn't needed — **HyperLogLog** for unique counts,
**t-digest** for percentiles. Both are worth naming; they turn impossible
aggregations into cheap ones.
*Follow-up:* "Count unique users across a billion events." HyperLogLog — a few KB
per counter, ~2% error, and mergeable across shards.

---

**15. Multi-tenant SaaS platform**
*Core difficulty:* isolation versus cost, decided per requirement. (Phase 18
covers this in depth.)
*Key decisions:* the three isolation models — **shared schema with `tenant_id`**
(cheapest, highest cross-tenant leak risk, hardest noisy-neighbour story),
**schema per tenant** (middle ground, migration complexity grows with tenant
count), **database per tenant** (strongest isolation and easiest compliance,
most expensive). Tenant context resolved once at the edge and propagated; **every
query filtered by tenant** — enforced at the repository layer or via row-level
security, never left to individual queries; per-tenant rate limits and quotas.
*Follow-up:* **"How do you guarantee one tenant never sees another's data?"** The
answer must be structural — a mandatory filter in one place that cannot be
forgotten — not "we're careful in code review". Also expect: "one tenant is 100×
larger than the rest" (dedicated shard for that tenant, hybrid model).

---

### Patterns that recur across these fifteen

Notice how few distinct ideas actually appear:

- **Cache the hot set** — URL shortener, feed, autocomplete, e-commerce catalogue.
- **Async the slow path** — notifications, video, analytics, click counting.
- **Idempotency keys** — payments, notifications, any queue consumer.
- **State machines** — orders, rides, loans, payments, jobs.
- **Precompute at write time to make reads cheap** — feeds, autocomplete, analytics.
- **Separate the derived store from the source of truth** — search index, analytics,
  feed cache.
- **Strong consistency only where money or inventory is involved**; eventual
  everywhere else.
- **Conditional atomic updates** for the "last one available" race — rides,
  inventory, parking spots, task claims.

If you internalise these eight, most new problems become recombinations.

---

### 11.4 — Production considerations

- **The design is the easy part.** Migrations, backfills, rollout, dual-writes and
  deprecation are where the real time goes. Mentioning a migration plan for a
  design change is a strong senior signal.
- **Every arrow in your diagram is a failure mode.** Each synchronous call needs a
  timeout, a retry policy with jitter, and a circuit breaker (Phase 13). A
  diagram with no timeouts described is a diagram of a system that will cascade.
- **Data migration between stores is harder than choosing the store.** Factor it in
  before proposing "move this to Cassandra".
- **Cost sanity check.** Multiply your instance count by a rough monthly rate. If
  the answer is absurd for the business described, the design is wrong regardless
  of its elegance.
- **Capacity for growth, not just today.** State what breaks at 10× and what you'd
  change.

---

## Phase 11 Completion Checklist

You are done with this phase when you can:

- [ ] Separate functional from non-functional requirements and list the nine NFRs
      to ask about from memory.
- [ ] Convert DAU, actions/user, read:write ratio, record size and retention into
      QPS, storage and cache size in under 5 minutes.
- [ ] Recite the latency ladder well enough to justify a caching decision.
- [ ] Explain availability in nines, and why dependencies multiply.
- [ ] Explain PACELC and why it's more useful day-to-day than CAP.
- [ ] Name three consistency models and a system that needs each.
- [ ] Explain each of the twelve core components, plus when *not* to use it.
- [ ] Name and fix cache stampede, penetration and avalanche.
- [ ] Explain why exactly-once is really at-least-once plus idempotent consumers.
- [ ] Walk all 13 steps for an unfamiliar system in 45 minutes, out loud.
- [ ] Start with the simplest design and let bottlenecks justify every addition.
- [ ] State, for any design, the scale at which it stops working.
- [ ] Produce a trade-off table where every row names what was gained *and* lost.
- [ ] Design the fan-out, idempotency and multi-tenant isolation answers without
      preparation, since they appear in most problems.

**Next:** Phase 12 — API Design. Phase 11 decided the boxes and arrows; Phase 12
is the contract on each arrow — REST semantics, versioning, pagination, errors
and idempotency at the interface level.

# Phase 23 — Advanced Backend Topics (Expanded)

This expands the compressed Phase 23 topic list into full study material, following
the guide's 12-point learning order: definition, simple meaning, why it's needed,
how it works internally, syntax/API, small example, real backend usage, edge cases,
common mistakes, interview answer, practice problem, production considerations.

Overall priority: **GOOD TO KNOW initially; becomes IMPORTANT for senior roles.**

------------------------------------------------------------------------

## 23.1 Event Sourcing

**Proper definition:** Event sourcing is a persistence pattern where instead of
storing only the current state of an entity, you store the full sequence of
state-changing events that led to it. The current state is derived by replaying
events, not read directly from a "state" row.

**Simple meaning:** Instead of a `balance` column, you store `AccountOpened`,
`MoneyDeposited`, `MoneyWithdrawn` events. Balance = replay all events and sum.

**Why it is needed:**
- Gives a complete, immutable audit trail for free (who did what, when).
- Enables rebuilding state at any point in time (time travel / debugging).
- Naturally fits domains with strict audit requirements (banking, inventory,
  order lifecycles).
- Decouples "what happened" from "how we currently interpret it" — you can
  add new read models later without losing history.

**How it works internally:**
1. Every write is an **append-only** insert into an event store (never
   update/delete).
2. Each event has: `aggregateId`, `eventType`, `payload`, `version`,
   `occurredAt`.
3. To get current state, the aggregate is rebuilt by loading all events for
   that `aggregateId` in order and applying them one by one (`reduce`).
4. To avoid replaying thousands of events on every read, periodic
   **snapshots** of aggregate state are stored, and replay resumes from the
   latest snapshot forward.
5. Optimistic concurrency: each write includes the expected current version;
   if another writer already advanced the version, the write is rejected and
   retried.

**Syntax and API (conceptual, Node/TS style):**
```typescript
interface DomainEvent {
  aggregateId: string;
  type: string;
  payload: Record<string, unknown>;
  version: number;
  occurredAt: Date;
}

async function appendEvent(event: DomainEvent) {
  await db.query(
    `INSERT INTO events (aggregate_id, type, payload, version, occurred_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [event.aggregateId, event.type, event.payload, event.version, event.occurredAt]
  );
}

function rebuildAccount(events: DomainEvent[]) {
  return events.reduce((state, e) => {
    switch (e.type) {
      case "AccountOpened": return { ...state, balance: 0, status: "active" };
      case "MoneyDeposited": return { ...state, balance: state.balance + e.payload.amount };
      case "MoneyWithdrawn": return { ...state, balance: state.balance - e.payload.amount };
      default: return state;
    }
  }, {});
}
```

**Small example:** A wallet service stores `WalletCreated`, `Credited(100)`,
`Debited(30)`. Current balance (70) is computed by folding the events, not
stored directly — though a snapshot/read-model cache usually holds it for
fast reads.

**Real backend usage:** Ledger and payment systems, inventory systems that
need reconciliation, order/booking systems where "why did this happen" must
be answerable months later, collaborative editing history.

**Edge cases:**
- Schema evolution: an old event type's payload shape changes — you need
  **event upcasting** (transform old events into the new shape on read).
- Very long-lived aggregates (millions of events) — snapshotting is
  mandatory, not optional.
- Concurrent writers to the same aggregate — must enforce version checks.

**Common mistakes:**
- Using event sourcing for every entity "because it's advanced" — it adds
  real complexity and should be reserved for aggregates where history truly
  matters.
- Mixing event sourcing with direct mutation of the same table (defeats the
  append-only guarantee).
- Forgetting snapshots, causing replay to become a performance problem.
- Treating events as just a change log instead of first-class facts that
  downstream consumers depend on (breaking event shape breaks consumers).

**Interview answer (short):** "Event sourcing persists state as an ordered,
immutable sequence of domain events rather than as a mutable row. Current
state is derived by replaying events, optionally from a snapshot. It gives a
full audit trail and time-travel debugging at the cost of more complex reads
and required schema-evolution handling — so I'd use it for aggregates like
ledgers or orders where history is a business requirement, not everywhere."

**Practice problem:** Model a simple bank account as an event-sourced
aggregate with `Opened`, `Deposited`, `Withdrawn`, `Closed` events. Implement
replay, a snapshot every 100 events, and optimistic concurrency on append.

**Production considerations:** Event store choice (Postgres table vs
EventStoreDB vs Kafka topic-as-log), snapshot frequency vs storage cost,
schema versioning strategy, and a clear separation between the event store
(write side) and read models (query side) — which leads directly into CQRS
below.

------------------------------------------------------------------------

## 23.2 CQRS (Command Query Responsibility Segregation)

**Proper definition:** CQRS separates the model used to **write** data
(commands, which change state) from the model used to **read** data
(queries), often backed by physically different data stores optimized for
each side.

**Simple meaning:** Writes go through a command handler that enforces
business rules; reads go through a separate, denormalized, fast-to-query
model built specifically for the screens/APIs that need it.

**Why it is needed:**
- Write models need consistency and validation; read models need speed and
  shape flexibility (joins pre-computed, denormalized for a specific view).
  Forcing one model to do both leads to compromises on both sides.
- Pairs naturally with event sourcing: events are the write side; one or
  more projections are the read side.
- Allows independent scaling — reads are usually 10-100x more frequent than
  writes, so the read side can be cached, replicated, or use a different
  database entirely (e.g., Elasticsearch for search, Redis for hot data).

**How it works internally:**
1. A **command** (`PlaceOrder`, `CancelOrder`) is validated and processed by
   a command handler, which produces one or more events or updates the write
   store.
2. A **projector** subscribes to those events/changes and updates one or
   more **read models** (denormalized tables, search indexes, caches).
3. Queries never touch the write model directly — they read only from
   projections.
4. Because projection happens asynchronously, the read model is
   **eventually consistent** with the write model — this is the core
   tradeoff to communicate to product/UI teams.

**Syntax and API (conceptual):**
```typescript
// Command side
async function placeOrder(cmd: PlaceOrderCommand) {
  validate(cmd);
  const event = { type: "OrderPlaced", payload: cmd, occurredAt: new Date() };
  await appendEvent(event);
  await eventBus.publish(event);
}

// Read side (projector)
eventBus.subscribe("OrderPlaced", async (event) => {
  await db.query(
    `INSERT INTO order_summary_view (order_id, customer, total, status)
     VALUES ($1, $2, $3, 'PLACED')`,
    [event.payload.orderId, event.payload.customer, event.payload.total]
  );
});

// Query side — completely separate from command handling
async function getOrderSummary(orderId: string) {
  return db.query(`SELECT * FROM order_summary_view WHERE order_id = $1`, [orderId]);
}
```

**Small example:** An e-commerce order write model validates stock and
payment; a separate `order_search_view` (Elasticsearch) is updated
asynchronously so the storefront's "my orders" page is fast and independent
of write-side load.

**Real backend usage:** Dashboards/reporting built from operational data,
search-heavy product catalogs, systems where write throughput and read
throughput have very different scaling needs (ticketing platforms, order
management, analytics-heavy SaaS).

**Edge cases:**
- User writes then immediately reads their own write, but the projection
  hasn't caught up yet ("read your own write" problem) — needs a UX or
  architectural mitigation (e.g., read from write model right after a
  write, or optimistic UI updates).
- Projector failures leaving read models stale or partially updated —
  needs monitoring and a re-projection/rebuild capability.
- Multiple read models for the same events getting out of sync with each
  other.

**Common mistakes:**
- Adopting full CQRS (separate databases, async projections) for a small
  CRUD app where a single well-indexed table would do — it's a real
  complexity investment.
- Not telling frontend/product teams that reads are eventually consistent,
  leading to confusing "my change didn't show up" bug reports.
- No rebuild/replay mechanism for read models, so a bug in a projector
  means permanently corrupted read data with no fix path.

**Interview answer (short):** "CQRS splits the write path and read path
into separate models, so each can be optimized independently — the write
side enforces invariants, the read side is denormalized for query speed.
It's usually paired with events flowing from write to read side
asynchronously, which means reads are eventually consistent. I'd reach for
it when read and write scaling/shape needs genuinely diverge, not as a
default."

**Practice problem:** Take the event-sourced bank account from 23.1 and
build a read-model projector that maintains a `account_balances` table for
fast dashboard queries, kept in sync via event subscription. Simulate a
projector crash and rebuild it by replaying all events from the store.

**Production considerations:** Idempotent projectors (event redelivery must
not double-apply), a way to fully rebuild a read model from the event log,
monitoring projection lag, and clear consistency-expectation documentation
for API consumers.

------------------------------------------------------------------------

## 23.3 Change Data Capture (CDC)

**Proper definition:** CDC is the practice of capturing row-level insert,
update, and delete events from a database (typically by reading its
transaction/replication log) and streaming them to downstream consumers in
near real time.

**Simple meaning:** Instead of polling a table for changes, you tap into the
database's own internal change log (e.g., MySQL binlog, Postgres logical
replication/WAL) and get a live feed of every change as it happens.

**Why it is needed:**
- Keeps search indexes, caches, and data warehouses in sync with the
  source-of-truth database without adding write-path code to every service
  that needs the data.
- Enables event-driven architectures on top of existing relational systems
  that were never built with an event bus in mind.
- Avoids the "dual write" problem (see Data Migration / Outbox pattern
  below): writing to the DB and separately publishing an event in
  application code is not atomic; CDC reads the committed truth directly
  from the log.

**How it works internally:**
1. A CDC connector (e.g., Debezium) attaches to the database as a
   replication client, the same mechanism used for replica databases.
2. Every committed transaction's row changes appear in the log; the
   connector parses them into structured change events (before/after
   image, operation type, table, timestamp).
3. Events are published to a stream (commonly Kafka) as topics per table.
4. Downstream consumers (search indexers, cache invalidators, ETL jobs,
   other services) subscribe and react.

**Syntax and API (conceptual — Debezium-style event on Kafka):**
```json
{
  "before": { "id": 42, "status": "PENDING" },
  "after": { "id": 42, "status": "SHIPPED" },
  "source": { "table": "orders", "ts_ms": 1732000000000 },
  "op": "u"
}
```
Consumer:
```typescript
kafkaConsumer.subscribe("orders.changes");
kafkaConsumer.on("message", (msg) => {
  const change = JSON.parse(msg.value);
  if (change.op === "u" && change.after.status === "SHIPPED") {
    notifyCustomer(change.after.id);
  }
});
```

**Small example:** A CDC pipeline streams every change on the `products`
table into an Elasticsearch indexer, so search results stay in sync with
the relational database without the product service ever calling
Elasticsearch directly.

**Real backend usage:** Keeping a search index in sync with a relational DB,
feeding a data warehouse/analytics pipeline, cache invalidation at scale,
migrating from a monolith to microservices by "listening" to the old
database instead of rewriting it immediately (the strangler pattern).

**Edge cases:**
- Schema changes on the source table (added/dropped columns) must be
  handled by consumers gracefully — CDC will surface the new shape
  immediately.
- Initial snapshot vs incremental stream: a new consumer needs both a
  full historical snapshot and the ongoing stream, stitched together
  without gaps or duplicates.
- Ordering is guaranteed per-partition/per-table-key, not necessarily
  globally across tables.

**Common mistakes:**
- Treating CDC as a message queue for business events — it emits raw row
  changes, not business-meaningful events; teams often need a thin
  transformation layer on top.
- Not handling backfill/snapshot phase, causing consumers to miss history
  that existed before the pipeline started.
- Ignoring replication lag under high write load, leading to a stale
  downstream view without anyone noticing.

**Interview answer (short):** "CDC captures row-level changes directly from
a database's replication log and streams them to consumers, so systems can
react to data changes without the source application explicitly publishing
events. It solves the dual-write problem because it reads what was actually
committed, not what the application code intended to write. I'd use it to
keep a search index or cache in sync with a relational source of truth."

**Practice problem:** Set up (or design on paper) a CDC pipeline from a
`users` table to a downstream `user_search_index`, including the initial
snapshot load and ongoing incremental updates, and describe how you'd detect
and recover from consumer lag.

**Production considerations:** Connector resource usage on the source DB,
schema registry for event compatibility, exactly-once vs at-least-once
delivery guarantees downstream, and monitoring replication lag as a
first-class metric.

------------------------------------------------------------------------

## 23.4 Search Systems and Elasticsearch/OpenSearch Concepts

**Proper definition:** A search system is infrastructure specialized for
fast, relevance-ranked, full-text and faceted queries over large document
sets — a category relational databases are not optimized for.
Elasticsearch/OpenSearch are distributed, inverted-index-based search
engines commonly used to implement this.

**Simple meaning:** Instead of `LIKE '%query%'` on a SQL table (slow,
no relevance ranking), documents are indexed into a data structure built for
matching words to documents instantly, with ranking, typo-tolerance, and
filters.

**Why it is needed:**
- Relational `LIKE` queries don't scale and can't rank results by
  relevance, handle typos, or do faceted filtering efficiently.
- Product search, log search, and analytics dashboards all need
  sub-second queries over millions/billions of documents.

**How it works internally:**
1. Documents (JSON) are indexed into an **inverted index**: for every
   distinct term, a list of documents containing it (like a book's index).
2. Text is processed through an **analyzer**: tokenization, lowercasing,
   stemming, stop-word removal — so "running" and "run" can match.
3. Queries are scored using a relevance algorithm (BM25 by default),
   combining term frequency and document frequency to rank matches.
4. Data is distributed across **shards** (horizontal partitions) and
   replicated across nodes for availability and throughput.
5. Near-real-time: writes are visible to search shortly after indexing
   (a refresh interval), not instantly like a DB commit.

**Syntax and API (conceptual):**
```json
// Index a document
PUT /products/_doc/1
{ "name": "Wireless Mouse", "category": "Electronics", "price": 25 }

// Search
GET /products/_search
{
  "query": {
    "bool": {
      "must": [{ "match": { "name": "wireless mouse" } }],
      "filter": [{ "range": { "price": { "lte": 50 } } }]
    }
  }
}
```

**Small example:** A product catalog service writes to Postgres as the
source of truth, and a CDC pipeline (see 23.3) keeps an Elasticsearch index
in sync so the storefront's search bar returns typo-tolerant, ranked
results in milliseconds.

**Real backend usage:** Product search, log aggregation and analysis (the
"ELK/OpenSearch stack"), autocomplete, geospatial search, security/audit log
querying.

**Edge cases:**
- Index sync lag between the source DB and the search index (consistency
  tradeoff, same as CQRS read models).
- Mapping mismatches — indexing a field as `text` vs `keyword` changes
  whether it's full-text searched or exact-matched/aggregated.
- Reindexing at scale when the schema/analyzer changes, without downtime
  (alias-swap pattern).

**Common mistakes:**
- Using Elasticsearch as the primary database (no strong transactional
  guarantees, not built for that role) — it should usually be a derived
  read store.
- Not planning shard count up front; resizing shards later is expensive.
- Ignoring analyzer configuration, leading to poor search relevance
  ("mouse" not matching "mice").

**Interview answer (short):** "Elasticsearch is a distributed search engine
built on an inverted index, optimized for full-text, ranked, faceted
queries at scale — something relational LIKE queries can't do well. I treat
it as a derived, eventually-consistent read store fed from the primary
database via CDC or application events, not as the system of record."

**Practice problem:** Design an index mapping for a product catalog with
full-text search on `name`/`description`, exact filtering on `category`,
and range filtering on `price`; write a query combining all three with
relevance scoring.

**Production considerations:** Shard/replica sizing, mapping design up
front (hard to change later), index aliasing for zero-downtime reindexing,
and monitoring query latency/cluster health separately from the primary
database.

------------------------------------------------------------------------

## 23.5 Feature Flags and Configuration Service

**Proper definition:** A feature flag is a runtime switch that turns
behavior on/off (or routes between variants) without a code deployment. A
configuration service is centralized infrastructure for managing and
distributing such flags and other runtime configuration across services.

**Simple meaning:** `if (isEnabled("new-checkout-flow", userId)) { ... }` —
the decision is made by a config/flag service, not hardcoded, so it can
change instantly for some or all users.

**Why it is needed:**
- Decouples deployment from release: ship code dark, enable it gradually.
- Enables gradual rollouts, canary releases, A/B testing, and instant
  kill-switches for risky features — all without redeploying.
- Centralized configuration avoids config drift across service instances
  and environments.

**How it works internally:**
1. Flags are stored centrally (a config service, or a dedicated flag
   platform) with rules: percentage rollout, user/segment targeting,
   environment overrides.
2. Services evaluate flags via an SDK that caches flag state locally
   (in-memory) and refreshes periodically or via push (webhook/streaming),
   so flag checks are fast and don't hit the network on every request.
3. Evaluation is deterministic per user (usually a hash of user ID) so the
   same user consistently gets the same variant during a rollout.

**Syntax and API (conceptual):**
```typescript
const enabled = await flags.isEnabled("new-checkout-flow", {
  userId: req.user.id,
  attributes: { plan: req.user.plan }
});

if (enabled) {
  return newCheckoutHandler(req, res);
}
return legacyCheckoutHandler(req, res);
```

**Small example:** A payments team rolls out a new fraud-check algorithm to
5% of traffic, monitors error/false-positive rates, and either ramps to
100% or flips the flag off instantly if something looks wrong — with zero
deploys either way.

**Real backend usage:** Gradual rollouts of risky changes, A/B testing
infrastructure, per-tenant feature enablement in SaaS products, emergency
kill-switches for a misbehaving dependency, environment-specific
configuration (dev/staging/prod) without code branches.

**Edge cases:**
- Stale local flag cache serving an outdated decision if the refresh/push
  mechanism fails silently.
- Flag evaluation must be consistent within a single request/session (a
  user shouldn't flip between old/new UI mid-flow).
- Flag debt: flags left in code long after the rollout finishes, becoming
  permanent hidden branches nobody remembers to remove.

**Common mistakes:**
- Making flag evaluation a synchronous network call on the hot path
  instead of caching locally — adds latency and a new failure mode.
- No default/fallback behavior if the config service is unreachable
  (should fail safe, not crash the request).
- Never cleaning up flags after full rollout, leading to combinatorial
  complexity in the codebase over time.

**Interview answer (short):** "Feature flags decouple deploying code from
releasing behavior — you ship dark and toggle on gradually, per user or
segment, without a redeploy. Under the hood, an SDK caches flag state
locally so evaluation is fast, and refreshes from a central config service.
I'd pair this with monitoring during rollout and a habit of deleting flags
once a feature is fully shipped, to avoid permanent flag debt."

**Practice problem:** Design a minimal feature-flag service: an API to
create a flag with a percentage rollout, a deterministic hash-based
evaluation function keyed by user ID, and a client SDK that caches flags
for 30 seconds.

**Production considerations:** Fail-safe defaults on config-service outage,
flag change audit logging (who flipped what, when), avoiding flag checks
becoming a performance bottleneck, and a process for retiring stale flags.

------------------------------------------------------------------------

## 23.6 Webhooks and Delivery Retries

**Proper definition:** A webhook is an outbound HTTP callback a system makes
to a consumer-provided URL to notify it of an event, as it happens, instead
of the consumer polling for changes.

**Simple meaning:** "Call this URL when X happens" — the sender pushes data
to the receiver's endpoint rather than the receiver repeatedly asking "did
X happen yet?"

**Why it is needed:**
- Real-time-ish notification without wasteful polling.
- Standard integration mechanism between independent systems (payment
  providers notifying merchants, CI systems notifying chat tools, etc.).

**How it works internally:**
1. Consumer registers a URL and the event types they care about.
2. When the event occurs, the sender serializes a payload and does an
   outbound `POST` to the registered URL.
3. The sender must handle the receiver being slow, down, or returning
   errors — this is where **delivery retries** matter: exponential backoff,
   a maximum retry count/duration, and eventually a dead-letter/failure
   state if delivery never succeeds.
4. Because HTTP delivery is not guaranteed exactly-once, receivers must be
   **idempotent** — the same webhook may arrive more than once, and must
   not cause duplicate side effects (e.g., charging twice).
5. Payload authenticity is verified via a signature (HMAC of the payload
   with a shared secret) so receivers can trust the sender.

**Syntax and API (conceptual):**
```typescript
// Sender: deliver with retry + signature
async function deliverWebhook(url: string, payload: object, secret: string) {
  const body = JSON.stringify(payload);
  const signature = hmacSha256(body, secret);

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Signature": signature },
        body,
      });
      if (res.ok) return;
    } catch { /* network error, fall through to retry */ }
    await sleep(backoffWithJitter(attempt));
  }
  await markAsFailed(payload);
}

// Receiver: verify signature + idempotency
app.post("/webhooks/payments", (req, res) => {
  if (!verifySignature(req.body, req.headers["x-signature"], secret)) {
    return res.status(401).end();
  }
  if (alreadyProcessed(req.body.eventId)) return res.status(200).end();
  processEvent(req.body);
  res.status(200).end();
});
```

**Small example:** A payment provider sends a `payment.succeeded` webhook
to a merchant's endpoint; if the merchant's server is briefly down, the
provider retries with exponential backoff for up to 24 hours before giving
up and surfacing the failure in a dashboard.

**Real backend usage:** Payment provider → merchant notifications, CI/CD →
chat integrations, SaaS platforms notifying customer systems of events,
third-party API integrations in general.

**Edge cases:**
- Receiver returns `200` but actually failed to process internally — sender
  thinks it succeeded (need receiver to only ack after successful
  processing, ideally after durably queuing the work).
- Out-of-order delivery — event 2 may arrive before event 1 during retries;
  receivers should be able to tolerate or reorder by event timestamp/version.
- Receiver endpoint changes or is deleted — sender needs a way to detect
  and disable persistently failing endpoints.

**Common mistakes:**
- Processing the webhook synchronously and slowly inside the request
  handler, causing the sender to time out and retry, causing duplicate
  processing — should acknowledge fast and process asynchronously.
- No signature verification, allowing anyone who finds the URL to send
  fake events.
- Not deduplicating by event ID, so retries cause duplicate business
  effects (double order fulfillment, double notifications).

**Interview answer (short):** "Webhooks are outbound HTTP push
notifications instead of polling. Because delivery over HTTP isn't
guaranteed exactly-once, the sender needs retry with backoff and the
receiver needs to be idempotent — dedupe by event ID — and verify a
signature so it can trust the payload. I always design receivers to ack
fast and do the real work asynchronously, so retries don't cause duplicate
processing."

**Practice problem:** Build a webhook receiver that verifies an HMAC
signature, deduplicates by `eventId` using a table with a unique
constraint, and enqueues the real work to a background job instead of
processing inline.

**Production considerations:** Exponential backoff with jitter, a maximum
retry window before marking permanently failed, a dashboard/replay
mechanism for failed deliveries, and idempotency keys enforced at the
database level (unique constraint), not just in application logic.

------------------------------------------------------------------------

## 23.7 Payment Reconciliation

**Proper definition:** Reconciliation is the process of comparing two
independent records of the same financial activity (e.g., your system's
ledger vs the payment provider's records) to detect and resolve
discrepancies.

**Simple meaning:** "Does what we think happened match what the payment
provider says actually happened?" — and if not, figure out why and fix it.

**Why it is needed:**
- Payment systems involve multiple parties (your app, payment gateway,
  bank) that can disagree due to network failures, webhook delivery
  failures, timing, or bugs. Money must never silently drift out of sync.
- Regulatory and audit requirements in most jurisdictions require
  demonstrable reconciliation for financial systems.

**How it works internally:**
1. Your system records transactions as it believes they happened (from
   API responses and webhooks).
2. The payment provider periodically publishes a source-of-truth report
   (a settlement file, or a query-able API) of what actually settled.
3. A reconciliation job compares the two datasets by transaction ID,
   flags mismatches (missing on one side, amount mismatch, status
   mismatch), and either auto-resolves known-safe cases or routes to a
   human/ops queue.
4. This is closely related to the **outbox pattern**: writes to your own
   DB and calls to the payment provider can't be a single atomic
   transaction, so reconciliation is the safety net that catches drift
   from that inherent gap.

**Syntax and API (conceptual):**
```typescript
async function reconcile(date: string) {
  const internal = await db.query(`SELECT * FROM payments WHERE date = $1`, [date]);
  const providerReport = await paymentProvider.getSettlementReport(date);

  const providerById = new Map(providerReport.map(r => [r.transactionId, r]));

  for (const txn of internal) {
    const remote = providerById.get(txn.providerTxnId);
    if (!remote) {
      flag(txn, "MISSING_ON_PROVIDER");
    } else if (remote.amount !== txn.amount || remote.status !== txn.status) {
      flag(txn, "MISMATCH", { local: txn, remote });
    }
  }
}
```

**Small example:** A subscription service's webhook for a renewal charge
never arrives due to a network blip, so the internal DB shows the
subscription as unpaid while the payment provider shows it as charged. The
nightly reconciliation job catches the mismatch, corrects the internal
status, and alerts if the pattern repeats.

**Real backend usage:** Any system handling money — subscriptions,
marketplaces, e-commerce checkout, payroll, ledgers — reconciles against
payment gateways, banks, or partner systems on a schedule (often daily).

**Edge cases:**
- Timing differences: a transaction settles on the provider side a day
  after it was initiated — reconciliation windows must account for this,
  not flag everything in-flight as a mismatch.
- Partial refunds/chargebacks changing amounts after initial settlement.
- Currency conversion rounding differences between systems.

**Common mistakes:**
- Relying solely on webhooks for financial state without a reconciliation
  backstop — webhooks can be lost, delayed, or duplicated.
- Auto-resolving all mismatches without human review, silently "fixing"
  data in ways that hide real bugs or fraud.
- No alerting on reconciliation failures, so drift accumulates unnoticed
  until it becomes a large, hard-to-untangle problem.

**Interview answer (short):** "Reconciliation compares your internal
record of transactions against the payment provider's source-of-truth
report to catch drift caused by missed webhooks, timing gaps, or bugs.
It's the safety net for the fact that writing to your DB and calling a
payment API can't be one atomic operation. I'd run it on a schedule,
auto-resolve well-understood cases, and route genuine mismatches to a
human queue with alerting."

**Practice problem:** Given two lists of transactions — your internal
records and a mock "provider settlement report" — write a reconciliation
function that classifies each internal record as `MATCHED`,
`MISSING_ON_PROVIDER`, or `AMOUNT_MISMATCH`, and outputs a summary report.

**Production considerations:** Scheduling and idempotency of the
reconciliation job itself, alerting thresholds (a few mismatches is normal
timing noise; a spike is a bug), audit logging of every correction made,
and keeping reconciliation logic separate from the code that made the
original decisions (so it's an independent check, not the same fallible
path twice).

------------------------------------------------------------------------

## 23.8 Data Migration Strategies, Backward Compatibility, and API Contract Evolution

These three are grouped because they're the same underlying problem viewed
from different angles: **how do you change a system that other things
depend on, without breaking them?**

### 23.8.1 Data Migration Strategies

**Definition:** Structured, safe procedures for changing a database schema
or moving/transforming data, especially while the system stays live.

**Why needed:** Schemas evolve as products evolve; naive migrations (lock
the table, ALTER, hope) cause downtime and data loss risk at scale.

**How it works / key patterns:**
- **Expand-contract (parallel change):** add the new column/table
  (*expand*), write to both old and new during a transition period (dual
  write, or backfill via a job), switch reads to the new shape, then
  remove the old one (*contract*). This avoids a single risky cutover.
- **Backfill jobs:** batched, rate-limited jobs that populate new
  columns/tables for existing rows without locking the whole table.
- **Online schema change tools** (e.g., `gh-ost`, `pt-online-schema-change`
  for MySQL) that make schema changes without long table locks by
  operating on a shadow table and swapping it in.
- **Outbox pattern** (related): when a migration needs to both update the
  DB and notify other services, write the "event to send" in the same DB
  transaction as the state change, and a separate relay process publishes
  it — avoiding the dual-write problem instead of trying to make an HTTP
  call and a DB write atomic (which is impossible).

**Common mistakes:** Doing a schema change and a data backfill in one giant
transaction/lock; not having a rollback plan; changing application code and
schema in the same deploy with no expand phase, so any rollback of the code
breaks against the new schema.

### 23.8.2 Backward Compatibility

**Definition:** The property that new versions of a system continue to work
correctly with old clients/consumers that haven't upgraded yet.

**Why needed:** In distributed systems, you can rarely deploy every
consumer and producer at the same instant — mobile apps, other teams'
services, and third-party integrations upgrade on their own schedule.

**Key rules:**
- Additive changes are safe (new optional field, new endpoint).
- Removing or renaming a field, changing a field's type or meaning, or
  changing required-ness are breaking changes.
- Consumers should ignore fields they don't recognize (be lenient on read)
  so producers can add fields freely.

### 23.8.3 API Contract Evolution

**Definition:** The disciplined process of changing an API's shape over
time without breaking existing consumers, typically via versioning and
deprecation policies.

**How it works:**
1. Prefer additive, backward-compatible changes whenever possible.
2. When a breaking change is unavoidable, introduce a new API version
   (URL path `/v2/...`, header, or content-type versioning) rather than
   changing `/v1/...` behavior underneath existing consumers.
3. Deprecate the old version with a clear timeline, sunset headers/docs,
   and usage monitoring to know when it's safe to remove.
4. **Contract testing** (see Phase 20) automatically verifies a change
   doesn't break a consumer's expectations before it ships.

**Small example (all three together):** Renaming a `name` field to
`fullName` on a `User` resource:
- *Expand:* add `fullName` alongside `name`, populate both on write,
  backfill existing rows.
- *Backward compatible period:* API returns both fields; old consumers
  keep reading `name`, new consumers use `fullName`.
- *Contract evolution:* announce deprecation of `name` with a sunset date,
  monitor which consumers still call the old field, then *contract*
  (remove `name`) once usage drops to zero or the deadline passes.

**Real backend usage:** Any long-lived public or internal API, database
schema changes in systems with multiple services/teams reading the same
tables, mobile APIs where old app versions stay in the wild for years.

**Edge cases:** Consumers that fail hard on unrecognized fields instead of
ignoring them (violates the leniency principle and blocks additive
changes); migrations that can't be paused/rolled back partway through;
API versions kept "temporarily" for years because no one tracked
consumer usage.

**Common mistakes:** Treating "backward compatible" as optional/nice-to-have
instead of a hard constraint for shared APIs; big-bang cutovers instead of
expand-contract; no deprecation telemetry, so a team can't safely know when
an old version is actually unused.

**Interview answer (short):** "I treat schema and API changes as
multi-step processes, not single deploys: expand by adding the new shape
alongside the old, migrate/backfill data and consumers gradually, verify
via monitoring or contract tests that nothing depends on the old shape
anymore, then contract by removing it. The core discipline is never
requiring every consumer to upgrade in lockstep with the producer."

**Practice problem:** Plan an expand-contract migration for renaming a
column in a `users` table that's read by three different services, without
downtime and without requiring simultaneous deploys.

**Production considerations:** Migration reversibility, feature-flagging
the cutover step, monitoring old-path usage before removing it, and
documenting a deprecation timeline publicly for external API consumers.

------------------------------------------------------------------------

## 23.9 Workflow Engines

**Proper definition:** A workflow engine is infrastructure for defining,
executing, and tracking multi-step business processes — often long-running,
involving multiple services, human approval steps, retries, and
compensation logic — as explicit, durable state machines rather than
scattered application code.

**Simple meaning:** Instead of hand-coding "call service A, then if that
succeeds call service B, then wait for approval, then call service C, and
if anything fails undo the earlier steps," you define the steps declaratively
and the engine durably tracks progress, retries failures, and resumes after
crashes.

**Why it is needed:**
- Long-running, multi-step processes (order fulfillment, loan approval,
  onboarding) are hard to get right with ad-hoc code — crashes mid-process,
  partial failures, and retries all need to be handled consistently.
- Provides visibility: you can see exactly which step a given process
  instance is on, which is invaluable for debugging and support.
- Closely related to the **saga pattern** (Phase 17) — a workflow engine is
  often the practical implementation vehicle for sagas with compensation.

**How it works internally:**
1. A workflow is defined as a sequence/graph of steps (activities), each
   with retry policy, timeout, and optional compensation (undo) logic.
2. The engine persists the workflow's state after every step — so if the
   process crashes, it resumes exactly where it left off rather than
   restarting or losing track.
3. Steps can be synchronous calls, waits for external events (e.g., "wait
   for payment webhook" or "wait for human approval"), or timers ("wait 3
   days then send a reminder").
4. On failure of a step after retries are exhausted, the engine can run
   compensating actions for already-completed steps (e.g., release
   reserved inventory if payment ultimately fails).

**Syntax and API (conceptual, engine-agnostic pseudocode):**
```typescript
defineWorkflow("orderFulfillment", async (ctx) => {
  await ctx.step("reserveInventory", () => reserveStock(ctx.orderId));
  const paid = await ctx.step("chargePayment", () => chargeCard(ctx.orderId));

  if (!paid) {
    await ctx.compensate("reserveInventory", () => releaseStock(ctx.orderId));
    return "FAILED";
  }

  await ctx.step("shipOrder", () => requestShipment(ctx.orderId));
  await ctx.waitForEvent("deliveryConfirmed", { timeout: "7 days" });
  return "COMPLETED";
});
```

**Small example:** A loan-application workflow: verify identity → run
credit check → wait for a human underwriter's approval (could take days) →
disburse funds. The engine tracks each application's exact position in this
flow and survives service restarts without losing progress.

**Real backend usage:** Order fulfillment and saga orchestration, approval
chains (expense reports, loan applications), user onboarding sequences,
scheduled/delayed business processes, any process spanning multiple
services where partial failure must be handled consistently.

**Edge cases:**
- Long waits for human input or external events (days/weeks) — the engine
  must durably persist state for that long, not hold it in memory.
- Step logic changing while instances are mid-flight (versioning workflow
  definitions themselves).
- Compensation logic itself failing (undoing an undo) — needs its own
  retry/alerting.

**Common mistakes:**
- Building ad-hoc "orchestration" with a chain of `setTimeout`/cron jobs
  and manual status columns instead of using durable, crash-safe workflow
  state — this reproduces the saga pattern's pitfalls badly.
- No compensation logic for steps that already succeeded when a later step
  fails, leaving the system in an inconsistent state (inventory reserved
  but payment failed and never released).
- Treating workflow steps as non-idempotent, so a retry after a crash
  double-charges or double-ships.

**Interview answer (short):** "A workflow engine turns a multi-step,
possibly long-running business process into a durable state machine — it
persists progress after every step so a crash resumes rather than restarts,
handles retries per-step, and can run compensating actions if a later step
fails. It's the practical way to implement the saga pattern for
cross-service transactions, and it's worth the infrastructure investment
once ad-hoc status-column-and-cron orchestration starts breaking down."

**Practice problem:** Model the order-fulfillment example above as an
explicit state machine with states `RESERVED`, `PAID`, `SHIPPED`, `FAILED`,
`COMPENSATED`, define the valid transitions, and write the compensation
logic for a payment failure after inventory was reserved.

**Production considerations:** Choosing durable persistence for workflow
state (not in-memory), idempotent step implementations, observability into
which step every in-flight instance is on, and a strategy for evolving
workflow definitions without breaking instances already in progress.

------------------------------------------------------------------------

## 23.10 Audit and Compliance Concepts

**Proper definition:** Audit logging is the practice of recording who did
what, to which resource, and when, in a tamper-resistant, queryable way.
Compliance is the broader set of practices ensuring a system meets legal,
regulatory, or contractual requirements (data handling, retention, access
control) — audit logs are usually the evidence compliance is built on.

**Simple meaning:** "Prove, after the fact, exactly what happened and who
was responsible" — for security investigations, disputes, and regulators.

**Why it is needed:**
- Security incident investigation requires a reliable record of actions.
- Regulations (finance, healthcare, data privacy laws) often mandate audit
  trails and specific data-handling guarantees as a legal requirement, not
  an optional feature.
- Builds customer/enterprise trust — "can you show us who accessed this
  record" is a common enterprise sales/security-review question.

**How it works internally:**
1. Every sensitive action (login, permission change, data access/export,
   record modification, deletion) writes an **audit event**: actor, action,
   target resource, timestamp, source IP, result (success/failure), and
   relevant before/after values.
2. Audit logs are **append-only** and ideally stored separately from
   operational data, often with restricted write access even for admins,
   so they can't be quietly altered after the fact.
3. Retention policies define how long logs are kept (often mandated by
   regulation, e.g., "7 years for financial records").
4. Access to the audit log itself is tightly controlled and often audited
   too ("who looked at the audit log").

**Syntax and API (conceptual):**
```typescript
async function auditLog(entry: {
  actorId: string;
  action: string;         // e.g. "USER_ROLE_CHANGED"
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  ip: string;
}) {
  await db.query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, before, after, ip, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())`,
    [entry.actorId, entry.action, entry.targetType, entry.targetId, entry.before, entry.after, entry.ip]
  );
}

// Called wherever a sensitive mutation happens
await updateUserRole(userId, "ADMIN");
await auditLog({ actorId: currentUser.id, action: "USER_ROLE_CHANGED",
                  targetType: "user", targetId: userId, before: "MEMBER", after: "ADMIN", ip: req.ip });
```

**Small example:** A SaaS admin panel logs every permission change with
actor, target user, old role, new role, and timestamp, queryable by
security teams and exportable for a customer's compliance audit.

**Real backend usage:** Financial systems, healthcare systems (patient
record access), multi-tenant SaaS admin actions, any system supporting
enterprise customers with security/compliance requirements (SOC 2, HIPAA,
GDPR-adjacent access logging).

**Edge cases:**
- Logging the audit action itself must not fail silently — if the audit
  write fails, does the underlying action proceed or roll back? (Usually a
  deliberate, documented policy decision.)
- Sensitive data in audit logs (e.g., logging a password change shouldn't
  log the password itself) — audit logs need their own data-minimization
  rules.
- High-volume actions (every read) can make audit logging itself a
  performance and storage cost problem — usually scoped to sensitive
  actions, not everything.

**Common mistakes:**
- Storing audit logs in the same mutable table as operational data with no
  extra protection, so a compromised admin account can cover its tracks.
- Logging too little context to be useful later (no actor, no before/after
  values) or too much sensitive data (secrets, full PII unnecessarily).
- No defined retention/access policy, leaving compliance teams unable to
  answer "how long do we keep this" or "who can see this."

**Interview answer (short):** "Audit logging records who did what to which
resource and when, in an append-only, access-restricted store separate
from operational data, so it can't be quietly altered — it's the evidence
compliance and security investigations rely on. I scope it to sensitive
actions, capture actor/target/before-after/timestamp, and make sure the
audit trail itself has stricter access control than the data it's
describing."

**Practice problem:** Add audit logging to a role-based access control
system: log every role assignment/removal with actor, target user, old and
new role, and build a query to answer "show me every permission change made
by user X in the last 30 days."

**Production considerations:** Separate storage/access controls for audit
data, retention policy aligned with legal requirements, data minimization
in what gets logged, and making the audit log queryable/exportable for
compliance reviews without exposing it broadly inside the org.

------------------------------------------------------------------------

## 23.11 Disaster Recovery, RPO, and RTO

**Proper definition:** Disaster recovery (DR) is the set of policies and
technical mechanisms for restoring a system after a major failure (data
center outage, region failure, catastrophic data loss). **RPO** (Recovery
Point Objective) is the maximum acceptable amount of data loss, measured in
time ("how much data can we afford to lose"). **RTO** (Recovery Time
Objective) is the maximum acceptable downtime before service is restored
("how long can we afford to be down").

**Simple meaning:** RPO answers "how far back can our backups be?" RTO
answers "how fast do we need to be back online?" Both are business
decisions with direct technical and cost consequences.

**Why it is needed:**
- Failures at the infrastructure level (region outage, catastrophic data
  corruption, ransomware) are rare but eventually happen; without a
  planned, tested DR strategy, recovery time and data loss are
  unpredictable and often far worse than acceptable.
- RPO/RTO give engineering a concrete target to design and budget for,
  instead of a vague "we should have backups."

**How it works internally:**
1. **RPO is achieved via backup/replication frequency.** Continuous
   replication to a standby region → RPO near zero. Nightly backups only →
   RPO up to 24 hours (worst case, everything since the last backup is
   lost).
2. **RTO is achieved via how recovery actually happens.** A cold standby
   (spin up infrastructure from scratch, restore from backup) has a high
   RTO (hours). A warm/hot standby (already-running replica in another
   region, just needs traffic failover) has a low RTO (minutes or less).
3. Tighter RPO/RTO costs more: hot standbys, cross-region synchronous
   replication, and automated failover are all significantly more
   expensive than nightly backups and manual recovery — the business must
   choose the target deliberately, tier by tier of criticality.
4. **DR is only real if it's tested.** A recovery plan that's never been
   executed in a drill is a hypothesis, not a guarantee — regular DR
   drills (simulated failover) are how organizations actually validate
   RPO/RTO targets are achievable.

**Syntax and API (conceptual — this is mostly architecture/process, not
code, but illustrating a backup verification job):**
```typescript
async function verifyBackupRestorable() {
  const latestBackup = await getLatestBackup();
  const testDb = await spinUpEphemeralDb();
  await restoreBackup(latestBackup, testDb);
  const rowCount = await testDb.query(`SELECT count(*) FROM critical_table`);
  assert(rowCount > 0, "Backup restore produced no data — alert immediately");
  await teardown(testDb);
}
```

**Small example:** A company sets RPO = 5 minutes and RTO = 15 minutes for
its payments database. To meet this, they run synchronous/near-synchronous
replication to a standby in another availability zone and automated
failover that promotes the standby and redirects traffic without manual
intervention — nightly backups alone couldn't meet either target.

**Real backend usage:** Any production system with a defined uptime/SLA
commitment; especially critical for payments, healthcare, and any system
with contractual/regulatory availability or data-loss guarantees.

**Edge cases:**
- Backups that exist but have never been test-restored (silently corrupted
  or incompatible backups are a common real-world disaster).
- Partial region failures that don't trigger automated failover thresholds
  cleanly (a "gray failure" — slow, not fully down).
- Data consistency during failover: if replication was asynchronous, the
  standby may be missing the last few seconds/minutes of writes (this gap
  is exactly what RPO quantifies).

**Common mistakes:**
- Setting an aggressive RTO/RPO target on paper without the infrastructure
  (or budget) to actually achieve it.
- Never running a DR drill, so the first real test of the recovery plan is
  an actual disaster.
- Conflating "we have backups" with "we have disaster recovery" — backups
  alone don't define RTO, and untested backups don't reliably define RPO
  either.

**Interview answer (short):** "RPO is how much data loss is acceptable,
RTO is how much downtime is acceptable — both are business decisions that
drive technical design. Tighter targets need hot/warm standbys and
automated failover; looser targets can rely on periodic backups and manual
recovery. The plan only counts if it's actually drilled — an untested
backup or failover procedure is a guess, not a guarantee."

**Practice problem:** For a given system (e.g., an e-commerce order
database), propose RPO and RTO targets for three tiers — critical
(payments), important (product catalog), and non-critical (analytics) —
and describe the backup/replication architecture needed to hit each tier's
targets.

**Production considerations:** Automating and regularly running DR drills
(not just documenting a plan), monitoring replication lag as a live RPO
indicator, clear automated or well-rehearsed manual failover runbooks, and
periodically re-evaluating whether current RPO/RTO targets still match
business needs and budget.

------------------------------------------------------------------------

## Phase 23 Summary Table

| Topic | Core Problem It Solves | Priority |
|---|---|---|
| Event Sourcing | Full, immutable history of state changes | GOOD TO KNOW → IMPORTANT (senior) |
| CQRS | Independent scaling/shape of reads vs writes | GOOD TO KNOW → IMPORTANT (senior) |
| Change Data Capture | Syncing downstream systems without dual writes | GOOD TO KNOW → IMPORTANT (senior) |
| Search Systems / Elasticsearch | Fast, ranked, faceted search at scale | GOOD TO KNOW → IMPORTANT (senior) |
| Feature Flags / Config Service | Decoupling deploy from release | GOOD TO KNOW → IMPORTANT (senior) |
| Webhooks & Delivery Retries | Reliable async cross-system notification | GOOD TO KNOW → IMPORTANT (senior) |
| Payment Reconciliation | Detecting drift between independent financial records | GOOD TO KNOW → IMPORTANT (senior) |
| Data Migration / Backward Compatibility / API Evolution | Changing shared systems without breaking consumers | GOOD TO KNOW → IMPORTANT (senior) |
| Workflow Engines | Durable, crash-safe multi-step business processes | GOOD TO KNOW → IMPORTANT (senior) |
| Audit & Compliance | Tamper-resistant record of who did what | GOOD TO KNOW → IMPORTANT (senior) |
| Disaster Recovery / RPO / RTO | Bounded, tested response to catastrophic failure | GOOD TO KNOW → IMPORTANT (senior) |

**Suggested practice order:** Event Sourcing → CQRS → CDC (these three build
on each other) → Webhooks → Payment Reconciliation → Data Migration/API
Evolution → Search Systems → Feature Flags → Workflow Engines → Audit →
Disaster Recovery.

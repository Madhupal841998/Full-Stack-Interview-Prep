# Phase 15 — Background Jobs and Messaging

> Part of the **Zero to Expert Backend Engineering Master Roadmap**
> **Priority:** MUST KNOW  |  **Suggested time:** 2–3 weeks at 1–2 hours/day (adjust to your background)
> **Previous phase:** Phase 14 — Caching
> **Next phase:** Phase 16 — File Upload and Media Processing

---

## Why Phase 15 Exists

An HTTP request-response cycle is a bad place to do slow or unreliable work. If sending a welcome email takes 800 ms and calls a flaky third-party API, making the user's signup request wait for it (and fail if it fails) is a poor design. **Background jobs and messaging** move that work out of the request path: the API accepts the request quickly, hands the slow part to a **queue**, and a separate **worker** processes it — with retries, backoff, and failure handling that a synchronous HTTP call can never give you for free.

This phase is the backbone of reliable backend systems: every "send an email," "generate a report," "process an upload," "notify a user," and "sync data to another system" feature in a real product goes through some version of what you'll build here.

Phase 15 is one topic, taught in eight parts that build on each other in order:

| # | Topic | What it answers |
|---|-------|-----------------|
| 15.1 | Synchronous vs Asynchronous Work | When and why to move work off the request path |
| 15.2 | Queues, Producers, Consumers, and Workers | The core vocabulary and moving parts |
| 15.3 | Acknowledgement, Visibility Timeout, and At-Least-Once Delivery | What "the message was processed" actually means |
| 15.4 | Retries, Backoff, and Dead-Letter Queues | What happens when processing fails |
| 15.5 | Idempotent Consumers | How to survive at-least-once delivery safely |
| 15.6 | Outbox and Inbox Patterns | How to publish and consume messages *exactly once, effectively* |
| 15.7 | Ordering, Partitioning, and Consumer Groups | How to scale consumers without losing order |
| 15.8 | Backpressure | What to do when producers outrun consumers |

---

## How to Study Every Topic

Same 12-step order as the rest of the roadmap:

1. Proper definition · 2. Simple meaning · 3. Why it is needed · 4. How it works internally · 5. Syntax and API · 6. Small example · 7. Real backend usage · 8. Edge cases · 9. Common mistakes · 10. Interview answer · 11. Practice problem · 12. Production considerations

**Priority tags used in this file:** `MUST KNOW` · `IMPORTANT` · `GOOD TO KNOW` · `SKIP FOR NOW`

**Tools used for hands-on examples:** Node.js, and **Redis + BullMQ** as the primary queue for exercises (simple to run locally, pure JavaScript API, widely used in Node backends). Where a concept is better illustrated by a different technology — **RabbitMQ** for AMQP-style routing, **Kafka** for partitioned logs and consumer groups, **AWS SQS** for managed cloud queues — that tool is introduced specifically for that topic. You are not expected to master all four; understand the *concepts*, and know one tool deeply.

**Setup before you start:**

```bash
# Redis via Docker (used by BullMQ)
docker run -d --name redis -p 6379:6379 redis:7

mkdir jobs-demo && cd jobs-demo && npm init -y
npm install bullmq ioredis
```

---

## Table of Contents

- 15.1 Synchronous vs Asynchronous Work
- 15.2 Queues, Producers, Consumers, and Workers
- 15.3 Acknowledgement, Visibility Timeout, and At-Least-Once Delivery
- 15.4 Retries, Backoff, and Dead-Letter Queues
- 15.5 Idempotent Consumers
- 15.6 Outbox and Inbox Patterns
- 15.7 Ordering, Partitioning, and Consumer Groups
- 15.8 Backpressure

**Wrap-up**
- Phase 15 Capstone Project: "Background Jobs & Messaging Platform" (Email worker, Report worker, File processing worker, Notification queue, Retryable job system)
- Rapid-Fire Interview Questions
- Cheat Sheets
- Exit Checklist

---

## 15.1 Synchronous vs Asynchronous Work

`MUST KNOW`

**1. Proper definition**
**Synchronous work** happens inside the request-response cycle: the client waits until the server finishes before receiving a response. **Asynchronous (background) work** is deferred to run outside that cycle — the server accepts the request, schedules the work, and responds immediately, while a separate process performs the work later and independently.

**2. Simple meaning**
Synchronous: you order food and stand at the counter until it's cooked. Asynchronous: you order, get a receipt number immediately, sit down, and someone brings the food when it's ready — possibly made by a different kitchen entirely.

**3. Why it is needed**
- **Latency:** users should not wait 5 seconds for a signup request because it also sends a welcome email and generates a PDF invoice.
- **Reliability:** if a third-party email API is down, that should not fail the user's signup.
- **Resource isolation:** CPU-heavy or slow work (video transcoding, report generation) can run on separate infrastructure, scaled independently from the web tier.
- **Resilience to spikes:** a burst of 10,000 signups can enqueue 10,000 jobs instantly; workers drain the queue at a sustainable rate instead of the web servers being crushed doing all the work inline.

**4. How it works internally**

```text
Synchronous request:
Client ──POST /signup──▶ Server: create user → hash password → send email → generate PDF → 200 OK
                                                  ▲ all of this blocks the response ▲
                                                  (total time = sum of every step)

Asynchronous request:
Client ──POST /signup──▶ Server: create user → hash password → enqueue "send-email" job
                                              → enqueue "generate-invoice" job → 202 Accepted
                                                  (total time = just the fast steps)

                          Queue ──▶ Worker process A: picks up "send-email", sends it, done
                          Queue ──▶ Worker process B: picks up "generate-invoice", builds PDF, done
```

- A **job** (or **task** or **message**) is a small, serializable description of work to do — typically a name/type plus a JSON payload, *not* the work itself.
- The **producer** (your API) does not perform the work; it just describes it and hands it off.
- The **worker** performs the work, on its own schedule, possibly on entirely different machines, and possibly much later than the request.
- The trade you make: the client no longer knows the *result* synchronously. If the user needs to know "your invoice is ready," you need a separate mechanism — polling a status endpoint, a websocket push, or an email notification — covered later in this phase and in Phase 16.

**5. Syntax and API** — deciding, in code, what stays synchronous:

```js
// Rule of thumb thresholds (adjust to your SLAs):
//  < ~50-100ms and required for the response      → keep synchronous
//  slow, non-critical to the immediate response,
//  can fail independently, or is bulk/scheduled    → move to background
//  the user must see the live result immediately   → keep synchronous (or use polling/websockets)

async function signup(req, res) {
  const user = await db.users.create(req.body);          // must happen before responding: sync
  await passwordHasher.hash(req.body.password);           // required to create the user: sync
  await emailQueue.add('welcome-email', { userId: user.id });   // not required for response: async
  await invoiceQueue.add('generate-invoice', { userId: user.id }); // slow + independent: async
  res.status(202).json({ id: user.id, status: 'created' });
}
```

**6. Small example** — measure the difference:

```js
// sync-vs-async.js
function fakeSlowEmail(ms = 700) { return new Promise((r) => setTimeout(r, ms)); }

async function signupSync(res) {
  const t0 = Date.now();
  await fakeSlowEmail();                 // blocks the response
  res.json({ ms: Date.now() - t0 });     // ~700ms
}

async function signupAsync(res, queue) {
  const t0 = Date.now();
  queue.push('send-email');              // fire-and-forget enqueue (near-instant)
  res.json({ ms: Date.now() - t0 });     // ~1-5ms
}
```

**7. Real backend usage**
- Welcome/confirmation emails, password reset emails, SMS/push notifications.
- Report and invoice/PDF generation, data exports (CSV, Excel).
- Image/video processing (Phase 16), search-index updates, cache warming.
- Webhook delivery to third parties, syncing data to analytics/CRM systems.
- Anything scheduled: nightly billing runs, subscription renewals, cleanup jobs.

**8. Edge cases**
- **The user still wants feedback.** "202 Accepted, we'll email you" is a UX decision, not just a technical one — communicate it clearly (status pages, "processing" states in the UI).
- **Not everything can be async.** Payment authorization at checkout usually must be synchronous — the user needs to know *now* whether the charge succeeded, even though follow-up work (receipts, fulfillment) can be async.
- **Ordering across sync and async parts matters:** if you enqueue a job before the database transaction that created its data has committed, the worker may run before the row exists (see the Outbox pattern, 15.6).
- **Testing gets harder:** async flows need integration tests that wait for job completion, not just HTTP assertions.

**9. Common mistakes**
- Doing genuinely slow work synchronously "because it's simpler," and then treating the resulting timeouts as a database or infra problem.
- Moving *everything* to background jobs, including work the user is actively waiting to see, and papering over it with aggressive polling.
- Enqueuing a job inside a database transaction that might still roll back, so a worker processes a job for data that never actually existed.
- Assuming "async" means "unreliable is fine" — background does not mean best-effort; many background jobs (billing, notifications) are more important to get right than the synchronous request that triggered them.

**10. Interview answer**
> "Synchronous work blocks the response until it's done; asynchronous work is handed to a queue and processed later by a separate worker, so the client gets a fast response. I move things to background jobs when they're slow, non-critical to the immediate response, or can fail independently — like sending emails or generating reports — but I keep anything the user is actively waiting on, like payment authorization, synchronous."

**11. Practice problem**
1. List ten real product features; classify each as sync, async, or "needs a status endpoint because the user cares about the result." Justify each.
2. Build the two `signup` handlers above; measure and graph response time for 100 requests, sync vs async.
3. Design (on paper) how a client would find out that an async invoice-generation job finished — list at least two approaches and their trade-offs.

**12. Production considerations**
- Define an SLA for "how long can this reasonably be delayed" per job type — it drives your retry/alerting policy later in this phase.
- Every asynchronous path needs its own observability: job success rate, queue depth, processing latency (Phase 19).
- Decide your enqueue-after-commit strategy up front (15.6) — this bites teams late, in production, under load.

---

## 15.2 Queues, Producers, Consumers, and Workers

`MUST KNOW`

**1. Proper definition**
A **queue** is a data structure (usually backed by a database, Redis, or a dedicated broker) holding an ordered collection of **messages** (jobs) awaiting processing. A **producer** creates and adds (enqueues/publishes) messages to the queue. A **consumer** (running inside a **worker** process) removes and processes messages, usually in **First-In-First-Out (FIFO)** order, though not always.

**2. Simple meaning**
A restaurant order queue: waiters (producers) hand tickets to the kitchen's order rail (the queue); cooks (consumers, running inside the kitchen — the worker process) pull tickets off and cook them, generally in the order they arrived.

**3. Why it is needed**
The queue is what makes Section 15.1 possible: it is the durable handoff point that decouples "someone asked for this" from "someone is doing this," so producers and consumers can run at different speeds, scale independently, restart independently, and never need to know about each other directly.

**4. How it works internally**

```text
┌───────────┐   enqueue   ┌───────────────────────┐   dequeue   ┌───────────┐
│ Producer  │ ──────────▶ │   Queue (durable)      │ ──────────▶ │ Worker /  │
│ (API req) │             │ [msg4][msg3][msg2][m1] │             │ Consumer  │
└───────────┘             └───────────────────────┘             └───────────┘
```

- **Broker vs self-hosted queue-on-a-database:** a **message broker** (RabbitMQ, Kafka, SQS) is dedicated software/service built for this job. You can also build a simple queue on top of a relational table (a `jobs` table with a `status` column, polled by workers) — fine at small scale, common as a first implementation, and the basis of the Outbox pattern (15.6).
- **Push vs pull:** in a **pull** model, workers actively ask the broker "give me a message" (SQS, most polling-based queues). In a **push** model, the broker delivers messages to a subscribed worker (some pub/sub systems). Most job queues are pull-based even when the client library hides the polling.
- **Point-to-point vs pub/sub:** a **queue** typically delivers each message to exactly one consumer (work is distributed). A **topic**/**pub/sub** channel delivers each message to *every* subscriber (fan-out — e.g., "order placed" event notifies email, analytics, and inventory services independently). Kafka topics, RabbitMQ exchanges, and Redis Pub/Sub implement variations of this.
- **Job payload:** should be a small, serializable, self-contained description — IDs and minimal data, not entire objects, since the data may have changed by the time the job runs (fetch fresh state in the worker instead).
- **Concurrency:** a worker process typically runs multiple concurrent job handlers (bounded by a concurrency setting) rather than one job at a time, to use resources efficiently without overloading downstream systems.

**5. Syntax and API** — BullMQ (Redis-backed), the primary tool for this phase:

```js
// queues.js — shared queue definitions
const { Queue } = require('bullmq');
const connection = { host: '127.0.0.1', port: 6379 };

const emailQueue = new Queue('email', { connection });
module.exports = { emailQueue, connection };
```

```js
// producer.js — runs inside your API
const { emailQueue } = require('./queues');

async function enqueueWelcomeEmail(userId, email) {
  await emailQueue.add(
    'welcome-email',                      // job name
    { userId, email },                    // payload — small and serializable
    { removeOnComplete: 1000, removeOnFail: 5000 }
  );
}
```

```js
// worker.js — runs as its own process (`node worker.js`)
const { Worker } = require('bullmq');
const { connection } = require('./queues');

const worker = new Worker(
  'email',
  async (job) => {
    console.log('processing', job.name, job.data);
    await sendEmail(job.data.email, 'Welcome!');       // your actual work
  },
  { connection, concurrency: 5 }                        // 5 jobs in flight at once
);

worker.on('completed', (job) => console.log(`${job.id} done`));
worker.on('failed', (job, err) => console.error(`${job.id} failed:`, err.message));
```

```bash
# terminal 1
node worker.js
# terminal 2
node -e "require('./producer').enqueueWelcomeEmail(1, 'a@x.com')"
```

**6. Small example** — see decoupling for yourself:

```bash
node -e "require('./producer').enqueueWelcomeEmail(1, 'a@x.com')"   # enqueue with NO worker running
# nothing happens yet — the message just sits in Redis
node worker.js                                                       # start the worker later
# it immediately picks up and processes the waiting job
```

This proves the point of a queue: producer and consumer do not need to be running at the same time.

**7. Real backend usage**
- The API process is almost always a **producer only** for background work; dedicated **worker processes** (separate from the web servers, often separate deployments/containers) are the **consumers**.
- Multiple worker *instances* of the same queue give you horizontal scaling for throughput and failover if one worker crashes.
- Multiple *different* queues (`email`, `reports`, `notifications`) let you tune concurrency, priority, and scaling independently per job type, and stop one queue from starving another.

**8. Edge cases**
- **Queue is not a database.** Don't use it to store data you need to query later; once a job is processed it's typically gone (or archived briefly for debugging).
- **Large payloads slow the broker down** and can hit size limits (SQS: 256 KB; Redis: configurable but not unlimited). Store large data (files, big blobs) externally (object storage) and pass a reference/ID in the job.
- **A worker crash mid-job** — this is exactly what 15.3's acknowledgement model exists to handle; a naive "delete on dequeue" queue loses the job forever if the worker dies before finishing.
- **Job payload gets stale**: if the payload embeds a "price: $50" and the price changes before the job runs, the worker acts on outdated data — prefer fetching current state by ID inside the worker for anything that changes.

**9. Common mistakes**
- Running the worker's job handler *inside* the web server process instead of a separate process — this defeats the resource-isolation benefit from 15.1 and lets a heavy job block HTTP handling if not architected carefully.
- One giant "do everything" queue and worker, instead of separate queues per job type with independent concurrency and scaling.
- Putting an entire database row or large object into the job payload instead of an ID.
- No monitoring on queue depth, so a stuck worker silently backs up thousands of jobs unnoticed.

**10. Interview answer**
> "A queue is a durable, ordered store of messages between producers, which create work, and consumers, which perform it inside worker processes. This decouples the API from the actual work, so producers and consumers scale, deploy, and fail independently. I keep job payloads small — IDs, not full objects — run workers as separate processes from the API, and use separate queues per job type so I can tune concurrency and priority independently."

**11. Practice problem**
1. Build the email queue/producer/worker above; run two worker instances concurrently and confirm each job is processed exactly once between them, not by both.
2. Add a `reports` queue with different concurrency; enqueue 20 jobs across both queues at once and observe them draining independently.
3. Kill the worker process mid-job (`kill -9`) and restart it; investigate (using the BullMQ UI or `redis-cli`) whether the in-flight job was lost, and note your finding for 15.3.

**12. Production considerations**
- Separate queues by job type and criticality; alert differently on a backed-up `payment-webhook` queue than a backed-up `newsletter` queue.
- Run workers as independently deployable, independently scalable processes — this is what lets you scale workers on CPU-heavy queues without touching the web tier.
- Cap and monitor payload size; store large data externally and reference it by ID.
- Track queue depth and processing rate as first-class metrics (Phase 19) — a growing queue depth is often the earliest sign of a downstream outage.

---
## 15.3 Acknowledgement, Visibility Timeout, and At-Least-Once Delivery

`MUST KNOW`

**1. Proper definition**
**Acknowledgement (ack)** is a consumer's explicit signal to the queue that a message was successfully processed and can be permanently removed. **Visibility timeout** is the window during which a dequeued-but-unacknowledged message is hidden from other consumers, so it isn't processed twice while one worker is still handling it — if that window expires without an ack, the message becomes visible again for redelivery. **At-least-once delivery** is the guarantee (made by almost all practical queues) that a message will be delivered **one or more times**, never zero — which means your system must be built to tolerate duplicates.

**2. Simple meaning**
A restaurant order ticket isn't thrown away the moment a cook picks it up — it's marked "in progress" and only torn up once the dish is actually served (ack). If the cook walks away and the ticket sits "in progress" too long without being finished (visibility timeout expires), the kitchen puts it back on the rail for someone else to cook — even if the first cook secretly finished it late. That's why the same dish might occasionally get made twice.

**3. Why it is needed**
A queue must survive worker crashes without losing work — this requires *not* deleting a message the instant it's picked up, only once it's confirmed done. But that safety mechanism has an unavoidable consequence: a worker can finish a job right as its visibility timeout expires, causing the message to be redelivered and processed again. Real systems must be designed around this reality (15.5), not pretend it away.

**4. How it works internally**

```text
1. Worker dequeues message ────────▶ message becomes INVISIBLE to other workers
                                       (visibility timeout starts, e.g. 30s)
2a. Worker finishes + sends ACK ────▶ message permanently deleted            ✅ normal path
2b. Worker crashes / never acks ────▶ timeout expires ────▶ message becomes VISIBLE again
                                                              ────▶ redelivered to another worker
```

- **Delivery guarantee spectrum:**
  - **At-most-once:** message may be lost, never redelivered (delete-on-dequeue, no ack). Rarely acceptable for real work.
  - **At-least-once:** message is never lost, but may be delivered more than once. The practical default for almost all real queues (SQS, RabbitMQ with manual ack, BullMQ, Kafka with manual offset commit).
  - **Exactly-once:** message is delivered and processed exactly one time. Extremely hard to guarantee end-to-end across a network; what most systems that *claim* exactly-once actually provide is **at-least-once delivery + idempotent processing**, which produces the same observable effect (Section 15.5).
- **Auto-ack vs manual ack:** auto-ack (message deleted the instant it's *received*, before processing) is fast but unsafe — a crash mid-processing loses the job silently. Manual ack (you explicitly confirm after your handler succeeds) is the safe default for anything that matters.
- **Negative acknowledgement (nack)**: some brokers (RabbitMQ) let a consumer explicitly say "I failed, redeliver this" immediately, rather than waiting for a timeout.
- **Choosing a visibility timeout:** must be comfortably longer than your job's expected processing time (including retries of *sub*-operations inside the job), or the job will be redelivered *while still legitimately running*, causing avoidable duplicate work. Most systems let you extend ("heartbeat") the timeout from inside a long-running job.

**5. Syntax and API**

```js
// BullMQ: ack is implicit — resolving the handler function = ack; throwing = treated as failure
const worker = new Worker('email', async (job) => {
  await sendEmail(job.data.email);
  // returning normally here IS the acknowledgement — BullMQ removes the job
}, {
  connection,
  lockDuration: 30_000,        // "visibility timeout" equivalent: 30s to finish or it's reclaimed
});

// For a job that legitimately runs long, extend the lock (heartbeat) instead of raising lockDuration blindly:
const worker2 = new Worker('reports', async (job) => {
  const extend = setInterval(() => job.extendLock('worker-token', 30_000), 15_000);
  try {
    await generateBigReport(job.data);      // may take minutes
  } finally {
    clearInterval(extend);
  }
});
```

```js
// AWS SQS (conceptual, aws-sdk v3) — explicit visibility timeout and explicit delete-as-ack
const { ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

const { Messages } = await sqs.send(new ReceiveMessageCommand({
  QueueUrl, MaxNumberOfMessages: 1, VisibilityTimeout: 30, WaitTimeSeconds: 10,
}));
for (const msg of Messages ?? []) {
  await processJob(JSON.parse(msg.Body));                       // do the work first
  await sqs.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle: msg.ReceiptHandle })); // THEN ack
}
```

**6. Small example** — reproduce a redelivery on purpose:

```js
// slow-job.js — set the lock shorter than the job takes, and watch it get redelivered
const { Worker } = require('bullmq');
let attempt = 0;

new Worker('demo', async (job) => {
  attempt++;
  console.log(`attempt #${attempt} started`);
  await new Promise((r) => setTimeout(r, 8000));    // job takes 8s...
  console.log(`attempt #${attempt} finished`);
}, { connection, lockDuration: 3000 });               // ...but the lock is only 3s
```

Enqueue one job and watch the logs: you'll see a second (or third) attempt start before the first one finishes — this is exactly the at-least-once redelivery in action, and precisely why 15.5 is not optional.

**7. Real backend usage**
- Payment webhook processing, inventory decrements, and email sending are all classic at-least-once consumers — you will see duplicate deliveries in production, not just in theory.
- Long-running jobs (video transcoding, large report generation) must heartbeat/extend their lock or they'll be duplicated mid-run.
- Monitoring "message age" / time-in-queue helps detect a visibility timeout misconfigured too short (constant needless redelivery) or too long (slow recovery from a genuinely crashed worker).

**8. Edge cases**
- **Ack right before a crash:** if a worker finishes the real-world side effect (sent the email) but crashes *before* sending the ack, the message is redelivered and the email is sent again — no timeout value eliminates this window entirely.
- **Clock/network issues** can cause a lock extension to arrive late, triggering a "spurious" redelivery even though the worker was still healthy.
- **Poison messages**: a message that *always* crashes its consumer will be redelivered forever without a retry limit — this is exactly what dead-letter queues (15.4) exist to stop.
- Some brokers (Kafka) don't have per-message visibility timeouts at all — they use consumer offset commits instead (see 15.7); the *concept* of "don't lose work, tolerate duplicates" still applies.

**9. Common mistakes**
- Using auto-ack (or deleting on dequeue) "because it's simpler," silently losing jobs on every worker crash or deploy.
- Setting the visibility timeout to the *average* job duration instead of a safe upper bound, causing routine redelivery of legitimately slow jobs.
- Believing a queue guarantees "exactly once" and building consumers that break on duplicates.
- Not heartbeating long jobs, so any job that takes longer than expected gets duplicated.

**10. Interview answer**
> "Most queues guarantee at-least-once delivery: a message won't be lost, but it might be delivered more than once. This works through visibility timeouts — a dequeued message is hidden from other consumers until it's acknowledged, and if the ack doesn't arrive in time, it becomes visible again and gets redelivered, even if the original worker is still working or actually finished right at the boundary. Because of that, I always design consumers to be idempotent rather than relying on a delivery guarantee that's practically impossible to make airtight."

**11. Practice problem**
1. Reproduce the redelivery demo above; log a unique attempt ID per delivery and count how many times one logical job ran.
2. Change `lockDuration` to something comfortably longer than the job and confirm redelivery stops.
3. Implement lock heartbeating for a job whose duration is unpredictable (random 1–10s), and prove it survives without duplication.
4. Explain, in writing, why "exactly-once delivery" is not something you can build a real consumer to depend on — even with a broker that markets exactly-once semantics.

**12. Production considerations**
- Set visibility timeout/lock duration to a safe multiple of p99 job duration, not the average.
- Always heartbeat long-running or variable-duration jobs.
- Alert on unusually high redelivery/retry counts for a queue — it usually signals a timeout misconfiguration or a genuinely failing dependency, not "expected noise."
- Treat "delivered more than once" as a normal operating condition to design for, in every consumer you write — not an exceptional case.

---

## 15.4 Retries, Backoff, and Dead-Letter Queues

`MUST KNOW`

**1. Proper definition**
A **retry** is a repeated attempt to process a message after a failure. **Backoff** is the strategy for spacing out retries over increasing intervals (commonly **exponential backoff**, often with **jitter** — randomness added to avoid synchronized retry storms). A **dead-letter queue (DLQ)** is a separate queue that messages are moved to after exhausting their retry attempts, so they stop retrying forever and can be inspected or reprocessed manually.

**2. Simple meaning**
If a delivery attempt fails, don't give up immediately — try again, but wait a bit longer each time (backoff), and add a little randomness so you're not calling back at the exact same instant as everyone else (jitter). If it still fails after several honest attempts, stop hammering it and set it aside in a "needs a human" pile (the DLQ) instead of retrying forever.

**3. Why it is needed**
Failures are often **transient** (a downstream service blipped for 200ms, a network packet dropped) — an immediate retry frequently just works. But retrying instantly and forever can turn a minor blip into an outage (a **retry storm** that overwhelms an already-struggling downstream service), and some failures are **permanent** (malformed data, a job that will never succeed) — those need to stop retrying and get a human's attention instead of consuming worker capacity forever.

**4. How it works internally**

```text
Attempt 1 fails ──▶ wait 1s  ──▶ Attempt 2 fails ──▶ wait 2s  ──▶ Attempt 3 fails
     ──▶ wait 4s ──▶ Attempt 4 fails ──▶ wait 8s ──▶ Attempt 5 fails
     ──▶ max retries reached ──▶ move to Dead-Letter Queue (stop retrying; alert / inspect)
```

- **Exponential backoff formula:** `delay = min(base * 2^attempt, maxDelay)`. E.g., base = 1s → 1s, 2s, 4s, 8s, 16s...
- **Jitter** prevents synchronized retries: instead of every failing client retrying at exactly `t+4s`, each picks a random delay near that value (e.g., `random(0, delay)` — "full jitter" — or `delay/2 + random(0, delay/2)` — "equal jitter"), spreading load out.
- **Classify the error before deciding to retry:**

| Error type | Example | Retry? |
|---|---|---|
| Transient / infrastructure | Network timeout, 503, connection reset | Yes |
| Rate limited | 429 Too Many Requests | Yes, respecting `Retry-After` if present |
| Permanent / client error | 400 Bad Request, malformed payload, "user not found" | **No** — will never succeed; fail fast to DLQ |
| Business logic failure | "Insufficient inventory" | Usually no — this needs a different workflow, not a retry |

- **Max retry count** (and/or max total retry duration) bounds how long a message keeps trying before being dead-lettered — retrying forever is rarely correct.
- **DLQ is not a graveyard** — it should be actively monitored, with a process (automated or manual) to inspect, fix the underlying cause, and optionally re-drive messages back into the main queue.

**5. Syntax and API**

```js
// BullMQ: built-in attempts + exponential backoff + explicit failure classification
const { Queue, Worker } = require('bullmq');

const webhookQueue = new Queue('webhook-delivery', { connection });

await webhookQueue.add('deliver', payload, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },   // 1s, 2s, 4s, 8s, 16s (BullMQ adds its own jitter)
});

class PermanentError extends Error {}   // marker for "do not retry"

new Worker('webhook-delivery', async (job) => {
  const res = await fetch(job.data.url, { method: 'POST', body: JSON.stringify(job.data.body) });
  if (res.status === 400) throw new PermanentError(`Bad request: ${await res.text()}`);
  if (!res.ok) throw new Error(`Delivery failed: ${res.status}`);   // retryable
}, { connection });

// A separate DLQ queue for jobs that exhaust all attempts, wired via the 'failed' event
new Worker('webhook-delivery', () => {}, { connection }).on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts || err instanceof PermanentError) {
    await deadLetterQueue.add('failed-webhook', { originalJob: job.data, error: err.message });
  }
});
```

```js
// Manual exponential backoff with full jitter, for a raw retry loop outside a queue library
async function withRetry(fn, { maxAttempts = 5, baseMs = 200, maxMs = 10_000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt >= maxAttempts || err instanceof PermanentError) throw err;
      const cappedDelay = Math.min(baseMs * 2 ** (attempt - 1), maxMs);
      const jittered = Math.random() * cappedDelay;                 // full jitter
      await new Promise((r) => setTimeout(r, jittered));
    }
  }
}
```

**6. Small example** — see backoff spacing and DLQ routing:

```js
// backoff-demo.js
let calls = 0;
async function flaky() {
  calls++;
  if (calls < 4) throw new Error(`fail #${calls}`);
  return 'success';
}
await withRetry(flaky, { maxAttempts: 5, baseMs: 500 });
console.log(`succeeded after ${calls} calls`);
```

Log the timestamp of each attempt and confirm the gaps roughly double (with jitter making them non-identical).

**7. Real backend usage**
- **Webhook delivery** to third parties (Stripe-style): retry with backoff, dead-letter after N attempts, surface failures in a dashboard the integrator can inspect.
- **Calling flaky third-party APIs** (payment gateways, SMS providers) from within a job.
- **Database deadlock retries**: an immediate short retry (not full backoff) is often the right response to a transient deadlock (Phase 6.5).
- Message brokers' built-in retry/DLQ features: SQS redrive policies, RabbitMQ dead-letter exchanges, BullMQ's `attempts`/`backoff` options.

**8. Edge cases**
- **Retrying a non-idempotent operation is dangerous on its own** — retries and idempotency (15.5) are a package deal; retrying "charge the customer $50" without idempotency protection can charge them multiple times.
- **`Retry-After` header**: some APIs tell you exactly how long to wait (especially on 429); honor it instead of your own backoff schedule when present.
- **Retry budgets**: in a system under load, retries from *every* failing caller can *cause* an overload — some systems cap total retry volume system-wide ("retry budget") rather than per-request.
- A DLQ that nobody monitors is functionally the same as silently dropping messages — worse, in some ways, since it creates false confidence that "we don't lose data."

**9. Common mistakes**
- Retrying immediately in a tight loop with no delay ("retry storm"), amplifying an outage.
- Retrying every error identically, including permanent 400-class errors that will never succeed.
- No maximum attempt count — an always-failing job retries forever, consuming worker capacity indefinitely.
- Building a DLQ and never building the process to look at it.
- No jitter: thousands of clients backing off identically all retry at the exact same instant, causing a new spike.

**10. Interview answer**
> "I classify failures before retrying: transient errors like timeouts get retried with exponential backoff and jitter, so I'm not retrying instantly forever or synchronizing retry storms with every other failing client; permanent errors like a 400 fail fast with no retry. After a bounded number of attempts, the message moves to a dead-letter queue instead of retrying forever, and that DLQ is monitored, not just a place things quietly disappear to. Retries only make sense paired with idempotent processing, since the same message can end up being attempted more than once."

**11. Practice problem**
1. Implement `withRetry` above; test it against a function that fails a random number of times, and against a `PermanentError` that should not retry at all.
2. Build the BullMQ webhook queue with `attempts: 5` and exponential backoff; point it at a local server that always returns 500, and watch it reach the DLQ.
3. Add a `Retry-After`-aware branch: when the target returns 429 with that header, wait exactly that long instead of your computed backoff.
4. Build a tiny DLQ inspector script that lists dead-lettered jobs and lets you re-enqueue one back into the main queue.

**12. Production considerations**
- Make retry policy (max attempts, backoff base/cap, which errors are retryable) an explicit, reviewed decision per job type — not a copy-pasted default.
- Alert on DLQ growth rate, not just its existence; a sudden spike usually means a downstream dependency is broken.
- Build (even a minimal) DLQ re-drive tool before you need it under pressure.
- Track retry rate as a health metric for downstream dependencies (Phase 19) — rising retries are often the earliest signal of a degrading third-party service.

---
## 15.5 Idempotent Consumers

`MUST KNOW`

**1. Proper definition**
An operation is **idempotent** if performing it multiple times has the exact same effect as performing it once. An **idempotent consumer** is a message handler written so that processing the same message more than once — which, per 15.3, *will* happen — produces the correct end state regardless of how many times it runs.

**2. Simple meaning**
Pressing an elevator call button five times doesn't call five elevators. Pressing "delete this file" a second time (after it's already deleted) shouldn't error or delete something else — the end state ("file gone") is the same either way. Consumers need that same property, because the queue *will* deliver the same message more than once eventually.

**3. Why it is needed**
Section 15.3 established that at-least-once delivery is the practical norm, not an edge case — duplicate delivery *will* happen in production, from crashed workers, expired locks, network retries, and redriven DLQ messages. If your consumer isn't idempotent, "duplicate delivery" becomes "duplicate email sent," "customer charged twice," or "inventory decremented twice for one order." Idempotency is what makes at-least-once delivery *behave like* exactly-once from the outside.

**4. How it works internally**

**Strategy 1 — Idempotency key + dedup store (most general):**

```text
1. Every job carries a unique idempotency key (often the same as a client-supplied request ID,
   or a deterministic ID derived from the business event, e.g. "order:4521:charge")
2. Before doing the real work, the worker checks: "have I already processed this key?"
3. If yes → skip the work, return the previously recorded result (or just no-op)
4. If no  → do the work, then atomically record "this key is done" (ideally in the SAME
             transaction as the side effect, e.g. writing to the database)
```

```sql
-- a dedup/idempotency table (works well alongside a relational side effect)
CREATE TABLE processed_jobs (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  processed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Strategy 2 — Natural idempotency via the operation itself (no extra state needed):**
- `UPDATE users SET status = 'active' WHERE id = 42` — running this 5 times leaves the exact same end state as running it once. **Setting** a value is naturally idempotent; **incrementing** one (`balance = balance + 10`) is not.
- `DELETE FROM sessions WHERE id = ?` — deleting an already-deleted row is a no-op, not an error.
- Database **unique constraints** turn "insert a row for this event" into idempotent behavior for free: a second insert with the same unique key fails with a constraint violation, which the consumer catches and treats as "already done," not as a real error.

**Strategy 3 — Upsert instead of insert-then-check:**

```sql
INSERT INTO order_items (order_id, sku, qty) VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE qty = VALUES(qty);   -- MySQL upsert: safe to run more than once
```

- **Idempotent vs merely "safe to retry":** GET and DELETE are naturally idempotent HTTP methods (Phase 0.1.7); POST is not, by default — this is exactly why payment/order-creation APIs commonly require the client to pass an explicit **idempotency key** header, and the server deduplicates using the same strategy shown above.

**5. Syntax and API**

```js
// Idempotency key + dedup table, inside the SAME transaction as the side effect
async function chargeCustomer(job) {
  const { orderId, amount } = job.data;
  const idempotencyKey = `charge:${orderId}`;             // deterministic, not random

  await db.transaction(async (trx) => {
    const already = await trx('processed_jobs').where({ idempotency_key: idempotencyKey }).first();
    if (already) return;                                  // already handled — safe no-op

    await paymentGateway.charge(orderId, amount, { idempotencyKey }); // many gateways support this too
    await trx('orders').where({ id: orderId }).update({ status: 'charged' });
    await trx('processed_jobs').insert({ idempotency_key: idempotencyKey });
  });
}
```

```js
// Natural idempotency: no dedup table needed at all
async function markEmailSent(job) {
  // Running this 100 times leaves users.welcome_email_sent = true. No duplicate side effect.
  await db('users').where({ id: job.data.userId }).update({ welcome_email_sent: true });
}

async function sendWelcomeEmailIdempotently(job) {
  const user = await db('users').where({ id: job.data.userId }).first();
  if (user.welcome_email_sent) return;                     // guard BEFORE the real side effect
  await emailProvider.send(user.email, 'Welcome!');
  await markEmailSent(job);
}
```

**6. Small example** — prove a consumer is (or isn't) idempotent:

```js
// Run the SAME job payload through a handler 3 times in a row and assert on the end state,
// not on "did it error" — that's the real idempotency test.
async function testIdempotent(handler, job) {
  await handler(job); await handler(job); await handler(job);
  // assert: exactly one email sent / exactly one charge / exactly one row — not three
}
```

**7. Real backend usage**
- Payment processing (this is the canonical example — Stripe, and most payment gateways, require and support idempotency keys explicitly for this exact reason).
- Order/inventory systems: decrementing stock must be guarded, or a redelivered "order placed" message oversells inventory.
- Webhook receivers (you *consuming* someone else's webhooks): third parties like Stripe and GitHub explicitly document that webhooks can be delivered more than once, and expect you to dedupe by event ID.
- Email/SMS/notification sending: dedupe by a deterministic key so users don't get duplicate messages.

**8. Edge cases**
- **The dedup check and the side effect must be atomic together** — checking "already processed?" and then doing the work as two separate, non-transactional steps reopens the exact race condition idempotency was meant to close (two redeliveries can both pass the check before either records completion).
- **External side effects you don't control**: if the third-party API itself isn't idempotent (no idempotency key support), you may need to record "I attempted this externally" *before* calling it, and be prepared for ambiguous "did it actually go through?" states after a timeout.
- **Idempotency keys need bounded retention** — an unbounded `processed_jobs` table grows forever; expire old keys once you're safely past any possible redelivery window.
- **Partial failure mid-job**: if a job does two side effects (charge card, then update order) and crashes between them, naive retries can double-charge or leave inconsistent state — this is exactly why the Outbox pattern (15.6) exists for multi-step, cross-system work.

**9. Common mistakes**
- Treating "the queue redelivered it" as rare enough to ignore, then discovering duplicate charges in production.
- Checking "already processed?" outside the transaction that performs the side effect (a classic time-of-check-to-time-of-use bug).
- Using a **random** ID (e.g., `crypto.randomUUID()` generated fresh on each attempt) as the "idempotency key" instead of a **deterministic** one derived from the business event — a new random key on every redelivery defeats the entire purpose.
- Confusing "idempotent" with "safe to run concurrently" — idempotency is about repeated delivery of the *same* message, not about two *different* concurrent operations, which is a separate concern (locking, Phase 6.5).

**10. Interview answer**
> "Because queues guarantee at-least-once delivery, the same message can be processed more than once, so I write consumers to be idempotent — processing a message twice must produce the same end state as processing it once. I do this with a deterministic idempotency key, usually derived from the business event, checked and recorded atomically in the same transaction as the actual side effect, or by relying on naturally idempotent operations like SET rather than INCREMENT, or database unique constraints and upserts."

**11. Practice problem**
1. Build `chargeCustomer` above against a local table-based mock payment gateway; run the same job three times and prove only one charge is recorded.
2. Break it on purpose: move the dedup check outside the transaction, then race two concurrent calls with the same key and observe the double-charge.
3. Take the welcome-email worker from 15.2 and make it idempotent using natural idempotency (a `welcome_email_sent` flag) instead of a separate dedup table; justify why that's sufficient here.
4. Design an idempotency strategy for "decrement inventory by 1 for this order" and explain what breaks if you use `INCREMENT`/`DECREMENT` directly without a guard.

**12. Production considerations**
- Require and document an idempotency strategy for every job type that has an external or financial side effect — treat it as a launch blocker, not a nice-to-have.
- Prefer deterministic keys derived from business identifiers (`order:4521:charge`) over random ones generated per attempt.
- Set a retention/cleanup policy for dedup tables so they don't grow unbounded.
- When calling third-party APIs, pass *their* idempotency key support through (most major payment/messaging APIs have it) rather than reinventing dedup on both sides independently.

---

## 15.6 Outbox and Inbox Patterns

`MUST KNOW`

**1. Proper definition**
The **Outbox pattern** solves the problem of atomically committing a database change *and* reliably publishing a corresponding message, by writing both the business data *and* the message-to-be-sent into the **same local database transaction** (an `outbox` table), then having a separate, reliable process read that table and publish the messages to the real queue/broker. The **Inbox pattern** is its consumer-side counterpart: recording each *incoming* message's ID in an `inbox` table before processing, so duplicate deliveries can be recognized and skipped — a structured, durable implementation of the idempotency strategy from 15.5.

**2. Simple meaning**
Outbox: instead of "save the order to the database" and "tell the queue about it" being two separate, independently-failable steps, you write "order saved" *and* "message to send" as one atomic entry in your own ledger (the outbox table) — then a dedicated mail carrier reliably delivers everything in that ledger to the real post office (the broker) afterward. Inbox: keep a logbook of every message ID you've already handled, so if the same letter arrives twice, you recognize it and don't act on it again.

**3. Why it is needed**
This directly solves the **dual-write problem**: "update the database" and "publish a message" are two different systems that cannot be updated together in one atomic operation. If you update the database and then the process crashes (or the broker is briefly unreachable) *before* publishing, the message is lost forever — even though the database change succeeded. If you publish the message *first* and then the database write fails, consumers act on an event that never actually happened. The Outbox pattern eliminates this by making the *message* part of the same local database transaction as the business data, so both succeed or both roll back together — there's no window where one happens without the other.

**4. How it works internally**

**Outbox — the write side:**

```text
┌─────────────────────────── ONE database transaction ───────────────────────────┐
│  INSERT INTO orders (...) VALUES (...)                                          │
│  INSERT INTO outbox (id, event_type, payload, created_at, published)            │
│         VALUES (uuid, 'order.created', '{"orderId":123,...}', now(), false)     │
└───────────────────────────────────────────────────────────────────────────────┘
                                    │  COMMIT (both rows exist, or neither does)
                                    ▼
         ┌─────────────────────────────────────────────────────────┐
         │  Relay process (polling loop, or Change Data Capture)     │
         │  reads unpublished outbox rows → publishes to the real     │
         │  queue/broker → marks them published (or deletes them)     │
         └─────────────────────────────────────────────────────────┘
```

- **Relay implementation options:**
  - **Polling:** a worker periodically runs `SELECT * FROM outbox WHERE published = false ORDER BY created_at LIMIT 100`, publishes each, marks it published. Simple, adds polling latency (typically sub-second to a few seconds), works with any database.
  - **Change Data Capture (CDC):** a tool (e.g., Debezium) tails the database's replication/binlog and streams new outbox rows to the broker in near-real-time without polling. More infrastructure, lower latency, decouples the relay from application code entirely.
- Either way, the relay's own publish step must be retried until it succeeds (15.4) — but that's now safe, because the row stays in the outbox (unpublished) until it's confirmed sent, so a relay crash just means it tries again, not that the event is lost. Publishing may itself be delivered more than once to the broker — which is fine, because consumers are idempotent (15.5).

**Inbox — the read side (a structured version of the 15.5 dedup table, per message source):**

```sql
CREATE TABLE inbox (
  message_id   VARCHAR(255) PRIMARY KEY,   -- the broker's message/event ID
  received_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```text
On message arrival:
1. BEGIN transaction
2. INSERT INTO inbox (message_id) VALUES (?)   -- fails with a constraint violation if seen before
3. ... perform the business side effect ...
4. COMMIT
   (if step 2's insert fails because the row already exists → this is a duplicate → skip processing entirely)
```

**5. Syntax and API**

```js
// Outbox write — order creation and event as one atomic transaction
async function createOrder(orderData) {
  return db.transaction(async (trx) => {
    const [order] = await trx('orders').insert(orderData).returning('*');
    await trx('outbox').insert({
      id: crypto.randomUUID(),
      event_type: 'order.created',
      payload: JSON.stringify({ orderId: order.id, total: order.total }),
      published: false,
    });
    return order;                    // both rows committed together, or neither is
  });
}
```

```js
// Outbox relay — simple polling implementation
async function relayOutboxOnce() {
  const rows = await db('outbox').where({ published: false }).orderBy('created_at').limit(100);
  for (const row of rows) {
    await eventQueue.add(row.event_type, JSON.parse(row.payload), { jobId: row.id }); // deterministic ID
    await db('outbox').where({ id: row.id }).update({ published: true });
  }
}
setInterval(relayOutboxOnce, 1000);   // poll every second
```

```js
// Inbox — dedupe on the consumer side using a DB constraint as the guard
async function handleOrderCreatedEvent(message) {
  try {
    await db.transaction(async (trx) => {
      await trx('inbox').insert({ message_id: message.id });   // throws if duplicate (PK violation)
      await trx('inventory').where({ sku: message.sku }).decrement('stock', 1);
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return;                   // seen before — safe no-op, not an error
    throw err;
  }
}
```

**6. Small example** — see the dual-write problem, then fix it:

```js
// BROKEN: two independent writes — a crash between them loses the event forever
async function createOrderBroken(orderData) {
  const order = await db('orders').insert(orderData);   // succeeds...
  // ...process crashes right here, or the broker is unreachable...
  await eventQueue.add('order.created', order);          // ...never runs. Order exists, no event ever sent.
  return order;
}
```

Compare against `createOrder` above: simulate a crash right after the transaction commits but before `relayOutboxOnce` runs — restart the relay and confirm the event is still delivered, because it was durably recorded in the same transaction as the order.

**7. Real backend usage**
- Publishing domain events (`order.created`, `user.signed_up`) reliably from a service that also needs to update its own database — extremely common in event-driven and microservice architectures.
- Change Data Capture-based outboxes (Debezium + Kafka) are the standard production pattern at larger scale, replacing hand-rolled polling relays.
- The Inbox pattern is essentially "15.5's idempotency table," formalized as a named pattern, applied specifically at the boundary where messages enter a service.

**8. Edge cases**
- **Outbox table growth**: published rows should be archived or deleted on a schedule, not kept forever.
- **Ordering across the relay**: a polling relay processing `LIMIT 100 ORDER BY created_at` is only as ordered as your polling loop allows — high-throughput systems need care here (or a CDC-based relay, which preserves commit order naturally).
- **The relay itself needs idempotent publishing** — use a deterministic `jobId`/message key derived from the outbox row ID, so if the relay crashes after publishing but before marking the row published, the retry doesn't create a second logical event (or if it does, downstream consumers dedupe it via their own inbox).
- **Inbox retention** has the same unbounded-growth concern as any dedup table (15.5) — expire old entries once safely past the redelivery window.

**9. Common mistakes**
- Publishing to the queue *before* committing the database transaction ("just in case the commit fails") — this creates the opposite failure mode: consumers act on data that was never actually saved.
- Doing the database write and the publish as two calls with no transactional link at all, and assuming "it'll basically always both succeed" — true until the one time it doesn't, in production, silently.
- Implementing Outbox without ever building the relay's failure handling — the relay is a consumer too, and needs the same retry/monitoring discipline as any other worker.
- Skipping the Inbox pattern because "the queue basically doesn't duplicate messages" — per 15.3, it will, eventually.

**10. Interview answer**
> "The Outbox pattern solves the dual-write problem: you can't atomically update a database and publish to a message broker as one operation, because they're different systems. Instead, I write the business change and an outbox row describing the event in the same local transaction, so they commit or roll back together, and a separate relay process reliably publishes outbox rows to the real broker afterward, retrying until it succeeds. The Inbox pattern is the same idea on the consumer side — recording each incoming message's ID before processing, so a redelivered message is recognized and skipped instead of processed twice."

**11. Practice problem**
1. Build `createOrder`/`relayOutboxOnce` above; kill the relay process mid-run and confirm no event is ever lost, only delayed.
2. Build the broken dual-write version; deliberately throw an error between the two writes and show the event never gets sent even though the order exists.
3. Implement the Inbox handler and prove it's safe against the same message being delivered 5 times in a row.
4. Add an archival step that moves `outbox` rows older than 7 days and already published into an `outbox_archive` table.

**12. Production considerations**
- Monitor outbox lag (oldest unpublished row's age) as a first-class metric — growing lag means the relay is stuck or falling behind.
- Prefer CDC-based relays (Debezium or your cloud provider's equivalent) once polling latency or database load from frequent polling becomes a problem.
- Archive/delete old outbox and inbox rows on a schedule; don't let either grow unbounded.
- Treat the relay process itself as critical infrastructure requiring the same on-call attention as your primary API — if it's down, every event silently backs up.

---
## 15.7 Ordering, Partitioning, and Consumer Groups

`MUST KNOW`

**1. Proper definition**
**Ordering** is a guarantee about the sequence in which messages are delivered relative to each other. **Partitioning** is splitting a stream of messages into multiple independent, ordered sub-streams (partitions), each identified by a **partition key**, so that messages with the same key always land in — and are processed in order within — the same partition, while different partitions can be processed fully in parallel. A **consumer group** is a set of consumer instances that split the partitions of a topic between them, so the group as a whole processes all partitions in parallel while each individual partition is still handled by exactly one consumer at a time.

**2. Simple meaning**
Imagine one single-file line (strict global order, but only one cashier can ever serve it — no parallelism) versus splitting customers into several lines by, say, the first letter of their last name (each individual line stays in order, but different lines move independently and in parallel). A consumer group is like adding more cashiers, but never putting two cashiers on the exact same line — each customer is still served by exactly one cashier, in that line's order.

**3. Why it is needed**
A single, plain queue with multiple workers gives you throughput but **no ordering guarantee at all** between messages — two workers can pull two messages at nearly the same instant and finish in either order. Many real workflows need *some* ordering (all events for the same user, or the same order, must be processed in the sequence they happened) while still wanting to scale horizontally. Partitioning is the standard way to get both: order **within a key**, parallelism **across keys**.

**4. How it works internally**

```text
Topic "order-events", 4 partitions, partitioned by orderId

  orderId=101 events ──hash(101) % 4──▶ always Partition 0 ──▶ strictly ordered within Partition 0
  orderId=205 events ──hash(205) % 4──▶ always Partition 2 ──▶ strictly ordered within Partition 2
  orderId=340 events ──hash(340) % 4──▶ always Partition 0 ──▶ interleaved with orderId=101's events,
                                                                  but each key's own events stay in order

  Consumer Group "inventory-service" (3 consumer instances, 4 partitions):
    Consumer A ──▶ Partition 0                    (one partition can have only one consumer)
    Consumer B ──▶ Partition 1
    Consumer C ──▶ Partitions 2 and 3              (uneven split when consumers < partitions)
```

- **Choosing a partition key** is the central design decision: it should be whatever entity needs strict relative ordering — `orderId`, `userId`, `accountId`. All events sharing that key go to the same partition and are processed in order; events for *different* keys have no ordering guarantee relative to each other, by design.
- **Partition count sets your maximum parallelism** for a topic: you can never have more *active* consumers usefully working a topic than it has partitions — extra consumers beyond the partition count sit idle for that topic. Partition count is typically fixed (or costly to change) after creation, so it's chosen with future scale in mind.
- **Consumer group mechanics (Kafka model):** each partition is assigned to exactly one consumer *within* a group at a time; if a consumer joins, leaves, or crashes, the group triggers a **rebalance**, reassigning partitions among the remaining members. Multiple *different* consumer groups can each independently consume the *entire* topic — groups don't share progress with each other (this is how one topic can feed both an "email service" and an "analytics service" independently, each seeing every message).
- **Offsets:** instead of BullMQ/SQS-style per-message ack, Kafka consumers track a per-partition **offset** — "I have processed up through message #4521 in this partition" — and commit that offset periodically. Committing too early (before processing) risks message loss on crash; committing too late/rarely risks reprocessing more messages on restart (an at-least-once trade-off, same theme as 15.3, expressed differently).
- **Plain queues (SQS/RabbitMQ) vs partitioned logs (Kafka):** SQS FIFO queues offer a similar idea at smaller scale via **message group IDs** (same concept as a partition key, capped at lower throughput); Kafka is built around partitioning as its core scaling primitive from the ground up. RabbitMQ achieves ordering-per-consumer more simply, since a classic queue with one consumer is trivially ordered, at the cost of not parallelizing that single ordered stream.

**5. Syntax and API** — Kafka (via `kafkajs`), the canonical tool for this topic:

```js
// producer.js — partition key = orderId, so all events for one order stay ordered
const { Kafka } = require('kafkajs');
const kafka = new Kafka({ clientId: 'orders-service', brokers: ['localhost:9092'] });
const producer = kafka.producer();

await producer.connect();
await producer.send({
  topic: 'order-events',
  messages: [{ key: String(order.id), value: JSON.stringify({ type: 'order.created', order }) }],
  //          ^^^^^^^^^^^^^^^^^^^^^^ the partition key — same orderId always → same partition
});
```

```js
// consumer.js — joining a consumer group; Kafka handles partition assignment and rebalancing
const consumer = kafka.consumer({ groupId: 'inventory-service' });
await consumer.connect();
await consumer.subscribe({ topic: 'order-events', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ partition, message }) => {
    console.log(`partition ${partition}, key ${message.key}, offset ${message.offset}`);
    await updateInventory(JSON.parse(message.value.toString()));
    // kafkajs auto-commits offsets on an interval by default; for critical flows,
    // disable auto-commit and commit manually only after the handler succeeds.
  },
});
```

```js
// SQS FIFO — the message-group-id equivalent of a partition key
await sqs.send(new SendMessageCommand({
  QueueUrl, MessageBody: JSON.stringify(event),
  MessageGroupId: String(order.id),              // same role as Kafka's partition key
  MessageDeduplicationId: idempotencyKey,          // built-in dedup window, ties back to 15.5
}));
```

**6. Small example** — prove ordering within a key, and its absence across keys:

```js
// Send 5 events for orderId=1 and 5 for orderId=2, interleaved, as fast as possible.
for (let i = 0; i < 5; i++) {
  await producer.send({ topic: 'order-events', messages: [{ key: '1', value: `event-${i}` }] });
  await producer.send({ topic: 'order-events', messages: [{ key: '2', value: `event-${i}` }] });
}
// Consume and log (partition, key, value, offset). You'll see: within key "1", offsets always
// increase in send order; same for key "2" — but the two keys' events can interleave freely.
```

**7. Real backend usage**
- **Per-user or per-entity event streams** where order matters: all events for one bank account, one shopping cart, or one chat conversation must apply in sequence.
- **Change Data Capture pipelines** (15.6) naturally partition by the source table's primary key.
- **Multiple independent downstream services** consuming the same event stream (email service, analytics service, fraud-detection service), each as its own consumer group with its own pace and its own failure handling.
- Log aggregation and event-sourcing systems (Phase 17, Phase 23) are built on exactly this partitioned-log model.

**8. Edge cases**
- **A poorly chosen or missing partition key** (e.g., using a random key, or no key at all) spreads related events across partitions essentially at random, silently destroying the ordering guarantee your consumers were assuming.
- **Hot partitions**: a partition key with wildly uneven distribution (one giant customer generating 90% of traffic) overloads a single partition/consumer while others sit idle — partition count doesn't help if the *key* itself is skewed.
- **Rebalancing pauses processing** briefly across the whole group while partitions are reassigned — frequent consumer crashes or slow-starting consumers can make this disruptive.
- **Scaling consumers beyond partition count** does nothing for that topic — the extra consumers in the group simply have no partition to own.
- Changing partition count later usually **breaks existing key→partition mapping** (the hash target changes), which can silently reorder previously-guaranteed-ordered streams — plan partition count for future scale up front.

**9. Common mistakes**
- Assuming "it's a message queue, so of course my messages are processed in order" without checking whether the specific tool and configuration actually provide that guarantee (plain SQS/RabbitMQ with multiple consumers do not, by default).
- Using a partition key that doesn't match the actual ordering requirement (partitioning by `region` when the real need is per-`userId` ordering).
- Sizing partition count for today's load instead of anticipated scale, then hitting a hard parallelism ceiling later.
- Manually committing Kafka offsets *before* processing completes "to be safe," which actually risks silent message loss on a crash between commit and completion — the opposite of the intended safety.

**10. Interview answer**
> "A plain queue with multiple consumers gives throughput but no ordering guarantee between messages. Partitioning solves that: messages are grouped by a key — like order ID — so all events for the same key always land in the same partition and are processed in order, while different keys are processed fully in parallel across partitions. A consumer group splits a topic's partitions across its members, so the group scales horizontally, but each partition is still owned by exactly one consumer at a time, which is what preserves per-key ordering. Partition count sets the ceiling on real parallelism, and picking the right partition key is the most important design decision in the whole setup."

**11. Practice problem**
1. Run local Kafka (via Docker), create a 4-partition topic, and reproduce the ordering demo above — confirm per-key order and cross-key interleaving.
2. Start two consumer instances in the same group; kill one mid-run and observe the rebalance and partition reassignment in the logs.
3. Deliberately use a bad partition key (e.g., random UUID per message) and demonstrate that per-order ordering breaks.
4. Compare: implement the same "ordered per order ID" requirement using SQS FIFO with `MessageGroupId`, and note what SQS gives you for free vs. what Kafka's model additionally provides (replay, multiple independent consumer groups, much higher partition-level parallelism).

**12. Production considerations**
- Choose the partition key based on your actual ordering requirement, not on convenience — get this right before production traffic depends on it.
- Provision partition count with room for multi-year growth; changing it later is disruptive.
- Monitor per-partition lag (how far behind each partition's consumer is), not just an aggregate — a single hot or stuck partition can hide behind a healthy-looking average.
- Design consumers to handle rebalances gracefully (idempotency again pays off here — a message can be reprocessed by a new partition owner after a rebalance).

---

## 15.8 Backpressure

`MUST KNOW`

**1. Proper definition**
**Backpressure** is a signal or mechanism that tells a fast producer (or upstream stage) to slow down, because a slower consumer (or downstream stage) cannot keep up — preventing unbounded buildup of unprocessed work.

**2. Simple meaning**
A kitchen with one cook and orders coming in faster than they can be cooked. Without backpressure, tickets pile up on the rail forever, food arrives cold hours late, and eventually the rail itself overflows. With backpressure, the front-of-house is told to stop seating new customers (or slow down taking orders) until the kitchen catches up.

**3. Why it is needed**
A queue can absorb *temporary* bursts, but if a producer sustainedly outpaces its consumers, an unbounded queue doesn't solve the problem — it just delays and hides it, growing memory/storage usage, increasing latency for every message (since new messages wait behind an ever-growing backlog), and risking an eventual crash (out of memory, disk full, or the broker itself falling over). Backpressure makes the imbalance visible and controllable *before* it becomes an outage.

**4. How it works internally**

```text
Without backpressure:                          With backpressure:
Producer: 1000 msg/s ──▶ Queue grows forever    Producer: told to slow to 200 msg/s (or blocked/rejected)
Consumer:  200 msg/s ──▶ (unbounded backlog,    Consumer:  200 msg/s ──▶ queue stays bounded, latency stable
            growing latency for every message)
```

Common backpressure mechanisms, roughly from least to most disruptive:

| Mechanism | How it works | Trade-off |
|---|---|---|
| **Consumer-side rate limiting** | Worker deliberately processes at a controlled rate/concurrency | Simple; doesn't slow the producer, only bounds consumer resource use |
| **Bounded queue + block** | Producer's `add()`/`send()` call blocks until there's room | Producer naturally slows; can stall the producer's own request path if not careful |
| **Bounded queue + reject** | Once full, new messages are rejected (e.g., HTTP `429 Too Many Requests`) | Producer must handle rejection (retry later, drop, or surface to the end user) |
| **Load shedding** | Deliberately and selectively drop or reject *lower-priority* work first when overloaded | Preserves capacity for critical work; requires priority to be modeled |
| **Autoscaling consumers** | Add more worker instances as queue depth grows | Addresses genuine capacity shortfalls; doesn't help if the bottleneck is a shared downstream resource (one database) that scaling workers alone can't fix |
| **Reactive streams / pull-based flow control** | Consumer explicitly requests N more items when ready (Node streams' backpressure, Kafka's pull model) | Precise, built into the protocol itself; more complex to implement from scratch |

- **Node.js streams already model this natively:** `writable.write()` returns `false` when its internal buffer is full, signaling the producer to pause via the `'drain'` event before writing more — this is backpressure at the language/runtime level, and the same core idea as everything above at the infrastructure level (Phase 4.4 covered the stream mechanics; this section is the same concept at system scale).
- **Backpressure vs. just "add more workers":** adding consumers only helps if the true bottleneck is consumer *count*. If every worker is waiting on the same overloaded database or third-party API, more workers just apply more pressure to that same choke point — the bottleneck must be correctly identified first.

**5. Syntax and API**

```js
// Consumer-side concurrency limit — the simplest, most common form of backpressure in a worker
const worker = new Worker('reports', handler, {
  connection,
  concurrency: 5,          // never more than 5 jobs in flight, regardless of queue depth
  limiter: { max: 100, duration: 60_000 },   // and no more than 100 jobs started per 60s
});
```

```js
// Producer-side: reject new work once queue depth crosses a threshold, instead of enqueuing forever
async function enqueueWithBackpressure(queue, name, data, maxDepth = 10_000) {
  const counts = await queue.getJobCounts('waiting', 'active');
  const depth = counts.waiting + counts.active;
  if (depth >= maxDepth) {
    const err = new Error('Queue is overloaded, please retry later');
    err.status = 429;
    throw err;                       // surfaced to the HTTP client as 429, per Phase 0.1.7 / Phase 13
  }
  return queue.add(name, data);
}
```

```js
// Node stream backpressure, made visible
const { Readable } = require('node:stream');
function fastProducer() {
  let i = 0;
  return new Readable({
    read() { this.push(i++ < 1_000_000 ? String(i) + '\n' : null); },
  });
}
const dest = fs.createWriteStream('out.txt');
fastProducer().pipe(dest);   // pipe() automatically respects write()'s backpressure signal for you
```

**6. Small example** — watch an unbounded queue misbehave, then bound it:

```js
// unbounded.js — producer adds 10,000 jobs instantly; a slow consumer (1 job/200ms) falls further
// and further behind. Watch queue depth (getJobCounts) climb continuously and never recover
// until the producer stops entirely.
for (let i = 0; i < 10_000; i++) await queue.add('slow-job', { i });

// bounded.js — same producer, but wrapped with enqueueWithBackpressure(queue, ..., 500):
// once depth hits 500, new enqueue calls start throwing instead of piling up further.
```

**7. Real backend usage**
- Rate-limiting how fast an API accepts requests that fan out into background jobs, so a traffic spike degrades gracefully (some requests get a `429` and retry later) instead of the queue growing without bound and everything getting proportionally slower.
- Bounding worker concurrency against a shared downstream resource (a database connection pool, a third-party API's rate limit) so workers don't overwhelm it just because the queue has plenty of waiting work.
- Autoscaling worker fleets based on queue depth (a very common Kubernetes/cloud pattern) as the "add capacity" side of managing backpressure.
- Streaming large file uploads/downloads (Phase 4.4, Phase 16) relies on the same drain/pause mechanism to avoid buffering an entire large file in memory.

**8. Edge cases**
- **Backpressure applied at the wrong layer does nothing:** rate-limiting the API without bounding worker concurrency just moves the pileup from "queue depth" to "worker resource exhaustion," and vice versa — the whole pipeline, producer to consumer, needs consistent flow control.
- **Cascading backpressure:** if consumer A slows because *its* downstream (consumer B, or a database) is overloaded, and A has no backpressure of its own toward its producer, the imbalance simply moves upstream one hop at a time instead of being resolved.
- **Silent backpressure looks like "everything is just a bit slow"** long before it looks like an outage — rising queue depth and rising end-to-end latency are the earliest, most actionable signals, well before anything actually fails.
- Blocking a producer that's itself inside an HTTP request handler (rather than rejecting fast) can turn a queue overload into an HTTP timeout cascade — usually reject-fast (429) is safer than block-and-wait in that specific position.

**9. Common mistakes**
- Treating "the queue can hold millions of messages" as a solution to a sustained throughput mismatch, rather than a temporary buffer for genuine bursts — an ever-growing queue with ever-growing latency is a slow-motion outage, not a healthy system.
- Only monitoring "is the queue up," never "how deep is the queue" or "how old is the oldest message" — depth and age are the real early-warning signals.
- Adding worker instances without checking whether the real bottleneck is a shared resource those new workers will simply contend over harder.
- No producer-side limit at all, so a single runaway loop or a client-side bug can enqueue unbounded work with nothing to stop it.

**10. Interview answer**
> "Backpressure is how a system tells a fast producer to slow down when its consumers can't keep up, instead of letting an unbounded backlog build silently. I implement it at multiple layers: bounded worker concurrency so workers don't overwhelm a shared downstream resource, and a producer-side check — reject with 429 once queue depth crosses a threshold — so a sustained overload degrades predictably instead of growing latency for everyone forever. The key metrics are queue depth and oldest-message age, since those signal trouble well before anything actually fails."

**11. Practice problem**
1. Reproduce the unbounded-vs-bounded demo above; graph queue depth over time for both, and note how much earlier the bounded version signals a problem.
2. Add worker concurrency limits tuned to a mock downstream API's rate limit (say, 10 req/s); prove the worker never exceeds it even at high queue depth.
3. Build a `/health/queue` endpoint reporting current depth and oldest-waiting-job age; wire an alert threshold for each.
4. Design (on paper) end-to-end backpressure for a system where a public API enqueues jobs consumed by workers that call a third-party service with a strict rate limit — identify every layer that needs a limit.

**12. Production considerations**
- Alert on queue depth trend and oldest-message age, not just raw depth — a queue that's deep but draining is very different from one that's deep and growing.
- Autoscale workers against queue depth where the bottleneck genuinely is worker count, and against downstream capacity limits otherwise.
- Decide, per producer, whether overload should block, reject, or shed low-priority work — and make that an explicit design choice, not an accident of default configuration.
- Load-test the full pipeline (producer through consumer through downstream dependency) under sustained overload, not just burst load, before trusting it in production.

---
# Phase 15 Capstone Project — "Background Jobs & Messaging Platform"

Purpose: apply every Phase 15 topic in one cohesive system, covering all five practice projects named in the roadmap: an **email worker**, a **report generation worker**, a **file processing worker**, a **notification queue**, and a **retryable job system**. Built on Node.js + BullMQ (Redis) + MySQL, reusing the API foundation from Phase 5 and the database skills from Phase 6.

**Requirements**

| # | Requirement | Concepts practiced |
|---|-------------|---------------------|
| 1 | `POST /users` creates a user synchronously, then enqueues a `welcome-email` job — response returns in under 50ms regardless of email provider latency | 15.1 (sync vs async) |
| 2 | Separate queues: `email`, `reports`, `file-processing`, `notifications`, each with its own worker process and independently tuned concurrency | 15.2 (queues, producers, consumers, workers) |
| 3 | Every job's handler is written to survive being run twice with identical results — no double emails, no double-decremented counters | 15.3, 15.5 (delivery guarantees, idempotency) |
| 4 | `report` jobs classify failures: a malformed report request fails immediately (no retry); a timeout from the data source retries with exponential backoff + jitter, up to 5 attempts, then lands in a `reports-dlq` | 15.4 (retries, backoff, DLQ) |
| 5 | User creation writes the user row *and* the outbox event in one transaction; a relay process publishes outbox events to the `notifications` queue; the notification consumer uses an `inbox` table to dedupe | 15.6 (outbox/inbox) |
| 6 | `file-processing` jobs are keyed by `userId` on a partitioned/grouped queue (BullMQ groups, or Kafka if you want the stretch goal) so one user's files always process in upload order, while different users' files process in parallel | 15.7 (ordering, partitioning) |
| 7 | The API enqueue endpoint rejects new `file-processing` jobs with `429` once that queue's depth exceeds a configured threshold; workers are concurrency-capped against a mock "storage API" rate limit | 15.8 (backpressure) |
| 8 | A `GET /jobs/:id/status` endpoint lets a client poll whether their async work (e.g., report generation) is `queued`, `processing`, `completed`, or `failed` | 15.1 (client feedback for async work) |
| 9 | A small DLQ inspector script lists dead-lettered jobs and can re-enqueue one back into its original queue | 15.4 |
| 10 | Structured logs (Phase 0.2.8 / Phase 19 preview) on every job: job id, queue, attempt number, duration, outcome | Cross-phase: observability |

**Starter skeleton**

```js
// queues.js — one file defining every queue and the shared Redis connection
const { Queue } = require('bullmq');
const connection = { host: '127.0.0.1', port: 6379 };

const queues = {
  email: new Queue('email', { connection }),
  reports: new Queue('reports', { connection }),
  fileProcessing: new Queue('file-processing', { connection }),
  notifications: new Queue('notifications', { connection }),
};
const reportsDlq = new Queue('reports-dlq', { connection });

module.exports = { connection, queues, reportsDlq };
```

```js
// api/users.js — Requirement 1 + 5: fast response, outbox for reliable event publishing
const { db } = require('../db');

async function createUser(req, res) {
  const user = await db.transaction(async (trx) => {
    const [row] = await trx('users').insert(req.body).returning('*');
    await trx('outbox').insert({
      id: crypto.randomUUID(),
      event_type: 'user.created',
      payload: JSON.stringify({ userId: row.id, email: row.email }),
      published: false,
    });
    return row;
  });
  res.status(201).json({ id: user.id });   // fast: no email/notification work happened inline
}
```

```js
// relay.js — Requirement 5: outbox relay, publishing into the notifications queue
const { queues } = require('./queues');
const { db } = require('./db');

async function relayOnce() {
  const rows = await db('outbox').where({ published: false }).orderBy('created_at').limit(100);
  for (const row of rows) {
    await queues.notifications.add(row.event_type, JSON.parse(row.payload), { jobId: row.id });
    await db('outbox').where({ id: row.id }).update({ published: true });
  }
}
setInterval(relayOnce, 1000);
```

```js
// workers/notifications.js — Requirement 5 (inbox side): dedupe delivered events
const { Worker } = require('bullmq');
const { connection } = require('../queues');
const { db } = require('../db');

new Worker('notifications', async (job) => {
  try {
    await db.transaction(async (trx) => {
      await trx('inbox').insert({ message_id: job.id });   // PK violation = duplicate delivery
      if (job.name === 'user.created') {
        await sendPushOrEmail(job.data);                    // the real side effect, guarded by inbox
      }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return;                // already handled — safe no-op
    throw err;
  }
}, { connection, concurrency: 10 });
```

```js
// workers/reports.js — Requirement 3 + 4: idempotent, classified retries, DLQ
const { Worker } = require('bullmq');
const { connection, reportsDlq } = require('../queues');
const { db } = require('../db');

class PermanentError extends Error {}

const worker = new Worker('reports', async (job) => {
  const { reportId } = job.data;
  const existing = await db('reports').where({ id: reportId }).first();
  if (existing?.status === 'completed') return;              // idempotent short-circuit (15.5)
  if (!existing) throw new PermanentError('Unknown report — will never succeed');

  await db('reports').where({ id: reportId }).update({ status: 'processing' });
  const data = await fetchReportDataOrThrow(reportId);        // may throw a transient error
  const file = await renderReportPdf(data);
  await db('reports').where({ id: reportId }).update({ status: 'completed', file_path: file });
}, { connection, concurrency: 3 });

worker.on('failed', async (job, err) => {
  const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (err instanceof PermanentError || isLastAttempt) {
    await reportsDlq.add('failed-report', { originalData: job.data, error: err.message });
    await db('reports').where({ id: job.data.reportId }).update({ status: 'failed' });
  }
});
```

```js
// workers/file-processing.js — Requirement 6 + 7: per-user ordering + backpressure
const { Worker } = require('bullmq');
const { connection } = require('../queues');

new Worker('file-processing', async (job) => {
  await callRateLimitedStorageApi(job.data);   // handler itself is naturally rate-aware
}, {
  connection,
  concurrency: 5,                              // capped against the mock storage API's limits (15.8)
  // BullMQ Pro-style groups, or a Kafka partition keyed by userId, give per-user ordering (15.7);
  // as a simpler approximation without Pro/Kafka, route same-user jobs to the same single-concurrency
  // queue (e.g. `file-processing:${userId}`) so BullMQ's own FIFO-per-queue ordering applies.
});
```

```js
// api/file-upload-enqueue.js — Requirement 7: reject instead of piling up
async function enqueueFileJob(req, res) {
  const counts = await queues.fileProcessing.getJobCounts('waiting', 'active');
  if (counts.waiting + counts.active > 5000) {
    return res.status(429).json({ error: 'File processing is at capacity, please retry shortly' });
  }
  await queues.fileProcessing.add('process-file', { userId: req.user.id, fileId: req.body.fileId });
  res.status(202).json({ status: 'queued' });
}
```

```js
// scripts/dlq-inspector.js — Requirement 9
const { reportsDlq, queues } = require('../queues');

async function listDeadLettered() {
  const jobs = await reportsDlq.getJobs(['waiting', 'completed']);
  jobs.forEach((j) => console.log(j.id, j.name, j.data.error));
}

async function redrive(jobId) {
  const job = await reportsDlq.getJob(jobId);
  await queues.reports.add('generate-report', job.data.originalData);
  await job.remove();
}
```

**Acceptance tests**

```bash
# Requirement 1: fast response despite background work
curl -w '%{time_total}\n' -X POST localhost:3000/users -d '{"email":"a@x.com"}'   # should be fast, not 500ms+

# Requirement 3/5: idempotency — deliver the same notification event 3 times, confirm one push/email
node -e "require('./workers/notifications')" &   # then manually re-add the same jobId 3x and check logs

# Requirement 4: DLQ path
curl -X POST localhost:3000/reports -d '{"reportId":"does-not-exist"}'   # should fail fast, no retries
# vs a reportId whose data source is mocked to always time out -> 5 attempts with growing delay -> DLQ

# Requirement 7: backpressure
for i in $(seq 1 6000); do curl -s -X POST localhost:3000/files/enqueue -d "{\"fileId\":$i}"; done
# expect 429s once queue depth crosses the threshold, not unbounded growth

# Requirement 8: status polling
curl localhost:3000/jobs/<job-id>/status
```

**Stretch goals:** swap the `file-processing` queue for real Kafka partitioning keyed by `userId` (15.7); replace the polling outbox relay with Debezium-based CDC (15.6); add per-queue Grafana dashboards for depth and oldest-message age (ties into Phase 19).

---

# Rapid-Fire Interview Questions (Phase 15)

Answer each aloud in 30–60 seconds, in simple English.

1. Why would you move work out of the request-response cycle? Give an example of something that should stay synchronous.
2. What is the difference between a producer, a consumer, and a worker?
3. What does "at-least-once delivery" mean, and why can't most real systems guarantee exactly-once?
4. What is a visibility timeout, and what happens if it's set too short? Too long?
5. Why is exponential backoff with jitter better than retrying immediately, or retrying with a fixed delay?
6. When should a failure be retried, and when should it fail fast to a dead-letter queue?
7. What makes an operation idempotent? Give one naturally idempotent database operation and one that is not.
8. Why does an idempotency check need to happen in the same transaction as the side effect it's guarding?
9. What problem does the Outbox pattern solve? What goes wrong without it?
10. What's the difference between the Outbox pattern and the Inbox pattern?
11. What is a partition key, and what happens if you choose a bad one?
12. What does a consumer group do, and what happens during a rebalance?
13. Why can't you scale a topic's consumers beyond its partition count?
14. What is backpressure, and name two different layers at which you could apply it.
15. Why is "the queue can hold millions of messages" not a real solution to sustained producer/consumer imbalance?
16. A queue's depth is growing steadily. Walk through how you'd diagnose and respond to it.
17. Your payment webhook handler runs twice for the same event. What's already in place to make that safe?
18. Design (verbally) a retryable job system for sending SMS through a flaky third-party provider.

---

# Cheat Sheets

**Delivery guarantee spectrum**

| Guarantee | Message ever lost? | Message ever duplicated? | Practical default? |
|---|---|---|---|
| At-most-once | Yes (possible) | No | Rare — only when loss is truly acceptable |
| At-least-once | No | Yes (possible) | **Yes — the practical default for almost every real queue** |
| Exactly-once | No | No (in theory) | Practically achieved via at-least-once + idempotency |

**Retry decision table**

| Situation | Action |
|---|---|
| Network timeout, 503, connection reset | Retry with exponential backoff + jitter |
| 429 with `Retry-After` header | Retry after exactly that duration |
| 400 Bad Request / malformed payload | Fail immediately — no retry — to DLQ |
| Max attempts reached | Move to DLQ, alert, stop retrying |
| Business rule failure ("insufficient stock") | Usually don't retry — route to a different workflow |

**Idempotency strategies, cheapest to most general**

| Strategy | Example | When it applies |
|---|---|---|
| Naturally idempotent operation | `SET status = 'active'`, `DELETE WHERE id = ?` | Whenever the operation is a "set," not an "adjust" |
| Unique constraint | `UNIQUE(order_id, event_type)` | Inserting an event/record exactly once per key |
| Upsert | `INSERT ... ON DUPLICATE KEY UPDATE` | Writing a row that may already exist |
| Explicit dedup table (idempotency/inbox key) | `processed_jobs` / `inbox` table checked in the same transaction | General-purpose, works for any side effect including external API calls |

**Pattern-to-problem map**

| Problem | Pattern |
|---|---|
| DB write and message publish must succeed/fail together | Outbox (15.6) |
| Same message delivered more than once | Idempotent consumer + Inbox (15.5, 15.6) |
| Need order per-entity but parallelism overall | Partitioning + partition key (15.7) |
| Producer faster than consumer, sustained | Backpressure: bounded queue, concurrency caps, load shedding, autoscaling (15.8) |
| A message keeps failing no matter what | Bounded retries → DLQ (15.4) |

---

# Phase 15 Exit Checklist

You are ready for Phase 16 when you can do **all** of the following without notes:

- [ ] Explain, with a real example, why a piece of work belongs in a background job rather than the request path — and one example of work that should stay synchronous.
- [ ] Draw the producer → queue → consumer/worker flow from memory, and explain why decoupling them matters.
- [ ] Explain visibility timeout and at-least-once delivery, and why "exactly-once" is practically unreachable end-to-end.
- [ ] Implement exponential backoff with jitter from scratch, and explain when *not* to retry.
- [ ] Explain why a dead-letter queue needs active monitoring, not just existence.
- [ ] Write an idempotent job handler using at least two different strategies (natural idempotency and an explicit dedup/idempotency key), and explain why the check-and-act must be atomic.
- [ ] Explain the dual-write problem in your own words and describe how the Outbox pattern solves it.
- [ ] Explain the Inbox pattern and how it relates to idempotent consumers.
- [ ] Explain partition keys, consumer groups, and why partition count caps real parallelism.
- [ ] Explain backpressure and name at least three different mechanisms to apply it at different layers.
- [ ] Complete the capstone: email worker, report worker (with classified retries and a DLQ), file processing worker (ordered per user, backpressure-aware), notification queue (outbox/inbox), and a working DLQ inspector.

**Then continue to → Phase 16: File Upload and Media Processing.**

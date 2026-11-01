# Phase 24 — Portfolio Projects

> These projects exist to prove — to yourself and to interviewers — that the concepts from Phases 0–23 work together in a real system, not just in isolated exercises. The roadmap's Final Mastery Checklist explicitly calls for **at least two production-style portfolio projects**; treat that as the minimum bar, not the target.

**How to use this phase:**
- Don't start a project until you've covered the phases it depends on (see "Depends on" per project below) — building it too early just produces a shallow version of the same project you'd otherwise build well.
- Build one at a time, to completion (including tests, Docker, and a README explaining tradeoffs) before starting the next. A half-finished project proves less than one finished project, even a small one.
- For every project, write a short **DECISIONS.md** documenting the tradeoffs you made and why (per the roadmap's Expert-Level Habit: "Document tradeoffs"). This is often what turns a portfolio project into a strong interview talking point.
- Recommended build order given the roadmap's phase sequence: **Project 1 → Project 2 → Project 4 → Project 3 → Project 5** (roughly increasing distributed-systems difficulty), but Project 1 and Project 2 can be reordered based on which interests you more — both depend only on Phases 1–9.

---

## Project 1: Production-Ready Authentication Service

**Depends on:** Phase 4 (Node.js), 5 (Express), 6–7 (MySQL/data access), 8 (Auth & Security), 9 (Architecture), 13 (Resilience), 19 (Observability), 20 (Testing).

### Goal & skills demonstrated
Prove you can build the single most common piece of backend infrastructure correctly and securely — the part almost every real system needs, and the part most tutorials get subtly wrong (token handling, password storage, rate limiting).

### Feature breakdown & suggested build order
1. **Registration** — email/password with proper hashing (bcrypt/argon2), input validation, duplicate-email handling.
2. **Login** — issue a short-lived access token (JWT) + a long-lived refresh token; store refresh tokens server-side (hashed) so they can be revoked, not purely stateless.
3. **Refresh token rotation** — each refresh call issues a new refresh token and invalidates the old one; detect reuse of an already-rotated token as a signal of token theft.
4. **Password reset** — time-limited, single-use reset token sent via a mock/real email service; invalidate all other sessions on successful reset.
5. **RBAC** — roles and permissions, middleware that checks permission before controller logic runs, not inside it.
6. **Audit logs** — record login attempts (success/failure), password changes, role changes — who, what, when, from where (IP/user-agent).
7. **Rate limiting** — per-IP and per-account limits on login/reset endpoints specifically (these are the endpoints attackers target for brute-force/credential-stuffing).
8. **Tests** — unit tests for token logic and password hashing; integration tests for the full register→login→refresh→logout flow; a specific test for refresh-token-reuse detection.
9. **Docker** — containerize the service with a multi-stage build; docker-compose for the service + MySQL for local development.
10. **API documentation** — OpenAPI/Swagger spec covering every endpoint, including error response shapes.

### Edge cases to handle
- Refresh token reuse after rotation (must revoke the entire token family, not just the reused token).
- Concurrent login attempts racing a rate limiter (must not have a bypassable check-then-increment race).
- Password reset token used twice, or after expiry.
- Login attempts against a non-existent email must return the same response/timing as a wrong password, to avoid user enumeration.

### Common mistakes
Storing JWTs with no server-side revocation path at all (fine for short-lived access tokens, dangerous for refresh tokens with no invalidation mechanism); storing plaintext or reversibly-encrypted passwords instead of a proper adaptive hash; logging passwords or full tokens in audit/error logs.

### What this proves in an interview
That you understand the difference between authentication that "works in a demo" and authentication that's actually safe to run — token rotation, revocation, timing-safe comparisons, and rate limiting are exactly what separates the two.

### Completion checklist
- [ ] Passwords hashed with bcrypt/argon2, never stored/logged in plaintext
- [ ] Refresh token rotation with reuse detection implemented and tested
- [ ] RBAC middleware enforced before controller logic, with a test for an unauthorized-role attempt
- [ ] Rate limiting on login and password-reset endpoints specifically
- [ ] Audit log entries for auth-sensitive actions
- [ ] Dockerized with docker-compose for local dev
- [ ] OpenAPI docs covering success and error responses

---

## Project 2: Multi-Tenant Learning Platform

**Depends on:** Phases 4–9, 12 (API Design), 14 (Caching), 15 (Background Jobs), 16 (File Upload), 18 (Multi-Tenant SaaS), 19–20.

### Goal & skills demonstrated
The most directly SaaS-shaped project in this list — organizations, role-based users, and tenant isolation, applied to a training/learner-management domain. This is a strong project to build if your production experience already leans toward multi-role, organization-scoped systems, since the domain (trainers, learners, batches) maps closely onto real training-platform work.

### Feature breakdown & suggested build order
1. **Organizations** — the tenant root entity; every other resource in the system is scoped to one.
2. **Trainers and Learners** — role-differentiated users under an organization, following the tenant-aware repository pattern from Phase 18 (tenant ID bound at the repository/service layer, never trusted from client input).
3. **Batches and Sessions** — batches belong to an organization; sessions belong to a batch; scheduling and enrollment logic.
4. **Permissions** — role-based access (trainer vs learner vs org admin) layered on top of tenant scoping — a request must pass *both* the tenant check and the role/permission check.
5. **Library** — shared learning resources scoped per organization, with per-role visibility (e.g. draft materials visible only to trainers).
6. **File uploads** — course materials/attachments, using the streaming-upload and storage patterns from Phase 16, with tenant-scoped access control on file retrieval (a signed/presigned URL should not be guessable or valid across organizations).
7. **Notifications** — e.g. a learner is enrolled in a session, a trainer publishes new material — built as background jobs (Phase 15), not synchronous blocking calls in the request path.
8. **Tenant isolation** — the Phase 18 discipline applied end-to-end: tenant context from verified JWT claims only, repository-layer scoping, and an explicit cross-tenant test suite.
9. **Audit history** — who enrolled whom, who changed a role, who deleted a batch — scoped per organization, retained per the retention rules you define.

### Edge cases to handle
- A user who is a trainer in one organization and a learner in another (if your design allows cross-organization membership at all — decide explicitly and document it).
- Bulk operations (e.g. bulk enrollment) that must remain tenant-scoped and transactionally safe — a bulk import job should not be able to write into a different organization than the one that initiated it, even under a badly-formed input file.
- File access URLs that must expire and must not be valid across organizations even if guessed.

### Common mistakes
Implementing tenant scoping only on `GET` endpoints and missing it on writes/deletes (Phase 18's most common failure mode); doing notification/email sending synchronously inside the request handler instead of via a background worker, which couples request latency to a third-party email provider's latency.

### What this proves in an interview
That you can design and defend a real multi-tenant data model, not just describe the concept — and that you take cross-tenant data leaks as seriously as any other class of security bug, with tests to back that up.

### Completion checklist
- [ ] Organization, trainer, learner, batch, and session modules built with tenant-aware repositories
- [ ] Permission checks layered on top of, not instead of, tenant checks
- [ ] File uploads streamed and access-controlled per organization
- [ ] Notifications implemented as background jobs, not synchronous calls
- [ ] Automated cross-tenant access test suite (per Phase 18 §18.6) covering every tenant-scoped endpoint
- [ ] Audit history captured for enrollment, role, and content changes

---

## Project 3: Reliable Order and Payment Workflow

**Depends on:** Phases 6–9, 13 (Resilience), 15 (Background Jobs), 17 (Distributed Systems), 19–20.

### Goal & skills demonstrated
This is the project that proves you understand **reliability under partial failure** — the hardest and most interview-relevant category of backend engineering, because payment/order systems cannot silently lose or duplicate work.

### Feature breakdown & suggested build order
1. **Order** — order creation, state machine (`CREATED` → `PAID` → `FULFILLED` / `CANCELLED`), with `RECORD_STATUS`-style explicit status tracking rather than inferring state from scattered boolean flags.
2. **Inventory** — stock reservation on order creation, release on cancellation/timeout; must handle concurrent orders competing for the same limited stock (row locking or optimistic concurrency, per Phase 6.5).
3. **Payment mock service** — a separate simulated service (even in-process, called over HTTP to itself, to genuinely exercise network-failure handling) that can be configured to randomly fail/time out — this is what makes the resilience patterns below actually testable.
4. **Idempotency** — every payment-initiating request carries an idempotency key; retried requests with the same key must not double-charge or double-create an order.
5. **Outbox pattern** — write the "payment succeeded" business change and the corresponding event/message in the same DB transaction, then publish asynchronously — avoiding the classic dual-write inconsistency between "update the DB" and "publish the event" as two separate, non-atomic operations.
6. **Retry with backoff** — for calls to the payment mock service, with jitter, and a cap on total retry attempts.
7. **Saga / compensation** — if inventory is reserved but payment fails, a compensating action releases the reservation; model this explicitly as a sequence of steps with defined compensations, not ad hoc error-handling.
8. **Reconciliation** — a periodic job that compares order/payment state against the payment service's own record of truth, catching any case where an event was missed or a webhook never arrived.

### Edge cases to handle
- The payment mock service times out (not fails outright) — the order is left in an ambiguous state until reconciliation resolves it; the system must not assume "no response" means "failed."
- Two retries of the same idempotency key arriving concurrently (a race between the original request and its own retry).
- A compensation step itself failing (what happens when releasing the inventory reservation fails? — this needs its own retry/alerting, not silent failure).

### Common mistakes
Treating "retry on failure" as sufficient without idempotency keys, causing duplicate orders/charges on retried requests; writing the DB update and the event publish as two separate non-transactional steps (the classic dual-write bug the outbox pattern exists to solve); skipping reconciliation because "the happy path retries should cover everything" — they don't, by design, for genuinely ambiguous outcomes like timeouts.

### What this proves in an interview
That you understand the difference between "retry until it works" and *correct* retry — idempotency, compensation, and reconciliation are what make retries safe rather than dangerous, which is exactly the distinction Phase 13's "never retry blindly" rule is about.

### Completion checklist
- [ ] Order state machine with explicit, exhaustive states
- [ ] Idempotency keys enforced on payment-initiating endpoints, tested against duplicate submission
- [ ] Outbox pattern implemented for the payment-succeeded event
- [ ] Retry with exponential backoff + jitter against the payment mock service
- [ ] Compensation logic for inventory release on payment failure
- [ ] Reconciliation job that detects and resolves ambiguous/timed-out payment states

---

## Project 4: Media Processing Platform

**Depends on:** Phase 4.4 (Streams), 15 (Background Jobs), 16 (File Upload & Media Processing), 19–20, 21 (DevOps/Cloud for object storage).

### Goal & skills demonstrated
Async processing pipelines with real background work, status tracking, and failure isolation — the pattern behind almost every "upload something, then something happens to it later" feature.

### Feature breakdown & suggested build order
1. **Upload** — streamed multipart upload (per Phase 4.4/16, never buffering the whole file in memory) with MIME/extension validation and size limits enforced server-side, not just client-side.
2. **Object storage** — upload directly to object storage (S3 or equivalent) via presigned URLs where possible, rather than routing large files through your API server unnecessarily.
3. **Background worker** — a queue-consuming worker that picks up "process this file" jobs, decoupled from the upload request itself.
4. **Image/video processing** — resizing, thumbnail generation, format conversion (even a subset, like image resize + thumbnail, is sufficient to demonstrate the pattern).
5. **Status tracking** — explicit `UPLOADED` → `PROCESSING` → `COMPLETED`/`FAILED` states, queryable by the client (polling endpoint or a notification once complete).
6. **Retry and DLQ** — failed processing jobs retry with backoff up to a limit, then land in a dead-letter queue for inspection rather than being silently dropped or retried forever.
7. **Access control** — processed media access-controlled per uploader/owner (and per Project 2's tenant model, if combined), with time-limited signed URLs rather than permanently public files.

### Edge cases to handle
- A file that passes upload validation but fails during processing (corrupt file, unsupported codec) — must land in `FAILED` with a reason, not hang in `PROCESSING` forever.
- A worker crashing mid-job — the job must become visible/retryable again (via a visibility timeout, per Phase 15), not silently lost.
- Very large files that could exhaust worker memory if processed naively — process in chunks/streams where the processing library supports it.

### Common mistakes
Processing uploaded files synchronously inside the upload request handler (ties request latency to processing time, and a slow/crashed processor takes the upload endpoint down with it); no dead-letter queue, so a permanently-failing file retries forever and consumes worker capacity indefinitely.

### What this proves in an interview
That you can design an async pipeline with observable state and bounded failure — status tracking and DLQs are what turn "background jobs" from a toy example into something operable in production.

### Completion checklist
- [ ] Streamed upload with server-side validation
- [ ] Files stored in object storage, not the app server's local disk
- [ ] Background worker decoupled from the upload request
- [ ] Explicit status states, queryable by the client
- [ ] Retry with backoff and a dead-letter queue for permanently-failing jobs
- [ ] Time-limited, access-controlled URLs for processed media

---

## Project 5: Real-Time Collaboration Platform

**Depends on:** Phase 4.3 (Networking), 14 (Caching/Redis), 17 (Distributed Systems), 19–20, 21 (Cloud for horizontal scaling).

### Goal & skills demonstrated
Real-time systems introduce a different failure mode than request/response APIs — connections that persist, state that must survive reconnection, and horizontal scaling that can't rely on a single in-memory process holding all connections.

### Feature breakdown & suggested build order
1. **WebSockets** — a basic real-time channel (e.g. live document editing, chat, or presence-only) using a library like `ws` or `socket.io`.
2. **Presence** — tracking who is currently connected/active, broadcast to other connected clients.
3. **Heartbeats** — ping/pong to detect dead connections that TCP alone won't surface promptly (a client that disappeared without a clean close).
4. **Reconnection** — client-side reconnect logic with backoff, and server-side session/state recovery so a brief disconnect doesn't lose the user's place.
5. **Message ordering** — sequence numbers or timestamps to detect and handle out-of-order delivery, particularly important if messages can be redelivered.
6. **Idempotency** — duplicate message delivery (from a reconnect-and-resend) must not be applied twice.
7. **Redis adapter concepts** — a single Node process holding all WebSocket connections doesn't scale horizontally; a Redis pub/sub (or equivalent) adapter lets multiple server instances broadcast to clients connected to *other* instances.
8. **Horizontal scaling** — run multiple instances behind a load balancer with sticky sessions or a connection-routing strategy, and confirm a message from a client on instance A reaches a client connected to instance B via the Redis adapter.

### Edge cases to handle
- A client reconnecting after a network blip mid-message — must not duplicate or lose that message.
- Two server instances both believing they're the "owner" of a presence update for the same user during a fast reconnect (a brief instance-switch race).
- A message broadcast during the exact moment a new client is joining (must the new client get a snapshot of current state plus the live stream from that point, not just the live stream, which would show it as behind — decide and document this explicitly).

### Common mistakes
Building and testing only against a single server instance, where the Redis adapter's cross-instance broadcast path is never actually exercised until it's needed in production; no heartbeat/liveness detection, leaving "ghost" connections that appear active but are actually dead, especially behind proxies/load balancers that can silently drop idle connections.

### What this proves in an interview
That you understand real-time systems don't get to assume a stable, single-process world — presence, ordering, and horizontal scaling via a shared broadcast layer are the concrete skills that distinguish a real-time feature that works in a demo from one that works with multiple users across multiple server instances.

### Completion checklist
- [ ] WebSocket connection with heartbeat-based dead-connection detection
- [ ] Presence broadcast to connected clients
- [ ] Reconnection with state/session recovery, tested against a simulated disconnect
- [ ] Message ordering and duplicate-delivery handling
- [ ] Redis (or equivalent) adapter enabling cross-instance broadcast
- [ ] Verified end-to-end with at least two running server instances, not just one

---

## Choosing and Sequencing Your Two-Minimum Projects

If you're prioritizing which two to build first (per the roadmap's minimum bar):

- **Project 1 (Auth Service)** is the strongest first choice — smallest scope, highest general applicability, and every other project can eventually depend on it for real auth instead of a stub.
- **Project 2 (Multi-Tenant Learning Platform)** is the strongest second choice if your target roles are SaaS-shaped, and lets you demonstrate the Phase 18 multi-tenant discipline concretely.
- **Project 3 (Order/Payment Workflow)** is the strongest choice if you're specifically targeting roles emphasizing distributed-systems reliability — it's the most conceptually demanding of the five and reads as the most senior-level project in an interview.

## Phase 24 Completion Checklist
- [ ] At least two projects built to completion (tests + Docker + docs), per the roadmap's minimum bar
- [ ] Each completed project has a DECISIONS.md documenting tradeoffs made
- [ ] Each project's README explains what it demonstrates and how to run it locally
- [ ] For at least one project, an automated test suite specifically targets a failure/edge case (not just the happy path)
- [ ] Can walk through any completed project's architecture and tradeoffs out loud, unscripted (this is what Phase 25's interview prep will draw on)

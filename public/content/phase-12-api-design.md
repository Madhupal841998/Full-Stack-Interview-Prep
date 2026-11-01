# Phase 12 — API Design

**Stack context:** Node.js, TypeScript, Express
**Prerequisite:** Phases 9 (architecture), 11 (HLD)
**Priority:** MUST KNOW — this entire phase

---

## What This Phase Is Really About

Phase 11 drew the boxes and arrows. Phase 12 is the contract written on each
arrow. An API is the part of your system other people's code depends on — and
unlike an internal function signature, you often cannot fix a bad API by asking
everyone to update their call site. Mistakes here are expensive in a way most
backend mistakes are not: they get baked into other teams' code, mobile apps in
app-store review, and years-old integrations you no longer control.

Everything in this phase serves one goal: **a caller should be able to predict
your API's behaviour without reading your source code.** Consistent resource
naming, consistent status codes, a consistent error shape, consistent pagination
— consistency is not a style preference here, it is what makes an API learnable
instead of memorised endpoint-by-endpoint.

The roadmap gives a flat list of eighteen topics. Below they're grouped into six
clusters that build on each other: **resource design → the HTTP contract →
input/output shape → reliability semantics → evolution → alternative protocols**.
The suggested error format from the source doc is adopted as the standard and
used consistently in every example.

---

## 12.1 REST Principles and Resource Naming

### 1. Proper definition

REST (Representational State Transfer) is an architectural style in which the API
exposes **resources** (nouns), identified by URLs, manipulated through a uniform
set of HTTP methods, where each request contains all the information needed to
process it (statelessness), and responses declare their cacheability.

### 2. Simple meaning

Stop designing APIs as remote function calls (`/getUserOrders`, `/cancelOrder`).
Design them as **things** (`/users/{id}/orders`, `/orders/{id}`) and use the verb
already built into HTTP (`GET`, `DELETE`) to say what you're doing to that thing.

### 3. Why it is needed

- **Predictability.** Once a caller knows `/orders` and `/orders/{id}`, they can
  guess `/orders/{id}/items` without documentation.
- **Cacheability.** GET on a resource URL is cacheable by browsers, CDNs and
  proxies for free — an RPC-style `POST /getOrder` is never cached by anything.
- **Tooling.** HTTP methods and status codes are understood by every client
  library, proxy, gateway and monitoring tool without custom logic.
- **Statelessness enables horizontal scaling** — any instance can serve any
  request, directly supporting Phase 11's stateless-app-server principle.

### 4. How it works internally — the six REST constraints

1. **Client-server** — separation of concerns; either evolves independently.
2. **Statelessness** — every request carries full context (auth token, needed
   params). No server-side session tied to a connection.
3. **Cacheability** — responses declare, via headers, whether and how long they
   can be cached.
4. **Uniform interface** — the part this section focuses on: resources named by
   URL, manipulated by standard methods, self-descriptive messages, and
   HATEOAS (hypermedia links in responses — the most-cited, least-implemented
   constraint; few production APIs do this fully, and it's fine to say so).
5. **Layered system** — the client cannot tell if it's talking to the origin
   server or a proxy/gateway in front of it.
6. **Code on demand** (optional, rarely used server-side for backend APIs).

Most APIs called "REST" in industry implement 4 of these strictly and treat
HATEOAS as optional — that is a legitimate, common choice, not a violation to be
embarrassed about. Know the full constraint set so you can say precisely which
ones your design satisfies.

### 5. Resource naming rules

```
✅ /orders                     ❌ /getOrders
✅ /orders/{id}                ❌ /order?id=123
✅ /orders/{id}/items          ❌ /getOrderItems?orderId=123
✅ /users/{id}/orders          ❌ /getUserOrdersByUserId
✅ POST /orders/{id}/cancel    ❌ /cancelOrder      (action as sub-resource — see below)
```

Rules, in order of importance:

- **Nouns, not verbs.** The verb is the HTTP method.
- **Plural for collections.** `/orders`, not `/order` — consistency matters more
  than the specific choice.
- **Lowercase, hyphen-separated.** `/order-items`, not `/orderItems` or
  `/Order_Items` — URLs are case-sensitive in practice, and hyphens are the
  documented convention (RFC 3986 treats `-` as a safe path character).
- **Nesting reflects ownership, and stops at two levels.**
  `/users/{id}/orders` is fine; `/users/{id}/orders/{id}/items/{id}/reviews` is
  not — flatten to `/order-items/{id}/reviews` and let the client already hold
  the parent ID from a previous call.
- **No trailing slash**, and pick one convention and enforce it (a redirect or a
  404 for the other form — never silently serve both as if identical).
- **Version in the URL or header** — covered in 12.5.

**Actions that don't fit CRUD.** Not everything is a clean noun — "cancel an
order", "publish a post". Three honest options, in order of preference:

1. **A sub-resource POST**: `POST /orders/{id}/cancellation` (creates a
   cancellation resource) or `POST /orders/{id}/cancel` (a pragmatic, very
   common exception to "nouns only" — accepted in virtually every real API).
2. **A state field via PATCH**: `PATCH /orders/{id}` with `{ "status": "cancelled" }`
   — clean when the action *is* a state transition and nothing more.
3. Avoid inventing a generic `/actions` endpoint that takes an action name as a
   body parameter — that's RPC wearing a REST costume and loses all the method
   semantics you were trying to gain.

### 6. Small example

```
GET    /orders                    list orders (paginated)
GET    /orders/{id}               get one order
POST   /orders                    create an order
PATCH  /orders/{id}               partially update an order
DELETE /orders/{id}               delete/cancel an order
GET    /orders/{id}/items         list items on an order (nested collection)
POST   /orders/{id}/items         add an item to an order
DELETE /orders/{id}/items/{itemId} remove one item
POST   /orders/{id}/cancel        action that doesn't map to CRUD cleanly
```

### 7. Real backend usage

- A public payments API where `/charges`, `/refunds`, `/customers` are
  independently guessable once a developer has seen one.
- An internal service mesh where consistent naming lets a gateway apply routing
  rules by pattern (`/v1/*/{id}`) rather than per-endpoint configuration.

### 8. Edge cases

- **A resource with no natural plural** (`/inventory`, `/settings`) — treat as a
  singleton resource; `GET /settings` returns the one object, `PATCH /settings`
  updates it, no `{id}`.
- **Composite/many-to-many resources** — `/students/{id}/courses/{courseId}`
  representing enrolment is legitimate when the relationship itself has
  properties (enrolled-at date, grade).
- **Bulk operations** don't map cleanly to REST verbs. `POST /orders/bulk-delete`
  with an ID list in the body is a pragmatic, widely-used exception — document it
  as one rather than pretending it's pure REST.

### 9. Common mistakes

| Mistake | Fix |
|---|---|
| Verbs in URLs (`/getUser`, `/createOrder`) | Nouns + HTTP method |
| Inconsistent singular/plural across endpoints | Pick plural, apply everywhere |
| Deep nesting (4+ levels) | Flatten after two levels |
| Mixing an RPC style with a REST style in one API | Pick one; document exceptions explicitly |
| Exposing database column names/IDs directly | Design the resource shape independently of the schema |

### 10. Interview answer

> I design resources as nouns and let HTTP methods carry the verb — `POST /orders`
> to create, `GET /orders/{id}` to read. I nest to reflect ownership but stop at
> two levels and flatten beyond that. For actions that don't map to CRUD, like
> cancelling an order, I use a sub-resource POST — `POST /orders/{id}/cancel` — 
> rather than inventing a generic RPC-style action endpoint, because that loses
> the method semantics that make REST cacheable and predictable in the first
> place. I don't fully implement HATEOAS — few production APIs do — but I know
> it's part of the uniform interface constraint and can explain the trade-off.

### 11. Practice problems

1. Design resource URLs for a library system: books, copies, members, loans,
   reservations, fines. Get the nesting depth right.
2. Take an RPC-named API (`/getUserById`, `/updateUserEmail`, `/deleteUser`) and
   redesign it as REST resources.
3. Design the "publish a blog post" and "like a post" actions — decide between
   sub-resource POST and PATCH for each, and justify the choice.

### 12. Production considerations

- **Document the naming convention** in a one-page style guide; enforce it in
  API review, because it drifts fast across a team.
- **Never expose internal IDs that leak information** (sequential integers
  revealing order volume) on public APIs — use UUIDs or opaque tokens.
- **Contract-first**: write the OpenAPI spec (12.6) before implementation on
  anything public-facing, so naming gets reviewed before it's shipped and hard
  to change.

---

## 12.2 HTTP Methods and Status Codes

### 1. Proper definition

HTTP methods declare the semantics of a request against a resource. Status codes
declare the outcome. Two properties, defined per method, govern how clients and
intermediaries are allowed to treat a request: **safety** (does not modify state)
and **idempotency** (calling it once has the same effect as calling it N times).

### 2. Simple meaning

If you get these semantics right, browsers, proxies, retry libraries, and load
balancers all behave correctly automatically. If you get them wrong — say, a
`GET` that deletes something — you get prefetchers silently destroying data, or
a client's automatic retry duplicating a payment.

### 3. Why it is needed

- **Correct client retry behaviour.** An HTTP client library knows it's safe to
  automatically retry a `GET` or a `PUT`, but not a `POST` — this is built into
  browsers and HTTP libraries and only works if you follow the contract.
- **Correct caching.** Only `GET` (and sometimes `HEAD`) is cached by default.
- **Correct proxy/gateway behaviour.** Idempotent methods can be safely retried by
  infrastructure without your code's involvement.

### 4. How it works internally

| Method | Safe | Idempotent | Purpose | Body |
|---|---|---|---|---|
| `GET` | Yes | Yes | Retrieve a resource | No |
| `HEAD` | Yes | Yes | Like GET, headers only | No |
| `POST` | No | **No** | Create, or a non-idempotent action | Yes |
| `PUT` | No | Yes | Replace a resource entirely | Yes |
| `PATCH` | No | No* | Partially update a resource | Yes |
| `DELETE` | No | Yes | Remove a resource | Usually no |
| `OPTIONS` | Yes | Yes | Discover allowed methods (CORS preflight) | No |

*`PATCH` is not idempotent by the spec, but is **usually made idempotent in
practice** by describing the desired end state (`{"status": "cancelled"}`)
rather than a relative operation (`{"increment": "clicks"}`). Design your PATCH
bodies to be idempotent whenever possible — it is one of the cheapest reliability
wins available.

**PUT vs PATCH, precisely.** `PUT` replaces the entire resource — omitted fields
are meant to be cleared/reset to default. `PATCH` changes only the fields
present. Using `PUT` for a partial update is a common and harmful mistake: a
client that sends `PUT` with three of ten fields has just nulled out the other
seven.

**Why `POST` is never idempotent by spec**, even though your implementation
often makes it behave that way: two identical `POST /orders` calls are permitted
to create two orders. If you want a `POST` to be safely retryable, you must add
that guarantee explicitly via an idempotency key (12.4) — HTTP gives you no
default protection here.

### 5. Status codes — the ones to actually use

```
2xx Success
  200 OK                    — successful GET/PUT/PATCH, or POST that doesn't create
  201 Created                — successful POST that created a resource (include Location header)
  202 Accepted                — request accepted for async processing, not yet complete
  204 No Content              — successful DELETE, or PUT/PATCH with nothing to return

3xx Redirection
  301 Moved Permanently       — resource permanently at a new URL
  304 Not Modified            — conditional GET, client's cached copy is still valid

4xx Client Error
  400 Bad Request             — malformed request (bad JSON, wrong types)
  401 Unauthorized            — missing or invalid authentication
  403 Forbidden               — authenticated, but not allowed to do this
  404 Not Found                — resource doesn't exist
  405 Method Not Allowed      — e.g. DELETE on a collection that doesn't support it
  409 Conflict                — state conflict (duplicate, version mismatch, business rule)
  410 Gone                    — resource existed, now permanently removed
  422 Unprocessable Entity    — well-formed request, semantically invalid (failed validation)
  429 Too Many Requests       — rate limited (include Retry-After)

5xx Server Error
  500 Internal Server Error   — unexpected failure; never leak stack traces
  502 Bad Gateway             — upstream returned an invalid response
  503 Service Unavailable     — temporarily overloaded/down (include Retry-After)
  504 Gateway Timeout         — upstream didn't respond in time
```

**The 400 vs 422 distinction**, which trips people up: `400` means the request
itself is broken — invalid JSON, wrong content type. `422` means the request is
well-formed JSON but fails business/validation rules — `"email": "not-an-email"`.
Many APIs collapse this distinction and use `400` for both; that's an acceptable
simplification as long as it's applied consistently, but know the precise
meaning so you can defend the choice.

**The 401 vs 403 distinction**: `401` means "I don't know who you are" (no
token, expired token) — should trigger a client to re-authenticate. `403` means
"I know who you are, and you're not allowed" — re-authenticating won't help.
Mixing these up breaks client retry/redirect logic.

### 6. Small example

```ts
router.get('/orders/:id', async (req, res) => {
  const order = await orderService.findById(req.params.id);
  if (!order) return res.status(404).json(errorBody('ORDER_NOT_FOUND', 'Order not found', req.id));
  res.status(200).json({ success: true, data: order });
});

router.post('/orders', async (req, res) => {
  const order = await orderService.create(req.body);
  res.status(201)
     .location(`/orders/${order.id}`)
     .json({ success: true, data: order });
});

router.delete('/orders/:id', async (req, res) => {
  const existed = await orderService.delete(req.params.id);
  if (!existed) return res.status(404).json(errorBody('ORDER_NOT_FOUND', 'Order not found', req.id));
  res.status(204).send();
});
```

### 7. Real backend usage

- Load balancers retry `GET`/`PUT`/`DELETE` automatically on connection failure,
  never `POST` — correct method semantics is what makes this safe.
- `202 Accepted` for a video-transcoding trigger, with a `Location` header
  pointing to a status resource the client polls.
- `304 Not Modified` saving bandwidth on a mobile client re-fetching an
  unchanged product catalogue.

### 8. Edge cases

- **`DELETE` on an already-deleted resource.** Returning `404` is defensible
  (it's gone) but many APIs return `204` to make the operation itself idempotent
  from the client's perspective — "ensure this doesn't exist" succeeded either
  way. Pick one and document it; both are legitimate.
- **Validation errors on nested fields** — return all of them at once (`422`
  with a `details` array), never one-at-a-time forcing round trips.
- **A `POST` that doesn't create anything** (e.g., `POST /orders/{id}/cancel`) —
  use `200` with the updated resource, not `201` (nothing was created).
- **Rate limiting a `GET`** — still `429`, safety doesn't exempt a resource from
  limits.

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| `GET` that mutates state | Breaks prefetching, caching, crawler safety | Never mutate on GET |
| `200` for everything, errors included | Clients can't branch on status alone | Use the real status code |
| `500` for validation failures | Signals a server bug when it's a client error | `400`/`422` |
| Leaking stack traces in `500` bodies | Information disclosure | Generic message + logged detail server-side |
| `PUT` for partial updates | Silently nulls omitted fields | `PATCH` |
| Missing `Location` header on `201` | Client has to guess the new URL | Always include it |
| Using `403` when the real issue is missing auth | Breaks re-auth flows | `401` for "who are you", `403` for "not allowed" |

### 10. Interview answer

> I choose HTTP methods by their safety and idempotency semantics, not just
> convention — GET and DELETE are idempotent so infrastructure can retry them
> safely, POST is not, which is why I add an explicit idempotency key when a POST
> needs to be safely retryable. For status codes, I distinguish 401 from 403
> because they mean different things to a client's retry logic — 401 says
> re-authenticate, 403 says don't bother — and I use 422 for semantic validation
> failures versus 400 for malformed requests. Getting these right means a lot of
> reliability behaviour — caching, retries, safe automatic retries by load
> balancers — comes for free from infrastructure that already understands HTTP.

### 11. Practice problems

1. For each endpoint in a small API you've built, classify it by safety and
   idempotency and check your implementation actually matches.
2. Write middleware that maps a caught `DomainError` (Phase 9/10) to the correct
   HTTP status code by its error code.
3. Design the status codes for a file-upload endpoint that can be slow: what do
   you return immediately, and what does the client poll?

### 12. Production considerations

- **Never let stack traces reach the client** in any error response — log them
  server-side with the request ID, return a generic message to the caller.
- **Monitor status code distribution** per endpoint — a spike in `500`s or `429`s
  is often the earliest signal of an incident.
- **Load balancers and CDNs make retry decisions from your status codes** — an
  incorrect `500` where `503` was meant can prevent correct failover behaviour.

---

## 12.3 Request Validation, Pagination, Filtering, Sorting

### 1. Proper definition

Request validation rejects malformed or semantically invalid input before it
reaches business logic. Pagination, filtering and sorting are the standard
mechanisms for a client to retrieve a bounded, relevant, ordered subset of a
collection resource.

### 2. Simple meaning

Never trust the request body. Never return an entire table. Let the client ask
for what it needs, shaped how it needs it.

### 3. Why it is needed

- **Validation is your first line of defence** against bad data reaching the
  database and against a large class of security issues (injection, oversized
  payloads, type confusion).
- **Unbounded collection endpoints are an outage waiting to happen** — a table
  that's fine at 10,000 rows returns a 2GB response at 10 million.
- **Consistent query parameters** are what let a client library build generic
  list-fetching code instead of bespoke logic per endpoint.

### 4. How it works internally

**Validation** — validate at the edge (the controller, Phase 9.1), with a schema
library rather than hand-written `if` chains, so the same rule can't drift
between endpoints:

```ts
import { z } from 'zod';

const createOrderSchema = z.object({
  items: z.array(z.object({
    sku: z.string().min(1).max(64),
    quantity: z.number().int().positive().max(1000),
  })).min(1).max(100),
  shippingAddressId: z.string().uuid(),
  couponCode: z.string().max(32).optional(),
});

function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: result.error.issues.map(i => ({
            field: i.path.join('.'),
            reason: i.message,
          })),
          requestId: req.id,
        },
      });
    }
    req.body = result.data;
    next();
  };
}
```

This is the error format from the source roadmap, used as the standard for this
entire phase — see 12.6 for the full spec.

**Pagination** — three strategies, each with a real trade-off:

- **Offset-based** (`?page=3&limit=20` or `?offset=40&limit=20`) — simple, lets a
  client jump to page N, but **degrades on large offsets** (the database still
  scans and discards all preceding rows) and **shifts under concurrent writes**
  (a row inserted on page 1 pushes everything else down, causing skipped or
  duplicated items on page 2).

  ```ts
  router.get('/orders', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const [items, total] = await Promise.all([
      db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
      db.query('SELECT COUNT(*) as count FROM orders'),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total: total[0].count, totalPages: Math.ceil(total[0].count / limit) },
    });
  });
  ```

- **Cursor-based** (`?cursor=eyJpZCI6MTIzfQ&limit=20`) — the cursor encodes the
  position of the last item seen (typically its sort key, base64-encoded), and
  the next page queries `WHERE created_at < :cursor ORDER BY created_at DESC
  LIMIT :limit`. **Stable under concurrent writes**, efficient at any depth
  (always an indexed range scan, never a scan-and-discard), but **cannot jump to
  an arbitrary page** — only forward/backward from where you are. This is the
  correct default for any feed, timeline, or infinite-scroll UI, and for any
  collection expected to grow large.

  ```ts
  router.get('/orders', async (req, res) => {
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const cursor = req.query.cursor
      ? JSON.parse(Buffer.from(String(req.query.cursor), 'base64').toString())
      : null;

    const items = await db.query(
      `SELECT * FROM orders
       WHERE (created_at, id) < (?, ?) OR ? IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [cursor?.createdAt ?? null, cursor?.id ?? null, cursor, limit + 1],
    );

    const hasMore = items.length > limit;
    const page = items.slice(0, limit);
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ createdAt: page.at(-1).createdAt, id: page.at(-1).id })).toString('base64')
      : null;

    res.json({ success: true, data: page, pagination: { nextCursor, hasMore } });
  });
  ```

  Note the compound `(created_at, id)` tuple comparison — a sort key alone isn't
  unique (two orders can share a timestamp), so the cursor needs a tiebreaker or
  rows get silently skipped or duplicated at page boundaries.

- **Keyset pagination** is essentially the cursor approach exposed with raw
  column values instead of an opaque token — same properties, less encapsulation.

**Filtering** — `?status=paid&createdAfter=2026-01-01&minTotal=100`. Validate
every filter field against an allow-list (never build a query by interpolating
arbitrary client-supplied field names — that's SQL injection via the query
builder) and index the columns you allow filtering on, or a filter becomes a
full table scan.

**Sorting** — `?sort=-createdAt,total` (a leading `-` for descending is a common,
readable convention). Same rule: validate against an allow-list of sortable
columns. Never pass a client-supplied string directly into an `ORDER BY` clause.

### 5–6. Syntax and combined example

```
GET /orders?status=paid&createdAfter=2026-01-01&sort=-createdAt&cursor=eyJ...&limit=20
```

```ts
const ALLOWED_FILTERS = ['status', 'createdAfter', 'createdBefore', 'minTotal'] as const;
const ALLOWED_SORT_FIELDS = ['createdAt', 'total'] as const;

function parseSort(raw: string | undefined): { field: string; dir: 'ASC' | 'DESC' }[] {
  if (!raw) return [{ field: 'createdAt', dir: 'DESC' }];
  return raw.split(',').map(token => {
    const dir = token.startsWith('-') ? 'DESC' : 'ASC';
    const field = token.replace(/^-/, '');
    if (!ALLOWED_SORT_FIELDS.includes(field as any)) {
      throw new DomainError('INVALID_SORT_FIELD', field, 422);
    }
    return { field, dir };
  });
}
```

### 7. Real backend usage

- Cursor pagination on a social feed, order history, notification list — anything
  unbounded and append-heavy.
- Offset pagination on an admin dashboard's "jump to page 12" table — a place
  where the trade-off (jump-to-page over consistency) is the right one, and the
  table is bounded enough that the performance cost doesn't matter.
- A schema-validated request body rejecting a malformed payload before a single
  database call is made — this is also a resource-exhaustion defence.

### 8. Edge cases

- **Empty results** — return `200` with an empty array and correct pagination
  metadata, never `404` for "the collection has no matching items right now".
- **Cursor tampering** — a client-modified cursor must fail safely (return `400`
  or restart from the beginning), never crash the query or leak other users'
  data. Consider signing the cursor (HMAC) if it must not be user-modifiable.
- **`limit` abuse** — always cap the maximum (`Math.min(100, requested)`),
  regardless of what the client asks for.
- **Filtering on a field with no index** — silently slow at first, then a
  production incident under load. Enforce the allow-list to match your indexes.

### 9. Common mistakes

| Mistake | Fix |
|---|---|
| No max on `limit` | Client requests 1,000,000, server falls over | Hard cap, e.g. 100 |
| Validating in the service instead of the edge | Invalid data can reach multiple call paths | Validate in middleware, at the controller |
| Offset pagination on a fast-growing feed | Skipped/duplicate items under concurrent writes | Cursor-based |
| Building `ORDER BY`/`WHERE` from raw client strings | SQL injection risk | Allow-list every field |
| `COUNT(*)` on every paginated request over a huge table | Expensive on every single call | Cache the count, or omit `totalPages` for cursor pagination |
| Returning `404` for an empty filtered list | Confuses "no results" with "resource missing" | `200` with `[]` |

### 10. Interview answer

> I validate every request body against a schema at the edge, before it reaches
> business logic, and return 422 with a field-level details array rather than
> failing on the first bad field. For collections, I default to cursor-based
> pagination for anything that grows large or is written to concurrently — feeds,
> order history — because offset pagination both degrades at depth and produces
> skipped or duplicate items when rows are inserted between page requests. I use
> offset pagination only for bounded, low-write collections like admin tables
> where jump-to-page matters more than that consistency guarantee. For filtering
> and sorting I always validate against an allow-list of fields — never build a
> query from a raw client-supplied field name.

### 11. Practice problems

1. Implement both offset and cursor pagination for the same endpoint; write a
   test that inserts a row mid-pagination and shows offset pagination skipping
   or duplicating an item while cursor pagination does not.
2. Add filtering and sorting to a list endpoint with a strict allow-list, and
   write a test asserting an unknown filter field returns 422 rather than being
   silently ignored or causing an error.
3. Add a schema-validation middleware reusable across all POST/PATCH endpoints
   and measure how many `if` checks it replaces.

### 12. Production considerations

- **Index every column you allow filtering or sorting on** — an allow-list with no
  matching index is a slow-query time bomb.
- **Cap payload size** at the framework/gateway level (e.g., Express's
  `express.json({ limit: '1mb' })`) in addition to field-level schema validation
  — a 500 MB JSON body is a resource-exhaustion attack, not a validation error.
- **Log validation failure rates per endpoint** — a spike often means a client
  deployed a breaking change, not that users are entering bad data.

---

## 12.4 Reliability Semantics — Idempotency Keys, ETags, Conditional Requests, Correlation IDs

These four mechanisms answer the same underlying question from different angles:
**how does a client safely retry, and how does the server avoid doing
unnecessary or duplicate work?**

---

### Idempotency Keys

**1. Proper definition.** A client-generated unique token, sent with a
non-idempotent request (typically `POST`), that the server uses to guarantee the
operation's side effects occur at most once, regardless of how many times the
request is retried.

**2. Simple meaning.** The network is unreliable. A client sends `POST
/charges`, the charge succeeds, but the response is lost to a timeout. The
client, correctly following retry logic, sends it again. Without an idempotency
key, the customer is charged twice.

**3. Why it is needed.** This is *the* answer to Phase 11's payment-system
follow-up question ("network drops after you charge but before the response").
Any `POST` with a real-world side effect that a client might retry needs this.

**4. How it works.**

```ts
router.post('/charges', async (req, res) => {
  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return res.status(400).json(errorBody('MISSING_IDEMPOTENCY_KEY', 'Idempotency-Key header is required', req.id));
  }

  const existing = await idempotencyStore.get(idempotencyKey);
  if (existing) {
    // Same key seen before — return the stored result, do not re-execute
    return res.status(existing.statusCode).json(existing.body);
  }

  const lock = await idempotencyStore.acquireLock(idempotencyKey, 30_000);
  if (!lock) {
    // Concurrent request with the same key is still in flight
    return res.status(409).json(errorBody('REQUEST_IN_PROGRESS', 'A request with this key is already processing', req.id));
  }

  try {
    const charge = await chargeService.create(req.body);
    const responseBody = { success: true, data: charge };
    await idempotencyStore.save(idempotencyKey, 201, responseBody, { ttlHours: 24 });
    res.status(201).json(responseBody);
  } finally {
    await idempotencyStore.releaseLock(idempotencyKey);
  }
});
```

Three details that separate a real implementation from a broken one: **the store
must persist the response, not just a "seen" flag**, so a retry gets the
identical body rather than re-executing; **a lock or a unique-constraint insert
prevents two concurrent requests with the same key from both proceeding**
(otherwise the key protects against sequential retries but not against a
double-click); and **the key should be scoped per-client/per-endpoint** (e.g. a
DB row keyed on `(idempotency_key, endpoint)`, not global) so two different
clients can't collide.

**5–6. Where the key comes from.** The client generates it (a UUID), not the
server — the whole point is to survive the response never arriving, so the
server can't be the one issuing it.

**7. Real backend usage.** Payment charges, order creation, any webhook consumer
(Phase 11's "every consumer must be idempotent"), money transfers.

**8. Edge cases.** Key reused with a **different request body** — this is either
a client bug or an attack; reject with `422`/`409` rather than silently
returning the old result for different input. Key TTL — store for at least as
long as a client's plausible retry window (24 hours is a common default), then
expire to bound storage.

**9. Common mistakes.**

| Mistake | Fix |
|---|---|
| Storing only "processed: true" instead of the full response | Retry can't return the original result |
| No lock/unique constraint for concurrent duplicate requests | Two simultaneous retries both execute |
| Server-generated idempotency key | Defeats the purpose — client needs to control it across retries |
| No TTL | Unbounded storage growth |
| Applying it to naturally idempotent endpoints (GET, PUT) | Unnecessary — they're already safe to retry |

**10. Interview answer.**
> For any POST with a real side effect that a client might retry — payments
> above all — I require an `Idempotency-Key` header, generated client-side. The
> server stores the key with the full response, not just a flag, so a retry
> returns the identical result instead of re-executing. I also lock on the key
> during processing so two concurrent requests with the same key can't both go
> through — sequential retry protection alone isn't enough.

---

### ETags and Conditional Requests

**1. Proper definition.** An ETag is an opaque identifier for a specific version
of a resource. Conditional request headers (`If-Match`, `If-None-Match`,
`If-Modified-Since`) let a client tell the server "only do this if the resource
is/isn't in the state I expect."

**2. Simple meaning.** Two uses: **save bandwidth** ("only send me the full
resource if it changed since I last fetched it") and **prevent lost updates**
("only save my edit if nobody else changed this since I loaded it").

**3–4. How it works.**

*Bandwidth saving (`GET` + `If-None-Match`):*

```ts
router.get('/products/:id', async (req, res) => {
  const product = await productService.findById(req.params.id);
  const etag = `"${hashOf(product)}"`;   // or a stored version column

  if (req.header('If-None-Match') === etag) {
    return res.status(304).end();        // client's cached copy is still valid
  }
  res.set('ETag', etag).status(200).json({ success: true, data: product });
});
```

*Preventing lost updates (`PATCH` + `If-Match`) — optimistic concurrency
control:*

```ts
router.patch('/products/:id', async (req, res) => {
  const ifMatch = req.header('If-Match');
  const current = await productService.findById(req.params.id);
  const currentEtag = `"${hashOf(current)}"`;

  if (ifMatch && ifMatch !== currentEtag) {
    return res.status(412).json(errorBody('PRECONDITION_FAILED', 'Resource was modified by someone else', req.id));
  }

  const updated = await productService.update(req.params.id, req.body);
  res.set('ETag', `"${hashOf(updated)}"`).status(200).json({ success: true, data: updated });
});
```

This is the HTTP-native version of **optimistic locking**: instead of a
database-level lock held for the duration of an edit (which doesn't work across
a "user opens a form, edits for 10 minutes, submits" flow anyway), the version
check happens at write time, and a conflict returns `412 Precondition Failed`
rather than silently overwriting someone else's change.

**7. Real backend usage.** CDN and browser caching of API responses; collaborative
editing conflict detection; a mobile app avoiding re-downloading an unchanged
product catalogue.

**8. Edge cases.** A weak ETag (`W/"..."` — semantically equivalent, not
byte-identical) is appropriate when your comparison is "same data" rather than
"byte-identical response" (e.g., ignoring a `lastAccessedAt` timestamp that
changes on every read). Generating the ETag is cheapest from a `version` integer
column or `updated_at` timestamp already in the row — hashing the full response
body works but costs CPU on every request.

**9. Common mistakes.**

| Mistake | Fix |
|---|---|
| No `If-Match` check on PATCH/PUT of shared resources | Lost-update bugs — last write silently wins |
| Hashing the entire response body when a version column already exists | Wasted CPU |
| Treating 304 as an error case in client code | It's a success — "your cache is valid" |

**10. Interview answer.**
> ETags serve two purposes for me: conditional GET with If-None-Match to avoid
> re-sending unchanged data, and If-Match on writes as optimistic concurrency
> control — the update only applies if the resource's version matches what the
> client last read, otherwise it's a 412 rather than a silent overwrite. That
> second use is the one that actually prevents data-loss bugs in
> multi-client-edits-same-resource scenarios.

---

### Correlation IDs

**1. Proper definition.** A unique identifier generated at the edge of a system
(or propagated from an upstream caller) and carried through every log line,
downstream call, and queue message related to processing one request, so the
entire path of a single request can be reconstructed after the fact.

**2. Simple meaning.** When a request touches five services and fails somewhere,
you need one ID to `grep` across all five services' logs and see the whole
story — otherwise you're correlating by timestamp and hoping.

**3–4. How it works.**

```ts
app.use((req, res, next) => {
  req.id = req.header('X-Request-Id') || randomUUID();  // reuse upstream ID if present
  res.set('X-Request-Id', req.id);
  next();
});

// Propagate to every downstream call
async function callDownstream(req: Request, url: string) {
  return fetch(url, { headers: { 'X-Request-Id': req.id } });
}

// Propagate into every log line
logger.info('order created', { requestId: req.id, orderId: order.id });

// Propagate into every queue message
await queue.publish({ requestId: req.id, type: 'order.placed', payload: { ... } });
```

This is also exactly the `requestId` field in the error format specified at the
top of this phase — it is not decorative, it is the join key across your entire
observability stack (Phase 19).

**7. Real backend usage.** Every field in the error format example from this
phase's source doc; distributed tracing (Phase 11's OpenTelemetry mention) uses
the same concept, extended with span IDs per hop.

**9. Common mistakes.**

| Mistake | Fix |
|---|---|
| Generating a new ID at every hop instead of propagating one | Can't correlate across services |
| Not returning it in error responses | Support/debugging has nothing to search by |
| Trusting a client-supplied ID for anything security-sensitive | Fine for correlation, never for authorization |

**10. Interview answer.**
> Every request gets a correlation ID at the edge — reused from an
> `X-Request-Id` header if the caller supplied one, generated otherwise — and I
> propagate it through every log line, every downstream HTTP call, and every
> queue message tied to that request. It's also always in the error response
> body, so when a user reports a problem, support can hand me one ID and I can
> reconstruct the entire request path across services.

---

## 12.5 Error Response Standards and API Versioning

### 1. Proper definition — the standard error format

Every error response across an API should share one JSON shape, so client code
can handle errors generically instead of per-endpoint. Adopting the roadmap's
specified format as the standard for this phase:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [
      { "field": "email", "reason": "Invalid email format" }
    ],
    "requestId": "req-123"
  }
}
```

And its success-case mirror, used consistently throughout this document:

```json
{ "success": true, "data": { }, "pagination": { } }
```

### 2–3. Why this shape

- **`success`** lets a client branch without inspecting the status code first
  (useful in environments where the HTTP layer is abstracted away).
- **`error.code`** is a **stable, machine-readable string** — this is what client
  code should switch on, never `error.message`, which is for humans and can
  change wording without breaking anyone.
- **`error.details`** carries field-level validation errors as a structured
  array (12.3), not baked into the message string.
- **`error.requestId`** is the correlation ID (12.4) — always present, always
  the first thing to ask a user for when debugging their report.

### 4. How it works — centralised error handling

```ts
// domain error, thrown anywhere in business logic (Phase 9/10)
class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: { field: string; reason: string }[],
  ) {
    super(message);
  }
}

// ONE error-handling middleware, registered last
function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof DomainError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details, requestId: req.id },
    });
  }

  logger.error('unhandled error', { requestId: req.id, err });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId: req.id },
  });
}
```

This is Phase 9's controller/service boundary again: business code throws a
`DomainError` with a stable code, and exactly one place translates it to HTTP —
never scattered `res.status(...)` calls with ad-hoc error shapes across
controllers.

### API Versioning

**1. Proper definition.** A strategy for evolving an API's contract over time
without breaking existing clients who haven't migrated yet.

**2–3. Why it is needed.** Once an API is public, you cannot assume every client
upgrades in lockstep with your deploys — mobile apps especially can lag by
months or years (app-store review, users who don't update).

**4. The strategies:**

| Approach | Example | Trade-off |
|---|---|---|
| **URL path** | `/v1/orders`, `/v2/orders` | Most visible, cache-friendly, easy to route at the gateway; "leaks" version into every URL |
| **Header** | `Accept: application/vnd.myapi.v2+json` | Cleaner URLs; harder to test in a browser, easy to forget |
| **Query param** | `/orders?version=2` | Simple; easy to omit accidentally, less cacheable |

**Path versioning is the most common and pragmatic default** — visible, cacheable,
trivial to route at a gateway or reverse proxy by prefix.

**What actually requires a version bump.** Not every change:

- **Non-breaking (no bump needed):** adding a new optional field to a response,
  adding a new endpoint, adding a new optional query parameter.
- **Breaking (requires a bump):** removing or renaming a field, changing a
  field's type, changing validation to be stricter, changing an error code's
  meaning, changing default behaviour.

Treating "adding a field" as breaking causes unnecessary version churn; treating
"removing a field" as non-breaking silently breaks every client. Get this
distinction right and most APIs need version bumps far less often than teams fear.

**Deprecation, done properly:**

```ts
router.get('/v1/orders', deprecationWarning('2027-01-01', '/v2/orders'), listOrdersV1);

function deprecationWarning(sunsetDate: string, replacement: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.set('Deprecation', 'true');
    res.set('Sunset', sunsetDate);
    res.set('Link', `<${replacement}>; rel="successor-version"`);
    next();
  };
}
```

Announce, set a sunset date months out, monitor which clients are still hitting
the old version, and only remove it once usage is near zero or the date has
passed with adequate warning.

### 9. Common mistakes (both sections)

| Mistake | Fix |
|---|---|
| Different error shapes per endpoint | One shape, enforced by one middleware |
| Client code branching on `error.message` | Branch on `error.code` only |
| Version-bumping for additive, non-breaking changes | Reserve bumps for actual breaking changes |
| Removing an old API version with no deprecation window | Sunset headers + monitored migration period |
| Leaking internal exception messages/stack traces in production error bodies | Generic message, log the detail server-side |

### 10. Interview answer (combined)

> Every error response shares one shape: a boolean success flag, a stable
> machine-readable error code that clients switch on, a human message, optional
> field-level details for validation errors, and a request ID for
> correlation — all produced by one centralised error-handling middleware, never
> scattered per-endpoint. For versioning I default to a path prefix because it's
> visible and cache-friendly, but I'm strict about what actually counts as
> breaking — adding an optional field isn't, removing or renaming one is — so I
> don't bump versions more than necessary. When I do deprecate a version, it gets
> Deprecation and Sunset headers and a monitored migration window before removal.

### 12. Production considerations

- **Enumerate error codes in the OpenAPI spec** (12.6) so client SDKs can generate
  typed error handling.
- **Alert on `INTERNAL_ERROR` rate**, not on `VALIDATION_ERROR` rate — the first
  is a bug, the second is often just users.
- **Track version usage** by header/path in your metrics so you know when it's
  actually safe to sunset an old version.

---

## 12.6 Webhooks, OpenAPI, GraphQL and gRPC

### Webhooks

**1. Proper definition.** An HTTP callback — your server making an outbound
`POST` to a URL the client registered, notifying them of an event, inverting the
usual request direction.

**2. Simple meaning.** Instead of a client polling "did anything happen yet?",
your server tells them the moment it does.

**3. Why it is needed.** Polling wastes resources on both sides and adds latency
equal to the poll interval. Webhooks are the async-notification pattern from
Phase 11 exposed across an organisation boundary rather than between your own
services.

**4. How it works — designed correctly:**

```ts
// Sending a webhook
async function sendWebhook(endpoint: WebhookEndpoint, event: DomainEvent) {
  const payload = JSON.stringify({ id: event.id, type: event.type, data: event.payload, timestamp: event.occurredAt });
  const signature = createHmac('sha256', endpoint.secret).update(payload).digest('hex');

  await fetch(endpoint.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature, 'X-Webhook-Id': event.id },
    body: payload,
    signal: AbortSignal.timeout(5000),
  });
}
```

```ts
// Receiving a webhook (as a consumer of someone else's)
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.header('Stripe-Signature');
  if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(400).json(errorBody('INVALID_SIGNATURE', 'Signature verification failed', req.id));
  }

  const event = JSON.parse(req.body);
  if (await webhookLog.alreadyProcessed(event.id)) {
    return res.status(200).send();   // idempotent — already handled, ack anyway
  }

  await eventQueue.publish(event);   // hand off, don't process inline
  await webhookLog.markSeen(event.id);
  res.status(200).send();            // ack fast — process async
});
```

Five non-negotiable design points, each answering a real failure mode:

- **Sign every payload (HMAC)** and verify it on receipt — otherwise anyone who
  finds the URL can forge events.
- **Retry with exponential backoff** on the sending side (the receiver's server
  will be down sometimes) and a **dead-letter/disable** policy after N consecutive
  failures, so one broken client endpoint doesn't retry forever.
- **The receiver must be idempotent**, keyed by the event ID — retries mean
  duplicate delivery is a certainty, not an edge case (same lesson as Phase 11's
  message broker section).
- **Acknowledge fast, process async** — return `200` immediately after validating
  and enqueueing; don't make the sender's retry timer race your business logic.
- **Deliver at-least-once, document it as such** — never promise exactly-once
  delivery to consumers of your webhooks.

**9. Common mistakes.**

| Mistake | Fix |
|---|---|
| No signature verification | Anyone can forge events |
| Processing synchronously inside the webhook handler | Slow processing causes the sender to time out and retry, compounding load |
| No retry/backoff on the sending side | Transient receiver downtime loses events |
| Assuming exactly-once delivery | Design consumers idempotent by event ID |
| Retrying forever with no backoff or disable threshold | A dead endpoint gets hammered indefinitely |

**10. Interview answer.**
> Webhooks are outbound async notifications, so I treat them with the same
> rules as a message queue consumer: sign every payload with HMAC so the
> receiver can verify authenticity, retry with exponential backoff and a
> disable-after-N-failures policy, and require the receiving endpoint to be
> idempotent by event ID, because at-least-once delivery means duplicates are
> guaranteed, not hypothetical. On the receiving side I acknowledge immediately
> after validating and enqueueing, and do the actual processing asynchronously
> so I never race the sender's retry timeout.

---

### OpenAPI

**1. Proper definition.** A machine-readable specification (YAML/JSON) describing
an API's endpoints, request/response schemas, authentication and error shapes,
from which documentation, client SDKs and server-side validation can be
generated.

**2–3. Why it is needed.** A hand-written Markdown doc drifts from the real
implementation within weeks. A spec that generates the docs, the client SDK, and
(via a tool like Zod-to-OpenAPI or the reverse) the validation, structurally
cannot drift, because a mismatch breaks the generation step itself.

**4. How it works — a fragment:**

```yaml
openapi: 3.1.0
info:
  title: Orders API
  version: 1.0.0
paths:
  /orders/{id}:
    get:
      summary: Get an order by ID
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: Order found
          content:
            application/json:
              schema: { $ref: '#/components/schemas/OrderResponse' }
        '404':
          description: Order not found
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ErrorResponse' }
components:
  schemas:
    ErrorResponse:
      type: object
      properties:
        success: { type: boolean, enum: [false] }
        error:
          type: object
          properties:
            code: { type: string }
            message: { type: string }
            requestId: { type: string }
```

**Contract-first vs code-first.** Contract-first (write the YAML, generate/agree
the implementation against it) gets frontend and backend teams working in
parallel from an agreed contract, and is generally the better choice for public
or cross-team APIs. Code-first (annotate route handlers, generate the spec from
code — e.g. `zod-to-openapi`) is faster for a small team's internal API and
guarantees the spec never drifts from the actual code, since it's derived from
it.

**7. Real backend usage.** Auto-generated TypeScript/Python client SDKs;
interactive docs (Swagger UI/Redoc); contract testing between frontend and
backend before either side finishes implementation.

**9. Common mistakes.**

| Mistake | Fix |
|---|---|
| Hand-maintained docs alongside the actual API | They drift within weeks — generate one from the other |
| No shared `ErrorResponse` schema reused across endpoints | Inconsistent error docs even if the runtime shape is consistent |
| Treating the spec as documentation only | Use it for request validation and SDK generation too |

**10. Interview answer.**
> I treat the OpenAPI spec as the source of truth, not the documentation — either
> contract-first, where frontend and backend agree the YAML before either
> implements, or generated from code annotations so it structurally can't drift.
> Either way it drives more than docs: SDK generation for clients and, on the
> server, request validation, so the spec, the validation and the docs are
> guaranteed to agree with each other by construction rather than by discipline.

---

### GraphQL — basics

**1. Proper definition.** A query language and runtime where clients specify
exactly which fields they need across a typed schema, and a single endpoint
resolves that query, versus REST's fixed per-endpoint response shapes.

**2. Simple meaning.** Instead of `GET /orders/{id}` always returning a fixed
JSON shape, the client sends a query describing exactly the fields it wants, and
gets exactly that back — nothing more, nothing less.

```graphql
type Order {
  id: ID!
  status: OrderStatus!
  total: Float!
  customer: Customer!
  items: [OrderItem!]!
}

type Query {
  order(id: ID!): Order
}
```

```graphql
query {
  order(id: "123") {
    id
    status
    customer { name email }
  }
}
```

**3. Why it exists.** Solves two specific REST pain points: **over-fetching** (a
mobile client getting fifteen fields when it renders three) and **under-fetching
/ the N+1 round-trip problem** (needing the order, then a separate call for the
customer, then another for the items). One GraphQL query replaces what would be
several REST round trips.

**4. How it works, briefly.** A single `POST /graphql` endpoint; the schema
defines types and their relationships; **resolvers** are functions that fetch the
data for each field, one resolver per field/type, composed at query time.

**8. The N+1 problem, and its standard fix.** A naive resolver for `order.items`
that queries per order, called for a list of 50 orders, issues 50 queries — the
same N+1 problem from Phase 6. The standard fix is **DataLoader**: it batches all
the individual `findById` calls made during one query-resolution tick into a
single `WHERE id IN (...)` query.

**9. Common mistakes.**

| Mistake | Fix |
|---|---|
| No DataLoader — N+1 queries per request | Batch loads with DataLoader |
| No query depth/complexity limiting | A malicious deeply-nested query can be a DoS vector |
| Treating GraphQL as "REST but as one endpoint" | Design a graph schema, not a REST resource dressed up |
| Errors returned as 200 with an `errors` array unexamined | Client code must still check `errors`, not just `data` |

**10. When to choose it over REST.** Multiple client types with very different
data needs (mobile vs. web vs. partner API) from the same backend, or a UI that
would otherwise need many chained REST calls to render one screen. **Not** a
default replacement for REST — added complexity (schema design, N+1 discipline,
caching is harder since there's no resource URL to cache by) only pays off when
that specific problem is real. Many production systems mix both: GraphQL for a
complex client-facing app, plain REST for service-to-service and webhooks.

---

### gRPC — basics

**1. Proper definition.** A high-performance RPC framework using HTTP/2 and
Protocol Buffers (a compact binary serialisation format) with a strict schema
defined in `.proto` files, generating strongly-typed client and server code in
multiple languages.

**2. Simple meaning.** Instead of hand-writing a REST contract and hoping both
sides agree on JSON field names and types, you define the contract once in a
`.proto` file, and both client and server generate code from it — the compiler
enforces the contract can't drift.

```protobuf
syntax = "proto3";

service OrderService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc StreamOrderUpdates (StreamRequest) returns (stream OrderUpdate);
}

message GetOrderRequest { string id = 1; }
message Order {
  string id = 1;
  string status = 2;
  double total = 3;
}
```

**3. Why it exists / trade-offs versus REST+JSON:**

| | REST + JSON | gRPC |
|---|---|---|
| Payload size | Larger (text) | Smaller (binary) — meaningfully faster at high volume |
| Human readability | Yes — curl-able, debuggable in a browser | No — needs tooling |
| Browser support | Native | Needs grpc-web + a proxy |
| Streaming | Awkward (SSE/WebSocket bolted on) | Native (unary, server-streaming, client-streaming, bidirectional) |
| Contract enforcement | Convention + OpenAPI (optional, can drift) | Compiler-enforced from `.proto` |
| Typical use | Public APIs, browser clients | Internal service-to-service |

**7. Real backend usage.** Internal microservice-to-microservice calls inside
Phase 9's modular-monolith-turned-services boundary, where every caller is your
own infrastructure with generated clients — not a public-facing choice, because
of the browser and human-readability costs above.

**9. Common mistakes.**

| Mistake | Fix |
|---|---|
| Exposing gRPC directly to public/browser clients | Needs grpc-web + proxy, or just expose REST publicly and gRPC internally |
| Treating `.proto` fields as freely renameable | Field *numbers* are the wire contract — never reuse or renumber them |
| Using gRPC where human debuggability matters more than performance | REST+JSON remains easier to curl, log, and inspect |

**10. Interview answer (combined GraphQL/gRPC).**
> I default to REST for anything public-facing, because it's cacheable,
> debuggable, and universally supported. I'd reach for GraphQL when multiple very
> different clients need different shapes of the same underlying data and REST
> would mean either over-fetching or many chained calls — accepting the N+1 and
> query-complexity concerns that come with it. I'd reach for gRPC for internal
> service-to-service calls where both ends are my own infrastructure, because the
> compiler-enforced contract and binary payload matter more there than
> human-readability, which is the opposite trade-off from a public API.

### 12. Production considerations (whole section)

- **Webhooks:** log every delivery attempt with status and latency; expose a
  delivery-log UI/endpoint so integrators can self-diagnose instead of filing
  support tickets.
- **OpenAPI:** run spec-vs-implementation drift checks in CI, not just at review
  time.
- **GraphQL:** set a maximum query depth and a cost/complexity limit before
  launch, not after the first abusive query is found in production.
- **gRPC:** version `.proto` files carefully — additive changes only
  (new fields with new numbers) for backward compatibility, exactly like the
  REST non-breaking-change rules in 12.5.

---

## Choosing an API Style

| | REST | GraphQL | gRPC |
|---|---|---|---|
| Best for | Public APIs, general CRUD | Client-diverse, data-graph-shaped UIs | Internal service-to-service |
| Cacheable by HTTP infra | Yes (GET) | Poorly (single POST endpoint) | No |
| Human debuggable | Yes | Somewhat | No |
| Contract enforcement | Convention + OpenAPI | Schema (SDL) | Compiler (.proto) |
| Typical adopter | Everyone, as the default | Frontend-heavy multi-client products | Microservice meshes |

**The default should be REST.** Reach for GraphQL or gRPC only when a specific,
named problem — client diversity, or internal RPC performance — justifies the
added complexity. This mirrors the whole phase's central discipline: match the
tool to a demonstrated need, not to novelty.

---

## Phase 12 Completion Checklist

You are done with this phase when you can:

- [ ] Design resource URLs for a new domain with correct nesting depth and
      naming conventions, and defend an action endpoint that doesn't fit CRUD.
- [ ] Explain safety and idempotency for every HTTP method and why POST needs an
      explicit idempotency key while GET/PUT/DELETE don't.
- [ ] Choose the correct status code for ten different scenarios, including the
      401/403 and 400/422 distinctions.
- [ ] Implement schema validation at the edge returning the standard error
      format with field-level details.
- [ ] Implement both offset and cursor pagination and explain when to use each.
- [ ] Implement an idempotency-key mechanism that stores the full response and
      locks against concurrent duplicate requests.
- [ ] Use ETags for both conditional GET and optimistic-concurrency PATCH.
- [ ] Propagate a correlation ID through logs, downstream calls and queue
      messages.
- [ ] Build one centralised error-handling middleware producing a single
      consistent error shape across an entire API.
- [ ] Correctly classify five API changes as breaking or non-breaking, and
      version only when necessary.
- [ ] Design a signed, idempotent, asynchronously-processed webhook receiver.
- [ ] Explain the trade-off table between REST, GraphQL and gRPC and pick
      correctly for a given scenario, defaulting to REST absent a specific reason.

**Next:** Phase 13 — Error Handling and Resilience. Phase 12 defined the
contract on each arrow; Phase 13 is what happens when the arrow's connection
breaks — timeouts, retries, circuit breakers, and the operational-vs-programmer
error distinction that governs how failures are classified and recovered from.

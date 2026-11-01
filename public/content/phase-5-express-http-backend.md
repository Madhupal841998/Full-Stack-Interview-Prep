# Phase 5 — Express.js and HTTP Backend Development

> Priority: **MUST KNOW**
> Prerequisite: Phase 4 (Node.js Core) — especially the HTTP module, streams, and event loop.

Each topic below follows the standard learning order: definition → simple meaning → why it's needed → internals → syntax/API → example → real backend usage → edge cases → common mistakes → interview answer → practice problem → production considerations.

---

## 5.1 Routing

**Definition.** Routing is the mechanism that maps an incoming HTTP method + path to a specific handler function.

**Why it's needed.** A backend exposes many operations over one port. Routing is how the server decides which code runs for `GET /users/42` versus `POST /users`.

**How it works internally.** Express keeps an internal array of "layers." Each `app.get/post/...` call pushes a layer with a path-matcher (built from `path-to-regexp`) and a handler. On each request, Express walks the stack in registration order and runs the first layer whose method and path pattern match, then any middleware after it, until something sends a response.

**Syntax / API.**
```javascript
const router = express.Router()

router.get('/users/:id', getUserHandler)
router.post('/users', createUserHandler)
router.put('/users/:id', updateUserHandler)
router.delete('/users/:id', deleteUserHandler)

app.use('/api/v1', router)
```

**Real backend usage.** Feature-based routers (`user.routes.js`, `session.routes.js`) mounted under a common prefix, so each domain owns its own path space and can be tested or versioned independently.

**Edge cases.**
- Route order matters — `/users/new` must be registered before `/users/:id`, or `:id` swallows `new`.
- Trailing slashes and case sensitivity are configurable (`strict routing`, `case sensitive routing`) and default to off.
- Wildcard and regex routes (`/files/*`) can unintentionally shadow later, more specific routes.

**Common mistakes.**
- Defining `/:id` routes before literal routes.
- Doing business logic directly inside the route callback instead of delegating to a controller.
- Forgetting `express.Router()` and cramming every route into `app.js`.

**Interview answer.** "Express maintains an ordered middleware/route stack. A request is matched top to bottom by method and path pattern; the first matching handler that doesn't call `next()` ends the cycle. Routers let you scope this stack per feature and mount it under a prefix."

**Practice problem.** Build a `Router` for `/products` supporting list, get-by-id, create, update, delete, with `/products/featured` correctly resolving instead of being captured by `/products/:id`.

**Production considerations.** Keep routers thin — they should only wire path → controller, with validation and auth as middleware in between.

---

## 5.2 Middleware

**Definition.** A middleware is a function `(req, res, next) => {}` that runs during the request-response cycle and can modify `req`/`res`, end the cycle, or pass control forward via `next()`.

**Why it's needed.** Cross-cutting concerns (auth, logging, parsing, error handling) would otherwise have to be duplicated in every route handler.

**How it works internally.** Middleware is just more layers in the same stack routing uses. `next()` moves to the next layer; `next(err)` skips straight to the nearest error-handling middleware (a 4-arg function). If `next()` is never called and no response is sent, the request hangs.

**Syntax / API.**
```javascript
app.use(express.json())

const requestLogger = (req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    console.log(req.method, req.originalUrl, res.statusCode, Date.now() - start)
  })
  next()
}

app.use(requestLogger)

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  next()
}

router.get('/orders', requireAuth, getOrdersHandler)
```

**Real backend usage.** Application-level middleware (body parsing, logging, security headers) applied globally; router-level middleware (auth, ownership checks) applied to specific route groups.

**Edge cases.**
- Middleware order is significant — `express.json()` must run before any handler that reads `req.body`.
- Async middleware that throws must forward the error via `next(err)`; an unhandled rejection inside middleware won't automatically reach Express's error handler unless caught.
- Mounting middleware with `app.use(path, mw)` matches the path as a prefix, not an exact match.

**Common mistakes.**
- Forgetting `next()`, silently hanging requests.
- Calling `next()` after already sending a response (`res.send()` then `next()`), causing "headers already sent" errors.
- Putting `requireAuth` after the handler it's meant to protect.

**Interview answer.** "Middleware are ordered functions that get access to `req`, `res`, and `next`. They compose the request pipeline — each one decides whether to short-circuit the cycle, transform the request, or delegate onward. Error middleware is distinguished purely by arity (4 parameters)."

**Practice problem.** Write a middleware that attaches a `requestId` (UUID) to every request and logs it alongside the final status code, without blocking the response.

**Production considerations.** Wrap async route handlers/middleware in a helper that catches rejected promises and forwards them to `next`, since Express 4 does not do this automatically (Express 5 does).

---

## 5.3 Request and Response

**Definition.** `req` represents the incoming HTTP request (method, URL, headers, body, params, query); `res` represents the outgoing HTTP response the handler controls.

**Why it's needed.** Every piece of client input and server output flows through these two objects — understanding their surface is the baseline for writing any handler correctly.

**How it works internally.** `req`/`res` are thin wrappers around Node's raw `http.IncomingMessage` and `http.ServerResponse`, with Express adding convenience methods (`req.params`, `req.query`, `res.json`, `res.status`) on top.

**Syntax / API.**
```javascript
app.get('/search', (req, res) => {
  const { q, page = 1 } = req.query
  res
    .status(200)
    .set('X-Total-Count', '42')
    .json({ query: q, page: Number(page) })
})
```

**Real backend usage.** `req.params` for resource identifiers (`/users/:id`), `req.query` for filters/pagination, `req.body` for payloads, custom `req` properties (like `req.user`) attached by auth middleware and consumed downstream.

**Edge cases.**
- Query values are always strings (or arrays of strings) — `page=2` arrives as `"2"`, not `2`.
- `req.body` is `undefined` unless a body-parsing middleware ran first.
- Headers are case-insensitive but Express lower-cases them internally.

**Common mistakes.**
- Comparing `req.query.page` to a number without converting it.
- Calling `res.json()` and then `res.send()` in the same handler (headers already sent).
- Trusting `req.body` shape without validation.

**Interview answer.** "`req` and `res` wrap Node's core HTTP objects. Express adds parsing and response-building helpers, but underneath, `res.json()` is still calling `res.end()` on a raw socket write."

**Practice problem.** Write a handler for `GET /reports` that reads `startDate`, `endDate`, and `format` from the query string, validates them, and responds with either JSON or CSV based on `format`.

**Production considerations.** Never assume `req.body`/`req.query` are well-typed — validate before use (see 5.7).

---

## 5.4 Error Middleware

**Definition.** Error-handling middleware is a 4-argument function `(err, req, res, next)` that Express routes uncaught errors to, bypassing normal middleware.

**Why it's needed.** Without a central place to catch errors, every handler has to duplicate try/catch and response-formatting logic, and unexpected exceptions can crash the process.

**How it works internally.** When `next(err)` is called, or a synchronous handler throws, Express skips all remaining regular middleware and jumps to the first matching error middleware. It must be registered last, after all routes.

**Syntax / API.**
```javascript
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

router.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = await orderService.findById(req.params.id)
  if (!order) {
    const error = new Error('Order not found')
    error.statusCode = 404
    throw error
  }
  res.json(order)
}))

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Internal server error' : err.message
  })
})
```

**Real backend usage.** A single error middleware that maps known error types (`ValidationError`, `NotFoundError`, `UnauthorizedError`) to status codes, logs unexpected 500s with full stack traces, and hides internal details from the client.

**Edge cases.**
- Errors thrown inside `setTimeout`, event listeners, or unhandled async code never reach Express's error handler — they must be caught explicitly.
- Multiple error middlewares can exist; call `next(err)` from one to pass to the next.
- Express identifies error middleware purely by having exactly 4 parameters, so it can't be a variadic or default-parameter trick.

**Common mistakes.**
- Registering error middleware before the routes.
- Leaking stack traces or raw error messages to clients in production.
- Not distinguishing operational errors (bad input, not found) from programmer errors (bugs) when deciding what to expose.

**Interview answer.** "Error middleware is Express's built-in exception boundary. Any `next(err)` call or thrown error in a synchronous handler routes there. It centralizes error formatting and logging, and prevents one bad request from leaking implementation details or crashing the process."

**Practice problem.** Create custom error classes `NotFoundError` and `ValidationError` extending `Error`, and a single error middleware that maps them to 404 and 400 respectively, defaulting everything else to 500.

**Production considerations.** Combine with `process.on('unhandledRejection')` / `uncaughtException` handlers for defense in depth, and always log the full error server-side even when the client response is generic.

---

## 5.5 Controllers, Services, and Repositories

**Definition.** A layered architecture separating HTTP concerns (controller), business logic (service), and data access (repository).

**Why it's needed.** Keeps route handlers thin, makes business logic testable without an HTTP server, and isolates database/ORM details so they can change without touching business rules.

**How it works internally.** This isn't an Express feature — it's a code-organization pattern. The controller receives `req`/`res`, extracts input, calls a service, and shapes the response. The service holds business rules and orchestrates one or more repositories. The repository wraps queries (SQL, ORM calls) behind plain methods like `findById`, `create`.

**Syntax / API.**
```javascript
// user.repository.js
const findById = async (id) => db.query('SELECT * FROM users WHERE id = ?', [id])

// user.service.js
const getActiveUser = async (id) => {
  const user = await userRepository.findById(id)
  if (!user || user.status !== 'active') {
    const error = new Error('User not found')
    error.statusCode = 404
    throw error
  }
  return user
}

// user.controller.js
const getUser = async (req, res) => {
  const user = await userService.getActiveUser(req.params.id)
  res.json(user)
}
```

**Real backend usage.** In an LMS-style app: `SessionController` handles `req`/`res`, `SessionService` enforces rules like "a trainer can't double-book a slot," `SessionRepository` runs the SQL against MySQL.

**Edge cases.**
- Over-layering trivial CRUD endpoints adds indirection with no real benefit — thin apps can collapse controller and service.
- Repositories should not leak ORM/query objects upward; they should return plain domain data.
- Cross-entity transactions (e.g., create order + decrement stock) belong in the service layer, not scattered across repositories.

**Common mistakes.**
- Business logic (discount calculation, permission checks) written directly in the controller.
- Repositories that return raw DB rows with inconsistent casing/types instead of a normalized shape.
- Services importing `req`/`res` directly, coupling them to HTTP and making them hard to unit test.

**Interview answer.** "Controllers translate HTTP into calls on a service; services hold business rules and are HTTP-agnostic; repositories isolate persistence. This lets me unit-test business logic without spinning up Express, and swap MySQL for another store by only touching the repository layer."

**Practice problem.** Refactor a single fat route handler that reads `req.body`, validates it, queries MySQL directly, and sends a response, into controller + service + repository files.

**Production considerations.** Define clear interfaces at each boundary; keep repositories free of business conditionals so they stay reusable across services.

---

## 5.6 Validation

**Definition.** Validation is verifying that incoming data (body, params, query, headers) conforms to expected shape and constraints before it's trusted or persisted.

**Why it's needed.** Client input is inherently untrusted. Unvalidated input causes crashes, corrupted data, and security vulnerabilities (injection, mass assignment).

**How it works internally.** A validation library (Zod, Joi, class-validator, express-validator) defines a schema; middleware runs the schema against `req.body`/`req.query`/`req.params` before the handler executes, short-circuiting with a 400 on failure.

**Syntax / API.**
```javascript
const { z } = require('zod')

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().int().positive().optional()
})

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() })
  }
  req.body = result.data
  next()
}

router.post('/users', validateBody(createUserSchema), createUserHandler)
```

**Real backend usage.** Every write endpoint (`POST`/`PUT`/`PATCH`) validated at the edge; query params for pagination/filtering coerced and bounded (e.g., `limit` capped at 100).

**Edge cases.**
- Validation must reject unknown/extra fields for sensitive resources to prevent mass assignment (e.g., a client setting `role: 'admin'` on signup).
- Numeric query params arrive as strings and need coercion before range checks.
- Nested objects and arrays need recursive schemas, not just top-level checks.

**Common mistakes.**
- Validating only on the frontend and trusting the backend won't need it.
- Relying on database constraints as the only validation layer, surfacing raw SQL errors to clients.
- Returning vague `"Invalid request"` messages instead of field-level errors.

**Interview answer.** "Validation is a middleware step that runs a schema against the request before any handler logic executes. It's the boundary between untrusted client input and trusted internal data — rejecting bad shape early avoids defensive checks scattered through business logic."

**Practice problem.** Write a schema-based validator for a `PATCH /users/:id` endpoint that only allows `name` and `email` to be updated, rejecting any other field.

**Production considerations.** Centralize error formatting for validation failures so the API returns a consistent error contract across all endpoints.

---

## 5.7 Authentication

**Definition.** Authentication verifies *who* is making the request.

**Why it's needed.** Backends need to know the identity behind a request before deciding what it's allowed to do.

**How it works internally.** Common approaches: session cookies (server stores session state, client holds an opaque ID) or stateless tokens (JWT, client holds a signed token containing claims). Middleware extracts and verifies the credential on each request and attaches identity to `req`.

**Syntax / API.**
```javascript
const jwt = require('jsonwebtoken')

const authenticate = (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing token' })
  }
  try {
    const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET)
    req.user = { id: payload.sub, role: payload.role }
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}
```

**Real backend usage.** Login endpoint issues an access token (short-lived) and a refresh token (long-lived, often httpOnly cookie); `authenticate` middleware protects everything under `/api`.

**Edge cases.**
- Token expiry must be checked on every request, not just at login.
- Refresh token rotation and revocation (logout, compromised token) need server-side tracking even in a "stateless" JWT setup.
- Clock skew between servers can cause premature "expired" rejections.

**Common mistakes.**
- Storing JWTs in `localStorage`, exposing them to XSS.
- Putting sensitive data (passwords, full PII) inside a JWT payload, which is only signed, not encrypted.
- No refresh/revocation strategy, so a stolen token stays valid until natural expiry.

**Interview answer.** "Authentication answers 'who are you.' I verify a credential — a session cookie or signed token — on each protected request, and attach the resolved identity to `req.user` so downstream authorization and business logic can use it without re-deriving it."

**Practice problem.** Implement login (issue access + refresh token), an `authenticate` middleware, and a `/refresh` endpoint that rotates the refresh token.

**Production considerations.** Use short-lived access tokens with refresh rotation, store refresh tokens hashed server-side, and always use `httpOnly`, `secure`, `sameSite` cookies where cookies are used.

---

## 5.8 Authorization

**Definition.** Authorization decides *what an authenticated identity is allowed to do*.

**Why it's needed.** Authentication alone doesn't prevent a logged-in learner from acting like a trainer or admin — that requires a separate permission check.

**How it works internally.** Runs after authentication. Compares the resolved identity (role, permissions, ownership) against the requirements of the specific action, usually via a middleware or an in-handler check.

**Syntax / API.**
```javascript
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  next()
}

router.delete('/sessions/:id', authenticate, requireRole('trainer', 'admin'), deleteSessionHandler)

const requireOwnership = async (req, res, next) => {
  const session = await sessionService.findById(req.params.id)
  if (session.trainerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' })
  }
  next()
}
```

**Real backend usage.** Role-based access (RBAC) for coarse checks (trainer vs learner vs admin), combined with ownership/resource-level checks (a trainer can only edit their own sessions).

**Edge cases.**
- Role checks alone miss resource-level rules — an admin-only route is easy, "only the owning trainer" needs a data lookup.
- Authorization logic duplicated across controllers drifts out of sync; centralize permission rules.
- Returning 404 instead of 403 for resources a user shouldn't know exist is a deliberate security choice, not a bug.

**Common mistakes.**
- Confusing 401 (not authenticated) with 403 (authenticated but not permitted).
- Performing authorization checks only on the frontend/UI.
- Checking role but not ownership, letting any trainer modify any other trainer's data.

**Interview answer.** "Authorization answers 'what are you allowed to do,' and always runs after authentication. I implement it as middleware for role-based checks and as explicit service-layer checks for ownership-based rules that need a data lookup."

**Practice problem.** Add an ownership-based authorization check to a `PATCH /sessions/:id` endpoint so only the trainer who created the session (or an admin) can edit it.

**Production considerations.** Keep permission rules in one place (a policy/service layer) rather than re-implementing `if (role === ...)` in every controller.

---

## 5.9 Pagination, Filtering, and Sorting

**Definition.** Techniques for returning a manageable, targeted subset of a large collection instead of the entire dataset.

**Why it's needed.** Returning every row of a large table is slow, memory-heavy, and usually not what the client needs.

**How it works internally.** Pagination limits result size via `LIMIT`/`OFFSET` (offset-based) or a cursor on an indexed column (cursor-based, better for large/changing datasets). Filtering translates query params into `WHERE` conditions. Sorting maps a query param to `ORDER BY`, validated against an allow-list of sortable columns.

**Syntax / API.**
```javascript
router.get('/sessions', async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1)
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = (page - 1) * limit

  const allowedSort = ['createdAt', 'title']
  const sortBy = allowedSort.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt'
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC'

  const { rows, total } = await sessionRepository.findMany({
    status: req.query.status,
    limit,
    offset,
    sortBy,
    order
  })

  res.json({ data: rows, page, limit, total, totalPages: Math.ceil(total / limit) })
})
```

**Real backend usage.** Trainer dashboards listing sessions/learners with filters (status, date range), sortable columns, and page-based navigation.

**Edge cases.**
- Offset pagination gets slow and can skip/duplicate rows on large offsets if rows are inserted/deleted concurrently — cursor pagination avoids this.
- Unbounded `limit` values let a client request the entire table; always cap it.
- Sorting by an unindexed or non-allow-listed column can degrade performance or allow SQL injection if built by string concatenation.

**Common mistakes.**
- Building `ORDER BY ${req.query.sortBy}` directly from user input (injection risk) instead of validating against an allow-list.
- Not returning `total`/`totalPages`, forcing the client to guess when pagination ends.
- Loading the full table into memory and paginating in application code instead of in the database query.

**Interview answer.** "Offset pagination is simple but degrades and can shift under concurrent writes at scale; cursor-based pagination — keying off an indexed, unique, ordered column like `id` or `createdAt` — stays consistent and fast for large or frequently-changing datasets."

**Practice problem.** Implement cursor-based pagination for `GET /sessions` using `createdAt` + `id` as a composite cursor, returning a `nextCursor` in the response.

**Production considerations.** Index every column used for filtering/sorting; cap `limit`; prefer cursor pagination once tables grow large or are written to frequently.

---

## 5.10 File Upload

**Definition.** Accepting binary file data from a client over HTTP, typically as `multipart/form-data`.

**Why it's needed.** Profile pictures, course materials, assignment submissions, and similar features all require the backend to receive and store files safely.

**How it works internally.** A parser like `multer` reads the multipart stream, splits it into fields and file parts, and either buffers files in memory, writes them to local disk, or streams them directly to object storage (e.g., S3), attaching parsed metadata to `req.file`/`req.files`.

**Syntax / API.**
```javascript
const multer = require('multer')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'application/pdf']
    cb(null, allowed.includes(file.mimetype))
  }
})

router.post('/materials', authenticate, upload.single('file'), async (req, res) => {
  const url = await storageService.upload(req.file.buffer, req.file.originalname)
  res.status(201).json({ url })
})
```

**Real backend usage.** Session materials/attachments uploaded by trainers, streamed to S3 rather than kept on the app server's local disk, with metadata (uploader, size, type) stored in MySQL.

**Edge cases.**
- Large files can exhaust memory if buffered fully — streaming to disk/object storage avoids this.
- MIME type from the client is client-supplied and can be spoofed; server-side content sniffing adds real verification.
- Concurrent uploads with the same filename need a collision-safe naming strategy.

**Common mistakes.**
- Trusting the client-provided filename/extension without sanitizing (path traversal risk).
- No file size or type limit, allowing denial-of-service via huge uploads.
- Storing uploaded files on the app server's local disk in a horizontally scaled deployment, where other instances can't see them.

**Interview answer.** "File uploads are handled by a multipart parser that separates form fields from binary file streams. For production, I stream directly to object storage rather than local disk, enforce size/type limits at the middleware level, and generate a safe, collision-resistant storage key instead of trusting the client filename."

**Practice problem.** Add server-side validation that rejects files over 5MB or with a disallowed MIME type, and stream accepted files to S3 instead of buffering in memory.

**Production considerations.** Never serve uploaded files directly from app server disk in a multi-instance deployment; use object storage plus a CDN, and virus-scan or type-verify anything user-uploaded before it's served back to other users.

---

## 5.11 API Versioning

**Definition.** A strategy for evolving an API's contract over time without breaking existing clients.

**Why it's needed.** Mobile apps, third-party integrations, or older frontend deployments may depend on an older response shape; versioning lets the backend change without breaking them.

**How it works internally.** Not an Express feature — a routing/organization convention. Common strategies: URI versioning (`/api/v1/...`), header versioning (`Accept: application/vnd.app.v2+json`), or query param versioning. URI versioning is the simplest to implement and debug.

**Syntax / API.**
```javascript
app.use('/api/v1', v1Router)
app.use('/api/v2', v2Router)
```

**Real backend usage.** `/api/v1/sessions` kept stable for an existing mobile app while `/api/v2/sessions` introduces a breaking response shape change for a new web client.

**Edge cases.**
- Internal logic (services, repositories) is usually shared between versions; only controllers/response shaping typically diverge.
- Deprecating a version needs a communicated timeline and monitoring of which clients still call it.
- Breaking vs non-breaking changes must be defined clearly (adding a field is usually safe; renaming/removing one isn't).

**Common mistakes.**
- Duplicating entire service/repository layers per version instead of only the response-shaping layer.
- Introducing breaking changes into an existing version instead of creating a new one.
- No deprecation signal (headers, docs) before removing an old version.

**Interview answer.** "Versioning isolates breaking contract changes so existing clients keep working. I prefer URI versioning for clarity and cacheability, and keep it thin — only the controller/response layer differs between versions, while services and data access stay shared."

**Practice problem.** Introduce a `v2` of a `GET /users/:id` endpoint that renames `fullName` to separate `firstName`/`lastName` fields, while `v1` keeps working unchanged.

**Production considerations.** Track usage per version to know when it's safe to sunset an old one; document deprecation timelines in the API response headers or docs.

---

## 5.12 OpenAPI / Swagger

**Definition.** OpenAPI is a specification format for describing an HTTP API's endpoints, request/response schemas, and auth requirements in a machine-readable document; Swagger UI renders it as interactive docs.

**Why it's needed.** Frontend teams, mobile teams, and external integrators need an accurate, explorable contract instead of reverse-engineering the API from source code.

**How it works internally.** The spec (YAML/JSON) is either hand-written or generated from code annotations/decorators; Swagger UI/Redoc reads it and renders interactive documentation, including a "try it out" request runner.

**Syntax / API.**
```javascript
/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User found
 */
router.get('/users/:id', getUserHandler)
```
```javascript
const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')

const spec = swaggerJsdoc({
  definition: { openapi: '3.0.0', info: { title: 'LMS API', version: '1.0.0' } },
  apis: ['./src/routes/*.js']
})

app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec))
```

**Real backend usage.** Auto-generated docs kept in sync with route annotations so the frontend team always has an accurate contract without asking backend engineers directly.

**Edge cases.**
- Hand-maintained specs drift from actual behavior unless generation is tied to code or enforced in CI.
- Auth flows (bearer token, OAuth) need to be described in the spec for "try it out" to work.
- Large APIs benefit from splitting the spec into multiple files/components (`$ref`) rather than one giant document.

**Common mistakes.**
- Writing docs once and never updating them as endpoints change.
- Not documenting error responses, only the happy path.
- Exposing full interactive Swagger UI (with "try it out" against production) publicly without auth.

**Interview answer.** "OpenAPI gives a language-agnostic, machine-readable contract for the API. I generate it from route annotations so it can't silently drift from the real implementation, and I gate the interactive UI behind auth in production."

**Practice problem.** Document a `POST /sessions` endpoint's request body schema, success response, and 400/401/403 error responses in OpenAPI format.

**Production considerations.** Validate the spec in CI against actual route definitions where possible, and restrict `/docs` access outside local/staging environments if it exposes internal details.

---

## 5.13 CORS

**Definition.** Cross-Origin Resource Sharing is a browser-enforced mechanism that controls whether a web page on one origin can make requests to an API on a different origin.

**Why it's needed.** Without CORS headers, browsers block frontend JavaScript (running on `app.example.com`) from reading responses from an API on `api.example.com`, as a security default.

**How it works internally.** The browser sends the request with an `Origin` header. For non-simple requests, it first sends a `OPTIONS` preflight. The server must respond with `Access-Control-Allow-Origin` (and related headers) explicitly allowing that origin/method/headers, or the browser blocks the response from reaching JS — the request itself may still hit the server.

**Syntax / API.**
```javascript
const cors = require('cors')

app.use(cors({
  origin: ['https://app.example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}))
```

**Real backend usage.** LMS frontend on one domain calling an API on another (or a different subdomain) — CORS config allow-lists exactly the frontend origins, with `credentials: true` when cookies are used for auth.

**Edge cases.**
- `Access-Control-Allow-Origin: *` cannot be combined with `credentials: true` — browsers reject that combination.
- Preflight (`OPTIONS`) requests need to be handled/allowed even though they carry no body.
- CORS is a browser-side protection — it does nothing to stop non-browser clients (curl, server-to-server) from calling the API.

**Common mistakes.**
- Using a wildcard origin in production, especially alongside credentialed requests.
- Assuming CORS is a security boundary that protects the API itself, rather than a browser-enforced restriction on which pages can read the response.
- Not handling `OPTIONS` preflight, causing every non-simple request from the browser to fail.

**Interview answer.** "CORS is enforced by browsers, not servers — it doesn't stop the request from executing, it stops JavaScript on another origin from reading the response unless the server explicitly allows it via `Access-Control-Allow-*` headers, including for preflight `OPTIONS` requests."

**Practice problem.** Configure CORS to allow only `https://app.example.com` and `https://admin.example.com`, support credentialed cookies, and correctly answer preflight requests for a `PATCH` endpoint.

**Production considerations.** Never wildcard origin when using cookies/credentials; keep the allow-list explicit and environment-specific (different origins for staging vs production).

---

## 5.14 Security Headers

**Definition.** HTTP response headers that instruct the browser to enforce additional security policies (what can load, how content is framed, how cookies behave, etc.).

**Why it's needed.** Many common web attacks (XSS, clickjacking, MIME sniffing) are mitigated significantly just by sending the right headers — this is cheap, high-leverage protection.

**How it works internally.** Middleware like `helmet` sets a collection of sane-default security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, etc.) on every response.

**Syntax / API.**
```javascript
const helmet = require('helmet')

app.use(helmet())
app.use(helmet.contentSecurityPolicy({
  directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'https://cdn.example.com'] }
}))
```

**Real backend usage.** Applied globally as one of the first middlewares, before routes, so every response — including error responses — carries the same protections.

**Edge cases.**
- A strict `Content-Security-Policy` can break legitimately needed third-party scripts/styles if not configured deliberately.
- `Strict-Transport-Security` should only be sent once HTTPS is fully and permanently in place — reverting to HTTP after sending it causes broken access for returning users.
- Some headers matter only for HTML responses; a pure JSON API cares most about `X-Content-Type-Options`, `Strict-Transport-Security`, and CORS-related headers.

**Common mistakes.**
- Never adding security headers at all, relying only on HTTPS.
- Applying `helmet()` defaults blindly without adjusting CSP for the app's actual asset origins.
- Setting security headers inconsistently across routes instead of globally.

**Interview answer.** "Security headers are a low-cost mitigation layer — `helmet` sets sane defaults for things like preventing MIME sniffing, clickjacking, and enforcing HTTPS, applied globally so every response, including errors, is covered."

**Practice problem.** Configure `helmet` with a custom Content-Security-Policy that allows scripts only from `'self'` and a specific CDN, and verify the resulting response headers.

**Production considerations.** Review CSP violations via reporting endpoints (`report-uri`/`report-to`) before tightening policy further, to avoid silently breaking the frontend.

---

## 5.15 Rate Limiting

**Definition.** Restricting how many requests a client (by IP, API key, or user) can make in a given time window.

**Why it's needed.** Protects against brute-force attacks, abuse, and accidental traffic spikes from overwhelming the backend or downstream services.

**How it works internally.** A counter (in-memory for a single instance, or shared via Redis across instances) tracks request counts per key within a sliding or fixed time window; requests over the limit get rejected with `429 Too Many Requests`, typically with a `Retry-After` header.

**Syntax / API.**
```javascript
const rateLimit = require('express-rate-limit')

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, try again later' }
})

router.post('/auth/login', loginLimiter, loginHandler)
```

**Real backend usage.** Stricter limits on sensitive endpoints (login, password reset, OTP requests) than on general read endpoints; a shared Redis store when the app runs on multiple instances behind a load balancer.

**Edge cases.**
- In-memory rate limiting doesn't work correctly across multiple server instances — each instance has its own counter unless backed by a shared store.
- Rate limiting purely by IP breaks down behind NAT (many users sharing one IP) or is trivially bypassed by rotating IPs — combining with account/API-key-based limits helps.
- Legitimate retry/backoff clients need a clear `Retry-After` header, not just a bare 429.

**Common mistakes.**
- Applying one global rate limit instead of tighter limits on sensitive endpoints like login.
- Using in-memory storage in a horizontally scaled deployment, making the limit ineffective.
- Not distinguishing between per-IP and per-user/per-API-key limits when both matter.

**Interview answer.** "Rate limiting caps requests per key per time window to blunt brute-force and abuse. In a single-instance app, in-memory counters are fine; once you scale horizontally, the counter has to live in a shared store like Redis so limits are enforced consistently across instances."

**Practice problem.** Implement a Redis-backed rate limiter for `POST /auth/login` that allows 5 attempts per 15 minutes per email address, independent of IP.

**Production considerations.** Back rate limiting with Redis (or similar) in any multi-instance deployment; tune limits per endpoint sensitivity rather than one blanket value.

---

## Practice Projects for Phase 5

Build these end-to-end, applying every topic above (routing, middleware, error handling, layered architecture, validation, auth, pagination/filtering/sorting, uploads, versioning, docs, CORS, security headers, rate limiting):

1. **User Management API** — CRUD for users, pagination/filtering/sorting on the list endpoint, input validation, layered architecture.
2. **Authentication API** — registration, login, refresh token rotation, logout/revocation, rate-limited login endpoint.
3. **Product and Inventory API** — nested resources, stock updates, filtering by category/price range, role-based authorization for admin-only mutations.
4. **File Library API** — authenticated uploads to object storage, file type/size validation, versioned download URLs.
5. **Training Session API** — trainer/learner roles, ownership-based authorization, session CRUD with conflict checks, OpenAPI docs, CORS configured for a separate frontend origin.

---

## Phase 5 Completion Checklist

- [ ] Can explain Express's middleware/route stack and matching order from memory.
- [ ] Can write async-safe middleware and route handlers without unhandled rejections.
- [ ] Has a working controller → service → repository split on at least one project.
- [ ] Validates every write endpoint against a schema, rejecting unknown fields.
- [ ] Implements token-based auth with refresh rotation.
- [ ] Distinguishes 401 vs 403 correctly and enforces ownership-based authorization, not just role checks.
- [ ] Implements both offset and cursor pagination and can explain the tradeoff.
- [ ] Handles file uploads with size/type limits, streamed to storage rather than buffered fully in memory.
- [ ] Has a versioned API (`/api/v1`) and understands what changes would require `/api/v2`.
- [ ] Generates OpenAPI docs from code and serves them behind auth outside local/staging.
- [ ] Configures CORS with an explicit origin allow-list, not a wildcard, when credentials are involved.
- [ ] Applies `helmet` and a deliberate CSP globally.
- [ ] Rate-limits at least the authentication endpoints, backed by a shared store if running more than one instance.

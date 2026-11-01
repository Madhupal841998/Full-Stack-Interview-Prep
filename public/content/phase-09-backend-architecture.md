# Phase 9 — Backend Architecture

**Stack context:** Node.js, TypeScript, Express, MySQL
**Prerequisite:** Phases 4–8 (Node core, Express, MySQL, ORM/data access, auth & security)
**Priority:** Layered — MUST KNOW · Modular Monolith — MUST KNOW · Clean / Hexagonal — IMPORTANT

---

## What This Phase Is Really About

Up to Phase 8 you learned how to *make things work*: route a request, query a
database, hash a password, sign a token. Phase 9 is about **where code is allowed
to live and what it is allowed to depend on**.

That is the entire subject. Architecture is not folder naming. Architecture is a
set of rules about the **direction of dependencies**. A codebase with beautiful
folders and no dependency rules will still rot. A codebase with plain folders and
one enforced rule ("business logic never imports Express or MySQL") will stay
workable for years.

Three questions define every architecture style in this phase:

1. **Where does business logic live?**
2. **What is it allowed to import?**
3. **How do you test it without starting a server or a database?**

Keep these questions in mind for each section. If you can answer them for a
style, you understand that style.

### The problem being solved

A typical "it works" Express route looks like this:

```ts
app.post('/orders', async (req, res) => {
  const conn = await pool.getConnection();
  const [rows] = await conn.query('SELECT * FROM users WHERE id = ?', [req.body.userId]);
  if (!rows.length) return res.status(404).json({ error: 'user not found' });
  if (rows[0].credit < req.body.total) return res.status(400).json({ error: 'insufficient credit' });
  await conn.query('INSERT INTO orders (user_id, total) VALUES (?, ?)', [req.body.userId, req.body.total]);
  await sendgrid.send({ to: rows[0].email, subject: 'Order placed' });
  res.json({ ok: true });
});
```

Nothing here is *wrong* on day one. The costs appear later:

- The rule "a user cannot order beyond their credit" exists only inside an HTTP
  handler. A background job or CLI script cannot reuse it.
- Testing that rule requires a running MySQL instance and a mocked HTTP layer.
- Changing from SendGrid to SES means editing business code.
- Twenty routes later, the same credit rule is copy-pasted in four places with
  three subtly different versions.

Every architecture in this phase is a different answer to that single problem.

---

## 9.1 Layered Architecture

### 1. Proper definition

Layered (n-tier) architecture organises an application into horizontal layers,
each with a single responsibility, where a layer may only depend on the layer
directly beneath it. The canonical backend layering is
**Controller → Service → Repository → Database**.

### 2. Simple meaning

- **Controller** — speaks HTTP. Reads the request, calls one service, formats a response.
- **Service** — speaks business. Contains rules, decisions, orchestration, transactions.
- **Repository** — speaks SQL. Turns method calls into queries and rows into objects.
- **Database** — stores data.

The controller never writes SQL. The repository never knows what an HTTP status
code is. The service never touches `req` or `res`.

### 3. Why it is needed

- **Reuse.** The same service method serves an HTTP route, a cron job, a queue
  consumer, and a CLI command.
- **Testability.** Services are tested with a fake repository — no database, no
  server, milliseconds per test.
- **Swappability.** Moving from raw `mysql2` to Prisma touches only repositories.
- **Reviewability.** A reviewer knows where to look: business questions go to the
  service, query questions go to the repository.
- **Onboarding.** New engineers can guess where code belongs without asking.

### 4. How it works internally

Dependencies point **downward only**:

```
HTTP request
   │
   ▼
┌─────────────┐  knows: Express, status codes, validation of shape
│ Controller  │  never: SQL, business rules
└─────────────┘
   │ calls
   ▼
┌─────────────┐  knows: business rules, transactions, orchestration
│  Service    │  never: req/res, SQL strings
└─────────────┘
   │ calls
   ▼
┌─────────────┐  knows: tables, SQL, row→object mapping
│ Repository  │  never: HTTP, business rules
└─────────────┘
   │ calls
   ▼
┌─────────────┐
│   MySQL     │
└─────────────┘
```

Two rules make this real rather than decorative:

1. **No upward imports.** A repository importing a service is a violation. A
   service importing `express` is a violation.
2. **No layer skipping.** A controller calling a repository directly is a
   violation, because the business rule then has nowhere to live and will end up
   in the controller.

A third rule is about *data shape*: each layer owns its own types. The repository
returns a domain object, not a raw MySQL `RowDataPacket`. The controller returns
a DTO, not a domain object with internal fields like `passwordHash` on it.

### 5. Structure and API

```
src/
  modules/
    orders/
      order.controller.ts
      order.service.ts
      order.repository.ts
      order.types.ts
      order.routes.ts
  shared/
    db/pool.ts
    errors/AppError.ts
    middleware/errorHandler.ts
  app.ts
  server.ts
```

### 6. Small example

**Types**

```ts
// order.types.ts
export interface Order {
  id: number;
  userId: number;
  total: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  createdAt: Date;
}

export interface CreateOrderInput {
  userId: number;
  total: number;
}
```

**Repository — SQL only**

```ts
// order.repository.ts
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { Order } from './order.types';

export class OrderRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: number): Promise<Order | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT id, user_id, total, status, created_at FROM orders WHERE id = ?',
      [id],
    );
    return rows.length ? this.toDomain(rows[0]) : null;
  }

  async create(input: CreateOrderInput): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      'INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)',
      [input.userId, input.total, 'PENDING'],
    );
    return result.insertId;
  }

  private toDomain(row: RowDataPacket): Order {
    return {
      id: row.id,
      userId: row.user_id,
      total: Number(row.total),
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
```

**Service — rules only**

```ts
// order.service.ts
import { AppError } from '../../shared/errors/AppError';
import type { OrderRepository } from './order.repository';
import type { UserRepository } from '../users/user.repository';

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly users: UserRepository,
  ) {}

  async placeOrder(userId: number, total: number) {
    if (total <= 0) {
      throw new AppError('INVALID_TOTAL', 'Order total must be positive', 400);
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User does not exist', 404);
    }
    if (user.credit < total) {
      throw new AppError('INSUFFICIENT_CREDIT', 'Not enough credit', 409);
    }

    const id = await this.orders.create({ userId, total });
    return this.orders.findById(id);
  }
}
```

**Controller — HTTP only**

```ts
// order.controller.ts
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { OrderService } from './order.service';

const createOrderSchema = z.object({
  userId: z.number().int().positive(),
  total: z.number().positive(),
});

export class OrderController {
  constructor(private readonly service: OrderService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createOrderSchema.parse(req.body);
      const order = await this.service.placeOrder(body.userId, body.total);
      res.status(201).json({ data: order });
    } catch (err) {
      next(err);
    }
  };
}
```

**Wiring**

```ts
// order.routes.ts
import { Router } from 'express';
import { pool } from '../../shared/db/pool';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { UserRepository } from '../users/user.repository';

const controller = new OrderController(
  new OrderService(new OrderRepository(pool), new UserRepository(pool)),
);

export const orderRoutes = Router();
orderRoutes.post('/orders', controller.create);
```

Notice the payoff: `placeOrder` can now be called from a queue consumer or an
admin script unchanged, and it can be unit-tested with two fake repositories.

### 7. Real backend usage

- An `OrderService.placeOrder` used by the public API, the internal admin API,
  and a CSV bulk-import job.
- A `NotificationService` called after checkout from both the HTTP flow and a
  retry worker.
- A repository swapped from `mysql2` to a read-replica-aware pool with zero
  service changes.

### 8. Edge cases

- **Transactions spanning repositories.** A transaction is a business concern, so
  the *service* opens it, but the *repository* must execute inside it. Pass the
  connection down explicitly:

  ```ts
  async transferCredit(fromId: number, toId: number, amount: number) {
    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();
      await this.users.debit(fromId, amount, conn);
      await this.users.credit(toId, amount, conn);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
  ```

  Alternatively use a `UnitOfWork` or `runInTransaction(cb)` helper so services
  never touch a raw connection object.

- **Cross-service calls.** `OrderService` needing `UserService` is fine, but
  mutual dependency (`A → B → A`) is not. Resolve by extracting shared logic into
  a third service or by emitting a domain event.

- **Reads that do not need rules.** A heavy reporting query forced through a
  service and repository can cause N+1 queries. It is acceptable to add a
  dedicated read-only query module (a "query service") that returns a
  purpose-built DTO — as long as it is read-only and explicitly named.

- **Very thin services.** Some CRUD entities genuinely have no rules. A
  pass-through service is acceptable; it is a placeholder for the rules that will
  arrive later.

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Putting `req`/`res` inside a service | Service is now unusable from jobs and untestable without HTTP | Pass plain arguments, return plain values |
| Writing SQL in the service | Repository loses its purpose; storage becomes unswappable | Move the query to the repository |
| Controller calling the repository directly | Rules leak into HTTP handlers and get duplicated | Always go through the service |
| Returning raw DB rows to the client | Leaks column names and internal fields (`password_hash`) | Map to a DTO in the controller |
| "Fat controller, anaemic service" | Rules live in the wrong layer, still duplicated | Move every `if` about business meaning into the service |
| Importing the service into the repository | Creates a dependency cycle, breaks the layering | Invert: the service depends on the repository |
| One giant `services/` folder for the whole app | Becomes a dumping ground; ownership unclear | Group by feature (see 9.2) |

### 10. Interview answer

> Layered architecture splits the backend into controller, service, repository
> and database layers, where dependencies only point downwards. The controller
> handles HTTP concerns — parsing, validation of shape, status codes. The service
> holds business rules and owns transaction boundaries. The repository handles
> persistence and maps rows to domain objects. The main benefits are reuse —
> the same service serves HTTP, jobs and CLI — and testability, since services
> can be unit-tested against fake repositories with no database. The most common
> violations I watch for are SQL inside services and `req`/`res` leaking below
> the controller.

### 11. Practice problems

1. Refactor the "fat route" example from the top of this phase into
   controller / service / repository with no behaviour change.
2. Write unit tests for `OrderService.placeOrder` using an in-memory fake
   repository. Target: full coverage of the three failure paths with no database.
3. Add a `POST /orders/:id/cancel` endpoint where cancellation is only allowed
   within 30 minutes and only by the owner. Put each rule in the correct layer.
4. Implement `transferCredit` with a transaction owned by the service, and prove
   rollback works with a forced failure between the debit and the credit.
5. Add an `orders:import` CLI command that reuses `OrderService` untouched.

### 12. Production considerations

- **Enforce the rules mechanically.** Lint them or they will be broken.
  With `eslint-plugin-import`:

  ```json
  {
    "rules": {
      "import/no-restricted-paths": ["error", {
        "zones": [
          { "target": "./src/**/*.service.ts", "from": "./node_modules/express" },
          { "target": "./src/**/*.repository.ts", "from": "./src/**/*.service.ts" }
        ]
      }]
    }
  }
  ```

- **Errors:** define a typed `AppError` with a stable machine-readable `code`;
  translate it to an HTTP status in one central error-handling middleware, never
  in individual controllers.
- **Logging:** log at the edges (controller / middleware) with a request ID; avoid
  scattering `console.log` inside services.
- **Connection pooling:** repositories receive the pool via the constructor; never
  create a pool per request.
- **Observability:** wrap service methods with timing metrics — that is the layer
  whose latency maps to business operations.

---

## 9.2 Modular Monolith

### 1. Proper definition

A modular monolith is a single deployable application whose internal code is
divided into independent feature modules with explicit public interfaces and
enforced boundaries, such that any module could in principle be extracted into a
separate service without rewriting its logic.

### 2. Simple meaning

One process, one deployment, one database connection pool — but the code inside
is organised by **feature** (orders, users, billing, notifications), not by
**technical role** (controllers, services, models). Each feature exposes a small
public surface and hides everything else.

### 3. Why it is needed

- **Layering alone does not scale.** A `services/` folder with 90 files is
  unnavigable regardless of how clean each file is.
- **Ownership.** Teams own modules, not folders that everyone edits.
- **Blast radius.** A change inside `billing/` cannot silently break `orders/` if
  it only reaches it through a declared interface.
- **Optionality.** If a module later needs its own scaling profile, extraction to
  a service is a mechanical job rather than an archaeology project.
- **It is the correct default.** Microservices bring network failure, distributed
  transactions, versioning and operational cost. Start modular; extract only when
  a concrete pressure (scaling, deploy independence, team size) demands it.

### 4. How it works internally

Each module is a small vertical slice containing its own layers:

```
src/modules/orders/
  index.ts              ← the ONLY file other modules may import
  api/                  ← routes + controllers (HTTP edge)
  domain/               ← entities, business rules
  application/          ← services / use cases
  infrastructure/       ← repositories, external clients
  internal/             ← everything private
```

Boundary rules:

1. **Import only through `index.ts`.** `import { OrderService } from '@/modules/orders'`
   is allowed; `import { OrderRepository } from '@/modules/orders/infrastructure/order.repository'`
   is not.
2. **No shared database tables across modules.** `billing` does not run
   `SELECT ... FROM orders`. It asks the orders module. This is the single most
   important rule, and the one most often broken.
3. **No cycles.** If `orders` and `billing` both need each other, one of them must
   communicate through an event instead.
4. **Shared code is explicit.** `shared/` holds only genuinely generic things
   (logger, error types, db pool, config). Business concepts never go there.

### 5. Structure and API

**The public interface:**

```ts
// src/modules/orders/index.ts
export type { Order, OrderStatus } from './domain/order.entity';
export { OrderService } from './application/order.service';
export { orderRoutes } from './api/order.routes';
export type { OrderPlacedEvent } from './domain/events';
// OrderRepository is intentionally NOT exported
```

**Module composition root:**

```ts
// src/modules/orders/module.ts
import type { Pool } from 'mysql2/promise';
import type { EventBus } from '../../shared/events/event-bus';
import { OrderRepository } from './infrastructure/order.repository';
import { OrderService } from './application/order.service';

export interface OrdersModuleDeps {
  db: Pool;
  events: EventBus;
  userLookup: (id: number) => Promise<{ id: number; credit: number } | null>;
}

export function createOrdersModule(deps: OrdersModuleDeps) {
  const repository = new OrderRepository(deps.db);
  const service = new OrderService(repository, deps.events, deps.userLookup);
  return { service };
}
```

Note `userLookup`: the orders module does not import the users module directly.
It declares the shape of what it needs, and the application wiring supplies it.
That is dependency inversion applied at the module level — and it is what makes
later extraction cheap.

### 6. Small example — modules communicating

**Direct call (synchronous, needs an answer now):**

```ts
// src/app.ts — composition root
const users = createUsersModule({ db: pool });
const orders = createOrdersModule({
  db: pool,
  events: eventBus,
  userLookup: (id) => users.service.getCreditSnapshot(id),
});
```

**Event (asynchronous, fire-and-forget):**

```ts
// orders/application/order.service.ts
const id = await this.repository.create({ userId, total });
await this.events.publish({
  type: 'order.placed',
  payload: { orderId: id, userId, total, occurredAt: new Date() },
});
```

```ts
// notifications/module.ts
events.subscribe('order.placed', async (e) => {
  await mailer.send(e.payload.userId, 'order-confirmation', { orderId: e.payload.orderId });
});
```

The orders module now has no idea notifications exist. Adding SMS later means
adding a subscriber, not editing order logic.

### 7. Real backend usage

- A SaaS product with `auth`, `tenants`, `billing`, `projects`, `reporting` modules
  in one Node process, one deployment, one MySQL schema — with per-module table
  prefixes and no cross-module joins.
- `billing` publishing `invoice.paid`; `projects` subscribing to lift a usage
  limit; neither importing the other.
- A `reporting` module later extracted to its own service because it needed a
  read replica and a different memory profile — extraction took days, not months,
  because its only inbound dependency was an event subscription.

### 8. Edge cases

- **Cross-module transactions.** Inside one process and one database you *can*
  wrap two modules in a single transaction — but doing so welds them together.
  Prefer: one module commits, then publishes an event; the subscriber's work is
  idempotent and retried on failure. If strict atomicity is required, use the
  **transactional outbox** pattern (write the event row in the same transaction,
  publish from a poller).
- **Reporting across modules.** Genuinely needs data from several modules. Options
  ranked by preference: a read-model updated by events; a dedicated read-only
  query module explicitly allowed to read multiple tables; a database view owned
  by the reporting module.
- **Shared reference data.** Currencies, countries, feature flags. Put them in a
  `shared/reference` module with a read-only API — not copied per module.
- **Circular need.** `orders` needs pricing from `billing`; `billing` needs order
  totals from `orders`. Break it by having `orders` pass the data it already owns
  into a stateless `billing.calculate(input)` call, so the dependency is one-way.
- **The first extraction.** When a module does move out, the in-process call
  becomes a network call: it can now fail, time out and retry. Budget for
  idempotency keys and timeouts *before* extracting.

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Cross-module SQL joins | The hidden dependency makes extraction impossible later | Query through the owning module's API |
| Deep-importing internal files | Boundaries exist only by convention and will erode | Export via `index.ts`; enforce with lint |
| A `shared/` folder full of business logic | Becomes a second monolith inside the monolith | `shared/` = technical only |
| Modules split by technical layer (`controllers/`, `services/`) | Every feature change touches every folder | Split by feature, layer inside the feature |
| Events used for things that need an immediate answer | Hidden latency and race conditions | Use a direct call for queries; events for notifications |
| Too many modules too early | Ceremony without benefit | Start with 3–6 coarse modules; split when one grows painful |
| Calling it "microservices-ready" and never enforcing rules | Gives false confidence | Add the lint rule on day one |

### 10. Interview answer

> A modular monolith is a single deployable unit organised into feature modules
> with explicit boundaries. Each module owns its data and exposes a narrow public
> API through an index file; modules communicate by direct calls for queries and
> by domain events for notifications. It gives most of the structural benefits of
> microservices — clear ownership, controlled blast radius, extraction optionality
> — without network failure modes, distributed transactions or the operational
> cost. I treat it as the default starting point and extract a service only when
> there's a concrete pressure like independent scaling or deploy cadence. The rule
> I enforce hardest is no cross-module database access, because that's the
> dependency that quietly makes extraction impossible.

### 11. Practice problems

1. Reorganise a layered app into `modules/orders`, `modules/users`,
   `modules/notifications`, each with its own `index.ts`.
2. Add an ESLint `no-restricted-imports` rule that forbids importing any path
   matching `modules/*/` beyond the module root. Verify it fails on a deep import.
3. Replace a direct `notificationService.send()` call inside `OrderService` with
   an `order.placed` event and a subscriber.
4. Implement the transactional outbox: an `outbox` table written in the same
   transaction as the order, plus a poller that publishes and marks rows sent.
5. Write a dependency graph script that parses imports and fails CI on any cycle
   between modules.
6. Extract `notifications` into a separate Express service communicating over
   HTTP. Note every new failure mode you had to handle.

### 12. Production considerations

- **Enforce boundaries in CI**, not in code review. Options: ESLint
  `no-restricted-imports`, `dependency-cruiser` rules, or TypeScript project
  references with per-module `tsconfig.json`.
- **Table ownership:** prefix tables per module (`orders_*`, `billing_*`) and grant
  narrow DB users per module if your deployment allows it.
- **Events in-process are not durable.** An in-memory `EventBus` loses events on
  crash. For anything that must not be lost, back it with the outbox table plus a
  real queue (Phase 15).
- **Instrument module boundaries:** count and time cross-module calls. A module
  making thousands of calls into another is a sign the split is wrong.
- **Document the map:** a one-page diagram of modules and allowed dependencies,
  kept in the repo, is worth more than any amount of folder discipline.

---

## 9.3 Clean Architecture

### 1. Proper definition

Clean Architecture organises code into concentric layers — entities, use cases,
interface adapters, frameworks and drivers — governed by the **Dependency Rule**:
source-code dependencies may point only inward, toward higher-level policy. Inner
layers define interfaces; outer layers implement them.

### 2. Simple meaning

Business rules sit in the middle and know nothing about Express, MySQL, Stripe or
Redis. Everything external is a plugin that the middle *defines the contract for*
and the outside *implements*.

Layered architecture says "the service depends on the repository."
Clean Architecture says "the service depends on an **interface** it owns, and the
repository implements that interface." One extra step; large consequences.

### 3. Why it is needed

- **Business rules outlive frameworks.** Express will be replaced; the rule that
  an order cannot exceed available credit will not.
- **Tests with zero infrastructure.** Use cases are tested against in-memory
  implementations — no MySQL, no HTTP, no clock, no network.
- **Delayed decisions.** You can build and test the domain before choosing a
  database or a payment provider.
- **Forced clarity.** Writing the interface first makes you state exactly what the
  business needs from storage, which is usually far less than a full ORM surface.

### 4. How it works internally

```
        ┌──────────────────────────────────────┐
        │  Frameworks & Drivers                │  Express, mysql2, Stripe SDK
        │  ┌────────────────────────────────┐  │
        │  │  Interface Adapters            │  │  controllers, repositories,
        │  │  ┌──────────────────────────┐  │  │  presenters, mappers
        │  │  │  Use Cases (Application) │  │  │  PlaceOrder, CancelOrder
        │  │  │  ┌────────────────────┐  │  │  │
        │  │  │  │  Entities (Domain) │  │  │  │  Order, Money, OrderStatus
        │  │  │  └────────────────────┘  │  │  │
        │  │  └──────────────────────────┘  │  │
        │  └────────────────────────────────┘  │
        └──────────────────────────────────────┘
                 dependencies point inward ──▶
```

- **Entities** — the concepts and invariants that would exist even without an
  application (an `Order` cannot have a negative total). Pure TypeScript.
- **Use cases** — application-specific workflows ("place an order"). They
  orchestrate entities and call **ports** (interfaces) they define themselves.
- **Interface adapters** — controllers converting HTTP to use-case input;
  repositories implementing the ports using MySQL; presenters shaping output.
- **Frameworks & drivers** — Express, mysql2, SDKs, cron.

The inversion happens at the use-case boundary: `OrderRepositoryPort` lives
*inside* with the use case; `MySqlOrderRepository` lives *outside* and implements
it. At runtime the dependency flows outward; in source code it points inward.

### 5. Structure and API

```
src/
  domain/
    order.entity.ts
    money.vo.ts
    errors.ts
  application/
    ports/
      order-repository.port.ts
      payment-gateway.port.ts
      clock.port.ts
    use-cases/
      place-order.usecase.ts
  infrastructure/
    persistence/mysql-order.repository.ts
    payments/stripe-payment.gateway.ts
    system/system-clock.ts
  interface/
    http/order.controller.ts
    http/order.routes.ts
  main.ts        ← composition root: the only file that knows all layers
```

### 6. Small example

**Domain entity — pure, no imports from outside**

```ts
// domain/order.entity.ts
import { DomainError } from './errors';

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export class Order {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly total: number,
    private status: OrderStatus,
    public readonly createdAt: Date,
  ) {}

  static place(id: string, userId: string, total: number, now: Date): Order {
    if (total <= 0) throw new DomainError('INVALID_TOTAL', 'Total must be positive');
    return new Order(id, userId, total, 'PENDING', now);
  }

  markPaid(): void {
    if (this.status !== 'PENDING') {
      throw new DomainError('INVALID_TRANSITION', `Cannot pay an order in ${this.status}`);
    }
    this.status = 'PAID';
  }

  cancel(now: Date): void {
    if (this.status === 'PAID') {
      throw new DomainError('ALREADY_PAID', 'Paid orders cannot be cancelled');
    }
    const minutes = (now.getTime() - this.createdAt.getTime()) / 60_000;
    if (minutes > 30) {
      throw new DomainError('WINDOW_EXPIRED', 'Cancellation window has closed');
    }
    this.status = 'CANCELLED';
  }

  get currentStatus(): OrderStatus {
    return this.status;
  }
}
```

The invariants now live on the entity. There is no way to construct an invalid
`Order` and no way to pay a cancelled one, from anywhere in the codebase.

**Ports — owned by the application layer**

```ts
// application/ports/order-repository.port.ts
import type { Order } from '../../domain/order.entity';

export interface OrderRepositoryPort {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
}
```

```ts
// application/ports/clock.port.ts
export interface ClockPort { now(): Date }
```

**Use case**

```ts
// application/use-cases/place-order.usecase.ts
import { Order } from '../../domain/order.entity';
import { DomainError } from '../../domain/errors';
import type { OrderRepositoryPort } from '../ports/order-repository.port';
import type { CreditPort } from '../ports/credit.port';
import type { ClockPort } from '../ports/clock.port';
import type { IdGeneratorPort } from '../ports/id-generator.port';

export interface PlaceOrderInput { userId: string; total: number }
export interface PlaceOrderOutput { orderId: string; status: string }

export class PlaceOrderUseCase {
  constructor(
    private readonly orders: OrderRepositoryPort,
    private readonly credit: CreditPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(input: PlaceOrderInput): Promise<PlaceOrderOutput> {
    const available = await this.credit.availableFor(input.userId);
    if (available < input.total) {
      throw new DomainError('INSUFFICIENT_CREDIT', 'Not enough credit');
    }

    const order = Order.place(this.ids.next(), input.userId, input.total, this.clock.now());
    await this.orders.save(order);

    return { orderId: order.id, status: order.currentStatus };
  }
}
```

No `express`, no `mysql2`, no `Date.now()`, no `uuid` import. Everything variable
is a port.

**Adapter — implements the port**

```ts
// infrastructure/persistence/mysql-order.repository.ts
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { Order } from '../../domain/order.entity';
import type { OrderRepositoryPort } from '../../application/ports/order-repository.port';

export class MySqlOrderRepository implements OrderRepositoryPort {
  constructor(private readonly db: Pool) {}

  async save(order: Order): Promise<void> {
    await this.db.query(
      `INSERT INTO orders (id, user_id, total, status, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status)`,
      [order.id, order.userId, order.total, order.currentStatus, order.createdAt],
    );
  }

  async findById(id: string): Promise<Order | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT id, user_id, total, status, created_at FROM orders WHERE id = ?', [id],
    );
    return rows.length ? OrderMapper.toDomain(rows[0]) : null;
  }
}
```

**Composition root**

```ts
// main.ts
const placeOrder = new PlaceOrderUseCase(
  new MySqlOrderRepository(pool),
  new MySqlCreditAdapter(pool),
  new SystemClock(),
  new UuidGenerator(),
);
app.use(buildOrderRoutes(placeOrder));
```

**The test that justifies all of it**

```ts
it('rejects an order above available credit', async () => {
  const useCase = new PlaceOrderUseCase(
    new InMemoryOrderRepository(),
    { availableFor: async () => 50 },
    { now: () => new Date('2026-01-01T10:00:00Z') },
    { next: () => 'order-1' },
  );

  await expect(useCase.execute({ userId: 'u1', total: 100 }))
    .rejects.toMatchObject({ code: 'INSUFFICIENT_CREDIT' });
});
```

No database, no server, no mocking library, deterministic time, runs in
milliseconds.

### 7. Real backend usage

- Payments, lending, insurance, healthcare — domains with dense rules, long
  lifetimes and regulatory audit needs.
- Any system where the same rules are driven by HTTP, a queue consumer, a batch
  job and a partner webhook.
- Codebases that expect to change infrastructure (self-hosted → managed, MySQL →
  Postgres, one payment provider → several).

### 8. Edge cases

- **Transactions across ports.** The use case must not open a MySQL connection.
  Introduce a `UnitOfWorkPort` with `run(callback)` that the infrastructure
  implements with a real transaction and tests implement as a pass-through.
- **The entity/ORM mismatch.** A rich entity with private state does not map
  cleanly onto ORM models. Accept an explicit mapper layer (`OrderMapper.toDomain` /
  `toPersistence`) rather than decorating entities with ORM annotations.
- **Reads.** Forcing every dashboard query through entities creates pointless
  hydration. Use **CQRS-lite**: commands go through use cases and entities; queries
  go through a separate read-side that returns DTOs directly from SQL.
- **Small services.** For a 6-endpoint CRUD API, Clean Architecture costs more
  than it returns. Layered is the correct answer there.
- **Domain events from entities.** Entities can record events (`order.pullEvents()`)
  which the use case publishes after a successful save — keeping entities pure
  while still emitting events.

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Importing `express`, `mysql2` or an SDK in domain/application | Breaks the Dependency Rule; the whole benefit is gone | Define a port; implement it outside |
| Defining ports in the infrastructure layer | Dependency now points outward — inversion never happened | Ports live with the use cases that need them |
| Anaemic entities (data bags) with all rules in use cases | You have layered architecture with extra folders | Move invariants onto entities |
| `new Date()` / `Math.random()` / `uuid()` inside use cases | Tests become non-deterministic | Inject `ClockPort`, `IdGeneratorPort` |
| One port per ORM method (`findAllWhereX`) | The port becomes a leaky ORM proxy | Ports express business needs, not query shapes |
| Applying it to a CRUD microservice | Ceremony with no payoff; team resents it | Use layered for simple services |
| Mapping the same object four times through four layers | Boilerplate fatigue | Share DTOs where no rule depends on them |

### 10. Interview answer

> Clean Architecture arranges code as concentric layers — entities, use cases,
> adapters, frameworks — with the Dependency Rule that source dependencies point
> only inward. The key move is that the application layer defines the interfaces
> it needs, like an order repository or a payment gateway, and infrastructure
> implements them. So business logic imports nothing from Express or MySQL, and
> use cases can be tested against in-memory fakes with no I/O at all. The cost is
> indirection and mapping code, so I apply it where the domain is rule-dense and
> long-lived, and stick to plain layered architecture for CRUD services.

### 11. Practice problems

1. Model `Order` as an entity with `place`, `markPaid` and `cancel`, and prove
   through tests that no invalid state transition is reachable.
2. Write `PlaceOrderUseCase` with four injected ports and test all failure paths
   with zero I/O.
3. Implement `OrderRepositoryPort` twice — once with MySQL, once in memory — and
   run the same use-case test suite against both.
4. Add `UnitOfWorkPort` so a use case can save an order and debit credit
   atomically without knowing about transactions.
5. Add a `ClockPort` and write a test that cancels an order at 29 minutes
   (succeeds) and 31 minutes (fails) without any waiting.
6. Add a `dependency-cruiser` rule that fails the build if `src/domain` or
   `src/application` imports anything from `src/infrastructure` or `node_modules`
   except types.

### 12. Production considerations

- **Automate the Dependency Rule.** Without a CI check, the first deadline will
  put a `mysql2` import into a use case.
- **Keep the composition root thin and single.** One `main.ts` that builds the
  object graph; consider a DI container (`tsyringe`, `awilix`) only once wiring
  becomes genuinely large.
- **Error translation at the edge:** domain errors carry codes; one HTTP mapper
  converts `INSUFFICIENT_CREDIT` → 409. The domain never mentions status codes.
- **Performance:** hydrating entities for read-heavy endpoints is wasteful. Measure,
  and use the read-side escape hatch deliberately.
- **Team cost is real.** The architecture only pays off if the team understands
  and enforces it. Document the rule in the README in three sentences.

---

## 9.4 Hexagonal Architecture (Ports and Adapters)

### 1. Proper definition

Hexagonal Architecture, introduced by Alistair Cockburn, places the application
core at the centre and connects it to the outside world exclusively through
**ports** (interfaces owned by the core) and **adapters** (implementations owned
by the outside). Ports are classified as **driving/inbound** (the outside calls
the core) and **driven/outbound** (the core calls the outside).

### 2. Simple meaning

The core is a box with sockets. Anything that wants to *use* the application
plugs into an inbound socket (HTTP, CLI, queue consumer, test). Anything the
application *uses* plugs into an outbound socket (MySQL, Stripe, SMTP, Redis).
Swapping any plug changes nothing inside the box.

Hexagonal and Clean Architecture are close relatives — Clean absorbed ports and
adapters wholesale. The distinctive contribution of Hexagonal is the explicit
**symmetry**: inbound and outbound are treated as the same kind of thing, which
is what makes "the test suite is just another driver" fall out naturally.

### 3. Why it is needed

- **Multiple drivers, one core.** HTTP API, gRPC, CLI, Kafka consumer and cron all
  drive the same use cases without duplication.
- **Vendor isolation.** Stripe → Razorpay is an adapter swap.
- **Test symmetry.** Tests drive the core through the inbound port and satisfy
  outbound ports with fakes — the same mechanism production uses.
- **Explicit external surface.** Listing the ports gives you a complete inventory
  of every external system you depend on. That is a genuinely useful artefact for
  reliability planning.

### 4. How it works internally

```
   DRIVING SIDE (inbound)              CORE                OUTBOUND (driven)

   HTTP controller ──┐                                ┌──▶ MySqlOrderRepository
   CLI command    ───┼──▶ [ inbound port ]  APP  [ outbound ports ] ──▶ StripeGateway
   Queue consumer ───┤      PlaceOrder      CORE      OrderRepoPort   ──▶ SesMailer
   Test driver    ───┘                                └──▶ InMemoryRepo (tests)
```

- **Inbound port** — the interface the core exposes: `PlaceOrderPort` with
  `execute(input): Promise<output>`. Adapters (Express controller, CLI) call it.
- **Outbound port** — the interface the core requires: `OrderRepositoryPort`,
  `PaymentGatewayPort`. Adapters (MySQL, Stripe) implement it.
- Both interfaces are **defined inside the core**. This is the whole trick: the
  core never names a concrete external thing.

### 5. Structure and API

```
src/
  core/
    domain/            entities, value objects
    ports/
      inbound/place-order.port.ts
      outbound/order-repository.port.ts
      outbound/payment-gateway.port.ts
    services/place-order.service.ts   ← implements the inbound port
  adapters/
    inbound/
      http/order.controller.ts
      cli/place-order.command.ts
      queue/order-consumer.ts
    outbound/
      mysql/mysql-order.repository.ts
      stripe/stripe-payment.gateway.ts
      memory/in-memory-order.repository.ts   ← test adapter
  main.ts
```

### 6. Small example

**Inbound port**

```ts
// core/ports/inbound/place-order.port.ts
export interface PlaceOrderCommand { userId: string; total: number; currency: string }
export interface PlaceOrderResult { orderId: string; status: string }

export interface PlaceOrderPort {
  execute(command: PlaceOrderCommand): Promise<PlaceOrderResult>;
}
```

**Outbound port**

```ts
// core/ports/outbound/payment-gateway.port.ts
export interface ChargeRequest { amount: number; currency: string; customerRef: string }
export interface ChargeResult { reference: string; succeeded: boolean }

export interface PaymentGatewayPort {
  charge(req: ChargeRequest): Promise<ChargeResult>;
}
```

**Core service implementing the inbound port**

```ts
// core/services/place-order.service.ts
import { Order } from '../domain/order.entity';
import type { PlaceOrderPort, PlaceOrderCommand, PlaceOrderResult } from '../ports/inbound/place-order.port';
import type { OrderRepositoryPort } from '../ports/outbound/order-repository.port';
import type { PaymentGatewayPort } from '../ports/outbound/payment-gateway.port';
import type { ClockPort } from '../ports/outbound/clock.port';
import type { IdGeneratorPort } from '../ports/outbound/id-generator.port';

export class PlaceOrderService implements PlaceOrderPort {
  constructor(
    private readonly orders: OrderRepositoryPort,
    private readonly payments: PaymentGatewayPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(cmd: PlaceOrderCommand): Promise<PlaceOrderResult> {
    const order = Order.place(this.ids.next(), cmd.userId, cmd.total, this.clock.now());
    await this.orders.save(order);

    const charge = await this.payments.charge({
      amount: cmd.total,
      currency: cmd.currency,
      customerRef: cmd.userId,
    });

    if (charge.succeeded) {
      order.markPaid();
      await this.orders.save(order);
    }

    return { orderId: order.id, status: order.currentStatus };
  }
}
```

**Three inbound adapters, one core**

```ts
// adapters/inbound/http/order.controller.ts
export const makeOrderController = (placeOrder: PlaceOrderPort) => ({
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cmd = placeOrderSchema.parse(req.body);
      const result = await placeOrder.execute(cmd);
      res.status(201).json({ data: result });
    } catch (err) { next(err); }
  },
});
```

```ts
// adapters/inbound/cli/place-order.command.ts
export async function runPlaceOrder(placeOrder: PlaceOrderPort, argv: string[]) {
  const result = await placeOrder.execute({
    userId: argv[0], total: Number(argv[1]), currency: argv[2] ?? 'INR',
  });
  console.log(`Order ${result.orderId} → ${result.status}`);
}
```

```ts
// adapters/inbound/queue/order-consumer.ts
export const makeOrderConsumer = (placeOrder: PlaceOrderPort) =>
  async (message: { userId: string; total: number; currency: string }) => {
    await placeOrder.execute(message);
  };
```

**Outbound adapter**

```ts
// adapters/outbound/stripe/stripe-payment.gateway.ts
export class StripePaymentGateway implements PaymentGatewayPort {
  constructor(private readonly stripe: Stripe) {}

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(req.amount * 100),
      currency: req.currency.toLowerCase(),
      customer: req.customerRef,
      confirm: true,
    });
    return { reference: intent.id, succeeded: intent.status === 'succeeded' };
  }
}
```

Swapping to Razorpay means writing one new class implementing the same port and
changing one line in `main.ts`. The core is untouched and its tests still pass.

### 7. Real backend usage

- A payments core driven by a public API, an admin panel, a reconciliation cron
  and a webhook receiver.
- An integration-heavy service with adapters for several providers selected by
  tenant configuration at runtime.
- Systems that must be certified/audited, where "what external systems does this
  touch?" must be answerable by listing outbound ports.

### 8. Edge cases

- **Leaky ports.** A port returning `Stripe.PaymentIntent` has leaked the vendor
  into the core. Ports must use core-owned types only.
- **Partial failure.** Order saved, charge times out, response never arrives. The
  port needs to model this — return an explicit `PENDING` result, make `charge`
  idempotent with a key, and reconcile later. Hexagonal does not remove
  distributed-failure design; it just gives it a clean place to live (Phase 13).
- **Transactions spanning outbound ports.** Same answer as 9.3: a
  `UnitOfWorkPort` or transactional outbox. Never a raw connection in the core.
- **Runtime adapter selection.** Multiple implementations of one port chosen per
  tenant: use a factory (`PaymentGatewayFactory.for(tenant)`) injected as a port
  rather than `if (provider === 'stripe')` inside the core.
- **Port explosion.** Twelve ports for a small service means the boundary is drawn
  too finely. Group by external capability, not by method.

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Vendor types in port signatures | Core is coupled to the SDK despite the interface | Define core-owned request/response types |
| Ports declared in the adapter folder | Inversion never happens | Ports live in `core/ports` |
| Core service importing an adapter for "just one thing" | One import destroys the boundary | Add a port for it |
| Skipping the inbound port ("the controller just calls the service") | Works, but you lose the symmetry and the explicit contract | Keep the inbound interface; it documents the use case |
| Treating hexagonal as a folder layout | Folders without enforcement decay in weeks | Enforce in CI |
| Adding ports for things that will never change (e.g. `lodash`) | Pure ceremony | Port only genuine external dependencies: I/O, time, randomness, network |

### 10. Interview answer

> Hexagonal architecture, or ports and adapters, puts the application core in the
> middle and connects everything external through interfaces the core owns.
> Inbound ports are what drives the core — HTTP controllers, CLI, queue
> consumers, tests — and outbound ports are what the core drives, like a
> repository or a payment gateway. Both interfaces are defined inside the core, so
> the core never imports a framework or an SDK, and swapping Stripe for Razorpay
> is a new adapter plus one line in the composition root. It's very close to Clean
> Architecture; the emphasis is the symmetry between driving and driven sides,
> which is what lets the test suite act as just another driver.

### 11. Practice problems

1. Define `PlaceOrderPort` (inbound) and drive it from three adapters: an Express
   route, a CLI script and a queue consumer. Share zero logic between them.
2. Implement `PaymentGatewayPort` twice (a fake and one real SDK) and switch via
   an environment variable with no core changes.
3. Write an integration test where the inbound adapter is the test itself and all
   outbound adapters are in-memory. Measure the suite runtime.
4. Introduce an idempotency key into `ChargeRequest` and make the fake gateway
   return the same result for a repeated key.
5. Add a `NotificationPort` and implement email and SMS adapters; select by tenant
   configuration through a factory.
6. Audit an existing project: list every external system it touches and turn each
   into an outbound port. Note which ones were previously invisible.

### 12. Production considerations

- **Ports are your reliability inventory.** Every outbound port is a thing that can
  be slow, fail or rate-limit. Give each adapter a timeout, retry policy and
  circuit breaker (Phase 13) — in the adapter, not the core.
- **Instrument adapters**, not the core: latency and error rate per external
  dependency, tagged by adapter name.
- **Contract tests** for each adapter: run the same suite against the real
  implementation (in CI, nightly, against a sandbox) and the fake, so the fake
  cannot silently drift from reality.
- **Configuration and secrets** belong in adapters and the composition root; the
  core should not read `process.env`.
- **Graceful degradation:** when an outbound adapter fails, the core should get a
  typed error it can reason about, not a raw SDK exception.

---

## Choosing Between Them

These are not four competing options — they are four points on one line, each
adding a constraint to the previous.

| | Layered | Modular Monolith | Clean | Hexagonal |
|---|---|---|---|---|
| Primary unit | Technical layer | Feature module | Concentric layer | Core + ports |
| Business logic lives in | Service | Module's application layer | Entities + use cases | Core services + entities |
| Depends on framework/DB? | Yes (service → concrete repo) | Usually | No | No |
| Interfaces owned by | — | Module | Application layer | Core |
| Test without I/O | Partly | Partly | Fully | Fully |
| Indirection cost | Low | Low–medium | High | High |
| Best for | CRUD APIs, small teams, MVPs | Growing products, multiple teams | Rule-dense, long-lived domains | Integration-heavy, multi-driver systems |

**A practical progression:**

1. Start **layered** inside **feature modules**. This combination — modular
   monolith with layers inside each module — is the right default for roughly 90%
   of Node backends and is what most good production codebases actually look like.
2. When one module becomes rule-dense (pricing, billing, entitlements), promote
   *that module* to Clean/Hexagonal. Architecture can vary per module; it does not
   have to be uniform.
3. Extract a module into a service only when driven by a concrete force:
   independent scaling, independent deploy cadence, team autonomy, or a hard
   isolation requirement.

**The test that tells you if you got it right:** open the file containing your
most important business rule. If it imports `express` or `mysql2`, your
architecture is decorative. If it imports neither, it is real — whatever you call it.

---

## Phase 9 Completion Checklist

You are done with this phase when you can:

- [ ] Refactor a fat Express route into controller/service/repository without
      changing behaviour.
- [ ] State where a transaction boundary belongs and implement it without leaking
      a connection into business code.
- [ ] Explain why a cross-module SQL join is a boundary violation and what to do
      instead.
- [ ] Split an app into feature modules with enforced public interfaces.
- [ ] Replace a direct cross-module call with a domain event and explain the
      trade-off.
- [ ] Write a use case whose test runs with no database, no server and no
      real clock.
- [ ] Explain the Dependency Rule and demonstrate inversion with a port and two
      adapters.
- [ ] Distinguish inbound from outbound ports and drive one core from three
      different adapters.
- [ ] Add a CI rule that fails the build when an architectural boundary is
      crossed.
- [ ] Argue convincingly for *not* using Clean Architecture on a given project.

**Next:** Phase 10 — Low-Level Design (OOP, SOLID, design patterns). Phase 9 gave
you the shape of the system; Phase 10 gives you the shape of the classes inside it.

# Phase 20 — Testing

**Stack context:** Node.js, TypeScript, Express, MySQL — examples use Jest/Vitest
syntax (interchangeable for these purposes) and Supertest
**Prerequisite:** Phases 9 (architecture), 10 (LLD), 12 (API design), 13 (error
handling), 14 (caching)
**Priority:** MUST KNOW

---

## What This Phase Is Really About

Every phase before this one produced code that is *supposed* to work. This
phase is how you find out whether it actually does, and — more importantly —
whether it will *keep* working after the next fifty changes someone else makes
to it.

The single idea underneath this entire phase: **a test's value is proportional
to how confidently it lets you change code.** A test suite that passes but
doesn't catch real bugs is decoration. A test suite so brittle that every
refactor breaks ten unrelated tests actively punishes good engineering — people
stop refactoring, and the codebase rots. Good testing is not "write tests for
everything"; it is choosing, deliberately, **what to test at which level**, so
that the suite tells you the truth fast and stays out of your way otherwise.

This is also where Phase 9's architecture pays its dividend directly. A service
with SQL and `req`/`res` baked into it cannot be unit tested at all — you're
forced into slow, brittle, full-stack tests for even the simplest business rule.
A service built against ports, the way Phase 9 and Phase 10 describe, can be
tested in milliseconds with no database, no server, no network. Every example
in this phase leans on that architecture being in place.

---

## 20.1 The Testing Pyramid and Test Types

### 1. Proper definition

The testing pyramid is a heuristic for how many tests to write at each level of
a system: many fast, narrow **unit tests** at the base; fewer, broader
**integration tests** in the middle; very few, slow, full-system **end-to-end
tests** at the top. **Contract tests** sit alongside this as a fourth type
verifying the boundary between two independently-deployed services.

### 2. Simple meaning

Not all tests are equal. A unit test runs in milliseconds and tells you exactly
which function broke. An end-to-end test runs in minutes, touches a real
browser, a real API, a real database, and when it fails it tells you something
is wrong *somewhere* in the whole stack. You want mostly the first kind and very
little of the second, because the second kind is what makes a CI pipeline take
40 minutes and flake once a week for reasons nobody can reproduce.

### 3. Why it is needed

- **Speed drives usage.** A unit suite that runs in 5 seconds gets run on every
  save. A suite that takes 20 minutes gets run before every commit, or worse,
  only in CI — bugs are caught later, when they're more expensive to fix.
- **Isolation drives diagnosis.** When a unit test fails, you know the exact
  function. When an E2E test fails, you're debugging the whole request path.
- **The pyramid shape prevents the two failure modes.** Too many E2E tests:
  slow, flaky, expensive CI, developers start skipping or ignoring red builds.
  Too few tests of any kind below the UI: bugs reach production because nothing
  exercised the business logic directly.

### 4. How it works — the four types, precisely

**Unit tests** — test one unit (a function, a class, a use case) in complete
isolation, with every collaborator replaced by a test double (20.2). No
database, no network, no filesystem, no real clock unless explicitly under test.

```ts
// order.service.test.ts — testing PlaceOrderUseCase from Phase 9/10, zero I/O
describe('PlaceOrderUseCase', () => {
  it('rejects an order that exceeds available credit', async () => {
    const orders = new InMemoryOrderRepository();
    const credit: CreditPort = { availableFor: async () => 50 };
    const clock: ClockPort = { now: () => new Date('2026-01-01T10:00:00Z') };
    const ids: IdGeneratorPort = { next: () => 'order-1' };

    const useCase = new PlaceOrderUseCase(orders, credit, clock, ids);

    await expect(useCase.execute({ userId: 'u1', total: 100 }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_CREDIT' });
  });

  it('saves the order when credit is sufficient', async () => {
    const orders = new InMemoryOrderRepository();
    const useCase = new PlaceOrderUseCase(
      orders,
      { availableFor: async () => 500 },
      { now: () => new Date('2026-01-01T10:00:00Z') },
      { next: () => 'order-1' },
    );

    const result = await useCase.execute({ userId: 'u1', total: 100 });

    expect(result.status).toBe('PENDING');
    expect(await orders.findById('order-1')).not.toBeNull();
  });
});
```

No `beforeEach` spinning up a database, no `supertest`, no port binding. This
test would run in well under a millisecond and can run thousands of times per
second — this is what makes TDD (Phase 0/10) practical at all.

**Integration tests** — test that two or more real components work together
correctly: your repository against a **real** database, your HTTP layer against
a **real** Express app, your cache client against a **real** Redis. The point is
verifying the seam that a unit test, with its fakes, cannot see — a repository's
SQL might be syntactically wrong, or your ORM's mapping might not match your
actual schema, and no amount of unit testing with an in-memory fake catches
that.

```ts
// order.repository.integration.test.ts — real MySQL, via Testcontainers
describe('MySqlOrderRepository', () => {
  let container: StartedMySqlContainer;
  let pool: Pool;
  let repository: MySqlOrderRepository;

  beforeAll(async () => {
    container = await new MySqlContainer('mysql:8.4').start();
    pool = createPool({ uri: container.getConnectionUri() });
    await runMigrations(pool);
    repository = new MySqlOrderRepository(pool);
  }, 60_000);

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE orders');
  });

  it('persists and retrieves an order', async () => {
    const order = Order.place('order-1', 'user-1', 100, new Date());
    await repository.save(order);

    const found = await repository.findById('order-1');

    expect(found?.total).toBe(100);
    expect(found?.currentStatus).toBe('PENDING');
  });
});
```

**End-to-end (E2E) tests** — exercise the whole system through its real
external interface: real HTTP calls against a running (or fully in-process)
application, a real database, real auth — as close to what a genuine client
experiences as practical.

```ts
// checkout.e2e.test.ts
describe('POST /orders (E2E)', () => {
  it('places an order end to end', async () => {
    const token = await loginAsTestUser(app);

    const response = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ sku: 'ABC', quantity: 2 }] });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('PENDING');

    const stored = await db.query('SELECT * FROM orders WHERE id = ?', [response.body.data.id]);
    expect(stored[0].user_id).toBe(testUser.id);
  });
});
```

**Contract tests** — verify that a producer service's API and a consumer
service's expectations of it agree, **without either running the other**. The
classic tool is Pact: the consumer records the requests it makes and the
responses it expects, producing a contract file; the producer replays that
contract against its own real implementation in its own CI pipeline.

```ts
// consumer side — records expectations, generates a pact file
describe('Order service client (consumer contract)', () => {
  const provider = new PactV3({ consumer: 'checkout-service', provider: 'inventory-service' });

  it('expects a 200 with stock info for a known SKU', () => {
    provider
      .given('SKU ABC has stock')
      .uponReceiving('a request for stock level')
      .withRequest({ method: 'GET', path: '/inventory/ABC' })
      .willRespondWith({ status: 200, body: { sku: 'ABC', available: 42 } });

    return provider.executeTest(async (mockServer) => {
      const client = new InventoryClient(mockServer.url);
      const result = await client.getStock('ABC');
      expect(result.available).toBe(42);
    });
  });
});
```

The inventory service's own CI then runs the generated pact file against its
real implementation, and fails its build if the real API no longer matches what
checkout-service expects — catching a breaking change **before deployment**,
without either service standing up the other.

### 5. The pyramid, with rough guidance

```
        ▲
       /E2E\          a handful — critical user journeys only
      /------\
     /Integr. \       moderate — every external boundary (DB, cache, queue)
    /----------\
   /   Unit     \     the majority — all business logic, all edge cases
  /--------------\
```

A commonly cited rough split: 70% unit, 20% integration, 10% E2E — treat it as a
shape to aim for, not a rule to enforce mechanically.

### 6. Small example — one requirement tested at three levels

Requirement: "an order cannot be cancelled more than 30 minutes after placement."

- **Unit** (many cases, milliseconds each): 29 minutes succeeds, 31 minutes
  throws, exactly 30 minutes — pick and document a boundary, already-cancelled
  throws a different error. All against `Order.cancel()` directly with an
  injected clock. This is where the *business rule* is actually verified.
- **Integration** (one or two cases): the repository correctly persists and
  reloads the cancelled state, and the clock/timestamp round-trips through the
  real database's datetime precision correctly.
- **E2E** (one case): `POST /orders/{id}/cancel` returns `200` and the order
  disappears from `GET /orders` — proving the whole path is wired together, not
  re-proving the 30-minute boundary logic again.

This is the pyramid in practice: the *exhaustive* case coverage lives at the
unit level because it's cheap there; the higher levels each add only what they
uniquely can verify.

### 7. Real backend usage

- Every service/use-case class from Phase 9/10: unit-tested with fakes.
- Every repository implementation: integration-tested against a real database.
- Checkout, login, and payment flows: E2E-tested as the handful of critical
  journeys.
- Any two independently-deployed services communicating over HTTP: contract
  tested, so a breaking change is caught in the producer's CI before it reaches
  the consumer in production.

### 8. Edge cases

- **A test that could be a unit test but is written as an integration test**
  (spinning up a database to test a pure validation rule) — slow for no reason;
  push the rule down to where it can be tested without I/O.
- **A bug that only integration tests would catch** — a repository method whose
  SQL has a typo in a column name. Every unit test using the in-memory fake
  passes; only the real-database integration test catches it. This is *why*
  integration tests exist despite unit tests being cheaper — they test a
  different, real risk.
- **Flaky E2E tests** — usually caused by unmanaged async timing, shared test
  data between tests, or real network calls to third parties. Each of these has
  a specific fix (20.3, 20.2) rather than "just retry it."

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Inverted pyramid — mostly E2E tests | Slow CI, flaky, hard to diagnose failures | Push logic-level assertions down to unit tests |
| Business logic untestable without a database | Architecture problem (Phase 9), not a testing one | Extract to a use case behind ports |
| Treating integration tests as "unit tests but slower" | Duplicates what unit tests already cover, adds nothing | Integration tests should target the seam specifically — the DB, the cache, the queue |
| No contract tests between services that change independently | Breaking changes reach production before anyone notices | Add Pact (or equivalent) at the service boundary |
| Writing E2E tests for every edge case | Extremely slow suite for marginal benefit | Reserve E2E for critical paths; edge cases belong at the unit level |

### 10. Interview answer

> I think about tests by what they uniquely verify, not by a percentage target.
> Business logic — every edge case, every branch — gets unit tested against fakes,
> because that's where exhaustive coverage is cheap and fast. Integration tests
> target the seams a unit test's fakes can't see — does this repository's SQL
> actually work against a real MySQL schema, does this cache client actually talk
> to Redis correctly. E2E tests are reserved for a small number of critical user
> journeys, proving the whole system is wired together, not re-verifying business
> rules already covered at the unit level. And when two services are deployed
> independently, I add contract tests at that boundary specifically, because
> that's the one kind of breaking change neither unit nor E2E tests inside one
> service can catch.

### 11. Practice problems

1. Take a service with SQL embedded directly in a route handler and refactor it
   until the business rule can be unit tested with zero I/O (this is Phase 9's
   refactor, revisited from the testing side).
2. Write the three-level test set for the "cancel within 30 minutes" example
   above, and time how long each level takes to run.
3. Set up Testcontainers (or an equivalent) for a real MySQL integration test
   suite, with truncation between tests.
4. Write a consumer-side Pact contract for a call your service makes to another
   service, and explain what production incident it would have caught.
5. Deliberately invert the pyramid on a small project (mostly E2E), measure the
   suite's runtime, then rebalance it and measure again.

### 12. Production considerations

- **Run unit tests on every save**, integration tests on every push, E2E tests
  on every PR/merge to main — tiered by speed, not run identically everywhere.
- **Track suite runtime over time**, not just pass/fail — a creeping CI time is a
  leading indicator the pyramid has inverted.
- **Quarantine flaky tests immediately** (mark and track, don't delete) rather
  than letting the team learn to ignore red builds — a suite people don't trust
  is worse than no suite.
- **Contract tests belong in both services' CI pipelines** — the consumer's for
  defining expectations, the producer's for verifying it still meets them.

---

## 20.2 Test Doubles — Mocking, Stubbing, and Fixtures

### 1. Proper definition

A **test double** is any object that stands in for a real dependency during a
test. The term is a family; the specific kinds have precise, commonly-confused
meanings.

### 2. Simple meaning

You cannot unit test `PlaceOrderUseCase` against a real database and a real
payment gateway and call it a unit test — that's an integration or E2E test
wearing a unit test's clothes. Test doubles are what let you replace those real
things with something small, fast, and under your control.

### 3. Why it is needed

- **Speed and determinism** — a fake in-memory repository has no network, no
  disk, no flakiness.
- **Isolation** — a failing unit test should point at exactly one unit, which
  requires every collaborator to be predictable, not real.
- **Testing failure paths that are hard to trigger for real** — "the payment
  gateway times out" is trivial with a stub, painful to reproduce with the real
  Stripe sandbox.

### 4. How it works — the five kinds, precisely

| Kind | What it does | Verifies |
|---|---|---|
| **Dummy** | Passed but never actually used — satisfies a parameter list | Nothing — it's a placeholder |
| **Stub** | Returns pre-programmed answers to calls | State — "given this input, is the output right?" |
| **Spy** | A stub that also records how it was called | Interaction — "was this called, how many times, with what?" |
| **Mock** | Pre-programmed with *expectations*, and fails the test if unmet | Interaction, verified automatically, often strict about exact calls |
| **Fake** | A real, working, simplified implementation | Behaviour — closest to the real thing, without the real thing's cost |

The distinction between **mocking** and **stubbing**, which people conflate
constantly: a **stub** just returns data — you assert on what your code under
test *does with* that data. A **mock** additionally asserts on how it was
*called* — you assert directly on the interaction itself.

```ts
// STUB — just returns data; you assert on behaviour that follows
const paymentGateway: PaymentGateway = {
  charge: async () => ({ reference: 'ch_1', succeeded: true }),
};
const result = await checkoutService.checkout(order, paymentGateway);
expect(result.status).toBe('PAID');   // asserting on the OUTCOME

// MOCK — asserts on the interaction itself
const chargeSpy = jest.fn().mockResolvedValue({ reference: 'ch_1', succeeded: true });
const paymentGateway: PaymentGateway = { charge: chargeSpy };
await checkoutService.checkout(order, paymentGateway);
expect(chargeSpy).toHaveBeenCalledWith({ amount: 100, currency: 'INR', ref: order.id });
expect(chargeSpy).toHaveBeenCalledTimes(1);   // asserting on the CALL

// FAKE — a real, simplified, working implementation
class InMemoryOrderRepository implements OrderRepository {
  #orders = new Map<string, Order>();
  async save(order: Order) { this.#orders.set(order.id, structuredClone(order)); }
  async findById(id: string) { return this.#orders.get(id) ?? null; }
}
```

**Fakes are generally the best default for repositories and other stateful
ports** — they behave like the real thing (save then find actually round-trips)
rather than requiring you to program every expected call, and they're reusable
across every test that needs an `OrderRepository`, rather than reprogrammed
per-test like a stub. Reach for a stub or mock when the collaborator is
stateless (a payment gateway, a clock, an ID generator) or when the *interaction
itself* is what you're testing (did we actually call `sendEmail` exactly once?).

### 5. Fixtures and test data builders

A **fixture** is a known, fixed piece of test data set up before a test runs.
The naive form — hand-constructing a full object literal per test — becomes
unreadable fast:

```ts
// Naive — unreadable, and every test repeats the irrelevant fields
const order = {
  id: 'o1', userId: 'u1', status: 'PENDING', total: 100,
  createdAt: new Date(), items: [{ sku: 'A', quantity: 1, price: 100 }],
  shippingAddress: { line1: '...', city: '...', /* ... */ },
};
```

The fix is a **test data builder** (Phase 10's Builder pattern, applied to test
data) with sensible defaults, overridden only where the test cares:

```ts
class OrderBuilder {
  #order: Partial<Order> = { status: 'PENDING', total: 100, items: [aLine()] };

  withStatus(status: OrderStatus): this { this.#order.status = status; return this; }
  withTotal(total: number): this { this.#order.total = total; return this; }
  withItems(items: OrderLine[]): this { this.#order.items = items; return this; }
  paid(): this { return this.withStatus('PAID'); }

  build(): Order { return Order.reconstitute({ id: 'test-order', ...this.#order } as Order); }
}

const anOrder = () => new OrderBuilder();

// Every test now reads as "what's different about this case"
it('rejects cancelling a paid order', async () => {
  const order = anOrder().paid().build();
  expect(() => order.cancel(new Date())).toThrow('ALREADY_PAID');
});
```

This is worth the up-front investment on any domain object that appears in more
than a handful of tests — the readability gain compounds every time someone adds
a new test.

### 7. Real backend usage

- `InMemoryOrderRepository` / `InMemoryUserRepository` fakes reused across an
  entire unit test suite.
- A stubbed `ClockPort` making time-dependent logic (Phase 10's 30-minute
  cancellation window) deterministic instead of `sleep()`-based and flaky.
- A mock verifying a `NotificationService.send()` call happened exactly once
  after a specific domain event, without a real SMTP server anywhere in sight.

### 8. Edge cases

- **Over-mocking.** A test with fifteen mocked method calls, each asserted
  individually, becomes a change-detector for implementation details rather than
  a test of behaviour — it breaks on *any* refactor even when the observable
  behaviour is unchanged. If a test needs that many mocks, the unit under test
  likely has too many responsibilities (Phase 10's SRP, again).
- **Fakes drifting from reality.** An `InMemoryOrderRepository` that allows
  saving two orders with the same ID, when the real MySQL table has a primary
  key constraint that would reject it — the fake is lying, and tests built on it
  give false confidence. Mitigate with **contract tests between the fake and the
  real implementation**: run the identical test suite against both (Phase 9.3's
  practice problem does exactly this) so drift is caught immediately.
- **Stubbing the thing you're actually trying to test.** Stubbing out the very
  validation logic under test defeats the point — be precise about which
  collaborator is being doubled and which is the actual subject.

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Using "mock" for every kind of test double | Miscommunication about what's actually being verified | Use the precise term — stub, mock, fake, spy |
| Asserting on internal calls that aren't the actual requirement | Brittle tests that break on harmless refactors | Assert on observable outcomes by default; assert on interaction only when the interaction itself is the requirement |
| A fake that doesn't enforce the same invariants as the real thing | False confidence; bugs the real DB would reject slip through | Run the same test suite against fake and real implementations |
| Rebuilding full object literals in every test | Unreadable, high-maintenance test files | Test data builders with sensible defaults |
| Mocking types you don't own (framework internals, third-party SDKs, deep into their internals) | Extremely brittle, breaks on every dependency upgrade | Wrap the dependency in your own port/adapter (Phase 9/10) and mock *that* instead |

### 10. Interview answer

> I distinguish stubs from mocks precisely: a stub returns canned data and I
> assert on what my code does with it — the outcome; a mock additionally
> verifies the interaction itself — that a call happened, with what arguments,
> how many times. I default to fakes for stateful dependencies like repositories,
> because a real, simplified, in-memory implementation behaves like the actual
> thing rather than requiring me to program every expected call, and I run the
> same test suite against the fake and the real implementation so they can't
> silently drift apart. I'm careful about over-mocking — a test asserting on
> ten internal calls is really testing implementation details, and it breaks on
> every harmless refactor, which is the opposite of what a good test suite
> should do.

### 11. Practice problems

1. Write an `InMemoryOrderRepository` fake and a Pact-style shared test suite
   that runs against both it and a real `MySqlOrderRepository`, proving they
   behave identically for save/find/not-found cases.
2. Take a test with five or more mocked method calls and refactor the unit under
   test until it needs at most two collaborators.
3. Build a test data builder for a domain object in your own codebase and
   migrate three existing tests to use it.
4. Write one test using a stub (asserting on outcome) and one using a mock
   (asserting on interaction) for the same scenario, and explain in a comment
   why each style was the right choice for that specific case.

### 12. Production considerations

- **Fakes are a shared, maintained artefact** — put them in a `test/fakes/`
  folder, review changes to them as carefully as production code, since a bug in
  a fake produces false confidence across the whole suite.
- **Prefer asserting on outcomes over call counts** as the default house style;
  reserve interaction-verification for cases where the side effect *is* the
  requirement (an email must be sent, a webhook must fire).
- **Never let a mocking library reach into third-party or framework internals**
  — wrap the dependency in your own interface first (this is Phase 10's Adapter
  earning its keep specifically for testability).

---

## 20.3 Test Data Management and Database Test Isolation

### 1. Proper definition

Test data management is the discipline of ensuring every test starts from a
known state and leaves no residue that affects any other test. Database test
isolation is the specific set of techniques for achieving this when a real
database is involved.

### 2. Simple meaning

Tests that share state — a database row created by test A that test B
accidentally depends on, or is broken by — are the single largest source of
"passes alone, fails in the suite" bugs and flaky CI. The fix is making every
test independently reproducible, in any order, run any number of times.

### 3. Why it is needed

- **Order independence.** A suite where test order matters is a suite that will
  eventually fail mysteriously when a test is added, removed, or parallelised.
- **Repeatability.** A test that passes once and fails on rerun (because it
  created a row the second run's `INSERT` now conflicts with) cannot be trusted.
- **Parallel execution.** Modern CI runs test files in parallel for speed — two
  files touching the same database rows will interfere unless properly isolated.

### 4. How it works — the isolation strategies, ranked by strength and cost

**Transaction rollback (fastest, most common for integration tests):** wrap each
test in a transaction, and roll it back afterward — nothing the test did is ever
actually committed.

```ts
let connection: Connection;

beforeEach(async () => {
  connection = await pool.getConnection();
  await connection.beginTransaction();
  repository = new MySqlOrderRepository(connection);   // this connection, not the pool
});

afterEach(async () => {
  await connection.rollback();
  connection.release();
});
```

The one sharp edge: code under test that itself calls `COMMIT` (or opens its own
connection from the pool rather than using the one handed to it) defeats this —
every layer in the call path must accept an injected connection (Phase 9's
Unit-of-Work pattern is what makes this consistently possible).

**Truncate/reset between tests (simple, a bit slower):**

```ts
afterEach(async () => {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE order_items');
  await pool.query('TRUNCATE TABLE orders');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
});
```

Simpler to reason about than transaction rollback (no connection-plumbing
requirement) but slower at scale, and truncation order must respect foreign
keys.

**A fresh containerised database per test run (strongest isolation, slower
start-up, no isolation *between* tests in the same run unless combined with one
of the above):**

```ts
// Testcontainers spins up a real, disposable MySQL for the whole test file
beforeAll(async () => {
  container = await new MySqlContainer('mysql:8.4').start();
  pool = createPool({ uri: container.getConnectionUri() });
  await runMigrations(pool);
}, 60_000);

afterAll(async () => container.stop());
```

**In practice, combine them**: one container per test file (or per CI job),
transaction rollback (or truncation) between individual tests within that file.

**Test data builders and factories** (20.2) apply here too, specifically for
seeding realistic rows:

```ts
async function aTestUser(overrides: Partial<UserRow> = {}): Promise<UserRow> {
  const defaults = { id: randomUUID(), email: `${randomUUID()}@test.com`, credit: 1000 };
  const row = { ...defaults, ...overrides };
  await pool.query('INSERT INTO users SET ?', row);
  return row;
}

it('rejects an order exceeding credit', async () => {
  const user = await aTestUser({ credit: 50 });
  const response = await placeOrder(user.id, 100);
  expect(response.status).toBe(409);
});
```

Note the **randomised unique fields** (`randomUUID()` for both ID and email) —
this is what makes tests safe to run in parallel and repeatedly without
colliding on a unique constraint.

### 8. Edge cases

- **Autoincrement IDs leaking across tests.** If tests assert on a specific
  numeric ID, they've coupled themselves to execution order and prior test
  runs. Assert on returned/generated IDs, never hardcoded ones.
- **Seed data shared across an entire suite** ("the test database always has
  user #1") is a common but fragile shortcut — one test mutating that row breaks
  every other test relying on its original state. Prefer building exactly the
  data each test needs.
- **Time-dependent data.** A test asserting `createdAt` is "today" becomes
  flaky at midnight UTC in CI. Inject a clock (20.1/20.2) rather than relying on
  the real one.
- **Timezone mismatches** between the test runner and the database container —
  a classic source of "off by a few hours" flakiness. Pin both explicitly (e.g.
  `TZ=UTC` for the container and the test process).

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Tests depending on execution order | Passes locally, fails in CI or when parallelised | Every test builds its own data |
| Shared mutable fixtures across a whole suite | One test's mutation breaks unrelated tests | Fresh data per test, randomised unique fields |
| Asserting on hardcoded autoincrement IDs | Coupled to run history | Assert on the ID actually returned |
| No cleanup after a failing test | State leaks into the next test | Use `afterEach`, not just `afterAll` |
| One shared long-lived test database across all CI jobs | Parallel jobs corrupt each other's data | A fresh container per job, or strict per-test isolation |

### 10. Interview answer

> Every test needs to build the exact data it depends on and clean up after
> itself, so tests are safe in any order, in parallel, and on rerun. For
> integration tests against a real database, I wrap each test in a transaction
> and roll it back afterward — nothing is ever actually committed — which
> requires the code under test to accept an injected connection rather than
> grabbing its own from the pool. Where that's not practical, truncation between
> tests works too. I never rely on shared seed data or hardcoded IDs; test data
> builders with randomised unique fields mean tests can run in parallel without
> colliding.

### 11. Practice problems

1. Implement transaction-rollback isolation for a repository test suite, then
   deliberately break it (call `COMMIT` inside the code under test) and observe
   the resulting test pollution.
2. Convert a suite relying on shared seed data to one where every test builds
   its own data, and run the suite in a randomised order to prove independence.
3. Set up parallel test execution (Jest's `--maxWorkers`) against a containerised
   database and fix any collisions that appear.

### 12. Production considerations

- **CI should run test files in parallel by default** — isolation failures found
  in CI are much cheaper than isolation failures found in production data drift.
- **Never point tests at a shared staging or production database** — an isolated,
  disposable database per run is non-negotiable, however inconvenient it feels
  early on.
- **Seed migrations and test migrations should be the same migrations that run
  in production** (Phase 6) — a test database with a hand-maintained, drifted
  schema catches nothing real.

---

## 20.4 API, Load, Security, and Failure Testing

### API Testing

**1. Proper definition.** Testing an API through its real HTTP interface —
requests in, status codes and response bodies out — verifying the contract
(Phase 12) rather than internal implementation.

**4. How it works.**

```ts
describe('Orders API', () => {
  it('returns 201 and the standard success shape on creation', async () => {
    const response = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ items: [{ sku: 'ABC', quantity: 1 }] });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, data: { status: 'PENDING' } });
    expect(response.headers.location).toMatch(/^\/orders\//);
  });

  it('returns the standard error shape with field details on invalid input', async () => {
    const response = await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ items: [] });   // violates min(1) from the Phase 12 schema

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ field: 'items' }),
    );
  });

  it('returns 401 without a token, and 403 for an unauthorized role', async () => {
    await request(app).post('/orders').send({}).expect(401);
    await request(app)
      .post('/orders')
      .set('Authorization', `Bearer ${readOnlyRoleToken}`)
      .send({ items: [{ sku: 'ABC', quantity: 1 }] })
      .expect(403);
  });
});
```

This directly verifies the contract from Phase 12 — the standard success and
error shapes, correct status codes, the `401` vs `403` distinction — as
*behaviour*, not as documentation someone has to trust is still accurate.

### Load Testing

**1. Proper definition.** Testing system behaviour under expected and
above-expected traffic to find throughput limits, latency degradation curves,
and breaking points, validating the capacity estimates from Phase 11.

**4. How it works — the test types:**

- **Load test** — expected peak traffic, sustained, checking latency/error rate
  stays within SLO.
- **Stress test** — traffic increased until something breaks, to find the actual
  ceiling and *how* it fails (graceful degradation vs. cascading collapse).
- **Soak test** — moderate load sustained for hours, to catch memory leaks,
  connection pool exhaustion, and slow-growing problems invisible in a short run.
- **Spike test** — a sudden, sharp traffic increase (Phase 11's "push
  notification to 10M users" scenario), checking recovery behaviour.

```js
// k6 script — a load test validating the Phase 11 URL shortener's redirect SLO
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 1000 },   // ramp to 1,000 virtual users
    { duration: '5m', target: 1000 },   // hold
    { duration: '2m', target: 0 },      // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<100'],   // p99 under 100ms — the stated NFR
    http_req_failed: ['rate<0.001'],
  },
};

export default function () {
  const res = http.get('https://sho.rt/aB3xK9p');
  check(res, { 'status is 302': (r) => r.status === 302 });
  sleep(1);
}
```

Notice the `thresholds` block encodes the exact non-functional requirement from
Phase 11's estimation — this is what closes the loop between "we estimated p99
under 100ms" and "we actually verified it."

**7. Real backend usage.** Validating capacity estimates before a launch;
finding the actual saturation point of a connection pool or a rate limiter;
regression-testing performance after a significant change, not just correctness.

**9. Common mistakes.**

| Mistake | Fix |
|---|---|
| Load testing against a shared staging environment other work depends on | Isolated environment sized like production |
| No ramp-up — traffic goes from 0 to peak instantly | Ramp gradually to see the actual degradation curve |
| Testing only the happy path under load | Include realistic error/retry traffic in the mix |
| Never soak testing | Memory leaks and pool exhaustion only appear over hours |

### Security Testing

**1. Proper definition.** Testing that verifies a system resists the attack
patterns relevant to it — a distinct discipline from functional correctness.

**4. What to actually test, concretely (tying back to Phases 8 and 12):**

```ts
describe('security', () => {
  it('rejects SQL injection attempts in a filter parameter', async () => {
    const response = await request(app)
      .get("/orders?status=paid'; DROP TABLE orders;--")
      .set('Authorization', `Bearer ${validToken}`);
    expect(response.status).toBe(422);   // rejected by the filter allow-list (Phase 12)
    const check = await db.query("SHOW TABLES LIKE 'orders'");
    expect(check.length).toBe(1);        // table still exists
  });

  it('does not allow accessing another user\'s order by ID (IDOR)', async () => {
    const otherUsersOrder = await aTestOrder({ userId: 'someone-else' });
    const response = await request(app)
      .get(`/orders/${otherUsersOrder.id}`)
      .set('Authorization', `Bearer ${validToken}`);   // belongs to a different user
    expect(response.status).toBe(403);
  });

  it('rate-limits repeated login attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app).post('/login').send({ email: 'a@b.com', password: 'wrong' });
    }
    const response = await request(app).post('/login').send({ email: 'a@b.com', password: 'wrong' });
    expect(response.status).toBe(429);
  });

  it('never returns a password hash in any response', async () => {
    const response = await request(app).get('/users/me').set('Authorization', `Bearer ${validToken}`);
    expect(response.body.data).not.toHaveProperty('passwordHash');
  });
});
```

**IDOR** (Insecure Direct Object Reference — a user accessing another user's
resource by guessing or incrementing an ID) deserves particular emphasis: it is
one of the most common real-world API vulnerabilities and one of the easiest to
write an automated regression test for, yet it's frequently missed because
functional tests only check "does the owner get their own order back", never
"does a *different* authenticated user get rejected."

**9. Common mistakes.** Treating security testing as a one-time audit rather
than a permanent part of the regression suite; testing auth *presence* but not
auth *correctness* (does a 200 always come with the *right* data, scoped to the
right user); never testing rate limits and account lockout behaviour.

### Failure Testing

**1. Proper definition.** Deliberately injecting failure — network errors,
timeouts, dependency outages, malformed responses — to verify the system
degrades the way it's designed to, rather than assuming it does. Sometimes
called chaos testing at the infrastructure level.

**4. How it works — from a targeted unit-level fault injection up to full chaos
engineering:**

```ts
// targeted — proving a specific resilience mechanism (Phase 13) actually works
it('falls back to cache when the primary database times out', async () => {
  const slowDb: OrderRepository = {
    findById: () => new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 5000)),
  };
  const service = new OrderQueryService(slowDb, warmCache, { timeoutMs: 200 });

  const result = await service.getOrder('order-1');

  expect(result.source).toBe('cache');   // fell back, didn't hang for 5s
});

it('opens the circuit breaker after repeated payment gateway failures', async () => {
  const failingGateway: PaymentGateway = { charge: async () => { throw new Error('down'); } };
  const breaker = new CircuitBreaker(failingGateway, { failureThreshold: 3 });

  for (let i = 0; i < 3; i++) await expect(breaker.charge({} as any)).rejects.toThrow();

  await expect(breaker.charge({} as any)).rejects.toThrow('CIRCUIT_OPEN');   // fails fast, doesn't even call through
});
```

```ts
// duplicate-request handling (Phase 12's idempotency keys) under test
it('returns the identical response for a retried request with the same idempotency key', async () => {
  const key = randomUUID();
  const first = await request(app).post('/charges').set('Idempotency-Key', key).send(chargePayload);
  const second = await request(app).post('/charges').set('Idempotency-Key', key).send(chargePayload);

  expect(second.status).toBe(first.status);
  expect(second.body).toEqual(first.body);

  const chargeCount = await db.query('SELECT COUNT(*) as c FROM charges WHERE order_id = ?', [chargePayload.orderId]);
  expect(chargeCount[0].c).toBe(1);   // only ONE actual charge, despite two requests
});
```

At the infrastructure level, **chaos engineering** tools (Chaos Monkey, Gremlin,
or a Kubernetes-native equivalent) go further — killing real instances, adding
real network latency, partitioning real services in a staging or even
controlled production environment — to validate that the *whole system's*
failure handling, not just one unit's, behaves as designed.

**9. Common mistakes.** Building resilience mechanisms (Phase 13's retries,
circuit breakers, timeouts) and never actually testing that they trigger under
real failure conditions — a circuit breaker with a bug in its threshold logic
looks identical to a working one until the dependency actually fails in
production. Assuming a resilience mechanism works because the code compiles is
the single biggest gap between Phase 13 and this phase.

### 10. Interview answer (combined)

> Beyond functional correctness, I test the API contract itself — the exact
> status codes and response shapes from Phase 12 — and separately verify
> security properties like IDOR, which functional happy-path tests never catch
> because they only check that the *owner* of a resource gets it back, not that
> a *different* user is rejected. For load testing, I encode the actual NFRs
> from the capacity estimate as pass/fail thresholds — p99 under X, error rate
> under Y — so a load test either validates or invalidates the original
> estimate, rather than just producing a chart. And for failure testing, I
> specifically test that resilience mechanisms — retries, circuit breakers,
> idempotency keys — actually engage under real fault injection, because a
> circuit breaker that's never been tested against a real failure is a circuit
> breaker you're hoping works.

### 12. Production considerations

- **Automate security regression tests** (IDOR, injection, rate limiting) into
  the standard CI suite — not a once-a-year external audit only.
- **Run load tests before every major launch and after any significant
  architecture change**, against an isolated, production-sized environment.
- **Failure-test the resilience mechanisms you actually ship** — every retry
  policy, circuit breaker, and idempotency key from Phase 13/12 should have at
  least one test that proves it engages correctly under simulated failure.
- **Track load-test results over time** — a creeping p99 across releases is
  visible in trend data long before it becomes a production incident.

---

## 20.5 Test Coverage Limitations

### 1. Proper definition

Test coverage measures the percentage of code (lines, branches, functions)
*executed* by the test suite. It says nothing about whether that execution was
*meaningfully asserted on*.

### 2. Simple meaning

A test that calls a function and asserts nothing about the result still counts
as 100% coverage for that function. Coverage tells you what ran, never what was
verified.

```ts
// This test gives 100% line coverage of calculateDiscount() and catches ZERO bugs
it('calculates a discount', () => {
  calculateDiscount(order, coupon);   // no assertion at all
});
```

### 3–4. Why it's limited, and what it actually tells you

- **Coverage cannot detect wrong logic**, only unexecuted logic. A function that
  always returns `0` regardless of input can have 100% coverage and be
  completely broken.
- **It doesn't measure combinations.** Branch coverage on two independent `if`
  statements can hit 100% while never testing the case where both are true
  simultaneously — a common source of real bugs.
- **High coverage numbers on trivial code inflate the metric without adding
  confidence** — a getter, a DTO mapper, a constant export all contribute
  "covered lines" for near-zero risk reduction.
- **It says nothing about integration correctness** — a unit test suite can hit
  100% coverage while the actual database schema has drifted from what the code
  assumes.

**What coverage is genuinely good for:** finding code that has **no tests at
all** — an untested error-handling branch, a forgotten edge case — which is a
real and useful signal. The mistake is treating the *percentage* as a quality
target rather than the *gaps* as a todo list.

**Mutation testing** is the sharper tool for the question coverage can't
answer: a mutation testing tool (Stryker for TypeScript) automatically
introduces small bugs into your code (flips a `>` to `>=`, changes a `+` to a
`-`, deletes a line) and reruns your suite — if the suite still passes, that
mutant "survived," meaning your tests didn't actually verify that logic despite
covering it. A high **mutation score** is a much stronger confidence signal than
a high coverage percentage, at the cost of being significantly slower to run.

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Setting a hard coverage percentage gate (e.g. 90%) as the quality bar | Encourages low-value tests written just to hit the number | Use coverage to find untested gaps, not as a pass/fail target |
| Treating 100% coverage as "well tested" | Ignores assertion quality entirely | Review what's actually asserted, or run mutation testing |
| Chasing coverage on trivial code (getters, DTOs, constants) | Wastes effort where risk is near zero | Prioritize coverage on business logic and error paths |
| Never testing error/edge-case branches specifically | These are exactly where coverage tools show the real gaps | Read the coverage report for *which* lines are missed, not just the percentage |

### 10. Interview answer

> I use coverage as a gap-finder, not a target — it's very good at telling you
> "this error-handling branch has literally never run in a test," which is a
> real and useful signal, but a high percentage doesn't mean the code is
> correct, only that it executed. A test with no assertions counts as full
> coverage and verifies nothing. If I need a stronger signal than coverage can
> give, I'd reach for mutation testing — it introduces deliberate bugs and
> checks whether the suite actually catches them, which tells you about
> assertion quality rather than just execution.

### 11. Practice problems

1. Write a function with 100% branch coverage but a real bug, by writing tests
   with weak or missing assertions. Then fix the assertions and watch the
   "bug" get caught without changing which lines execute.
2. Run a mutation testing tool against an existing test suite and find at least
   one surviving mutant — a case where coverage was 100% but the test didn't
   actually verify the logic.
3. Set a team coverage policy that explicitly rejects a percentage gate and
   instead requires every merged PR's coverage *report* (not number) be
   reviewed for meaningful gaps.

### 12. Production considerations

- **Never gate CI on a bare coverage percentage** — gate on the *trend* not
  regressing, and review new gaps in code review instead.
- **Run mutation testing periodically** (it's slow — nightly or weekly, not on
  every commit) on the most business-critical modules specifically.
- **Treat 0%-covered files as the actionable signal**, not the aggregate
  percentage — a report showing exactly which functions have zero tests is far
  more useful than a single number at the top.

---

## 20.6 Practice — Applying Everything to Four Concrete Scenarios

The roadmap's practice list is four instructions. Each is worked through fully
below, because each exercises a different, specific muscle from this phase.

---

### Practice 1: Test services independently

**The point:** prove that Phase 9's architecture actually delivers what it
promises — a service tested with zero I/O.

```ts
// A complete, fast, deterministic unit test suite for OrderService,
// with every collaborator as a test double (20.2), no database, no HTTP.
describe('OrderService.placeOrder', () => {
  let orders: InMemoryOrderRepository;
  let users: InMemoryUserRepository;
  let service: OrderService;

  beforeEach(() => {
    orders = new InMemoryOrderRepository();
    users = new InMemoryUserRepository();
    service = new OrderService(orders, users);
  });

  it('rejects a non-positive total', async () => {
    await users.save(aUser().build());
    await expect(service.placeOrder(1, -10))
      .rejects.toMatchObject({ code: 'INVALID_TOTAL' });
  });

  it('rejects an unknown user', async () => {
    await expect(service.placeOrder(999, 50))
      .rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  it('rejects insufficient credit', async () => {
    await users.save(aUser().withCredit(20).build());
    await expect(service.placeOrder(1, 50))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_CREDIT' });
  });

  it('creates and persists an order when everything is valid', async () => {
    await users.save(aUser().withCredit(500).build());
    const order = await service.placeOrder(1, 100);
    expect(order?.status).toBe('PENDING');
    expect(await orders.findById(order!.id)).not.toBeNull();
  });
});
```

Runtime: this entire suite runs in single-digit milliseconds. That speed is the
payoff of Phase 9's layering — none of it is testing HTTP, none of it is
testing SQL, all of it is testing business rules directly.

---

### Practice 2: Test real database integration

**The point:** verify the seam a unit test's fakes can't see — that your
repository's actual SQL works against your actual schema.

```ts
describe('MySqlOrderRepository (integration)', () => {
  let container: StartedMySqlContainer;
  let pool: Pool;
  let repository: MySqlOrderRepository;

  beforeAll(async () => {
    container = await new MySqlContainer('mysql:8.4').start();
    pool = createPool({ uri: container.getConnectionUri() });
    await runMigrations(pool);           // the SAME migrations that run in production
    repository = new MySqlOrderRepository(pool);
  }, 60_000);

  afterAll(async () => { await pool.end(); await container.stop(); });
  beforeEach(async () => { await pool.query('TRUNCATE TABLE orders'); });

  it('round-trips an order through the real schema, including decimal precision', async () => {
    const order = Order.place('o1', 'u1', 19.99, new Date('2026-03-01T10:00:00Z'));
    await repository.save(order);

    const found = await repository.findById('o1');

    expect(found?.total).toBe(19.99);            // catches float/decimal column mismatches
    expect(found?.createdAt.toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });

  it('enforces the primary key uniqueness the domain assumes', async () => {
    await repository.save(Order.place('o1', 'u1', 10, new Date()));
    await expect(repository.save(Order.place('o1', 'u2', 20, new Date())))
      .rejects.toThrow(/Duplicate entry/);        // a real constraint, invisible to the in-memory fake
  });
});
```

The second test is the one that specifically justifies this whole practice item
— it is precisely the kind of bug (Phase 20.2's "fake drift" edge case) that
only a real database can catch.

---

### Practice 3: Test authentication and authorization

**The point:** these are two distinct failure modes (Phase 12's 401 vs 403) and
both need explicit, separate test coverage — plus the IDOR case from 20.4.

```ts
describe('authentication and authorization', () => {
  it('401s with no token', async () => {
    await request(app).get('/orders/o1').expect(401);
  });

  it('401s with an expired token', async () => {
    const expired = signToken({ userId: 'u1' }, { expiresIn: '-1h' });
    await request(app).get('/orders/o1').set('Authorization', `Bearer ${expired}`).expect(401);
  });

  it('401s with a malformed token', async () => {
    await request(app).get('/orders/o1').set('Authorization', 'Bearer garbage').expect(401);
  });

  it('403s an authenticated user with the wrong role', async () => {
    const token = await loginAs('support-agent-role');
    await request(app).delete('/orders/o1').set('Authorization', `Bearer ${token}`).expect(403);
  });

  it('403s an authenticated user accessing a resource they do not own (IDOR)', async () => {
    const owner = await aTestUser();
    const attacker = await aTestUser();
    const order = await aTestOrder({ userId: owner.id });

    const attackerToken = await loginAs(attacker.id);
    await request(app)
      .get(`/orders/${order.id}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .expect(403);
  });

  it('200s the owner accessing their own resource', async () => {
    const owner = await aTestUser();
    const order = await aTestOrder({ userId: owner.id });
    const ownerToken = await loginAs(owner.id);

    await request(app)
      .get(`/orders/${order.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
```

Six tests, six distinct failure/success modes — expired vs malformed vs missing
token are three genuinely different code paths (Phase 8), and the IDOR test is
the one most real suites skip.

---

### Practice 4: Test duplicate requests and timeout scenarios

**The point:** directly verify the reliability mechanisms from Phase 12 and 13
under simulated real-world network conditions, not just their happy path.

```ts
describe('duplicate requests', () => {
  it('a retried POST with the same idempotency key produces exactly one side effect', async () => {
    const key = randomUUID();
    const payload = { orderId: 'o1', amount: 100 };

    const [first, second] = await Promise.all([
      request(app).post('/charges').set('Idempotency-Key', key).send(payload),
      request(app).post('/charges').set('Idempotency-Key', key).send(payload),
    ]);   // fired concurrently — the harder case, not just sequential retries

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 201].sort());   // or one 201 + one 409, per your chosen design (12.4)

    const charges = await db.query('SELECT COUNT(*) as c FROM charges WHERE order_id = ?', [payload.orderId]);
    expect(charges[0].c).toBe(1);   // the property that actually matters: only one real charge
  });

  it('a webhook delivered twice with the same event ID is processed once', async () => {
    const event = { id: 'evt_1', type: 'payment.succeeded', data: { orderId: 'o1' } };
    await request(app).post('/webhooks/provider').send(event).expect(200);
    await request(app).post('/webhooks/provider').send(event).expect(200);   // duplicate delivery

    const order = await db.query('SELECT status FROM orders WHERE id = ?', ['o1']);
    expect(order[0].status).toBe('PAID');   // not double-processed into an invalid state
  });
});

describe('timeout scenarios', () => {
  it('returns a fast, typed error when a downstream dependency times out', async () => {
    nock('https://payments.example.com')
      .post('/charge')
      .delay(10_000)          // simulate a hung dependency
      .reply(200, {});

    const start = Date.now();
    const response = await request(app).post('/checkout').send(checkoutPayload);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(3000);        // failed fast via the configured timeout, not hung for 10s
    expect(response.status).toBe(504);
    expect(response.body.error.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('retries a transient failure and succeeds on the second attempt', async () => {
    nock('https://payments.example.com').post('/charge').reply(503);   // first call fails
    nock('https://payments.example.com').post('/charge').reply(200, { id: 'ch_1' });  // second succeeds

    const response = await request(app).post('/checkout').send(checkoutPayload);

    expect(response.status).toBe(201);   // the retry (Phase 13) recovered transparently
  });
});
```

The concurrent-request test in particular is worth dwelling on: firing both
requests with `Promise.all` rather than sequentially is what actually exercises
the lock/unique-constraint logic from Phase 12.4's idempotency implementation —
a sequential test would pass even with a buggy implementation that only
protects against retries that happen to arrive one at a time.

---

### 20.6 — Production considerations

- **These four practice areas map directly onto real production incident
  categories** — a service that can't be tested in isolation, a repository whose
  SQL was never verified against the real schema, an IDOR vulnerability, and a
  duplicate-charge bug are all things this phase's tests catch *before* they
  become an incident report.
- **The concurrent-duplicate-request pattern (`Promise.all`, not sequential)**
  is worth applying to every idempotency and locking test in a codebase — it's
  the difference between a test that looks right and a test that actually
  exercises the race condition.
- **Wire these into CI as separate, appropriately-tiered jobs** (20.1) — the
  service-isolation tests run on every save, the database integration and
  auth/duplicate/timeout tests run in the pipeline before merge.

---

## Phase 20 Completion Checklist

You are done with this phase when you can:

- [ ] Explain the testing pyramid and correctly place a given test into unit,
      integration, E2E, or contract, by what it uniquely verifies.
- [ ] Write a unit test for a Phase 9/10 use case with zero I/O, using fakes for
      every port.
- [ ] Precisely distinguish stub, mock, fake, spy and dummy, and justify picking
      one over another for a given collaborator.
- [ ] Build a test data builder and explain why it beats raw object literals at
      scale.
- [ ] Implement transaction-rollback or truncation-based database test isolation
      and explain the sharp edges of each.
- [ ] Write API tests that assert on the exact Phase 12 contract — status codes,
      error shape, headers — not just "it returns something."
- [ ] Write a load test that encodes an actual NFR from Phase 11 as a pass/fail
      threshold.
- [ ] Write a security regression test for IDOR, and explain why happy-path
      functional tests never catch it.
- [ ] Write a failure-injection test proving a specific Phase 13 resilience
      mechanism (retry, circuit breaker, timeout) actually engages.
- [ ] Explain precisely what test coverage does and does not measure, and why a
      100%-covered function can still be broken.
- [ ] Write a concurrent (not sequential) test for an idempotency-key
      implementation that actually exercises the race condition.
- [ ] Set up a tiered CI pipeline running unit, integration, and E2E tests at
      appropriately different frequencies.

**Next:** Phase 21 — DevOps and Cloud. Phase 20 verified the system behaves
correctly in isolation; Phase 21 is how it actually gets built, deployed, and
kept running in a real environment — containers, CI/CD pipelines, infrastructure
as code, and cloud deployment.

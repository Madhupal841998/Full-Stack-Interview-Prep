# Phase 10 — Low-Level Design (LLD)

**Stack context:** TypeScript (Node.js backend)
**Prerequisite:** Phases 2 (TypeScript), 4–8 (Node, Express, MySQL, auth), 9 (architecture)
**Priority:** OOP — MUST KNOW · SOLID — MUST KNOW · Factory, Strategy, Adapter, Decorator, Observer, Repository — MUST KNOW · Remaining patterns — IMPORTANT

---

## What This Phase Is Really About

Phase 9 decided **where code lives**. Phase 10 decides **what shape the code
inside those places takes**: which classes exist, what each one is responsible
for, how they talk to each other, and how you add a feature next month without
editing six files.

LLD is the level where most backend engineers are actually judged — in code
review daily, and in the "design a parking lot" interview round. The interview is
not testing whether you memorised the Singleton pattern. It is testing three
things:

1. Can you turn vague requirements into a small set of well-named concepts?
2. Do your classes have single, stateable responsibilities?
3. When I add a requirement mid-interview, does your design absorb it by adding a
   class, or does it require rewriting what you already wrote?

That third point is the whole subject. **Good LLD is design where new
requirements arrive as new classes, not as new `if` branches in old classes.**

### A warning about patterns

Patterns are vocabulary, not goals. A codebase that names every class
`OrderFactoryStrategyDecorator` is worse than one with three plain classes that
do the job. The correct use of this phase is:

- Learn the **problem** each pattern solves.
- Recognise the problem when it appears in your own code.
- Reach for the pattern only then.

Every pattern section below therefore ends with **"when not to use it"**, which
matters more than the code.

### A note on TypeScript

TypeScript gives you tools most OOP material (written for Java/C#) does not
discuss: structural typing, union types, discriminated unions, and plain
functions as first-class values. Several classic patterns collapse into something
much smaller in TypeScript. Where that is true, this document says so rather than
translating Java line by line.

---

## 10.1 Object-Oriented Programming

### 1. Proper definition

Object-oriented programming models a system as a collection of objects that
encapsulate state and the behaviour that operates on that state, interacting
through defined interfaces. Its four classical pillars are **encapsulation,
abstraction, inheritance and polymorphism**, and its three structural
relationships are **association, aggregation and composition**.

### 2. Simple meaning

Instead of data in one place and functions that manipulate it somewhere else, you
put the data and the rules that protect it in the same box, and only let the
outside world touch that box through a small set of methods.

The practical consequence: if a rule says "an order total can never be negative",
there should be exactly one place capable of setting the total, and that place
enforces the rule. Nothing else can reach in and break it.

### 3. Why it is needed

- **Invariant protection.** Rules live next to the data they constrain, so they
  cannot be bypassed or forgotten.
- **Substitutability.** Code written against an interface works with any
  implementation, which is what makes Phase 9's ports and adapters possible.
- **Localised change.** Changing how something is stored or calculated touches one
  class, not every call site.
- **A shared vocabulary.** `Order`, `Money`, `RateLimiter` communicate intent far
  better than nested objects and loose helper functions.
- **It is the language of LLD interviews.** The expected output is classes,
  relationships and interfaces.

### 4. How it works internally

**Class and object.** A class is a template describing state and behaviour; an
object is an instance with its own state. In JavaScript, classes are syntax over
prototypes: methods live on `Order.prototype` and are shared across instances,
while fields are per-instance. This is why `this` binding matters and why passing
`order.cancel` as a callback loses context unless bound or wrapped in an arrow.

**Encapsulation** — restricting direct access to internal state.

```ts
class Wallet {
  #balance: number;                    // true runtime privacy (JS private field)
  private readonly currency: string;   // compile-time only — erased at runtime

  constructor(initial: number, currency: string) {
    if (initial < 0) throw new Error('Balance cannot be negative');
    this.#balance = initial;
    this.currency = currency;
  }

  deposit(amount: number): void {
    if (amount <= 0) throw new Error('Deposit must be positive');
    this.#balance += amount;
  }

  withdraw(amount: number): void {
    if (amount > this.#balance) throw new Error('Insufficient funds');
    this.#balance -= amount;
  }

  get balance(): number { return this.#balance; }   // read-only exposure
}
```

Two levels of privacy exist in TypeScript, and the difference matters:
`private` is checked by the compiler and erased at build time (`(wallet as any).balance`
still works at runtime); `#field` is genuinely inaccessible at runtime. Use `#`
for anything security- or invariant-critical.

**Abstraction** — exposing what something does, hiding how.

```ts
interface PaymentGateway {
  charge(amount: number, customerRef: string): Promise<ChargeResult>;
}
```

The caller knows nothing about HTTP calls, retries or SDK types. Abstraction is
about the *size of the surface* you expose, not about using the `abstract` keyword.

**Inheritance** — an "is-a" relationship where a subclass extends a base class.

```ts
abstract class Notification {
  constructor(protected readonly recipient: string) {}
  abstract send(message: string): Promise<void>;

  protected validate(message: string): void {
    if (!message.trim()) throw new Error('Empty message');
  }
}

class EmailNotification extends Notification {
  async send(message: string): Promise<void> {
    this.validate(message);
    // ... SMTP call
  }
}
```

**Polymorphism** — one interface, many behaviours, selected at runtime.

```ts
const channels: Notification[] = [
  new EmailNotification('a@b.com'),
  new SmsNotification('+911234567890'),
];
await Promise.all(channels.map(c => c.send('Your order shipped')));
```

The loop has no idea which concrete class it is calling. Adding a push channel
adds a class and changes no existing code — the Open/Closed Principle in action.

**Composition** — building behaviour by holding other objects rather than
inheriting from them.

```ts
class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly payments: PaymentGateway,
    private readonly notifier: Notifier,
  ) {}
}
```

**Composition vs inheritance.** The default should be composition. Inheritance
couples the subclass to the base class's internals permanently, and a change to
the base ripples to every subclass (the "fragile base class" problem). Use
inheritance only when the relationship is genuinely "is-a" *and* substitutable
(see Liskov in 10.2). Use composition for everything that is "has-a" or "uses-a".

**The three relationships** (these get drawn in LLD interviews):

| Relationship | Meaning | Lifetime | Example |
|---|---|---|---|
| **Association** | A knows about B | Independent | `Order` ↔ `Customer` |
| **Aggregation** | A has B, B can exist alone | Independent | `ParkingLot` has `Vehicle`s |
| **Composition** | A owns B, B dies with A | Dependent | `Order` owns `OrderLine`s |

In UML: association is a plain line, aggregation a hollow diamond, composition a
filled diamond, inheritance a hollow triangle arrow.

**Interface.** A contract with no implementation. In TypeScript, interfaces are
*structural*: a class satisfies an interface by having matching members, without
declaring `implements`. Writing `implements` is still recommended — it makes the
intent explicit and surfaces mismatches at the class rather than at every call
site.

**Dependency injection.** Passing dependencies in rather than constructing them
inside.

```ts
// Bad — untestable, hard-wired
class OrderService {
  private db = new MySqlOrderRepository(globalPool);
}

// Good — injected
class OrderService {
  constructor(private readonly db: OrderRepositoryPort) {}
}
```

DI is the mechanism that makes everything else in Phase 9 and 10 work: it is how
polymorphism gets used, how tests substitute fakes, and how the Dependency
Inversion Principle is applied in practice. Constructor injection is the default;
method injection is for per-call values; property injection is rarely worth it.

### 5. Syntax reference

```ts
class Example {
  public name: string;            // default
  protected internalId: number;   // subclasses too
  private secret: string;         // compile-time private
  #realSecret: string;            // runtime private
  readonly createdAt: Date;       // immutable after construction
  static instances = 0;           // per-class, not per-instance

  constructor(name: string) {     // parameter properties shorthand:
    this.name = name;             // constructor(private readonly name: string) {}
    this.createdAt = new Date();
    Example.instances++;
  }

  get displayName(): string { return this.name.toUpperCase(); }
  set displayName(v: string) { this.name = v.trim(); }

  static create(name: string): Example { return new Example(name); }
}
```

### 6. Small example — the same problem, procedural vs object-oriented

**Procedural (rules scattered, nothing protected):**

```ts
const order = { id: 1, items: [], status: 'PENDING', total: 0 };
order.items.push({ sku: 'A', qty: 2, price: 100 });
order.total = order.items.reduce((s, i) => s + i.qty * i.price, 0);
order.status = 'PAID';   // nothing stops this from a cancelled order
```

**Object-oriented (rules enforced, state protected):**

```ts
class OrderLine {
  constructor(
    public readonly sku: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
  ) {
    if (quantity <= 0) throw new DomainError('Quantity must be positive');
    if (unitPrice < 0) throw new DomainError('Price cannot be negative');
  }
  get subtotal(): number { return this.quantity * this.unitPrice; }
}

class Order {
  #lines: OrderLine[] = [];
  #status: OrderStatus = 'PENDING';

  constructor(public readonly id: string, public readonly customerId: string) {}

  addLine(line: OrderLine): void {
    if (this.#status !== 'PENDING') {
      throw new DomainError('Cannot modify a non-pending order');
    }
    this.#lines.push(line);
  }

  markPaid(): void {
    if (this.#status === 'CANCELLED') throw new DomainError('Order is cancelled');
    if (this.#lines.length === 0) throw new DomainError('Cannot pay an empty order');
    this.#status = 'PAID';
  }

  get total(): number { return this.#lines.reduce((s, l) => s + l.subtotal, 0); }
  get lines(): readonly OrderLine[] { return [...this.#lines]; }   // defensive copy
  get status(): OrderStatus { return this.#status; }
}
```

The total can no longer drift from the lines; a cancelled order can no longer be
paid; and the invalid states simply cannot be constructed. Note the defensive
copy in the `lines` getter — returning `this.#lines` directly would hand the
caller a mutable reference to internal state, quietly defeating the encapsulation.

### 7. Real backend usage

- Domain entities in a Clean/Hexagonal core (Phase 9.3–9.4).
- A `RateLimiter` interface with `TokenBucket`, `SlidingWindow` and `FixedWindow`
  implementations selected by configuration.
- `Money` as a value object that prevents mixing currencies and floating-point
  rounding errors.
- Repository interfaces with MySQL and in-memory implementations for tests.

### 8. Edge cases

- **`this` loss.** `app.post('/x', controller.create)` loses `this`. Fix with an
  arrow-function class property (`create = async (req, res) => {}`) or
  `.bind(controller)`.
- **Entities vs value objects.** An entity has identity that persists through
  change (`Order#123` is the same order after edits). A value object is defined
  entirely by its values and should be immutable (`Money(100, 'INR')`). Value
  objects should implement an `equals()` method; comparing with `===` compares
  references.
- **Deep vs shallow copies.** `{...order}` copies references to nested objects.
  For defensive copying of nested state, use `structuredClone()` or map explicitly.
- **Serialisation.** `JSON.stringify` cannot see `#private` fields, so entities
  need an explicit `toJSON()` or a mapper. This is a feature — it keeps internal
  state out of API responses.
- **Inheritance across module boundaries.** Exporting a base class other teams
  extend makes it almost impossible to change. Prefer exporting an interface.
- **`instanceof` across realms/bundles** can fail when two copies of a class
  exist. Prefer discriminated unions or a `kind` field for type narrowing.

### 9. Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Public mutable fields on entities | Any caller can violate invariants | Private state + intention-revealing methods |
| Getters/setters for every field | It is encapsulation theatre; the object is still a data bag | Expose behaviour (`markPaid()`), not fields (`setStatus()`) |
| Deep inheritance hierarchies (3+ levels) | Fragile base class; behaviour scattered across files | Flatten; use composition |
| Inheriting to reuse a helper method | The "is-a" claim is false | Extract a collaborator and inject it |
| `new` inside a class for its dependencies | Untestable, hard-wired | Constructor injection |
| Anaemic classes (all data, no behaviour) with logic in services | You wrote structs, not objects | Move invariants onto the class |
| Returning internal arrays/maps directly | Callers mutate your internals | Return a copy or a `readonly` view |
| Using classes for everything, including stateless helpers | Ceremony without benefit | A plain exported function is fine |

### 10. Interview answer

> OOP models a system as objects that own both state and the rules protecting
> that state. The four pillars are encapsulation, abstraction, inheritance and
> polymorphism, but in day-to-day backend work encapsulation and polymorphism do
> most of the work: encapsulation means an entity like `Order` keeps its status
> private and only exposes intention-revealing methods like `markPaid()`, so
> invalid states are unreachable; polymorphism plus dependency injection is what
> lets a service depend on a `PaymentGateway` interface and work with Stripe, a
> mock, or an in-memory fake. I prefer composition over inheritance by default,
> because inheritance permanently couples a subclass to a base class's internals,
> and I reserve it for genuine, substitutable "is-a" relationships.

### 11. Practice problems

1. Turn the procedural `order` object above into `Order` + `OrderLine` classes
   where an invalid order is impossible to construct. Write tests that attempt
   every violation and assert they throw.
2. Build a `Money` value object supporting `add`, `subtract`, `multiply` and
   `equals`, rejecting currency mixing and storing amounts in minor units
   (integers) to avoid float errors.
3. Define a `Notifier` interface and implement email, SMS and Slack notifiers.
   Write a `NotificationDispatcher` that takes `Notifier[]` and never mentions a
   concrete class.
4. Take a class you have written with 5+ public mutable fields and redesign it so
   all state is private and every mutation goes through a method that names a
   business action.
5. Draw a class diagram for a blog system (`User`, `Post`, `Comment`, `Tag`)
   marking each relationship as association, aggregation or composition, and
   justify each choice.
6. Refactor a 3-level inheritance hierarchy into composition and compare the two
   for testability and for "how many files change when the base changes".

### 12. Production considerations

- **Keep entities free of infrastructure.** No ORM decorators, no `process.env`,
  no logging inside domain classes — that is what makes them testable (Phase 9.3).
- **Immutability where practical.** `readonly` fields and returning new instances
  removes an entire class of concurrency and aliasing bugs.
- **Object creation cost is real but rarely the bottleneck.** Do not hydrate
  entities for bulk read endpoints (use DTOs); do not prematurely avoid classes
  for "performance" without a profile.
- **`strict` mode on.** `strictNullChecks`, `noImplicitAny`, `useDefineForClassFields`
  and `exactOptionalPropertyTypes` catch most class-related bugs at compile time.
- **Name classes after domain concepts**, not technical roles. `PricingPolicy`
  tells a reader something; `PriceManager` or `PriceHelper` does not.

---

## 10.2 SOLID Principles

Five design principles that together answer one question: **how do I write
classes that absorb change instead of resisting it?**

The source roadmap asks for definition, bad design, improved design, backend
example and trade-offs for each. That structure is used below.

A framing that helps before the details: SRP and ISP are about **splitting things
that change for different reasons**. OCP and DIP are about **depending on
abstractions so new behaviour plugs in**. LSP is about **not lying with your type
hierarchy**.

---

### S — Single Responsibility Principle

**Definition.** A class should have one, and only one, reason to change. "Reason
to change" means *one source of requirements* — one actor or stakeholder — not
"one method" or "one thing it does".

**Bad design**

```ts
class UserService {
  async register(email: string, password: string) {
    if (!/^[^@]+@[^@]+$/.test(email)) throw new Error('Invalid email');   // validation
    const hash = await bcrypt.hash(password, 12);                         // security policy
    const [r] = await pool.query('INSERT INTO users ...', [email, hash]); // persistence
    await sendgrid.send({ to: email, subject: 'Welcome' });               // messaging
    fs.appendFileSync('audit.log', `registered ${email}\n`);              // auditing
    return r.insertId;
  }
}
```

This class changes when the validation rules change, when the hashing cost factor
changes, when the schema changes, when marketing rewrites the welcome email, and
when compliance changes the audit format. Five stakeholders, one class.

**Improved design**

```ts
class UserRegistrationService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly validator: RegistrationValidator,
    private readonly events: EventPublisher,
  ) {}

  async register(input: RegisterInput): Promise<UserId> {
    this.validator.validate(input);
    const hash = await this.hasher.hash(input.password);
    const id = await this.users.create({ email: input.email, passwordHash: hash });
    await this.events.publish({ type: 'user.registered', payload: { id, email: input.email } });
    return id;
  }
}
```

The welcome email and the audit log become event subscribers. Marketing's changes
no longer touch registration code at all.

**Backend example.** A `ReportService` that queries data, formats it as PDF and
emails it. Split into `ReportQuery` (data), `PdfRenderer` (format), `Mailer`
(delivery). Switching to Excel export then adds a renderer rather than editing
report logic.

**Trade-offs.** Taken too far, SRP produces dozens of one-method classes and a
wiring file nobody can read. The test is *reasons to change*, not line count. If
two things always change together, they probably belong together. Start
coarse-grained and split when a class starts attracting edits from unrelated
requests.

---

### O — Open/Closed Principle

**Definition.** Software entities should be open for extension but closed for
modification: you should be able to add behaviour without editing existing,
tested code.

**Bad design**

```ts
class ShippingCalculator {
  calculate(order: Order, method: string): number {
    if (method === 'standard') return order.weight * 5;
    if (method === 'express')  return order.weight * 12 + 50;
    if (method === 'overnight') return order.weight * 25 + 150;
    throw new Error('Unknown method');
  }
}
```

Every new shipping method edits a tested class, re-opens it to regression, and
grows a conditional that eventually appears in five other places too.

**Improved design**

```ts
interface ShippingStrategy {
  readonly code: string;
  calculate(order: Order): number;
}

class StandardShipping implements ShippingStrategy {
  readonly code = 'standard';
  calculate(order: Order) { return order.weight * 5; }
}

class ExpressShipping implements ShippingStrategy {
  readonly code = 'express';
  calculate(order: Order) { return order.weight * 12 + 50; }
}

class ShippingCalculator {
  private readonly strategies = new Map<string, ShippingStrategy>();

  register(strategy: ShippingStrategy): void {
    this.strategies.set(strategy.code, strategy);
  }

  calculate(order: Order, code: string): number {
    const strategy = this.strategies.get(code);
    if (!strategy) throw new DomainError('UNKNOWN_SHIPPING', code);
    return strategy.calculate(order);
  }
}
```

Adding drone delivery = one new file + one registration line. `ShippingCalculator`
is never edited again.

**Backend example.** Webhook handlers per provider, auth strategies per identity
provider, export formats, discount rules, notification channels. All the same
shape: a registry plus an interface.

**Trade-offs.** OCP costs indirection, and you cannot make a class open to *every*
axis of change. Guess wrong and you built a plugin system for something that
never varied. The pragmatic rule: write the `if/else` the first time, and refactor
to a strategy on the **third** variation — by then the axis of change is proven.

---

### L — Liskov Substitution Principle

**Definition.** Objects of a subtype must be usable anywhere the supertype is
expected, without the caller needing to know the difference and without breaking
correctness. A subtype may weaken preconditions and strengthen postconditions,
never the reverse.

**Bad design**

```ts
class Rectangle {
  constructor(protected width: number, protected height: number) {}
  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
  get area() { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w: number) { this.width = w; this.height = w; }   // surprise
  setHeight(h: number) { this.width = h; this.height = h; }
}

function resize(r: Rectangle) {
  r.setWidth(5); r.setHeight(4);
  console.assert(r.area === 20);   // fails for Square — returns 16
}
```

A more realistic backend version:

```ts
class ReadOnlyUserRepository extends UserRepository {
  async save(): Promise<void> { throw new Error('Not supported'); }   // LSP violation
}
```

Any code holding a `UserRepository` may now explode at runtime. The type says
"I can save"; the object says otherwise.

**Improved design**

Model the capabilities honestly rather than forcing a hierarchy:

```ts
interface UserReader { findById(id: string): Promise<User | null> }
interface UserWriter { save(user: User): Promise<void> }

class MySqlUserRepository implements UserReader, UserWriter { /* ... */ }
class CachedUserReader implements UserReader { /* ... */ }
```

Now a function that only reads asks for `UserReader`, and a read-only
implementation is a perfectly valid, non-lying substitute.

**Backend example.** A `S3FileStorage` that implements `FileStorage.delete()` as a
no-op because the bucket is versioned. Callers who rely on delete actually
deleting will be wrong in production, silently. Either implement it honestly or
split the interface.

**Trade-offs.** LSP pushes you toward smaller interfaces and away from inheritance,
which can mean more types. It is also the principle most often violated
accidentally through `throw new Error('not implemented')` stubs — treat those as a
design smell in shipped code, not a harmless placeholder.

---

### I — Interface Segregation Principle

**Definition.** No client should be forced to depend on methods it does not use.
Many small, client-specific interfaces beat one large general-purpose interface.

**Bad design**

```ts
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
  bulkInsert(entities: T[]): Promise<void>;
  count(): Promise<number>;
  search(query: string): Promise<T[]>;
  stream(): AsyncIterable<T>;
}
```

Every implementation must provide eight methods. The in-memory test fake needs
all eight even though the use case calls two, and `stream()` makes no sense for
half the entities.

**Improved design**

```ts
interface FindsOrderById  { findById(id: string): Promise<Order | null> }
interface SavesOrder      { save(order: Order): Promise<void> }
interface ListsUserOrders { findByUser(userId: string): Promise<Order[]> }

class PlaceOrderUseCase {
  constructor(private readonly orders: SavesOrder & FindsOrderById) {}
}
```

The test fake for `PlaceOrderUseCase` now needs exactly two methods. The
dependency is also self-documenting: the constructor signature tells you the use
case can save and look up orders, and nothing else.

**Backend example.** Splitting `Cache` into `CacheReader` / `CacheWriter` /
`CacheInvalidator` means a read-path service cannot accidentally invalidate, and a
read-only Redis replica adapter is a legal implementation.

**Trade-offs.** Over-segregation produces interface soup — twenty one-method
interfaces for one repository is worse than one sensible interface. TypeScript's
intersection types (`A & B`) make composing small interfaces cheap, which shifts
the balance toward segregation compared with Java. A reasonable middle: segregate
when a client genuinely uses a subset *and* you want a cheap fake or an alternate
implementation.

---

### D — Dependency Inversion Principle

**Definition.** High-level modules should not depend on low-level modules; both
should depend on abstractions. Abstractions should not depend on details; details
should depend on abstractions.

**Bad design**

```ts
import { StripeClient } from 'stripe';
import { mysqlPool } from '../db';

class CheckoutService {                         // high-level policy
  private stripe = new StripeClient(process.env.STRIPE_KEY!);   // low-level detail

  async checkout(orderId: string) {
    const [rows] = await mysqlPool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    await this.stripe.charges.create({ amount: rows[0].total * 100, currency: 'inr' });
  }
}
```

Business policy now imports a vendor SDK and a database driver. It cannot be
tested without both, and changing either edits business code.

**Improved design**

```ts
// Defined by the high-level module — this is the "inversion"
interface PaymentGateway { charge(req: ChargeRequest): Promise<ChargeResult> }
interface OrderRepository { findById(id: string): Promise<Order | null> }

class CheckoutService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentGateway,
  ) {}

  async checkout(orderId: string): Promise<ChargeResult> {
    const order = await this.orders.findById(orderId);
    if (!order) throw new DomainError('ORDER_NOT_FOUND', orderId);
    return this.payments.charge({ amount: order.total, currency: order.currency, ref: order.id });
  }
}

// Detail depends on abstraction
class StripePaymentGateway implements PaymentGateway { /* ... */ }
```

The critical detail — and the part people miss — is **who owns the interface**. If
`PaymentGateway` is declared in the Stripe adapter's file, nothing was inverted;
the arrow still points from policy to detail. The interface must be owned by the
high-level module. This is exactly the ports concept from Phase 9.4.

**Backend example.** Every port in a hexagonal core: repository, mailer, clock, ID
generator, feature-flag reader, payment gateway.

**Trade-offs.** DIP adds an interface and a wiring step for every dependency, and
a composition root that must be maintained. For a genuinely stable dependency —
`lodash`, `crypto`, the standard library — inverting it is pure ceremony. Invert
what is *likely to change* or *hard to test*: I/O, network, time, randomness,
third-party vendors.

---

### SOLID — Interview answer

> SOLID is five principles for writing classes that absorb change. Single
> Responsibility says a class should have one reason to change — one stakeholder
> — so I split a registration service that also emails and audits into a service
> plus event subscribers. Open/Closed says add behaviour without editing tested
> code, which in practice means replacing a growing `if/else` with a strategy
> interface and a registry. Liskov says a subtype must be safely substitutable, so
> a repository that throws "not supported" on `save` is a violation and should be
> split into reader and writer interfaces instead. Interface Segregation says
> clients shouldn't depend on methods they don't use, which keeps test fakes
> small. Dependency Inversion says both sides depend on an abstraction owned by
> the high-level module — that's the ports-and-adapters idea, and it's what lets
> me test business logic without a database or a vendor SDK.

### SOLID — Practice problems

1. Find a class in your code with 4+ reasons to change. List the stakeholders,
   then split it. Measure: how many files change now for a "change the welcome
   email" request?
2. Convert a 5-branch `switch` on payment provider into a strategy registry.
   Prove OCP by adding a sixth provider without editing any existing file.
3. Find a `throw new Error('not implemented')` in a shipped codebase. Redesign
   the interfaces so that implementation becomes honest.
4. Take a 10-method repository interface and segregate it by actual client usage.
   Count the methods your test fakes needed before and after.
5. Invert one vendor dependency (mailer, storage, payments): define the port,
   write two adapters, and run the same test suite against both.
6. Write a short doc arguing where *not* to apply OCP in your codebase, naming
   the axis of change you judged unlikely.

### SOLID — Production considerations

- **These are heuristics with costs, not laws.** The failure mode of a junior
  engineer is ignoring them; the failure mode of a mid-level engineer is applying
  all five everywhere. Both produce unmaintainable code.
- **Refactor toward them, rarely design for them upfront.** The third duplication
  is the signal.
- **Enforce DIP mechanically** with the lint rules from Phase 9.3 — it is the one
  principle a machine can check.
- **Watch for SRP drift in code review:** if a PR touching "add a discount type"
  changes `OrderService`, the boundary is wrong.

---

## 10.3 Design Patterns

Patterns are named solutions to recurring design problems. Each entry below gives
the **problem**, the **solution**, a **TypeScript backend example**, and — most
importantly — **when not to use it**.

They are grouped the classical way:

- **Creational** — how objects get made: Factory, Abstract Factory, Builder, Singleton
- **Structural** — how objects are composed: Adapter, Facade, Decorator
- **Behavioural** — how objects collaborate: Strategy, Observer, Command, Template Method, Chain of Responsibility, State
- **Data access** — Repository, Unit of Work

---

### Factory Method  · MUST KNOW

**Problem.** Creating an object requires knowing which concrete class to build,
and that decision (or the construction detail) leaks into every call site.

**Solution.** Put the decision in one place that returns an abstraction.

```ts
interface Notifier { send(to: string, message: string): Promise<void> }

type Channel = 'email' | 'sms' | 'push';

export class NotifierFactory {
  constructor(
    private readonly config: NotificationConfig,
    private readonly http: HttpClient,
  ) {}

  create(channel: Channel): Notifier {
    switch (channel) {
      case 'email': return new EmailNotifier(this.config.smtp);
      case 'sms':   return new SmsNotifier(this.http, this.config.smsApiKey);
      case 'push':  return new PushNotifier(this.http, this.config.fcmKey);
      default: {
        const _exhaustive: never = channel;   // compile error if a channel is added
        throw new Error(`Unsupported channel: ${_exhaustive}`);
      }
    }
  }
}
```

The `never` trick is worth internalising: adding `'whatsapp'` to `Channel` now
produces a *compile-time* error in the factory rather than a runtime surprise.

**Backend usage.** Notifier per channel, storage client per provider, parser per
file type, DB connection per tenant shard.

**When not to use it.** When there is exactly one implementation — just call
`new`. A factory that always returns the same class is indirection with no payoff.

---

### Abstract Factory  · IMPORTANT

**Problem.** You need to create **families** of related objects that must be used
together and must not be mixed across families.

**Solution.** One interface that creates the whole family.

```ts
interface StorageFactory {
  createUploader(): Uploader;
  createSignedUrlIssuer(): SignedUrlIssuer;
  createDeleter(): Deleter;
}

class S3StorageFactory implements StorageFactory {
  constructor(private readonly client: S3Client) {}
  createUploader()        { return new S3Uploader(this.client); }
  createSignedUrlIssuer() { return new S3SignedUrlIssuer(this.client); }
  createDeleter()         { return new S3Deleter(this.client); }
}

class LocalStorageFactory implements StorageFactory { /* ... */ }
```

You can never accidentally pair an S3 uploader with a local URL issuer.

**Backend usage.** Multi-cloud storage, per-environment infrastructure sets
(prod/staging/test), per-tenant provider bundles.

**When not to use it.** When the objects are not genuinely coupled as a family. If
mixing implementations is legal, plain factories or DI are simpler.

---

### Builder  · IMPORTANT

**Problem.** An object needs many optional parameters, and the constructor has
become a line of eight positional arguments nobody can read.

**Solution.** Step-by-step construction with a terminal `build()` that validates.

```ts
class QueryBuilder {
  #table = '';
  #where: string[] = [];
  #params: unknown[] = [];
  #orderBy?: string;
  #limit?: number;

  from(table: string): this { this.#table = table; return this; }

  where(clause: string, ...params: unknown[]): this {
    this.#where.push(clause);
    this.#params.push(...params);
    return this;
  }

  orderBy(column: string, dir: 'ASC' | 'DESC' = 'ASC'): this {
    this.#orderBy = `${column} ${dir}`;
    return this;
  }

  limit(n: number): this { this.#limit = n; return this; }

  build(): { sql: string; params: unknown[] } {
    if (!this.#table) throw new Error('Table is required');
    let sql = `SELECT * FROM ${this.#table}`;
    if (this.#where.length) sql += ` WHERE ${this.#where.join(' AND ')}`;
    if (this.#orderBy) sql += ` ORDER BY ${this.#orderBy}`;
    if (this.#limit !== undefined) sql += ` LIMIT ${this.#limit}`;
    return { sql, params: this.#params };
  }
}

const { sql, params } = new QueryBuilder()
  .from('orders')
  .where('user_id = ?', userId)
  .where('status = ?', 'PAID')
  .orderBy('created_at', 'DESC')
  .limit(20)
  .build();
```

**Backend usage.** Query builders, HTTP request builders, test data builders
(enormously useful — `anOrder().paid().withLines(3).build()` makes test setup
readable), complex report configuration.

**When not to use it.** For 2–3 parameters. In TypeScript an options object
(`new Thing({ a, b, c })`) solves most "too many parameters" problems with far
less code — reach for Builder when construction is genuinely multi-step,
conditional, or validated at the end.

---

### Singleton  · IMPORTANT (and its risks)

**Problem.** Exactly one instance of something should exist, and it should be
globally reachable.

**Solution — and why it is usually the wrong one.**

```ts
// The classic form
class ConfigService {
  private static instance: ConfigService;
  private constructor(private readonly values: Record<string, string>) {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService(process.env as Record<string, string>);
    }
    return ConfigService.instance;
  }
}
```

**The risks, concretely:**

- **Hidden dependency.** `ConfigService.getInstance()` buried in a method means the
  class's real dependencies are invisible in its signature.
- **Untestable.** Tests cannot substitute a fake, and state leaks between test
  cases because the instance survives.
- **Concurrency.** In Node this is safe within one process, but with clustering or
  multiple workers you have N singletons — anything stateful (an in-memory rate
  limiter, a counter) will be wrong.
- **Lifecycle.** It never gets torn down cleanly, which complicates graceful
  shutdown and hot reload.

**The better default in Node/TypeScript:** create one instance in the composition
root and inject it.

```ts
// main.ts
const config = new ConfigService(process.env);
const pool = createPool(config.dbUrl);
const orderService = new OrderService(new OrderRepository(pool));
```

You get "one instance" without any of the global-state costs. A module-level
`export const pool = createPool(...)` is the idiomatic middle ground — ES modules
are cached, so this is a singleton by construction — and it is acceptable for
genuinely stateless infrastructure clients.

**When it is actually fine.** Stateless clients where sharing is the point: a DB
connection pool, a logger, a metrics registry.

**When not to use it.** Anything holding business state, anything you want to fake
in tests, anything whose behaviour differs per tenant or per request.

---

### Adapter  · MUST KNOW

**Problem.** An existing class or library has the wrong interface for your code.

**Solution.** A wrapper that translates.

```ts
// What your core wants (a port, per Phase 9.4)
interface PaymentGateway {
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

// What Razorpay actually gives you
class RazorpayAdapter implements PaymentGateway {
  constructor(private readonly client: Razorpay) {}

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    try {
      const payment = await this.client.payments.capture(
        req.reference,
        Math.round(req.amount * 100),   // paise, not rupees
        req.currency,
      );
      return { reference: payment.id, succeeded: payment.status === 'captured' };
    } catch (err) {
      throw this.translateError(err);    // vendor error → domain error
    }
  }

  private translateError(err: unknown): DomainError { /* ... */ }
}
```

An adapter has three jobs: **shape translation**, **unit translation** (rupees →
paise), and **error translation** (vendor exception → domain error). Skipping the
third is the most common half-done adapter.

**Backend usage.** Every outbound adapter in hexagonal architecture; wrapping
legacy internal services; normalising two vendors behind one interface.

**When not to use it.** When you control both sides and can simply change one of
them. An adapter around your own recently-written class is usually a sign the
interface was wrong.

---

### Facade  · IMPORTANT

**Problem.** A subsystem has many moving parts, and every caller has to know the
sequence.

**Solution.** One simplified entry point.

```ts
class CheckoutFacade {
  constructor(
    private readonly inventory: InventoryService,
    private readonly pricing: PricingService,
    private readonly payments: PaymentService,
    private readonly orders: OrderService,
    private readonly notifications: NotificationService,
  ) {}

  async checkout(cart: Cart, userId: string): Promise<CheckoutResult> {
    await this.inventory.reserve(cart.items);
    const total = await this.pricing.calculate(cart, userId);
    const charge = await this.payments.charge(userId, total);
    const order = await this.orders.create(userId, cart.items, total, charge.reference);
    await this.notifications.orderPlaced(order);
    return { orderId: order.id, total };
  }
}
```

**Backend usage.** Onboarding flows, checkout, tenant provisioning — anywhere a
business operation spans several services.

**When not to use it.** When the facade grows business rules of its own and
becomes a god object. A facade should **orchestrate**, not **decide**. Once it
contains conditionals about business meaning, it is a service and should be named
and structured as one.

---

### Decorator  · MUST KNOW

**Problem.** You want to add behaviour (caching, retries, logging, metrics) to an
object without modifying it or subclassing it for every combination.

**Solution.** A wrapper implementing the same interface that adds behaviour before
or after delegating.

```ts
interface UserRepository { findById(id: string): Promise<User | null> }

class CachingUserRepository implements UserRepository {
  constructor(
    private readonly inner: UserRepository,
    private readonly cache: Cache,
    private readonly ttlSeconds = 60,
  ) {}

  async findById(id: string): Promise<User | null> {
    const cached = await this.cache.get<User>(`user:${id}`);
    if (cached) return cached;

    const user = await this.inner.findById(id);
    if (user) await this.cache.set(`user:${id}`, user, this.ttlSeconds);
    return user;
  }
}

class LoggingUserRepository implements UserRepository {
  constructor(private readonly inner: UserRepository, private readonly log: Logger) {}

  async findById(id: string): Promise<User | null> {
    const start = performance.now();
    try {
      return await this.inner.findById(id);
    } finally {
      this.log.debug('findById', { id, ms: performance.now() - start });
    }
  }
}

// Compose at the composition root — order matters
const repo = new LoggingUserRepository(
  new CachingUserRepository(
    new MySqlUserRepository(pool),
    redisCache,
  ),
  logger,
);
```

Order is a real decision: logging outside caching logs cache hits too; logging
inside logs only database calls. Decide deliberately.

**Backend usage.** Caching, retry, circuit breaking, metrics, authorisation
checks, rate limiting — all as decorators around a port. Express middleware is the
same idea applied to functions.

**When not to use it.** Beyond three or four layers, debugging a stack trace
becomes unpleasant, and behaviour becomes hard to predict from the composition
root. Also avoid it when the added behaviour changes the *contract* rather than
augmenting it — that is a different implementation, not a decorator.

---

### Strategy  · MUST KNOW

**Problem.** Several interchangeable algorithms exist for one job, and the choice
happens at runtime.

**Solution.** Encapsulate each algorithm behind a shared interface. (The Open/Closed
example in 10.2 is a Strategy — that is the pattern's primary use.)

```ts
interface RateLimitStrategy {
  isAllowed(key: string): Promise<boolean>;
}

class TokenBucketStrategy implements RateLimitStrategy { /* ... */ }
class SlidingWindowStrategy implements RateLimitStrategy { /* ... */ }
class FixedWindowStrategy implements RateLimitStrategy { /* ... */ }

class RateLimiter {
  constructor(private readonly strategy: RateLimitStrategy) {}
  check(key: string) { return this.strategy.isAllowed(key); }
}
```

**The TypeScript shortcut.** When a strategy has exactly one method and no state,
a function is a perfectly good strategy and much less code:

```ts
type PricingRule = (order: Order) => number;

const rules: Record<string, PricingRule> = {
  flat:    (o) => o.total,
  bulk:    (o) => o.quantity > 100 ? o.total * 0.85 : o.total,
  loyalty: (o) => o.total * (1 - o.customerTier * 0.05),
};
```

Prefer this form unless the strategy needs injected dependencies or multiple
methods.

**Backend usage.** Pricing, shipping, rate limiting, retry policies, sorting and
ranking, auth strategies, file parsers.

**When not to use it.** With a single algorithm, or when the variants differ so
much that they do not share a coherent interface — forcing them into one produces
an interface full of optional, ignored parameters.

---

### Observer (Publish/Subscribe)  · MUST KNOW

**Problem.** When something happens, an unknown and growing number of things need
to react, and the originator should not know about any of them.

**Solution.** Subjects publish events; observers subscribe.

```ts
type DomainEvent =
  | { type: 'order.placed'; payload: { orderId: string; userId: string; total: number } }
  | { type: 'order.cancelled'; payload: { orderId: string; reason: string } };

type Handler<E extends DomainEvent> = (event: E) => Promise<void>;

class EventBus {
  #handlers = new Map<DomainEvent['type'], Handler<never>[]>();

  subscribe<T extends DomainEvent['type']>(
    type: T,
    handler: Handler<Extract<DomainEvent, { type: T }>>,
  ): void {
    const list = this.#handlers.get(type) ?? [];
    list.push(handler as Handler<never>);
    this.#handlers.set(type, list);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.#handlers.get(event.type) ?? [];
    const results = await Promise.allSettled(
      handlers.map(h => (h as Handler<DomainEvent>)(event)),
    );
    for (const r of results) {
      if (r.status === 'rejected') this.log.error('handler failed', { event: event.type, err: r.reason });
    }
  }
}
```

Two details that separate a working bus from a broken one: **`allSettled`, not
`all`** (one failing subscriber must not abort the others), and **the publisher
must not await business-critical work** — if the email *must* send, that is a
queued job with retries, not a subscriber.

**Backend usage.** Domain events between modules (Phase 9.2), audit logging,
cache invalidation, analytics, webhooks. Node's `EventEmitter` is this pattern
built in.

**When not to use it.** When the caller needs a result or needs to know the work
succeeded. Events make control flow invisible; a request that "sometimes doesn't
send the email" is painful to debug precisely because nothing in the code names
the subscriber. Use a direct call when you need the answer.

---

### Command  · IMPORTANT

**Problem.** You need to treat an operation as an object — to queue it, log it,
retry it, undo it, or send it across a boundary.

**Solution.** Encapsulate the request as an object with an `execute()`.

```ts
interface Command<R = void> {
  readonly name: string;
  execute(): Promise<R>;
}

class RefundOrderCommand implements Command {
  readonly name = 'refund_order';
  constructor(
    private readonly orderId: string,
    private readonly amount: number,
    private readonly payments: PaymentGateway,
  ) {}
  async execute(): Promise<void> { await this.payments.refund(this.orderId, this.amount); }
}

class CommandRunner {
  async run<R>(cmd: Command<R>, attempts = 3): Promise<R> {
    for (let i = 1; i <= attempts; i++) {
      try { return await cmd.execute(); }
      catch (err) {
        if (i === attempts) throw err;
        await sleep(2 ** i * 100);
      }
    }
    throw new Error('unreachable');
  }
}
```

**Backend usage.** Job queue payloads, CQRS write side, admin action audit trails,
undo in collaborative tools, transactional outbox entries.

**When not to use it.** When you just need to call a function. A `Command` class
wrapping a single service call with no queueing, retry or audit requirement is
pure overhead.

---

### Template Method  · IMPORTANT

**Problem.** Several processes share the same skeleton but differ in a few steps.

**Solution.** A base class defines the skeleton and defers the varying steps.

```ts
abstract class ImportJob<T> {
  async run(filePath: string): Promise<ImportResult> {
    const raw = await this.read(filePath);          // varies
    const rows = this.parse(raw);                   // varies
    const valid = rows.filter(r => this.validate(r)); // varies
    await this.persist(valid);                      // varies
    await this.cleanup(filePath);                   // shared default
    return { total: rows.length, imported: valid.length };
  }

  protected abstract read(path: string): Promise<string>;
  protected abstract parse(raw: string): T[];
  protected abstract validate(row: T): boolean;
  protected abstract persist(rows: T[]): Promise<void>;

  protected async cleanup(path: string): Promise<void> { await fs.unlink(path); }
}

class CsvUserImportJob extends ImportJob<UserRow> { /* implement the four */ }
```

**Backend usage.** Import/export jobs, report generation, multi-step webhook
processing, ETL pipelines.

**When not to use it.** When the skeleton itself varies, or when subclasses start
overriding `run()` — that means the template was wrong. This is the one common
pattern that *requires* inheritance, so the composition-over-inheritance caution
applies: a function taking a set of callbacks (`runImport({ read, parse, validate, persist })`)
gives the same benefit with looser coupling and is often the better TypeScript choice.

---

### Chain of Responsibility  · IMPORTANT

**Problem.** A request should pass through a series of handlers, any of which may
handle it or pass it along.

**Solution.** Link handlers; each decides to handle or delegate.

```ts
type Middleware<Ctx> = (ctx: Ctx, next: () => Promise<void>) => Promise<void>;

function chain<Ctx>(middlewares: Middleware<Ctx>[]): (ctx: Ctx) => Promise<void> {
  return (ctx) => {
    let index = -1;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const mw = middlewares[i];
      if (!mw) return;
      await mw(ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
  };
}

const pipeline = chain<RequestContext>([
  authenticate,
  authorize,
  rateLimit,
  validateSchema,
  handle,
]);
```

**Backend usage.** Express/Koa middleware, validation pipelines, approval
workflows (amount thresholds escalating through approvers), message processing.

**When not to use it.** When handler order encodes hidden business rules nobody
documented, or when every handler always runs — then it is just a list of
function calls and the indirection buys nothing.

---

### State  · IMPORTANT

**Problem.** An object behaves differently depending on its state, and the logic
has become a nest of conditionals repeated across methods.

**Solution.** Represent each state as an object that knows its own legal transitions.

**Before:**

```ts
cancel() {
  if (this.status === 'PAID') throw new Error('...');
  if (this.status === 'SHIPPED') throw new Error('...');
  if (this.status === 'CANCELLED') throw new Error('...');
  // and the same three checks appear in ship(), refund(), complete()
}
```

**After — the transition table form, which is usually best in TypeScript:**

```ts
type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
type OrderAction = 'pay' | 'ship' | 'deliver' | 'cancel';

const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderAction, OrderStatus>>> = {
  PENDING:   { pay: 'PAID', cancel: 'CANCELLED' },
  PAID:      { ship: 'SHIPPED', cancel: 'CANCELLED' },
  SHIPPED:   { deliver: 'DELIVERED' },
  DELIVERED: {},
  CANCELLED: {},
};

class Order {
  #status: OrderStatus = 'PENDING';

  apply(action: OrderAction): void {
    const next = TRANSITIONS[this.#status][action];
    if (!next) {
      throw new DomainError('INVALID_TRANSITION', `Cannot ${action} an order in ${this.#status}`);
    }
    this.#status = next;
  }
}
```

The entire state machine is now one readable table, the illegal transitions are
impossible, and adding a `RETURNED` state is a table edit.

**Backend usage.** Order lifecycle, payment status, subscription states, document
approval, job status, ticket workflows.

**When not to use it.** Two states and one transition. A boolean is fine.

---

### Repository  · MUST KNOW

**Problem.** Business logic should not know about SQL, tables or ORM specifics.

**Solution.** A collection-like interface over persistence, expressed in domain
terms. (Covered structurally in Phase 9.1 and 9.3; here is the LLD view.)

```ts
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findPendingOlderThan(date: Date): Promise<Order[]>;
  save(order: Order): Promise<void>;
  nextId(): OrderId;
}
```

Two design rules that separate a real repository from an ORM proxy:

1. **Methods express business questions**, not query shapes. `findPendingOlderThan`
   is good; `findWhere(conditions, joins, limit)` is a query builder wearing a
   costume.
2. **It returns domain objects**, never rows, and never leaks ORM entities with
   lazy-loading proxies into business code.

**When not to use it.** A small service with no domain model, where the ORM *is*
your data layer and you have accepted that coupling. Wrapping Prisma in a
repository that has one method per Prisma call adds a file and buys nothing.

---

### Unit of Work  · IMPORTANT

**Problem.** A business operation touches several repositories and must commit or
roll back as one atomic unit — but business code must not handle raw connections.

**Solution.** An object that tracks work and commits it together.

```ts
interface UnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}

interface Repositories {
  orders: OrderRepository;
  inventory: InventoryRepository;
  ledger: LedgerRepository;
}

class MySqlUnitOfWork implements UnitOfWork {
  constructor(private readonly pool: Pool) {}

  async run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await work({
        orders: new MySqlOrderRepository(conn),
        inventory: new MySqlInventoryRepository(conn),
        ledger: new MySqlLedgerRepository(conn),
      });
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

// Usage — business code never sees a connection
await this.uow.run(async ({ orders, inventory, ledger }) => {
  await inventory.decrement(items);
  const order = await orders.save(newOrder);
  await ledger.record(order.id, order.total);
});
```

**Backend usage.** Checkout, transfers, any multi-table write, saga step
persistence.

**When not to use it.** Single-repository operations — the repository's own method
can manage its transaction. Also unusable as-is across separate databases or
services, where you need sagas and compensating actions instead (Phase 17).

---

### Pattern selection cheat sheet

| Symptom in your code | Reach for |
|---|---|
| Growing `if/switch` on a type or mode | Strategy (or a function map) |
| Growing `if/switch` on *which class to build* | Factory |
| `if (status === ...)` repeated across many methods | State |
| Third-party SDK types appearing in business code | Adapter |
| Adding caching/retry/logging to something you don't want to edit | Decorator |
| Callers must call 5 services in the right order | Facade |
| "When X happens, also do Y, Z, and later W" | Observer |
| Operation must be queued, retried, audited or undone | Command |
| Four jobs with the same skeleton, different steps | Template Method (or callbacks) |
| Request passes through auth → validation → handling | Chain of Responsibility |
| Constructor with 8 positional arguments | Builder (or an options object) |
| SQL strings inside business logic | Repository |
| Multi-table write needing atomicity | Unit of Work |
| "There should be only one of these" | Composition root + DI, *not* Singleton |

### Patterns — Interview answer

> I think of patterns as named solutions to recurring problems rather than things
> to apply upfront. The ones I use most in backend work are Strategy for
> interchangeable algorithms like pricing or rate limiting, Factory when the
> choice of implementation is itself a decision, Adapter for every third-party SDK
> so vendor types never reach my domain, Decorator for cross-cutting concerns like
> caching and retries around a port, Observer for decoupling side effects from the
> operation that triggered them, and Repository plus Unit of Work for data access
> and transactional boundaries. The one I'm most cautious about is Singleton — in
> Node I get single-instance behaviour from the composition root and dependency
> injection without the hidden global state and untestability.

### Patterns — Practice problems

1. Take a file with a `switch` of 5+ branches and convert it to Strategy with a
   registry. Then add a sixth case and verify no existing file changed.
2. Implement caching, retry and metrics as three independent decorators around one
   repository interface. Write a test proving the order of composition changes
   observable behaviour.
3. Build the typed `EventBus` above and wire two subscribers to `order.placed`.
   Make one throw; assert the other still runs.
4. Replace an order-status conditional mess with the transition table. Write a
   test that asserts every illegal transition throws.
5. Implement `UnitOfWork` and use it for a checkout touching three repositories.
   Force a failure in the third and assert the first two rolled back.
6. Find a Singleton in a codebase and convert it to constructor injection. Note
   what it made testable.
7. Write a test-data builder (`anOrder().paid().withLines(3).build()`) and use it
   to replace repetitive test setup.
8. Wrap two payment providers behind one `PaymentGateway` port with adapters that
   normalise units *and* errors. Write one test suite that runs against both.

### Patterns — Production considerations

- **Name classes after the domain, not the pattern.** `TokenBucketRateLimiter`
  beats `RateLimitStrategyImpl`. `CachingUserRepository` is fine — the pattern
  name earns its place only when it describes what the class *is*.
- **Document the composition root.** With decorators and factories, the assembly
  is where behaviour actually lives; a reader who only sees classes cannot tell
  what the system does.
- **Debugging cost.** Deep decorator chains and event-driven flows make stack
  traces less useful. Compensate with structured logging and a correlation ID
  carried through the chain.
- **Do not pattern-ise a spike.** Write the direct version, learn the axis of
  change, then refactor. Patterns applied before the requirement is understood are
  the single most common source of over-engineered backend code.

---

## 10.4 LLD Practice Problems

### How to approach any LLD problem

The roadmap asks for requirements, entities, interfaces, class diagram,
relationships, patterns, error cases, extensibility and unit tests for every
problem. In an interview you have 35–45 minutes, so the order matters. Use this
sequence:

1. **Clarify and scope (5 min).** Ask about scale, multi-instance, persistence,
   and which features are out of scope. Then *state your assumptions out loud* and
   write them down. Candidates who start coding immediately fail here.
2. **Identify entities and value objects (5 min).** Nouns from the requirements,
   filtered — not every noun is a class. Decide which have identity (entities) and
   which are defined by value (value objects).
3. **Define interfaces (5 min).** The variation points. This is where you signal
   OCP awareness: "pricing will vary, so `PricingStrategy` is an interface."
4. **Sketch relationships (5 min).** Association / aggregation / composition,
   multiplicities, and the direction of dependencies.
5. **Code the core (15 min).** The most interesting class, fully, with invariants
   enforced. Not every class — depth beats breadth.
6. **Error cases and concurrency (5 min).** What happens on a double-booking, a
   duplicate request, a crash mid-operation.
7. **Extensibility (3 min).** "If you asked me to add X, here is the one class I'd
   add." Interviewers almost always ask this; having it ready is a strong finish.

**The grading criteria**, roughly: do invalid states exist in your model? Does a
new requirement need a new class or an edit to an old one? Are concurrency and
error paths considered at all? Can you name the trade-offs you chose?

---

### Worked example 1 — Parking Lot

**Requirements (after clarification)**

Functional: multiple floors; spot types (motorcycle, compact, large, EV); park a
vehicle in the nearest suitable spot; unpark; issue a ticket at entry; charge on
exit by duration and spot type; multiple entry/exit gates; display free counts per
floor.

Assumptions stated: single physical lot, single process, ~10k spots, payments
handled by an external gateway, no reservations in v1.

**Entities and value objects**

| Type | Kind | Notes |
|---|---|---|
| `ParkingLot` | Entity (aggregate root) | Owns floors |
| `ParkingFloor` | Entity | Owns spots (composition) |
| `ParkingSpot` | Entity | Has type, occupancy |
| `Vehicle` | Entity | Licence plate is the identity |
| `Ticket` | Entity | Issued at entry, closed at exit |
| `Money` | Value object | Amount + currency |
| `Duration` | Value object | Derived from entry/exit times |

**Interfaces (the variation points)**

```ts
interface SpotAllocationStrategy { findSpot(floors: ParkingFloor[], v: Vehicle): ParkingSpot | null }
interface PricingStrategy        { calculate(ticket: Ticket, exitAt: Date): Money }
interface PaymentProcessor       { charge(amount: Money, ref: string): Promise<PaymentResult> }
interface TicketRepository       { save(t: Ticket): Promise<void>; findActive(id: string): Promise<Ticket | null> }
```

**Relationships**

```
ParkingLot ◆──── ParkingFloor ◆──── ParkingSpot        (composition: spots die with the lot)
ParkingSpot ────o Vehicle                              (association: vehicle exists independently)
Ticket ────────o Vehicle, ParkingSpot                  (association)
EntryGate ────▷ uses SpotAllocationStrategy            (dependency)
ExitGate ─────▷ uses PricingStrategy, PaymentProcessor
```

**Core code**

```ts
type SpotType = 'MOTORCYCLE' | 'COMPACT' | 'LARGE' | 'EV';
type VehicleType = 'MOTORCYCLE' | 'CAR' | 'TRUCK' | 'ELECTRIC_CAR';

const FITS: Record<VehicleType, SpotType[]> = {
  MOTORCYCLE:   ['MOTORCYCLE', 'COMPACT', 'LARGE'],
  CAR:          ['COMPACT', 'LARGE'],
  ELECTRIC_CAR: ['EV', 'COMPACT', 'LARGE'],
  TRUCK:        ['LARGE'],
};

class ParkingSpot {
  #occupiedBy: string | null = null;

  constructor(
    public readonly id: string,
    public readonly floorNumber: number,
    public readonly type: SpotType,
  ) {}

  get isFree(): boolean { return this.#occupiedBy === null; }

  canFit(vehicle: Vehicle): boolean {
    return this.isFree && FITS[vehicle.type].includes(this.type);
  }

  occupy(vehicle: Vehicle): void {
    if (!this.isFree) throw new DomainError('SPOT_TAKEN', this.id);
    if (!FITS[vehicle.type].includes(this.type)) throw new DomainError('SPOT_INCOMPATIBLE', this.id);
    this.#occupiedBy = vehicle.licencePlate;
  }

  release(): void {
    if (this.isFree) throw new DomainError('SPOT_ALREADY_FREE', this.id);
    this.#occupiedBy = null;
  }
}

class Ticket {
  #exitAt: Date | null = null;

  private constructor(
    public readonly id: string,
    public readonly licencePlate: string,
    public readonly spotId: string,
    public readonly spotType: SpotType,
    public readonly entryAt: Date,
  ) {}

  static issue(id: string, vehicle: Vehicle, spot: ParkingSpot, now: Date): Ticket {
    return new Ticket(id, vehicle.licencePlate, spot.id, spot.type, now);
  }

  close(now: Date): void {
    if (this.#exitAt) throw new DomainError('TICKET_ALREADY_CLOSED', this.id);
    if (now < this.entryAt) throw new DomainError('INVALID_EXIT_TIME', this.id);
    this.#exitAt = now;
  }

  get isClosed(): boolean { return this.#exitAt !== null; }
  get exitAt(): Date | null { return this.#exitAt; }
}

// Strategy — nearest-first allocation
class NearestFirstAllocation implements SpotAllocationStrategy {
  findSpot(floors: ParkingFloor[], vehicle: Vehicle): ParkingSpot | null {
    for (const floor of floors) {              // floors sorted by proximity to entry
      const spot = floor.findFreeSpotFor(vehicle);
      if (spot) return spot;
    }
    return null;
  }
}

// Strategy — hourly pricing with a per-type rate and a daily cap
class HourlyPricing implements PricingStrategy {
  constructor(
    private readonly hourlyRate: Record<SpotType, number>,
    private readonly dailyCap: number,
    private readonly freeMinutes = 15,
  ) {}

  calculate(ticket: Ticket, exitAt: Date): Money {
    const minutes = Math.ceil((exitAt.getTime() - ticket.entryAt.getTime()) / 60_000);
    if (minutes <= this.freeMinutes) return Money.zero('INR');

    const hours = Math.ceil(minutes / 60);
    const days = Math.floor(hours / 24);
    const remainder = hours % 24;
    const rate = this.hourlyRate[ticket.spotType];

    const amount = days * this.dailyCap + Math.min(remainder * rate, this.dailyCap);
    return Money.of(amount, 'INR');
  }
}

class EntryGate {
  constructor(
    private readonly lot: ParkingLot,
    private readonly allocation: SpotAllocationStrategy,
    private readonly tickets: TicketRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async park(vehicle: Vehicle): Promise<Ticket> {
    const spot = this.allocation.findSpot(this.lot.floors, vehicle);
    if (!spot) throw new DomainError('LOT_FULL', vehicle.type);

    spot.occupy(vehicle);
    const ticket = Ticket.issue(this.ids.next(), vehicle, spot, this.clock.now());
    await this.tickets.save(ticket);
    return ticket;
  }
}
```

**Error cases**

- Lot full for that vehicle type → `LOT_FULL` (note: full for trucks but not bikes).
- Lost ticket → flat maximum-day charge, needs a separate `LostTicketPricing` strategy.
- Exit without payment → gate stays closed; ticket remains open.
- Vehicle already parked (same plate) → reject at entry.
- Payment fails mid-exit → ticket stays open, spot stays occupied, retry possible.
- **Concurrency:** two gates allocating the same spot. In one process, the
  `occupy()` guard catches it; across processes you need `SELECT ... FOR UPDATE`
  or an atomic `UPDATE spots SET occupied_by = ? WHERE id = ? AND occupied_by IS NULL`
  checking `affectedRows`. Mention this — it is the most common follow-up question.

**Extensibility (have this ready)**

- Reservations → add `ReservationService` + a `ReservedSpotAllocation` strategy.
- Valet parking → new `EntryGate` variant, same core.
- Dynamic surge pricing → new `PricingStrategy`, zero edits elsewhere.
- Monthly passes → `PricingStrategy` that returns zero for pass holders.

Every one of those is a *new class*. That is the signal the design is right.

**Unit tests to write**

```ts
it('rejects a truck when only compact spots are free', ...);
it('charges nothing within the free window', ...);
it('applies the daily cap for a 30-hour stay', ...);
it('prevents occupying an already-occupied spot', ...);
it('prevents closing a ticket twice', ...);
it('frees the spot on exit', ...);
```

---

### Worked example 2 — Rate Limiter (condensed)

**Requirements.** Limit requests per API key; multiple algorithms; distributed
across N Node instances; low latency; fail-open on limiter outage.

**Interfaces**

```ts
interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}
```

**Token bucket, in-memory**

```ts
class TokenBucketLimiter implements RateLimiter {
  #buckets = new Map<string, { tokens: number; lastRefill: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly clock: Clock,
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = this.clock.now().getTime();
    const bucket = this.#buckets.get(key) ?? { tokens: this.capacity, lastRefill: now };

    const elapsedSec = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.refillPerSecond);
    bucket.lastRefill = now;

    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.#buckets.set(key, bucket);

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetAt: new Date(now + ((this.capacity - bucket.tokens) / this.refillPerSecond) * 1000),
      retryAfterMs: allowed ? undefined : Math.ceil((1 - bucket.tokens) / this.refillPerSecond * 1000),
    };
  }
}
```

**Key design points to raise**

- **Distributed correctness.** In-memory means N instances allow N× the limit. The
  real implementation is a Redis Lua script performing refill-and-consume
  atomically — mention this explicitly.
- **Decorator for fail-open:** `new FailOpenLimiter(new RedisLimiter(...))` returns
  `allowed: true` when Redis is down, so the limiter cannot take down the API.
- **Strategy** for algorithm choice; **Factory** for per-tier configuration
  (free / pro / enterprise).
- **Memory leak:** the in-memory map grows unbounded. Needs LRU eviction or TTL.
- Return `X-RateLimit-*` headers and `429` with `Retry-After`.

---

### The remaining problems

For each: the sharpest requirement to clarify, the entities that matter, the
patterns that fit naturally, and the follow-up the interviewer will probably ask.

**3. Library management**
Clarify: reservations? fines? multiple copies of a title?
Entities: `Book` (the title) vs `BookCopy` (the physical item — getting this
distinction right is the main signal), `Member`, `Loan`, `Reservation`, `Fine`.
Patterns: State (loan lifecycle), Strategy (fine calculation), Observer (notify
next in reservation queue on return), Repository.
Follow-up: "Two members reserve the last copy simultaneously."

**4. Elevator system**
Clarify: number of cars, floors, request types (hall call vs car call), optimise
for wait time or throughput?
Entities: `Elevator`, `Request`, `FloorPanel`, `ElevatorController`.
Patterns: State (IDLE/MOVING_UP/MOVING_DOWN/DOORS_OPEN), Strategy (scheduling —
SCAN/LOOK vs nearest-car), Observer (floor displays), Command (queued requests).
Follow-up: "Now there are 4 elevators — how do you assign requests?" (This is
really a scheduling-algorithm question; have SCAN ready.)

**5. Vending machine**
Clarify: change-making? card payments? partial refunds?
Entities: `Machine`, `Slot`, `Product`, `Inventory`, `CoinBank`, `Transaction`.
Patterns: **State is the core** (IDLE → COIN_INSERTED → DISPENSING → CHANGE) —
this is the canonical State-pattern problem; Strategy (payment method).
Follow-up: "Insufficient change available — what happens?" and "power cut
mid-dispense."

**6. Hotel booking**
Clarify: overbooking allowed? cancellation windows? room types vs specific rooms?
Entities: `Hotel`, `RoomType`, `Room`, `Booking`, `Guest`, `RatePlan`.
Patterns: Strategy (pricing/seasonal rates, cancellation policy), State (booking
lifecycle), Repository, Unit of Work.
Follow-up: **"Two guests book the last room at the same moment."** This is the
whole question — answer with a DB-level unique constraint on
(room, date-range) or a conditional update, not application-level checking.

**7. Notification system**
Clarify: delivery guarantees? user preferences? rate limiting? templates?
Entities: `Notification`, `Template`, `Recipient`, `Channel`, `DeliveryAttempt`,
`Preference`.
Patterns: Strategy/Adapter (channels), Observer (triggering events), Chain of
Responsibility (preference → quiet hours → rate limit → send), Decorator (retry),
Template Method (render → validate → send → record).
Follow-up: "The SMS provider is down for 10 minutes." (Queue + retry with
exponential backoff + dead-letter queue.)

**8. Payment gateway**
Clarify: which providers? refunds? idempotency? webhooks? multi-currency?
Entities: `Payment`, `Refund`, `Money`, `PaymentMethod`, `Transaction`, `Webhook`.
Patterns: Adapter (per provider — the central one), Strategy (provider routing),
State (payment lifecycle), Command (retryable operations), Observer (webhook fan-out).
Follow-up: **"The network drops after you charge but before you get a response."**
Answer: idempotency keys, a `PENDING` state, and a reconciliation job. Getting
this right matters more than the class diagram.

**9. Logger**
Clarify: levels, sinks, structured or text, async, sampling?
Entities: `LogRecord`, `Logger`, `Level`, `Sink`, `Formatter`.
Patterns: Strategy (formatter), Observer/Chain (multiple sinks), Decorator
(context enrichment, sampling), Factory (child loggers).
Follow-up: "Logging is now 15% of request latency." (Async buffered writes,
sampling, dropping under backpressure.) Note the Singleton trap here — a
module-level logger instance is acceptable; a `Logger.getInstance()` with mutable
config is not.

**10. File storage service**
Clarify: max size, multipart, deduplication, access control, CDN?
Entities: `File`, `FileVersion`, `Bucket`, `UploadSession`, `AccessPolicy`.
Patterns: Adapter (S3/GCS/local), Abstract Factory (provider family), Strategy
(chunking, deduplication by content hash), Decorator (encryption, compression),
Facade (upload orchestration).
Follow-up: "Uploading a 5GB file over a flaky connection." (Chunked/resumable
upload with an `UploadSession` tracking received parts.)

**11. Task scheduler**
Clarify: cron or delay-based? distributed? at-least-once or exactly-once? missed
executions?
Entities: `Task`, `Schedule`, `Execution`, `Worker`, `Trigger`.
Patterns: Command (the task), Strategy (scheduling policy), Observer (lifecycle
hooks), Template Method (execution pipeline), Decorator (retry, timeout).
Follow-up: "Three workers pick up the same task." (Distributed lock or atomic
claim: `UPDATE tasks SET claimed_by=? WHERE id=? AND claimed_by IS NULL`.)

**12. Meeting room booking**
Clarify: recurring meetings? time zones? capacity and equipment constraints?
Entities: `Room`, `Booking`, `TimeSlot` (value object), `User`, `RecurrenceRule`.
Patterns: Strategy (room-selection and conflict rules), Observer (invites),
Repository, Specification (composable availability filters).
Follow-up: "Handle a recurring weekly meeting where one instance is moved." The
interesting modelling problem is the exception-to-recurrence, not the CRUD.

**13. Chess / board game**
Clarify: full rules (castling, en passant, promotion)? undo? AI? time control?
Entities: `Board`, `Square`, `Piece` (abstract), concrete pieces, `Move`,
`Player`, `Game`.
Patterns: **Strategy or polymorphism for move generation per piece** (the main
signal — never a `switch (piece.type)`), Command (moves, enabling undo), State
(game state: active/check/checkmate/stalemate/draw), Memento (board snapshots),
Factory (piece creation from FEN).
Follow-up: "Implement undo" (Command history) and "detect checkmate" (generate all
legal moves for the side to move; none legal + in check = mate).

**14. Food delivery order lifecycle**
Clarify: who can cancel and when? partial refunds? rider assignment? live tracking?
Entities: `Order`, `Restaurant`, `MenuItem`, `Customer`, `Rider`, `Delivery`,
`Payment`.
Patterns: **State (the core — PLACED → ACCEPTED → PREPARING → PICKED_UP →
DELIVERED, plus cancellation paths)**, Strategy (rider assignment, delivery
pricing/surge), Observer (status updates to customer, restaurant, rider),
Saga/Command (compensating actions on cancellation).
Follow-up: "Customer cancels after the restaurant started cooking." This is the
real question: it is a compensation problem — partial refund policy, restaurant
compensation, and a state machine that models *who* may cancel in *which* state.

---

### 10.4 — Production considerations

- **Concurrency is where LLD meets reality.** Nearly every problem above has a
  "two actors, one resource" moment: the last parking spot, the last hotel room,
  the same task claimed twice. Application-level checking (`if (spot.isFree)`)
  is a race condition across processes. The answers are database constraints,
  conditional updates checking `affectedRows`, `SELECT ... FOR UPDATE`, or a
  distributed lock. Naming this unprompted separates strong candidates.
- **Idempotency.** Any operation reachable by retry — payments, notifications,
  job execution — needs an idempotency key and a stored result.
- **Persistence changes the model.** An in-memory `Map<string, Spot>` becomes a
  table with indexes and a locking strategy. Be ready to say how your entities map
  to tables (Phase 6.3) and where the transaction boundaries are (Phase 9).
- **Don't over-pattern the interview.** Two or three well-justified patterns beat
  eight name-dropped ones. Say *why*: "pricing will change seasonally, so I'll make
  it a strategy" is worth more than the word "Strategy."
- **Write the invariants as tests.** For each problem, the test list is the
  requirements list. If a requirement has no test, it is not implemented.

---

## Phase 10 Completion Checklist

You are done with this phase when you can:

- [ ] Design a class where invalid state is unconstructable, and prove it with tests.
- [ ] Explain encapsulation, abstraction, inheritance and polymorphism with a
      backend example each — not a shape or animal example.
- [ ] State the difference between association, aggregation and composition and
      classify relationships in your own codebase.
- [ ] Justify composition over inheritance and name the case where inheritance is
      still right.
- [ ] Give a real bad-design/good-design pair for each SOLID principle.
- [ ] Name the trade-off and the failure mode of over-applying each principle.
- [ ] Recognise from a code smell which pattern applies — using the cheat sheet
      from memory.
- [ ] Implement Factory, Strategy, Adapter, Decorator, Observer and Repository in
      TypeScript without reference.
- [ ] Explain why Singleton is usually replaced by DI in a Node backend.
- [ ] Take any of the 14 problems and produce requirements, entities, interfaces,
      relationships, patterns, error cases and extensibility in 40 minutes.
- [ ] Identify the concurrency hazard in a design and propose a database-level fix.
- [ ] Explain when *not* to use a pattern, for at least six patterns.

**Next:** Phase 11 — High-Level Design. Phase 10 was the shape of classes inside
one process; Phase 11 is the shape of services, data stores and traffic across
many.

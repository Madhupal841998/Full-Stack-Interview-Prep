# Phase 7 — ORM, Query Builders and Data Access

> Part of the *Zero to Expert Backend Engineering Master Roadmap*
> Prerequisites: **Phase 6 (MySQL and SQL)** — non-negotiable. Also Phase 2 (TypeScript), Phase 4 (Node.js Core), Phase 5 (Express).
> Stack assumed: **Node.js + TypeScript + MySQL 8**. Examples use `mysql2`, **Knex** (query builder), **Prisma** and **TypeORM**.

---

## How to Read This Phase

Every topic follows the roadmap's 12-step order:

1. Proper definition
2. Simple meaning
3. Why it is needed
4. How it works internally
5. Syntax and API
6. Small example
7. Real backend usage
8. Edge cases
9. Common mistakes
10. Interview answer
11. Practice problem
12. Production considerations

Priority legend:

| Tag | Meaning |
|---|---|
| **MUST KNOW** | Required for backend development and interviews |
| **IMPORTANT** | Strongly recommended for professional work |
| **GOOD TO KNOW** | Useful after the core is clear |
| **SKIP FOR NOW** | Learn later when the role requires it |

### Phase 7 priority summary

| Section | Priority |
|---|---|
| 7.1 Raw SQL vs Query Builder vs ORM | MUST KNOW |
| 7.2 Driver level — `mysql2` | MUST KNOW |
| 7.3 Query builders — Knex | IMPORTANT |
| 7.4 ORMs — Prisma and TypeORM | MUST KNOW (one of them, deeply) |
| 7.5 Repository pattern and data-access design | MUST KNOW |
| 7.6 Transactions in the chosen library | MUST KNOW |
| 7.7 N+1, eager vs lazy loading | MUST KNOW |
| 7.8 Migrations and seeding | MUST KNOW |
| 7.9 Connection pooling in practice | MUST KNOW |
| 7.10 Query logging and observability | IMPORTANT |
| 7.11 Preventing SQL injection | MUST KNOW |

### The governing rule of this phase

> **Understand SQL first. Do not depend on an ORM to hide database fundamentals.**
>
> An ORM is a translator, not a replacement for knowing the language. The engineers who get burned by ORMs are the ones who never learned what the generated SQL does. You finished Phase 6, so you can now read what your ORM writes and tell whether it is a query or an incident.
>
> The test for this phase: **for every ORM call you make, you should be able to predict the SQL it emits.** If you cannot, turn on query logging and look (§7.10) until you can.

---

## 7.1 Raw SQL vs Query Builder vs ORM

**Priority: MUST KNOW**

### Definition

- **Raw SQL** — you write SQL strings; the driver sends them and returns rows.
- **Query builder** — a fluent API that composes SQL programmatically. Thin, predictable, returns plain rows. (Knex, Kysely)
- **ORM (Object-Relational Mapper)** — maps database tables to application objects, manages relations, identity, change tracking and lifecycle. (Prisma, TypeORM, Sequelize, MikroORM)

### Simple meaning

Raw SQL is speaking the database's language directly. A query builder is a phrasebook. An ORM is a translator who also carries your luggage and occasionally reorganises it without telling you.

### Why it is needed

Every backend needs a data-access layer. The question is not "ORM or not" but **which layer for which query**. Choosing badly gives you either thousands of lines of string concatenation or a service that issues 400 queries to render a list page.

### How it works internally — the object-relational impedance mismatch

Relational databases and object graphs are different shapes, and the ORM's job is to bridge them:

| Object world | Relational world | The friction |
|---|---|---|
| Object references | Foreign keys | Following a reference may or may not be a query |
| Inheritance | No native concept | Single-table / class-table / concrete-table strategies |
| Collections | Join result sets | One-to-many joins multiply rows (Phase 6, §6.2) |
| Identity by reference | Identity by primary key | Identity map / unit of work needed |
| Lazy graph traversal | Set-based operations | **This is the source of the N+1 problem** |

That last row is the whole story. Objects encourage "walk the graph one step at a time"; SQL rewards "ask for the whole set at once". Every ORM performance problem traces back to it.

An ORM typically implements:

- **Identity map** — one in-memory object per primary key per unit of work.
- **Unit of work** — batches your changes and flushes them at commit (TypeORM's `EntityManager`; Prisma deliberately omits this).
- **Change tracking** — diffing loaded entities to generate `UPDATE` statements.
- **Hydration** — turning flat result rows back into a nested object graph.

Prisma is notably *not* a classical ORM: no lazy loading, no change tracking, no proxies. It is a generated, type-safe query client. This makes it more predictable and is a major reason for its popularity.

### The comparison

| | Raw SQL (`mysql2`) | Query builder (Knex) | ORM (Prisma / TypeORM) |
|---|---|---|---|
| Control over SQL | Total | High | Low to medium |
| Type safety | Manual | Partial | Strong (Prisma: generated) |
| Dynamic queries | Painful string building | Excellent | Good |
| Relations | Manual joins and mapping | Manual | Automatic |
| Migrations | Hand-written | Built in | Built in |
| Learning curve | SQL only | SQL + API | API + its abstractions + SQL anyway |
| Performance ceiling | Highest | Near-highest | Good if used carefully |
| Failure mode | Verbose, injection risk if careless | Mostly predictable | Hidden N+1, over-fetching, surprise queries |
| Refactor safety | Low (strings) | Medium | High |
| Portability | Low | High | High |

### The decision rule (say this in an interview)

> "I use the ORM for the 80% of CRUD that is straightforward, because it gives type safety, migrations and relation handling cheaply. I drop to raw SQL for the 20% that is analytical or performance-critical — reports, window functions, bulk operations, anything where I need to control the exact plan. The important part is that both go through the same repository layer, so the rest of the application doesn't know or care which one was used."

This hybrid is what production systems actually look like. Purity in either direction is a warning sign.

### Small example — the same query three ways

```ts
// 1. Raw SQL (mysql2)
const [rows] = await pool.execute(
  `SELECT o.id, o.total, u.email
     FROM orders o
     JOIN users u ON u.id = o.user_id
    WHERE o.status = ? AND o.created_at >= ?
    ORDER BY o.created_at DESC
    LIMIT ?`,
  ['paid', since, 20]
);

// 2. Query builder (Knex)
const rows = await knex('orders as o')
  .join('users as u', 'u.id', 'o.user_id')
  .select('o.id', 'o.total', 'u.email')
  .where('o.status', 'paid')
  .where('o.created_at', '>=', since)
  .orderBy('o.created_at', 'desc')
  .limit(20);

// 3. ORM (Prisma)
const rows = await prisma.order.findMany({
  where: { status: 'paid', createdAt: { gte: since } },
  select: { id: true, total: true, user: { select: { email: true } } },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
```

Note what the third one hides: Prisma may issue **two queries** here (one for orders, one for the related users) rather than a join. That is not wrong — it is often faster than a join that multiplies rows — but you must know it happens. Log it and look.

### Real backend usage

```ts
// Typical split inside one repository
class OrderRepository {
  // CRUD → ORM
  findById(id: bigint) {
    return this.prisma.order.findUnique({ where: { id } });
  }

  // Analytics → raw SQL, because window functions and index control matter
  async monthlyRevenue(from: Date, to: Date) {
    return this.prisma.$queryRaw<MonthlyRow[]>`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
             SUM(total)                       AS revenue,
             COUNT(DISTINCT user_id)          AS customers
        FROM orders
       WHERE status = 'paid' AND created_at >= ${from} AND created_at < ${to}
       GROUP BY month
       ORDER BY month`;
  }
}
```

### Edge cases

- ORMs struggle with: window functions, recursive CTEs, `INSERT ... ON DUPLICATE KEY UPDATE` with complex conditions, index hints, bulk `UPDATE ... JOIN`, and anything needing a specific query plan.
- Multi-tenant row-level filtering is easy to forget in raw SQL and easy to centralise in an ORM middleware — a real argument for the ORM.
- Soft delete (Phase 6, §6.3) is a shared filter: centralise it, or you will leak deleted rows from one forgotten query.

### Common mistakes

1. Choosing an ORM to avoid learning SQL. You will learn SQL anyway, under incident pressure.
2. Refusing an ORM on principle and hand-writing 4,000 lines of mapping code.
3. Letting ORM calls leak into controllers, so the data layer cannot be changed or tested.
4. Using raw SQL with string interpolation because the builder felt awkward (§7.11).
5. Never once looking at the generated SQL.

### Interview answer

> "A query builder composes SQL programmatically but returns plain rows — it's a thin, predictable layer. An ORM additionally maps rows to an object graph and manages relations, and often identity and change tracking, which is where the impedance mismatch shows up: object traversal is one-at-a-time, SQL is set-based, and that mismatch is exactly what produces N+1 queries.
>
> In practice I use an ORM for CRUD and raw SQL for reports and hot paths, both behind a repository interface. The non-negotiable part is that I know what SQL my ORM emits — I keep query logging on in development and check the plan with EXPLAIN for anything on a hot path."

**Frequently asked:**

- ORM vs query builder vs raw SQL — when do you use each?
- What is the object-relational impedance mismatch?
- What are the downsides of an ORM?
- Is Prisma an ORM? (It is marketed as one but omits lazy loading and change tracking — it is a generated query client, which is why it's more predictable.)
- Can you mix raw SQL with an ORM? How do you keep it safe?

### Practice problem

Implement the same feature — "list a user's paid orders with item counts, paginated" — three ways: raw `mysql2`, Knex, and Prisma. Log the SQL each produces. Compare query count, row count and latency at 1 million rows.

### Production considerations

- Standardise on one approach per service; mixing three in one codebase is a maintenance tax.
- Whatever you choose, keep an escape hatch to raw SQL. You will need it.
- Pin the ORM version and read the changelog — ORMs change generated SQL between minor versions.

---

## 7.2 Driver Level — `mysql2`

**Priority: MUST KNOW**

### Definition

A driver implements the database's wire protocol: it opens TCP connections, authenticates, serialises statements, and parses result packets into JavaScript values.

### Simple meaning

The lowest layer. Everything above it — Knex, Prisma, TypeORM — eventually calls something like this.

### Why it is needed

Every abstraction above leaks eventually. When Prisma throws a connection error or you need a query the ORM cannot express, you are at this layer. Understanding it also makes pooling (§7.9) and injection prevention (§7.11) concrete rather than magical.

### How it works internally

```
pool.execute(sql, params)
  → acquire a connection from the pool (or wait / queue)
  → PREPARE the statement (cached per connection by SQL text)
  → EXECUTE with the bound parameter values sent separately
  → read result packets → map column types → JS values
  → release the connection back to the pool
```

**`query` vs `execute` — a real distinction:**

| | `pool.query()` | `pool.execute()` |
|---|---|---|
| Mechanism | Client-side escaping, interpolated into the SQL string | Server-side **prepared statement**; SQL and data sent separately |
| Injection safety | Safe if you use `?` placeholders (escaping is correct) | Safe structurally |
| Repeated calls | Re-parsed every time | Plan cached per connection |
| Supports | Multiple statements (if enabled), some edge syntax | Stricter; placeholders cannot replace identifiers |

**Default to `execute`.** Use `query` only where prepared statements do not apply (e.g. some DDL, or `LIMIT` handling quirks in older versions).

### Syntax and API

```ts
import mysql, { type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50,              // fail fast rather than queue forever
  connectTimeout: 10_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,

  timezone: 'Z',               // interpret DATETIME as UTC (Phase 6, §6.1)
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: false,
  decimalNumbers: false,       // keep DECIMAL as string — do NOT lose precision on money
  namedPlaceholders: true,
});
```

```ts
// SELECT
interface UserRow extends RowDataPacket {
  id: number; email: string; display_name: string;
}
const [rows] = await pool.execute<UserRow[]>(
  'SELECT id, email, display_name FROM users WHERE status = ? LIMIT ?',
  ['active', 20]
);

// INSERT / UPDATE / DELETE
const [res] = await pool.execute<ResultSetHeader>(
  'INSERT INTO users (email, display_name) VALUES (?, ?)',
  ['a@x.com', 'Ana']
);
res.insertId;      // new AUTO_INCREMENT id
res.affectedRows;  // rows changed — check this for conditional updates
res.changedRows;   // rows whose values actually differed

// Named placeholders
const [r] = await pool.execute(
  'SELECT * FROM orders WHERE user_id = :userId AND status = :status',
  { userId: 42, status: 'paid' }
);
```

### Type mapping — the gotchas that bite

| MySQL | JS default | Watch out |
|---|---|---|
| `BIGINT` | `number` (or string with `supportBigNumbers`) | Values above 2⁵³ lose precision. Use `bigNumberStrings: true` or BigInt handling |
| `DECIMAL` | `string` by default | **Keep it as string** and use a decimal library. Converting to `number` reintroduces float error on money |
| `TINYINT(1)` | `number` (0/1) | Not a boolean; convert explicitly |
| `DATETIME` | `Date` | Depends on the `timezone` option — set it to `'Z'` and store UTC |
| `JSON` | parsed object | Already parsed; do not `JSON.parse` again |
| `BINARY(16)` | `Buffer` | Convert to/from UUID string at the boundary |

### Streaming large result sets

Loading a million rows into an array is how you OOM a Node process (Phase 4.4 on streams applies directly):

```ts
const conn = await pool.getConnection();
try {
  const stream = conn.connection.query('SELECT * FROM events WHERE created_at < ?', [cutoff]).stream();
  for await (const row of stream) {
    await handle(row);        // backpressure is handled by the async iterator
  }
} finally {
  conn.release();
}
```

### Small example — a thin typed helper

```ts
export async function selectRows<T extends RowDataPacket>(
  sql: string, params: unknown[] = []
): Promise<T[]> {
  const [rows] = await pool.execute<T[]>(sql, params);
  return rows;
}

export async function selectOne<T extends RowDataPacket>(
  sql: string, params: unknown[] = []
): Promise<T | null> {
  const rows = await selectRows<T>(sql, params);
  return rows[0] ?? null;
}
```

### Edge cases

- `LIMIT ?` with a string parameter fails or behaves oddly; coerce to a number and validate it.
- Placeholders cannot substitute **identifiers** (table or column names) — see §7.11 for the allowlist pattern.
- `IN (?)` with an array does not expand under `execute`; build `IN (?, ?, ?)` from the array length.
- A connection that errors mid-transaction may be destroyed rather than returned to the pool.
- `multipleStatements: true` is an injection amplifier. Leave it off.
- Prepared statement cache is per connection and bounded; thousands of distinct SQL texts thrash it — another reason to use placeholders rather than embedding values.

### Common mistakes

1. Using `pool.query` with template literals instead of placeholders.
2. Forgetting `conn.release()` in a `finally` → pool exhaustion (Phase 6, §6.5).
3. Converting `DECIMAL` money to a JS `number`.
4. Not setting `timezone: 'Z'`, then debugging a 5.5-hour offset for two days.
5. Loading unbounded result sets into memory instead of streaming or paginating.
6. Leaving `connectionLimit` at a value that, multiplied by instance count, exceeds `max_connections`.

### Interview answer

> "`mysql2` is the driver, so it speaks the MySQL wire protocol and everything above it eventually goes through something like it. I use `execute` rather than `query` because it uses server-side prepared statements — the SQL and the parameter values travel separately, which makes injection structurally impossible and lets the server cache the plan. The details I'm careful about are type mapping — DECIMAL stays a string so money doesn't go through a float, BIGINT can exceed Number.MAX_SAFE_INTEGER — and always releasing connections in a finally block, because a leaked connection inside a transaction holds locks and eventually exhausts the pool."

**Frequently asked:**

- `query` vs `execute` in mysql2?
- What is a prepared statement and why is it safer?
- How do you handle `BIGINT` and `DECIMAL` in Node?
- How would you process 10 million rows without running out of memory?
- What happens when the pool is exhausted?

### Practice problem

Write a typed `mysql2` wrapper with `selectRows`, `selectOne`, `insert` and `withTransaction`. Add a helper that safely expands an array into an `IN (...)` clause. Prove with a test that passing `"1 OR 1=1"` as a parameter does not return extra rows.

### Production considerations

- Set a query timeout; a hung query holds a connection indefinitely.
- Emit a metric for pool wait time — rising wait time is the earliest signal of database trouble.
- Handle `PROTOCOL_CONNECTION_LOST` and reconnect; pools do this, single connections do not.
- Never enable `multipleStatements` in production.

---

## 7.3 Query Builders — Knex

**Priority: IMPORTANT**

### Definition

A query builder provides a chainable API that compiles to SQL, giving you programmatic composition and dialect portability without the mapping layer of an ORM.

### Simple meaning

SQL you build with functions instead of strings — so you can add a `WHERE` clause conditionally without concatenating text.

### Why it is needed

The problem query builders solve is **dynamic queries**. A list endpoint with six optional filters, three sort options and cursor pagination is miserable in raw SQL string building and awkward in some ORMs. In a builder it is a few `if` statements.

### How it works internally

Each chained call appends to an internal AST. `.toSQL()` compiles it to a parameterised statement plus a bindings array. Nothing executes until you `await` the builder (it is a thenable) or call `.then()`.

That "lazy until awaited" behaviour is why you can pass a half-built query around and keep adding to it — and why a forgotten `await` silently does nothing.

### Syntax and API

```ts
import knexFactory from 'knex';

export const knex = knexFactory({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: 'Z',
  },
  pool: { min: 2, max: 10, acquireTimeoutMillis: 10_000 },
});
```

```ts
// SELECT with joins
const rows = await knex('orders as o')
  .join('users as u', 'u.id', 'o.user_id')
  .leftJoin('order_items as oi', 'oi.order_id', 'o.id')
  .select('o.id', 'u.email')
  .count('oi.id as item_count')
  .where('o.status', 'paid')
  .whereBetween('o.created_at', [from, to])
  .groupBy('o.id', 'u.email')
  .havingRaw('COUNT(oi.id) > ?', [2])
  .orderBy('o.created_at', 'desc')
  .limit(20);

// Insert / update / delete
const [id] = await knex('users').insert({ email, display_name: name });
const changed = await knex('users').where({ id }).update({ status: 'suspended' });
const removed = await knex('users').where({ id }).del();

// Upsert
await knex('user_settings')
  .insert({ user_id: 7, theme: 'dark' })
  .onConflict('user_id')
  .merge(['theme']);

// Raw escape hatch — still parameterised
const rows2 = await knex.raw(
  'SELECT * FROM orders WHERE created_at >= ? AND JSON_EXTRACT(meta, ?) = ?',
  [from, '$.channel', 'web']
);
```

### The killer feature — conditional composition

```ts
interface OrderFilters {
  status?: string;
  userId?: number;
  minTotal?: number;
  from?: Date;
  search?: string;
  sort?: 'newest' | 'oldest' | 'highest';
  cursor?: { createdAt: Date; id: number };
  limit?: number;
}

function buildOrderQuery(f: OrderFilters, tenantId: number) {
  const q = knex('orders as o')
    .select('o.id', 'o.total', 'o.status', 'o.created_at')
    .where('o.tenant_id', tenantId)        // tenant scope — never optional
    .whereNull('o.deleted_at');            // soft-delete filter — centralised

  if (f.status)   q.where('o.status', f.status);
  if (f.userId)   q.where('o.user_id', f.userId);
  if (f.minTotal) q.where('o.total', '>=', f.minTotal);
  if (f.from)     q.where('o.created_at', '>=', f.from);
  if (f.search)   q.whereILike('o.reference', `${f.search}%`);   // prefix only — sargable

  // Keyset pagination (Phase 6, §6.4)
  if (f.cursor) {
    q.where(function () {
      this.where('o.created_at', '<', f.cursor!.createdAt)
          .orWhere(function () {
            this.where('o.created_at', f.cursor!.createdAt)
                .andWhere('o.id', '<', f.cursor!.id);
          });
    });
  }

  const sortMap = {
    newest:  ['o.created_at', 'desc'],
    oldest:  ['o.created_at', 'asc'],
    highest: ['o.total', 'desc'],
  } as const;
  const [col, dir] = sortMap[f.sort ?? 'newest'];   // allowlist, never user input directly

  return q.orderBy(col, dir).orderBy('o.id', 'desc').limit(Math.min(f.limit ?? 20, 100));
}
```

Two things to notice, because they are the marks of a careful engineer:

- The tenant scope and soft-delete filter are applied unconditionally in the builder function, not left to each caller.
- The sort column comes from an **allowlist map**, never from the request string (§7.11).

### Inspecting the SQL

```ts
console.log(buildOrderQuery(filters, 1).toString());
const { sql, bindings } = buildOrderQuery(filters, 1).toSQL();
```

Do this routinely. It is the habit that makes a builder safe.

### Real backend usage

- Admin list endpoints with many optional filters — the canonical fit.
- Reporting queries too dynamic for an ORM but too structured for strings.
- Migrations (Knex's migration system is solid and works even if you use Prisma elsewhere).
- A shared base query that every repository extends with tenant and soft-delete scoping.

### Edge cases

- Forgetting to `await` — the query never runs and no error is thrown.
- `knex.raw` inside a builder is not automatically parameterised unless you pass bindings — `.whereRaw(\`x = ${v}\`)` is an injection hole.
- Nested `where` callbacks use `function` with `this`, not arrow functions.
- `.count()` returns a driver-specific shape (`[{ 'count(*)': 5 }]`); destructure carefully.
- Transactions require passing the `trx` object to every query, or it runs outside the transaction (§7.6).
- Builders returning `any`-ish types by default — declare result generics or you lose type safety.

### Common mistakes

1. `whereRaw` with template literals.
2. Passing `req.query.sortBy` straight into `.orderBy()`.
3. Building the query but forgetting the tenant filter in one branch.
4. Reusing a builder instance after awaiting it (it is single-use; clone with `.clone()`).
5. Treating Knex as an ORM and expecting relation loading — it has none by design.

### Interview answer

> "A query builder compiles a chainable API into parameterised SQL. Its real advantage over raw strings is dynamic composition — an endpoint with six optional filters is a handful of `if` statements instead of string concatenation, and every value still goes through bindings, so it stays injection-safe. Unlike an ORM it doesn't map relations or track changes, which makes the emitted SQL completely predictable. I put shared scoping — tenant ID, soft-delete filter — into the base builder function so no caller can forget it, and I allowlist anything that becomes an identifier, like a sort column, because placeholders can't parameterise identifiers."

**Frequently asked:**

- Query builder vs ORM?
- How do you build a query with optional filters safely?
- Is `knex.raw` safe? Under what conditions?
- How do you inspect generated SQL?

### Practice problem

Build a `GET /orders` endpoint with Knex supporting: status, user, date range, min total, prefix search, three sort options, cursor pagination, tenant scoping and soft-delete filtering. Print `.toSQL()` for four filter combinations and run `EXPLAIN` on each (Phase 6, §6.4). Add the indexes the plans demand.

### Production considerations

- Keep a single shared base-query function per table; duplicated scoping logic is a data-leak waiting to happen.
- Cap `limit` server-side. A client-supplied `limit=100000` is a denial-of-service.
- Knex migrations are a valid choice even in a Prisma project if you need full SQL control.

---

## 7.4 ORMs — Prisma and TypeORM

**Priority: MUST KNOW (learn one deeply; know the other exists)**

### Definition

An ORM maps database tables to application-level types, generates SQL for relation traversal and CRUD, and manages schema through migrations.

### Prisma

**Model.** A declarative schema file is the single source of truth; a code generator produces a fully typed client.

```prisma
// schema.prisma
generator client { provider = "prisma-client-js" }
datasource db   { provider = "mysql"; url = env("DATABASE_URL") }

model User {
  id          BigInt    @id @default(autoincrement())
  email       String    @unique @db.VarChar(255)
  displayName String    @map("display_name") @db.VarChar(100)
  status      String    @default("active") @db.VarChar(20)
  createdAt   DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  deletedAt   DateTime? @map("deleted_at") @db.DateTime(3)
  orders      Order[]

  @@map("users")
  @@index([status, createdAt])
}

model Order {
  id        BigInt      @id @default(autoincrement())
  userId    BigInt      @map("user_id")
  status    String      @default("pending") @db.VarChar(20)
  total     Decimal     @db.Decimal(12, 2)
  createdAt DateTime    @default(now()) @map("created_at") @db.DateTime(3)
  user      User        @relation(fields: [userId], references: [id])
  items     OrderItem[]

  @@map("orders")
  @@index([userId, createdAt])
  @@index([status, createdAt])
}
```

**Querying.**

```ts
// Read with explicit field selection — avoids SELECT *
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, displayName: true },
});

// Relations: include (whole relation) vs select (chosen fields)
const withOrders = await prisma.user.findMany({
  where: { status: 'active', deletedAt: null },
  include: {
    orders: {
      where: { status: 'paid' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
  },
  take: 20,
});

// Aggregates and grouping
const stats = await prisma.order.groupBy({
  by: ['status'],
  where: { createdAt: { gte: from } },
  _count: { _all: true },
  _sum: { total: true },
});

// Writes
await prisma.user.create({ data: { email, displayName: name } });
await prisma.user.update({ where: { id }, data: { status: 'suspended' } });
await prisma.user.upsert({
  where: { email },
  create: { email, displayName: name },
  update: { displayName: name },
});
const { count } = await prisma.order.updateMany({
  where: { status: 'pending', createdAt: { lt: cutoff } },
  data: { status: 'expired' },
});

// Nested write in one transaction (implicitly transactional)
await prisma.order.create({
  data: {
    userId,
    total: new Prisma.Decimal('1499.00'),
    items: { create: [{ productId: 1n, qty: 2, unitPrice: new Prisma.Decimal('749.50') }] },
  },
});

// Raw escape hatch — tagged template is parameterised
const rows = await prisma.$queryRaw<Row[]>`
  SELECT user_id, SUM(total) AS revenue
    FROM orders WHERE created_at >= ${from}
   GROUP BY user_id HAVING SUM(total) > ${threshold}`;
```

**What Prisma does and does not do:**

- No lazy loading — a relation is loaded only if you ask. **This structurally prevents accidental N+1 from property access**, which is a genuine design advantage.
- No change tracking / unit of work — you state the update explicitly.
- `include` on a to-many relation issues a **separate query per relation** and joins in memory, not a SQL join. Two queries for a parent + one child relation, regardless of parent count. That is good (no row multiplication) but means you cannot filter parents by child aggregates without raw SQL.
- `Decimal` is a `Prisma.Decimal` object (decimal.js), not a `number`. Good — money keeps precision.
- `BigInt` fields come back as JS `BigInt`, which `JSON.stringify` cannot serialise. You need a serialiser.

```ts
// BigInt serialisation — needed in almost every Prisma + Express app
app.set('json replacer', (_k: string, v: unknown) =>
  typeof v === 'bigint' ? v.toString() : v);
```

### TypeORM

**Model.** Decorator-based entities; closer to a classical ORM (Active Record or Data Mapper, your choice).

```ts
@Entity('orders')
@Index(['userId', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total!: string;                                 // keep DECIMAL as string

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3 })
  deletedAt?: Date;                               // enables built-in soft delete

  @ManyToOne(() => User, (u) => u.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: ['insert'] })
  items!: OrderItem[];
}
```

```ts
const repo = dataSource.getRepository(Order);

// Find API
const orders = await repo.find({
  where: { status: 'paid', createdAt: MoreThanOrEqual(from) },
  relations: { user: true, items: true },
  order: { createdAt: 'DESC' },
  take: 20,
});

// QueryBuilder — for anything non-trivial
const rows = await repo.createQueryBuilder('o')
  .innerJoin('o.user', 'u')
  .select(['o.id', 'o.total', 'u.email'])
  .where('o.status = :status', { status: 'paid' })
  .andWhere('o.createdAt >= :from', { from })
  .orderBy('o.createdAt', 'DESC')
  .limit(20)
  .getMany();

// Soft delete built in
await repo.softDelete(id);
await repo.find({ withDeleted: true });
```

TypeORM has **lazy relations** (via `Promise<T>` properties) and **eager relations** (`eager: true`), which is exactly where N+1 sneaks in (§7.7).

### Choosing

| | Prisma | TypeORM |
|---|---|---|
| Schema source | `schema.prisma` (declarative) | Decorated entity classes |
| Type safety | Generated, excellent | Good, but `find` options are loosely typed |
| Lazy loading | None (by design) | Yes — N+1 risk |
| Change tracking | No | Yes |
| Raw SQL | `$queryRaw` tagged template | `query()` / QueryBuilder |
| Migrations | `prisma migrate` (generated from schema diff) | Generated or hand-written |
| Complex SQL | Weaker; drop to raw | Stronger QueryBuilder |
| Predictability | High | Medium |
| Best for | New TypeScript services, teams wanting safety | Existing OOP-style codebases, complex entity graphs |

Others worth knowing by name: **Sequelize** (older, JS-first), **MikroORM** (proper unit of work + identity map), **Drizzle** and **Kysely** (type-safe, builder-shaped, very predictable SQL).

### Edge cases

- Prisma `include` on deeply nested relations can produce a surprising number of queries — check the log.
- Prisma's `findMany` with a relation filter may generate a subquery, not a join; the plan differs.
- TypeORM's `find` with `relations` uses joins and **can multiply rows** for to-many relations; `getMany()` de-duplicates but `take`/`limit` then applies to raw rows unless you use `.take()` (which switches to a two-query strategy) rather than `.limit()`. This distinction causes real bugs.
- Decorator metadata requires `emitDecoratorMetadata` and `reflect-metadata` imported first.
- Prisma's connection pool is managed by the query engine (`connection_limit` in the URL), not by `mysql2` (§7.9).
- Enum handling differs between the ORM's type and MySQL's storage; prefer `VARCHAR + CHECK` (Phase 6, §6.3).

### Common mistakes

1. Using `include` everywhere and over-fetching entire object graphs on a list endpoint.
2. Treating Prisma `Decimal` as a `number` and losing money precision.
3. `JSON.stringify` on a result containing `BigInt` → runtime `TypeError`.
4. TypeORM `.limit()` vs `.take()` on a query with to-many joins.
5. Enabling `synchronize: true` in TypeORM outside a throwaway local database — it will silently drop columns.
6. Letting `PrismaClient` be instantiated per request — each instance creates its own pool.

```ts
// Correct: one client for the process
export const prisma = globalThis.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;
```

### Interview answer

> "Prisma is schema-first: you declare models in a schema file and it generates a fully typed client. Importantly it has no lazy loading and no change tracking, so relations load only when you ask for them — that removes an entire class of accidental N+1 bugs, at the cost of a weaker story for complex SQL, where I drop to `$queryRaw`. TypeORM is a more classical ORM with entity decorators, lazy and eager relations, change tracking and a powerful QueryBuilder; it's more flexible and more dangerous, because a property access can silently issue a query.
>
> Whichever I use, the rules are the same: select only the fields I need, keep DECIMAL out of JS floats, keep a single client instance per process, and check the generated SQL for anything on a hot path."

**Frequently asked:**

- Prisma vs TypeORM — pick one and justify it.
- What is lazy loading and why is it dangerous?
- How do you run raw SQL from an ORM safely?
- What is `synchronize` and why should it never be on in production?
- How does Prisma handle `Decimal` and `BigInt`?

### Practice problem

Model users, orders, order_items and a many-to-many products↔tags in both Prisma and TypeORM. Implement the same three endpoints in each. Log and compare the SQL for a list endpoint with relations included.

### Production considerations

- One ORM client per process, created at startup, disconnected on `SIGTERM` (graceful shutdown, Phase 4.5).
- Never `synchronize: true`; always migrations.
- Pin the version; regenerate the client in CI so a stale generated client cannot ship.
- Add a startup health check that runs `SELECT 1` through the ORM.

---

## 7.5 Repository Pattern and Data-Access Design

**Priority: MUST KNOW**

### Definition

The repository pattern places a collection-like interface between the domain/service layer and the data source, so business logic depends on an abstraction rather than on a specific database library.

### Simple meaning

One place per entity that knows how to load and save it. Nothing else in the app talks to the database.

### Why it is needed

Without it, ORM calls scatter across controllers. Then: you cannot unit-test a service without a database, you cannot change ORM or add caching without touching 80 files, and the tenant/soft-delete filter gets forgotten in exactly one place — which is the one that leaks data.

### How it works internally

```
Controller  →  Service (business rules, transactions)  →  Repository (data access)  →  ORM/driver  →  MySQL
     ↑ HTTP concerns only        ↑ knows nothing about SQL      ↑ the only layer that writes queries
```

**Dependency direction points inward.** The service depends on a repository *interface*; the concrete Prisma or Knex implementation is injected. This is the Phase 9/10 material (dependency inversion) applied to data access.

### Syntax and structure

```ts
// domain/order.ts — a domain type, not an ORM entity
export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  totalMinor: bigint;
  currency: string;
  createdAt: Date;
}

// domain/ports/order-repository.ts — the interface the service depends on
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUser(userId: string, page: Cursor): Promise<Page<Order>>;
  create(input: NewOrder, tx?: Tx): Promise<Order>;
  updateStatus(id: string, from: OrderStatus, to: OrderStatus, tx?: Tx): Promise<boolean>;
}
```

```ts
// infrastructure/prisma-order-repository.ts — the only file that knows about Prisma
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly db: PrismaClient, private readonly tenantId: string) {}

  private get scope() {
    return { tenantId: this.tenantId, deletedAt: null };     // applied everywhere, once
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.order.findFirst({ where: { id: BigInt(id), ...this.scope } });
    return row ? toDomain(row) : null;
  }

  async findByUser(userId: string, page: Cursor): Promise<Page<Order>> {
    const rows = await this.db.order.findMany({
      where: { userId: BigInt(userId), ...this.scope },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
      ...(page.cursor && { cursor: { id: BigInt(page.cursor) }, skip: 1 }),
    });
    const hasMore = rows.length > page.limit;
    return { items: rows.slice(0, page.limit).map(toDomain), hasMore };
  }

  async updateStatus(id, from, to, tx?): Promise<boolean> {
    const client = (tx as PrismaClient) ?? this.db;
    const { count } = await client.order.updateMany({
      where: { id: BigInt(id), status: from, ...this.scope },   // conditional update
      data: { status: to },
    });
    return count === 1;        // false ⇒ someone else changed it ⇒ 409 (Phase 6, §6.5)
  }
}
```

```ts
// application/place-order.ts — the service knows nothing about Prisma
export class PlaceOrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly inventory: InventoryRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(input: PlaceOrderInput): Promise<Order> {
    return this.uow.run(async (tx) => {
      const reserved = await this.inventory.reserve(input.productId, input.qty, tx);
      if (!reserved) throw new OutOfStockError(input.productId);
      return this.orders.create({ ...input }, tx);
    });
  }
}
```

### Mapping: persistence model ≠ domain model

The `toDomain` function is not ceremony. It is where you:

- convert `BINARY(16)` to a UUID string, `Decimal` to your money type, `TINYINT(1)` to boolean;
- drop columns the domain has no business knowing about;
- turn a nullable database column into an explicit optional or a default.

On small projects you may skip this and return ORM types directly — a legitimate trade-off. State it as a conscious decision, not an oversight.

### Where transactions belong

**In the service layer, not the repository.** A repository method should work standalone *or* inside a caller's transaction — hence the optional `tx` parameter. The service decides the boundary because only the service knows the business operation (§7.6).

### Testing benefit

```ts
// An in-memory fake — no database, millisecond tests
class InMemoryOrderRepository implements OrderRepository {
  private rows = new Map<string, Order>();
  async findById(id: string) { return this.rows.get(id) ?? null; }
  async create(input: NewOrder) {
    const order = { ...input, id: randomUUID(), createdAt: new Date() } as Order;
    this.rows.set(order.id, order);
    return order;
  }
  /* … */
}

it('rejects an order when stock is insufficient', async () => {
  const service = new PlaceOrderService(new InMemoryOrderRepository(), emptyInventory, noopUow);
  await expect(service.execute(input)).rejects.toThrow(OutOfStockError);
});
```

Note: an in-memory fake tests business logic, not SQL. You still need integration tests against a real MySQL (Testcontainers or a Docker service) for the repository implementations themselves.

### Edge cases

- **Leaky abstraction:** if `OrderRepository` grows `findWithPrismaInclude()`, the abstraction has failed. Keep methods domain-shaped.
- **Over-abstraction:** a repository with 40 methods, one per query, is worse than a query builder. Consider a `find(criteria)` method or the specification pattern.
- Cross-aggregate reads (a dashboard joining six tables) do not fit the repository shape — use a dedicated **read model / query service** with raw SQL. CQRS-lite, and completely legitimate.
- Repositories should not return paginated ORM types that force the caller to know the ORM.

### Common mistakes

1. ORM calls in controllers.
2. Repositories that return ORM entities with lazy relations still attached — the abstraction leaks and N+1 escapes into the service layer.
3. Starting transactions inside repository methods, making composition impossible.
4. One giant `DatabaseService` instead of per-aggregate repositories.
5. Duplicating the tenant/soft-delete filter in every method instead of a shared private `scope`.
6. Building an elaborate repository layer for a 3-endpoint service. Match the ceremony to the stakes.

### Interview answer

> "The repository pattern gives me a collection-like interface per aggregate, so services depend on an interface rather than on Prisma or Knex. Three concrete benefits: I can unit-test business logic with an in-memory fake instead of a database; shared concerns like tenant scoping and the soft-delete filter live in one place so no query can forget them; and swapping the data source or adding caching touches one file.
>
> Transaction boundaries belong in the service layer, not the repository, because only the service knows what constitutes one business operation — so repository methods take an optional transaction handle. The trap to avoid is a leaky abstraction: the moment a method signature mentions ORM concepts, the pattern has stopped paying for itself. And for cross-aggregate reporting queries I don't force them through repositories at all — those get a separate read model with raw SQL."

**Frequently asked:**

- What is the repository pattern and why use it?
- Where do transactions belong?
- Isn't an ORM already a repository? (It's a generic one; a repository is domain-specific and hides the ORM)
- How do you test the service layer without a database?
- Active Record vs Data Mapper.

### Practice problem

Refactor an existing Express project so that no controller imports the ORM. Define `UserRepository` and `OrderRepository` interfaces, implement them with Prisma, write in-memory fakes, and unit-test one service with zero database access. Then add a second implementation with Knex and prove the service tests still pass unchanged.

### Production considerations

- Instrument at the repository layer — one place to add timing metrics, slow-query logging and tracing spans for every query in the system.
- Add caching here too (read-through), not in the controller.
- Repository method names should read like the domain (`findActiveByTenant`), not like SQL (`selectWhereStatusEquals`).

---

## 7.6 Transactions in the Chosen Library

**Priority: MUST KNOW**

### Definition

A library-level transaction API acquires a dedicated connection, issues `BEGIN`, exposes a scoped client for all statements in the unit of work, and issues `COMMIT` or `ROLLBACK`.

### Simple meaning

The Phase 6 transaction rules, expressed in whichever library you chose — with one recurring trap: **every statement must use the transaction handle, not the global client.**

### Why it is needed

This is the single most common ORM bug in production code. Statements that accidentally use the pool instead of the transaction run outside it: they are not rolled back, they do not see the transaction's uncommitted work, and they can deadlock against it.

### How it works internally

```
tx.begin()
  → acquire ONE connection from the pool, pin it
  → BEGIN
  → every statement must be sent on THAT connection
  → COMMIT or ROLLBACK
  → release the connection
```

Any statement sent on a different connection is a different transaction. That is the whole trap.

### Syntax — all four libraries

```ts
// mysql2 — explicit
async function withTransaction<T>(pool: Pool, fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
```

```ts
// Knex
await knex.transaction(async (trx) => {
  const [orderId] = await trx('orders').insert({ user_id: userId, total });
  await trx('order_items').insert(items.map(i => ({ ...i, order_id: orderId })));
  // throwing rolls back automatically; returning commits
});
```

```ts
// Prisma — interactive transaction
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: { userId, total } });
  const { count } = await tx.inventory.updateMany({
    where: { productId, qty: { gte: needed } },
    data: { qty: { decrement: needed } },
  });
  if (count !== 1) throw new OutOfStockError();   // rollback
  return order;
}, { timeout: 5_000, maxWait: 2_000, isolationLevel: 'ReadCommitted' });

// Prisma — sequential batch (array form): all-or-nothing, but no logic between statements
await prisma.$transaction([
  prisma.order.create({ data: a }),
  prisma.auditLog.create({ data: b }),
]);
```

```ts
// TypeORM
await dataSource.transaction(async (manager) => {
  const order = manager.create(Order, { userId, total });
  await manager.save(order);
  await manager.update(Inventory, { productId }, { qty: () => 'qty - 1' });
});
```

### The trap, made explicit

```ts
// BROKEN — the second statement runs OUTSIDE the transaction
await prisma.$transaction(async (tx) => {
  await tx.order.create({ data });
  await prisma.inventory.update({ ... });      // ← `prisma`, not `tx`. Not rolled back.
});

// BROKEN — Knex version of the same bug
await knex.transaction(async (trx) => {
  await trx('orders').insert(a);
  await knex('inventory').decrement('qty', 1);  // ← `knex`, not `trx`
});
```

TypeScript will not catch this, because both objects have the same shape. Defences:

- A lint rule banning the global client inside a `$transaction` callback.
- Passing `tx` down explicitly through repository method signatures (§7.5) rather than relying on a global.
- Code review checklist item.

### A Unit of Work wrapper

To keep the transaction type out of your service layer:

```ts
export interface UnitOfWork { run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>; }

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly db: PrismaClient) {}
  run<T>(fn: (tx: Tx) => Promise<T>) {
    return this.db.$transaction((tx) => fn(tx as Tx), { timeout: 5_000 });
  }
}
```

Now the service writes `this.uow.run(...)` and repositories accept an optional `tx` — no service file imports Prisma.

### Transaction rules (restating Phase 6, §6.5 because this is where they get violated)

1. **Keep transactions short** — milliseconds. Locks are held the whole time.
2. **No network I/O inside**: no payment gateway, no S3 upload, no queue publish, no email. Use the **outbox pattern** (Phase 6, §6.6) for the event.
3. **No user interaction** inside.
4. Acquire locks in a consistent order (ascending PK) to avoid deadlocks.
5. **Retry deadlocks** (error 1213) and lock-wait timeouts (1205) with exponential backoff and jitter.
6. Do not run DDL inside — it implicitly commits.
7. Read-only work does not need a transaction.

```ts
async function withDeadlockRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (err: any) {
      const code = err?.errno ?? err?.code;
      const retryable = code === 1213 || code === 1205 || err?.meta?.code === '1213';
      if (!retryable || i >= attempts - 1) throw err;
      await sleep(50 * 2 ** i + Math.random() * 50);
    }
  }
}
```

### Nested transactions

MySQL has no true nested transactions. Libraries emulate them with **savepoints**:

- Knex: `trx.transaction()` creates a savepoint.
- TypeORM: nested `transaction()` reuses the outer one.
- Prisma: nested `$transaction` calls are **not** supported inside an interactive transaction — restructure so the boundary is at the top.

Design so the boundary is set once, at the service entry point.

### Edge cases

- Prisma's interactive transaction has a **default 5-second timeout**; a slow transaction aborts with `P2028`. Tune deliberately, do not raise it to hide a problem.
- Prisma's array-form `$transaction` cannot branch on intermediate results.
- `maxWait` governs how long to wait for a connection before `BEGIN`; under pool pressure this is what fails first.
- An unhandled rejection inside the callback can leave the connection pinned until timeout.
- Isolation level set per transaction overrides the session default; confirm what your library defaults to.
- Serverless/lambda: transactions plus connection limits interact badly — use a proxy or a data proxy.

### Common mistakes

1. Using the global client inside the transaction callback.
2. `await fetch(paymentGateway)` inside a transaction.
3. Wrapping an entire HTTP request in one transaction "to be safe".
4. Swallowing the error, so the rollback happens but the caller thinks it succeeded.
5. Not checking `count`/`affectedRows` on a conditional update and assuming success.
6. No deadlock retry, so a normal concurrency event becomes a 500 for the user.
7. Starting a transaction in a repository, preventing two repositories from sharing one.

### Interview answer

> "A library transaction pins one connection, issues BEGIN, and every statement in that unit of work must go through the scoped handle — the classic bug is using the global client inside the callback, which silently runs outside the transaction and isn't rolled back. I put the boundary in the service layer behind a unit-of-work interface, so repositories take an optional transaction handle and can compose.
>
> The rules I keep are: transactions last milliseconds, no network calls inside — if I need to publish an event I write it to an outbox table in the same transaction and let a relay publish it — locks acquired in a consistent order, and deadlocks retried with backoff rather than surfaced as a 500, because under concurrency deadlocks are expected, not exceptional."

**Frequently asked:**

- How do you run a transaction in Prisma / TypeORM / Knex?
- What happens if you use the global client inside a transaction?
- Are nested transactions supported? (savepoints)
- Where should the transaction boundary live?
- Why shouldn't you call an external API inside a transaction?
- How do you handle deadlocks in application code?

### Practice problem

Build `POST /orders` that creates an order, decrements inventory conditionally, and writes an outbox row — all in one transaction. Prove with concurrent load (100 parallel requests for 10 units of stock) that stock never goes negative and exactly 10 orders succeed. Then deliberately introduce the global-client bug and show inventory drifting.

### Production considerations

- Alert on transaction duration p95 and on `P2028`/lock-wait-timeout rates.
- Set an explicit transaction timeout lower than your HTTP timeout.
- Log the deadlock retry count as a metric; a rising rate means contention that needs a design fix, not more retries.

---

## 7.7 The N+1 Problem, Eager vs Lazy Loading

**Priority: MUST KNOW — the defining performance topic of this phase**

### Definition

The N+1 query problem occurs when fetching N parent records issues one query, and then one additional query per parent to load a related collection — N+1 queries where 2 would do.

### Simple meaning

You asked for 50 users. The ORM asked the database 51 times.

### Why it is needed

This is *the* ORM failure mode, and it is the most common cause of "the endpoint got slow as data grew". It is also a near-certain interview question. Each query is a network round trip (≈0.5–2 ms), so 200 queries is 200–400 ms of pure latency before any work happens — and in Node those are 200 sequential awaits.

### How it works internally

```ts
// 1 query
const users = await prisma.user.findMany({ take: 50 });

// + 50 queries (one per user)
for (const u of users) {
  u.orders = await prisma.order.findMany({ where: { userId: u.id } });
}
// Total: 51 queries
```

With lazy loading it is worse, because the query is invisible — it happens on **property access**:

```ts
// TypeORM lazy relation: this line issues a SQL query
const orders = await user.orders;    // looks like a property read, is a round trip
```

That invisibility is the argument for Prisma's design choice of no lazy loading.

### The three solutions

**1. Eager loading via the ORM (2 queries)**

```ts
const users = await prisma.user.findMany({
  take: 50,
  include: { orders: { where: { status: 'paid' }, take: 5 } },
});
// Prisma: SELECT users …; SELECT orders WHERE user_id IN (…) — then joins in memory
```

```ts
// TypeORM
const users = await repo.find({ relations: { orders: true }, take: 50 });
// Careful: this uses a JOIN and can multiply rows. Use .take() not .limit() in QueryBuilder.
```

**2. Manual batch + in-memory grouping (2 queries, full control)** — this is Phase 3's hash map and Phase 6's `IN (...)`:

```ts
const users = await prisma.user.findMany({ take: 50 });
const ids   = users.map(u => u.id);

const orders = await prisma.order.findMany({ where: { userId: { in: ids } } });

const byUser = new Map<bigint, Order[]>();
for (const o of orders) {
  const bucket = byUser.get(o.userId);
  bucket ? bucket.push(o) : byUser.set(o.userId, [o]);
}
const result = users.map(u => ({ ...u, orders: byUser.get(u.id) ?? [] }));
// O(n) grouping, 2 round trips.
```

**3. DataLoader — batching + per-request caching (for GraphQL and resolver-shaped code)**

```ts
import DataLoader from 'dataloader';

// Created PER REQUEST — never shared across requests
export function createOrdersByUserLoader(db: PrismaClient) {
  return new DataLoader<bigint, Order[]>(async (userIds) => {
    const rows = await db.order.findMany({ where: { userId: { in: [...userIds] } } });
    const byUser = new Map<bigint, Order[]>();
    for (const r of rows) (byUser.get(r.userId) ?? byUser.set(r.userId, []).get(r.userId)!).push(r);
    return userIds.map(id => byUser.get(id) ?? []);   // MUST return in the same order
  });
}

// Usage: each call looks like a single fetch; DataLoader coalesces them into one query per tick
const orders = await loaders.ordersByUser.load(user.id);
```

DataLoader batches all `.load()` calls made in the same event-loop tick into one call. It is the standard answer for GraphQL resolvers, where N+1 is structural.

> **Critical:** create loaders per request. A process-wide loader caches across users and leaks data between them — a security bug, not just a staleness bug.

### Eager vs lazy — the trade-off

| | Lazy loading | Eager loading |
|---|---|---|
| When the relation loads | On first access | With the parent query |
| Query count | 1 + N (the trap) | 1–2 |
| Over-fetching | None if unused | Fetches data you may not need |
| Predictability | Low — queries hide behind property reads | High |
| Best for | Rarely-accessed relations on a single entity | Lists, anything iterated |
| Danger | N+1, and queries firing after the request "finished" | Loading a huge object graph for a list view |

**The rule:** eager-load when you will iterate; load on demand when you touch one entity. Never lazy-load inside a loop.

### The other failure mode: over-fetching

The opposite mistake, and almost as common:

```ts
// BAD: pulls every column of every relation for a list endpoint
const users = await prisma.user.findMany({
  include: { orders: { include: { items: { include: { product: true } } } } },
});
// Two levels deep on 50 users can be thousands of rows and megabytes of JSON.
```

```ts
// GOOD: select exactly what the response needs
const users = await prisma.user.findMany({
  select: {
    id: true, email: true,
    _count: { select: { orders: true } },     // a count, not the rows
  },
  take: 50,
});
```

Ask what the API response actually contains, and fetch that. A list endpoint needs counts and summaries, not full child collections.

### Detecting N+1

```ts
// Development middleware: count queries per request and warn
let queryCount = 0;
prisma.$on('query', () => { queryCount++; });

app.use((req, res, next) => {
  const start = queryCount;
  res.on('finish', () => {
    const used = queryCount - start;
    if (used > 10) console.warn(`[N+1?] ${req.method} ${req.path} issued ${used} queries`);
  });
  next();
});
```

Also: APM traces (a staircase of identical spans is the visual signature), `sys.statement_analysis` ordered by `exec_count` (Phase 6, §6.4), and simply reading the dev query log.

### Real backend usage

```ts
// Order list endpoint — 2 queries regardless of page size
async function listOrders(userId: bigint, limit: number) {
  const orders = await prisma.order.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true, status: true, total: true, createdAt: true,
      _count: { select: { items: true } },       // item count without loading items
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return orders;
}
```

### Edge cases

- **N+1 in writes**: inserting 1,000 rows one at a time. Use `createMany` / a single multi-row `INSERT`.
- **Nested N+1**: 50 users → 50 order queries → 500 item queries. Fix the outermost level first.
- Serialisers and view layers can trigger lazy loads *after* the controller returns, producing queries outside the request's transaction or after the connection was released.
- `include` with a `where` on a to-many relation still loads all matching children for all parents — add `take`.
- A huge `IN (...)` list (10,000 ids) can defeat the optimiser; chunk into batches of ~1,000.
- Sometimes N+1 is fine: 3 parents, cached children, negligible cost. Measure before refactoring.

### Common mistakes

1. `await` inside a `for` loop over query results. This is the visual signature — treat it as a code smell every time.
2. Fixing N+1 by adding `include` everywhere, converting it into over-fetching.
3. Sharing a DataLoader across requests.
4. Returning loaders' promises without preserving order (DataLoader requires positional correspondence).
5. Only testing with 5 rows of seed data, where 6 queries and 2 queries both look instant.
6. Fixing it in one endpoint and leaving the same pattern in twenty others — add the detection middleware instead.

### Interview answer

> "N+1 is one query for the parents plus one per parent for a relation. It happens because object traversal is one-at-a-time while SQL is set-based, and lazy loading makes it invisible — a property access issues a round trip.
>
> I fix it three ways depending on context. Eager loading with `include` or `relations` when the ORM expresses it well. A manual batch — fetch parents, collect IDs, one `IN (...)` query for children, then group with a Map in O(n) — when I want control over the SQL. And DataLoader when the code is resolver-shaped, like GraphQL, because it coalesces loads made in the same tick into one query; I always create loaders per request, since a shared loader would leak one user's data into another's response.
>
> I also watch for the opposite mistake: fixing N+1 by including entire object graphs, which turns a query problem into a payload problem. I select the fields the response actually needs, and for counts I use a `_count` rather than loading the rows. In development I run a middleware that warns when a request issues more than ten queries."

**Frequently asked:**

- What is the N+1 problem? Give an example and three fixes.
- Eager vs lazy loading — trade-offs.
- What is DataLoader and how does batching work?
- Why must DataLoader be per request?
- How do you detect N+1 in production?
- When is N+1 acceptable?

### Practice problem

Build an endpoint that returns 50 users with their last 3 orders and each order's item count. Implement it three ways (naive loop, `include`, manual batch + Map). Seed 100,000 users and 2 million orders. Record query count, rows transferred and p95 latency for each. Then add the query-count middleware and make it fail CI if any endpoint exceeds 10 queries.

### Production considerations

- Add the query-count guard to your integration test suite, not just to dev logging.
- Trace every request with an APM; the N+1 staircase is instantly visible.
- Alert on `exec_count` spikes for a single statement digest.
- Remember the Phase 3 lesson: each avoided round trip is worth more than most in-memory optimisations.

---

## 7.8 Migrations and Seeding

**Priority: MUST KNOW**

### Definition

A migration is a versioned, ordered, committed script that transforms the database schema from one known state to the next. Seeding populates a database with reference or test data.

### Simple meaning

Version control for your schema. Everyone's database ends up in the same state, in the same order, reproducibly.

### Why it is needed

Without migrations: environments drift, "works on my machine" becomes a schema question, and nobody knows what production actually looks like. With them, schema changes go through code review like everything else.

### How it works internally

The tool keeps a metadata table (`_prisma_migrations`, `knex_migrations`, `typeorm_migrations`) recording which migrations have been applied and when. On deploy it computes the unapplied set and runs them in order inside a transaction where the engine allows it.

> **MySQL caveat:** DDL causes an implicit commit (Phase 6, §6.5), so MySQL migrations are **not** transactional. A migration that fails halfway leaves the schema partially changed. Keep each migration small and idempotent-ish, and always have a forward fix ready.

### Syntax — the three tools

```bash
# Prisma — edit schema.prisma, then:
npx prisma migrate dev --name add_orders_status_index   # dev: generate + apply
npx prisma migrate deploy                                # prod: apply pending only
npx prisma migrate status
npx prisma db pull                                       # introspect an existing DB
```

```ts
// Knex — full SQL control
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (t) => {
    t.string('currency', 3).notNullable().defaultTo('INR');
    t.index(['status', 'created_at'], 'idx_orders_status_created');
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (t) => {
    t.dropIndex(['status', 'created_at'], 'idx_orders_status_created');
    t.dropColumn('currency');
  });
}
```

```bash
# TypeORM
npx typeorm migration:generate -d ./src/data-source.ts src/migrations/AddCurrency
npx typeorm migration:run -d ./src/data-source.ts
```

### The rules

**1. Never modify a migration that has been applied anywhere but your laptop.** Write a new one. Editing an applied migration means environments silently diverge.

**2. Forward-only in production.** Write `down` for local development convenience, but recovery in production is a new forward migration. A `down` that drops a column destroys data.

**3. Migrations run before the new code deploys**, and must be compatible with the **currently running** code. This forces expand-migrate-contract.

**4. Expand → migrate → contract** for every breaking change (Phase 6, §6.3):

```
Release 1  add the new nullable column; deploy code that writes BOTH old and new
Backfill   chunked, throttled UPDATE of existing rows
Release 2  deploy code that reads the new column
Release 3  make it NOT NULL; stop writing the old column
Release 4  drop the old column
```

Never rename a column in one step. Add → dual-write → backfill → switch reads → drop.

**5. Backfills are not migrations.** A migration that runs `UPDATE orders SET currency='INR'` on 50 million rows holds locks and blocks writes for minutes. Move it to a chunked script:

```ts
// Chunked, throttled backfill — run as a job, not in the migration
let lastId = 0n;
for (;;) {
  const { count } = await prisma.$executeRaw`
    UPDATE orders SET currency = 'INR'
     WHERE currency IS NULL AND id > ${lastId} AND id <= ${lastId + 5000n}`;
  lastId += 5000n;
  if (lastId > maxId) break;
  await sleep(100);                           // let replication catch up
}
```

**6. Large `ALTER`s need an online strategy.** `ALGORITHM=INPLACE, LOCK=NONE`, `gh-ost` or `pt-online-schema-change` (Phase 6, §6.6). Know how long the migration will take against production-sized data *before* you run it.

**7. Test migrations against a production-sized copy.** A migration that takes 40 ms on 200 dev rows may take 40 minutes on 200 million.

**8. `synchronize: true` is not a migration strategy.** TypeORM's auto-sync will drop columns it thinks are unused. Local throwaway databases only.

### Seeding

```ts
// prisma/seed.ts — idempotent reference data
async function main() {
  // Reference data: idempotent upserts, safe to re-run
  for (const role of ['admin', 'trainer', 'learner']) {
    await prisma.role.upsert({ where: { name: role }, create: { name: role }, update: {} });
  }

  // Dev-only volume data — never in production
  if (process.env.NODE_ENV === 'development') {
    await prisma.user.createMany({
      data: Array.from({ length: 100_000 }, (_, i) => ({
        email: `user${i}@example.test`,
        displayName: `User ${i}`,
      })),
      skipDuplicates: true,
    });
  }
}
```

Distinguish three kinds:

| Kind | Where it runs | Property required |
|---|---|---|
| Reference data (roles, currencies, statuses) | All environments, including production | **Idempotent** — upsert, safe to re-run |
| Development fixtures | Local and staging | Realistic volume (Phase 6 §6.8 — seed at least a million rows) |
| Test fixtures | Test runs only | Fast, isolated, reset per test |

> **Seed realistically.** A 200-row dev database makes every missing index invisible. Most performance bugs ship because the developer never saw a slow query locally.

### Edge cases

- Two developers generate migrations on the same day; ordering conflicts at merge. Resolve by regenerating, not by editing timestamps.
- Prisma's `migrate dev` may propose a **reset** when it detects drift — never run that against anything shared.
- A migration that adds a `UNIQUE` index fails if existing data has duplicates; clean the data in a prior migration.
- Adding a `NOT NULL` column without a default fails on a non-empty table.
- Foreign keys added later fail if orphan rows exist.
- Rolling back a deploy does not roll back the migration — which is exactly why migrations must be backward-compatible.

### Common mistakes

1. Editing an already-applied migration.
2. Running a huge backfill inside the migration.
3. Renaming a column in one step and breaking the running code.
4. `synchronize: true` in a shared environment.
5. Manual `ALTER` on production that exists in no migration file — the next environment is now permanently different.
6. No seed data, or seed data that is not idempotent and fails on the second run.
7. Testing migrations only against an empty database.

### Interview answer

> "Migrations are versioned schema changes committed to the repository, applied in order, with a metadata table tracking what's been run. In MySQL they're not transactional, because DDL implicitly commits, so I keep each one small and always have a forward fix rather than relying on a down migration — production recovery is a new forward migration, never a rollback that drops a column.
>
> The rule that drives everything is that migrations run before the new code deploys and must be compatible with the currently running code. So any breaking change becomes expand-migrate-contract: add a nullable column, dual-write, backfill in throttled chunks outside the migration, switch reads, then drop the old column in a later release. For large tables I use an online schema change tool, and I always time the migration against a production-sized copy first."

**Frequently asked:**

- How do migrations work? What's in the metadata table?
- Why are MySQL migrations not transactional?
- How do you add a NOT NULL column to a 100-million-row table with no downtime?
- How do you rename a column safely?
- Why should you never edit an applied migration?
- What is `synchronize` and why is it dangerous?
- How do you seed data idempotently?

### Practice problem

Take the `orders` table from Phase 6 and, using expand-migrate-contract across four migrations plus a chunked backfill script, replace a `total DECIMAL(12,2)` column with `amount_minor BIGINT` + `currency CHAR(3)` — with the application running throughout. Seed a million rows first and time each step.

### Production considerations

- Run `migrate deploy` as a separate, gated CI/CD step before the application rollout, not on application boot (multiple instances racing to migrate is a known failure).
- Require review on every migration; treat it as riskier than application code.
- Keep a runbook: how long the migration takes, how to abort, what the forward fix is.
- Snapshot or back up immediately before a destructive migration.

---

## 7.9 Connection Pooling in Practice

**Priority: MUST KNOW**

### Definition

A pool maintains a bounded set of reusable database connections, lending them to concurrent operations and queueing or rejecting requests when all are in use.

### Simple meaning

A small number of phone lines shared by everyone, instead of dialling a new call per query.

### Why it is needed

Phase 6 covered the concept; this is where it goes wrong in code. Pool exhaustion is one of the most common production incidents in Node services, and it usually presents as "everything timed out at once" with no obvious cause.

### How it works internally

```
request → pool.acquire()
            ├─ idle connection available → use it
            ├─ under max → open a new one
            └─ at max → queue (up to queueLimit / acquireTimeout) → else throw
        → run statements
        → release() back to the pool
```

**The arithmetic that matters:**

```
total connections to MySQL
  = pool size × processes per instance × number of instances
                                        (+ migration jobs, workers, cron, admin tools)
```

This must stay comfortably under `max_connections`. A cluster of 4 instances × 4 Node processes × a pool of 20 is 320 connections before any background worker — plenty to exhaust a default-configured MySQL.

**Sizing.** Node executes JavaScript on one thread, so a pool much larger than your real concurrency buys nothing and costs database memory. Start at **8–16 per process**, then tune on measured pool wait time. Bigger is not faster: past a point, more connections increase contention inside MySQL and make everything slower.

### Configuration — all three libraries

```ts
// mysql2
createPool({ connectionLimit: 10, queueLimit: 50, waitForConnections: true, enableKeepAlive: true });

// Knex
knexFactory({
  client: 'mysql2',
  connection: { /* … */ },
  pool: {
    min: 2, max: 10,
    acquireTimeoutMillis: 10_000,   // fail fast rather than hang
    idleTimeoutMillis: 30_000,
    reapIntervalMillis: 1_000,
  },
});

// Prisma — configured in the connection URL, managed by the query engine
// mysql://user:pass@host:3306/db?connection_limit=10&pool_timeout=10&connect_timeout=10
```

Prisma's default `connection_limit` is `num_cpus × 2 + 1`, which on a 16-core box is 33 per process — frequently too many. Set it explicitly.

### The failure modes to recognise

**1. Leaked connections (the classic).**

```ts
// BROKEN — no release on the error path
const conn = await pool.getConnection();
const [rows] = await conn.execute(sql);     // throws → connection never released
conn.release();

// CORRECT
const conn = await pool.getConnection();
try { return await conn.execute(sql); }
finally { conn.release(); }                 // ALWAYS
```

Every leak permanently reduces pool capacity. Ten leaks on a pool of ten is a dead service.

**2. Long-held connections.** A transaction that awaits an external HTTP call holds a connection (and its locks) for the duration of someone else's latency. This is §7.6 rule 2, seen from the pool's side.

**3. Multiple client instances.**

```ts
// BROKEN in dev with hot reload — a new pool on every reload
export function getPrisma() { return new PrismaClient(); }

// CORRECT — one instance per process
const g = globalThis as unknown as { __prisma?: PrismaClient };
export const prisma = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.__prisma = prisma;
```

**4. Serverless.** Each lambda invocation may open its own pool; 500 concurrent invocations means 500+ connections. Use a connection proxy (RDS Proxy, PgBouncer-equivalent), a data proxy, or `connection_limit=1` with a proxy in front.

**5. No timeouts.** Without an acquire timeout, requests queue forever and the only symptom is rising latency until everything times out at the load balancer.

### Health and graceful shutdown

```ts
// Health check that actually proves the database is reachable
app.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db_unavailable' });
  }
});

// Graceful shutdown (Phase 4.5) — drain in-flight work, then close the pool
process.on('SIGTERM', async () => {
  server.close(async () => {
    await prisma.$disconnect();     // or knex.destroy() / pool.end()
    process.exit(0);
  });
});
```

Closing the pool on shutdown matters: connections left open after the process dies linger on the MySQL side until they time out, eating capacity during a rolling deploy.

### Edge cases

- Idle connections can be killed by MySQL's `wait_timeout` (default 8 hours) or an intermediate load balancer (often 60–350 s). Enable keep-alive and handle reconnects.
- `min` connections keep the pool warm but hold resources on an idle service.
- Migrations and cron workers use the same `max_connections` budget — count them.
- A read replica needs its own pool (Phase 6, §6.6), doubling your connection arithmetic.
- Pool metrics differ per library; Knex exposes `knex.client.pool.numUsed()/numFree()/numPendingAcquires()`.

### Common mistakes

1. No `finally { release() }`.
2. Pool size chosen by vibes, then multiplied across 12 instances.
3. Instantiating the ORM client per request.
4. `queueLimit: 0` (unlimited) — requests queue forever instead of failing fast.
5. No `SELECT 1` readiness check, so a broken database looks like a healthy pod.
6. Forgetting to close the pool on `SIGTERM`.

### Interview answer

> "A pool keeps a bounded set of open connections because the handshake is expensive and MySQL's max_connections is finite. The number that matters is pool size times processes times instances, plus workers and migration jobs — that total has to stay well under max_connections, and I've seen scale-ups take a database down purely through connection count.
>
> Since Node runs JavaScript on one thread, a pool much larger than real concurrency just consumes database memory, so I start around eight to sixteen per process and tune on pool wait time. The failure mode I watch for is exhaustion: a connection leaked because release wasn't in a finally, or held across an external HTTP call inside a transaction. The symptom is every request timing out at once, so I set an acquire timeout and a queue limit to fail fast, expose pool wait time as a metric, and close the pool on SIGTERM so rolling deploys don't leave connections behind."

**Frequently asked:**

- Why use a connection pool?
- How do you size one?
- What happens when the pool is exhausted, and how do you diagnose it?
- How do pooling and serverless interact?
- Why is a bigger pool not always faster?
- How do you handle a connection killed by `wait_timeout`?

### Practice problem

Deliberately leak a connection inside a transaction and observe the service degrade. Then add pool metrics (used/free/pending), an acquire timeout, and a readiness probe. Load-test at 200 concurrent requests with pool sizes of 2, 10 and 50 and plot p95 latency against pool size — you should see it flatten and then worsen.

### Production considerations

- Metrics: pool used/free/pending, acquire wait time p95, connection errors, total MySQL connections vs `max_connections`.
- Alert before exhaustion (e.g. pending acquires > 0 sustained), not after.
- Keep separate pools for the primary and replicas, and separate budgets for workers.
- Document the connection budget in the runbook so nobody scales instances without checking it.

---

## 7.10 Query Logging and Observability

**Priority: IMPORTANT**

### Definition

Query logging captures the SQL a library emits, its parameters, duration and originating context, so the generated SQL is visible rather than inferred.

### Simple meaning

Seeing what your ORM actually did, instead of hoping.

### Why it is needed

This is the habit that makes the whole phase work. You cannot honour "know the SQL your ORM emits" without looking at it. Query logs are also how you find N+1 (§7.7) and how you connect a slow endpoint to a specific statement.

### Syntax — all three libraries

```ts
// Prisma
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'warn',  emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('query', (e) => {
  if (e.duration > 100) {
    logger.warn({ sql: e.query, params: e.params, ms: e.duration }, 'slow query');
  }
});
```

```ts
// Knex
knex.on('query', (q) => logger.debug({ sql: q.sql, bindings: q.bindings }));
knex.on('query-response', (_res, q) => { /* time it */ });
knex.on('query-error', (err, q) => logger.error({ err, sql: q.sql }));
```

```ts
// TypeORM
new DataSource({ logging: ['query', 'error', 'warn'], maxQueryExecutionTime: 200 /* ms */ });
```

### Prisma middleware — timing, tracing and soft delete in one place

```ts
prisma.$use(async (params, next) => {
  const start = performance.now();
  const result = await next(params);
  const ms = performance.now() - start;

  metrics.histogram('db.query.duration', ms, {
    model: params.model ?? 'raw',
    action: params.action,
  });
  if (ms > 200) logger.warn({ model: params.model, action: params.action, ms }, 'slow db op');
  return result;
});

// Global soft-delete filter — one place, impossible to forget
prisma.$use(async (params, next) => {
  if (params.model === 'Order' && params.action === 'findMany') {
    params.args.where = { deletedAt: null, ...params.args.where };
  }
  return next(params);
});
```

### Correlating queries to requests

A log line saying "this query took 800 ms" is much less useful than "this query took 800 ms, in request `abc-123`, on `GET /orders`, for tenant 7". Use `AsyncLocalStorage` (Phase 4):

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
export const requestContext = new AsyncLocalStorage<{ requestId: string; route: string }>();

app.use((req, _res, next) => {
  requestContext.run({ requestId: req.id, route: req.path }, next);
});

prisma.$on('query', (e) => {
  const ctx = requestContext.getStore();
  logger.debug({ ...ctx, sql: e.query, ms: e.duration });
});
```

### What to log where

| Environment | Log |
|---|---|
| Development | Every query with SQL and params; a per-request query count |
| Staging | Slow queries + query counts per endpoint |
| Production | **Slow queries only**, with parameters redacted; aggregate metrics for the rest |

**Never log parameter values containing PII, passwords, tokens or card data.** Log the SQL shape and the duration; redact bindings or log only their types. Query logs are frequently shipped to third-party log services — treat them as externally visible.

### Metrics worth emitting

- Query duration histogram, tagged by model and action.
- Queries per request (the N+1 detector from §7.7).
- Pool used / free / pending acquires; acquire wait time.
- Transaction duration and rollback rate.
- Deadlock and lock-wait-timeout counts.
- Error rate by MySQL error code (1062, 1213, 1205 — Phase 6, §6.7).

### Tracing

OpenTelemetry instrumentation for `mysql2`/Prisma produces a span per query nested under the HTTP span. This is how an N+1 becomes visually obvious: a staircase of fifty identical spans inside one request. Prisma exposes `previewFeatures = ["tracing"]`.

### Edge cases

- Query logging in a hot production path is itself a performance cost; sample rather than log everything.
- Prisma's `e.query` shows the statement with `?` placeholders and `e.params` separately — do not naively concatenate them back together for a log line, and never for execution.
- `$use` middleware does not intercept `$queryRaw`; instrument raw calls explicitly.
- Logging inside `$on('query')` is synchronous work on the event loop — keep it cheap.

### Common mistakes

1. Never turning query logging on, and therefore never knowing what the ORM emits.
2. Logging full SQL with parameter values in production → PII leak.
3. Logging every query in production → log-volume cost and latency.
4. Measuring only HTTP latency, with no visibility into which query caused it.
5. No request correlation ID, making logs unusable during an incident.

### Interview answer

> "I keep query logging on in development so I can see the SQL my ORM emits — that's the only way to honour the rule that I should be able to predict it. In production I log only slow queries, with parameters redacted, because query logs get shipped to third-party services and the bindings often contain PII.
>
> The more useful thing than raw logs is metrics and tracing: a duration histogram tagged by model and action, a queries-per-request counter that flags N+1, pool wait time, and OpenTelemetry spans per query nested under the HTTP span — an N+1 shows up as a staircase of identical spans, which is unmistakable. I correlate everything with a request ID through AsyncLocalStorage so a slow query in the log can be traced back to a specific request, route and tenant."

**Frequently asked:**

- How do you see the SQL an ORM generates?
- How do you find a slow query in production?
- What would you log and what would you never log?
- How do you detect N+1 without reading every log line?
- What is `AsyncLocalStorage` used for here?

### Practice problem

Add to an existing project: query logging with a 100 ms slow threshold, a per-request query counter that warns above 10, request-ID correlation, and a duration histogram. Then find and fix the slowest endpoint using only the telemetry you added.

### Production considerations

- Sample query logs (e.g. 1%) plus always-log-slow, rather than all-or-nothing.
- Cross-reference application slow-query logs with MySQL's own slow query log and `sys.statement_analysis` (Phase 6, §6.4).
- Put query duration and pool wait time on the service dashboard next to HTTP latency; most latency incidents are database incidents.

---

## 7.11 Preventing SQL Injection

**Priority: MUST KNOW**

### Definition

SQL injection is a vulnerability in which attacker-controlled input is interpreted as SQL code rather than as data, allowing the attacker to read, modify or destroy data and sometimes execute commands.

### Simple meaning

The database cannot tell your query from the attacker's sentence, because you glued them into one string.

### Why it is needed

It remains one of the most damaging and most common web vulnerabilities, and using an ORM does **not** automatically make you safe — every ORM has a raw escape hatch, and most real breaches come through it.

### How it works internally

```ts
// VULNERABLE
const email = req.body.email;                                  // "' OR '1'='1"
const sql = `SELECT * FROM users WHERE email = '${email}'`;
// Becomes: SELECT * FROM users WHERE email = '' OR '1'='1'    → returns every user
```

Worse payloads: `'; DROP TABLE users; --`, UNION-based data exfiltration, blind/time-based extraction via `SLEEP()`, reading files via `LOAD_FILE()` where privileges allow.

**Prepared statements fix this structurally.** The SQL text is parsed and planned *first*; parameter values are sent afterwards as typed data and can never be re-parsed as SQL. There is no escaping to get wrong.

### The rules

**1. Always parameterise values.**

```ts
// mysql2
await pool.execute('SELECT * FROM users WHERE email = ?', [email]);          // safe

// Knex
await knex('users').where({ email });                                        // safe
await knex.raw('SELECT * FROM users WHERE email = ?', [email]);              // safe
await knex.raw(`SELECT * FROM users WHERE email = '${email}'`);              // VULNERABLE

// Prisma
await prisma.user.findMany({ where: { email } });                            // safe
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;          // safe (tagged template)
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`); // VULNERABLE

// TypeORM
await repo.createQueryBuilder('u').where('u.email = :email', { email }).getMany();     // safe
await repo.createQueryBuilder('u').where(`u.email = '${email}'`).getMany();            // VULNERABLE
```

> **The Prisma detail worth knowing:** `$queryRaw` as a **tagged template** parameterises the interpolations. `$queryRaw(someString)` called as a normal function, or `$queryRawUnsafe`, does not. The name `Unsafe` is the API telling you the truth — treat every occurrence as a security review item.

**2. Identifiers cannot be parameterised — use an allowlist.**

Placeholders work for values, never for table names, column names, or `ASC`/`DESC`.

```ts
// VULNERABLE
const sql = `SELECT * FROM orders ORDER BY ${req.query.sortBy} ${req.query.dir}`;

// SAFE — map user input to known-good identifiers
const SORT_COLUMNS = {
  newest: 'created_at',
  total:  'total',
  status: 'status',
} as const;
const DIRECTIONS = { asc: 'ASC', desc: 'DESC' } as const;

const column = SORT_COLUMNS[req.query.sortBy as keyof typeof SORT_COLUMNS] ?? 'created_at';
const dir    = DIRECTIONS[req.query.dir as keyof typeof DIRECTIONS] ?? 'DESC';

const rows = await knex('orders').orderBy(column, dir.toLowerCase() as 'asc' | 'desc');
```

Never "sanitise" an identifier with a regex and hope. Map to a fixed set, fall back to a default.

**3. Expand `IN (...)` lists by count, not by joining values.**

```ts
// VULNERABLE
`SELECT * FROM users WHERE id IN (${ids.join(',')})`

// SAFE
const placeholders = ids.map(() => '?').join(',');
await pool.execute(`SELECT * FROM users WHERE id IN (${placeholders})`, ids);
// Validate ids are numbers and cap the length first.
```

**4. Validate at the edge anyway.** Parameterisation prevents injection; it does not prevent *logically* bad input. Use Zod or a similar validator (Phase 2, §2.3 — types vanish at runtime):

```ts
const ListOrders = z.object({
  status: z.enum(['pending', 'paid', 'shipped', 'cancelled']).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['newest', 'total', 'status']).default('newest'),
  ids:    z.array(z.coerce.number().int().positive()).max(1000).optional(),
});
const query = ListOrders.parse(req.query);
```

Validation and parameterisation are different defences. You need both.

**5. LIKE needs escaping too.** A user searching for `100%` or `a_b` gets wildcard behaviour:

```ts
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);
await knex('orders').whereLike('reference', `${escapeLike(term)}%`);   // prefix, sargable
```

**6. Least privilege.** The application's MySQL user should not have `DROP`, `GRANT`, `FILE`, or access to other schemas. This turns a successful injection from catastrophic into merely bad. Never connect as `root`.

**7. Disable `multipleStatements`.** With it on, one injection point becomes arbitrary statement execution.

**8. Do not leak errors.** Returning a raw MySQL error to the client hands the attacker schema details.

```ts
app.use((err, _req, res, _next) => {
  logger.error({ err }, 'unhandled');
  const status = mapDbError(err);                       // 1062 → 409, 1451 → 409, else 500
  res.status(status).json({ error: PUBLIC_MESSAGES[status] });   // never err.message
});
```

### Real backend usage — a safe dynamic query end to end

```ts
export async function listOrders(raw: unknown, tenantId: number) {
  const q = ListOrders.parse(raw);                       // 1. validate + coerce

  const query = knex('orders')
    .where('tenant_id', tenantId)                        // 2. scope, parameterised
    .whereNull('deleted_at');

  if (q.status) query.where('status', q.status);         // 3. values parameterised
  if (q.ids)    query.whereIn('id', q.ids);              // 4. safe IN expansion

  const column = SORT_COLUMNS[q.sortBy];                 // 5. identifier from allowlist
  return query.orderBy(column, 'desc').orderBy('id', 'desc').limit(q.limit);  // 6. capped
}
```

### Edge cases

- **Second-order injection:** a malicious value is stored safely, then later concatenated into SQL by a background job or report. Parameterise *everywhere*, not just at the API boundary.
- ORM operators can be abused: passing an arbitrary object from `req.body` directly into `where` lets a client inject operators (`{ "id": { "gt": 0 } }` returning everything). Validate the shape; never spread untrusted objects into query options.
- JSON path expressions (`$.field`) built from user input need the same allowlist treatment.
- Stored procedures are not automatically safe — dynamic SQL inside them is injectable.
- ORDER BY injection is often dismissed as harmless; it is not — it enables blind extraction.

### Common mistakes

1. Template literals in `raw`/`queryRawUnsafe`.
2. Interpolating a sort column or table name.
3. Believing "we use an ORM, so we're safe".
4. Sanitising with a blocklist of keywords instead of parameterising.
5. Spreading `req.body` into an ORM `where` clause.
6. Running the app as `root` with full privileges.
7. Returning database error messages to clients.

### Interview answer

> "Injection happens when user input is parsed as SQL rather than treated as data. The structural fix is prepared statements: the statement is parsed and planned first, then parameter values are sent separately as typed data, so they can never become SQL. That's why I use `execute` with placeholders, Knex bindings, or Prisma's tagged-template `$queryRaw` — and why `$queryRawUnsafe` and `knex.raw` with a template literal are security review items.
>
> The case people miss is identifiers: you can't parameterise a table name, a column name or a sort direction, so anything user-controlled there has to go through an allowlist map with a safe default — never a regex sanitiser. On top of that I validate input shape with Zod at the edge, escape LIKE wildcards, cap array and limit sizes, run the app with a least-privilege database user so a successful injection is contained, and never return raw database errors to clients because they leak schema."

**Frequently asked:**

- What is SQL injection and how do prepared statements prevent it?
- Does using an ORM make you safe?
- How do you safely handle a user-supplied sort column?
- What is second-order injection?
- Why is escaping worse than parameterising?
- What privileges should the application's database user have?

### Practice problem

Build a deliberately vulnerable endpoint, exploit it three ways (auth bypass, UNION data extraction, ORDER BY blind extraction), then fix it with parameterisation, an allowlist and Zod validation. Add a test suite that asserts each payload now returns the correct empty or validation-error response. Finally, revoke `DROP` from the app user and confirm the destructive payload fails even if injection were possible.

### Production considerations

- Add a lint rule or CI grep banning `queryRawUnsafe`, `knex.raw` with template literals, and string-concatenated SQL.
- Make every raw SQL call a required code-review item.
- Use a least-privilege user per service; separate read-only credentials for reporting.
- Run SAST / dependency scanning in CI; keep the driver and ORM patched.
- Log and alert on repeated 400/validation failures from one client — often reconnaissance.

---

## 7.12 Quick Reference

### The data-access decision tree

```
Is it plain CRUD on one aggregate?          → ORM
Is it a list endpoint with dynamic filters? → Query builder (or ORM if it expresses it cleanly)
Does it need window functions, CTEs,
  bulk UPDATE…JOIN, or a specific plan?     → Raw SQL behind the repository
Is it a report across many tables?          → Raw SQL in a dedicated read model
Is it a bulk write of thousands of rows?    → Raw multi-row INSERT / createMany, batched
```

### Pre-merge checklist for any data-access code

- [ ] I can state the SQL this emits, and I have seen it in the query log
- [ ] Query count per request is bounded and does not grow with page size
- [ ] Only the needed columns are selected (no `SELECT *`, no unnecessary `include`)
- [ ] `EXPLAIN` shows `ref`/`range`, not `ALL`; no `Using filesort` on a hot path (Phase 6, §6.4)
- [ ] All values parameterised; all identifiers from an allowlist
- [ ] Tenant scope and soft-delete filter applied
- [ ] `limit` validated and capped server-side
- [ ] Transaction boundary is in the service layer; every statement uses the `tx` handle
- [ ] No network I/O inside the transaction
- [ ] Conditional updates check `affectedRows`/`count`
- [ ] Deadlock (1213) and lock-wait (1205) retried
- [ ] Connections released in a `finally`
- [ ] Migration is backward-compatible with the currently running code
- [ ] Errors mapped to HTTP status codes; no raw DB errors returned

### Error code → HTTP mapping

| MySQL | Meaning | HTTP |
|---|---|---|
| 1062 | Duplicate entry | 409 Conflict |
| 1451 / 1452 | FK constraint fails | 409 / 400 |
| 1213 | Deadlock | retry, then 503 |
| 1205 | Lock wait timeout | retry, then 503 |
| 1406 | Data too long | 400 |
| 3819 | CHECK violated | 400 |
| 1040 | Too many connections | 503 + page the on-call |

### Commands and snippets you will reach for

```bash
npx prisma migrate deploy         # apply pending migrations in prod
npx prisma studio                 # inspect data locally
npx prisma db pull                # introspect an existing schema
npx knex migrate:latest
npx knex migrate:make add_x
npx typeorm migration:run -d ./src/data-source.ts
```

```ts
knex('orders').where(f).toSQL();              // inspect generated SQL
await prisma.$queryRaw`EXPLAIN SELECT ...`;   // check the plan from the app
knex.client.pool.numUsed(); knex.client.pool.numPendingAcquires();
```

---

## 7.13 Practice Plan

**The deliverable for this phase is one project built twice: the same feature set through raw SQL and through an ORM, with the SQL logged and compared throughout.**

| Week | Focus | Deliverable |
|---|---|---|
| 1 | 7.1–7.2 | Typed `mysql2` wrapper: `selectRows`, `selectOne`, `withTransaction`, safe `IN` expansion. 10 endpoints in raw SQL |
| 2 | 7.3 | Rebuild the list endpoints with Knex: 6 optional filters, 3 sorts, cursor pagination, tenant + soft-delete scoping. Print `.toSQL()` for each |
| 3 | 7.4 | Model the schema in Prisma (and TypeORM for comparison). Rebuild the same endpoints. Log and diff the SQL against weeks 1–2 |
| 4 | 7.5–7.6 | Introduce repository interfaces + unit of work. Unit-test services with in-memory fakes. Build a transactional `POST /orders` with outbox and deadlock retry |
| 5 | 7.7 | Seed 100k users / 2M orders. Build the same endpoint naive / eager / batched. Measure query count and p95. Add the query-count guard to CI |
| 6 | 7.8–7.11 | Expand-migrate-contract a column change with a chunked backfill. Add pool metrics, query logging with request correlation, slow-query alerts. Build and then fix a deliberately injectable endpoint |

**Rules of practice**

1. **Log every query you generate, every week.** If you cannot predict the SQL before you see it, you do not yet understand the abstraction.
2. **Seed realistically.** A 200-row database hides every problem this phase exists to teach.
3. **`EXPLAIN` before merging.** Carry the Phase 6 habit into Phase 7; the ORM does not exempt you.
4. **Break things deliberately.** Leak a connection. Use the global client inside a transaction. Inject into a raw query. Seeing the failure mode is what makes it memorable.

**Weekly rhythm** — Mon learn · Tue implement in raw SQL first · Wed implement through the abstraction and diff the generated SQL · Thu break it and fix it (concurrency, nulls, injection, volume) · Fri explain three concepts aloud · Sat one feature end to end · Sun review query logs and `EXPLAIN` output for everything you wrote.

---

## Phase 7 Completion Checklist

You are ready for Phase 8 (Auth and Security) when you can, without looking anything up:

**Choosing the layer**
- [ ] Explain raw SQL vs query builder vs ORM and when you use each.
- [ ] Explain the object-relational impedance mismatch and what it causes.
- [ ] Predict the SQL your ORM emits for a given call — and verify it in the log.
- [ ] Justify dropping to raw SQL for a specific query.

**Driver and builder**
- [ ] Explain `query` vs `execute` and why prepared statements are safer.
- [ ] Handle `DECIMAL`, `BIGINT` and `DATETIME` correctly in Node.
- [ ] Build a dynamic query with six optional filters and cursor pagination, safely.
- [ ] Stream a large result set without exhausting memory.

**ORM**
- [ ] Model one-to-many and many-to-many in Prisma or TypeORM with correct indexes.
- [ ] Explain lazy vs eager loading and why Prisma omits lazy loading.
- [ ] Use `select` rather than `include` to avoid over-fetching.
- [ ] Run raw SQL from the ORM safely.

**Design**
- [ ] Explain the repository pattern, its benefits and its failure mode (leaky abstraction).
- [ ] Unit-test a service with no database using an in-memory fake.
- [ ] Centralise tenant scoping and soft-delete filtering in one place.
- [ ] Say where transaction boundaries belong and why.

**Transactions**
- [ ] Write a transaction in your chosen library and explain the global-client trap.
- [ ] Explain why no network I/O belongs inside a transaction, and what the outbox does instead.
- [ ] Implement deadlock retry with exponential backoff.
- [ ] Use a conditional update and check `affectedRows` for optimistic concurrency.

**Performance**
- [ ] Define the N+1 problem and fix it three ways.
- [ ] Explain why DataLoader must be per request.
- [ ] Detect N+1 with a query-count middleware and with a trace.
- [ ] Recognise over-fetching as the opposite failure and fix it with field selection.

**Operations**
- [ ] Explain migration ordering, why MySQL migrations are not transactional, and expand-migrate-contract.
- [ ] Add a `NOT NULL` column to a huge table with no downtime, including a chunked backfill.
- [ ] Size a connection pool and compute the total connection budget across instances.
- [ ] Diagnose pool exhaustion from symptoms.
- [ ] Say what you log in production and what you must never log.

**Security**
- [ ] Explain how prepared statements structurally prevent injection.
- [ ] Safely handle a user-supplied sort column and an `IN (...)` list.
- [ ] Name three ways an ORM can still be injectable.
- [ ] Map MySQL error codes to HTTP status codes without leaking internals.

---

**Next:** Phase 8 — Authentication, Authorization and Security (password hashing, sessions vs JWT, refresh-token rotation, RBAC/ABAC, OAuth 2.0 and OIDC, CSRF, XSS, SSRF, CORS, secure cookies, secrets management, file-upload security, audit logging).

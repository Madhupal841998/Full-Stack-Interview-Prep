# Phase 6 — MySQL and SQL from Zero to Advanced

> Part of the *Zero to Expert Backend Engineering Master Roadmap*
> Prerequisites: Phase 3 (Big O, trees, hash maps), Phase 4 (Node.js Core), Phase 5 (Express)
> Engine assumed throughout: **MySQL 8.0+ with InnoDB**. Differences from PostgreSQL are flagged where they matter.

---

## How to Read This Phase

Every topic below follows the roadmap's 12-step order:

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

### Phase 6 priority summary

| Section | Priority |
|---|---|
| 6.1 SQL Fundamentals | MUST KNOW |
| 6.2 Joins and Querying | MUST KNOW |
| 6.3 Database Design | MUST KNOW |
| 6.4 Indexes and Query Optimization | MUST KNOW |
| 6.5 Transactions and Concurrency | MUST KNOW |
| 6.6 Advanced Database Engineering | IMPORTANT |

### The governing rule of this phase

> The database is the one part of your system that is **hard to undo**. Code can be rewritten in an afternoon; a wrong schema with ten million rows in it and forty services reading from it is a quarter of work.
>
> Learn SQL before you learn an ORM. Phase 7 will hand you a tool that writes SQL for you — you must be able to read what it wrote and tell whether it is a disaster.

---

## 6.1 SQL Fundamentals

**Priority: MUST KNOW**

### Definition

SQL (Structured Query Language) is a declarative language for defining and manipulating relational data. You describe **what** result you want; the query optimiser decides **how** to produce it.

### Simple meaning

You ask the database a question in a structured sentence. It figures out the fastest way to answer.

### Why it is needed

Every backend stores state somewhere, and for the overwhelming majority of products that somewhere is a relational database. Correctness of your API is bounded by the correctness of your queries and constraints.

### How it works internally

A query passes through a pipeline:

```
SQL text
  → Parser        (syntax tree)
  → Optimiser     (choose indexes, join order, access method)
  → Execution plan
  → Storage engine (InnoDB: buffer pool → disk pages)
  → Result set
```

The optimiser is cost-based: it estimates rows examined per candidate plan using index statistics and picks the cheapest. This is why `EXPLAIN` (§6.4) is the single most important debugging tool in this phase — it shows you the plan the optimiser chose.

**The logical order of evaluation is not the written order.** Memorise this; it explains most beginner errors:

```
Written:   SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT
Evaluated: FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT
```

Consequences that show up in interviews:

- You **cannot** use a `SELECT` alias in `WHERE` (WHERE runs first) but you **can** in `ORDER BY` and, in MySQL specifically, in `HAVING`.
- `WHERE` filters rows *before* grouping; `HAVING` filters groups *after*.
- `LIMIT` runs last, so `LIMIT 10` on an unsorted query returns an arbitrary 10 rows.

### Data types — choose deliberately

| Category | Type | Use for | Notes |
|---|---|---|---|
| Integer | `TINYINT` (1B), `INT` (4B), `BIGINT` (8B) | counts, IDs | `INT UNSIGNED` maxes at ~4.29 billion; use `BIGINT` for high-volume tables |
| Decimal | `DECIMAL(19,4)` | **money** | Exact. Never use FLOAT/DOUBLE for currency |
| Float | `DOUBLE` | measurements, scores | Approximate; `0.1 + 0.2 != 0.3` |
| String | `VARCHAR(n)` | names, emails | Variable length; `n` is characters, not bytes |
| String | `CHAR(n)` | fixed codes (country, currency) | Padded |
| Text | `TEXT`, `MEDIUMTEXT` | long content | Stored off-page; cannot be fully indexed |
| Binary | `BINARY(16)` | UUIDs stored compactly | 16 bytes vs 36 for CHAR(36) |
| Date | `DATE`, `DATETIME(6)`, `TIMESTAMP` | times | See the timezone note below |
| Boolean | `TINYINT(1)` / `BOOLEAN` | flags | MySQL has no real boolean type |
| Enum | `ENUM('a','b')` | small fixed sets | Painful to alter; a lookup table is often better |
| JSON | `JSON` | flexible attributes | Validated, indexable via generated columns |

**Timezone rule — get this right once:**

- `TIMESTAMP` is stored as UTC and converted to the session timezone on read. Range ends in 2038.
- `DATETIME` stores exactly what you give it, with no timezone awareness.
- **Standard practice:** store UTC in `DATETIME(3)` or `TIMESTAMP`, set `time_zone = '+00:00'` on the connection, and convert to local time in the presentation layer only.

**Charset rule:** use `utf8mb4` with `utf8mb4_0900_ai_ci` collation. MySQL's legacy `utf8` is a 3-byte encoding that cannot store emoji — a genuine production bug, not trivia.

### Constraints — your first line of defence

```sql
CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255)    NOT NULL,
  display_name  VARCHAR(100)    NOT NULL,
  status        VARCHAR(20)     NOT NULL DEFAULT 'active',
  age           TINYINT UNSIGNED NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT chk_users_status CHECK (status IN ('active','suspended','deleted')),
  CONSTRAINT chk_users_age    CHECK (age IS NULL OR age BETWEEN 13 AND 130)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

| Constraint | Guarantees |
|---|---|
| `PRIMARY KEY` | Unique + NOT NULL; in InnoDB it is also the physical row order (clustered index) |
| `FOREIGN KEY` | Referential integrity; the referenced row must exist |
| `UNIQUE` | No duplicates (but multiple `NULL`s are allowed in MySQL) |
| `NOT NULL` | Value must be present |
| `CHECK` | Arbitrary predicate; **enforced from MySQL 8.0.16** (silently ignored before that) |
| `DEFAULT` | Value when the column is omitted |

> Application validation catches mistakes. Database constraints catch *everything* — including the buggy migration script, the manual `UPDATE` run at 2 a.m., and the second service someone wrote last year. Keep both.

### Foreign keys and referential actions

```sql
CREATE TABLE orders (
  id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id  BIGINT UNSIGNED NOT NULL,
  total    DECIMAL(12,2)   NOT NULL,
  PRIMARY KEY (id),
  KEY idx_orders_user (user_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
```

| Action | Effect on delete of the parent |
|---|---|
| `RESTRICT` / `NO ACTION` | Block the delete. **Safe default for business data.** |
| `CASCADE` | Delete the children too. Fine for owned detail rows (`order_items`), dangerous elsewhere |
| `SET NULL` | Null the FK; the column must be nullable |

MySQL requires an index on the child FK column — it creates one automatically if you do not.

### DML — the four verbs

```sql
-- INSERT
INSERT INTO users (email, display_name) VALUES ('a@x.com', 'Ana');
INSERT INTO users (email, display_name) VALUES ('a@x.com','Ana'), ('b@x.com','Bo');  -- batch

-- Upsert (MySQL). Note: this burns AUTO_INCREMENT values on conflict.
INSERT INTO user_settings (user_id, theme) VALUES (7, 'dark')
ON DUPLICATE KEY UPDATE theme = VALUES(theme);

-- SELECT
SELECT id, email FROM users WHERE status = 'active' ORDER BY created_at DESC LIMIT 20;

-- UPDATE  (always, always with a WHERE)
UPDATE users SET status = 'suspended' WHERE id = 42;

-- DELETE
DELETE FROM users WHERE id = 42;
```

`DELETE` vs `TRUNCATE` vs `DROP`:

| | Removes | Transactional | Resets AUTO_INCREMENT | Fires triggers |
|---|---|---|---|---|
| `DELETE` | rows matching WHERE | Yes | No | Yes |
| `TRUNCATE` | all rows (DDL) | **No — implicit commit** | Yes | No |
| `DROP` | the table itself | No | — | No |

### NULL behaviour — the most common source of silent bugs

`NULL` means *unknown*, not *empty* and not *zero*. SQL uses three-valued logic: TRUE, FALSE, UNKNOWN.

```sql
NULL = NULL          -- UNKNOWN (not true!)
NULL <> 5            -- UNKNOWN
NULL + 1             -- NULL
'a' || NULL          -- NULL (CONCAT returns NULL if any arg is NULL)

-- Correct null tests
WHERE deleted_at IS NULL
WHERE deleted_at IS NOT NULL
WHERE a <=> b                 -- MySQL null-safe equality: NULL <=> NULL is TRUE

-- Null handling functions
COALESCE(nickname, display_name, 'Anonymous')   -- first non-null
IFNULL(discount, 0)
NULLIF(a, b)                                     -- NULL if a = b, else a
```

Aggregate behaviour with NULL:

```sql
COUNT(*)          -- counts rows, including rows that are all NULL
COUNT(col)        -- counts NON-NULL values of col
SUM(col), AVG(col) -- ignore NULLs; AVG divides by the non-null count
-- So AVG(col) != SUM(col) / COUNT(*) when NULLs are present.
```

The `NOT IN` trap — this returns **zero rows** if the subquery yields even one NULL:

```sql
-- BROKEN if any banned_users.user_id is NULL
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM banned_users);

-- Safe
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id);
```

### Filtering, grouping, ordering

```sql
-- WHERE operators
WHERE price BETWEEN 100 AND 500              -- inclusive both ends
WHERE status IN ('active','trial')
WHERE email LIKE '%@gmail.com'               -- leading % => no index use
WHERE created_at >= '2026-01-01' AND created_at < '2026-02-01'   -- half-open range

-- GROUP BY + HAVING
SELECT user_id, COUNT(*) AS order_count, SUM(total) AS revenue
FROM orders
WHERE created_at >= '2026-01-01'      -- filter rows first (cheap)
GROUP BY user_id
HAVING SUM(total) > 1000              -- filter groups after
ORDER BY revenue DESC
LIMIT 10;
```

**ONLY_FULL_GROUP_BY**: MySQL 8 enables this by default. Every non-aggregated column in `SELECT` must appear in `GROUP BY` (or be functionally dependent on it). This is standard SQL and a good thing — older MySQL let you select arbitrary columns from a group and returned a random row's value.

### Real backend usage

```ts
// Parameterised query in Node — NEVER build SQL by concatenation
import mysql from 'mysql2/promise';

const [rows] = await pool.execute(
  `SELECT id, email, display_name
     FROM users
    WHERE status = ? AND created_at >= ?
    ORDER BY created_at DESC
    LIMIT ?`,
  [status, since, limit]
);
```

- `pool.execute` uses prepared statements — the SQL and the data travel separately, so injection is structurally impossible.
- `pool.query` interpolates escaped values client-side; prefer `execute`.
- `LIMIT ?` requires `mysql2` with the value as a number; some drivers need it inlined after integer validation.

### Edge cases

- `LIMIT` without `ORDER BY` returns an arbitrary, unstable set of rows.
- `UNIQUE` allows multiple `NULL`s in MySQL — so a unique index does not prevent two rows with `deleted_at IS NULL` unless you design for it (see soft delete in §6.3).
- String comparison is **case-insensitive** with `_ci` collations: `'Ana' = 'ana'` is TRUE. Use a `_bin` or `_as_cs` collation when case matters (e.g. tokens).
- Implicit type coercion: `WHERE varchar_col = 123` converts the column, killing index use and possibly matching unexpectedly.
- `AUTO_INCREMENT` is not gap-free — rolled-back transactions and failed inserts consume values. Never treat it as a count.
- Division by zero returns `NULL` in MySQL rather than erroring.

### Common mistakes

1. `UPDATE` or `DELETE` without `WHERE`. Enable `--safe-updates` in your client.
2. Using `FLOAT` for money. Use `DECIMAL`.
3. Using `utf8` instead of `utf8mb4`.
4. `WHERE col = NULL` instead of `IS NULL`.
5. `SELECT *` in application code — breaks when columns are added, transfers unneeded bytes, and prevents covering indexes.
6. Storing local time instead of UTC.
7. Building SQL with template literals → SQL injection.

### Interview answer

> "SQL is declarative: I state the result I want and the optimiser picks the plan. The key thing I keep in mind is that the logical evaluation order differs from the written order — FROM and WHERE run before SELECT, which is why an alias isn't available in WHERE and why HAVING exists for filtering after grouping. The other fundamental is NULL semantics: NULL is unknown, so comparisons return UNKNOWN rather than true, which is why I use IS NULL and prefer NOT EXISTS over NOT IN when the subquery can produce nulls."

**Frequently asked:**

- `WHERE` vs `HAVING`?
- `DELETE` vs `TRUNCATE` vs `DROP`?
- `CHAR` vs `VARCHAR`?
- Why not `FLOAT` for money?
- What does `COUNT(*)` count versus `COUNT(column)`?
- Why does `NOT IN` with a NULL return nothing?
- `UNION` vs `UNION ALL`? (`UNION` deduplicates and therefore sorts — `UNION ALL` is cheaper and is usually what you want.)

### Practice problems

1. Create `users`, `orders`, `order_items` with proper types, keys and constraints.
2. Write queries: active users created this month; orders above ₹5,000; users with no orders.
3. Demonstrate the `NOT IN` NULL trap on your own data, then fix it with `NOT EXISTS`.
4. Show that `AVG(col)` ≠ `SUM(col)/COUNT(*)` when nulls are present.

### Production considerations

- Set `sql_mode` to include `STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ENGINE_SUBSTITUTION`. Without strict mode, MySQL silently truncates oversized values and turns invalid dates into `'0000-00-00'`.
- Give the application user the minimum privileges it needs — no `DROP`, no `GRANT`.
- Never run ad-hoc `UPDATE`/`DELETE` on production without wrapping in a transaction and running the `SELECT` form first.
- Enable the slow query log with `long_query_time = 1` from day one.

---

## 6.2 Joins and Querying

**Priority: MUST KNOW**

### Definition

A join combines rows from two or more tables based on a related column, producing a single result set. The join type determines what happens to rows that have no match.

### Simple meaning

Your data is split across tables to avoid duplication. Joins put it back together for the answer.

### Why it is needed

Normalised schemas (§6.3) store each fact once. Every useful report — "orders with customer names and product titles" — requires a join. Getting join semantics wrong produces silently wrong numbers, which is worse than an error.

### How it works internally

MySQL 8 has three join algorithms:

| Algorithm | How it works | When used |
|---|---|---|
| **Nested loop** | For each row of the outer table, look up matches in the inner table | Inner side has a usable index — the good case |
| **Block nested loop** | Buffer outer rows, scan the inner table once per buffer | No index on the inner side — slow |
| **Hash join** (8.0.18+) | Build a hash table on the smaller input, probe with the larger | Equi-joins with no usable index — much better than BNL |

The critical insight: **a join without an index on the join column degrades toward `O(n × m)`.** Index every foreign key. MySQL does this for you when you declare the FK — but if you join on a column that is not a declared FK, you must index it yourself.

Join order is chosen by the optimiser, not by the order you wrote the tables.

### The join types

```
A INNER JOIN B   → only rows matching in both
A LEFT JOIN B    → all of A, with NULLs where B has no match
A RIGHT JOIN B   → all of B (just write it as a LEFT JOIN with sides swapped)
A CROSS JOIN B   → every combination (Cartesian product)
A FULL OUTER     → not supported in MySQL; emulate with UNION of two LEFT JOINs
```

```sql
-- INNER: users who have at least one order
SELECT u.id, u.email, o.id AS order_id, o.total
FROM users u
INNER JOIN orders o ON o.user_id = u.id;

-- LEFT: every user, with order data where it exists
SELECT u.id, u.email, o.id AS order_id
FROM users u
LEFT JOIN orders o ON o.user_id = u.id;

-- Anti-join: users with NO orders (the LEFT JOIN + IS NULL idiom)
SELECT u.id, u.email
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;

-- Self join: employees with their managers
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;

-- Many-to-many through a junction table
SELECT u.email, r.name AS role
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r       ON r.id = ur.role_id;
```

### The `ON` vs `WHERE` trap (asked constantly)

For an `INNER JOIN` they are equivalent. For a `LEFT JOIN` they are completely different:

```sql
-- Every user; only their 2026 orders are attached (others become NULL)
SELECT u.id, o.id
FROM users u
LEFT JOIN orders o ON o.user_id = u.id AND o.created_at >= '2026-01-01';

-- Silently becomes an INNER JOIN: the WHERE filters out the NULL rows
SELECT u.id, o.id
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.created_at >= '2026-01-01';
```

Rule: conditions on the **outer (preserved)** table go in `WHERE`; conditions on the **optional** table go in `ON`.

### Row multiplication — the silent bug

A one-to-many join multiplies rows, which corrupts aggregates:

```sql
-- WRONG: order total is counted once per order_item
SELECT u.id, SUM(o.total) AS revenue, COUNT(oi.id) AS items
FROM users u
JOIN orders o      ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
GROUP BY u.id;

-- RIGHT: aggregate each branch separately before joining
SELECT u.id, ord.revenue, itm.items
FROM users u
LEFT JOIN (SELECT user_id, SUM(total) AS revenue FROM orders GROUP BY user_id) ord
       ON ord.user_id = u.id
LEFT JOIN (SELECT o.user_id, COUNT(*) AS items
             FROM orders o JOIN order_items oi ON oi.order_id = o.id
            GROUP BY o.user_id) itm
       ON itm.user_id = u.id;
```

If you must do it in one pass: `COUNT(DISTINCT o.id)` and `SUM(DISTINCT ...)` help for counting but not for summing non-unique values.

### Subqueries

```sql
-- Scalar subquery (returns one value)
SELECT id, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
FROM users u;

-- IN / EXISTS
SELECT * FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- Derived table (must be aliased in MySQL)
SELECT * FROM (SELECT user_id, SUM(total) t FROM orders GROUP BY user_id) s WHERE s.t > 1000;
```

`EXISTS` vs `IN` vs `JOIN`: MySQL 8's optimiser often rewrites them into the same plan, but as a rule of thumb — `EXISTS` short-circuits on the first match and handles NULLs safely; `IN` is fine for small, NULL-free literal lists; `JOIN` is right when you actually need columns from the other table.

### Common Table Expressions (CTEs) — MySQL 8+

```sql
WITH monthly AS (
  SELECT user_id,
         DATE_FORMAT(created_at, '%Y-%m') AS month,
         SUM(total) AS revenue
  FROM orders
  GROUP BY user_id, month
),
ranked AS (
  SELECT *, RANK() OVER (PARTITION BY month ORDER BY revenue DESC) AS rnk
  FROM monthly
)
SELECT * FROM ranked WHERE rnk <= 3;
```

CTEs make complex queries readable by naming each step. In MySQL they are generally materialised or merged by the optimiser — they are a readability tool, not a performance tool.

**Recursive CTEs** solve hierarchy traversal in one query (the SQL counterpart of Phase 3's tree traversal):

```sql
WITH RECURSIVE subtree AS (
  SELECT id, parent_id, name, 0 AS depth
  FROM categories WHERE id = 7                    -- anchor
  UNION ALL
  SELECT c.id, c.parent_id, c.name, s.depth + 1
  FROM categories c
  JOIN subtree s ON c.parent_id = s.id            -- recursive step
  WHERE s.depth < 10                              -- ALWAYS bound the depth
)
SELECT * FROM subtree;
```

This replaces the N+1 pattern of fetching children level by level from Node.

### CASE — conditional logic

```sql
SELECT
  id,
  CASE
    WHEN total >= 10000 THEN 'platinum'
    WHEN total >= 1000  THEN 'gold'
    ELSE 'standard'
  END AS tier,
  -- Conditional aggregation: pivot rows into columns
  SUM(CASE WHEN status = 'paid'     THEN 1 ELSE 0 END) AS paid_count,
  SUM(CASE WHEN status = 'refunded' THEN total ELSE 0 END) AS refunded_value
FROM orders
GROUP BY id, tier;
```

### Window functions — MySQL 8+ (the senior-level differentiator)

A window function computes across a set of rows **without collapsing them**, unlike `GROUP BY`.

```sql
SELECT
  user_id,
  created_at,
  total,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn,
  RANK()       OVER (ORDER BY total DESC)                           AS rank_by_total,
  SUM(total)   OVER (PARTITION BY user_id ORDER BY created_at
                     ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
  LAG(total)   OVER (PARTITION BY user_id ORDER BY created_at)      AS prev_order_total,
  AVG(total)   OVER (ORDER BY created_at ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7
FROM orders;
```

| Function | Gives you |
|---|---|
| `ROW_NUMBER()` | 1, 2, 3 — unique, arbitrary tie-break |
| `RANK()` | 1, 2, 2, 4 — gaps after ties |
| `DENSE_RANK()` | 1, 2, 2, 3 — no gaps |
| `LAG` / `LEAD` | previous / next row's value |
| `FIRST_VALUE` / `LAST_VALUE` | boundary values of the window |
| `NTILE(n)` | bucket rows into n groups (percentiles) |
| `SUM/AVG/COUNT OVER` | running and moving aggregates |

**The canonical use — latest record per user** (a top-3 interview query):

```sql
-- Window function approach (MySQL 8+)
WITH ranked AS (
  SELECT o.*, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) rn
  FROM orders o
)
SELECT * FROM ranked WHERE rn = 1;

-- Pre-8.0 approach, still useful and often faster with the right index
SELECT o.*
FROM orders o
JOIN (SELECT user_id, MAX(created_at) AS mx FROM orders GROUP BY user_id) m
  ON m.user_id = o.user_id AND m.mx = o.created_at;
```

Note the `, id DESC` tie-break: without it, two orders at the same timestamp make the result non-deterministic.

### Finding duplicates

```sql
-- Which emails are duplicated, and how many times
SELECT LOWER(email) AS e, COUNT(*) AS n, MIN(id) AS keep_id
FROM users
GROUP BY e
HAVING COUNT(*) > 1;

-- Delete all but the oldest of each duplicate group
DELETE u FROM users u
JOIN (SELECT LOWER(email) e, MIN(id) keep FROM users GROUP BY e HAVING COUNT(*) > 1) d
  ON LOWER(u.email) = d.e AND u.id <> d.keep;
```

### Real backend usage

```ts
// Monthly revenue report endpoint — one query, not a loop
const [rows] = await pool.execute(
  `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS month,
          COUNT(DISTINCT o.id)               AS orders,
          COUNT(DISTINCT o.user_id)          AS customers,
          SUM(o.total)                       AS revenue
     FROM orders o
    WHERE o.status = 'paid'
      AND o.created_at >= ? AND o.created_at < ?
    GROUP BY month
    ORDER BY month`,
  [from, to]
);
```

The Phase 3 lesson applies directly: **one join beats N round trips.** The N+1 problem (Phase 7) is exactly the failure to use a join or an `IN (...)` batch fetch.

### Edge cases

- A `LEFT JOIN` whose right side has multiple matches still multiplies rows — "left" does not mean "at most one".
- `CROSS JOIN` with a missing `ON` clause: a 10,000 × 10,000 accidental Cartesian product is 100 million rows.
- Joining on columns with different collations or types forces a conversion and prevents index use.
- `UNION` sorts to deduplicate; `UNION ALL` does not. Use `ALL` unless you truly need distinct.
- Window functions cannot appear in `WHERE` — wrap them in a CTE or derived table first.
- Recursive CTEs stop at `cte_max_recursion_depth` (default 1,000) and error out.

### Common mistakes

1. Putting a filter on the optional table in `WHERE` of a `LEFT JOIN`, silently converting it to an inner join.
2. Summing across a one-to-many join and reporting inflated revenue.
3. Joining on an unindexed column and wondering why the report takes 40 seconds.
4. Using `SELECT *` in a multi-table join — ambiguous column names and wasted bytes.
5. `ORDER BY` with no deterministic tie-break, producing unstable pagination.
6. Doing the join in Node — pulling two full tables and matching them in a loop.

### Interview answer

> "An inner join keeps only matching rows; a left join preserves every row of the left table and fills nulls where there's no match. The detail that matters is where the filter goes: on a left join, a predicate on the right table belongs in the ON clause, because putting it in WHERE discards the null rows and turns it back into an inner join. The other thing I watch for is row multiplication — joining a one-to-many relationship duplicates the parent row per child, so aggregating after the join inflates sums. I aggregate each branch in a derived table or CTE first. Performance-wise, MySQL uses nested loops when there's an index on the join column and hash join otherwise, so every join column gets an index."

**Frequently asked:**

- `INNER` vs `LEFT` join, with an example where the answer differs.
- How do you find rows in A with no match in B? (anti-join)
- `ON` vs `WHERE` in a `LEFT JOIN`.
- `EXISTS` vs `IN` vs `JOIN`.
- How do you get the latest row per user?
- `GROUP BY` vs window functions.
- What is a self join used for?

### Practice problems

1. Users with no orders in the last 90 days (anti-join on a date range).
2. Top 3 products by revenue per category (window function).
3. Month-over-month revenue growth percentage (`LAG`).
4. Find duplicate emails ignoring case, keep the oldest, delete the rest.
5. Full category path for a product using a recursive CTE.
6. A user's second-most-recent order (`ROW_NUMBER() = 2`).

### Production considerations

- Cap report queries with a date range and a `LIMIT`; an unbounded analytical query on the primary database can stall the whole application.
- Run heavy reporting on a **read replica** (§6.6), never on the write primary.
- Materialise expensive aggregates into a summary table refreshed on a schedule, rather than recomputing per request.
- Log and alert on queries exceeding a latency budget; a join that was fast at 10,000 rows will not be at 10 million.

---

## 6.3 Database Design

**Priority: MUST KNOW**

### Definition

Database design is the process of structuring tables, columns, keys and relationships so that data is stored without redundancy, constraints express the business rules, and the common access patterns are efficient.

### Simple meaning

Deciding what tables exist, what goes in each, and how they point at each other — before you write any code.

### Why it is needed

Schema is the hardest thing to change. A bad schema produces update anomalies (the same fact stored in three places, two of which go stale), impossible constraints, and queries that cannot be made fast at any index.

### Normalisation

Normal forms remove redundancy step by step. You need three of them fluently.

**1NF — atomic values, no repeating groups.**

```
BAD:  orders(id, product_names = "Shirt, Hat, Belt")
GOOD: orders(id) + order_items(order_id, product_id, qty)
```

**2NF — 1NF plus: no partial dependency on part of a composite key.**

```
BAD:  order_items(order_id, product_id, qty, product_name)
      -- product_name depends only on product_id, not the whole key
GOOD: order_items(order_id, product_id, qty) + products(id, name)
```

**3NF — 2NF plus: no transitive dependency (non-key → non-key).**

```
BAD:  users(id, city_id, city_name, country_name)
      -- city_name depends on city_id, not on id
GOOD: users(id, city_id) + cities(id, name, country_id) + countries(id, name)
```

The practical summary interviewers want:

> "Every non-key column depends on the key, the whole key, and nothing but the key."

**BCNF, 4NF, 5NF** exist and are GOOD TO KNOW; 3NF covers virtually all application schemas.

### Denormalisation — deliberate, measured, documented

Denormalisation duplicates data to avoid a join. It is a **performance optimisation with a correctness cost**, so:

1. Normalise first.
2. Measure a real problem.
3. Denormalise the specific hot path.
4. Decide how the copy stays in sync (transaction, trigger, background job) and accept the staleness window.

Legitimate cases:

| Pattern | Example | Sync strategy |
|---|---|---|
| Counter cache | `posts.comment_count` | Update in the same transaction, or recompute nightly |
| Snapshot at time of event | `order_items.unit_price`, `order_items.product_name` | **Not denormalisation** — the price at purchase time is a different fact from the current price. Always snapshot this. |
| Precomputed aggregate | `daily_revenue` summary table | Scheduled job |
| Duplicated lookup label | `orders.customer_name` for a fast list view | Update on customer rename |

> The `order_items` price case is worth internalising: storing the current price via a join would rewrite history every time a product's price changes. Some "duplication" is actually correct modelling.

### Relationship cardinality

**One-to-one** — a foreign key with a `UNIQUE` constraint. Use it to split rarely-accessed or sensitive columns off a hot table.

```sql
CREATE TABLE user_profiles (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  bio     TEXT,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**One-to-many** — the foreign key lives on the *many* side. This is 90% of relationships.

```sql
orders.user_id → users.id
```

**Many-to-many** — a junction (join/pivot) table with a composite primary key.

```sql
CREATE TABLE user_roles (
  user_id     BIGINT UNSIGNED NOT NULL,
  role_id     INT UNSIGNED    NOT NULL,
  granted_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  granted_by  BIGINT UNSIGNED NULL,
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role (role_id),          -- for the reverse lookup
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
```

Note the composite PK gives uniqueness *and* an index on `(user_id, role_id)`; the extra `role_id` index serves "who has this role?".

**Self-referencing (hierarchy)** — `parent_id` pointing at the same table. Query it with a recursive CTE (§6.2), or store a materialised path for deep, read-heavy trees.

### Primary key strategy — a decision with real consequences

| Strategy | Pros | Cons |
|---|---|---|
| `BIGINT AUTO_INCREMENT` | Small, sequential, ideal for InnoDB clustered index | Enumerable (leaks volume); not generatable client-side |
| `UUIDv4` as `CHAR(36)` | Globally unique, client-generatable | 36 bytes, random → **index page splits and fragmentation**; bloats every secondary index |
| `UUIDv4` as `BINARY(16)` | Same, but 16 bytes | Still random; unreadable without conversion |
| **`UUIDv7` / ULID as `BINARY(16)`** | Time-ordered *and* globally unique — best of both | Needs a library; newer |
| Composite natural key | No surrogate needed | Changes when business rules change; bloats child FKs |

**Why random UUIDs hurt in InnoDB specifically:** the primary key *is* the physical row order (clustered index). Sequential keys append to the end of the last page. Random keys insert into the middle of arbitrary pages, causing splits, fragmentation and much worse write throughput. Every secondary index also stores the full PK as its row pointer, so a 36-byte PK inflates every index on the table.

**Common hybrid:** internal `BIGINT` PK for joins and FKs, plus an external `public_id BINARY(16) UNIQUE` (UUID/ULID) exposed in the API.

### Audit, status and soft delete columns

```sql
-- Audit columns on every table
created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
created_by  BIGINT UNSIGNED NULL,
updated_by  BIGINT UNSIGNED NULL,

-- Soft delete
deleted_at  DATETIME(3) NULL,
```

**Soft delete trade-offs — state these in an interview:**

- Pro: recoverable, preserves referential history, supports audit and undo.
- Con: *every* query must remember `WHERE deleted_at IS NULL`; forget once and you leak deleted data.
- Con: unique constraints break — `UNIQUE(email)` blocks re-registering an email that belongs to a soft-deleted user.

The standard fix for the unique problem in MySQL:

```sql
-- Generated column: NULL while alive, so UNIQUE ignores live rows correctly
ALTER TABLE users
  ADD COLUMN email_active VARCHAR(255)
    GENERATED ALWAYS AS (IF(deleted_at IS NULL, email, NULL)) STORED,
  ADD UNIQUE KEY uq_users_email_active (email_active);
```

(MySQL allows multiple NULLs in a unique index, which is exactly the behaviour we want here.)

**Status columns:** prefer `VARCHAR(20)` + a `CHECK` constraint, or a small lookup table, over `ENUM`. Altering an `ENUM` requires a table rebuild; adding a row to a lookup table does not.

### JSON columns — use sparingly and deliberately

```sql
ALTER TABLE products ADD COLUMN attributes JSON NULL;

-- Query into JSON
SELECT * FROM products WHERE attributes->>'$.color' = 'red';
SELECT JSON_EXTRACT(attributes, '$.dimensions.width') FROM products;

-- Index a JSON path via a generated column
ALTER TABLE products
  ADD COLUMN color VARCHAR(32) GENERATED ALWAYS AS (attributes->>'$.color') STORED,
  ADD INDEX idx_products_color (color);
```

Use JSON for genuinely schemaless, rarely-queried data: third-party webhook payloads, user preferences, feature-flag overrides, per-tenant custom fields.

Do **not** use it for data you filter, join, or constrain on. You lose type checking, foreign keys, and clean indexing. "We'll put it in JSON for flexibility" is how schemas rot.

### Naming conventions — pick one and never deviate

```
tables           snake_case, plural           users, order_items
columns          snake_case, singular         email, created_at
primary key      id
foreign key      <singular_table>_id          user_id, order_id
junction table   <a>_<b> alphabetical         user_roles
index            idx_<table>_<cols>           idx_orders_user_created
unique index     uq_<table>_<cols>            uq_users_email
foreign key      fk_<table>_<ref>             fk_orders_user
check            chk_<table>_<rule>           chk_orders_total_positive
booleans         is_/has_ prefix              is_active, has_verified_email
timestamps       _at suffix                   created_at, deleted_at, published_at
money            store the currency alongside amount_minor BIGINT + currency CHAR(3)
```

> **Money tip:** many teams store minor units as an integer (`amount_minor BIGINT` = paise/cents) plus an ISO currency code, avoiding decimal rounding questions entirely. `DECIMAL(19,4)` is also correct. Choose one, document it, never mix.

### Schema migrations

Migrations are versioned, ordered, committed-to-git scripts that evolve the schema. Rules:

1. **Every change is a migration.** No manual `ALTER` on production, ever.
2. **Forward-only in production.** Write a `down` for local development, but recovery in production is a new forward migration — a `down` that drops a column destroys data.
3. **Migrations run before the new code deploys**, and must be compatible with the *currently running* code.
4. **Expand → migrate → contract** for any breaking change:

```
Step 1 (expand):   add the new nullable column; deploy code that writes BOTH
Step 2 (backfill): batch-update existing rows (chunked, throttled)
Step 3 (migrate):  deploy code that reads the new column
Step 4 (contract): make it NOT NULL; drop the old column in a later release
```

Never rename a column in one step — that is an outage. Add, dual-write, backfill, switch, drop.

5. **Backfills must be chunked.** `UPDATE orders SET x = y;` on 50 million rows holds locks and blocks writes for minutes.

```sql
-- Chunked backfill loop, driven from the application
UPDATE orders SET currency = 'INR'
WHERE currency IS NULL AND id BETWEEN ? AND ?;   -- 5,000 ids per batch, with a pause
```

### A worked schema

```sql
CREATE TABLE orders (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id    BINARY(16)      NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  status       VARCHAR(20)     NOT NULL DEFAULT 'pending',
  amount_minor BIGINT          NOT NULL,
  currency     CHAR(3)         NOT NULL DEFAULT 'INR',
  placed_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at   DATETIME(3)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_public_id (public_id),
  KEY idx_orders_user_placed (user_id, placed_at DESC),
  KEY idx_orders_status_placed (status, placed_at),
  CONSTRAINT fk_orders_user  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_orders_amount CHECK (amount_minor >= 0),
  CONSTRAINT chk_orders_status CHECK (status IN ('pending','paid','shipped','cancelled','refunded'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Edge cases

- Circular foreign keys between two tables make inserts impossible without deferring — restructure instead.
- A composite PK on a junction table means the column order matters for index use (see §6.4).
- `ON DELETE CASCADE` on a deeply nested tree can delete far more than intended; `RESTRICT` is the safer default.
- Multi-tenant schemas need `tenant_id` as the **leading column** of nearly every index, and in every `WHERE` clause. Forgetting it is a data-leak bug, not a performance bug.
- Changing a column type on a large table rewrites it; use an online schema-change tool (§6.6).

### Common mistakes

1. Storing comma-separated lists in a column instead of a junction table.
2. Random UUID as the clustered primary key on a high-write table.
3. `ENUM` for a status that the business will extend next quarter.
4. No `created_at` / `updated_at`, then being unable to debug anything.
5. Soft delete without fixing unique constraints or without a shared query filter.
6. Over-normalising a read-heavy path into a seven-table join for a single list view.
7. Reaching for JSON to avoid thinking about the schema.
8. Manual production `ALTER` that is not in any migration file — the next environment is now different.

### Interview answer

> "I normalise to third normal form first — every non-key column depends on the key, the whole key, and nothing but the key — because that removes update anomalies. Then I denormalise deliberately where a measured hot path needs it, and I document how the copy stays in sync. For primary keys on InnoDB I prefer a sequential BIGINT, because the primary key is the clustered index, so random UUIDs cause page splits and bloat every secondary index; if I need globally unique external IDs I add a separate UUID or ULID column. I put created_at and updated_at on everything, prefer soft delete with a generated column so unique constraints still work, and treat every schema change as a versioned migration using expand-migrate-contract so deploys never require downtime."

**Frequently asked:**

- Explain 1NF, 2NF, 3NF with an example.
- When would you denormalise?
- How do you model many-to-many? What goes in the junction table?
- Surrogate vs natural key; UUID vs auto-increment.
- Soft delete vs hard delete — trade-offs?
- How do you add a NOT NULL column to a table with 50 million rows, with zero downtime?
- How do you model a hierarchy in SQL?

### Practice problems

1. Design a schema for a multi-tenant learning platform: organisations, trainers, learners, batches, sessions, attendance, materials. Get the junction tables and tenant isolation right.
2. Take a denormalised spreadsheet export and normalise it to 3NF, writing the migration.
3. Add a `currency` column to a large `orders` table using expand-migrate-contract.
4. Implement soft delete on `users` such that a deleted user's email can be reused.
5. Model product variants (size × colour) without a Cartesian explosion of columns.

### Production considerations

- Keep schema in version control; the database is not the source of truth for its own structure.
- Review migrations like you review code — a bad `ALTER` is an outage.
- Test migrations against a production-sized copy, not a 50-row dev database.
- Have a documented retention policy per table before the table exists (§6.6).
- Set a naming convention document on day one; inconsistent naming compounds forever.

---

## 6.4 Indexes and Query Optimization

**Priority: MUST KNOW — this is where backend engineers separate themselves**

### Definition

An index is an auxiliary data structure that maps column values to row locations, allowing the engine to find matching rows without scanning the whole table — at the cost of extra storage and slower writes.

### Simple meaning

The index at the back of a book. Without it you read every page; with it you jump straight to page 214.

### Why it is needed

This is the highest-leverage skill in the phase. A single missing index is the difference between a 4 ms endpoint and a 9-second timeout. Almost every "the app got slow as we grew" incident is an index problem.

### How it works internally

InnoDB indexes are **B+ trees**. This is Phase 3's balanced-tree material made concrete:

- Internal nodes hold only keys and child pointers; **all data lives in the leaves**.
- Leaf nodes are linked in a list, which makes range scans and `ORDER BY` cheap.
- Fanout is high (hundreds of keys per 16 KB page), so depth is typically 3–4 even for hundreds of millions of rows. A lookup is 3–4 page reads instead of a full scan.

**Clustered vs secondary index — the central InnoDB concept:**

| | Clustered index | Secondary index |
|---|---|---|
| What it is | The primary key; the table rows *are* its leaves | A separate B+ tree |
| Leaf contains | The entire row | The indexed columns + the **primary key value** |
| Per table | Exactly one | Many |
| Lookup cost | One traversal | Traversal, then a second traversal of the clustered index to fetch other columns |

That second traversal is the **bookmark lookup** (or "back to the table"). It explains two important facts:

1. A big primary key inflates *every* secondary index.
2. If the secondary index already contains every column the query needs, the second lookup is skipped entirely — that is a **covering index**, and `EXPLAIN` shows `Using index`.

### Index types

```sql
CREATE INDEX idx_orders_user       ON orders (user_id);                 -- single column
CREATE INDEX idx_orders_user_date  ON orders (user_id, placed_at DESC); -- composite
CREATE UNIQUE INDEX uq_users_email ON users (email);                    -- unique
CREATE INDEX idx_users_email_pfx   ON users (email(20));                -- prefix (long strings)
CREATE FULLTEXT INDEX ft_posts     ON posts (title, body);              -- text search
-- Functional index (MySQL 8.0.13+)
CREATE INDEX idx_users_email_lower ON users ((LOWER(email)));
```

### Composite indexes and the leftmost-prefix rule

**This is the single most-asked index question.** An index on `(a, b, c)` can serve:

| Query predicate | Uses the index? |
|---|---|
| `WHERE a = ?` | Yes |
| `WHERE a = ? AND b = ?` | Yes |
| `WHERE a = ? AND b = ? AND c = ?` | Yes, fully |
| `WHERE a = ? AND c = ?` | Partially — only `a` narrows; `c` is filtered after |
| `WHERE b = ?` | **No** |
| `WHERE b = ? AND c = ?` | **No** |

Think of it as a phone book sorted by (last name, first name). You can find "all Sharmas", or "Sharma, Priya" — but not "everyone named Priya".

**Column ordering rule — equality first, then range, then sort:**

```sql
-- Query:
SELECT * FROM orders
WHERE tenant_id = ? AND status = ? AND placed_at >= ?
ORDER BY placed_at DESC
LIMIT 20;

-- Correct index: equality columns first, the range/sort column last
CREATE INDEX idx_orders_tenant_status_placed ON orders (tenant_id, status, placed_at);
```

A range condition (`>`, `<`, `BETWEEN`, `LIKE 'x%'`) **stops** further index columns from narrowing the scan — anything after the range column in the index can only be used for ordering or covering, not for seeking. So put ranges last.

### Selectivity

Selectivity = distinct values ÷ total rows. High selectivity (close to 1) makes a good index.

```sql
SELECT COUNT(DISTINCT status) / COUNT(*) AS status_sel,   -- e.g. 0.000001 — poor alone
       COUNT(DISTINCT email)  / COUNT(*) AS email_sel     -- 1.0 — excellent
FROM users;
```

An index on `status` alone is nearly useless on a table where 95% of rows are `'active'` — the optimiser will correctly ignore it and scan. But `status` as the *first* column of a composite index is fine when combined with something selective, and low-selectivity columns are useful for covering.

### Covering indexes

```sql
-- Query needs only user_id, placed_at, status
SELECT user_id, placed_at, status FROM orders WHERE user_id = ? ORDER BY placed_at DESC;

CREATE INDEX idx_cover ON orders (user_id, placed_at, status);
-- EXPLAIN now shows "Using index" — no bookmark lookups at all.
```

This is the main reason `SELECT *` is harmful: it makes covering impossible.

### EXPLAIN — read this fluently

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 42 ORDER BY placed_at DESC LIMIT 20;
EXPLAIN FORMAT=JSON SELECT ...;     -- full cost detail
EXPLAIN ANALYZE SELECT ...;         -- MySQL 8.0.18+: actually runs it, shows real timings
```

**`type` column, best to worst** — memorise this ladder:

| type | Meaning |
|---|---|
| `system` / `const` | One row, via PK or unique index. Ideal. |
| `eq_ref` | One row per outer row, via unique index on a join. Excellent. |
| `ref` | Multiple rows via a non-unique index. Good. |
| `range` | Index range scan (`BETWEEN`, `>`, `IN`). Good. |
| `index` | Full **index** scan — reads the whole index. Mediocre. |
| `ALL` | Full **table** scan. **The red flag.** |

**`Extra` column — what to look for:**

| Extra | Meaning |
|---|---|
| `Using index` | **Covering index** — no table access. Best. |
| `Using where` | Filtering after retrieval. Normal. |
| `Using index condition` | Index condition pushdown — good. |
| `Using filesort` | Sorting in memory or on disk because no index supplies the order. Fix with an index. |
| `Using temporary` | A temp table was built (common with `GROUP BY` + `ORDER BY` on different columns). Expensive. |
| `Using join buffer` | No index on the join column. Fix it. |

Also read `key` (which index was actually chosen), `rows` (estimated rows examined) and `filtered` (percentage surviving the filter). `rows` × the number of loops is your real cost estimate.

**A worked diagnosis:**

```sql
-- Before: type=ALL, rows=2,400,000, Extra="Using where; Using filesort"
SELECT id, total FROM orders WHERE user_id = 42 ORDER BY placed_at DESC LIMIT 20;

CREATE INDEX idx_orders_user_placed ON orders (user_id, placed_at DESC);

-- After: type=ref, rows=31, Extra="Using where"  — filesort gone, 2.4M → 31 rows examined
```

### What prevents an index from being used

```sql
-- 1. Function or arithmetic on the indexed column
WHERE YEAR(created_at) = 2026              -- BAD
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'   -- GOOD (sargable)

WHERE LOWER(email) = ?                     -- BAD unless you have a functional index
WHERE email = ?                            -- GOOD with a _ci collation

-- 2. Leading wildcard
WHERE name LIKE '%son'                     -- BAD: cannot seek
WHERE name LIKE 'john%'                    -- GOOD: prefix range

-- 3. Type mismatch (implicit conversion)
WHERE phone_varchar = 9876543210           -- BAD: converts the column
WHERE phone_varchar = '9876543210'         -- GOOD

-- 4. OR across different columns
WHERE user_id = 1 OR email = 'a@b.com'     -- often a scan
-- Rewrite as UNION of two indexed queries, or rely on index_merge

-- 5. Low selectivity / huge result set — a scan is genuinely cheaper
-- 6. Negation
WHERE status <> 'active'                   -- usually a scan
```

The word for "can use an index" is **sargable** (Search ARGument ABLE). Keep the indexed column bare on one side of the comparison.

### Pagination — offset vs cursor

```sql
-- OFFSET pagination: page 5,000 means reading and discarding 100,000 rows
SELECT * FROM orders ORDER BY placed_at DESC LIMIT 20 OFFSET 100000;   -- O(offset)
```

Offset pagination degrades linearly and also **skips or duplicates rows** when data changes between pages.

```sql
-- Cursor (keyset) pagination: O(log n), stable under concurrent writes
SELECT id, placed_at, total
FROM orders
WHERE (placed_at, id) < (?, ?)        -- the last row of the previous page
ORDER BY placed_at DESC, id DESC
LIMIT 20;
```

This is Phase 3's binary search applied to paging: the index seeks directly to the cursor position instead of walking from the start. Always include a unique tie-break column (`id`) so the ordering is total and the cursor is unambiguous.

```ts
// Encode the cursor opaquely so clients cannot forge it into arbitrary filters
const cursor = Buffer.from(JSON.stringify({ placedAt, id })).toString('base64url');
```

Trade-off: cursor pagination cannot jump to "page 47". Offer it for infinite scroll and API feeds; keep offset for small admin tables where deep pages never happen.

### The N+1 problem (preview of Phase 7)

```ts
// BAD: 1 + N queries
const users = await q('SELECT * FROM users LIMIT 50');
for (const u of users) {
  u.orders = await q('SELECT * FROM orders WHERE user_id = ?', [u.id]);   // 50 queries
}

// GOOD: 2 queries + an O(n) in-memory group (Phase 3, §3.4)
const users  = await q('SELECT * FROM users LIMIT 50');
const ids    = users.map(u => u.id);
const orders = await q(
  `SELECT * FROM orders WHERE user_id IN (${ids.map(() => '?').join(',')})`, ids);

const byUser = new Map<number, Order[]>();
for (const o of orders) {
  const bucket = byUser.get(o.user_id);
  bucket ? bucket.push(o) : byUser.set(o.user_id, [o]);
}
for (const u of users) u.orders = byUser.get(u.id) ?? [];
```

### The cost of indexes

Indexes are not free:

- Every `INSERT`, `UPDATE` and `DELETE` must update every affected index.
- Each index consumes disk and buffer-pool memory, competing with data pages.
- The optimiser takes longer with many candidate indexes.
- Redundant indexes are pure cost: `(a)` is redundant if `(a, b)` exists.

```sql
-- Find unused indexes (requires performance_schema)
SELECT object_schema, object_name, index_name
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE index_name IS NOT NULL AND count_star = 0
  AND object_schema NOT IN ('mysql','performance_schema','sys')
ORDER BY object_schema, object_name;
```

Rule of thumb: index for your actual query patterns, not speculatively. Five well-chosen indexes beat twenty guessed ones.

### Finding slow queries

```sql
-- Slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- Top offenders by total time (sys schema)
SELECT query, exec_count, ROUND(total_latency/1e12, 2) AS total_sec,
       ROUND(avg_latency/1e9, 2) AS avg_ms, rows_examined_avg, rows_sent_avg
FROM sys.statement_analysis
ORDER BY total_latency DESC
LIMIT 20;

-- Queries doing full scans
SELECT * FROM sys.statements_with_full_table_scans LIMIT 20;
```

The ratio `rows_examined / rows_sent` is the clearest health signal: examining 500,000 rows to return 20 means a missing index.

### Real backend usage

```sql
-- Indexes designed from the actual endpoints, multi-tenant aware
-- GET /orders?status=&from=&to=  (always scoped to a tenant)
CREATE INDEX idx_orders_tenant_status_placed ON orders (tenant_id, status, placed_at);

-- GET /users/:id/orders  (cursor paginated)
CREATE INDEX idx_orders_tenant_user_placed  ON orders (tenant_id, user_id, placed_at DESC);

-- Login
CREATE UNIQUE INDEX uq_users_email ON users (email);

-- Background job picking up work
CREATE INDEX idx_jobs_status_run_at ON jobs (status, run_at);
```

### Edge cases

- The optimiser may ignore your index if it estimates a scan is cheaper — run `ANALYZE TABLE` to refresh statistics before concluding the index is wrong.
- `FORCE INDEX` exists but is a last resort; it freezes a decision that should adapt as data changes.
- `ORDER BY a ASC, b DESC` needs a matching mixed-direction index (supported from MySQL 8.0).
- Prefix indexes (`email(20)`) cannot be covering and cannot support `ORDER BY` on that column.
- `NULL`s are stored in InnoDB indexes and are seekable via `IS NULL`.
- Very large `IN (...)` lists (thousands of values) can defeat the optimiser — batch them.
- Adding an index on a huge table locks/copies unless you use `ALGORITHM=INPLACE` or an online tool (§6.6).

### Common mistakes

1. Wrapping the indexed column in a function (`DATE(created_at) = ...`).
2. Wrong column order in a composite index — putting the range column before equality columns.
3. Creating a single-column index for every column, hoping something sticks.
4. `SELECT *` defeating an otherwise covering index.
5. Deep `OFFSET` pagination on a large table.
6. Believing `EXPLAIN` row counts are exact — they are estimates; use `EXPLAIN ANALYZE` for reality.
7. Testing performance on a 100-row dev database.
8. Forgetting `tenant_id` as the leading column in a multi-tenant system.

### Interview answer

> "InnoDB indexes are B+ trees where all the data sits in the leaves and leaves are linked, which makes both point lookups and range scans efficient at a depth of three or four pages. The primary key is the clustered index — the rows themselves — and every secondary index stores the primary key as its pointer, so a secondary lookup costs a second traversal unless the index covers all the columns the query needs.
>
> When I design an index I start from the query: equality predicates first, then the range or sort column last, because a range stops later columns from narrowing the scan. I verify with EXPLAIN — I want type to be ref or range rather than ALL, and I want to see 'Using index' and no 'Using filesort'. The main things that silently kill an index are functions on the column, leading wildcards, and implicit type conversion. And for large result sets I use keyset pagination rather than OFFSET, because OFFSET reads and discards everything before the page."

**Frequently asked:**

- How does a B+ tree index work? Why not a binary tree or a hash index?
- Clustered vs secondary index in InnoDB.
- What is a covering index?
- Explain the leftmost-prefix rule.
- Given `WHERE a = ? AND b > ? ORDER BY c`, what index would you create?
- How do you read `EXPLAIN`? What is `Using filesort`?
- Why is `OFFSET 100000` slow, and what do you use instead?
- Do indexes slow down writes? By how much, and how do you decide?
- Why might MySQL ignore your index?

### Practice problems

1. Take a slow endpoint in your project, capture `EXPLAIN` before and after adding an index, record rows examined for both.
2. Build a covering index that eliminates the bookmark lookup for a list endpoint.
3. Convert an offset-paginated endpoint to cursor pagination and benchmark page 1 vs page 5,000.
4. Make five deliberately non-sargable queries and rewrite each to be sargable.
5. Find and drop the unused and redundant indexes in a schema.

### Production considerations

- Add indexes with an online algorithm or a tool (`gh-ost`, `pt-online-schema-change`) on large tables; a naive `ALTER` can lock writes for minutes.
- Monitor the buffer pool hit rate; if the working set no longer fits in memory, everything degrades at once.
- Alert on slow query count and on `rows_examined / rows_sent`.
- Review `EXPLAIN` for new queries during code review, not after the incident.
- Re-evaluate indexes when access patterns change — an index that was right at 100,000 rows may be wrong at 50 million.

---

## 6.5 Transactions and Concurrency

**Priority: MUST KNOW**

### Definition

A transaction is a unit of work that is executed atomically: either all of its statements take effect, or none do. Concurrency control governs what one transaction can see of another's in-flight work.

### Simple meaning

"Do all of this, or do none of it" — plus rules about what other people see while you are halfway through.

### Why it is needed

Money moves. Inventory decrements. Two users click "book the last seat" 5 ms apart. Without transactions and correct isolation, you get double bookings, lost updates and negative balances — bugs that are invisible under low traffic and catastrophic under load.

### ACID

| Property | Meaning | InnoDB mechanism |
|---|---|---|
| **Atomicity** | All or nothing | Undo log — rollback reverses applied changes |
| **Consistency** | Constraints hold before and after | Constraints, FKs, triggers, application logic |
| **Isolation** | Concurrent transactions do not corrupt each other | MVCC + row locks |
| **Durability** | Committed data survives a crash | Redo log (WAL) + `innodb_flush_log_at_trx_commit=1` |

### How it works internally

**MVCC (Multi-Version Concurrency Control):** InnoDB keeps old row versions in the undo log. A consistent read reads the version visible as of a snapshot, so **readers never block writers and writers never block readers**. Only writer-vs-writer conflicts take locks.

**Locks:**

| Lock | Taken by | Blocks |
|---|---|---|
| Shared (S) | `SELECT ... LOCK IN SHARE MODE` | X locks |
| Exclusive (X) | `UPDATE`, `DELETE`, `SELECT ... FOR UPDATE` | S and X locks |
| Record lock | Locks an index record | Conflicting access to that row |
| Gap lock | Locks the space *between* index records | Inserts into the gap — this is how REPEATABLE READ prevents phantoms |
| Next-key lock | Record + preceding gap | The default in REPEATABLE READ |

**Critical consequence:** InnoDB locks **index records**, not rows. `UPDATE orders SET x=1 WHERE unindexed_col = 5` must scan the table and ends up locking *every row it examines*. A missing index turns a narrow row lock into a table-wide lock — the most common cause of production lock storms.

### Syntax

```sql
START TRANSACTION;
  UPDATE accounts SET balance = balance - 500 WHERE id = 1;
  UPDATE accounts SET balance = balance + 500 WHERE id = 2;
COMMIT;      -- or ROLLBACK;

-- Savepoints for partial rollback
START TRANSACTION;
  INSERT INTO orders ...;
  SAVEPOINT after_order;
  INSERT INTO order_items ...;
  ROLLBACK TO SAVEPOINT after_order;   -- order survives, items undone
COMMIT;
```

**DDL causes an implicit commit.** `CREATE TABLE`, `ALTER`, `TRUNCATE` inside a transaction silently commit everything before them. Never mix DDL into a business transaction.

### Isolation levels and the anomalies they prevent

| Level | Dirty read | Non-repeatable read | Phantom read | Notes |
|---|---|---|---|---|
| READ UNCOMMITTED | Possible | Possible | Possible | Never use |
| READ COMMITTED | Prevented | Possible | Possible | PostgreSQL/Oracle default; common MySQL choice |
| **REPEATABLE READ** | Prevented | Prevented | Prevented in InnoDB (via gap locks) | **MySQL default** |
| SERIALIZABLE | Prevented | Prevented | Prevented | Full serial semantics; heavy locking |

**The anomalies, concretely:**

```
Dirty read          — T1 reads a row T2 has modified but not committed; T2 rolls back.
Non-repeatable read — T1 reads a row twice and gets different values because T2 committed in between.
Phantom read        — T1 runs the same range query twice and sees NEW rows added by T2.
Lost update         — T1 and T2 both read balance=100, both write 150; one update vanishes.
```

> **Interview point worth knowing:** the SQL standard says REPEATABLE READ allows phantoms, but **InnoDB's REPEATABLE READ prevents them** for consistent reads (via the MVCC snapshot) and for locking reads (via next-key gap locks). Saying this correctly signals real depth.
>
> **Lost update is not prevented by any isolation level below SERIALIZABLE** when the read-modify-write happens in application code. That is what the two locking strategies below are for.

```sql
SELECT @@transaction_isolation;
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

Many teams run READ COMMITTED because it takes fewer gap locks and therefore deadlocks less, at the cost of non-repeatable reads. Know the trade-off; do not change it casually on an existing system.

### The lost update problem — and the two fixes

```ts
// BROKEN: read-modify-write in application code
const [[acct]] = await q('SELECT balance FROM accounts WHERE id = ?', [1]);  // 100
const next = acct.balance - 500;
await q('UPDATE accounts SET balance = ? WHERE id = ?', [next, 1]);
// Two concurrent runs both read 100. One update is lost.
```

**Fix 0 — avoid the read entirely (best when possible):**

```sql
UPDATE accounts SET balance = balance - 500
WHERE id = 1 AND balance >= 500;
-- Check affectedRows === 1; if 0, there were insufficient funds.
-- Atomic at the database level. No lock strategy needed.
```

**Fix 1 — pessimistic locking** (lock first, then modify). Use when contention is high and retries are expensive.

```ts
await conn.beginTransaction();
try {
  const [[acct]] = await conn.execute(
    'SELECT balance FROM accounts WHERE id = ? FOR UPDATE', [1]);   // X lock held until commit
  if (acct.balance < 500) throw new InsufficientFunds();
  await conn.execute('UPDATE accounts SET balance = balance - 500 WHERE id = ?', [1]);
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
}
```

Variants: `FOR UPDATE NOWAIT` (fail immediately instead of waiting) and `FOR UPDATE SKIP LOCKED` (skip locked rows) — the latter is how you build a job queue that multiple workers can poll without stepping on each other:

```sql
-- Worker claims a job without blocking other workers (MySQL 8.0+)
START TRANSACTION;
  SELECT id FROM jobs
   WHERE status = 'pending' AND run_at <= NOW()
   ORDER BY run_at LIMIT 10
   FOR UPDATE SKIP LOCKED;
  UPDATE jobs SET status = 'processing', claimed_at = NOW() WHERE id IN (...);
COMMIT;
```

**Fix 2 — optimistic locking** (version column, detect conflict at write time). Use when contention is low; no locks held across user think-time.

```sql
ALTER TABLE documents ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 0;

UPDATE documents
   SET title = ?, version = version + 1
 WHERE id = ? AND version = ?;      -- the version the client read
-- affectedRows = 0 ⇒ someone else updated it ⇒ return 409 Conflict
```

| | Pessimistic | Optimistic |
|---|---|---|
| Mechanism | `SELECT ... FOR UPDATE` | Version / timestamp check |
| Holds locks | Yes, until commit | No |
| Good for | High contention, short transactions | Low contention, long user-facing edits |
| Failure mode | Waiting, deadlocks, lock timeouts | Retry or 409 to the client |
| Suits | Inventory, balances, seat booking | Document editing, profile updates |

### Deadlocks

Two transactions each hold a lock the other wants. InnoDB detects the cycle, kills the cheaper transaction, and returns error **1213** (`ER_LOCK_DEADLOCK`).

```
T1: UPDATE a WHERE id=1;   -- holds lock on 1
T2: UPDATE a WHERE id=2;   -- holds lock on 2
T1: UPDATE a WHERE id=2;   -- waits on T2
T2: UPDATE a WHERE id=1;   -- waits on T1  → deadlock
```

**Prevention:**

1. **Always acquire locks in a consistent order** (e.g. ascending primary key). This alone prevents most deadlocks.
2. Keep transactions short — never hold a transaction open across an HTTP call, a file upload, or user input.
3. Index the columns in `WHERE` clauses of `UPDATE`/`DELETE`, so you lock rows rather than ranges.
4. Use lower isolation (READ COMMITTED) to reduce gap locking, if the semantics allow.
5. **Treat deadlocks as normal and retry** — they are expected under concurrency, not a bug to be eliminated.

```ts
async function withDeadlockRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err: any) {
      const retryable = err.errno === 1213 || err.errno === 1205;   // deadlock, lock wait timeout
      if (!retryable || i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, 50 * 2 ** i + Math.random() * 50));  // backoff + jitter
    }
  }
  throw new Error('unreachable');
}
```

Diagnose with `SHOW ENGINE INNODB STATUS` (the `LATEST DETECTED DEADLOCK` section) or `performance_schema.data_lock_waits`.

### Transaction boundaries in Node

```ts
// The pattern: one connection, explicit begin/commit/rollback, always release
async function withTransaction<T>(pool: Pool, fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();          // ALWAYS — a leaked connection exhausts the pool
  }
}

// Usage
await withTransaction(pool, async (conn) => {
  const [res] = await conn.execute(
    'INSERT INTO orders (user_id, amount_minor) VALUES (?, ?)', [userId, amount]);
  await conn.execute(
    'UPDATE inventory SET qty = qty - ? WHERE product_id = ? AND qty >= ?',
    [qty, productId, qty]);
  return res.insertId;
});
```

**Rules:**

- Every statement in the transaction must use the **same connection**. Using the pool directly inside a transaction is a classic bug — those statements run outside it.
- **Never** `await` an external HTTP call, a payment gateway, or a queue publish inside a transaction. You hold locks for the duration of someone else's latency.
- Keep transactions to milliseconds.

### Idempotency

An operation is idempotent if performing it twice has the same effect as once. Networks retry; clients double-click; queues deliver at-least-once. Without idempotency, retries create duplicate orders and double charges.

```sql
CREATE TABLE idempotency_keys (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  key_value     VARCHAR(255)    NOT NULL,
  request_hash  CHAR(64)        NOT NULL,
  response_body JSON            NULL,
  status        VARCHAR(20)     NOT NULL DEFAULT 'in_progress',
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_idem_key (key_value)
) ENGINE=InnoDB;
```

```ts
// The unique constraint does the concurrency control for you
async function createOrderIdempotent(key: string, payload: OrderInput) {
  try {
    await pool.execute(
      'INSERT INTO idempotency_keys (key_value, request_hash) VALUES (?, ?)',
      [key, hash(payload)]);
  } catch (e: any) {
    if (e.errno === 1062) {                       // ER_DUP_ENTRY
      const [[row]] = await pool.execute(
        'SELECT status, response_body FROM idempotency_keys WHERE key_value = ?', [key]);
      if (row.status === 'completed') return row.response_body;   // replay the stored response
      throw new ConflictError('Request already in progress');     // 409
    }
    throw e;
  }
  const result = await withTransaction(pool, c => createOrder(c, payload));
  await pool.execute(
    'UPDATE idempotency_keys SET status = ?, response_body = ? WHERE key_value = ?',
    ['completed', JSON.stringify(result), key]);
  return result;
}
```

Other idempotency tools: a natural unique key (`UNIQUE(user_id, external_ref)`), conditional updates (`WHERE status = 'pending'`), and `INSERT ... ON DUPLICATE KEY UPDATE`.

### Real backend usage

- Order placement: create order + decrement inventory + write an outbox row, all in one transaction.
- Payment webhooks: idempotency key on the provider's event ID, so replayed webhooks are no-ops.
- Seat/slot booking: `SELECT ... FOR UPDATE` on the slot row, or a unique constraint on `(session_id, seat_no)` and let the database reject the duplicate.
- Job queue workers: `FOR UPDATE SKIP LOCKED`.
- Counter updates: `UPDATE ... SET n = n + 1` rather than read-modify-write.

### Edge cases

- **Autocommit is on by default** — every statement is its own transaction unless you begin one.
- A `ROLLBACK` does not restore consumed `AUTO_INCREMENT` values; ID gaps are normal.
- `innodb_lock_wait_timeout` defaults to 50 seconds — a request can hang that long waiting for a lock. Lower it for web workloads.
- Locks are released at commit or rollback; a connection abandoned mid-transaction holds them until it times out.
- `SELECT ... FOR UPDATE` on a non-existent row takes a gap lock, which can block inserts.
- Unique-constraint violations inside a transaction may leave partial work — check what your driver rolls back.
- Long-running transactions bloat the undo log ("history list length") and slow everything down.

### Common mistakes

1. Read-modify-write in application code without a lock or a conditional update.
2. HTTP calls (payment gateway, S3, email) inside a transaction.
3. Using `pool.query` instead of the transaction's connection.
4. Forgetting `conn.release()` in a `finally` → pool exhaustion → total outage.
5. Treating a deadlock as a fatal error instead of retrying.
6. Wrapping a whole request in one giant transaction.
7. `UPDATE ... WHERE unindexed_column = ?` locking the entire table.
8. Assuming the ORM started a transaction when it did not.

### Interview answer

> "A transaction gives atomicity, consistency, isolation and durability. InnoDB implements isolation with MVCC, so reads see a snapshot and don't block writers; only writer conflicts take row locks — and importantly it locks index records, so an update on an unindexed column locks every row it scans.
>
> MySQL defaults to REPEATABLE READ, which prevents dirty and non-repeatable reads, and unlike the bare standard InnoDB also prevents phantoms using next-key gap locks. What no isolation level below SERIALIZABLE prevents is a lost update when the read-modify-write happens in my application code — so I either make the update atomic with `SET balance = balance - ? WHERE balance >= ?`, take a pessimistic lock with SELECT FOR UPDATE for high-contention rows like inventory, or use optimistic locking with a version column for low-contention edits and return 409 on conflict.
>
> Deadlocks are expected under concurrency, so I acquire locks in a consistent order, keep transactions to milliseconds with no network calls inside them, and retry error 1213 with exponential backoff."

**Frequently asked:**

- Explain ACID.
- What are the four isolation levels and which anomaly does each prevent?
- What is MVCC?
- Dirty read vs non-repeatable read vs phantom read — give an example of each.
- Optimistic vs pessimistic locking — when do you use each?
- What causes a deadlock and how do you prevent one?
- How do you make an API endpoint idempotent?
- Why is `UPDATE x SET n = n + 1` safer than reading then writing?
- What happens if a transaction is never committed?

### Practice problems

1. Reproduce a lost update with two concurrent Node scripts; fix it three ways (atomic update, pessimistic, optimistic).
2. Deliberately cause a deadlock, read `SHOW ENGINE INNODB STATUS`, then fix it by ordering lock acquisition.
3. Build a seat-booking endpoint that cannot double-book under 100 concurrent requests. Load-test it.
4. Implement idempotency keys for `POST /orders` and prove a replayed request returns the original response.
5. Implement a job-claiming worker with `FOR UPDATE SKIP LOCKED` and run three workers concurrently.
6. Demonstrate the difference between READ COMMITTED and REPEATABLE READ with two open sessions.

### Production considerations

- Set `innodb_lock_wait_timeout` to something web-appropriate (5–10 s), not 50.
- Monitor deadlock rate, lock wait time, and the longest-running transaction. Alert on transactions open longer than a few seconds.
- Keep the transaction inside the service layer, not the controller — and never spanning multiple HTTP requests.
- For cross-service consistency use the **outbox pattern** (§6.6) plus idempotent consumers, not distributed two-phase commit.
- Document, per endpoint, whether it is idempotent and what the retry semantics are.

---

## 6.6 Advanced Database Engineering

**Priority: IMPORTANT**

### Connection pooling

**Definition.** A pool maintains a fixed set of open database connections and hands them to requests on demand, avoiding the cost of establishing a TCP + auth handshake per query.

**Why.** Connection setup costs milliseconds; MySQL's `max_connections` is finite; each connection consumes server memory. Unbounded connections are how a traffic spike takes the database down.

```ts
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,        // per Node process — see the sizing note
  queueLimit: 50,             // fail fast instead of queueing forever
  timezone: 'Z',              // treat DATETIME as UTC
  dateStrings: false,
  namedPlaceholders: true,
  enableKeepAlive: true,
});
```

**Sizing.** Node is single-threaded for JS, so a pool far larger than your concurrency does nothing but consume server resources. Total connections = `pool size × number of processes × number of instances` — this must stay well under `max_connections`. Eight to sixteen per process is a sane starting point; measure pool wait time and adjust.

**Failure mode to recognise:** all connections held by slow queries or leaked transactions → the pool queue fills → every request times out. Always `release()` in a `finally`, set `queueLimit`, and set a query timeout.

### Replication and read replicas

**How it works.** The primary writes changes to its **binary log**. Each replica's IO thread copies the binlog; its SQL thread applies the events. MySQL supports row-based (default, safest), statement-based and mixed formats.

**Replication lag is the thing that will bite you.** Replicas are **eventually consistent**. The classic bug:

```
POST /profile  → writes to primary
GET  /profile  → reads from a replica 20 ms later → returns the OLD value
```

Mitigations:

- **Read-your-own-writes:** route reads to the primary for a short window after a user's write (sticky by user/session).
- Route only latency-tolerant reads (reports, search, dashboards) to replicas.
- Monitor `Seconds_Behind_Master` / `performance_schema.replication_applier_status_by_worker` and take a replica out of rotation when it lags.

```ts
// Simple split at the data-access layer
const readPool  = createPool({ host: REPLICA_HOST, connectionLimit: 10 });
const writePool = createPool({ host: PRIMARY_HOST, connectionLimit: 10 });

export const db = {
  read:  (sql: string, p: unknown[], forcePrimary = false) =>
           (forcePrimary ? writePool : readPool).execute(sql, p),
  write: (sql: string, p: unknown[]) => writePool.execute(sql, p),
};
```

Replication also gives you high availability (promote a replica on primary failure) and a place to take backups without loading the primary.

### Partitioning

**Definition.** Splitting one logical table into multiple physical pieces within the same server, transparent to queries.

```sql
CREATE TABLE events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  occurred_at DATETIME       NOT NULL,
  payload    JSON            NOT NULL,
  PRIMARY KEY (id, occurred_at)         -- partition key must be in every unique key
)
PARTITION BY RANGE (YEAR(occurred_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION pmax  VALUES LESS THAN MAXVALUE
);

-- Dropping old data becomes instant metadata work instead of a huge DELETE
ALTER TABLE events DROP PARTITION p2024;
```

**The real win** is usually not query speed but **partition pruning** on the partition key, and cheap bulk deletion by dropping whole partitions.

**The catch:** the partition key must be part of every unique key and primary key, which constrains your design significantly. Queries that don't filter on the partition key touch every partition and get slower.

### Sharding (concepts)

**Definition.** Splitting data horizontally across **multiple database servers** by a shard key.

| Strategy | How | Trade-off |
|---|---|---|
| Range | `user_id 1–1M → shard A` | Simple; hot spots if traffic skews |
| Hash | `hash(user_id) % N` | Even distribution; resharding is painful |
| Directory | Lookup table maps key → shard | Flexible; the lookup becomes critical infrastructure |
| Geographic | By region | Data residency compliance; cross-region queries are hard |

What you lose: cross-shard joins, cross-shard transactions, global `AUTO_INCREMENT`, easy aggregate queries. You gain horizontal write scaling.

> **Interview-grade judgement:** shard last. Exhaust indexing, caching, read replicas, archiving, and vertical scaling first. A single well-tuned MySQL instance handles a great deal of traffic. Choosing the shard key is the decision you cannot easily reverse — pick the one that keeps a single tenant's or user's data on one shard.

### Backup and restore

| Type | Tool | Notes |
|---|---|---|
| Logical | `mysqldump`, `mydumper` | Portable, slow to restore at scale |
| Physical | Percona XtraBackup, snapshots | Fast restore, version-coupled |
| Point-in-time | Full backup + binlog replay | Restores to a specific second |

```bash
mysqldump --single-transaction --routines --triggers --events \
  --set-gtid-purged=OFF mydb > backup.sql
```

`--single-transaction` gives a consistent snapshot without locking InnoDB tables.

> **A backup you have never restored is not a backup.** Schedule restore drills. Measure and document your **RPO** (how much data you can afford to lose) and **RTO** (how long a restore takes). Test that the restored database actually starts and serves queries.

### Online schema changes

A plain `ALTER TABLE` on a large table can copy the whole table and block writes. Options:

1. `ALTER TABLE ... ALGORITHM=INPLACE, LOCK=NONE` — MySQL 8 handles many changes online natively (adding a nullable column, adding an index, adding a virtual generated column).
2. **`gh-ost`** (triggerless, reads the binlog) or **`pt-online-schema-change`** (trigger-based) for the rest — they build a shadow table, copy in chunks, then swap atomically.
3. Combine with expand-migrate-contract (§6.3) so the application is never broken by an in-flight change.

Always test the migration against a production-sized dataset and know how long it will run.

### Archiving and data retention

Tables grow forever unless you plan otherwise. A 500-million-row `audit_logs` table slows every backup, index rebuild and schema change.

```sql
-- Move rows older than 12 months to an archive table, in bounded chunks
INSERT INTO orders_archive
SELECT * FROM orders WHERE placed_at < NOW() - INTERVAL 12 MONTH LIMIT 5000;
DELETE FROM orders WHERE placed_at < NOW() - INTERVAL 12 MONTH LIMIT 5000;
```

Run in a loop with a pause between batches so replication does not fall behind. Better still, use range partitioning by date and drop partitions.

Define, per table: how long data is kept, where it goes next (archive table, S3/Parquet, cold storage), and what the legal or compliance requirement is (GDPR-style deletion rights change the answer).

### Transaction boundaries and the outbox pattern

**The dual-write problem.** You need to save an order *and* publish an `OrderCreated` event. If you write to the database and then publish to a queue, a crash in between loses the event. If you publish first and the database write fails, you have published a lie. Two systems, no shared transaction.

**The outbox pattern.** Write the event into a table *in the same transaction* as the business data, then have a separate process publish it.

```sql
CREATE TABLE outbox (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  aggregate_type VARCHAR(50)     NOT NULL,
  aggregate_id   VARCHAR(64)     NOT NULL,
  event_type     VARCHAR(100)    NOT NULL,
  payload        JSON            NOT NULL,
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  published_at   DATETIME(3)     NULL,
  attempts       INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_outbox_unpublished (published_at, id)
) ENGINE=InnoDB;
```

```ts
await withTransaction(pool, async (conn) => {
  const [res] = await conn.execute(
    'INSERT INTO orders (user_id, amount_minor) VALUES (?, ?)', [userId, amount]);
  await conn.execute(
    `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
     VALUES ('order', ?, 'OrderCreated', ?)`,
    [String(res.insertId), JSON.stringify({ orderId: res.insertId, userId, amount })]);
});
// A relay process polls WHERE published_at IS NULL (FOR UPDATE SKIP LOCKED),
// publishes to the broker, then marks published_at.
```

This gives **at-least-once** delivery, so consumers must be idempotent (§6.5). It is the standard, boring, correct answer to "how do you keep the database and the message broker consistent?" — and far more practical than two-phase commit.

### Event sourcing basics

**Definition.** Instead of storing current state, store the ordered sequence of events that produced it; current state is a fold over the event log.

```
Traditional:  accounts(id, balance = 500)
Event sourced: events: AccountOpened, Deposited(1000), Withdrawn(500) → balance 500
```

Benefits: complete audit trail, time travel, the ability to derive new read models retroactively.
Costs: significant complexity, schema evolution of events, snapshotting for performance, and eventual consistency between the event store and its projections.

**GOOD TO KNOW.** Most systems need an `audit_log` table, not full event sourcing. Adopt it only where the audit trail *is* the product (ledgers, compliance, trading).

### Edge cases and common mistakes (§6.6)

1. Pool size × instance count exceeding `max_connections` — the database refuses connections during a scale-up.
2. Sending a read to a replica immediately after a write and showing stale data to the user who just made it.
3. Unbounded archiving `DELETE`s that cause replication lag and lock contention.
4. Running `ALTER` directly on a large production table.
5. A backup job that has silently failed for three months.
6. Sharding before exhausting simpler options.
7. Publishing to a queue inside a database transaction (the dual-write bug the outbox exists to fix).

### Interview answer

> "For scaling reads I add read replicas and route latency-tolerant queries there, but replicas are eventually consistent, so I keep read-your-own-writes on the primary for a short window after a user writes. Connection pooling matters because total connections are pool size times process count times instances, and that has to stay under max_connections — a leaked connection in a transaction is how a pool gets exhausted and every request times out.
>
> For keeping the database consistent with a message broker I use the outbox pattern: write the event into an outbox table in the same transaction as the business data, and let a relay publish it. That gives at-least-once delivery, so consumers have to be idempotent. I'd reach for partitioning before sharding, because partitioning gives me cheap retention by dropping partitions, and sharding costs me cross-shard joins and transactions — so it's the last resort after indexing, caching, replicas and archiving."

**Frequently asked:**

- How does MySQL replication work? What is replication lag and how do you handle it?
- Partitioning vs sharding.
- How would you shard a users table? What breaks?
- What is connection pooling and how do you size the pool?
- How do you add a column to a 100-million-row table with no downtime?
- How do you keep a database write and a Kafka publish consistent? (outbox)
- What are RPO and RTO?
- What is event sourcing and when would you use it?

### Practice problems

1. Configure a primary + replica locally, write to the primary, and observe lag with a tight read loop.
2. Implement a read/write split in your data layer with a forced-primary flag for read-your-own-writes.
3. Build the outbox table + relay worker; kill the relay mid-run and confirm no events are lost or duplicated in effect.
4. Partition an `events` table by month and drop the oldest partition.
5. Run a `mysqldump` and a full restore into a fresh database; time it and write down the RTO.
6. Exhaust a connection pool on purpose by leaking a transaction, and observe the failure mode.

### Production considerations

- Monitor: replication lag, connection count vs `max_connections`, pool wait time, buffer pool hit rate, deadlock rate, slow query count, disk usage growth, oldest open transaction.
- Alert on backup failure and on restore drill results, not just on backup job success.
- Keep the primary for writes and read-your-own-writes; everything else can drift.
- Capacity-plan on disk growth per table per month, decided at schema design time.

---

## 6.7 Quick Reference

### Query design checklist

- [ ] Is every `WHERE`, `JOIN` and `ORDER BY` column indexed appropriately?
- [ ] Is the composite index ordered equality → range → sort?
- [ ] Is every predicate sargable (no functions on the column, no leading `%`, no type mismatch)?
- [ ] Does `EXPLAIN` show `ref`/`range`/`const` rather than `ALL`?
- [ ] Is `Using filesort` or `Using temporary` present, and can an index remove it?
- [ ] Is `rows_examined / rows_sent` reasonable?
- [ ] Is the result bounded by `LIMIT`, and is the `ORDER BY` deterministic?
- [ ] Are only the needed columns selected (no `SELECT *`)?
- [ ] Are all inputs parameterised?
- [ ] Is `tenant_id` in the `WHERE` clause and leading the index?

### Schema design checklist

- [ ] 3NF unless there is a measured, documented reason to denormalise
- [ ] Correct types — `DECIMAL`/minor units for money, UTC datetimes, `utf8mb4`
- [ ] PK strategy suits InnoDB (sequential); external IDs separate if needed
- [ ] Foreign keys declared with the right `ON DELETE` action
- [ ] `NOT NULL` wherever the value is genuinely required
- [ ] `CHECK` constraints for enumerations and ranges
- [ ] `created_at` / `updated_at` on every table
- [ ] Soft delete decided explicitly, with unique constraints handled
- [ ] Naming convention followed exactly
- [ ] Retention/archival policy decided
- [ ] Change delivered as a reviewed migration, expand-migrate-contract if breaking

### Error codes worth recognising

| Code | Meaning | Response |
|---|---|---|
| 1062 | Duplicate entry (unique violation) | 409 Conflict |
| 1451/1452 | Foreign key constraint fails | 400/409 |
| 1213 | Deadlock | Retry with backoff |
| 1205 | Lock wait timeout | Retry / 503 |
| 1406 | Data too long for column | 400 |
| 3819 | CHECK constraint violated | 400 |
| 1040 | Too many connections | Alert — capacity issue |

### Commands you will use constantly

```sql
EXPLAIN ANALYZE SELECT ...;
SHOW CREATE TABLE orders\G
SHOW INDEX FROM orders;
SHOW PROCESSLIST;                       -- what is running right now
SHOW ENGINE INNODB STATUS\G             -- deadlocks, lock waits
ANALYZE TABLE orders;                   -- refresh optimiser statistics
SELECT * FROM sys.statement_analysis ORDER BY total_latency DESC LIMIT 10;
SELECT * FROM sys.schema_unused_indexes;
SELECT * FROM performance_schema.data_lock_waits;
```

---

## 6.8 Practice Plan

**Build one schema and one API, then optimise it. Reading about indexes teaches nothing; watching `rows examined` drop from 2.4 million to 31 teaches permanently.**

| Week | Focus | Deliverable |
|---|---|---|
| 1 | 6.1 Fundamentals | Schema for users/orders/products with full constraints; 30 queries covering every clause |
| 2 | 6.2 Joins | 20 report queries: anti-joins, latest-per-user, duplicates, monthly stats, window functions |
| 3 | 6.3 Design | Normalise a messy dataset to 3NF; model many-to-many and a hierarchy; write the migrations |
| 4 | 6.4 Indexes | Seed 1M+ rows; `EXPLAIN` before/after for 10 queries; build a covering index; convert to cursor pagination |
| 5 | 6.5 Transactions | Reproduce and fix a lost update three ways; cause and fix a deadlock; build idempotent `POST /orders` |
| 6 | 6.6 Advanced | Replica + read/write split; outbox + relay; partitioned events table; backup and restore drill |

**Seed realistically.** A dev database with 200 rows will make every query look fast and teach you nothing. Generate at least a million rows:

```sql
-- Quick row multiplier: doubles the table each run
INSERT INTO orders (user_id, amount_minor, placed_at)
SELECT FLOOR(1 + RAND() * 10000), FLOOR(RAND() * 500000),
       NOW() - INTERVAL FLOOR(RAND() * 730) DAY
FROM orders LIMIT 100000;
```

**Weekly rhythm** (mirrors the roadmap's method): Mon learn · Tue write the SQL by hand · Wed wire it into your Node project · Thu break it (nulls, duplicates, concurrency, huge data) and fix it · Fri explain three concepts aloud · Sat build one feature end to end · Sun review `EXPLAIN` output for everything you wrote.

---

## Phase 6 Completion Checklist

You are ready for Phase 7 (ORM and Data Access) when you can, without looking anything up:

**Fundamentals**
- [ ] State the logical order of query evaluation and explain why an alias fails in `WHERE`.
- [ ] Explain three-valued logic and the `NOT IN` NULL trap.
- [ ] Choose the right type for money, timestamps, identifiers and text, and justify each.
- [ ] Write a `CREATE TABLE` with PK, FK, unique, check, defaults, audit columns and correct charset.

**Querying**
- [ ] Write inner, left, self and anti-joins from memory and say what each returns.
- [ ] Explain `ON` vs `WHERE` on a `LEFT JOIN` with a concrete difference.
- [ ] Spot and fix row multiplication in an aggregate query.
- [ ] Get the latest row per user two ways (window function and derived table).
- [ ] Write a recursive CTE for a hierarchy, with a depth bound.

**Design**
- [ ] Explain 1NF, 2NF, 3NF with your own example.
- [ ] Justify a denormalisation decision and name its sync strategy.
- [ ] Explain why a random UUID primary key hurts InnoDB.
- [ ] Make a soft-deleted email reusable while keeping the unique constraint.
- [ ] Add a `NOT NULL` column to a huge table with zero downtime.

**Indexes**
- [ ] Explain B+ trees, clustered vs secondary indexes, and the bookmark lookup.
- [ ] Apply the leftmost-prefix rule and order a composite index correctly.
- [ ] Read `EXPLAIN`: interpret `type`, `key`, `rows`, and the `Extra` column.
- [ ] Name five things that make a predicate non-sargable and rewrite each.
- [ ] Explain why `OFFSET 100000` is slow and implement cursor pagination.
- [ ] Explain the write cost of an index and how you decide to add one.

**Transactions**
- [ ] Explain ACID and how InnoDB implements each letter.
- [ ] Name the four isolation levels and the anomaly each prevents — including what InnoDB's REPEATABLE READ does about phantoms.
- [ ] Fix a lost update three different ways and say when each is appropriate.
- [ ] Explain what causes a deadlock, how to prevent it, and why you retry it.
- [ ] Make a `POST` endpoint idempotent and explain the unique-constraint trick.
- [ ] Explain why an `UPDATE` on an unindexed column can lock the whole table.

**Advanced**
- [ ] Explain replication lag and the read-your-own-writes problem.
- [ ] Size a connection pool and describe pool exhaustion.
- [ ] Explain partitioning vs sharding and when each is justified.
- [ ] Explain the dual-write problem and the outbox pattern.
- [ ] State your RPO and RTO and describe a restore drill.

**Backend connection**
- [ ] Explain the N+1 problem and fix it with a batch query plus an in-memory map.
- [ ] Explain why an unindexed query is worse in Node than in a threaded runtime.
- [ ] Connect B+ tree indexes back to Phase 3's binary search and balanced trees.
- [ ] Never write SQL by string concatenation, and explain prepared statements.

---

**Next:** Phase 7 — ORM, Query Builders and Data Access (raw SQL vs ORM, repository pattern, transactions in Prisma/Knex/TypeORM, N+1 and eager vs lazy loading, migrations, query logging, injection prevention).

# Phase 18 — Multi-Tenant SaaS Backend
**Priority: MUST KNOW for SaaS roles**

> Framework applied to each topic: Definition → Simple meaning → Why it's needed → How it works internally → Syntax/API → Small example → Real backend usage → Edge cases → Common mistakes → Interview answer → Practice problem → Production considerations

> **Critical rule from the roadmap:** Every tenant-scoped query must be protected against missing or incorrect tenant filters. Treat this as the single most important rule in this phase — most multi-tenant security incidents trace back to one query that forgot the tenant filter.

---

## 18.1 Tenant Isolation Models

### Definition
Tenant isolation is the architectural strategy that determines how one customer's ("tenant's") data is kept separate from another's in a system serving many customers from shared infrastructure.

### The three models
| Model | Description | Isolation strength | Operational cost |
|---|---|---|---|
| **Shared database / shared schema** | All tenants in the same tables, distinguished by a `tenant_id` (or `organization_id`) column | Lowest — enforced entirely in application code | Lowest — one schema, one set of migrations |
| **Shared database / separate schema** | Each tenant gets its own schema within one database instance | Medium | Medium — per-tenant migrations, more connections |
| **Separate database per tenant** | Each tenant gets an entirely separate database | Highest | Highest — provisioning, backups, migrations multiply per tenant |

**Why needed:** The choice directly trades off engineering simplicity against isolation guarantees and per-tenant cost. Most SaaS products start with shared schema for simplicity and move specific large/regulated tenants to dedicated databases later.

**How it works internally (shared schema):** Every tenant-owned table carries a `tenant_id` foreign key; every query that reads or writes tenant data must filter by it. There is no database-level barrier preventing a query from omitting the filter — the guarantee is purely in application/middleware discipline (or database row-level security, see 18.4).

**Real backend usage:** A learning platform with `organizations`, `trainers`, `learners`, and `batches` tables in one shared schema, every row carrying `organization_id`, is the shared-schema model — the most common starting point for SaaS products, including training/learner-management platforms.

**Edge cases:**
- A tenant that grows very large (data volume, compliance needs) may need to be "peeled off" into its own database later — design your data-access layer so this migration doesn't require a rewrite.
- Shared schema makes noisy-neighbor problems possible (one tenant's heavy query load slows down others sharing the same database).

**Common mistakes:** Choosing separate-database-per-tenant too early "for safety" when the team can't yet operate the migration/backup overhead at scale; choosing shared-schema for tenants with strict regulatory data-residency requirements without a path to isolate them later.

**Interview answer:** "Shared schema with a tenant_id column is the simplest and cheapest to run, but isolation depends entirely on application code being correct on every query. Separate database per tenant gives the strongest isolation and is easiest to reason about for compliance, at the cost of multiplying operational work — migrations, backups, and connection management all scale with tenant count."

---

## 18.2 Tenant Context and Tenant-Aware Queries

### Tenant context
**Definition:** The mechanism by which the current request's tenant identity is determined and made available throughout the request lifecycle (middleware → controller → service → repository), without being re-derived or re-trusted at each layer.

**How it works internally:** On authentication, the tenant ID is resolved (from the JWT claim, subdomain, or a header) and attached to the request context. Every downstream data-access call reads the tenant ID from this trusted context — never from a client-supplied value in the query/body, which could be forged.

**Syntax/API (Express + TypeScript middleware):**
```ts
interface TenantContext {
  organizationId: string;
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export const tenantMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const payload = req.user; // set by auth middleware after JWT verification
  if (!payload?.organizationId) {
    return res.status(401).json({ success: false, error: { code: 'NO_TENANT_CONTEXT' } });
  }
  req.tenant = {
    organizationId: payload.organizationId,
    userId: payload.userId,
    role: payload.role,
  };
  next();
};
```

**Critical rule in practice:** The `organizationId` must come from the verified JWT, **never** from `req.body.organizationId` or a route param the client controls. A client sending `{ organizationId: 'someone-elses-org' }` in the body must never be able to override the authenticated tenant context.

### Tenant-aware queries and repository pattern
**Why needed:** Repeating `WHERE organization_id = ?` by hand in every query is error-prone — one missed clause is a data leak across tenants. Centralizing tenant scoping in the repository layer makes the safe path the *only* path.

**Small example (MySQL, tenant-scoped repository):**
```ts
class LearnerRepository {
  constructor(private db: DbServices, private tenant: TenantContext) {}

  async findById(learnerId: string) {
    return this.db.queryOne(
      `SELECT * FROM learners WHERE id = ? AND organization_id = ?`,
      [learnerId, this.tenant.organizationId]
    );
  }

  async update(learnerId: string, fields: Partial<Learner>) {
    // organization_id in WHERE, never only in the SET — an UPDATE without
    // the tenant filter is exactly as dangerous as a SELECT without it.
    return this.db.execute(
      `UPDATE learners SET status = ? WHERE id = ? AND organization_id = ?`,
      [fields.status, learnerId, this.tenant.organizationId]
    );
  }
}
```

**Real backend usage:** A repository is instantiated per-request with the tenant context bound in, so every method it exposes is tenant-scoped by construction — a developer adding a new query method has to actively go out of their way to *skip* the tenant filter, rather than having to remember to add it.

**Edge cases:** Joins across tenant-owned tables must filter on tenant ID at *every* joined table where it's stored — filtering only the outer table can still leak rows from a join if the inner table isn't also scoped.

**Common mistakes:**
- Filtering tenant ID only on `SELECT`s and forgetting it on `UPDATE`/`DELETE` — an `UPDATE ... WHERE id = ?` without the tenant clause lets one tenant modify another tenant's row if they guess/enumerate an ID.
- Trusting a tenant ID passed in the request body/query string instead of the authenticated context.
- Caching query results keyed only by resource ID without including tenant ID in the cache key (see 18.7-adjacent caching phase) — this can serve tenant A's cached data to tenant B.

**Interview answer:** "Tenant context should be resolved once, from a trusted source like a verified JWT claim, and threaded through every layer via a request-scoped context object or dependency injection. The repository layer should make it structurally difficult to write an un-scoped query — for example by requiring the tenant ID as a constructor dependency rather than a per-call parameter that could be forgotten."

---

## 18.3 Row-Level Security Concepts

**Definition:** A database-enforced access control mechanism that restricts which rows a query can see or modify, based on a session-level attribute (e.g. current tenant), independent of what the application code's `WHERE` clause says.

**Why needed:** Application-level tenant filtering (18.2) has a single point of failure: one buggy or forgotten `WHERE` clause. Row-level security (RLS) adds a second, database-enforced layer so that even a query missing its tenant filter cannot return another tenant's rows.

**How it works internally:** Postgres has native RLS (`CREATE POLICY`); MySQL does not have built-in RLS, so the equivalent is typically implemented via **views scoped by session variable**, application-enforced conventions, or moving strict isolation needs to separate schemas/databases for tenants that require it.

**Note for a MySQL-based stack:** Since MySQL lacks native RLS, the practical mitigations are: (1) strict repository-layer scoping as the primary defense (18.2), (2) integration tests that specifically attempt cross-tenant access and assert failure (18.6), and (3) for tenants needing the strongest guarantee, isolating them to a separate schema/database rather than relying on row-level filtering alone.

**Production considerations:** Defense in depth — application-layer scoping plus automated cross-tenant access tests plus, where the database supports it, RLS policies as a backstop — is safer than relying on any single layer.

---

## 18.4 Tenant-Specific Configuration

**Learn:** Feature flags per tenant, tenant-level branding/theming, tenant-level integration settings (e.g. a custom SMTP sender, a custom SSO provider), configuration precedence (system default → plan-tier default → tenant override).

**Small example:**
```ts
interface TenantConfig {
  organizationId: string;
  features: { bulkExcelUpload: boolean; ssoEnabled: boolean };
  branding: { logoUrl?: string; primaryColor?: string };
  limits: { maxLearners: number; maxTrainers: number };
}
```

**Real backend usage:** A training platform where one organization has bulk Excel upload for learner onboarding enabled and another doesn't — read from `TenantConfig`, not from a hardcoded global flag.

**Common mistakes:** Storing tenant config in application memory/cache without invalidation on update (a tenant changes a setting and it doesn't take effect until the next deploy); mixing tenant config with tenant *data* in a way that makes config changes require the same audit/versioning rigor as business data when it may not need to.

---

## 18.5 Billing, Quotas, and Usage Metering

**Learn:** Plan tiers, seat-based vs usage-based billing, quota enforcement (hard cap vs soft warning), usage metering (counting API calls, storage, active users per tenant), tenant-level rate limits, overage handling, proration on plan change.

**Syntax/API (quota check before a write):**
```ts
async function assertLearnerQuota(tenant: TenantContext, db: DbServices) {
  const { maxLearners } = await getTenantLimits(tenant.organizationId, db);
  const { count } = await db.queryOne(
    `SELECT COUNT(*) as count FROM learners WHERE organization_id = ? AND record_status = ?`,
    [tenant.organizationId, RECORD_STATUS.ACTIVE]
  );
  if (count >= maxLearners) {
    throw new AppError('QUOTA_EXCEEDED', `Learner limit (${maxLearners}) reached for this plan`);
  }
}
```

**Edge cases:** Race conditions on quota checks under concurrent requests (two simultaneous signups both pass a quota check that would only allow one) — mitigate with a transaction + `SELECT ... FOR UPDATE`, or an atomic counter, rather than a plain check-then-insert.

**Common mistakes:** Enforcing quotas only in the UI, not the API — any direct API call bypasses the limit; metering usage asynchronously/in batch when the business requires real-time enforcement (e.g. hard usage caps).

**Production considerations:** Usage metering pipelines are often eventually consistent (aggregated periodically) — decide explicitly whether your quota enforcement needs to be real-time (synchronous check) or can tolerate a short lag (async reconciliation with grace).

---

## 18.6 Cross-Tenant Access Prevention and Testing

**Why needed:** This is the highest-severity failure mode in multi-tenant systems — a cross-tenant data leak is a security incident, not just a bug.

**Practice discipline:** For every tenant-scoped endpoint, write an explicit integration test where **Tenant A's authenticated user attempts to read/update/delete a resource belonging to Tenant B**, and assert it fails (404 or 403, not 200 with someone else's data).

**Small example (test pattern):**
```ts
it('prevents cross-tenant learner access', async () => {
  const orgAToken = await loginAs(orgA_admin);
  const learnerInOrgB = await createLearner(orgB.id);

  const res = await request(app)
    .get(`/api/learners/${learnerInOrgB.id}`)
    .set('Authorization', `Bearer ${orgAToken}`);

  expect(res.status).toBe(404); // not 200, and not a 403 that confirms the record exists
});
```

**Edge cases:** Returning `403 Forbidden` (rather than `404 Not Found`) for a cross-tenant lookup can itself leak information — it confirms the record *exists*, just isn't accessible. Many SaaS systems deliberately return `404` for cross-tenant access attempts to avoid this enumeration signal.

**Common mistakes:** Testing only the "happy path" (a tenant accessing its own data) and never writing the negative cross-tenant test; relying solely on manual QA for this instead of an automated regression test that runs on every deploy.

**Interview answer:** "Cross-tenant access prevention has to be tested explicitly and automatically — it's the one class of bug that's invisible in normal single-tenant testing and only surfaces when two tenants' data coexists. I'd add it as a standard test pattern for every tenant-scoped endpoint, not an afterthought."

---

## 18.7 Audit Logs, Data Export, and Tenant Deletion

**Learn:** Audit logging (who changed what, when, from where — scoped per tenant), self-service data export (GDPR-style "export my data"), tenant offboarding/deletion (soft delete vs hard delete, data retention period before purge, cascading deletion across related tables), the interaction between audit logs and deletion (audit trails often must be retained even after the tenant's operational data is deleted, for compliance).

**Common mistakes:** Hard-deleting a tenant's data immediately on cancellation with no recovery window (a common source of costly support incidents when a cancellation was accidental or a billing dispute is later reversed); forgetting that cascading a tenant deletion across dozens of tables needs to be transactional or resumable, not a script that can half-complete and leave orphaned rows.

**Production considerations:** Model tenant deletion as a **workflow** (mark for deletion → grace period → background job performs cascading soft-then-hard delete → confirmation), not a single synchronous `DELETE` call — this mirrors the retryable background-job patterns from the messaging phase of this roadmap.

---

## Practice: Build a Tenant-Aware Module

Using the roadmap's suggested exercise — build **organization, user, role, and project modules** — applied to a training/learner-management domain (organizations → trainers/learners → batches):

1. **Schema:** `organizations`, `users` (with `organization_id`, `role`), `batches` (with `organization_id`), each carrying `RECORD_STATUS` and audit columns.
2. **Tenant-aware middleware:** Resolve `organizationId` from the verified JWT only; attach to `req.tenant`; reject requests with no resolvable tenant context.
3. **Repository layer:** Every method requires `organizationId` scoping baked in at construction, not passed loosely per call.
4. **Cross-tenant test suite:** For each endpoint (create/read/update/delete batch, list learners), write a test where an authenticated user from Org A attempts the same action against an Org B resource, asserting `404`.
5. **Quota check:** Enforce a `maxLearners` per organization at the write path, with a transaction-safe check to avoid race conditions on concurrent signups.
6. **Tenant deletion workflow:** Implement "mark organization for deletion" → grace-period job → cascading soft delete across `users`, `batches`, and related tables, keeping audit log entries intact.

---

## Phase 18 Interview Quick-Reference

- **Isolation spectrum:** shared schema (cheap, weakest isolation) → separate schema → separate database (expensive, strongest isolation).
- **Golden rule:** tenant ID always comes from verified server-side context (JWT claim), never from client-supplied body/query values.
- **Repository discipline:** bind tenant ID into the repository/service construction so an un-scoped query is structurally hard to write, not just a convention to remember.
- **MySQL has no native RLS** — the practical mitigation is strict application-layer scoping plus mandatory automated cross-tenant tests, with dedicated schemas/databases as the backstop for tenants needing stronger guarantees.
- **Cross-tenant test = mandatory regression test**, not optional QA — return `404`, not `403`, to avoid confirming resource existence across tenants.
- **Deletion and quotas are workflows**, not single synchronous operations — race conditions and partial-failure need explicit handling.

## Phase 18 Completion Checklist
- [ ] Can compare shared-schema, shared-database/separate-schema, and separate-database isolation models with their tradeoffs
- [ ] Can implement tenant context resolution from a verified JWT, never from client-supplied values
- [ ] Can design a repository layer where tenant scoping is structural, not optional
- [ ] Understands why MySQL needs application-layer + test-layer defenses in place of native row-level security
- [ ] Can design tenant-level configuration, quotas, and usage metering with race-condition safety
- [ ] Has written at least one automated cross-tenant access test that asserts failure
- [ ] Can design a tenant deletion/offboarding workflow that handles cascading, grace periods, and audit retention

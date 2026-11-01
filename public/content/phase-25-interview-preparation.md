# Phase 25 — Interview Preparation

> Part of the **Zero to Expert Backend Engineering Master Roadmap**
> **Priority:** MUST KNOW (implicit — this is the final direct-preparation phase before interviews)
> **Previous phase:** Phase 24 — Portfolio Projects
> **This is the final numbered phase of the roadmap.**

---

## Why Phase 25 Exists

Phases 1 through 24 built the knowledge. Phase 25 is where you **compress it into answers you can say out loud, under pressure, in under 90 seconds, without notes.** Interviewers are not testing whether you've *seen* a topic — they're testing whether you can explain it clearly, show a working example, and reason about tradeoffs on the spot. That is a different skill from understanding, and it has to be practiced separately.

This phase does not re-teach anything from scratch — if a topic below feels shaky, that's a signal to revisit its home phase (noted in each section), not to learn it here for the first time. What follows is the **compression and drilling** pass: crisp definitions, model spoken answers, the follow-up questions interviewers actually chain onto each topic, and the red flags that make an answer sound junior even when the candidate technically "knows" the material.

Six rounds, matching how backend interviews are actually structured:

| # | Round | Topics | Home phase |
|---|-------|--------|------------|
| 25.1 | JavaScript | Closure, Hoisting, `this`, Prototype, Event loop, Promise behavior, Async patterns, Deep vs shallow copy, Map/filter/reduce, Memory leaks | Phase 1 |
| 25.2 | TypeScript | Interface vs type, Any vs unknown, Generics, Union and intersection, Type guards, Utility types, Runtime validation, Strict mode | Phase 2 |
| 25.3 | Node.js | Event loop, Streams, Buffers, Worker threads, Middleware, Error handling, Graceful shutdown, Cluster and process model | Phase 4 |
| 25.4 | MySQL | Joins, Indexes, EXPLAIN, Transactions, Isolation levels, Deadlocks, Pagination, Normalization, Query optimization | Phase 6 |
| 25.5 | LLD | SOLID, Composition, Interfaces, Design patterns, Extensibility, Testability | Phase 10 |
| 25.6 | HLD | Requirements, Capacity estimation, APIs, Data model, Scaling, Caching, Queues, Failure handling, Observability, Tradeoffs | Phase 11 |

---

## How to Use This Phase

**The format per topic is deliberately different from earlier phases** — this is a drilling pass, not a first-time teaching pass:

| Element | Purpose |
|---|---|
| **One-line definition** | The sentence you say *first*, before elaborating. If you can't say this instantly, drill that topic more. |
| **Model answer** | A 60–90 second spoken answer. Read it, then say your *own* version out loud — memorizing the exact wording sounds robotic; internalizing the structure sounds fluent. |
| **Example** | A short code/diagram snippet, only where it genuinely clarifies — interviewers often ask you to sketch this from memory. |
| **Follow-ups** | The specific questions interviewers chain onto this topic once you've given the surface answer. This is usually where candidates who "know the definition" get caught out. |
| **Red flags** | Answer patterns that signal shaky understanding, even when technically not wrong. |

**The universal answer structure** (use it for *any* technical question, not just the ones below):

```text
1. One-line definition          "A closure is a function that retains access to its
                                  enclosing scope's variables even after that scope has
                                  returned."
2. Why it matters / when it     "It's how we get data privacy and factory functions
   comes up                      without classes, and it's the mechanism behind things
                                  like useState in React."
3. A small concrete example      (sketch 4-6 lines of code or a diagram)
4. One tradeoff or edge case     "The cost is that closures keep their captured variables
                                  alive in memory for as long as the closure exists, which
                                  is a common source of memory leaks in long-running
                                  Node processes."
```

This is the same shape as the "Interview answer" step you've been practicing since Phase 0 — Phase 25 just applies it exhaustively across every topic at once.

**How to drill:** cover the model answer, say your own version out loud, then check it against the model and the follow-ups. Do this daily in the final weeks before interviewing (see the roadmap's Friday "Interview Practice" study day). Time yourself — if an answer takes longer than 90 seconds, you're including detail the interviewer didn't ask for; practice cutting to the essential structure above.

---

## Table of Contents

- 25.1 JavaScript (10 topics)
- 25.2 TypeScript (8 topics)
- 25.3 Node.js (8 topics)
- 25.4 MySQL (9 topics)
- 25.5 LLD (6 topics)
- 25.6 HLD (10 topics)

**Wrap-up**
- Mock Interview Simulation (six back-to-back rounds, timed)
- 100-Question Rapid-Fire Self-Test (flashcard mode)
- Cheat Sheets
- Exit Checklist

---

# 25.1 JavaScript

*(Full depth: Phase 1 — JavaScript from Zero to Advanced)*

---

### Closure

**Definition:** A function that retains access to variables from its enclosing (lexical) scope even after that outer scope has finished executing.

**Model answer:**
> "A closure happens whenever a function is defined inside another function and keeps a reference to the outer function's variables. Even after the outer function returns, the inner function still has access to those variables — they aren't garbage collected because the closure is still holding a reference to them. This is how you build things like counters or factory functions with private state, without needing a class. The tradeoff is that anything captured by a closure stays in memory as long as the closure itself is reachable, so closures kept alive unintentionally — like inside a long-lived event listener or cache — are a classic source of memory leaks."

```js
function makeCounter() {
  let count = 0;                    // captured by the closure
  return () => ++count;             // this inner function IS the closure
}
const counter = makeCounter();
counter(); counter();               // 1, 2 — count persists between calls, private to this counter
```

**Follow-ups**
- *"Is each closure's captured variable shared or separate per call?"* — Separate per invocation of the outer function; each call to `makeCounter()` creates a new `count`.
- *"What's a real closure bug in a loop?"* — `for (var i = 0; i < 3; i++) setTimeout(() => console.log(i))` logs `3, 3, 3` because `var` is function-scoped and all three closures share the same `i`; `let` fixes it by giving each iteration its own binding.
- *"How do closures cause memory leaks in Node?"* — An event listener or cache callback that closes over a large object keeps that object alive for as long as the listener is registered, even if nothing else references it.

**Red flags:** defining a closure as "a function inside a function" with no mention of *retained access after the outer scope returns* — that's the part that actually matters.

---

### Hoisting

**Definition:** JavaScript's behavior of processing variable and function declarations during the compile phase, before code executes line by line — so declarations appear "moved" to the top of their scope, though initialization does not move with them.

**Model answer:**
> "During compilation, JavaScript registers `var`, `let`, `const`, and function declarations in their scope before any code runs. `var` declarations are hoisted and initialized to `undefined`, so you can reference them before their line without a crash, just get `undefined`. `let` and `const` are hoisted too, but not initialized — they sit in the 'temporal dead zone' from the start of the scope until their declaration line, so accessing them early throws a `ReferenceError` instead of silently giving `undefined`. Function declarations are hoisted fully, body included, so you can call them before their definition; function expressions are not — only the variable they're assigned to follows the normal `var`/`let` hoisting rules."

```js
console.log(a);          // undefined (var hoisted, not yet assigned)
var a = 1;

console.log(b);          // ReferenceError (temporal dead zone)
let b = 2;

greet();                 // works — function declarations hoist fully
function greet() { console.log('hi'); }

sayHi();                 // TypeError: sayHi is not a function (only the `var` hoisted, not the value)
var sayHi = function () { console.log('hi'); };
```

**Follow-ups**
- *"Why does `let` throw instead of returning `undefined`?"* — Intentional design (temporal dead zone) to catch use-before-declaration bugs that `var`'s silent `undefined` used to hide.
- *"Are class declarations hoisted?"* — Hoisted like `let`/`const` — they exist in the TDZ, so referencing a class before its declaration throws.

**Red flags:** saying "hoisting moves code to the top" without distinguishing declaration from initialization — that distinction is the entire concept.

---

### `this`

**Definition:** A keyword whose value is determined by **how a function is called** (its call-site), not where it's defined — except for arrow functions, which inherit `this` lexically from their enclosing scope.

**Model answer:**
> "`this` is set based on how a function is invoked. Called as a method — `obj.method()` — `this` is `obj`. Called as a plain function, `this` is `undefined` in strict mode, or the global object otherwise. Called with `new`, `this` is the newly created object. Called with `.call`, `.apply`, or `.bind`, `this` is whatever you explicitly pass. Arrow functions break this pattern entirely: they don't have their own `this` at all — they capture `this` lexically from the scope they were defined in, which is exactly why arrow functions are the fix for the classic 'this is undefined inside a callback' bug in class methods and event handlers."

```js
const obj = {
  name: 'Asha',
  regular() { return this.name; },          // 'Asha' — called as obj.regular()
  arrow: () => this?.name,                  // undefined — `this` is lexical (from module scope, not obj)
};

class Timer {
  constructor() { this.seconds = 0; }
  start() {
    setInterval(function () { this.seconds++; }, 1000);   // BUG: `this` is not the Timer instance here
    setInterval(() => { this.seconds++; }, 1000);          // FIX: arrow function keeps `this` = Timer
  }
}
```

**Follow-ups**
- *"What does `this` equal inside a regular function called as `foo()`?"* — `undefined` in strict mode / ES modules, the global object in loose non-strict mode.
- *"Difference between `call`, `apply`, and `bind`?"* — `call(thisArg, a, b)` invokes immediately with listed args; `apply(thisArg, [a, b])` invokes immediately with an array of args; `bind(thisArg)` returns a *new function* with `this` permanently fixed, invoked later.

**Red flags:** "`this` refers to the object it's inside of" — wrong for regular functions and meaningless for arrow functions; `this` is about the call-site, not the lexical location (except for arrows, where it *is* about lexical location).

---

### Prototype

**Definition:** The mechanism by which JavaScript objects inherit properties and methods from other objects, forming a chain (`__proto__` → its prototype → its prototype → ... → `null`) that property lookups walk when a property isn't found directly on the object.

**Model answer:**
> "Every object has an internal link to another object, its prototype, and when you access a property that isn't on the object itself, JavaScript walks up the prototype chain until it finds it or reaches `null`. This is how methods are shared without being copied onto every instance — an array's `.map` isn't stored on each array, it lives once on `Array.prototype`, and every array delegates to it. `class` syntax in modern JavaScript is mostly sugar over this same prototype mechanism — `class Dog extends Animal` sets up `Dog.prototype`'s prototype to be `Animal.prototype` under the hood."

```js
const animal = { eats: true };
const dog = Object.create(animal);          // dog's prototype is `animal`
dog.barks = true;
console.log(dog.eats, dog.barks);           // true, true — `eats` found via the prototype chain
console.log(Object.getPrototypeOf(dog) === animal);   // true

class Animal { constructor(name) { this.name = name; } }
class Dog extends Animal { bark() { return `${this.name} says woof`; } }
console.log(Object.getPrototypeOf(Dog.prototype) === Animal.prototype);   // true
```

**Follow-ups**
- *"Difference between `__proto__` and `prototype`?"* — `prototype` is a property that exists on *functions/classes*, used as the object new instances link to; `__proto__` (or `Object.getPrototypeOf`) is the actual link every object has to its own prototype.
- *"What happens looking up a property that's nowhere in the chain?"* — Returns `undefined`, does not throw.
- *"Performance implication of deep prototype chains?"* — Each lookup miss walks another link — very deep chains slow property access, though this rarely matters in practice.

**Red flags:** confusing `prototype` (the function's blueprint property) with `__proto__` (an instance's actual link) — interviewers ask this specifically to catch the mix-up.

---

### Event Loop

**Definition:** The mechanism that lets JavaScript — single-threaded by design — handle asynchronous operations by running the call stack to completion, then pulling queued callbacks (microtasks first, then macrotasks) to run next, in a continuous loop.

**Model answer:**
> "JavaScript has one call stack and runs synchronous code to completion before doing anything else. Asynchronous work — timers, I/O, promises — doesn't block that stack; it's handed off to the browser or Node's APIs, and when it's ready, a callback is queued. The event loop's job is: once the call stack is empty, drain the entire microtask queue — promise callbacks, `queueMicrotask` — before touching the macrotask queue, which holds things like `setTimeout` callbacks and I/O callbacks. That priority is why a resolved promise's `.then` always runs before a `setTimeout(fn, 0)`, even though both were queued at the same 'time zero'."

```js
console.log('1');
setTimeout(() => console.log('2'), 0);      // macrotask
Promise.resolve().then(() => console.log('3'));   // microtask
console.log('4');
// Output: 1, 4, 3, 2  — sync code first, then ALL microtasks, then macrotasks
```

**Follow-ups**
- *"What's the difference between the microtask and macrotask queue?"* — Microtasks (promises, `queueMicrotask`) fully drain — including any new microtasks queued while draining — before a single macrotask (timers, I/O, `setImmediate`) runs.
- *"Can the microtask queue starve the event loop?"* — Yes — a microtask that queues another microtask forever will never let macrotasks (or rendering, in a browser) run.
- *"What does 'JavaScript is single-threaded' actually mean given Node has a thread pool?"* — Your JavaScript code runs on one thread; the *runtime* (libuv) uses multiple OS threads for certain blocking work under the hood, but none of that ever runs your JS concurrently with itself. See Phase 0.1.3 and Phase 4.

**Red flags:** saying "`setTimeout(fn, 0)` runs immediately" — it never does; it always waits for the current synchronous code *and every queued microtask* first.

---

### Promise Behavior

**Definition:** A `Promise` is an object representing the eventual completion (`fulfilled`) or failure (`rejected`) of an asynchronous operation, starting in a `pending` state and settling exactly once.

**Model answer:**
> "A promise has three states — pending, fulfilled, or rejected — and once it settles, it can never change state again. `.then` registers a fulfillment handler, `.catch` a rejection handler, and both return a *new* promise, which is what makes chaining work — if a `.then` handler throws, the chain's next `.catch` catches it, no matter how many `.then`s are in between. `async`/`await` is syntax sugar over this same mechanism: `await` pauses the async function until the promise settles, and a thrown error inside an async function becomes a rejected promise, catchable with a normal `try/catch` around the `await`."

```js
fetch('/a').then((r) => r.json()).then((data) => { throw new Error('bad'); }).catch((e) => console.log(e.message));
// the .catch at the end catches the throw from a .then two steps earlier — errors propagate down the chain

async function get() {
  try { return await fetch('/a').then((r) => r.json()); }
  catch (e) { console.error(e); }
}
```

**Follow-ups**
- *"What happens if you don't catch a rejected promise?"* — An "unhandled promise rejection" — in Node, this can crash the process depending on version/config; always attach a `.catch` or wrap `await` in `try/catch`.
- *"Difference between `Promise.all`, `allSettled`, `race`, and `any`?"* — `all` rejects as soon as any one rejects; `allSettled` always waits for every promise and reports each outcome; `race` settles as soon as the first promise settles, fulfilled or rejected; `any` fulfills as soon as the first one fulfills, ignoring rejections unless *all* reject.
- *"Can a promise settle more than once?"* — No — the resolve/reject functions are no-ops after the first call.

**Red flags:** describing `async`/`await` as "different from promises" instead of sugar built directly on top of them — an `async` function always returns a promise, `await` always unwraps one.

---

### Async Patterns

**Definition:** The set of techniques for coordinating multiple asynchronous operations — sequential execution, parallel execution, limited concurrency, and handling partial failure.

**Model answer:**
> "The core choice is sequential versus parallel. Sequential — awaiting one call, then the next — is simple but slow when the calls don't depend on each other. Parallel — starting all the promises first, then awaiting them together with `Promise.all` — runs them concurrently and finishes in the time of the slowest one instead of the sum. For a large number of tasks, running everything in parallel can overwhelm a downstream service, so I use a concurrency limiter — a small pool that only lets N promises be in flight at once. And for partial failure, `Promise.all` isn't always right, because one rejection cancels the whole batch; `Promise.allSettled` is often the better choice when you want every result, successes and failures both."

```js
// Sequential (slow: sum of durations)
for (const url of urls) { results.push(await fetch(url)); }

// Parallel (fast: duration of the slowest)
const results = await Promise.all(urls.map((u) => fetch(u)));

// Concurrency-limited parallel (a simple pool)
async function mapLimit(items, limit, fn) {
  const results = []; let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx]); }
  });
  await Promise.all(workers);
  return results;
}
```

**Follow-ups**
- *"When would you deliberately choose sequential over parallel?"* — When later calls depend on earlier results, or when parallel calls would exceed a downstream rate limit.
- *"How do you add a timeout to an awaited call?"* — Race it against a timer promise: `Promise.race([fetch(url), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))])`, or use `AbortSignal.timeout()` where supported.

**Red flags:** defaulting to sequential `await` in a loop without recognizing it as a performance smell when the iterations are independent.

---

### Deep vs Shallow Copy

**Definition:** A **shallow copy** duplicates only the top-level properties of an object — nested objects/arrays are still shared references with the original. A **deep copy** recursively duplicates every nested level, so the copy shares no references with the original at any depth.

**Model answer:**
> "A shallow copy — spread syntax, `Object.assign`, `Array.prototype.slice` — copies the top level, but if a property is itself an object, both the original and the copy point at the *same* nested object, so mutating that nested object through the copy affects the original too. A deep copy avoids that by recursively cloning every nested level. In modern JavaScript, `structuredClone()` is the built-in way to do a true deep copy — it handles nested objects, arrays, Maps, Sets, and dates, though it can't clone functions or DOM nodes. `JSON.parse(JSON.stringify(obj))` is the older workaround, but it silently drops functions and `undefined`, converts dates to strings, and breaks on circular references."

```js
const original = { name: 'Asha', address: { city: 'Mumbai' } };

const shallow = { ...original };
shallow.address.city = 'Pune';
console.log(original.address.city);   // 'Pune' — BUG: shallow copy shared the nested object

const deep = structuredClone(original);
deep.address.city = 'Delhi';
console.log(original.address.city);   // 'Pune' — unaffected — deep copy shares nothing
```

**Follow-ups**
- *"Why does `JSON.stringify`-based cloning fail on some data?"* — It can't represent functions, `undefined`, `Date` (turns into a string, not a `Date`), `Map`/`Set`, `BigInt`, or circular references — see Phase 0.1.10.
- *"Does Redux/React state management care about this?"* — Yes — immutable update patterns rely on knowing exactly what's shared vs. copied, since accidentally mutating shared nested state through a "copy" is a very common state-management bug.

**Red flags:** believing `{ ...obj }` or `Array.prototype.slice()` produces a full deep copy — both are shallow, and this misunderstanding causes real production bugs.

---

### Map / Filter / Reduce

**Definition:** Higher-order array methods that transform data without manual loops: `map` produces a new array by transforming each element; `filter` produces a new array containing only elements that pass a test; `reduce` collapses an array into a single accumulated value.

**Model answer:**
> "These three cover almost every array transformation. `map` returns an array the same length as the input, each element transformed. `filter` returns an array of only the elements where the callback returns true — same or shorter length. `reduce` is the most general: it walks the array with an accumulator, applying a function that combines the accumulator and each element, and returns whatever the accumulator ends up as — which means you can implement `map` and `filter` themselves in terms of `reduce`, or build things reduce alone is suited for, like grouping records by a key or computing a running total. I reach for `map`/`filter` when the output shape is obviously 'one output per input, optionally excluding some' and `reduce` when I'm collapsing into something structurally different, like an object or a single number."

```js
const orders = [{ amount: 10, status: 'paid' }, { amount: 20, status: 'pending' }, { amount: 5, status: 'paid' }];

const amounts = orders.map((o) => o.amount);                          // [10, 20, 5]
const paid = orders.filter((o) => o.status === 'paid');               // [{amount:10,...}, {amount:5,...}]
const total = orders.reduce((sum, o) => sum + o.amount, 0);           // 35

// grouping with reduce — a very common interview follow-up
const byStatus = orders.reduce((acc, o) => {
  (acc[o.status] ??= []).push(o);
  return acc;
}, {});
```

**Follow-ups**
- *"Write `map` using `reduce`."* — `arr.reduce((acc, x) => [...acc, fn(x)], [])` (note: `push`-based accumulation is more efficient than spreading a new array each time, at scale).
- *"When would you use a plain `for` loop instead of these?"* — When you need to `break` early (none of these methods short-circuit; `find`/`some`/`every` do), or when performance-critical hot paths benefit from avoiding closure/callback overhead.
- *"Do these mutate the original array?"* — No — all three return new arrays/values; `sort` and `splice`, by contrast, mutate in place, which is a common source of bugs when candidates assume otherwise.

**Red flags:** not knowing `reduce`'s signature (`accumulator, currentValue, index, array`) well enough to write a grouping/counting example live — this is one of the single most common live-coding interview requests.

---

### Memory Leaks

**Definition:** A memory leak occurs when memory that is no longer needed is not released, because something unintended still holds a reference to it — preventing the garbage collector from reclaiming it.

**Model answer:**
> "JavaScript's garbage collector frees memory for objects that are unreachable — nothing references them anymore. A leak happens when something *does* still reference an object you meant to be done with. Common sources: event listeners that are never removed and close over large data; global variables that accumulate data forever, like an ever-growing cache with no eviction; closures capturing large objects longer than intended; and in Node specifically, `setInterval` timers that are never cleared, keeping their closure — and anything it captures — alive indefinitely. Diagnosing it means taking heap snapshots over time in Chrome DevTools or Node's `--inspect`, comparing them, and looking at what's retaining growing sets of objects rather than being freed between snapshots."

```js
// Leak: interval timer never cleared, keeps closing over `largeDataset` forever
function startPolling(largeDataset) {
  setInterval(() => { console.log(largeDataset.length); }, 5000);   // never cleared — leak
}

// Leak: unbounded cache with no eviction
const cache = new Map();
function memoize(key, value) { cache.set(key, value); }   // grows forever, never evicts

// Fix pattern: always pair "start" with a matching "stop", and cap/evict caches
function startPollingFixed(largeDataset) {
  const id = setInterval(() => console.log(largeDataset.length), 5000);
  return () => clearInterval(id);          // caller is responsible for calling this on cleanup
}
```

**Follow-ups**
- *"How would you find a memory leak in a running Node server?"* — `process.memoryUsage()` trending upward over time under steady load; heap snapshots via `--inspect` compared before/after a suspected operation, looking for retained object counts that should have dropped to zero but didn't.
- *"Does `WeakMap`/`WeakSet` help here?"* — Yes — they hold *weak* references, so an object used as a key doesn't stay alive just because it's in a `WeakMap`; useful for caches keyed by objects that should be collectible once nothing else references them.

**Red flags:** treating memory leaks as a "browser problem" — long-running Node servers are at least as vulnerable, and a leak there means a slow, creeping outage rather than an obvious crash.

---
# 25.2 TypeScript

*(Full depth: Phase 2 — TypeScript from Zero to Advanced)*

---

### Interface vs Type

**Definition:** Both `interface` and `type` describe the shape of a value at compile time; `interface` is specifically designed for describing object/class shapes and supports **declaration merging**, while `type` is more general and can alias unions, primitives, tuples, and mapped types that `interface` cannot express.

**Model answer:**
> "Both let you describe an object's shape, and for plain object shapes they're largely interchangeable. The practical differences: interfaces can be re-opened and merged — declaring the same interface name twice adds to it rather than conflicting — which is how libraries let you extend built-in types. Type aliases can't be merged, but they can express things interfaces can't: unions, intersections of non-object types, tuples, and mapped or conditional types. A common convention is interface for public object/class shapes meant to be extended, and type for unions, utility compositions, and anything not a plain object shape."

```ts
interface User { id: number; name: string; }
interface User { email: string; }               // merges — User now has id, name, AND email

type Status = 'active' | 'suspended' | 'deleted';        // type can express this; interface cannot
type ID = number | string;                                 // union — type only
```

**Follow-ups**
- *"Can a type alias extend another type?"* — Yes, via intersection: `type Admin = User & { role: string }`, though this isn't declaration merging — it creates a new combined type rather than reopening `User`.
- *"Does it matter for compiled JavaScript output?"* — No — both are fully erased at compile time; neither exists at runtime.

**Red flags:** claiming one is "faster" or "better for performance" — both disappear entirely at compile time, so there's no runtime difference whatsoever.

---

### Any vs Unknown

**Definition:** `any` disables type checking entirely for a value — you can do anything with it, and TypeScript won't complain. `unknown` also accepts any value, but forces you to **narrow** its type before you can do anything with it, preserving type safety.

**Model answer:**
> "Both accept any value, but `any` opts you *out* of type checking — the compiler trusts you completely and stops helping, which defeats the point of using TypeScript in the first place. `unknown` is the type-safe alternative: you can assign anything to it, but you can't call a method on it, access a property, or pass it somewhere expecting a specific type until you've narrowed it — with a type guard, an `instanceof` check, or a runtime validation library. I use `unknown` for genuinely unknown external input, like a parsed JSON response or a caught error, and treat `any` as something to avoid outside of rare, deliberate escape hatches, since it silently disables safety anywhere it flows."

```ts
function processAny(data: any) { data.toUpperCase(); }         // compiles — even if data is a number, crashes at runtime

function processUnknown(data: unknown) {
  data.toUpperCase();                                          // compile ERROR — must narrow first
  if (typeof data === 'string') data.toUpperCase();             // OK — narrowed to string
}

// The canonical unknown use case: caught errors
try { riskyCall(); }
catch (err: unknown) {
  if (err instanceof Error) console.error(err.message);         // safe — narrowed before use
}
```

**Follow-ups**
- *"Why type a `catch` parameter as `unknown` instead of `any`?"* — Modern TypeScript defaults caught errors to `unknown` specifically because a thrown value isn't guaranteed to be an `Error` — forcing a narrowing check catches real bugs (`throw "a string"` is legal JavaScript).
- *"Where is `any` still acceptable?"* — Rapid prototyping, gradually migrating a JS codebase, or genuinely dynamic third-party data you'll validate immediately after — as a deliberate, narrow, commented exception, not a default.

**Red flags:** describing `unknown` as "just a safer name for `any`" — the entire point is that `unknown` *cannot* be used without narrowing, while `any` can be used for absolutely anything.

---

### Generics

**Definition:** A way to write functions, interfaces, and classes that work over a variety of types while preserving type relationships between inputs and outputs, instead of hard-coding one specific type or giving up type safety with `any`.

**Model answer:**
> "Generics let a function or type be parameterized by a type variable, so the caller supplies the actual type, and TypeScript keeps the relationship between input and output type-safe. Without generics you'd either duplicate a function per type, or use `any` and lose all the safety generics exist to provide. The classic example is a function that returns the first element of an array — with `any` you'd lose the element's actual type; with a generic `<T>`, the return type is inferred as exactly `T`, so callers still get full autocomplete and type checking on the result."

```ts
function first<T>(arr: T[]): T | undefined { return arr[0]; }
const n = first([1, 2, 3]);          // inferred as number | undefined
const s = first(['a', 'b']);         // inferred as string | undefined — same function, different T

// Generic constraint: T must have a `length` property
function logLength<T extends { length: number }>(item: T): T { console.log(item.length); return item; }
logLength('hello');                   // OK — strings have .length
logLength([1, 2, 3]);                 // OK — arrays have .length
logLength(42);                        // ERROR — number has no .length
```

**Follow-ups**
- *"What's a generic constraint, and why use one?"* — `<T extends SomeShape>` restricts what T can be, so you can safely use properties/methods of `SomeShape` inside the function while still preserving the caller's more specific type.
- *"Write a generic `Repository<T>` interface."* — `interface Repository<T> { findById(id: string): Promise<T | null>; save(item: T): Promise<void>; }` — reusable across `Repository<User>`, `Repository<Order>`, etc., each fully typed.

**Red flags:** reaching for `any` where a generic would preserve the input/output type relationship — this is the single most common "this candidate doesn't really use TypeScript's strengths" signal.

---

### Union and Intersection Types

**Definition:** A **union** (`A | B`) means a value can be *either* type A or type B. An **intersection** (`A & B`) means a value must satisfy *both* type A and type B simultaneously — combining their members into one.

**Model answer:**
> "A union is 'one of these' — a value typed `string | number` might be either, and TypeScript only lets you use operations valid on *both* until you narrow it down to one specific member. An intersection is 'all of these at once' — `A & B` produces a type that has every property from A and every property from B, so it's most useful for combining smaller object shapes into a larger one, like adding a `Timestamped` shape onto a `User` shape. A common mistake is intersecting two *incompatible* primitive types, like `string & number` — that produces `never`, since nothing can be both at once."

```ts
type ID = string | number;                                    // union: either one
function printId(id: ID) {
  if (typeof id === 'string') return id.toUpperCase();          // narrowed to string here
  return id.toFixed(2);                                          // narrowed to number here
}

interface Timestamped { createdAt: Date; }
interface User { id: number; name: string; }
type UserWithTimestamps = User & Timestamped;                  // intersection: has ALL of both
```

**Follow-ups**
- *"Why does `string & number` become `never`?"* — No value can simultaneously be both primitive types, so the intersection is impossible to satisfy — TypeScript correctly collapses it to the "impossible" type.
- *"When would a discriminated union be better than a loose union?"* — When each variant needs different associated data — see Type Guards below; a discriminated union lets you narrow exhaustively and safely by switching on a common literal field.

**Red flags:** mixing up which one is "OR" and which is "AND" under interview pressure — a very easy, very common slip; anchor it to the symbols: `|` reads as "or," `&` reads as "and."

---

### Type Guards

**Definition:** Runtime checks (`typeof`, `instanceof`, `in`, custom predicate functions) that TypeScript recognizes and uses to **narrow** a broader type down to a more specific one within a conditional branch.

**Model answer:**
> "A type guard is a runtime check whose result TypeScript is smart enough to use for narrowing the static type inside that branch. `typeof x === 'string'` narrows a union to its string member; `instanceof` narrows to a specific class; the `in` operator checks for a property's presence, useful for narrowing object unions that don't share a common field. For your own types, you write a custom type guard — a function returning `arg is SomeType` — and TypeScript treats a `true` return as proof the narrowing is valid everywhere that function is used as a condition. The most robust pattern for object unions is a **discriminated union**: give every variant a shared literal field, like `type`, and switch on it — TypeScript then narrows automatically per case, and if you add a new variant later and forget a case, `exhaustiveness checking` can catch it at compile time."

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2;      // narrowed: shape.radius exists here
    case 'square': return shape.side ** 2;                   // narrowed: shape.side exists here
  }
}

// custom type guard
function isString(x: unknown): x is string { return typeof x === 'string'; }
function handle(x: unknown) { if (isString(x)) x.toUpperCase(); }   // narrowed to string
```

**Follow-ups**
- *"What is exhaustiveness checking and how do you implement it?"* — Adding a `default` branch that assigns the unnarrowed value to a variable typed `never` — if a new union variant is added later and a case is missed, that assignment fails to compile, catching the gap immediately.
- *"Why prefer a discriminated union over an untagged one for API responses?"* — A shared literal `type`/`status` field lets every consumer narrow safely and exhaustively; an untagged union relying on "does this field exist" checks is fragile and easy to get subtly wrong.

**Red flags:** using `as` type assertions to force a type instead of an actual runtime type guard — an assertion tells the compiler to trust you with no runtime check backing it up, which reintroduces exactly the class of bug TypeScript exists to prevent.

---

### Utility Types

**Definition:** Built-in generic types that transform existing types into new ones — for example, making all properties optional, picking a subset of properties, or excluding certain properties — without redeclaring the shape from scratch.

**Model answer:**
> "Utility types let you derive a new type from an existing one instead of duplicating and maintaining two separate definitions that can drift apart. `Partial<T>` makes every property optional, useful for update/patch payloads. `Pick<T, K>` keeps only the listed keys; `Omit<T, K>` keeps everything except the listed keys. `Required<T>` makes every property mandatory. `Readonly<T>` makes every property immutable at the type level. `Record<K, V>` builds an object type with keys of type K, all mapped to value type V. I use these constantly for DTOs — deriving a 'create' shape or an 'update' shape from one canonical domain type, so a change to the domain type propagates everywhere automatically instead of silently going out of sync."

```ts
interface User { id: number; name: string; email: string; passwordHash: string; }

type UserUpdate = Partial<Omit<User, 'id' | 'passwordHash'>>;    // { name?: string; email?: string }
type PublicUser = Omit<User, 'passwordHash'>;                     // safe to send to the client
type UserSummary = Pick<User, 'id' | 'name'>;                     // just id and name
type UsersById = Record<number, User>;                            // { [id: number]: User }
```

**Follow-ups**
- *"How would you implement `Partial<T>` yourself, from scratch?"* — A mapped type: `type MyPartial<T> = { [K in keyof T]?: T[K] };` — knowing this proves understanding, not just memorized names.
- *"What's the difference between `Readonly<T>` and `Object.freeze`?"* — `Readonly<T>` is compile-time only — nothing stops mutation at runtime unless you also freeze; `Object.freeze` is a runtime guarantee (in non-strict mode it fails silently on mutation attempts, and throws in strict mode) but doesn't affect TypeScript's static types on its own — they're often used together.

**Red flags:** re-declaring near-duplicate interfaces by hand (`UserCreateInput`, `UserUpdateInput`, `UserResponse`) instead of deriving them from one source of truth with utility types — a strong signal of not knowing this toolset.

---

### Runtime Validation

**Definition:** Checking that data actually conforms to an expected shape **at runtime**, using a library (Zod, Yup, class-validator) or manual checks — because TypeScript's types are erased at compile time and provide zero protection against real, unvalidated external input.

**Model answer:**
> "TypeScript types disappear completely after compilation — there's no `interface` or `type` left in the running JavaScript, so they give zero protection against malformed data coming from a request body, a third-party API, or a file. If I write `function handler(body: CreateUserInput)`, TypeScript trusts that annotation at compile time, but at runtime, whatever the client actually sent is what you get — could be missing fields, wrong types, or malicious. Runtime validation closes that gap: a library like Zod lets you define a schema once, validate incoming data against it at the boundary, and — this is the elegant part — infer the exact TypeScript type *from* that schema, so your compile-time type and your runtime check can never drift apart, because they come from the same source."

```ts
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;    // TypeScript type, derived from the schema

app.post('/users', (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);       // validated AT RUNTIME, not just typed
  if (!result.success) return res.status(400).json({ errors: result.error.issues });
  const input: CreateUserInput = result.data;                 // now genuinely safe to trust
});
```

**Follow-ups**
- *"Where exactly should runtime validation happen?"* — At every trust boundary: incoming HTTP request bodies, third-party API responses, environment variables, file contents — anywhere data crosses from "outside your control" to "inside your code."
- *"Isn't this redundant with TypeScript?"* — No — they solve different problems at different times: TypeScript catches type mistakes *you* make while writing code; runtime validation catches bad data the *outside world* sends while the program is running. Both are needed.

**Red flags:** trusting a `req.body: CreateUserInput` type annotation as if it were an actual guarantee about what the client sent — this is the single most-repeated theme across the roadmap for a reason.

---

### Strict Mode

**Definition:** A group of TypeScript compiler flags (`strict: true` in `tsconfig.json`, which enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, and others together) that turns on the compiler's most rigorous type-checking behavior.

**Model answer:**
> "Strict mode is a bundle of compiler flags that close the biggest gaps in TypeScript's safety. The two that matter most day to day: `noImplicitAny` forces you to annotate anything TypeScript can't infer, instead of silently falling back to `any` and losing checking on it; `strictNullChecks` makes `null` and `undefined` their own distinct types that aren't implicitly assignable everywhere, which is what forces you to actually handle the 'this might not exist' case instead of it slipping through and crashing at runtime. I always enable full `strict: true` on new projects — the cost is more upfront annotation work, and the payoff is catching an entire category of null-reference and implicit-any bugs at compile time instead of in production."

```jsonc
// tsconfig.json
{ "compilerOptions": { "strict": true } }
```

```ts
// without strictNullChecks: this compiles and crashes at runtime
function getLength(s: string) { return s.length; }
getLength(null);   // no compile error without strict mode — runtime TypeError

// with strictNullChecks: this is a COMPILE error, catching the bug before it ships
function getLengthStrict(s: string | null) {
  return s.length;                 // ERROR: Object is possibly 'null'
}
function getLengthStrictFixed(s: string | null) {
  return s?.length ?? 0;            // forced to handle the null case explicitly
}
```

**Follow-ups**
- *"Name two flags bundled into `strict: true` and what each does."* — `noImplicitAny` (no silent `any` fallback), `strictNullChecks` (null/undefined are distinct, not implicitly assignable), `strictFunctionTypes` (function parameter types are checked contravariantly, catching unsound function assignments).
- *"Should you enable strict mode on a large existing loosely-typed codebase all at once?"* — Usually not — it can surface hundreds of pre-existing errors at once; teams often migrate incrementally, enabling stricter flags file-by-file or module-by-module.

**Red flags:** not knowing that `strict: true` is a *bundle* of individually-toggleable flags — interviewers often ask you to name a couple of the underlying flags specifically, not just the umbrella setting.

---

# 25.3 Node.js

*(Full depth: Phase 4 — Node.js Core)*

---

### Event Loop (Node-specific)

**Definition:** Node's event loop is libuv's implementation of the same async-scheduling concept from Phase 1's JavaScript event loop, extended with **phases** specific to server-side work: timers, pending callbacks, poll (I/O), check, and close callbacks — plus two special queues, `process.nextTick` and microtasks (promises), that run *between every phase*, not as one of the phases themselves.

**Model answer:**
> "Node's event loop builds on the same call-stack-plus-queues model from the browser, but organizes macrotasks into distinct phases each loop iteration: timers (due `setTimeout`/`setInterval` callbacks), pending callbacks, poll (where most I/O callbacks fire, and where the loop will wait if there's nothing else to do), check (`setImmediate` callbacks), and close callbacks. Critically, `process.nextTick` and the promise microtask queue are drained completely *between every single phase* — even between individual callbacks within a phase — which makes `nextTick` even higher priority than promise microtasks in Node specifically. The practical takeaway: any CPU-heavy synchronous code you write blocks *all* of this — timers won't fire, I/O callbacks won't run — because it's still one thread running one call stack at a time."

```js
console.log('start');
setTimeout(() => console.log('timeout'), 0);         // timers phase
setImmediate(() => console.log('immediate'));         // check phase
process.nextTick(() => console.log('nextTick'));       // drains before ANY phase
Promise.resolve().then(() => console.log('promise'));  // drains before any phase, after nextTick queue
console.log('end');
// Output: start, end, nextTick, promise, timeout, immediate   (timeout vs immediate order can vary
// at the top level, but immediate always fires before a 0ms timeout when scheduled inside I/O)
```

**Follow-ups**
- *"`setTimeout(fn, 0)` vs `setImmediate(fn)` — which runs first?"* — Order at the top level of a script is not fully guaranteed (depends on process startup timing), but scheduled from inside an I/O callback, `setImmediate` reliably runs before a 0ms timeout, because `check` comes right after `poll`, while timers has to wait for the next full loop iteration.
- *"Why is `process.nextTick` considered dangerous if overused?"* — Because it drains *completely*, including any new `nextTick` calls queued during draining, a recursive `nextTick` call can starve the entire event loop, preventing I/O from ever being processed.

**Red flags:** treating Node's event loop as identical to the browser's — the phase model (timers/poll/check) and `process.nextTick`'s special priority are Node-specific and frequently asked about precisely because candidates often only know the browser version.

---

### Streams

**Definition:** An abstraction for handling data — files, network sockets, arbitrary sources — incrementally, in chunks, rather than loading it entirely into memory at once. Node has four types: Readable, Writable, Duplex (both), and Transform (a duplex stream that modifies data as it passes through).

**Model answer:**
> "Streams let you process data of any size — a multi-gigabyte file, a long-lived socket — without holding the whole thing in memory. A Readable stream emits chunks of data as they become available; a Writable stream accepts chunks and does something with them, like writing to disk; a Duplex is both at once, like a TCP socket; a Transform is a Duplex that modifies data as it flows through, like a gzip compressor. The critical piece is backpressure: `writable.write()` returns `false` when its internal buffer is full, signaling the source to pause, and `pipe()` handles this automatically, which is exactly why you should almost always reach for `pipe()` or `pipeline()` instead of manually shuffling chunks between streams yourself."

```js
const fs = require('node:fs');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream/promises');

// process a large file without ever loading it fully into memory, with backpressure handled for you
await pipeline(
  fs.createReadStream('big-file.log'),
  zlib.createGzip(),                        // Transform stream
  fs.createWriteStream('big-file.log.gz')
);
```

**Follow-ups**
- *"Why prefer `pipeline()` over manually calling `.pipe()`?"* — `pipeline()` also properly handles and propagates errors and cleans up all the streams if any one of them fails — manual `.pipe()` chains leave you responsible for wiring up error handling on every stream yourself, which is easy to get wrong.
- *"What is backpressure, concretely, in stream terms?"* — When a Writable's internal buffer is full, `write()` returns `false`; a well-behaved source should stop pushing more data until the Writable emits `'drain'`, signaling it's ready for more.

**Red flags:** reading an entire large file with `fs.readFileSync` "because it's simpler" without acknowledging the memory tradeoff — a very direct, common interview probe (see Phase 0.1.2 and Phase 4.4).

---

### Buffers

**Definition:** A `Buffer` is Node's mechanism for handling raw binary data directly — a fixed-length chunk of memory outside the V8 JavaScript heap, used for anything that isn't naturally text: file contents, network packets, images, encryption.

**Model answer:**
> "JavaScript strings are for text, but a lot of what a backend touches — file bytes, TCP packets, image data — isn't text at all, it's raw binary. `Buffer` represents that directly, as a fixed-size array of bytes, allocated outside the normal V8 heap so it can hold large binary payloads efficiently. Streams and the `fs`/`net` modules hand you Buffers by default; you convert to a string only when you know the encoding, with `.toString('utf8')` or similar, and it's important not to assume every byte sequence is valid text — binary data that happens to get decoded as UTF-8 can silently corrupt or throw depending on the bytes."

```js
const buf = Buffer.from('hello', 'utf8');
console.log(buf);                 // <Buffer 68 65 6c 6c 6f> — raw bytes, not a string
console.log(buf.toString('utf8')); // 'hello' — explicit decode back to text
console.log(buf.length);           // 5 — byte length, NOT necessarily character count for multi-byte chars

const combined = Buffer.concat([Buffer.from('a'), Buffer.from('b')]);   // binary-safe concatenation
```

**Follow-ups**
- *"Why is `buf.length` not always the same as the string's character count?"* — Multi-byte UTF-8 characters (emoji, many non-Latin scripts) take more than one byte per character, so byte length and character length diverge — this matters for correctly truncating or validating string length limits stored as byte counts.
- *"What's `Buffer.allocUnsafe` and why is it 'unsafe'?"* — It allocates memory faster by skipping zero-filling, which means it can contain leftover old data from previous memory use until you overwrite it — a potential information leak if not fully written before being read or sent.

**Red flags:** treating Buffers as "just strings that Node happens to use for binary stuff" — they're a genuinely different data type with different semantics (fixed length, byte-oriented, encoding-aware conversion required).

---

### Worker Threads

**Definition:** A Node module (`worker_threads`) that runs JavaScript in a separate thread with its own V8 instance and event loop, used to offload CPU-intensive work without blocking the main thread — distinct from the OS-thread pool libuv already uses internally for some blocking I/O.

**Model answer:**
> "Node's main thread runs your application's JavaScript and event loop, single-threaded — so a CPU-heavy synchronous task, like resizing a large image or hashing a big password with a slow algorithm, blocks every other request from being handled while it runs. Worker threads solve that: you spin up a separate thread with its own isolated V8 instance and event loop, hand it the CPU-heavy work, and it runs in true parallel with the main thread, communicating back results via message passing. This is different from just doing something asynchronously — `async`/`await` doesn't make CPU-bound work non-blocking, only I/O-bound work; a worker thread is what actually gets CPU work off the main thread."

```js
// main.js
const { Worker } = require('node:worker_threads');
function runHeavyTask(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./heavy-task.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}

// heavy-task.js
const { parentPort, workerData } = require('node:worker_threads');
function computeExpensiveThing(n) { /* CPU-heavy loop */ return n; }
parentPort.postMessage(computeExpensiveThing(workerData));
```

**Follow-ups**
- *"Do worker threads share memory with the main thread?"* — Not by default — data is copied (structured clone) when passed via `postMessage`, unless you explicitly use a `SharedArrayBuffer` for true shared memory, which needs manual synchronization (`Atomics`) to avoid races.
- *"When would you choose worker threads over a separate microservice/process for CPU work?"* — Worker threads are lighter-weight (shared process, faster startup, easier data passing) for moderate CPU work within one service; a separate process or service is better when the work has very different scaling needs, deployment lifecycle, or resource limits than the main API.

**Red flags:** suggesting `async`/`await` or Promises alone as the fix for a CPU-bound blocking problem — neither moves work off the single JavaScript thread; only worker threads, child processes, or clustering do (see Phase 0.1.3).

---

### Middleware

**Definition:** A function (or chain of functions) that has access to the request and response objects, and either ends the request-response cycle or passes control to the next function in the chain — the core composition mechanism of frameworks like Express.

**Model answer:**
> "Middleware is any function in the shape `(req, res, next) => {}` that sits in the request pipeline before your actual route handler. Each middleware can inspect or modify the request and response, run some logic — logging, authentication, parsing the body — and then either call `next()` to pass control forward, or end the response itself, in which case nothing further in the chain runs. This is how cross-cutting concerns get composed cleanly instead of being copy-pasted into every route: you register one auth middleware once, and it applies to every route that needs it, in order. Error-handling middleware is a special case — a four-argument function `(err, req, res, next)` — and Express specifically looks for that arity to route errors to it separately from the normal chain."

```js
function requestLogger(req, res, next) {
  console.log(`${req.method} ${req.url}`);
  next();                                    // pass control forward — MUST be called or the request hangs
}

function requireAuth(req, res, next) {
  if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });   // ends the chain
  next();
}

app.use(requestLogger);
app.get('/orders', requireAuth, (req, res) => res.json({ orders: [] }));   // middleware chain per-route
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));   // error middleware (4 args)
```

**Follow-ups**
- *"What happens if middleware forgets to call `next()` and doesn't send a response either?"* — The request hangs forever — no response is ever sent, and eventually times out client-side; this is one of the most common real bugs in Express apps.
- *"How does Express know a middleware is for error handling?"* — Purely by counting its parameters — exactly four arguments (`err, req, res, next`) signals error-handling middleware; three signals normal middleware.

**Red flags:** describing middleware only as "stuff that runs before the route" without mentioning the explicit `next()` control-flow mechanism — that mechanism, and what happens when it's forgotten, is the actual substance interviewers probe.

---

### Error Handling

**Definition:** The discipline of catching, classifying, and responding to failures at the right layer — distinguishing **operational errors** (expected failure modes like invalid input or a downed database, which the program should handle gracefully) from **programmer errors** (actual bugs, like calling a method on `undefined`, which generally should crash and be fixed, not caught and hidden).

**Model answer:**
> "I split errors into operational and programmer errors. Operational errors are expected parts of running a real system — a database timing out, invalid user input, a third-party API returning an error — and the program should handle these gracefully: return the right status code, log it, maybe retry. Programmer errors are actual bugs — a typo, calling a method on something that's `undefined` — and generally these should *not* be silently caught and swallowed, because doing so hides the bug and can leave the process in a genuinely corrupted, unpredictable state; better to let it crash loudly, get logged, and get fixed, with a process supervisor restarting the process cleanly. In an Express app specifically, I centralize error handling in one error-handling middleware at the end of the chain, so every route can just `throw` or call `next(err)`, instead of hand-writing a try/catch and response in every single handler."

```js
class AppError extends Error {                       // operational errors: expected, typed, safe to expose
  constructor(message, statusCode) { super(message); this.statusCode = statusCode; this.isOperational = true; }
}

app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await db.users.findById(req.params.id);
    if (!user) throw new AppError('User not found', 404);    // operational — expected, handled cleanly
    res.json(user);
  } catch (err) { next(err); }                                 // hand off to centralized error middleware
});

app.use((err, req, res, next) => {                             // centralized error-handling middleware
  const status = err.isOperational ? err.statusCode : 500;
  res.status(status).json({ error: err.isOperational ? err.message : 'Internal Server Error' });
  if (!err.isOperational) console.error(err);                  // log full detail only for real bugs
});

process.on('uncaughtException', (err) => { console.error('FATAL', err); process.exit(1); });  // crash cleanly
```

**Follow-ups**
- *"Should you ever recover from an `uncaughtException` and keep running?"* — Generally no — once an unexpected exception occurs, the process state can be corrupted in ways you can't fully reason about; the safe pattern is log it, exit, and let a process manager (PM2, Kubernetes) restart cleanly, rather than limping along.
- *"Why is an `AppError` class with `isOperational` useful?"* — It lets the centralized error handler distinguish "safe to show this message to the client" errors from "this is an internal bug, don't leak details, just show a generic 500" — without that distinction, you either leak internals or hide legitimate error messages the client actually needs.

**Red flags:** wrapping every single route in a defensive `try/catch` that just logs and returns 500 for everything — this treats all errors identically and loses the operational/programmer distinction that actually matters for both security and debuggability.

---

### Graceful Shutdown

**Definition:** The process of stopping a running server cleanly — refusing new work, finishing in-flight requests, closing database/queue connections, and exiting — in response to a termination signal, instead of dying abruptly mid-request.

**Model answer:**
> "When an orchestrator like Kubernetes or a process manager needs to stop or replace an instance — for a deploy, a scale-down, or a health check failure — it sends `SIGTERM` first, expecting the process to clean up and exit within a grace period, before escalating to an unstoppable `SIGKILL`. A graceful shutdown handler catches `SIGTERM`, stops accepting *new* connections immediately, lets requests already in flight finish naturally, closes database and queue connections cleanly, and then exits. Skipping this means in-flight requests get cut off mid-response during every single deploy, and connections may be left in a bad state on whatever they were talking to."

```js
const server = app.listen(3000);

function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(async () => {                 // stop accepting new connections; wait for in-flight ones
    await db.pool.end();                      // close DB connections cleanly
    await redisClient.quit();
    console.log('cleanup complete, exiting');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();   // hard-exit safety net if cleanup hangs
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

**Follow-ups**
- *"What's the safety-net `setTimeout` for?"* — If cleanup itself hangs (a stuck connection that never closes), the process would otherwise never exit and get forcibly `SIGKILL`ed by the orchestrator anyway, at an unpredictable time — the timeout ensures a clean, predictable forced exit as a fallback.
- *"Why does this matter for zero-downtime deploys specifically?"* — A rolling deploy relies on old instances finishing their current work and exiting cleanly while new instances come up — without graceful shutdown, every deploy drops in-flight requests.

**Red flags:** not knowing the difference between `SIGTERM` (catchable, "please stop") and `SIGKILL` (uncatchable, immediate termination) — see Phase 0.1.4; this distinction is exactly why graceful shutdown is even possible.

---

### Cluster and Process Model

**Definition:** Node's `cluster` module (and process managers like PM2, or container orchestrators) let you run multiple Node processes — each with its own event loop and memory — sharing the same server port, so a multi-core machine can be fully utilized despite each individual Node process being single-threaded.

**Model answer:**
> "One Node process runs JavaScript on a single thread, so on an 8-core machine, one process only ever uses one core for your actual application code. The cluster module solves this at the process level, not the thread level: a primary process forks multiple worker *processes* — typically one per CPU core — and the OS load-balances incoming connections across them. Each worker is a fully separate Node process with its own memory and event loop, so a crash in one doesn't take down the others, and the primary process can detect a dead worker and fork a replacement. The tradeoff is that workers don't share memory — no shared in-process cache or session store — so anything that needs to be consistent across workers has to live externally, in Redis or the database, not in a worker's local variables."

```js
// cluster.js
const cluster = require('node:cluster');
const os = require('node:os');

if (cluster.isPrimary) {
  const cpuCount = os.cpus().length;
  for (let i = 0; i < cpuCount; i++) cluster.fork();
  cluster.on('exit', (worker) => { console.log(`worker ${worker.process.pid} died, forking replacement`); cluster.fork(); });
} else {
  require('./server');          // each worker runs the actual Express app independently
}
```

**Follow-ups**
- *"Why can't you keep an in-memory session store or cache with cluster mode?"* — Each worker is a separate process with separate memory — a user's session created on worker 1 wouldn't exist on worker 2, which a load balancer or the cluster module might route their *next* request to; shared state must live in Redis or the database instead (see Phase 0.1.10).
- *"How does this compare to just running multiple container replicas behind a load balancer, e.g. in Kubernetes?"* — Conceptually the same idea — multiple independent processes sharing load — just implemented at a different layer; in modern container-orchestrated deployments, it's common to run one Node process per container and let the orchestrator handle scaling to multiple *replicas*, rather than using the in-process `cluster` module at all.

**Red flags:** suggesting multithreading (in the traditional sense of shared-memory threads) as how Node "uses multiple cores" — it doesn't; it's multiple isolated *processes*, each single-threaded internally, which is a materially different model with different tradeoffs (no shared memory, IPC instead of direct calls).

---
# 25.4 MySQL

*(Full depth: Phase 6 — MySQL and SQL from Zero to Advanced)*

---

### Joins

**Definition:** SQL operations that combine rows from two or more tables based on a related column — `INNER JOIN` keeps only rows with matches in both tables; `LEFT JOIN` keeps every row from the left table, filling unmatched right-side columns with `NULL`; `RIGHT JOIN` is the mirror; `CROSS JOIN` produces every combination of rows from both tables.

**Model answer:**
> "An inner join returns only rows where the join condition matches in both tables — if an order has no matching customer, it's excluded entirely. A left join keeps every row from the left table regardless of whether a match exists on the right, filling in `NULL` for the right table's columns when there's no match — this is what you use when you want 'all customers, plus their orders if they have any,' including customers with zero orders. Right join is the same idea mirrored, and in practice most people just rewrite it as a left join with the tables swapped, for consistency. Cross join has no matching condition at all — it returns every possible pairing between the two tables, the Cartesian product — useful rarely, usually for generating combinations, and a common source of *accidental* row-count explosions when a join condition is missing by mistake."

```sql
-- inner join: only customers WITH orders
SELECT c.name, o.total FROM customers c INNER JOIN orders o ON o.customer_id = c.id;

-- left join: ALL customers, orders columns are NULL if they have none
SELECT c.name, o.total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id;

-- find customers with NO orders at all (classic left-join-plus-NULL-check pattern)
SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;
```

**Follow-ups**
- *"How do you find customers with zero orders using a join?"* — `LEFT JOIN` from customers to orders, then `WHERE o.id IS NULL` — only rows where no match existed survive that filter, exactly the customers with no orders.
- *"What's a self-join, and give a real example?"* — Joining a table to itself, typically to compare rows within the same table — e.g., finding each employee's manager, where `employees.manager_id` references `employees.id` on the same table under a second alias.
- *"Difference between `WHERE` and `ON` conditions in a join?"* — Conditions in `ON` are applied *during* the join (deciding what counts as a match, before rows are combined); conditions in `WHERE` filter *after* the join — this distinction matters especially for outer joins, where putting a right-table filter in `WHERE` instead of `ON` can accidentally turn a left join back into an inner join.

**Red flags:** confusing `LEFT JOIN ... WHERE right.col IS NULL` (the correct "find unmatched rows" pattern) with just an `INNER JOIN` — this exact query is one of the most common live-SQL interview tasks.

---

### Indexes

**Definition:** A separate, ordered data structure — in MySQL's InnoDB, typically a **B-tree** — built on one or more columns, that lets the database find matching rows without scanning every row in the table, at the cost of extra storage and slower writes.

**Model answer:**
> "Without an index, finding rows matching a condition means scanning the entire table — a full table scan. An index is a separate structure, ordered by the indexed column(s), that lets the database jump directly to matching rows in roughly logarithmic time instead of linear. The tradeoff is real: every index has to be updated on every insert, update, or delete touching its columns, so indexes speed up reads at the cost of slowing down writes and using extra disk space — you don't index every column 'just in case.' A composite index on multiple columns is ordered by the *first* column, then the second within ties, and so on — which is why column order in a composite index matters enormously: an index on `(status, created_at)` efficiently serves queries filtering on `status` alone, or `status` and `created_at` together, but not efficiently a query filtering on `created_at` alone."

```sql
CREATE INDEX idx_orders_customer ON orders (customer_id);              -- single-column index
CREATE INDEX idx_orders_status_date ON orders (status, created_at);    -- composite: order matters!

-- served efficiently by the composite index above:
SELECT * FROM orders WHERE status = 'pending';
SELECT * FROM orders WHERE status = 'pending' AND created_at > '2026-01-01';

-- NOT served efficiently by that same index (leading column `status` is skipped):
SELECT * FROM orders WHERE created_at > '2026-01-01';
```

**Follow-ups**
- *"What is a covering index?"* — An index that includes every column a query needs, so MySQL can answer the query entirely from the index itself without touching the underlying table row at all — noticeably faster for read-heavy hot queries.
- *"What is selectivity, and why does it matter for choosing what to index?"* — How much an index narrows down the result set — a column like `status` with only 3 possible values is low-selectivity (an index may not help much, since it still matches a large fraction of rows); a column like `email` where nearly every value is unique is high-selectivity and benefits enormously from indexing.
- *"Why can too many indexes hurt a table?"* — Every write has to update every index on the affected columns — a table with 15 indexes pays that cost 15 times on every insert/update, which can noticeably slow write-heavy tables.

**Red flags:** claiming "just add an index and it'll be fast" without any mention of the write-cost tradeoff, composite column ordering, or selectivity — that's a surface-level answer interviewers specifically probe past.

---

### EXPLAIN

**Definition:** A SQL command (`EXPLAIN SELECT ...`) that shows the database's **execution plan** for a query — which indexes (if any) it will use, the estimated number of rows examined, the join order, and the access method — without actually running the query's full result.

**Model answer:**
> "`EXPLAIN` shows what the query optimizer *plans* to do before it does it — which access type it'll use per table (a full table scan versus an index lookup), which index if any, the estimated rows it expects to examine, and the join order across multiple tables. The single most important column to look at is `type`: `ALL` means a full table scan — usually a red flag on a large table — while `ref`, `range`, or best of all `const`/`eq_ref` mean it's using an index efficiently. `EXPLAIN ANALYZE` goes further and actually *runs* the query, showing real measured timing and row counts next to the plan's estimates, which is invaluable when the optimizer's estimates and reality have diverged — often because table statistics are stale."

```sql
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;

-- key columns to read:
-- type: ALL (full scan, bad) vs range/ref (index used, good) vs const/eq_ref (best — single-row lookup)
-- key: which index was actually chosen (NULL means none was used)
-- rows: estimated rows MySQL expects to examine to produce the result
-- Extra: "Using filesort" or "Using temporary" are common red flags worth investigating further

EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 42;   -- actually runs it; shows real timings
```

**Follow-ups**
- *"You see `type: ALL` on a large table — what do you do next?"* — Check whether the `WHERE`/`JOIN` columns are indexed at all; if they are, investigate why the optimizer isn't using the index (low selectivity, a function wrapped around the column preventing index use, or stale table statistics via `ANALYZE TABLE`).
- *"What does 'Using filesort' in the Extra column mean, and is it always bad?"* — MySQL had to sort results outside of an index's natural order — expensive on large result sets; often fixable by adding an index matching the `ORDER BY` clause, though for small result sets it's rarely worth worrying about.

**Red flags:** saying "I'd add an index" as a reflex answer to a slow query without first running `EXPLAIN` to actually see what the optimizer is doing — the interview is testing the diagnostic process, not just the eventual fix.

---

### Transactions

**Definition:** A group of one or more SQL statements executed as a single atomic unit — either **all** of them succeed and are committed, or, if any fails, **none** of them take effect (rolled back) — bounded by `BEGIN`/`START TRANSACTION`, `COMMIT`, and `ROLLBACK`.

**Model answer:**
> "A transaction groups multiple statements so they behave as one indivisible operation. The classic example is a funds transfer: debit one account, credit another — if the process crashes between those two statements without a transaction, you've silently destroyed money. Wrapped in a transaction, either both statements commit together, or if anything fails partway through, the whole thing rolls back and the database looks exactly as if neither statement ran. This is the 'A' in ACID — atomicity — and it's what makes multi-step operations against a database actually safe to reason about, instead of hoping nothing fails in the middle."

```sql
START TRANSACTION;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;                    -- both changes take effect together

-- if something goes wrong mid-transaction:
START TRANSACTION;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  -- error occurs here, or you detect a business-rule violation (e.g. balance would go negative)
ROLLBACK;                  -- the debit above is undone; database is unchanged
```

```js
// application-level pattern (Node + a query builder)
await db.transaction(async (trx) => {
  await trx('accounts').where({ id: 1 }).decrement('balance', 100);
  await trx('accounts').where({ id: 2 }).increment('balance', 100);
  // if anything inside this callback throws, the library rolls back automatically
});
```

**Follow-ups**
- *"What are all four ACID properties, briefly?"* — **Atomicity** (all-or-nothing), **Consistency** (a transaction takes the database from one valid state to another, respecting constraints), **Isolation** (concurrent transactions don't see each other's uncommitted changes — see Isolation Levels below), **Durability** (once committed, changes survive a crash — typically via a write-ahead log).
- *"How long should a transaction stay open?"* — As short as possible — a long-running transaction holds locks (see Deadlocks below) and delays other transactions; avoid doing slow, unrelated work like calling an external API inside an open transaction.

**Red flags:** treating "wrap it in a transaction" as always free — long or overly broad transactions have real costs (held locks, reduced concurrency), and scoping a transaction correctly is itself part of the skill.

---

### Isolation Levels

**Definition:** A setting controlling how much one transaction's in-progress changes are visible to *other* concurrent transactions before it commits — trading off consistency guarantees against concurrency/performance. The SQL standard defines four levels, each preventing progressively more of three classic anomalies: **dirty reads**, **non-repeatable reads**, and **phantom reads**.

**Model answer:**
> "Isolation levels answer: while my transaction is running, what can I see of other transactions that are also running concurrently, and not yet committed? Read Uncommitted allows dirty reads — seeing another transaction's *uncommitted* changes, which might get rolled back, so you'd have read data that never actually existed; it's rarely used. Read Committed only ever shows committed data, but the same query run twice within one transaction can see different results if another transaction committed in between — a non-repeatable read. Repeatable Read, MySQL's InnoDB default, guarantees that if you read a row twice in the same transaction, you get the same result both times — but a range query might still see new rows that another transaction inserted and committed, a phantom read, though InnoDB's specific implementation actually prevents most phantom reads too via gap locking. Serializable is the strictest — transactions behave as if run one at a time, completely eliminating all three anomalies, at the largest cost to concurrency, since it effectively locks much more aggressively."

| Level | Dirty read | Non-repeatable read | Phantom read | Concurrency |
|---|---|---|---|---|
| Read Uncommitted | Possible | Possible | Possible | Highest |
| Read Committed | Prevented | Possible | Possible | High |
| Repeatable Read (**MySQL InnoDB default**) | Prevented | Prevented | Mostly prevented (InnoDB-specific) | Medium |
| Serializable | Prevented | Prevented | Prevented | Lowest |

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;
  SELECT balance FROM accounts WHERE id = 1;   -- behavior under concurrent writes depends on the level set above
COMMIT;
```

**Follow-ups**
- *"What's a dirty read, concretely, with an example?"* — Transaction A updates a row but hasn't committed; Transaction B, under Read Uncommitted, reads that updated value; Transaction A then rolls back — Transaction B acted on data that, in the end, never actually existed.
- *"Why is MySQL's InnoDB default Repeatable Read instead of Read Committed like PostgreSQL?"* — Largely historical/implementation choice; InnoDB's specific MVCC (multi-version concurrency control) implementation makes Repeatable Read relatively cheap and also happens to prevent most phantom reads, unlike the standard's baseline definition of that level.
- *"How does isolation level choice relate to deadlock likelihood?"* — Stricter isolation levels generally hold more/longer locks, increasing the chance two transactions block on each other — see Deadlocks below.

**Red flags:** not knowing MySQL InnoDB's *default* isolation level (Repeatable Read) — a very commonly asked specific fact, since candidates often know the four levels abstractly but not which one they're actually running under by default.

---

### Deadlocks

**Definition:** A situation where two or more transactions each hold a lock the other needs, and each is waiting for the other to release its lock first — neither can proceed, and neither will, without intervention.

**Model answer:**
> "A deadlock happens when Transaction A holds a lock on row 1 and wants row 2, while Transaction B holds a lock on row 2 and wants row 1 — each is waiting on the other, and neither can ever make progress on its own. The database detects this cycle and doesn't just hang forever: it picks one transaction as the victim, rolls it back, and lets the other proceed — the losing transaction gets a deadlock error and needs to retry. The most common cause is transactions acquiring locks on multiple rows in an *inconsistent order* across different code paths; the fix is usually straightforward once identified: always acquire locks in the same, consistent order everywhere in the codebase, keep transactions short, and design the application to catch a deadlock error and retry automatically, since an occasional deadlock under real concurrency is expected, not a sign of a bug on its own."

```sql
-- Transaction A                          -- Transaction B (running concurrently)
START TRANSACTION;                         START TRANSACTION;
UPDATE accounts SET balance = balance - 10 UPDATE accounts SET balance = balance - 10
  WHERE id = 1;    -- locks row 1            WHERE id = 2;    -- locks row 2
UPDATE accounts SET balance = balance + 10 UPDATE accounts SET balance = balance + 10
  WHERE id = 2;    -- BLOCKS, waiting for B   WHERE id = 1;    -- BLOCKS, waiting for A
                    -- ...MySQL detects the cycle, rolls one transaction back with a deadlock error...
```

```js
// application-level retry pattern — the standard, correct response to a deadlock
async function transferWithRetry(from, to, amount, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try { return await db.transaction((trx) => doTransfer(trx, from, to, amount)); }
    catch (err) { if (err.code !== 'ER_LOCK_DEADLOCK' || i === attempts - 1) throw err; }
  }
}
```

**Follow-ups**
- *"How do you actually prevent deadlocks, not just retry after one?"* — Always lock/update rows in a consistent order across every code path (e.g., always by ascending `id`), keep transactions as short as possible, and index the columns used in `WHERE` clauses inside transactions so lookups don't unnecessarily lock more rows than intended (e.g., via a full scan holding locks on every row it touches).
- *"Is an occasional deadlock a bug?"* — Not inherently — under real concurrency, some deadlocks are expected and normal; what matters is having retry logic in place, and investigating only if deadlock *rate* is unusually high or concentrated on one specific code path, which usually points to an actual lock-ordering bug.

**Red flags:** treating any deadlock as an application bug that must be eliminated entirely — the correct posture is "expect them occasionally, retry automatically, only dig deeper if the rate is abnormal."

---

### Pagination

**Definition:** Retrieving a large result set in smaller pages rather than all at once — implemented either via **offset pagination** (`LIMIT`/`OFFSET`, skipping a count of rows) or **cursor (keyset) pagination** (`WHERE id > last_seen_id ORDER BY id LIMIT n`, continuing from a specific position).

**Model answer:**
> "Offset pagination is the simple, intuitive approach — `LIMIT 20 OFFSET 40` for page 3 — but it has a real performance problem at scale: the database still has to scan and discard every row before the offset, so page 500 is dramatically slower than page 1, even though both return the same number of rows. It's also unstable if rows are inserted or deleted between page loads — a row can shift from one page to another, causing users to see duplicates or skip items entirely. Cursor pagination fixes both: instead of counting rows to skip, you remember the last row's key from the previous page and query `WHERE id > last_id ORDER BY id LIMIT 20` — this is a direct index lookup regardless of how deep you are, so performance stays constant, and it's stable under concurrent inserts. The tradeoff is you lose the ability to jump directly to an arbitrary page number, which cursor-based APIs typically don't offer anyway — just next/previous."

```sql
-- offset pagination: gets slower as OFFSET grows, because MySQL still scans+discards the skipped rows
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 10000;

-- cursor pagination: consistently fast — a direct indexed lookup regardless of "how deep" you are
SELECT * FROM orders WHERE id > 10420 ORDER BY id LIMIT 20;
```

**Follow-ups**
- *"Why exactly does high-offset pagination get slower?"* — MySQL has to examine and skip every one of the offset rows to know where the requested page begins — `OFFSET 100000` means scanning through 100,000 rows before it can even start returning the 20 you asked for.
- *"What happens to offset pagination if a row is deleted between page loads?"* — Every row after the deletion shifts up by one position, so the next page's offset now points one row further than intended — the user silently skips a row they never saw.
- *"How do you paginate stably when sorting by a non-unique column, like `created_at`?"* — Use a compound cursor — `(created_at, id)` — so ties on the sort column are broken deterministically by a unique secondary column, avoiding duplicate or skipped rows for same-timestamp entries.

**Red flags:** defaulting to `LIMIT`/`OFFSET` for a large, deep, frequently-paginated dataset (like an infinite-scroll feed) without recognizing the performance cliff — this specific tradeoff is a very common system-design/SQL-crossover interview question.

---

### Normalization

**Definition:** The process of structuring a relational schema to minimize data redundancy and prevent update anomalies, by organizing data into related tables according to a series of **normal forms** (1NF, 2NF, 3NF being the most commonly referenced) — with **denormalization** as the deliberate, considered reverse, trading some redundancy for read performance.

**Model answer:**
> "Normalization is about eliminating redundant data by splitting it into properly related tables, so a given fact is stored in exactly one place. First normal form means every column holds a single atomic value — no comma-separated lists crammed into one field. Second normal form eliminates partial dependencies — every non-key column must depend on the *whole* primary key, not just part of a composite key. Third normal form eliminates transitive dependencies — a non-key column shouldn't depend on another non-key column; for example, storing a customer's city *and* their zip code in the orders table is redundant and risks the two going out of sync, since zip code determines city, not the order itself. In practice, most production schemas target third normal form for their core data, and then *deliberately* denormalize specific, identified hot paths — duplicating some data to avoid an expensive join in a query that runs millions of times a day — as a conscious performance tradeoff, not by default, and not everywhere."

```sql
-- NOT normalized: city is redundant, repeated on every order, and can drift out of sync with zip
CREATE TABLE orders_bad (id INT, customer_zip VARCHAR(10), customer_city VARCHAR(100), total DECIMAL);

-- normalized (3NF): city lives in exactly one place, derivable from zip via a lookup, not duplicated
CREATE TABLE zip_codes (zip VARCHAR(10) PRIMARY KEY, city VARCHAR(100));
CREATE TABLE orders (id INT, customer_zip VARCHAR(10) REFERENCES zip_codes(zip), total DECIMAL);
```

**Follow-ups**
- *"When would you deliberately denormalize?"* — A specific, measured read-heavy hot path — e.g., storing a `product_name` snapshot directly on an `order_item` row so historical orders display correctly even if the product is later renamed or deleted, avoiding both a join and a data-integrity problem simultaneously.
- *"What's an update anomaly, concretely?"* — If a customer's city is duplicated across 50 of their order rows and their city changes, you must update all 50 rows — miss even one, and your data is now silently inconsistent; a normalized schema updates it in exactly one row.

**Red flags:** treating "normalize everything to 3NF, always" or "denormalize everything for speed, always" as universal rules — the actual skill being tested is recognizing it's a deliberate, per-case tradeoff, not a dogma in either direction.

---

### Query Optimization

**Definition:** The practice of making a slow query fast — through indexing, rewriting the query itself, examining the execution plan, and understanding how the specific data's shape and distribution affects performance — guided by measurement (`EXPLAIN`, actual timing) rather than guesswork.

**Model answer:**
> "My process starts with `EXPLAIN` to see what the query is actually doing — full table scan versus index usage, estimated rows examined, join order. From there, common fixes are: adding an index on columns used in `WHERE`, `JOIN`, or `ORDER BY`; rewriting a query so an indexed column isn't wrapped in a function, since `WHERE YEAR(created_at) = 2026` can't use a plain index on `created_at`, while `WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'` can; replacing `SELECT *` with only the needed columns, especially if that lets the query be answered entirely from a covering index; and switching deep offset pagination to cursor-based pagination. Beyond the query itself, I check for genuinely missing indexes versus indexes the optimizer just isn't choosing due to stale statistics, and for N+1 query patterns in the application layer, where one query per row in a loop is often the real root cause rather than any single query being slow in isolation."

```sql
-- BAD: function wrapped around the indexed column defeats the index entirely
SELECT * FROM orders WHERE YEAR(created_at) = 2026;

-- GOOD: a sargable range condition — the index on created_at can be used directly
SELECT * FROM orders WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01';

-- BAD: fetching every column when only two are needed defeats a covering index
SELECT * FROM orders WHERE customer_id = 42;

-- GOOD: answerable entirely from a covering index on (customer_id, id, total)
SELECT id, total FROM orders WHERE customer_id = 42;
```

**Follow-ups**
- *"What does 'sargable' mean?"* — 'Search ARGument ABLE' — a condition written so the database can use an index directly to evaluate it, rather than having to compute something per row first (like wrapping the column in a function) before it can compare.
- *"What's the N+1 query problem, and how do you spot it?"* — Running one query to get a list, then one additional query *per row* to fetch related data (e.g., fetching 50 orders, then querying each order's customer separately, 50 more times) — spotted via query logging showing a suspicious, repeated near-identical query pattern; fixed with a single join or a batched `WHERE id IN (...)` query instead (also covered in Phase 7).

**Red flags:** proposing "add an index" as a one-size-fits-all fix without first diagnosing *why* the query is slow via `EXPLAIN` — query optimization is a diagnostic process, and skipping straight to a guessed fix is exactly what this topic is testing against.

---
# 25.5 LLD (Low-Level Design)

*(Full depth: Phase 10 — Low-Level Design)*

---

### SOLID

**Definition:** Five object-oriented design principles — **S**ingle Responsibility, **O**pen/Closed, **L**iskov Substitution, **I**nterface Segregation, **D**ependency Inversion — aimed at producing code that's easier to extend, test, and maintain as requirements change.

**Model answer:**
> "SOLID is five principles for keeping a codebase changeable without it becoming fragile. Single Responsibility: a class should have one reason to change — mixing, say, order validation and email sending in one class means a change to either forces you to touch and re-test the same class. Open/Closed: code should be open to extension but closed to modification — you should be able to add new behavior, like a new payment method, without editing existing, already-tested code, typically via polymorphism or a strategy pattern. Liskov Substitution: a subclass must be usable anywhere its parent type is expected, without breaking correctness — if substituting a subtype changes expected behavior in a way callers can't handle, the inheritance relationship itself is wrong. Interface Segregation: many small, focused interfaces beat one large interface that forces implementers to support methods they don't actually need. Dependency Inversion: depend on abstractions, not concrete implementations — high-level business logic shouldn't directly depend on a specific database driver; it should depend on a repository interface, with the concrete database implementation injected in."

```ts
// Violation: OrderService directly depends on a concrete MySQL implementation (violates DIP)
class OrderService { constructor(private db: MySQLConnection) {} }

// Fixed: depends on an abstraction; any implementation can be substituted (respects DIP, enables testing)
interface OrderRepository { save(order: Order): Promise<void>; }
class OrderService { constructor(private repo: OrderRepository) {} }
class MySQLOrderRepository implements OrderRepository { async save(order: Order) { /* ... */ } }
class InMemoryOrderRepository implements OrderRepository { async save(order: Order) { /* for tests */ } }
```

**Follow-ups**
- *"Give a concrete Liskov Substitution violation."* — A classic: `Square extends Rectangle` and overrides `setWidth`/`setHeight` to keep both sides equal — code that works correctly with any `Rectangle` (e.g., "set width to 5, set height to 10, expect area 50") breaks silently when handed a `Square`, because the substitution changes behavior the caller correctly relied on.
- *"How does Dependency Inversion actually enable unit testing?"* — Since `OrderService` depends on the `OrderRepository` interface, not a concrete database, tests can inject an in-memory or mock implementation — no real database needed to test the business logic in isolation.

**Red flags:** reciting the five names without a concrete "bad design → better design" example for at least two or three of them — this is exactly what the roadmap's own Phase 10.2 structure (definition, bad design, improved design, tradeoffs) is meant to drill, and interviewers ask for exactly that.

---

### Composition

**Definition:** Building complex behavior by combining smaller, independent objects ("has-a" relationships) rather than through class inheritance ("is-a" relationships) — commonly summarized as "favor composition over inheritance."

**Model answer:**
> "Inheritance couples a subclass tightly to its parent's implementation — change the parent, and every subclass is affected, sometimes in surprising ways, and deep inheritance hierarchies get rigid and hard to reason about. Composition instead builds an object out of smaller pieces it *holds a reference to* and delegates to, rather than *is* — a `Car` doesn't inherit from `Engine`; it *has* an `Engine`, injected or constructed, and calls its methods. This makes swapping behavior trivial — a `Car` can take any object implementing the `Engine` interface, electric or gasoline, without any class hierarchy changes — and it avoids the classic problems of deep inheritance, like the fragile base class problem, where a seemingly safe change to a base class breaks distant subclasses in unexpected ways."

```ts
// Inheritance-heavy (rigid): what happens when you need a FlyingSwimmingRobotDuck?
class Duck { fly() {} swim() {} quack() {} }
class RobotDuck extends Duck { /* now has to override fly() to throw, since robots can't fly */ }

// Composition (flexible): assemble behavior from independent, swappable parts
interface FlyBehavior { fly(): void; }
interface QuackBehavior { quack(): void; }
class Duck {
  constructor(private flyBehavior: FlyBehavior, private quackBehavior: QuackBehavior) {}
  performFly() { this.flyBehavior.fly(); }
  performQuack() { this.quackBehavior.quack(); }
}
class CannotFly implements FlyBehavior { fly() { console.log("I can't fly"); } }
const roboDuck = new Duck(new CannotFly(), new SqueakQuack());   // no broken inheritance override needed
```

**Follow-ups**
- *"Is inheritance always wrong?"* — No — it's appropriate for genuine, stable "is-a" relationships with shared implementation that truly won't diverge (e.g., a small, closed set of shape types all sharing an `area()` contract); the guidance is "favor" composition, not "never use" inheritance.
- *"How does composition relate to the Strategy design pattern?"* — Strategy *is* composition applied specifically to interchangeable algorithms/behaviors — the `FlyBehavior` example above is a textbook Strategy pattern implementation.

**Red flags:** defaulting to a deep inheritance hierarchy in a live design exercise without ever considering composition as the alternative — a strong, very common LLD interview signal of over-reliance on OOP taught in a purely academic, inheritance-first way.

---

### Interfaces

**Definition:** A contract specifying *what* methods/properties a type must provide, without dictating *how* they're implemented — enabling multiple, interchangeable implementations that can be substituted behind the same contract.

**Model answer:**
> "An interface defines a contract — here's what methods you must implement, and their signatures — without saying anything about how. This is what makes polymorphism and dependency inversion actually work in practice: code written against an interface, like `PaymentProcessor`, doesn't know or care whether it's talking to a Stripe implementation, a PayPal implementation, or a test mock — as long as each implements the same contract, they're all fully interchangeable. This is central to testability too, exactly as in the Dependency Inversion example above: you design the interface first, from the *consumer's* point of view — what does the business logic actually need to call? — rather than starting from a specific implementation and reverse-engineering an interface from it afterward."

```ts
interface PaymentProcessor {
  charge(amount: number, cardToken: string): Promise<{ success: boolean; transactionId: string }>;
}

class StripeProcessor implements PaymentProcessor { async charge(amount, token) { /* Stripe API call */ } }
class PayPalProcessor implements PaymentProcessor { async charge(amount, token) { /* PayPal API call */ } }
class MockProcessor implements PaymentProcessor { async charge() { return { success: true, transactionId: 'test' }; } }

class CheckoutService {
  constructor(private processor: PaymentProcessor) {}   // depends on the interface, not a specific provider
  async completeOrder(amount: number, token: string) { return this.processor.charge(amount, token); }
}
```

**Follow-ups**
- *"How is this different from an abstract class?"* — An abstract class can provide partial, shared implementation alongside the contract, and a class can only extend *one* abstract class (single inheritance); an interface is pure contract, no implementation, and a class can implement *multiple* interfaces — useful when a type needs to satisfy several independent contracts at once.
- *"Should you design the interface based on the implementation, or design it first?"* — Design it from the *consumer's* perspective — what does calling code actually need? — before locking in any specific implementation; designing it around one implementation's internals tends to leak that implementation's assumptions into the contract, defeating the point.

**Red flags:** creating an interface with only one implementation and no plausible reason to expect a second one ever — interfaces have a real design cost (indirection); the skill being tested is knowing *when* the flexibility is worth it (external dependencies, testability, genuinely swappable strategies), not applying it reflexively everywhere.

---

### Design Patterns

**Definition:** Named, reusable solutions to recurring design problems — a shared vocabulary (Factory, Strategy, Observer, Decorator, Adapter, and others) that lets engineers communicate a design's shape quickly, rather than a rigid recipe to force onto every problem.

**Model answer:**
> "Design patterns are named solutions to problems that come up repeatedly enough that giving them a name is useful — saying 'I used a Strategy pattern here' communicates the whole shape of the design instantly to another engineer who knows the vocabulary. I don't reach for a pattern because it's a pattern — I reach for it because the specific problem in front of me actually matches its intent. Factory: centralizes and hides object creation logic, especially useful when creation itself is complex or needs to vary. Strategy: makes an algorithm swappable at runtime, injected rather than hard-coded — the flying-behavior example above is exactly this. Observer: lets subscribers react to events without the publisher needing to know who they are — the foundation of most event-driven and pub/sub systems. Decorator: adds behavior to an individual object dynamically, by wrapping it, without altering the original class or affecting other instances. Adapter: translates one interface into another a client already expects — commonly used to wrap a third-party library's API into your own internal interface, so a future library swap doesn't ripple through your whole codebase."

```ts
// Strategy: pick a discount algorithm at runtime, swappable without changing OrderTotal itself
interface DiscountStrategy { apply(total: number): number; }
class NoDiscount implements DiscountStrategy { apply(total: number) { return total; } }
class PercentageDiscount implements DiscountStrategy {
  constructor(private percent: number) {}
  apply(total: number) { return total * (1 - this.percent / 100); }
}
class OrderTotal {
  constructor(private strategy: DiscountStrategy) {}
  calculate(subtotal: number) { return this.strategy.apply(subtotal); }
}

// Observer: OrderService doesn't need to know who cares about "order placed"
class OrderEvents {
  private listeners: Array<(order: Order) => void> = [];
  on(fn: (order: Order) => void) { this.listeners.push(fn); }
  emit(order: Order) { this.listeners.forEach((fn) => fn(order)); }
}
```

**Follow-ups**
- *"When is a design pattern the wrong choice?"* — When it adds indirection and abstraction for a problem that's simple and unlikely to genuinely change — over-applying patterns ("pattern-itis") makes code harder to read for no real future benefit; the test is "does this specific problem need this specific flexibility," not "which pattern can I fit here."
- *"What's the risk with Singleton specifically?"* — It introduces hidden global state and a hidden dependency that's hard to substitute in tests, and can mask genuine architectural issues (like needing dependency injection instead); it's one of the most misused patterns precisely because it looks convenient early on.

**Red flags:** naming a pattern correctly but being unable to explain *why* it fits the specific problem at hand, or over-engineering a simple LLD answer by forcing in three unrelated patterns to "show knowledge" — interviewers notice and penalize pattern-for-pattern's-sake more than they reward it.

---

### Extensibility

**Definition:** How easily a system's behavior can be extended to support new requirements **without modifying existing, already-tested code** — the practical, day-to-day expression of the Open/Closed Principle.

**Model answer:**
> "Extensibility is about how much a codebase resists or welcomes new requirements. A poorly extensible design might have a big `switch` statement on a `type` field that you have to add a new `case` to every time a new type appears — which means touching, and re-testing, code that already worked, and risking breaking existing cases while you're in there. A more extensible design defines an interface for the varying behavior and lets each new type or requirement be added as a brand-new class implementing that interface, leaving every existing class completely untouched. In an interview, I demonstrate this by explicitly designing for the *next likely requirement*, not just the one asked — for something like a parking lot or notification system, I'll ask 'what's a new vehicle type/notification channel likely to look like,' and shape the interfaces so adding one is a pure addition, not an edit."

```ts
// Poor extensibility: adding a new notification channel means editing this function every time
function sendNotification(type: string, message: string) {
  if (type === 'email') { /* ... */ }
  else if (type === 'sms') { /* ... */ }
  else if (type === 'push') { /* ... */ }   // every new channel = another edit here, risking regressions
}

// Extensible: adding SlackNotifier is a pure addition — zero changes to existing, tested code
interface Notifier { send(message: string): Promise<void>; }
class EmailNotifier implements Notifier { async send(m: string) { /* ... */ } }
class SmsNotifier implements Notifier { async send(m: string) { /* ... */ } }
class SlackNotifier implements Notifier { async send(m: string) { /* ... */ } }   // new file, nothing else touched

class NotificationService {
  constructor(private notifiers: Notifier[]) {}
  async notifyAll(message: string) { await Promise.all(this.notifiers.map((n) => n.send(message))); }
}
```

**Follow-ups**
- *"Isn't designing for every possible future requirement over-engineering?"* — Yes — the skill is anticipating *plausible near-term* extension points from the stated requirements (a payment system will almost certainly need new payment methods; it probably won't need to run on Mars), not building infinite flexibility for hypothetical needs that may never materialize.
- *"How do you demonstrate extensibility live in an LLD interview without over-building?"* — Explicitly name one or two likely future requirements out loud, show that your interface design accommodates them as pure additions, and *don't* actually build speculative code for requirements that weren't asked for — describe the extension point, don't implement it.

**Red flags:** a design that would require editing multiple existing classes to add one new, entirely expected variant (a new shape, a new vehicle type, a new payment method) — this is the single most common thing LLD interviewers probe for by asking "now add X" partway through.

---

### Testability

**Definition:** How easily a unit of code can be tested in isolation — verified largely by how cleanly its dependencies can be substituted with test doubles (mocks, stubs, fakes) without needing real databases, real network calls, or complex setup.

**Model answer:**
> "Testability isn't a separate add-on quality — it's mostly a direct consequence of good dependency management. If `OrderService` directly instantiates a `MySQLConnection` inside itself, you can't test its business logic without an actual running database. If it instead *receives* an `OrderRepository` interface through its constructor — dependency injection — a test can pass in an in-memory fake implementing that same interface, and test the business logic in complete isolation, fast, with no database at all. I design classes so their dependencies are injected, not hard-coded or reached for globally, specifically because that decision made weeks or months earlier is what determines whether the resulting code is trivially testable or requires painful integration-test setup just to check a simple business rule."

```ts
// Hard to test: OrderService reaches out and creates its own concrete dependency internally
class OrderService {
  private repo = new MySQLOrderRepository();     // can't substitute this in a test
  async placeOrder(data: OrderData) { /* ... */ await this.repo.save(order); }
}

// Testable: dependency is injected, so a test can substitute a fake with zero real infrastructure
class OrderService {
  constructor(private repo: OrderRepository) {}
  async placeOrder(data: OrderData) { /* ... */ await this.repo.save(order); }
}

// test file — no real database needed at all
const fakeRepo: OrderRepository = { save: jest.fn().mockResolvedValue(undefined) };
const service = new OrderService(fakeRepo);
await service.placeOrder(sampleOrder);
expect(fakeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
```

**Follow-ups**
- *"What's the difference between a mock, a stub, and a fake?"* — A **stub** returns canned answers with no real logic; a **mock** additionally records and lets you assert *how* it was called (arguments, call count); a **fake** is a lightweight but genuinely working implementation, like an in-memory repository — real logic, just not production infrastructure. (Full depth: Phase 20 — Testing.)
- *"Does high testability ever conflict with simplicity?"* — Yes, to a degree — injecting every dependency through interfaces adds some indirection; the practical balance is applying it at meaningful seams (external I/O, things you'll want to swap or mock), not wrapping every single trivial internal helper in an interface for its own sake.

**Red flags:** a class that instantiates its own dependencies (`new MySQLConnection()`, `new StripeClient()`) directly inside itself rather than receiving them — this single pattern is the most common root cause interviewers are checking for when they ask "how would you test this class?"

---

# 25.6 HLD (High-Level Design)

*(Full depth: Phase 11 — High-Level Design)*

---

### Requirements

**Definition:** The explicit process of clarifying **functional requirements** (what the system must do) and **non-functional requirements** (the quality attributes it must have — scale, latency, availability, consistency) *before* designing anything — because the right architecture for 100 users looks nothing like the right architecture for 100 million.

**Model answer:**
> "The very first thing I do, before drawing a single box, is clarify scope — both functional and non-functional. Functional: what must the system actually do, and just as importantly, what's explicitly out of scope for this discussion, since trying to design everything at once is how a 45-minute interview runs out of time on the wrong things. Non-functional is where the real design decisions come from: expected scale — reads per second, writes per second, total users, total data volume; latency requirements — is 200ms fine, or does this need to be sub-10ms; availability needs — can this tolerate occasional downtime, or does it need to survive a full data center outage; and consistency requirements — does this need to be immediately, strictly consistent everywhere, like a bank balance, or is eventual consistency acceptable, like a social media like-count. These answers directly determine the architecture — a chat app and a batch analytics pipeline solve completely different problems even if both technically 'store and retrieve data.'"

```text
Clarifying-questions checklist to run through out loud, early, in any HLD interview:
  Functional:      What are the 3-5 core user actions? What's explicitly out of scope?
  Scale:            How many users? Read:write ratio? Peak QPS vs average?
  Latency:          What response time is acceptable, p50 and p99?
  Availability:      What uptime is required? Can any component fail without full outage?
  Consistency:       Strong consistency required, or is eventual consistency acceptable?
  Data:              How much data, and how fast does it grow?
```

**Follow-ups**
- *"An interviewer says 'design a URL shortener' with no other detail — what do you ask?"* — Expected scale (URLs created/day, redirects/day — usually very read-heavy), whether custom short codes are needed, whether links expire, whether click analytics are in scope, and what availability/latency bar redirects need to meet (usually very low latency, since it's on the hot path of every single redirect).
- *"Why does the read:write ratio matter so early?"* — It directly drives architecture — a system that's 1000:1 read-heavy (like a URL shortener or news feed) benefits enormously from caching and read replicas; a write-heavy system (like an analytics ingestion pipeline) instead needs to focus on write throughput, batching, and queue-based buffering.

**Red flags:** starting to draw boxes and pick technologies before asking a single clarifying question — this is the single most common HLD interview failure mode, even among candidates who know the components well.

---

### Capacity Estimation

**Definition:** Back-of-the-envelope math translating requirements into concrete numbers — requests per second, storage growth per year, bandwidth — used to justify specific architecture decisions (do we need caching? sharding? a CDN?) with actual figures instead of intuition alone.

**Model answer:**
> "Capacity estimation turns vague scale into numbers that actually drive decisions. I estimate QPS — if there are 10 million daily active users each averaging 5 actions a day, that's 50 million requests a day, which averaged over 86,400 seconds is roughly 580 requests per second, and I'll typically multiply by 3 to 5x for peak-to-average ratio, since traffic isn't uniform throughout the day — so maybe 2,000-3,000 peak QPS. I estimate storage similarly: if each record is roughly 1 KB and we get 1 million new records a day, that's about 1 GB a day, or roughly 365 GB a year, which tells me whether this fits comfortably on a single database instance for the foreseeable future or needs a sharding strategy from day one. These numbers don't need to be precise — they need to be roughly right, order-of-magnitude correct, and I say the assumptions out loud as I make them, since the interviewer usually cares more about the reasoning process than the exact final figure."

```text
Worked example — a URL shortener:
  100 million new URLs created per month
  → 100M / 30 / 86,400 ≈ 40 writes/sec average
  Read:write ratio ~100:1 (shorteners are read-heavy — far more redirects than creations)
  → ~4,000 reads/sec average, peak maybe 10,000-12,000/sec with a 3x peak multiplier

  Storage: each URL record ~500 bytes (short code, long URL, metadata)
  100M/month × 500 bytes ≈ 50 GB/month ≈ 600 GB/year
  → comfortably fits a single well-indexed database for years; caching handles the read load,
    not the storage volume — these are two separate, distinct problems with separate solutions
```

**Follow-ups**
- *"Why multiply average QPS by a peak factor instead of just using average?"* — Real traffic isn't uniform — it spikes around specific hours, events, or launches; designing only for the average means the system falls over exactly when it matters most, during the peak.
- *"Does getting the exact number right matter?"* — Less than the process — interviewers are checking that you *think* in orders of magnitude and that your architecture decisions are actually justified by the numbers, not that you compute an exactly correct figure; being off by 2x rarely changes the architectural decision, being off by 1000x usually would.

**Red flags:** skipping capacity estimation entirely and jumping straight to "we'll need a cache and a load balancer" — those choices should be *justified* by the numbers you just calculated, not assumed reflexively as HLD interview clichés.

---

### APIs

**Definition:** The contract between clients and the system — the specific endpoints, request/response shapes, and semantics that expose the system's functional requirements as a concrete, callable interface, typically sketched early in an HLD interview right after requirements and estimation.

**Model answer:**
> "Once requirements and rough scale are clear, I sketch the core API surface — just the handful of endpoints that satisfy the functional requirements, not an exhaustive spec. For a URL shortener: `POST /urls` to create a short link, taking a long URL and returning a short code; `GET /:shortCode` to redirect, which is the hot path and needs to be fast; maybe `GET /urls/:shortCode/stats` if analytics are in scope. I keep the shapes simple at this stage — just enough to anchor the rest of the design and make the data model discussion concrete — and I explicitly connect each endpoint back to a functional requirement, rather than designing an API in a vacuum disconnected from what was actually asked for."

```text
POST /urls
  request:  { longUrl: string, customCode?: string, expiresAt?: string }
  response: { shortCode: string, shortUrl: string }

GET /:shortCode
  → 302 redirect to the original long URL (this is the hot, high-QPS path — optimize for it)

GET /urls/:shortCode/stats     (only if analytics are explicitly in scope)
  response: { clicks: number, createdAt: string, lastClickedAt: string }
```

**Follow-ups**
- *"Why sketch the API before the data model, rather than after?"* — The API is what the *client* needs, driven directly by functional requirements; the data model exists to serve the API efficiently, not the other way around — designing the database schema first risks over-fitting the API to internal storage details the client shouldn't need to know about.
- *"How much API detail is appropriate in a 45-minute interview?"* — Enough to anchor the data model and request flow discussion that follows — typically 3-6 core endpoints with rough request/response shapes; full OpenAPI-level detail (Phase 12) is not the point of this stage.

**Red flags:** spending 10+ minutes of limited interview time writing an exhaustive, fully-detailed API spec — the API sketch is a means to anchor the rest of the design discussion, not the deliverable itself.

---

### Data Model

**Definition:** The core entities, their attributes, and their relationships — plus, critically, the choice of underlying storage technology (relational vs. NoSQL, and which specific kind) — justified by the access patterns the API and scale estimates actually require.

**Model answer:**
> "I derive the data model from the API and access patterns I just established, not the other way around. For each core entity, I list its key attributes and relationships, then ask: how is this data actually queried — by which key, how often, does it need joins, does it need strong consistency? Those access patterns drive the storage choice. A relational database fits well when data is structured, relationships and joins matter, and transactions need strong consistency — orders, payments, inventory. A key-value store fits extremely simple, single-key lookups at massive scale with minimal query flexibility needed, like a URL shortener's `shortCode → longURL` mapping. A document database fits semi-structured, per-entity data that's usually read and written as a whole document rather than joined across many tables. I explicitly justify the choice against the requirements gathered earlier, rather than picking a technology because it's trendy or because it's what I personally know best."

```text
URL shortener data model:

urls table (or key-value store, given the access pattern is nearly always a single-key lookup):
  short_code (PK)    long_url    created_at    expires_at    created_by

Access pattern: GET /:shortCode → single lookup by shortCode, extremely read-heavy, no joins needed
  → this pattern strongly favors a key-value store (Redis, DynamoDB) fronting or replacing a
    relational table entirely — a relational DB works too at moderate scale, but the access
    pattern itself doesn't actually need anything relational at all
```

**Follow-ups**
- *"When would you choose NoSQL over a relational database for a new system?"* — When access patterns are simple and predictable (mostly single-key lookups), when the schema is expected to vary significantly between records, or when horizontal write scalability matters more than relational integrity and joins — and I'd say this out loud as a justified tradeoff, not a default preference.
- *"How would you actually generate unique short codes at this data model's scale?"* — Options include a base62-encoded auto-incrementing counter (simple, needs a coordinated counter — e.g., via a dedicated ID-generation service or database sequence), or a hash of the long URL truncated and checked for collisions — each with different tradeoffs around uniqueness guarantees, predictability, and coordination overhead.

**Red flags:** picking a database technology before discussing access patterns — "we'll use MongoDB because it's fast" with no connection to what the actual query patterns require is a very common, very noticeable red flag in HLD interviews.

---

### Scaling

**Definition:** Techniques for handling growth beyond what a single server can support — **vertical scaling** (bigger machine: more CPU/RAM/disk on one node) versus **horizontal scaling** (more machines, splitting load across them) — plus the specific mechanisms that make horizontal scaling possible: load balancing, database replication, and sharding.

**Model answer:**
> "Vertical scaling — a bigger machine — is simple and has zero architectural complexity, but it has a hard ceiling and a single point of failure; horizontal scaling — more machines sharing the load — has no practical ceiling but requires real architectural work to make stateless services and distribute data correctly. For the application/API tier, horizontal scaling is straightforward once the service is stateless — Phase 0.1.5 territory — just add more instances behind a load balancer. For the database, it's harder: read replicas handle read-heavy scaling well, since reads can be served from any replica while writes still go to one primary, but they don't help write-heavy scaling and introduce replication lag, a consistency tradeoff to think through. When a single database instance's write throughput or storage genuinely can't keep up even with better indexing and caching, sharding splits data across multiple database instances by some shard key, at the real cost of losing easy cross-shard joins and transactions — a decision I wouldn't reach for until simpler options are actually exhausted, since it adds significant operational complexity."

```text
Growth path, roughly in order of increasing complexity:
  1. Vertical scale the single DB instance (bigger box)               — simplest, hits a ceiling
  2. Add a cache in front of the DB for hot reads                     — biggest win for read-heavy systems
  3. Add read replicas for read-heavy load                            — writes still bottlenecked on primary
  4. Shard the database by a well-chosen key (e.g., user_id)           — needed only once write/storage
                                                                          genuinely exceeds a single instance
```

**Follow-ups**
- *"What's the tradeoff of read replicas specifically?"* — Replication lag — a write to the primary isn't instantly visible on replicas, so a user reading their own just-written data from a replica might briefly see stale data; systems requiring strict read-your-own-writes consistency need to route those specific reads to the primary.
- *"How do you choose a shard key?"* — One that distributes load evenly (avoiding hot shards) and matches the dominant access pattern (most queries should be answerable from a single shard, since cross-shard queries/joins are expensive or require application-level aggregation).

**Red flags:** jumping straight to "we'll shard the database" as an opening move without first considering caching and read replicas — sharding is usually the *last* resort in a scaling progression, not the first, because of its operational cost.

---

### Caching

**Definition:** Storing a copy of frequently accessed or expensive-to-compute data somewhere faster than its original source, so repeated requests are served from the cache instead of recomputing or re-fetching from the slower origin — covered in full depth in Phase 14, applied here at the system-design level.

**Model answer:**
> "Caching is usually the single highest-leverage lever in a system design interview, because most real systems are read-heavy, and a well-placed cache can absorb the vast majority of that read load before it ever reaches the database. I think about caching at multiple layers: a CDN caches static or rarely-changing content close to users geographically; an application-level cache, typically Redis, sits in front of the database for hot, frequently-read data; and client-side caching or `ETag`-based HTTP caching avoids even making the request at all when nothing's changed. The design questions that matter are what to cache, for how long — the TTL — and how to invalidate it correctly when the underlying data changes, since a stale or incorrectly-invalidated cache is often worse than no cache at all, silently serving wrong data with high confidence."

```text
Applied to the URL shortener: GET /:shortCode is the hottest path in the entire system.
  Cache-aside pattern: on a redirect request, check Redis for shortCode first;
  on a cache miss, fetch from the database, populate the cache, then redirect.
  Since a short URL's target essentially never changes after creation, a long TTL
  (or no expiry, invalidated explicitly only on the rare deletion) is appropriate here —
  a low cache-hit ratio would be the signal something about this specific choice is wrong.
```

**Follow-ups**
- *"How would you decide what NOT to cache?"* — Data that changes very frequently relative to how often it's read (caching overhead and invalidation complexity may exceed the benefit), or data where staleness has serious consequences and strict consistency is required (e.g., a real-time account balance mid-transaction).
- *"What's cache stampede, and how would you prevent it in this design?"* — Many concurrent requests missing the cache simultaneously (e.g., right after a popular key expires) and all hammering the database at once; prevented via a short lock/single-flight pattern so only one request repopulates the cache while others wait, or staggered TTLs to avoid mass-simultaneous expiry (full depth: Phase 14).

**Red flags:** mentioning "we'll add a cache" without specifying *what* gets cached, the invalidation strategy, or the TTL — a cache without an explicit invalidation plan is one of the most common sources of real production bugs, and interviewers listen for whether you address it unprompted.

---

### Queues

**Definition:** Message queues used at the system-design level to decouple components, absorb traffic spikes, and enable asynchronous processing — the architectural application of everything covered in depth in Phase 15.

**Model answer:**
> "Whenever part of a design involves slow work, work that can fail independently of the main request, or work whose input rate can spike well beyond what downstream processing can sustain, I introduce a queue between the two. This decouples the producer from the consumer — the producer doesn't wait on or depend on the consumer's pace — and it smooths out traffic spikes, since the queue absorbs a burst and consumers drain it at a sustainable rate rather than downstream systems being hit with the full spike directly. In an HLD interview, I point to the specific piece of the flow that benefits — for a notification system, the write path accepts a request and enqueues delivery, rather than blocking on an SMS provider's API being fast and reliable; for a video processing platform, the upload endpoint returns immediately, and a queue of transcoding jobs is drained by a separate, independently-scalable worker fleet."

```text
Applied to a notification system:
  API (producer) ──▶ Queue ──▶ Worker fleet (consumer, scales independently)
                                    │
                                    ├──▶ Email provider
                                    ├──▶ SMS provider
                                    └──▶ Push notification service

  Benefit stated explicitly in the design: a slow or temporarily-down SMS provider doesn't
  block the API's response time, and a traffic spike (e.g. a mass notification event) is
  absorbed by the queue rather than overwhelming the notification providers' own rate limits.
```

**Follow-ups**
- *"How does this affect the availability/consistency conversation from earlier?"* — Introducing a queue almost always means embracing eventual consistency for that specific piece — the notification isn't sent the instant the request completes, it's sent shortly after — which needs to be an explicit, stated tradeoff matched against the requirements gathered at the start, not an accidental side effect.
- *"What would you say about delivery guarantees in this design?"* — Reference at-least-once delivery and idempotent consumers explicitly (Phase 15.3, 15.5) — e.g., "the notification worker should be idempotent, since the same notification job could be delivered more than once."

**Red flags:** adding a queue to a design without articulating specifically *why* — which component's failure or slowness it's insulating, and what consistency tradeoff it's introducing — "we'll use a message queue" as an unexplained buzzword is a common, easily-spotted HLD interview weakness.

---

### Failure Handling

**Definition:** Explicitly designing for the reality that any individual component — a server, a database, a network link, a downstream dependency — *will* fail, and ensuring the overall system degrades gracefully or recovers automatically rather than failing completely when one piece does.

**Model answer:**
> "At scale, hardware fails, networks partition, and dependencies go down — not as a hypothetical edge case, but as a routine, expected operating condition. I design for it explicitly: no single point of failure — every critical component is replicated, with a load balancer or failover mechanism in front; timeouts and circuit breakers on every call to a downstream dependency, so one slow or dead dependency doesn't cascade into exhausting the calling service's own resources and taking it down too; graceful degradation, where a non-critical feature failing — like a recommendations service being down — degrades that one feature rather than taking down checkout entirely; and health checks paired with automatic failover, so a failed instance is detected and routed around, or replaced, without manual intervention. I explicitly call out at least one single point of failure in my own design and how it's mitigated — interviewers specifically probe for whether you've actually thought about failure, not just the happy path."

```text
Applied to the URL shortener's redirect path (the hottest, most failure-sensitive path):
  - Multiple app server instances behind a load balancer — no single instance is a point of failure
  - Redis cache: run as a replicated cluster, not a single instance — a single Redis node dying
    shouldn't take down the whole redirect path, just degrade it to hitting the DB directly
  - Database: a primary with replicas, and a defined failover plan if the primary goes down
  - If Redis is fully unavailable: fall back to querying the database directly (degraded, but
    still functional) rather than the entire redirect feature going down
```

**Follow-ups**
- *"What's a circuit breaker, and why mention it here specifically?"* — Covered in Phase 13 — after repeated failures calling a dependency, a circuit breaker stops sending requests to it entirely for a cooldown period, failing fast instead of piling up slow, doomed requests and resources waiting on a service that's clearly down.
- *"How do you decide which failures are acceptable to degrade gracefully versus which must be fully prevented?"* — Tie it back to the non-functional requirements gathered at the start — a payment system's core charge path likely needs much stronger failure guarantees than a "related products" recommendation widget; not every component deserves the same investment in resilience.

**Red flags:** presenting a design with an unacknowledged single point of failure and no mention of it when asked "what happens if this component goes down?" — this is one of the most reliable HLD interview questions asked specifically because many candidates' initial designs don't survive it.

---

### Observability

**Definition:** The ability to understand a running system's internal state and behavior from its external outputs — logs, metrics, and traces — so problems can be detected, diagnosed, and understood without needing to reproduce them locally; the system-design-level application of Phase 19.

**Model answer:**
> "A design isn't complete without a plan for knowing whether it's actually working in production and diagnosing it quickly when it isn't. I mention the three pillars briefly in any HLD answer: metrics — request rate, error rate, and latency percentiles, specifically p95/p99 rather than just an average, since averages hide the tail latency that actually affects real users; logs — structured, with a correlation ID so a single request can be traced across every service it touched; and for anything spanning multiple services, distributed tracing, showing exactly where time was spent across the whole call chain for one request. I also mention what I'd alert on specifically — rising error rate, rising p99 latency, growing queue depth if queues are part of the design — since 'we'll add monitoring' without naming what's actually being watched is exactly as vague as 'we'll add caching' without naming what's cached."

```text
Applied to the URL shortener:
  Metrics: redirect requests/sec, redirect p50/p99 latency, cache hit ratio, error rate
  Alerts:   error rate > 1% sustained, p99 latency > 200ms, cache hit ratio drops sharply
             (the last one specifically would signal a caching layer problem worth investigating
              immediately, before it fully translates into database overload)
  Logs:     structured, per-request, with a request ID — critical for diagnosing a specific
             user's "my link doesn't work" report after the fact
```

**Follow-ups**
- *"Why specifically p99 instead of average latency?"* — Average hides outliers — a service could have a 50ms average while 1% of users experience a 5-second wait; at scale, 1% of requests is still a very large absolute number of genuinely bad experiences the average completely conceals.
- *"How does observability connect to the failure handling discussion?"* — It's what makes failure handling *actionable* rather than theoretical — a circuit breaker or failover mechanism is far less useful if nobody is alerted when it actually trips, since silent degradation can persist unnoticed for a long time.

**Red flags:** treating observability as an afterthought mentioned only if directly asked, rather than volunteering it as part of a complete design — interviewers specifically notice candidates who design as if the system runs perfectly forever with nobody watching it.

---

### Tradeoffs

**Definition:** Every meaningful architectural decision involves giving something up to gain something else — the explicit articulation of *what* is being traded, and *why* that specific tradeoff fits the requirements at hand, is what distinguishes genuine system-design thinking from reciting components.

**Model answer:**
> "Every decision in a system design has a cost, and the entire point of the HLD interview format is demonstrating that I know what those costs are and I'm choosing them deliberately, not by accident. Consistency versus availability — the CAP theorem's practical expression — is the clearest example: choosing eventual consistency for higher availability and lower latency is the right call for a social feed's like-count, and the wrong call for a bank balance. SQL versus NoSQL trades relational integrity and flexible querying against horizontal write scalability and schema flexibility. Caching trades a small, bounded window of potential staleness for a dramatic reduction in database load and latency. Sharding trades operational simplicity and easy cross-entity queries for horizontal write scale. I make a habit, throughout any design discussion, of stating a decision *and* naming what it costs in the same breath — 'I'll use eventual consistency here, which means a follower count might lag by a few seconds after a follow, and that's an acceptable tradeoff for this specific feature' — rather than presenting a design as if every choice were free."

```text
The pattern to practice, applied to any single decision in a design:

  "I'm choosing [X] over [Y], which gains us [benefit], at the cost of [specific, named cost].
   That's the right tradeoff here because [tie directly back to the stated requirements]."

  Example: "I'm choosing a read replica over sharding for now, which gains us read scalability
  with much less operational complexity, at the cost of replication lag on reads. That's
  acceptable here because we don't have a strict read-your-own-writes requirement for this
  specific feature."
```

**Follow-ups**
- *"Give a tradeoff you'd explicitly flag between two caching strategies."* — Write-through caching keeps the cache always consistent with the database at the cost of added write latency on every write; cache-aside/lazy-loading is faster on writes but risks a stale cache if invalidation isn't handled correctly — the right choice depends on the read:write ratio and how costly staleness actually is for that specific data.
- *"How do you handle an interviewer pushing back and asking 'what if requirements change to need strong consistency here'?"* — Explicitly walk through what would have to change in the design — often it's isolating just the specific piece needing strong consistency and treating the rest differently, rather than redesigning the entire system around the strictest possible requirement everywhere.

**Red flags:** presenting a design as if it has no downsides at all — a design with zero acknowledged tradeoffs is the clearest signal to an experienced interviewer that the tradeoffs simply haven't been thought through, not that the design is genuinely free of them.

---
# Mock Interview Simulation

Purpose: rehearse the full experience back to back, under time pressure, the way a real interview loop actually runs. Set a timer. Speak your answers out loud — actually out loud, not just in your head; the skill being drilled is verbal fluency, not silent recognition.

**Suggested format: 6 rounds, ~40-50 minutes total, one sitting, no notes.**

---

### Round 1 — JavaScript/TypeScript Rapid Round (8 minutes, 6 questions)

Answer each in under 90 seconds, then move on immediately — do not go back.

1. Explain closures with a live example, and name one memory-leak risk they introduce.
2. What's the actual difference between `let` and `var`, beyond just block scope?
3. Write a function that flattens a nested array one level deep, using `reduce`.
4. `any` vs `unknown` — when would using `any` still be defensible?
5. What does `Promise.allSettled` give you that `Promise.all` doesn't, and when do you need that?
6. Explain the temporal dead zone in one sentence.

### Round 2 — Node.js Deep Dive (8 minutes, 5 questions)

7. Walk through Node's event loop phases and where `process.nextTick` fits relative to them.
8. Your API needs to resize large images on upload without blocking other requests — what do you build, and why not just `async`/`await`?
9. Explain backpressure in Node streams with a concrete `pipe()`/`pipeline()` example.
10. What's the difference between an operational error and a programmer error, and how does that distinction change your error-handling code?
11. Describe graceful shutdown end to end — what signal, what happens, in what order.

### Round 3 — MySQL Live Query Round (10 minutes, 4 tasks)

Given: `customers(id, name)`, `orders(id, customer_id, total, status, created_at)`.

12. Write a query returning every customer's total order count and total spend, including customers with zero orders.
13. Write a query finding the 5 customers with the highest total spend in the last 30 days.
14. This query is slow: `SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20 OFFSET 5000;` — diagnose it (say what you'd run first) and propose two independent fixes.
15. Explain, live, what isolation level you'd choose for a `transfer_funds` operation and why, including how you'd handle a resulting deadlock.

### Round 4 — LLD Design Round (12 minutes)

16. **Design a rate limiter.** Cover: the interface, at least two algorithm choices (token bucket vs. sliding window) with their tradeoffs, and how you'd make it work across multiple server instances (not just one process's memory).

*Use the full structure: requirements → entities/interfaces → class sketch → design pattern used and why → extensibility ("now add a per-user AND a per-IP limit") → how you'd test it.*

### Round 5 — HLD Design Round (15 minutes)

17. **Design a notification service** that sends email, SMS, and push notifications, triggered by events from other internal services, at a scale of roughly 10 million notifications per day.

*Run the full process in order: clarify requirements (2 min) → capacity estimation (2 min) → API sketch (2 min) → data model (2 min) → high-level architecture diagram (3 min) → explain the request flow end to end (2 min) → name one bottleneck and one single point of failure, and how you'd address each (2 min).*

### Round 6 — Behavioral/Technical-Story Round (5-8 minutes)

18. Tell me about a bug that took you a long time to find. Walk through your debugging process (tie back to Phase 0.2.4's loop: reproduce → isolate → hypothesize → test → fix root cause → regression test).
19. Tell me about a tradeoff you made under a real constraint (time, scale, team size) — what did you give up, and would you make the same call again?

---

**After the mock interview:** review your Round 5 answer specifically against the HLD checklist below — it's the round most candidates under-prepare for relative to how much interview weight it usually carries.

---

# 100-Question Rapid-Fire Self-Test (Flashcard Mode)

Cover the answers above; go down this list and answer each in one breath, out loud, before checking yourself against the corresponding section. Mark any you hesitate on — that's your actual revision list, not the topics you feel confident about.

**JavaScript (1–14)**
1. What is a closure? 2. What's the temporal dead zone? 3. How is `this` determined in a regular function vs. an arrow function? 4. What's the prototype chain? 5. Order of execution: sync code, microtasks, macrotasks — why that order? 6. Difference between the microtask and macrotask queue? 7. What does `.then` return, and why does that matter for chaining? 8. `Promise.all` vs `allSettled` vs `race` vs `any`? 9. Write a concurrency-limited parallel map from memory. 10. Shallow vs deep copy — name two ways to do each. 11. Implement `map` using `reduce`. 12. Name three common sources of memory leaks in a long-running Node process. 13. Why does `var` in a loop with `setTimeout` log the wrong value? 14. What is `WeakMap` for?

**TypeScript (15–22)**
15. `interface` vs `type` — the one feature only interfaces have? 16. `any` vs `unknown` — which forces narrowing? 17. Write a generic function with a constraint. 18. `|` vs `&` — which is "or," which is "and"? 19. What is a discriminated union? 20. Write `Partial<T>` from scratch as a mapped type. 21. Why isn't a `req.body: SomeType` annotation a real safety guarantee? 22. Name two flags inside `strict: true`.

**Node.js (23–30)**
23. Name Node's event loop phases in order. 24. Where does `process.nextTick` run relative to those phases? 25. Four types of streams? 26. Why can't `async`/`await` alone fix a CPU-bound blocking handler? 27. What does 4-argument middleware signal in Express? 28. Operational vs programmer error? 29. What signal should trigger graceful shutdown, and what's the difference from the signal that can't be caught? 30. Why can't cluster workers share an in-memory cache?

**MySQL (31–39)**
31. Inner join vs left join, in one sentence each. 32. Query to find rows with no match on the other side of a left join? 33. What's a composite index's column-order rule? 34. What does `EXPLAIN`'s `type: ALL` mean? 35. Name all four ACID properties. 36. MySQL InnoDB's default isolation level? 37. What causes a deadlock, and what's the standard application-level response? 38. Why does offset pagination get slower at higher offsets? 39. What's the difference between 2NF and 3NF, briefly?

**LLD (40–45)**
40. Name all five SOLID principles. 41. Give a concrete Liskov Substitution violation. 42. "Favor composition over inheritance" — why? 43. Strategy pattern — what problem does it solve? 44. What's the risk of the Singleton pattern specifically? 45. What single class design smell most commonly signals "this will be hard to unit test"?

**HLD (46–55)**
46. What's the very first thing to do in any HLD interview, before drawing anything? 47. Why estimate a peak QPS multiplier instead of just using the average? 48. Why design the API before the data model? 49. When would you choose a key-value store over a relational database? 50. What's the tradeoff of adding a read replica? 51. What's a cache stampede? 52. Why introduce a queue between two components — name two distinct reasons? 53. What's a circuit breaker for? 54. Why is p99 latency more informative than average latency? 55. What does "eventual consistency" actually trade away, and when is that acceptable?

**Cross-cutting (56–65)**
56. What does "at-least-once delivery" mean, and why is it the practical default? 57. What makes a consumer/operation idempotent — give one naturally idempotent SQL statement. 58. What problem does the Outbox pattern solve? 59. Why must retries be paired with idempotency? 60. What's exponential backoff with jitter, and why the jitter specifically? 61. Name the three pillars of observability. 62. Why should the server never trust data already "validated" by the client? 63. What's the difference between authentication and authorization, in one sentence each? 64. What's a partition key, and what happens if you choose a bad one? 65. What's backpressure, and name two mechanisms that implement it.

*(Numbers 66-100 are yours to write: pull ten more questions from each of Phases 1, 4, 6, 10, and 11 that you personally found hardest, and add them here — a self-test you built yourself surfaces your actual gaps better than any pre-written list can.)*

---

# Cheat Sheets

**The universal interview-answer structure** (repeat this from memory before every mock session):

```text
1. One-line definition
2. Why it matters / when it comes up
3. A small concrete example
4. One tradeoff or edge case
```

**JavaScript quick-reference**

| Concept | One-line anchor |
|---|---|
| Closure | Function + retained access to its outer scope, even after that scope returns |
| Hoisting | Declarations processed before execution; `var`→`undefined`, `let`/`const`→TDZ |
| `this` | Determined by call-site, except arrow functions (lexical) |
| Event loop order | Sync code → drain ALL microtasks → one macrotask → repeat |
| Deep vs shallow copy | Shallow shares nested references; deep clones every level (`structuredClone`) |

**TypeScript quick-reference**

| Concept | One-line anchor |
|---|---|
| `interface` vs `type` | Interfaces merge; types express unions/tuples interfaces can't |
| `any` vs `unknown` | `any` disables checking; `unknown` forces narrowing first |
| Generics | Parameterize a type so input/output relationships stay type-safe |
| Runtime validation | Types vanish at compile time — external data needs an actual runtime check |

**Node.js quick-reference**

| Concept | One-line anchor |
|---|---|
| Event loop phases | timers → pending → poll → check → close; nextTick/microtasks drain between each |
| Streams | Process data in chunks; `pipeline()` handles backpressure + error cleanup for you |
| Worker threads | True parallelism for CPU-bound work; separate memory, message-passed |
| Cluster | Multiple OS processes, not threads; no shared memory between workers |

**MySQL quick-reference**

| Concept | One-line anchor |
|---|---|
| Join types | INNER = matches only; LEFT = all left rows, NULL-filled if unmatched |
| Index | B-tree structure trading write cost + storage for faster reads |
| EXPLAIN `type` | `ALL` = full scan (bad); `ref`/`range` = index used; `const`/`eq_ref` = best |
| Isolation levels (weakest→strongest) | Read Uncommitted → Read Committed → **Repeatable Read (MySQL default)** → Serializable |
| Deadlock fix | Consistent lock ordering everywhere + short transactions + automatic retry |
| Pagination at scale | Cursor/keyset (`WHERE id > last`) beats `OFFSET` for deep pages |

**LLD quick-reference**

| Letter | Principle | One-line anchor |
|---|---|---|
| S | Single Responsibility | One reason to change per class |
| O | Open/Closed | Extend via new code, not edits to existing code |
| L | Liskov Substitution | A subtype must be safely usable wherever its parent is expected |
| I | Interface Segregation | Many small interfaces beat one bloated one |
| D | Dependency Inversion | Depend on abstractions, inject concrete implementations |

**HLD process checklist** (run through, out loud, in this order, every time):

```text
1. Clarify functional + non-functional requirements
2. Capacity estimation (QPS, storage, peak multiplier)
3. Sketch the core API
4. Design the data model, justified by access patterns
5. Draw the high-level architecture
6. Walk through the request flow end to end
7. Identify bottlenecks and single points of failure
8. Add scaling strategy (cache → replicas → sharding, in that order)
9. Address failure handling explicitly
10. Mention observability (metrics, logs, traces)
11. State tradeoffs out loud for every non-obvious decision
```

---

# Phase 25 Exit Checklist

You are ready to interview when you can do **all** of the following without notes, out loud, in under 90 seconds each:

**Process**
- [ ] Recite the universal four-step answer structure and apply it live to a topic you're given on the spot, not one you prepared in advance.
- [ ] Run the full HLD process checklist from memory, in order, without skipping capacity estimation or tradeoffs.
- [ ] Complete the full Mock Interview Simulation above in one sitting, timed, without notes.

**JavaScript / TypeScript / Node.js**
- [ ] Explain closures, `this`, the event loop, and Promise behavior with a live code example for each.
- [ ] Explain `any` vs `unknown`, and write a generic function with a constraint, live.
- [ ] Explain Node's event loop phases specifically (not just the browser model) and one CPU-bound-blocking scenario with its fix.

**MySQL**
- [ ] Write a left-join "find unmatched rows" query and a cursor-based pagination query, live, without hesitation.
- [ ] State MySQL's default isolation level and explain a deadlock and its standard fix.
- [ ] Read an `EXPLAIN` output and identify whether a query is using an index effectively.

**LLD / HLD**
- [ ] Recite all five SOLID principles with a concrete bad-design/good-design example for at least three of them.
- [ ] Complete one full LLD design (rate limiter, parking lot, or similar) live, ending with "now add X" extensibility handling it as a pure addition.
- [ ] Complete one full HLD design (notification service, URL shortener, or similar) live, hitting every step of the process checklist, and explicitly naming at least two tradeoffs.

**You've now completed all 25 phases of the roadmap.** Revisit the roadmap's own closing sections — the Suggested Learning Schedule, Weekly Study Method, Expert-Level Habits, and Final Mastery Checklist — as your ongoing maintenance routine, not a one-time read: interview skill, like the rest of this roadmap, degrades without regular practice. If you'd like, I can generate those closing sections as a standalone reference file next, separate from the phase-wise set.

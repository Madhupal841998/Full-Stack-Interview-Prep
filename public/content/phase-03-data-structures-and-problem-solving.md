# Phase 3 — Data Structures and Problem Solving

> Part of the *Zero to Expert Backend Engineering Master Roadmap*
> Prerequisites: Phase 1 (JavaScript) and Phase 2 (TypeScript)
> Language for all solutions: **JavaScript / TypeScript**

---

## How to Read This Phase

Every topic below is written in the same 12-step order used across the roadmap:

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

### Phase 3 priority summary

| Area | Priority |
|---|---|
| Big O, arrays, strings, hash maps, sets, recursion | MUST KNOW |
| Stacks, queues, two pointers, sliding window, binary search, sorting | MUST KNOW |
| Linked lists, trees, BFS/DFS, heaps, graphs | IMPORTANT |
| Advanced dynamic programming, tries, union-find, segment trees | GOOD TO KNOW for most backend roles |

### The one rule that matters

> Do not memorise solutions. Learn to **recognise the pattern**, then derive the solution.
> An interviewer can tell the difference within two minutes.

---

## 3.1 Complexity Analysis — Big O

**Priority: MUST KNOW**

### Definition

Big O notation describes the **upper bound on the growth rate** of an algorithm's running time or memory consumption as the input size `n` grows toward infinity. It discards constant factors and lower-order terms.

### Simple meaning

"If my input gets 10x bigger, how much slower / heavier does my code get?"

### Why it is needed

Your API works fine with 50 rows in development. In production a tenant has 500,000 rows. An `O(n²)` loop that took 2 ms now takes 40 minutes and blocks the Node.js event loop, so every other request on that process times out. Big O is how you predict that **before** it happens.

### How it works internally

You count the number of **elementary operations** as a function of `n`, then keep only the fastest-growing term.

```
T(n) = 3n² + 40n + 900
     → O(n²)          // 40n and 900 stop mattering as n grows
```

Three bounds exist; interviews mostly use the first:

- **O (Big O)** — worst case / upper bound
- **Ω (Omega)** — best case / lower bound
- **Θ (Theta)** — tight bound (upper and lower match)

**Amortised complexity** is the average cost per operation over a long sequence of operations. `array.push()` is `O(1)` amortised: occasionally the engine reallocates a bigger backing store (`O(n)`), but averaged across all pushes it is constant.

### The growth table (memorise this)

| Complexity | Name | n = 10 | n = 1,000 | n = 1,000,000 | Typical source |
|---|---|---|---|---|---|
| O(1) | Constant | 1 | 1 | 1 | Hash map lookup, array index |
| O(log n) | Logarithmic | 3 | 10 | 20 | Binary search, balanced tree |
| O(n) | Linear | 10 | 1,000 | 1,000,000 | Single loop |
| O(n log n) | Linearithmic | 33 | 10,000 | 20,000,000 | Sorting, heap-based algorithms |
| O(n²) | Quadratic | 100 | 1,000,000 | 10¹² | Nested loops over same input |
| O(2ⁿ) | Exponential | 1,024 | ~10³⁰¹ | — | Naive recursion on subsets |
| O(n!) | Factorial | 3.6M | — | — | Permutation generation |

**Practical ceiling for an interview (≈10⁸ operations/second):**

| n | Target complexity |
|---|---|
| n ≤ 10 | O(n!) or O(2ⁿ) acceptable |
| n ≤ 20 | O(2ⁿ) acceptable |
| n ≤ 500 | O(n³) |
| n ≤ 5,000 | O(n²) |
| n ≤ 10⁶ | O(n log n) or O(n) |
| n > 10⁷ | O(n) or O(log n) only |

Work backwards from the constraint: if the problem says `n ≤ 10^5`, the interviewer has already told you the answer is `O(n log n)` or better.

### Space complexity

Count **extra** memory you allocate, not the input itself.

- Recursion costs `O(depth)` stack space, even with no explicit allocation.
- A `Map` of `n` entries is `O(n)`.
- Sorting in place with `Array.prototype.sort` in V8 uses `O(log n)` auxiliary space (TimSort).

### JavaScript-specific costs (most candidates get these wrong)

| Operation | Complexity | Note |
|---|---|---|
| `arr[i]` | O(1) | |
| `arr.push()` / `arr.pop()` | O(1) amortised | |
| `arr.shift()` / `arr.unshift()` | **O(n)** | Reindexes every element |
| `arr.splice(i, …)` | O(n) | |
| `arr.includes` / `indexOf` / `find` | O(n) | Use a `Set`/`Map` instead |
| `arr.slice()` / `concat` / spread | O(n) | Copies |
| `arr.sort()` | O(n log n) | TimSort in V8, stable since ES2019 |
| `map.get` / `set` / `has` / `delete` | O(1) average | |
| `set.has` / `add` / `delete` | O(1) average | |
| `str + str` in a loop | O(n²) risk | Push to array and `join('')` instead |
| `str.slice` / `substring` | O(k) | Creates a new string |
| `Object.keys(obj)` | O(n) | Allocates an array |
| `structuredClone(obj)` | O(n) | Deep copy |

### Small example

```js
// O(n²) — nested scan
function hasDuplicateSlow(items) {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i] === items[j]) return true;
    }
  }
  return false;
}

// O(n) time, O(n) space — trade memory for speed
function hasDuplicate(items) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) return true;
    seen.add(item);
  }
  return false;
}
```

### Real backend usage

- Deciding whether to filter in the **database** (indexed, `O(log n)`) or in **Node.js** (`O(n)` over a full table scan you just pulled into memory).
- Spotting an N+1 query: a loop of `n` rows each issuing one query is `O(n)` round trips — the single most common backend performance bug.
- Choosing a job-queue data structure: an array with `shift()` is `O(n)` per dequeue; a ring buffer or linked list is `O(1)`.

### Edge cases

- Constants matter at small `n`. Insertion sort beats merge sort for `n < 20` — this is exactly why TimSort is hybrid.
- Hash map lookup is `O(1)` **average** but `O(n)` worst case under collisions. Adversarial key inputs can trigger this (hash-flooding DoS).
- "Two loops" is not automatically `O(n²)`. Sequential loops are `O(n + n) = O(n)`; only **nested** loops multiply.
- A loop over `m` items nested in a loop over `n` items is `O(n·m)`, not `O(n²)`.

### Common mistakes

1. Saying "it's fast because it uses a built-in method". `Array.includes` inside a loop is still `O(n²)`.
2. Forgetting the recursion stack in space analysis.
3. Ignoring the cost of the `sort` you added at the start — it dominates an otherwise `O(n)` solution.
4. Treating `O(n log n)` and `O(n)` as equivalent in a system processing millions of events per minute.
5. Analysing average case when the interviewer asked for worst case.

### Interview answer (say it this way)

> "Big O describes how runtime or memory scales with input size, ignoring constants. I use it to choose between approaches before writing code. For this problem, the brute force is O(n²) because I compare every pair. By storing what I've already seen in a hash set I trade O(n) extra memory for O(n) time, which is the right trade here because n can be large and memory is cheap."

**Frequently asked:**

- *Difference between O(n) and Θ(n)?* → O is an upper bound; Θ means upper and lower bounds match.
- *What is amortised complexity?* → Average cost per operation across a sequence; `push` is O(1) amortised despite occasional O(n) resizes.
- *Is a hash map always O(1)?* → Average yes, worst case O(n) with collisions; real engines mitigate with randomised hashing and tree-ifying buckets.
- *How do you reduce O(n²) to O(n)?* → Usually by replacing an inner search loop with a hash structure, or by sorting once and using two pointers.

### Practice problems

1. Annotate the complexity of every function in one of your own Express route handlers.
2. Given `n = 10^6`, list which of your Phase 1 solutions would time out.
3. Write two versions of "find the intersection of two arrays" — O(n·m) and O(n + m) — and benchmark both with `performance.now()` at n = 100,000.

### Production considerations

- Node.js is single-threaded for JavaScript execution. An `O(n²)` loop does not just slow one request — it **blocks every concurrent request on that process**.
- Measure, do not guess: use `--cpu-prof`, `node --prof`, or `perf_hooks` before optimising.
- Big O hides I/O. One `O(n²)` in-memory loop over 1,000 items may still be faster than one extra network round trip.
- Guard unbounded inputs at the API boundary (max page size, max array length in the request body). Complexity is only safe when `n` is bounded.

---

## 3.2 Arrays

**Priority: MUST KNOW**

### Definition

An array is an ordered, index-addressable collection of elements stored under a single reference, supporting constant-time access by numeric index.

### Simple meaning

A numbered list where you can jump straight to item #7 without reading items 1–6.

### Why it is needed

Arrays are the default container for every list your backend returns: query results, paginated records, batch payloads, log lines. Most interview problems are array problems wearing a costume.

### How it works internally

In a classical language an array is one contiguous memory block; address = `base + index × elementSize`, hence `O(1)` access.

In JavaScript, arrays are **objects with integer-like keys**, but V8 optimises them into two internal representations:

- **Packed elements** — a real contiguous backing store. Fast.
- **Dictionary (sparse) elements** — a hash map. Slow, ~10x worse.

V8 also tracks *element kinds*: `PACKED_SMI_ELEMENTS` (small integers) → `PACKED_DOUBLE_ELEMENTS` → `PACKED_ELEMENTS` (any object). Transitions are **one-way**: once you put a string into an integer array, you never get the fast integer path back.

You fall into the slow dictionary mode when you:

- create holes (`arr[1000] = 1` on a length-2 array, or `delete arr[0]`)
- mix types heavily
- grow far beyond the preallocated capacity repeatedly

Growth is amortised: when capacity is exceeded, V8 allocates a larger buffer and copies — hence `push` is `O(1)` amortised, not strictly `O(1)`.

### Syntax and API (the ones that matter)

```js
// Creation
const a = [1, 2, 3];
const b = new Array(5).fill(0);            // [0,0,0,0,0] — packed, no holes
const c = Array.from({ length: 5 }, (_, i) => i * 2);
const grid = Array.from({ length: 3 }, () => new Array(3).fill(0)); // correct 2D

// WRONG 2D — all rows are the SAME array reference
const bad = new Array(3).fill(new Array(3).fill(0));

// Mutating   (change in place)
arr.push(x); arr.pop();        // O(1) — use this end
arr.unshift(x); arr.shift();   // O(n) — avoid in loops
arr.splice(i, deleteCount, ...items);  // O(n)
arr.sort(cmp); arr.reverse();  // in place

// Non-mutating (return new array)
arr.slice(start, end); arr.concat(other); [...arr];
arr.map(fn); arr.filter(fn); arr.flat(depth); arr.flatMap(fn);
arr.toSorted(cmp); arr.toReversed(); arr.with(i, v);  // ES2023, non-mutating

// Searching / reducing
arr.indexOf(x); arr.includes(x); arr.find(fn); arr.findIndex(fn);
arr.findLast(fn); arr.at(-1);          // last element
arr.some(fn); arr.every(fn); arr.reduce(fn, init);
```

### Small example — prefix sums

A technique worth learning early: answer "sum of range [i, j]" in `O(1)` after `O(n)` preprocessing.

```js
function buildPrefix(nums) {
  const prefix = new Array(nums.length + 1).fill(0);
  for (let i = 0; i < nums.length; i++) prefix[i + 1] = prefix[i] + nums[i];
  return prefix;
}
const rangeSum = (prefix, i, j) => prefix[j + 1] - prefix[i]; // inclusive
```

### Real backend usage

- Paginating and transforming query results before serialising to JSON.
- Chunking a large list into batches for a queue or a bulk DB insert.
- Prefix sums for reporting endpoints (cumulative revenue, running totals) without re-scanning.
- Building `IN (...)` parameter lists — always bounded, always parameterised.

```ts
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
```

### Edge cases

- `[10, 9, 1].sort()` → `[1, 10, 9]`, because the default comparator converts to strings and `"10" < "9"`. Always pass a comparator: `.sort((a, b) => a - b)`.
- `sort` mutates. `[...arr].sort()` or `arr.toSorted()` if the caller still needs the original.
- Sparse arrays: `[, , 1].length === 3`, but `map`/`filter` skip holes while `for...of` does not.
- `arr.length = 0` empties the array in place (affects all references). `arr = []` only rebinds your local variable.
- Negative or fractional indices become ordinary object properties, not elements.
- `NaN`: `[NaN].indexOf(NaN) === -1` but `[NaN].includes(NaN) === true`.

### Common mistakes

1. `shift()` in a loop to drain a queue — turns `O(n)` into `O(n²)`. Use an index pointer or a real queue.
2. `new Array(3).fill([])` — every row shares one reference.
3. Mutating an array while iterating it with `forEach`/`splice` — indices shift and elements get skipped.
4. `reduce` used where a simple `for` loop is clearer; interviewers value readability.
5. Comparing arrays with `===` — that compares references, not contents.
6. Forgetting `sort` is `O(n log n)` and hides inside your "O(n)" solution.

### Interview answer

> "JavaScript arrays are dynamic and object-backed, but V8 keeps them in a fast packed representation as long as there are no holes and element kinds stay consistent. Index access and push/pop are O(1) — push amortised — while shift, unshift and splice are O(n) because every later element is reindexed. So for a queue I never use shift in a hot loop; I use a head pointer or a linked list."

**Frequently asked:**

- Why is `shift()` O(n)?
- Difference between `slice` and `splice`? (`slice` copies and is pure; `splice` mutates)
- How do you copy an array deeply? (`structuredClone`, or recursive copy; spread is shallow)
- `map` vs `forEach`? (`map` returns a new array; `forEach` returns `undefined` and is for side effects)
- How would you remove duplicates while preserving order? (`[...new Set(arr)]`)

### Practice problems

**Easy:** Two Sum · Best Time to Buy and Sell Stock · Contains Duplicate · Product of Array Except Self · Move Zeroes · Merge Sorted Array · Plus One · Running Sum
**Medium:** Rotate Array (reversal trick) · Subarray Sum Equals K (prefix + hash map) · Merge Intervals · Insert Interval · Spiral Matrix · Set Matrix Zeroes · Sort Colours (Dutch national flag) · Maximum Subarray (Kadane)

### Production considerations

- Never build an unbounded array from a DB cursor — stream it (Phase 4.4) or paginate.
- Bound array sizes in request validation; a client-supplied array of 1,000,000 IDs is a denial-of-service vector.
- Pre-allocate with `new Array(n)` + index assignment when `n` is known and large; it avoids repeated reallocation.
- Serialising a huge array via `JSON.stringify` is synchronous and blocks the event loop.

---

## 3.3 Strings

**Priority: MUST KNOW**

### Definition

A string is an immutable, ordered sequence of UTF-16 code units.

### Simple meaning

Text you cannot edit in place — every "change" creates a new string.

### Why it is needed

Backends are string machines: parsing headers, validating emails, slugging titles, building query fragments, normalising user input, hashing tokens.

### How it works internally

- **Immutability**: `s[0] = 'x'` silently does nothing. Every concatenation allocates.
- **UTF-16**: `.length` counts *code units*, not characters. Emoji and many CJK/Indic characters are surrogate pairs of length 2.
- **Rope / cons-strings**: V8 stores `a + b` lazily as a tree node and flattens only when the string is read. This makes concatenation cheaper than the naive model suggests — but it still has cost and memory pressure.
- **Interning**: identical string literals share memory.

### Syntax and API

```js
s.length
s.charAt(i); s[i]; s.at(-1);
s.charCodeAt(i); s.codePointAt(i);
s.slice(a, b);           // supports negatives
s.substring(a, b);       // no negatives, swaps args
s.indexOf(sub); s.includes(sub); s.startsWith(p); s.endsWith(p);
s.split(sep); arr.join(sep);
s.toLowerCase(); s.toUpperCase();
s.trim(); s.trimStart(); s.trimEnd();
s.replace(a, b);         // first match only for string pattern
s.replaceAll(a, b);
s.padStart(n, ch); s.padEnd(n, ch);
s.repeat(n);
s.normalize('NFC');      // essential before comparing user text
[...s]                   // code-point aware split (handles emoji)
```

### Small example — a correct palindrome check

```js
function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  let left = 0, right = clean.length - 1;
  while (left < right) {
    if (clean[left] !== clean[right]) return false;
    left++; right--;
  }
  return true;
}
// O(n) time, O(n) space (the cleaned copy). Two-pointer on the raw string
// with skip logic gives O(1) extra space.
```

### Frequency-map pattern (the string workhorse)

```js
function isAnagram(a, b) {
  if (a.length !== b.length) return false;
  const counts = new Map();
  for (const ch of a) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  for (const ch of b) {
    const n = counts.get(ch);
    if (!n) return false;
    counts.set(ch, n - 1);
  }
  return true;
}
```

### Real backend usage

- Slug generation, filename sanitisation, path traversal defence (`..` stripping).
- Normalising emails and usernames before a uniqueness check (`normalize('NFKC')` + lowercase) — otherwise two visually identical usernames register separately.
- Building log lines and correlation IDs.
- Templating and interpolation — **never** build SQL with string concatenation; use parameterised queries.

### Edge cases

- `'café'.length` can be 4 or 5 depending on NFC vs NFD composition. Normalise before comparing or storing.
- `'👍'.length === 2`; `'👍'.split('').reverse().join('')` produces mojibake. Use `[...'👍']`.
- `.toUpperCase()` is locale-dependent (Turkish dotless i). Use `toLocaleUpperCase(locale)` when locale matters.
- `replace` with a string pattern replaces only the first occurrence.
- Case-insensitive comparison of non-ASCII should use `localeCompare(b, undefined, { sensitivity: 'base' })`.
- Comparing secrets with `===` leaks timing information — use `crypto.timingSafeEqual`.

### Common mistakes

1. Building a string with `+=` inside a large loop. Push into an array, `join('')` once.
2. Assuming `length` equals user-visible character count.
3. Catastrophic regex backtracking (`(a+)+$`) on user input → ReDoS, a real production outage cause.
4. Trusting user input in a path or query string.
5. Forgetting that `split('')` breaks surrogate pairs.

### Interview answer

> "Strings in JavaScript are immutable UTF-16 sequences, so any mutation creates a new string. That means repeated concatenation in a loop can degrade to O(n²) in the naive model; I build an array of fragments and join once. I also treat `.length` as a count of code units rather than characters, because emoji and combining marks are multiple code units, so I iterate with a spread or `for...of` when correctness per character matters."

**Frequently asked:**

- Reverse a string without built-ins.
- Check anagram / palindrome.
- First non-repeating character.
- Longest substring without repeating characters (sliding window).
- Why is string concatenation in a loop slow?
- `slice` vs `substring` vs `substr`?

### Practice problems

**Easy:** Valid Palindrome · Valid Anagram · First Unique Character · Longest Common Prefix · Reverse Words in a String · Implement `indexOf`
**Medium:** Longest Substring Without Repeating Characters · Group Anagrams · Longest Palindromic Substring · String Compression · Minimum Window Substring (hard-ish but classic)

### Production considerations

- Cap input length **before** running any regex on it.
- Use `RegExp` objects created once at module scope, not rebuilt per request.
- Prefer streaming parsers for large text payloads; a 200 MB string is 400 MB of heap in UTF-16.
- Always `normalize()` user identifiers before uniqueness checks or you will get duplicate accounts.

---

## 3.4 Hash Maps and Sets

**Priority: MUST KNOW — this is the single highest-leverage data structure in interviews**

### Definition

A hash map stores key-value pairs and uses a hash function to compute a bucket index for each key, giving average `O(1)` insert, lookup and delete. A set is a hash map that stores only keys.

### Simple meaning

A lookup table. "Have I seen this before?" and "what value goes with this key?" answered instantly.

### Why it is needed

Roughly half of all "optimise this O(n²)" interview answers are *"store what you've already seen in a hash map."* In backends, hash maps are caches, indexes, dedup sets, rate-limit counters and grouping tools.

### How it works internally

1. `hash(key)` → integer
2. `index = hash % bucketCount`
3. Collisions (two keys, one bucket) are resolved by chaining (list per bucket) or open addressing (probe for the next slot).
4. When `load factor = entries / buckets` crosses a threshold, the table **resizes** and rehashes everything — an occasional `O(n)` cost, amortised to `O(1)`.

Worst case is `O(n)` when everything collides. V8 uses randomised hash seeds to make adversarial collisions impractical.

`Map` in V8 additionally preserves **insertion order** by keeping entries in an ordered backing array.

### `Map` vs plain object — know this cold

| | `Map` | `{}` |
|---|---|---|
| Key types | Any value, including objects and functions | String / Symbol only (others coerced) |
| Ordering | Insertion order, guaranteed | Integer-like keys first, then insertion order |
| Size | `map.size` — O(1) | `Object.keys(o).length` — O(n) |
| Prototype pollution | None | Inherits `__proto__`, `constructor`, `toString` |
| Iteration | Directly iterable | Needs `Object.entries` |
| Frequent add/delete | Optimised for it | Can deoptimise hidden classes |
| JSON | Not serialisable directly | Serialises natively |

**Use `Map` for dynamic, user-supplied keys.** Use an object for fixed-shape records and anything you will `JSON.stringify`.

`WeakMap` / `WeakSet`: keys must be objects, held weakly, so entries vanish when the key is garbage collected. Not iterable, no `.size`. Use for per-object metadata caches that must not leak.

### Syntax and API

```js
const m = new Map([['a', 1], ['b', 2]]);
m.set('c', 3); m.get('a'); m.has('a'); m.delete('a'); m.size; m.clear();
for (const [k, v] of m) { /* … */ }
[...m.keys()]; [...m.values()]; [...m.entries()];
Object.fromEntries(m);                 // to plain object (string keys)

const s = new Set([1, 2, 2, 3]);       // {1,2,3}
s.add(4); s.has(2); s.delete(1); s.size;
[...new Set(arr)];                     // dedupe preserving order

// ES2024/2025 set methods (Node 22+)
a.union(b); a.intersection(b); a.difference(b); a.isSubsetOf(b);
```

### Small example — Two Sum, the canonical hash-map answer

```js
function twoSum(nums, target) {
  const seen = new Map();            // value -> index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
// O(n) time, O(n) space — down from the O(n²) double loop.
```

### The four hash-map patterns to recognise

1. **Seen set** — dedupe, cycle detection, "contains duplicate".
2. **Complement lookup** — Two Sum and every variant of it.
3. **Frequency map** — anagrams, top-K, majority element, character counts.
4. **Group-by** — bucket items under a derived key (sorted string, prefix, tenant id).

```ts
function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}
```

### Real backend usage

- **Killing N+1 queries.** Fetch parents, fetch all children in one `IN (...)` query, then index the children by `parentId` in a `Map` and stitch in memory — `O(n)` instead of `n` round trips. This is exactly what DataLoader does.
- In-process caches and memoisation (with a TTL and a size cap).
- Rate limiting counters keyed by IP or API key.
- Deduplicating webhook deliveries by idempotency key.
- Session and connection registries in a WebSocket server.

```ts
// N+1 killer
const posts = await db.posts.findMany({ where: { authorId: { in: ids } } });
const byAuthor = new Map<string, Post[]>();
for (const p of posts) {
  (byAuthor.get(p.authorId) ?? byAuthor.set(p.authorId, []).get(p.authorId)!).push(p);
}
const result = authors.map(a => ({ ...a, posts: byAuthor.get(a.id) ?? [] }));
```

### Edge cases

- `Map` uses **SameValueZero**: `NaN` matches `NaN`, but `{a:1}` never matches a different object with the same shape. Objects are compared by reference.
- `0` and `-0` are treated as the same key.
- Object keys coerce: `obj[1]` and `obj['1']` are the same property; `obj[{}]` becomes `obj['[object Object]']`.
- Prototype keys: `obj['__proto__'] = value` can corrupt the prototype chain. Use `Object.create(null)` or a `Map` for untrusted keys.
- Iteration order of integer-like object keys is ascending numeric, **not** insertion order.

### Common mistakes

1. Using a plain object for user-controlled keys → prototype pollution vulnerability.
2. `if (map.get(k))` instead of `map.has(k)` — breaks when the stored value is `0`, `''` or `false`.
3. An unbounded in-memory cache — a slow memory leak that OOMs the pod at 3 a.m. Always bound size and TTL.
4. Using a `Map` as a cache across cluster workers and being surprised it is not shared (each process has its own heap — that is what Redis is for).
5. `JSON.stringify(map)` produces `{}`. Convert with `Object.fromEntries` first.

### Interview answer

> "A hash map gives average O(1) lookup by hashing the key to a bucket; collisions are chained, and the table rehashes when the load factor gets too high, so worst case is O(n). I reach for it whenever I have a nested loop that searches for something — I replace the inner scan with a lookup and trade O(n) space for O(n) time. In Node I prefer `Map` over a plain object when keys are dynamic or non-string, because `Map` has no prototype to pollute, gives O(1) size, and preserves insertion order."

**Frequently asked:**

- `Map` vs object — when do you use each?
- How do hash collisions work? What is the load factor?
- What is a `WeakMap` and when would you use one?
- Why is `Set` lookup faster than `Array.includes`?
- How would you implement an LRU cache? (`Map` + insertion order, or `Map` + doubly linked list)

### Practice problems

**Easy:** Two Sum · Contains Duplicate · Valid Anagram · Intersection of Two Arrays · Happy Number · Ransom Note · Single Number
**Medium:** Group Anagrams · Top K Frequent Elements · Longest Consecutive Sequence · Subarray Sum Equals K · LRU Cache · Insert Delete GetRandom O(1) · 4Sum II

### Production considerations

- In-process `Map` caches do not survive restarts and are not shared across instances. Use Redis when correctness across processes matters.
- Always pair a cache with an eviction policy (`lru-cache` with `max` and `ttl`).
- Never let request-controlled keys grow a global map without bound.
- Hash-flooding: validate and cap the number of keys you accept from a client payload.

---

## 3.5 Stacks

**Priority: MUST KNOW**

### Definition

A stack is a linear collection with Last-In-First-Out access: insertion (`push`) and removal (`pop`) both happen at the same end.

### Simple meaning

A pile of plates. Last one on is the first one off.

### Why it is needed

Anything with nesting, matching or "undo" semantics is a stack problem: parsing, bracket matching, expression evaluation, backtracking, and the call stack itself.

### How it works internally

Backed by a dynamic array (`push`/`pop` are O(1) amortised) or a linked list (strict O(1)). In JavaScript a plain array is a perfect stack — **never** use `shift`/`unshift` for this.

The **call stack** is a stack of execution contexts. Exceeding it throws `RangeError: Maximum call stack size exceeded` at roughly 10,000–15,000 frames in Node.

### Syntax and API

```js
const stack = [];
stack.push(x);            // O(1)
const top = stack.pop();  // O(1), undefined if empty
const peek = stack.at(-1);
const empty = stack.length === 0;
```

```ts
class Stack<T> {
  #items: T[] = [];
  push(item: T): void { this.#items.push(item); }
  pop(): T | undefined { return this.#items.pop(); }
  peek(): T | undefined { return this.#items.at(-1); }
  get size(): number { return this.#items.length; }
  get isEmpty(): boolean { return this.#items.length === 0; }
}
```

### Small example — valid parentheses

```js
function isValid(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);
    else if (pairs[ch]) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;   // leftovers mean unclosed brackets
}
```

### Monotonic stack (the medium-level unlock)

A stack kept in increasing or decreasing order. It solves "next greater / next smaller element" in `O(n)` instead of `O(n²)`.

```js
function nextGreater(nums) {
  const res = new Array(nums.length).fill(-1);
  const stack = [];                    // holds indices, values decreasing
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[stack.at(-1)] < nums[i]) {
      res[stack.pop()] = nums[i];
    }
    stack.push(i);
  }
  return res;
}
```

### Real backend usage

- Recursive directory traversal converted to an iterative stack to avoid stack overflow on deep trees.
- Expression / filter DSL parsing for a search API.
- Undo history in a collaborative editing service.
- Middleware unwinding and error propagation conceptually mirror a stack.
- Reading a stack trace during incident debugging.

### Edge cases

- `pop()` on an empty array returns `undefined`, not an error — check `length` first if `undefined` is a valid stored value.
- Deep recursion overflows; convert to an explicit stack for untrusted depth (e.g. deeply nested JSON from a client).
- A monotonic stack must have a clearly defined tie-break (`<` vs `<=`) or duplicates break it.

### Common mistakes

1. Using `shift()` to pop — O(n) and also wrong order semantics.
2. Forgetting the final `stack.length === 0` check in bracket matching.
3. Pushing values instead of indices in a monotonic stack when you need positions.
4. Recursing over user-supplied nested structures with no depth limit.

### Interview answer

> "A stack is LIFO. In JavaScript I use an array with push and pop, both O(1) amortised. I reach for a stack whenever the problem involves matching or nesting — brackets, tags, recursive structures — or when I want to convert recursion into iteration, because recursion is really just the call stack doing the same job. For 'next greater element' style problems I use a monotonic stack to get O(n)."

**Frequently asked:** Stack vs queue · Implement a stack with two queues · Implement `getMin()` in O(1) (auxiliary min stack) · Evaluate reverse Polish notation · How does the call stack work?

### Practice problems

**Easy:** Valid Parentheses · Min Stack · Baseball Game · Remove All Adjacent Duplicates
**Medium:** Evaluate Reverse Polish Notation · Daily Temperatures · Next Greater Element I/II · Asteroid Collision · Decode String · Simplify Path · Largest Rectangle in Histogram (hard, monotonic stack)

### Production considerations

- Enforce a max nesting depth when parsing untrusted JSON/XML — unbounded nesting is a DoS vector.
- Prefer iterative stack-based traversal for file trees and org hierarchies of unknown depth.
- `Error.captureStackTrace` and `--stack-trace-limit` control how much stack you keep in logs; deep stacks cost memory.

---

## 3.6 Queues and Deques

**Priority: MUST KNOW**

### Definition

A queue is a linear collection with First-In-First-Out access: insertion at the rear (`enqueue`), removal from the front (`dequeue`). A deque allows insertion and removal at both ends.

### Simple meaning

A line at a counter. First to arrive is first to be served.

### Why it is needed

Queues are the backbone of backend architecture — job queues, message brokers, request buffers, connection pools — and of BFS, which is the most common graph/tree algorithm in interviews.

### How it works internally

Three implementations, and you must know why the naive one is wrong:

| Implementation | enqueue | dequeue | Verdict |
|---|---|---|---|
| `array.push` + `array.shift` | O(1) | **O(n)** | Wrong for large n |
| Array + head index | O(1) | O(1) | Good; memory grows until reset |
| Circular buffer / linked list | O(1) | O(1) | Best |

```ts
class Queue<T> {
  #items: T[] = [];
  #head = 0;
  enqueue(item: T): void { this.#items.push(item); }
  dequeue(): T | undefined {
    if (this.#head >= this.#items.length) return undefined;
    const item = this.#items[this.#head];
    this.#items[this.#head++] = undefined as unknown as T; // release reference
    if (this.#head > 1000 && this.#head * 2 >= this.#items.length) {
      this.#items = this.#items.slice(this.#head);          // compact
      this.#head = 0;
    }
    return item;
  }
  get size(): number { return this.#items.length - this.#head; }
  get isEmpty(): boolean { return this.size === 0; }
}
```

### Small example — level-order traversal (BFS)

```js
function levelOrder(root) {
  if (!root) return [];
  const levels = [];
  let queue = [root];
  while (queue.length) {
    const next = [];
    levels.push(queue.map(n => n.val));
    for (const node of queue) {
      if (node.left) next.push(node.left);
      if (node.right) next.push(node.right);
    }
    queue = next;                 // avoids shift() entirely
  }
  return levels;
}
```

### Real backend usage

- BullMQ / SQS / RabbitMQ job processing: enqueue "send welcome email", a worker dequeues it. Learn the in-memory version first; the distributed version has the same semantics plus retries, visibility timeouts and dead-letter queues.
- Connection pools hand out and reclaim connections FIFO.
- Rate limiting with a sliding window uses a deque of timestamps: push new, shift expired from the front.
- Buffering log lines before a batched flush.

```js
// Sliding-window rate limiter — a deque of timestamps
class SlidingWindowLimiter {
  constructor(limit, windowMs) { this.limit = limit; this.windowMs = windowMs; this.hits = new Map(); }
  allow(key, now = Date.now()) {
    const q = this.hits.get(key) ?? [];
    let i = 0;
    while (i < q.length && q[i] <= now - this.windowMs) i++;   // drop expired
    const recent = q.slice(i);
    if (recent.length >= this.limit) { this.hits.set(key, recent); return false; }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
```

### Edge cases

- Dequeue from empty → `undefined`. Distinguish "empty" from "stored undefined".
- The head-index queue leaks memory if you never compact — dequeued slots keep object references alive.
- BFS without a `visited` set on a cyclic graph loops forever.
- Unbounded queues are a memory leak; producers faster than consumers is the classic backpressure failure.

### Common mistakes

1. `arr.shift()` in a BFS loop over 100,000 nodes → O(n²).
2. Marking nodes visited on *dequeue* instead of on *enqueue* — the same node gets queued many times.
3. No bound on queue size, no backpressure, no dead-letter handling.
4. Confusing a priority queue (heap-ordered) with a FIFO queue.

### Interview answer

> "A queue is FIFO. The naive JavaScript implementation with push and shift is O(n) per dequeue because shift reindexes the whole array, so I use a head pointer or a linked list to get O(1). Queues matter in interviews because BFS needs one, and they matter in production because every async job system is a durable queue with retries and a dead-letter queue on top of the same semantics."

**Frequently asked:** Queue vs stack · Implement a queue using two stacks · Why is `shift` O(n)? · Circular queue design · What is backpressure?

### Practice problems

**Easy:** Implement Queue using Stacks · Implement Stack using Queues · Number of Recent Calls · First Unique Character (queue variant)
**Medium:** Design Circular Queue · Binary Tree Level Order Traversal · Rotting Oranges · Walls and Gates · Design Hit Counter · Sliding Window Maximum (monotonic deque)

### Production considerations

- Always bound queue depth and apply backpressure (pause the producer, reject with 429/503).
- Every real job queue needs: retry with exponential backoff, max attempts, dead-letter queue, idempotent handlers, and visibility timeouts.
- Monitor queue depth and oldest-message age — both are leading indicators of incidents.
- In-memory queues lose work on restart. Durable queues survive; choose deliberately.

---

## 3.7 Linked Lists

**Priority: IMPORTANT**

### Definition

A linked list is a linear structure where each node holds a value and a reference to the next node (and, in a doubly linked list, the previous one). Nodes are not contiguous in memory.

### Simple meaning

A treasure hunt: each clue tells you where the next clue is. You cannot jump to clue #7 — you must walk there.

### Why it is needed

Honestly: in application backends you rarely write one by hand. You learn them because (a) they teach pointer manipulation, which is the real skill being tested, and (b) they are the backbone of LRU caches, which you *will* build.

### How it works internally

```
Singly:  [A|•]→[B|•]→[C|null]
Doubly:  null←[A|•]⇄[B|•]⇄[C|•]→null
```

| Operation | Linked list | Array |
|---|---|---|
| Access by index | O(n) | O(1) |
| Insert/delete at head | O(1) | O(n) |
| Insert/delete at tail | O(1) with tail pointer | O(1) |
| Insert/delete at known node | O(1) | O(n) |
| Search | O(n) | O(n) |
| Memory | Extra pointer per node, poor cache locality | Contiguous, cache-friendly |

Arrays usually win in practice because of CPU cache locality. Linked lists win when you hold a reference to a node and need O(1) removal — precisely the LRU case.

### Syntax and API

```ts
class ListNode<T> {
  constructor(public val: T, public next: ListNode<T> | null = null) {}
}
```

### The three techniques that solve almost every linked-list problem

**1. Dummy head** — eliminates all the "what if the head changes" special cases.

```js
function removeElements(head, target) {
  const dummy = new ListNode(0, head);
  let cur = dummy;
  while (cur.next) {
    if (cur.next.val === target) cur.next = cur.next.next;
    else cur = cur.next;
  }
  return dummy.next;
}
```

**2. Iterative reversal** — three pointers, memorise the shape.

```js
function reverseList(head) {
  let prev = null, cur = head;
  while (cur) {
    const next = cur.next;   // save
    cur.next = prev;         // reverse
    prev = cur;              // advance
    cur = next;
  }
  return prev;
}
```

**3. Fast and slow pointers (Floyd)** — cycle detection and finding the middle.

```js
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

function middleNode(head) {
  let slow = head, fast = head;
  while (fast && fast.next) { slow = slow.next; fast = fast.next.next; }
  return slow;             // for even length, returns the second middle
}
```

### Real backend usage

- **LRU cache** — a doubly linked list gives O(1) eviction of the least-recently-used node, with a hash map for O(1) lookup. (In JavaScript you can cheat: `Map` preserves insertion order, so delete-then-set moves a key to the end.)

```js
class LRUCache {
  constructor(capacity) { this.capacity = capacity; this.map = new Map(); }
  get(key) {
    if (!this.map.has(key)) return -1;
    const val = this.map.get(key);
    this.map.delete(key); this.map.set(key, val);   // mark as recent
    return val;
  }
  put(key, val) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) {
      this.map.delete(this.map.keys().next().value); // evict oldest
    }
    this.map.set(key, val);
  }
}
```

- Chained hash-map buckets, free lists in memory allocators, and the internal structure of many queue implementations.
- Undo/redo history with bidirectional navigation.

### Edge cases

- Empty list (`head === null`), single node, two nodes — test all three.
- Cycles: any traversal without cycle protection hangs forever.
- Losing the `next` reference before reassigning it — the node and everything after it becomes garbage.
- The node you must delete is the tail and you only have a pointer to it (unsolvable in a singly linked list without the previous node).

### Common mistakes

1. Reassigning `cur.next` before saving it.
2. Not using a dummy head, then drowning in head-is-null special cases.
3. `fast.next.next` without checking `fast.next` → `TypeError`.
4. Returning `head` after a reversal instead of `prev`.
5. Mutating the input list when the caller still needs it.

### Interview answer

> "A linked list trades O(1) index access for O(1) insertion and deletion at a known node. I use three tools: a dummy head node so head changes need no special case, three-pointer iterative reversal, and fast/slow pointers for cycle detection and finding the middle. In production the case that actually comes up is an LRU cache, where a doubly linked list plus a hash map gives O(1) get, put and eviction."

**Frequently asked:** Array vs linked list · Reverse a linked list (iterative and recursive) · Detect a cycle and find where it starts · Merge two sorted lists · Find the k-th node from the end · Design an LRU cache.

### Practice problems

**Easy:** Reverse Linked List · Merge Two Sorted Lists · Linked List Cycle · Middle of the Linked List · Remove Duplicates from Sorted List · Palindrome Linked List
**Medium:** Remove Nth Node From End · Add Two Numbers · Reorder List · Linked List Cycle II · Copy List with Random Pointer · LRU Cache · Sort List (merge sort on a list)

### Production considerations

- Use `lru-cache` rather than hand-rolling for production caching; hand-roll only in interviews.
- Long linked structures fragment the heap and are unfriendly to the GC compared with arrays.
- Any recursive linked-list algorithm risks stack overflow on a 100,000-node list — prefer iterative.

---

## 3.8 Trees and Binary Search Trees

**Priority: IMPORTANT (binary trees and traversals lean MUST KNOW)**

### Definition

A tree is a connected acyclic graph with a designated root, in which every node except the root has exactly one parent. A **binary tree** limits each node to two children. A **binary search tree (BST)** maintains the invariant: every value in the left subtree < node value < every value in the right subtree.

### Simple meaning

A hierarchy — an org chart, a folder structure, a comment thread.

### Why it is needed

Hierarchies are everywhere in backends: categories, permissions, org units, threaded comments, file trees, JSON itself. And database indexes are B+ trees — understanding tree search is understanding why an index makes a query fast (Phase 6).

### How it works internally

Key terms: *root*, *leaf*, *height* (longest root-to-leaf edge count), *depth*, *balanced* (height ≈ log n), *complete*, *full*, *perfect*.

BST search halves the search space at each step → `O(h)`, where `h = log n` when balanced but degrades to `O(n)` when the tree becomes a sorted chain. Self-balancing variants (AVL, Red-Black) rotate on insert to keep `h = O(log n)`.

**In-order traversal of a BST yields sorted order.** That single fact answers a surprising number of interview questions.

### Traversals — the four you must write from memory

```ts
class TreeNode {
  constructor(public val: number,
              public left: TreeNode | null = null,
              public right: TreeNode | null = null) {}
}

// DFS — recursive
const inorder  = (n, out = []) => { if (n) { inorder(n.left, out);  out.push(n.val); inorder(n.right, out); } return out; };
const preorder = (n, out = []) => { if (n) { out.push(n.val); preorder(n.left, out); preorder(n.right, out); } return out; };
const postorder= (n, out = []) => { if (n) { postorder(n.left, out); postorder(n.right, out); out.push(n.val); } return out; };

// DFS — iterative in-order (interviewers love asking for this)
function inorderIterative(root) {
  const out = [], stack = [];
  let cur = root;
  while (cur || stack.length) {
    while (cur) { stack.push(cur); cur = cur.left; }
    cur = stack.pop();
    out.push(cur.val);
    cur = cur.right;
  }
  return out;
}

// BFS — level order
function bfs(root) {
  if (!root) return [];
  const out = [];
  let level = [root];
  while (level.length) {
    out.push(level.map(n => n.val));
    level = level.flatMap(n => [n.left, n.right].filter(Boolean));
  }
  return out;
}
```

**When to use which:**

| Traversal | Use it for |
|---|---|
| In-order | Sorted output from a BST, validating a BST, k-th smallest |
| Pre-order | Copying/serialising a tree, top-down propagation (e.g. inherited permissions) |
| Post-order | Deleting a tree, bottom-up aggregation (folder sizes, height, diameter) |
| Level order (BFS) | Shortest depth, per-level output, right-side view |

### BST operations

```js
function search(root, target) {
  let cur = root;
  while (cur) {
    if (target === cur.val) return cur;
    cur = target < cur.val ? cur.left : cur.right;
  }
  return null;
}

function insert(root, val) {
  if (!root) return new TreeNode(val);
  if (val < root.val) root.left = insert(root.left, val);
  else if (val > root.val) root.right = insert(root.right, val);
  return root;
}

// Validate a BST — the classic trap: comparing only with the direct parent is WRONG
function isValidBST(node, min = -Infinity, max = Infinity) {
  if (!node) return true;
  if (node.val <= min || node.val >= max) return false;
  return isValidBST(node.left, min, node.val) && isValidBST(node.right, node.val, max);
}
```

### Complexity

| Operation | Balanced BST | Degenerate BST |
|---|---|---|
| Search / insert / delete | O(log n) | O(n) |
| Traversal | O(n) | O(n) |
| Space (recursive) | O(log n) stack | O(n) stack |

### Real backend usage

- Modelling hierarchies in SQL: adjacency list (`parent_id`), nested sets, materialised path, or a recursive CTE. Know that `WITH RECURSIVE` is the practical way to query an arbitrary-depth tree in MySQL 8+.
- Permission inheritance down an org tree (pre-order propagation).
- Rendering threaded comments: fetch flat rows, build the tree in memory with a `Map<id, node>` in `O(n)`.
- Database indexes: B+ trees are balanced, high-fanout trees; this is why an indexed lookup is `O(log n)` disk seeks instead of a full scan.

```ts
// Flat rows -> tree in O(n). A genuinely common backend task.
function buildTree<T extends { id: string; parentId: string | null }>(rows: T[]) {
  const byId = new Map(rows.map(r => [r.id, { ...r, children: [] as any[] }]));
  const roots: any[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}
```

### Edge cases

- Empty tree (`root === null`) — the first line of almost every solution.
- Single node; skewed tree (sorted inserts produce a linked list).
- Duplicate values — define the policy explicitly (left, right, or a count field).
- Deleting a node with two children requires the in-order successor.
- Deep trees overflow the recursion stack; use an explicit stack for unbounded depth.

### Common mistakes

1. Validating a BST by comparing each node only against its parent instead of carrying `(min, max)` bounds down.
2. Confusing height and depth, or off-by-one on height (edges vs nodes — state your convention).
3. Forgetting the null check before recursing.
4. Using BFS where per-level grouping is required but pushing children of different levels into one flat queue without a level boundary.
5. Assuming a BST is balanced.

### Interview answer

> "A BST keeps left subtree values below the node and right subtree values above, so search halves the space each step — O(log n) if balanced, O(n) if it degenerates into a chain, which is why production structures use self-balancing variants or B+ trees. In-order traversal of a BST gives sorted output, which I use for validation and for k-th smallest. For traversal I pick DFS when I need full-path or bottom-up aggregation and BFS when I need shortest depth or per-level output."

**Frequently asked:** BST vs binary tree · In-order vs pre-order vs post-order, and when each is used · Validate a BST · Lowest common ancestor · Check if a tree is balanced · Why do databases use B+ trees rather than binary trees? (high fanout → fewer disk reads)

### Practice problems

**Easy:** Maximum Depth of Binary Tree · Same Tree · Invert Binary Tree · Symmetric Tree · Path Sum · Merge Two Binary Trees · Balanced Binary Tree
**Medium:** Validate BST · Level Order Traversal · Right Side View · Lowest Common Ancestor (BST and general) · Kth Smallest Element in a BST · Construct Tree from Preorder & Inorder · Diameter of Binary Tree · Serialize and Deserialize Binary Tree

### Production considerations

- Recursive tree building over untrusted data needs a depth cap.
- Prefer one flat query + in-memory tree assembly over recursive per-node queries (N+1 again).
- For deep hierarchies queried often, denormalise with a materialised path (`/root/child/grandchild/`) and index it with a prefix.
- Cache assembled trees; they change rarely and cost `O(n)` to rebuild.

---

## 3.9 Heaps and Priority Queues

**Priority: IMPORTANT**

### Definition

A binary heap is a complete binary tree satisfying the heap property: in a min-heap every parent is ≤ its children; in a max-heap every parent is ≥ its children. A priority queue is the abstract type; a heap is the usual implementation.

### Simple meaning

A bag where you can always pull out the smallest (or largest) item instantly, without keeping everything sorted.

### Why it is needed

"Top K", "k-th largest", "merge k sorted lists", "schedule the next job" and Dijkstra's algorithm all need *the extreme element repeatedly* — and sorting the whole dataset each time is wasteful.

### How it works internally

Stored as a flat array — no node objects needed:

```
parent(i)     = (i - 1) >> 1
leftChild(i)  = 2i + 1
rightChild(i) = 2i + 2
```

- **Insert**: append at the end, then *sift up* while smaller than the parent → `O(log n)`.
- **Extract min**: take index 0, move the last element to the root, *sift down* → `O(log n)`.
- **Peek**: `O(1)`.
- **Heapify an array**: `O(n)` (not `O(n log n)` — sifting down from the middle backwards is linear).

**JavaScript has no built-in heap.** Implement it or use `heap-js` / `@datastructures-js/priority-queue`.

### Implementation to memorise

```ts
class MinHeap<T> {
  #heap: T[] = [];
  constructor(private compare: (a: T, b: T) => number = (a: any, b: any) => a - b) {}

  get size() { return this.#heap.length; }
  peek(): T | undefined { return this.#heap[0]; }

  push(val: T): void {
    this.#heap.push(val);
    let i = this.#heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.#heap[i], this.#heap[parent]) >= 0) break;
      [this.#heap[i], this.#heap[parent]] = [this.#heap[parent], this.#heap[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    if (this.#heap.length === 0) return undefined;
    const top = this.#heap[0];
    const last = this.#heap.pop()!;
    if (this.#heap.length) {
      this.#heap[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let smallest = i;
        if (l < this.#heap.length && this.compare(this.#heap[l], this.#heap[smallest]) < 0) smallest = l;
        if (r < this.#heap.length && this.compare(this.#heap[r], this.#heap[smallest]) < 0) smallest = r;
        if (smallest === i) break;
        [this.#heap[i], this.#heap[smallest]] = [this.#heap[smallest], this.#heap[i]];
        i = smallest;
      }
    }
    return top;
  }
}
```

### Small example — top K frequent elements

```js
function topKFrequent(nums, k) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) ?? 0) + 1);

  const heap = new MinHeap((a, b) => a[1] - b[1]);   // min-heap by count
  for (const entry of freq) {
    heap.push(entry);
    if (heap.size > k) heap.pop();                   // keep only the best k
  }
  return [...Array(heap.size)].map(() => heap.pop()[0]).reverse();
}
// O(n log k) — better than sorting everything at O(n log n) when k ≪ n.
```

> **The counter-intuitive rule:** for *k largest*, use a **min**-heap of size k (evict the smallest). For *k smallest*, use a **max**-heap of size k.

### Real backend usage

- Job schedulers: next job by priority or by scheduled timestamp. Node's own timer implementation uses a heap-like structure.
- Dijkstra / A* routing (delivery ETA, network path selection).
- Merging k sorted streams — for example, combining paginated results from several shards in order.
- Leaderboards and "top N by score" endpoints (though Redis sorted sets are the production answer).
- Rate-limiter expiry: a min-heap keyed by expiry time lets you evict lazily in `O(log n)`.

### Edge cases

- `k > n` — return everything.
- Ties in priority: a binary heap is **not stable**. Break ties explicitly with a monotonically increasing sequence number if FIFO-within-priority matters.
- Empty heap on `pop`/`peek`.
- Heaps are not sorted. Only the root is guaranteed; printing the backing array is not sorted output.
- You cannot efficiently search or arbitrarily delete from a plain heap (`O(n)`); you need an index map for decrease-key.

### Common mistakes

1. Using a max-heap for "k largest" and popping n − k times — `O(n log n)` instead of `O(n log k)`.
2. Sorting the whole array when only the top 10 are needed on a 1,000,000-element dataset.
3. Forgetting to define a comparator for object elements.
4. Assuming heap iteration order is sorted order.
5. Rebuilding the heap on every insert instead of sifting.

### Interview answer

> "A binary heap is a complete tree stored in a flat array, so parent and child indices are arithmetic. Push and pop are O(log n) because of sift-up and sift-down, peek is O(1), and building from an existing array is O(n). For a top-K problem I keep a min-heap of size k and evict the smallest, which gives O(n log k) instead of O(n log n) for a full sort — a big win when k is small relative to n. JavaScript has no built-in heap, so I implement one or use a library."

**Frequently asked:** Heap vs BST · Why is heapify O(n)? · k-th largest element · Merge k sorted lists · How does a priority queue schedule jobs? · Is a heap stable?

### Practice problems

**Easy:** Kth Largest Element in a Stream · Last Stone Weight
**Medium:** Kth Largest Element in an Array · Top K Frequent Elements · K Closest Points to Origin · Task Scheduler · Reorganize String · Find Median from Data Stream (two heaps) · Merge k Sorted Lists

### Production considerations

- For distributed leaderboards use Redis sorted sets (`ZADD`/`ZRANGE`), not an in-process heap — the heap does not survive restarts or share across instances.
- Priority queues need a starvation guard: low-priority jobs must eventually run (ageing).
- Bound the heap; an unbounded in-memory scheduler queue is a memory leak.

---

## 3.10 Graphs

**Priority: IMPORTANT**

### Definition

A graph is a set of vertices (nodes) and edges (connections). Edges may be directed or undirected, weighted or unweighted; the graph may be cyclic or acyclic, connected or disconnected.

### Simple meaning

Things and the relationships between them — a map of cities and roads.

### Why it is needed

Anything with "depends on", "follows", "connects to" or "reaches" is a graph: microservice dependency graphs, permission inheritance, social follows, workflow DAGs, database foreign-key relationships, route planning.

### How it works internally — representations

| Representation | Space | Edge lookup | Iterate neighbours | Use when |
|---|---|---|---|---|
| Adjacency list (`Map<node, node[]>`) | O(V + E) | O(degree) | O(degree) | **Default** — graphs are usually sparse |
| Adjacency matrix (`boolean[][]`) | O(V²) | O(1) | O(V) | Dense graphs, frequent edge queries, small V |
| Edge list (`[u, v, w][]`) | O(E) | O(E) | — | Kruskal's MST, simple storage |

```js
// Build an adjacency list from an edge list
function buildGraph(n, edges, directed = false) {
  const graph = Array.from({ length: n }, () => []);
  for (const [u, v] of edges) {
    graph[u].push(v);
    if (!directed) graph[v].push(u);
  }
  return graph;
}
```

### Core algorithms

**BFS — shortest path in an *unweighted* graph.**

```js
function shortestPath(graph, start, target) {
  const queue = [[start, 0]];
  const visited = new Set([start]);      // mark on ENQUEUE
  let head = 0;
  while (head < queue.length) {
    const [node, dist] = queue[head++];
    if (node === target) return dist;
    for (const next of graph[node]) {
      if (!visited.has(next)) { visited.add(next); queue.push([next, dist + 1]); }
    }
  }
  return -1;
}
```

**DFS — reachability, connected components, cycle detection, path enumeration.**

```js
function dfs(graph, start, visited = new Set()) {
  const stack = [start];
  while (stack.length) {
    const node = stack.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of graph[node]) if (!visited.has(next)) stack.push(next);
  }
  return visited;
}
```

**Cycle detection in a directed graph — three-colour DFS.**

```js
function hasCycle(graph, n) {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Array(n).fill(WHITE);
  const visit = (u) => {
    colour[u] = GREY;
    for (const v of graph[u]) {
      if (colour[v] === GREY) return true;          // back edge → cycle
      if (colour[v] === WHITE && visit(v)) return true;
    }
    colour[u] = BLACK;
    return false;
  };
  for (let i = 0; i < n; i++) if (colour[i] === WHITE && visit(i)) return true;
  return false;
}
```

**Topological sort (Kahn's algorithm) — ordering a DAG.**

```js
function topoSort(n, edges) {
  const graph = Array.from({ length: n }, () => []);
  const indegree = new Array(n).fill(0);
  for (const [u, v] of edges) { graph[u].push(v); indegree[v]++; }

  const queue = [];
  for (let i = 0; i < n; i++) if (indegree[i] === 0) queue.push(i);

  const order = [];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    order.push(u);
    for (const v of graph[u]) if (--indegree[v] === 0) queue.push(v);
  }
  return order.length === n ? order : null;   // null ⇒ a cycle exists
}
```

**Dijkstra — shortest path with non-negative weights, using a min-heap.** `O((V + E) log V)`.

### Complexity summary

| Algorithm | Time | Space |
|---|---|---|
| BFS / DFS | O(V + E) | O(V) |
| Topological sort | O(V + E) | O(V) |
| Dijkstra (binary heap) | O((V + E) log V) | O(V) |
| Bellman-Ford (negative weights) | O(V·E) | O(V) |
| Union-Find (near-constant, amortised) | ~O(α(n)) per op | O(V) |

### Real backend usage

- **Topological sort of a service dependency graph** to decide deploy order, or of a job DAG in a workflow engine (Airflow-style).
- Detecting circular dependencies in module imports, in database migrations, or in a permission inheritance chain — a cycle here is a production hang.
- Friend/follow recommendations ("friends of friends" = BFS depth 2).
- Access-control reachability: can this user reach this resource through any role path?
- Detecting circular references before `JSON.stringify` throws.

```ts
// Circular-dependency check for migrations or modules
const order = topoSort(n, dependencyEdges);
if (order === null) throw new Error('Circular dependency detected');
```

### Edge cases

- Disconnected graphs: loop over all vertices as potential start points, do not assume one component.
- Self-loops and parallel edges.
- Cycles without a `visited` set → infinite loop. This is the #1 graph bug.
- Negative weights break Dijkstra; use Bellman-Ford.
- A single node with no edges; an empty graph.

### Common mistakes

1. Marking visited on dequeue instead of enqueue in BFS → exponential duplicate work.
2. Forgetting that an undirected edge must be added in both directions.
3. Using DFS for shortest path in an unweighted graph (it finds *a* path, not the shortest).
4. Recursive DFS on a 10⁵-node graph → stack overflow. Use an explicit stack.
5. Not checking `order.length === n` after Kahn's algorithm, so cycles pass silently.

### Interview answer

> "I represent graphs as adjacency lists because real graphs are sparse, so it's O(V + E) space and iterating neighbours is proportional to degree. BFS gives the shortest path in an unweighted graph and DFS is for reachability, components and cycle detection — both O(V + E) with a visited set, which I mark on enqueue in BFS to avoid queuing a node twice. For weighted shortest paths I use Dijkstra with a min-heap. In backend work the case I hit most is topological sort: ordering a dependency DAG and detecting cycles, because a circular dependency in migrations or service startup is a real outage."

**Frequently asked:** BFS vs DFS — when each? · Adjacency list vs matrix · How do you detect a cycle in a directed vs undirected graph? · What is topological sort used for? · Why does Dijkstra fail with negative weights? · How would you find the shortest path between two users in a social graph?

### Practice problems

**Easy/Medium:** Number of Islands · Clone Graph · Course Schedule I & II · Pacific Atlantic Water Flow · Rotting Oranges · Word Ladder · Number of Connected Components · Graph Valid Tree · Network Delay Time (Dijkstra) · Redundant Connection (union-find)

### Production considerations

- Graph traversals over a database must be bounded — cap depth and result size, or a single request walks the whole social graph.
- Use a recursive CTE in MySQL 8+/PostgreSQL for bounded hierarchy queries rather than N round trips.
- Cache computed reachability/permission sets; recomputing on every request is expensive.
- For genuinely graph-shaped workloads at scale, consider a purpose-built store; for most products a well-indexed relational table plus caching is sufficient.

---

## 3.11 Recursion and Backtracking

**Priority: MUST KNOW (recursion) / IMPORTANT (backtracking)**

### Definition

Recursion is a technique in which a function solves a problem by calling itself on a smaller instance until it reaches a base case. Backtracking is recursion that explores candidate solutions and undoes (backtracks) a choice when it cannot lead to a valid result.

### Simple meaning

Solve a big problem by solving a smaller version of the same problem, then combining.

### Why it is needed

Trees, graphs, nested JSON, file systems and permutation problems are all naturally recursive. Backtracking is how you generate combinations, permutations and subsets — and how constraint solvers work.

### How it works internally

Each call pushes a **stack frame** holding parameters, locals and the return address. The base case stops the descent; frames then unwind in reverse. That is why space is `O(depth)`.

Node's default stack allows roughly 10,000–15,000 frames.

**Tail call optimisation is specified in ES2015 but not implemented in V8.** Do not rely on it.

### The three rules of writing recursion

1. **Base case first** — when do I stop?
2. **Make progress** — every call must move strictly toward the base case.
3. **Trust the recursion** — assume the recursive call returns the correct answer for the smaller input; do not trace the whole tree in your head.

### Syntax and shape

```js
function solve(input) {
  if (isBaseCase(input)) return baseResult;       // 1
  const smaller = reduce(input);                  // 2
  const sub = solve(smaller);                     // 3 — trust it
  return combine(input, sub);
}
```

### Small example — recursion vs memoisation vs iteration

```js
// O(2^n) — recomputes the same subproblems
const fibSlow = n => n <= 1 ? n : fibSlow(n - 1) + fibSlow(n - 2);

// O(n) — memoised (top-down DP)
function fibMemo(n, memo = new Map()) {
  if (n <= 1) return n;
  if (memo.has(n)) return memo.get(n);
  const val = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  memo.set(n, val);
  return val;
}

// O(n) time, O(1) space — iterative
function fib(n) {
  let a = 0, b = 1;
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
```

### The backtracking template (memorise this shape)

```js
function backtrack(path, choices, results) {
  if (isComplete(path)) { results.push([...path]); return; }   // copy!
  for (const choice of choices) {
    if (!isValid(path, choice)) continue;
    path.push(choice);                       // choose
    backtrack(path, nextChoices(choices, choice), results);  // explore
    path.pop();                              // un-choose (backtrack)
  }
}
```

```js
// Subsets — the simplest instance of the template
function subsets(nums) {
  const res = [], path = [];
  const dfs = (start) => {
    res.push([...path]);
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      dfs(i + 1);
      path.pop();
    }
  };
  dfs(0);
  return res;
}

// Permutations
function permute(nums) {
  const res = [], path = [], used = new Array(nums.length).fill(false);
  const dfs = () => {
    if (path.length === nums.length) { res.push([...path]); return; }
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true;  path.push(nums[i]);
      dfs();
      path.pop();      used[i] = false;
    }
  };
  dfs();
  return res;
}
```

### Converting recursion to iteration

```js
// Recursive directory walk → iterative with an explicit stack (no overflow)
function walk(rootDir, readDir) {
  const out = [], stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readDir(dir)) {
      if (entry.isDirectory) stack.push(entry.path);
      else out.push(entry.path);
    }
  }
  return out;
}
```

### Real backend usage

- Walking nested JSON to redact secrets before logging, or to validate a config tree.
- Directory traversal for a file-library service.
- Recursive permission resolution up an org tree.
- Deep-merging configuration objects.
- Generating test fixtures / combinations of feature flags.

```ts
// Redact secrets in an arbitrarily nested payload before logging
const SENSITIVE = new Set(['password', 'token', 'authorization', 'secret']);
function redact(value: unknown, depth = 0): unknown {
  if (depth > 20) return '[max depth]';                 // guard untrusted input
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) =>
        [k, SENSITIVE.has(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1)])
    );
  }
  return value;
}
```

### Edge cases

- Missing or unreachable base case → `RangeError: Maximum call stack size exceeded`.
- Cyclic structures (`a.self = a`) → infinite recursion. Track visited objects with a `WeakSet`.
- Depth proportional to input size on a 100,000-element list — convert to iteration.
- Mutable shared state across recursive branches (forgetting `path.pop()`).
- Pushing `path` instead of `[...path]` — every result becomes the same reference, ending up empty.

### Common mistakes

1. Storing a reference to the mutable path in results instead of a copy.
2. Forgetting to undo state after the recursive call.
3. Recomputing overlapping subproblems instead of memoising (`fibSlow` above).
4. Recursing over untrusted nested JSON with no depth limit — a DoS vector.
5. Assuming tail recursion is optimised in Node. It is not.

### Interview answer

> "Recursion breaks a problem into smaller instances of itself with a base case to stop. Each call costs a stack frame, so space is O(depth) and deep recursion overflows — in Node around 10,000 frames — so for unbounded depth I convert to an explicit stack. Backtracking is recursion plus undo: I choose, explore, then un-choose, which lets me enumerate subsets, permutations and constrained solutions while pruning invalid branches early."

**Frequently asked:** Recursion vs iteration — trade-offs · What causes a stack overflow? · Is tail call optimisation available in Node? · Convert a recursive function to iterative · Explain memoisation · Time complexity of naive Fibonacci and why.

### Practice problems

**Easy:** Fibonacci · Factorial · Reverse a String recursively · Sum of Digits · Power of Two · Flatten a nested array
**Medium:** Subsets I & II · Permutations I & II · Combination Sum I & II · Letter Combinations of a Phone Number · Generate Parentheses · Word Search · Palindrome Partitioning · N-Queens (classic hard-ish)

### Production considerations

- Always cap depth when recursing over client-supplied structures.
- `JSON.parse` on deeply nested input can itself blow the stack — validate payload depth and size at the edge.
- Prefer iterative implementations in hot paths; recursion has real per-frame overhead.
- Memoisation caches must be bounded and request-scoped, or they leak across requests.

---

## 3.12 Two Pointers

**Priority: MUST KNOW**

### Definition

A technique that maintains two indices moving through a data structure — from opposite ends, or at different speeds — to solve in `O(n)` what a nested loop solves in `O(n²)`.

### Simple meaning

Two fingers on the page instead of one, moving toward each other or one chasing the other.

### Why it is needed

It converts the most common `O(n²)` brute force into `O(n)` with `O(1)` extra space — often better than the hash-map solution because it uses no additional memory.

### How it works internally

**Opposite ends (requires sorted input):** the sortedness gives a decision rule — if the current sum is too small, only moving `left` right can increase it; if too large, only moving `right` left can decrease it. Each step eliminates a whole row of the n² comparison matrix.

**Fast and slow (same direction):** one pointer reads, the other writes — used for in-place filtering and deduplication.

### Pattern 1 — converging pointers on a sorted array

```js
function twoSumSorted(nums, target) {
  let left = 0, right = nums.length - 1;
  while (left < right) {
    const sum = nums[left] + nums[right];
    if (sum === target) return [left, right];
    if (sum < target) left++;
    else right--;
  }
  return [];
}
// O(n) time, O(1) space — no hash map needed because the input is sorted.
```

```js
// 3Sum — sort, then fix one element and run two pointers on the rest
function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const res = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue;          // skip duplicates
    let l = i + 1, r = nums.length - 1;
    while (l < r) {
      const sum = nums[i] + nums[l] + nums[r];
      if (sum === 0) {
        res.push([nums[i], nums[l], nums[r]]);
        while (l < r && nums[l] === nums[l + 1]) l++;
        while (l < r && nums[r] === nums[r - 1]) r--;
        l++; r--;
      } else if (sum < 0) l++;
      else r--;
    }
  }
  return res;
}
// O(n²) total — the sort is O(n log n), the outer loop × two pointers is O(n²).
```

### Pattern 2 — read/write pointers (in-place modification)

```js
function removeDuplicates(nums) {          // sorted array, in place
  if (nums.length === 0) return 0;
  let write = 1;
  for (let read = 1; read < nums.length; read++) {
    if (nums[read] !== nums[write - 1]) nums[write++] = nums[read];
  }
  return write;                            // new length
}

function moveZeroes(nums) {
  let write = 0;
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) [nums[write], nums[read]] = [nums[read], nums[write]], write++;
  }
}
```

### Pattern 3 — two pointers across two arrays

```js
function mergeSorted(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}
// O(n + m) — the merge step of merge sort, and how you merge two sorted DB result sets.
```

### How to recognise it

- The array is **sorted** (or sorting it is acceptable) and you need pairs/triplets meeting a condition.
- The problem asks for in-place modification with `O(1)` extra space.
- Palindromes, container/area problems, merging sorted inputs.
- You want to beat a hash-map solution's `O(n)` space.

### Real backend usage

- Merging sorted result sets from multiple shards or paginated sources.
- Deduplicating a sorted list of IDs in place before a bulk insert.
- Reconciling two sorted ledgers (bank statement vs internal transactions) in `O(n + m)`.
- Finding overlapping time ranges after sorting by start time.

### Edge cases

- Empty array, single element.
- `left < right` vs `left <= right` — using `<=` in converging two-pointer will let an element pair with itself.
- Duplicate values: skip them explicitly, or your result set will repeat.
- The input must actually be sorted; otherwise the decision rule is invalid.
- Integer overflow is not a JS issue below 2⁵³, but precision loss is above it — use `BigInt` if needed.

### Common mistakes

1. Applying converging two pointers to an unsorted array.
2. Forgetting to skip duplicates in 3Sum / 4Sum.
3. Off-by-one in the write pointer, returning the wrong length.
4. Advancing only one pointer when both should move after a match — infinite loop.
5. Forgetting that sorting costs `O(n log n)` and changes the original array (indices are no longer the original ones — a problem when the answer must be original indices, which is why Two Sum uses a hash map instead).

### Interview answer

> "Two pointers replaces a nested loop by exploiting structure — usually sortedness. On a sorted array, if the sum of the two ends is too small I can only improve it by moving the left pointer right, so each comparison eliminates an entire set of candidates, giving O(n) time and O(1) space. The other flavour is a read and a write pointer for in-place filtering. I choose two pointers over a hash map when the input is already sorted or when extra space is constrained; I choose a hash map when the input is unsorted and I need original indices."

**Frequently asked:** When do you use two pointers over a hash map? · Two Sum vs Two Sum II — why different solutions? · Explain fast/slow pointers for cycle detection · Remove duplicates in place.

### Practice problems

**Easy:** Valid Palindrome · Two Sum II (sorted) · Remove Duplicates from Sorted Array · Move Zeroes · Merge Sorted Array · Squares of a Sorted Array · Reverse String
**Medium:** 3Sum · 3Sum Closest · 4Sum · Container With Most Water · Sort Colours · Remove Nth Node From End of List · Trapping Rain Water (hard, two pointers)

### Production considerations

- Merging sorted streams with two pointers keeps memory `O(1)` versus loading and re-sorting everything.
- Ask whether the database can do it: `ORDER BY` on an indexed column returns sorted rows for free.
- In-place mutation of a shared array is a bug source in concurrent-ish code; clone first if the caller retains the reference.

---

## 3.13 Sliding Window

**Priority: MUST KNOW**

### Definition

A technique that maintains a contiguous sub-range (window) over a sequence, expanding and contracting it to maintain an invariant, so each element is processed a constant number of times.

### Simple meaning

A window you slide across the array, adding what enters on the right and removing what leaves on the left, instead of re-examining everything for each position.

### Why it is needed

Every "longest/shortest/maximum **contiguous** subarray or substring" problem. Brute force is `O(n²)` or `O(n³)`; a sliding window is `O(n)`.

### How it works internally

**Fixed window (size k):** compute the first window, then for each step add `arr[right]` and subtract `arr[left]` — `O(1)` per slide.

**Variable window:** expand `right` always; contract `left` while the window violates the constraint. Each index enters once and leaves once → `O(n)` total, even though there is a nested `while`.

### Fixed-size window

```js
function maxSumSubarray(nums, k) {
  if (nums.length < k) return null;
  let sum = 0;
  for (let i = 0; i < k; i++) sum += nums[i];
  let best = sum;
  for (let right = k; right < nums.length; right++) {
    sum += nums[right] - nums[right - k];    // slide: add new, drop old
    best = Math.max(best, sum);
  }
  return best;
}
```

### Variable-size window — the template

```js
function variableWindow(items) {
  let left = 0, best = 0;
  const state = new Map();                   // whatever the window needs
  for (let right = 0; right < items.length; right++) {
    // 1. expand: include items[right] in state
    while (/* window is invalid */ false) {
      // 2. contract: remove items[left] from state
      left++;
    }
    // 3. record the answer for this valid window
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

```js
// Longest substring without repeating characters
function lengthOfLongestSubstring(s) {
  const lastSeen = new Map();
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) {
      left = lastSeen.get(ch) + 1;           // jump past the duplicate
    }
    lastSeen.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
// O(n) time, O(min(n, charset)) space.
```

```js
// Minimum size subarray sum ≥ target (positive numbers)
function minSubArrayLen(target, nums) {
  let left = 0, sum = 0, best = Infinity;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];
    while (sum >= target) {
      best = Math.min(best, right - left + 1);
      sum -= nums[left++];
    }
  }
  return best === Infinity ? 0 : best;
}
```

### How to recognise it

Look for: *contiguous*, *subarray*, *substring*, *consecutive*, combined with *longest*, *shortest*, *maximum*, *minimum*, *at most k*, *exactly k*.

> **Trap:** the technique assumes expanding the window monotonically worsens or improves the constraint. With **negative numbers**, adding an element can decrease the sum, so "minimum subarray sum ≥ target" is no longer a sliding-window problem — use prefix sums plus a hash map or a monotonic deque instead.

### Real backend usage

- Sliding-window rate limiting: requests in the last 60 seconds (see §3.6).
- Rolling metrics: p95 latency over the last 5 minutes, moving averages in a monitoring endpoint.
- Anomaly detection: error rate over a rolling window triggering a circuit breaker.
- Streaming log analysis without buffering the whole file.

```ts
// Rolling average over the last N samples — O(1) per sample
class RollingAverage {
  #buf: number[]; #i = 0; #sum = 0; #count = 0;
  constructor(private size: number) { this.#buf = new Array(size).fill(0); }
  add(value: number): number {
    this.#sum -= this.#buf[this.#i];
    this.#buf[this.#i] = value;
    this.#sum += value;
    this.#i = (this.#i + 1) % this.size;
    this.#count = Math.min(this.#count + 1, this.size);
    return this.#sum / this.#count;
  }
}
```

### Edge cases

- `k > array.length` for a fixed window.
- Empty input; all elements identical; single element.
- Negative numbers invalidate the monotonicity assumption.
- "Exactly k distinct" is solved as `atMost(k) − atMost(k − 1)`.
- Window size zero when the constraint can never be satisfied.

### Common mistakes

1. Using `if` instead of `while` when contracting — the window can need multiple shrinks in one step.
2. Recording the answer at the wrong moment (before validating, or outside the loop).
3. Forgetting to remove the left element's contribution from the state map when contracting.
4. Applying a sliding window to non-contiguous ("subsequence") problems — those are DP.
5. Applying it to arrays with negative numbers without checking the monotonicity assumption.

### Interview answer

> "A sliding window maintains a contiguous range and moves its boundaries so each element is added once and removed once, giving O(n) even though the code has a nested while loop. I use it for contiguous subarray or substring problems with a longest/shortest/at-most-k constraint. The key check is monotonicity: expanding must move the constraint in one direction. With negative numbers that breaks, so I switch to prefix sums with a hash map."

**Frequently asked:** Fixed vs variable window · Why is it O(n) despite the nested loop? · When does the sliding window not work? · Longest substring without repeating characters · Sliding window maximum (monotonic deque).

### Practice problems

**Easy:** Maximum Average Subarray I · Contains Duplicate II · Find All Anagrams in a String (medium-ish)
**Medium:** Longest Substring Without Repeating Characters · Minimum Size Subarray Sum · Permutation in String · Longest Repeating Character Replacement · Fruit Into Baskets · Max Consecutive Ones III · Sliding Window Maximum · Minimum Window Substring

### Production considerations

- A time-based window is not a count-based window; decide which the business rule means (last 100 requests vs last 60 seconds).
- Ring buffers give `O(1)` memory for rolling metrics; naive arrays grow unbounded.
- Distributed rate limiting needs a shared store (Redis) — a per-process window under-counts by a factor of the instance count.

---

## 3.14 Binary Search

**Priority: MUST KNOW**

### Definition

An algorithm that finds a target in a **sorted** sequence by repeatedly halving the search interval, giving `O(log n)` time.

### Simple meaning

Guess the middle. Too high? Ignore the upper half. Repeat.

### Why it is needed

It is the only way to get sub-linear search, and the idea generalises far beyond arrays — "binary search on the answer" solves a whole class of optimisation problems. It is also conceptually how a B-tree index finds a row (Phase 6).

### How it works internally

Each comparison halves the remaining space: `n → n/2 → n/4 → … → 1`, which takes `log₂ n` steps. For a million elements that is 20 comparisons.

**Correctness hinges on three details** that interviewers deliberately probe:

1. Loop condition: `left <= right` (closed interval) vs `left < right` (half-open).
2. Midpoint: use `left + ((right - left) >> 1)` — habit from overflow-prone languages, and it reads as deliberate.
3. Boundary updates: `mid + 1` / `mid - 1` — omitting the ±1 causes an infinite loop.

### The three templates

**Template 1 — exact match**

```js
function binarySearch(nums, target) {
  let left = 0, right = nums.length - 1;
  while (left <= right) {
    const mid = left + ((right - left) >> 1);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
```

**Template 2 — leftmost boundary (lower bound)**

```js
// First index where nums[i] >= target; returns nums.length if none.
function lowerBound(nums, target) {
  let left = 0, right = nums.length;          // note: length, not length - 1
  while (left < right) {
    const mid = left + ((right - left) >> 1);
    if (nums[mid] < target) left = mid + 1;
    else right = mid;                          // keep mid as a candidate
  }
  return left;
}
```

**Template 3 — binary search on the answer** (the medium-level unlock)

When the answer space is monotonic — "if X works, every value above X works" — binary search the *answer*, not the array.

```js
// Koko eating bananas: minimum speed to finish in h hours
function minEatingSpeed(piles, h) {
  const canFinish = (speed) =>
    piles.reduce((hours, p) => hours + Math.ceil(p / speed), 0) <= h;

  let left = 1, right = Math.max(...piles);
  while (left < right) {
    const mid = left + ((right - left) >> 1);
    if (canFinish(mid)) right = mid;          // try slower
    else left = mid + 1;                       // need faster
  }
  return left;
}
```

The recipe: define a boolean predicate `isFeasible(x)` that is monotonic in `x`, then binary search for the smallest (or largest) feasible `x`.

### Real backend usage

- B-tree / B+ tree index traversal — the reason an indexed `WHERE` is fast.
- Cursor pagination boundaries and time-range queries over sorted timestamps.
- Binary searching a config threshold: the largest batch size that keeps latency under the SLO.
- Version resolution in a sorted list of migrations or releases.
- Finding the insertion point to keep a sorted in-memory index sorted.

### Edge cases

- Empty array; single element; target smaller than all / larger than all.
- Duplicates: plain binary search returns *an* index, not the first or last — use lower/upper bound.
- Rotated sorted arrays need a modified comparison (decide which half is sorted first).
- Infinite loop when `left = mid` without a `+1` in a `left < right` loop.
- Floating-point binary search needs an epsilon or a fixed iteration count, not exact equality.

### Common mistakes

1. `while (left < right)` with `left = mid` → infinite loop.
2. Using `right = nums.length - 1` with the half-open template (or vice versa).
3. Applying binary search to unsorted data.
4. Returning `mid` when the problem asks for the first or last occurrence.
5. Sorting inside the function on every call, making it `O(n log n)` per search rather than `O(log n)`.

### Interview answer

> "Binary search halves the search space each comparison, so it's O(log n) on sorted data. I'm careful about three things: whether the interval is closed or half-open, computing mid as left plus half the range, and making sure each branch strictly shrinks the interval so the loop terminates. The pattern I find most useful beyond array lookup is binary search on the answer — if a predicate is monotonic over the answer space, I binary search the smallest feasible value. That's how you solve capacity and threshold problems in O(n log range)."

**Frequently asked:** Why `left + (right - left) / 2` rather than `(left + right) / 2`? · Find first and last position of a target · Search in a rotated sorted array · Find the peak element · Square root without `Math.sqrt` · Why is binary search relevant to database indexes?

### Practice problems

**Easy:** Binary Search · Search Insert Position · First Bad Version · Sqrt(x) · Valid Perfect Square
**Medium:** Find First and Last Position · Search in Rotated Sorted Array I & II · Find Minimum in Rotated Sorted Array · Find Peak Element · Koko Eating Bananas · Capacity to Ship Packages · Split Array Largest Sum · Median of Two Sorted Arrays (hard)

### Production considerations

- Let the database binary-search for you: an index on the filtered column beats pulling rows into Node and searching there.
- Keyset (cursor) pagination uses the same idea and avoids `OFFSET`'s linear scan — `WHERE id > :lastId ORDER BY id LIMIT 20`.
- If you maintain an in-memory sorted index, insertion is `O(n)` even though search is `O(log n)`; consider whether a `Map` or a real index is better.

---

## 3.15 Sorting

**Priority: MUST KNOW (usage and complexity) / IMPORTANT (implementations)**

### Definition

Sorting arranges elements according to a comparison function. A sort is **stable** if elements comparing equal retain their original relative order, and **in-place** if it uses `O(1)` or `O(log n)` auxiliary space.

### Simple meaning

Putting things in order — and knowing which ordering algorithm costs what.

### Why it is needed

Sorting is the precondition for binary search, two pointers, greedy interval algorithms and merge-based deduplication. In backends it also determines whether a list endpoint is fast or a table scan.

### The comparison table

| Algorithm | Best | Average | Worst | Space | Stable | Notes |
|---|---|---|---|---|---|---|
| Bubble | O(n) | O(n²) | O(n²) | O(1) | Yes | Teaching only |
| Selection | O(n²) | O(n²) | O(n²) | O(1) | No | Minimises swaps |
| Insertion | O(n) | O(n²) | O(n²) | O(1) | Yes | Excellent for small or nearly sorted |
| Merge | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes | Predictable; good for linked lists and external sort |
| Quick | O(n log n) | O(n log n) | **O(n²)** | O(log n) | No | Fastest in practice; bad pivot = worst case |
| Heap | O(n log n) | O(n log n) | O(n log n) | O(1) | No | Guaranteed bound, poor cache locality |
| Counting / Radix | O(n + k) | O(n + k) | O(n + k) | O(n + k) | Yes | Non-comparison; integers in a bounded range |

**Lower bound:** any comparison-based sort needs `Ω(n log n)` comparisons in the worst case. Counting and radix sort beat it only by not comparing.

**V8's `Array.prototype.sort` is TimSort** — a hybrid of merge sort and insertion sort — and has been **stable since ES2019**.

### Implementations worth knowing

```js
// Merge sort — stable, predictable O(n log n), O(n) space
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = arr.length >> 1;
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  const out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    out.push(left[i] <= right[j] ? left[i++] : right[j++]);   // <= keeps it stable
  }
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}

// Quick sort — in place, Lomuto partition, randomised pivot
function quickSort(arr, lo = 0, hi = arr.length - 1) {
  if (lo >= hi) return arr;
  const r = lo + Math.floor(Math.random() * (hi - lo + 1));    // avoid O(n²)
  [arr[r], arr[hi]] = [arr[hi], arr[r]];
  const pivot = arr[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (arr[j] < pivot) { [arr[i], arr[j]] = [arr[j], arr[i]]; i++; }
  }
  [arr[i], arr[hi]] = [arr[hi], arr[i]];
  quickSort(arr, lo, i - 1);
  quickSort(arr, i + 1, hi);
  return arr;
}
```

### Custom comparators — what you actually write at work

```js
// Numeric — REQUIRED; the default is lexicographic
arr.sort((a, b) => a - b);

// Multi-key: status ascending, then createdAt descending
records.sort((a, b) =>
  a.status.localeCompare(b.status) ||
  b.createdAt.getTime() - a.createdAt.getTime()
);

// Locale-aware, case-insensitive, handles accents correctly
names.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true }));

// Non-mutating (ES2023)
const sorted = records.toSorted((a, b) => a.rank - b.rank);
```

A comparator must be **consistent**: return < 0, 0, or > 0, and never be random — an inconsistent comparator produces undefined ordering.

### Real backend usage

- `ORDER BY` in SQL almost always beats sorting in Node: the database can use an index and avoid transferring unsorted rows.
- Sorting before interval merging (meeting rooms, overlapping bookings) — the classic greedy precondition.
- External merge sort for files larger than memory: sort chunks, write them out, merge with a k-way heap. This is what `sort` on a large file does, and what the DB does when a sort spills to disk.
- Stable sort matters for "sort by score, keep submission order among ties".

### Edge cases

- `[10, 9, 1].sort()` → `[1, 10, 9]` because of default string comparison.
- `sort` mutates, and it sorts `undefined` values to the end regardless of the comparator.
- `NaN` in a numeric comparator produces `NaN`, which is treated as 0 — ordering becomes unpredictable. Filter or handle `NaN` first.
- Sorting objects without a comparator sorts them as `"[object Object]"` — i.e. not at all.
- Quicksort on already-sorted data with a naive first/last pivot is `O(n²)`.

### Common mistakes

1. Omitting the comparator for numbers.
2. Mutating a shared array with `sort` when the caller still needs the original order.
3. Sorting the full dataset when a top-K heap would do (`O(n log k)` vs `O(n log n)`).
4. Sorting in the application when the database could have done it with an index.
5. Assuming stability in environments older than ES2019, or assuming instability now.

### Interview answer

> "Comparison sorts are bounded below by n log n. Merge sort gives a guaranteed O(n log n) and is stable but needs O(n) extra space; quicksort is usually faster because of cache locality and in-place partitioning, but degrades to O(n²) with a bad pivot, which randomisation fixes. V8 uses TimSort, a stable merge/insertion hybrid that exploits existing runs, so nearly sorted data is close to O(n). In JavaScript the practical gotchas are that the default comparator is lexicographic and that sort mutates in place."

**Frequently asked:** Merge vs quick sort — which and why? · What is a stable sort and when does it matter? · Why is quicksort O(n²) in the worst case? · Can you sort faster than n log n? (yes, non-comparison sorts) · How do you sort data larger than memory? · What sort does JavaScript use?

### Practice problems

**Easy:** Merge Sorted Array · Sort Array By Parity · Height Checker · Majority Element
**Medium:** Sort Colours · Merge Intervals · Insert Interval · Non-overlapping Intervals · Meeting Rooms I & II · Largest Number · Sort an Array (implement merge/quick sort) · Kth Largest Element (quickselect)

### Production considerations

- Push sorting into the database when an index supports it; sorting 100,000 rows in Node blocks the event loop for tens of milliseconds.
- `ORDER BY` without a matching index causes a filesort — check `EXPLAIN` (Phase 6).
- For very large in-process sorts, chunk the work or move it to a worker thread (Phase 4.5).
- Stable sort is a contract: document when your API guarantees tie-break order.

---

## 3.16 BFS and DFS — Choosing Between Them

**Priority: MUST KNOW**

### Definition

Breadth-first search explores all nodes at distance `d` before any node at distance `d + 1`, using a queue. Depth-first search explores as far as possible along one branch before backtracking, using a stack (explicit or the call stack).

### Why they are grouped here

Trees (§3.8) and graphs (§3.10) both use them; the recurring interview skill is **choosing correctly and justifying the choice**.

### Decision table

| Requirement | Use |
|---|---|
| Shortest path, unweighted | **BFS** |
| Minimum number of steps / levels | **BFS** |
| Per-level output | **BFS** |
| Nearest match to the start | **BFS** |
| Does a path exist? | Either (DFS is simpler) |
| All paths / path enumeration | **DFS** |
| Cycle detection | **DFS** (colours) |
| Topological sort | Either (Kahn = BFS, DFS post-order) |
| Connected components | Either |
| Bottom-up aggregation (subtree sums, heights) | **DFS post-order** |
| Very deep graph, shallow answer | **BFS** (DFS may overflow) |
| Very wide graph, deep answer | **DFS** (BFS may exhaust memory) |

Both are `O(V + E)` time. Space differs: BFS holds the widest level (`O(width)`); DFS holds the deepest path (`O(depth)`).

### Grid template (islands, flood fill, rotting oranges)

```js
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

function numIslands(grid) {
  const rows = grid.length, cols = grid[0].length;
  let count = 0;

  const sink = (sr, sc) => {                 // iterative DFS — no stack overflow
    const stack = [[sr, sc]];
    grid[sr][sc] = '0';
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === '1') {
          grid[nr][nc] = '0';                // mark visited on push
          stack.push([nr, nc]);
        }
      }
    }
  };

  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c] === '1') { count++; sink(r, c); }

  return count;
}
// O(rows × cols) time and space.
```

### Multi-source BFS (underused, often the elegant answer)

Seed the queue with **all** starting points at once — "rotting oranges", "walls and gates", "nearest exit".

```js
function orangesRotting(grid) {
  const rows = grid.length, cols = grid[0].length;
  const queue = [];
  let fresh = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 2) queue.push([r, c]);
      else if (grid[r][c] === 1) fresh++;
    }

  let minutes = 0, head = 0;
  while (head < queue.length && fresh > 0) {
    const levelSize = queue.length - head;
    for (let i = 0; i < levelSize; i++) {
      const [r, c] = queue[head++];
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === 1) {
          grid[nr][nc] = 2; fresh--; queue.push([nr, nc]);
        }
      }
    }
    minutes++;
  }
  return fresh === 0 ? minutes : -1;
}
```

### Real backend usage

- BFS for "degrees of separation" and friend-of-friend suggestions, bounded to depth 2 or 3.
- DFS for validating that a permission or category hierarchy has no cycle before saving.
- BFS for shortest dependency chain between two services in a dependency graph.
- DFS post-order for computing folder sizes or rolled-up aggregates.

### Common mistakes

1. Marking visited on dequeue, not enqueue.
2. Using DFS and claiming the path found is the shortest.
3. Recursive DFS on large inputs → stack overflow.
4. Forgetting the level boundary when the answer is "how many levels".
5. Not resetting `visited` between independent searches.

### Interview answer

> "Both are O(V + E). I pick BFS when the answer is about distance or levels — shortest path in an unweighted graph, minimum steps — because the first time BFS reaches a node it has reached it by the fewest edges. I pick DFS when I need to explore full paths, detect cycles, or aggregate bottom-up. The space profiles differ: BFS holds the widest frontier, DFS holds the deepest path, so on a very deep graph I use BFS or an iterative DFS to avoid a stack overflow."

### Practice problems

Number of Islands · Max Area of Island · Flood Fill · Rotting Oranges · Walls and Gates · 01 Matrix · Word Ladder · Open the Lock · Clone Graph · Surrounded Regions · Pacific Atlantic Water Flow · Course Schedule II

---

## 3.17 Dynamic Programming — Fundamentals

**Priority: Basics IMPORTANT · Advanced DP GOOD TO KNOW for most backend roles**

### Definition

Dynamic programming solves problems that exhibit **optimal substructure** (the optimal solution is built from optimal solutions to subproblems) and **overlapping subproblems** (the same subproblems recur) by storing subproblem results instead of recomputing them.

### Simple meaning

Recursion with a notebook. Write down each answer so you never solve the same subproblem twice.

### Why it is needed

It converts exponential recursion into polynomial time. For backend roles DP appears less often than hash maps or graphs, but the basic 1-D patterns are common enough that not knowing them is a visible gap.

### How it works internally

Two directions:

- **Top-down (memoisation)** — write the natural recursion, add a cache. Easier to derive; costs stack depth.
- **Bottom-up (tabulation)** — fill a table from the base cases upward. No recursion, often allows space optimisation.

### The five-step method

1. **Define the state.** What does `dp[i]` mean, in one sentence? (This is 80% of the work.)
2. **Write the recurrence.** How does `dp[i]` follow from earlier states?
3. **Set the base cases.**
4. **Choose the iteration order** so dependencies are computed first.
5. **Optimise space** if each state depends only on a few previous ones.

### Worked example — climbing stairs

```js
// State: dp[i] = number of distinct ways to reach step i
// Recurrence: dp[i] = dp[i-1] + dp[i-2]
// Base: dp[0] = 1, dp[1] = 1

function climbStairs(n) {          // O(n) time, O(1) space
  let prev = 1, cur = 1;
  for (let i = 2; i <= n; i++) [prev, cur] = [cur, prev + cur];
  return cur;
}
```

### The core patterns

**1. Linear DP (1-D)**

```js
// House Robber — dp[i] = max loot from the first i houses
function rob(nums) {
  let take = 0, skip = 0;
  for (const n of nums) [take, skip] = [skip + n, Math.max(skip, take)];
  return Math.max(take, skip);
}
```

**2. Kadane's algorithm — maximum subarray**

```js
function maxSubArray(nums) {
  let best = nums[0], cur = nums[0];
  for (let i = 1; i < nums.length; i++) {
    cur = Math.max(nums[i], cur + nums[i]);   // extend or restart
    best = Math.max(best, cur);
  }
  return best;
}
```

**3. Unbounded knapsack / coin change**

```js
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a) dp[a] = Math.min(dp[a], dp[a - coin] + 1);
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
// O(amount × coins) time, O(amount) space
```

**4. 2-D grid DP**

```js
function uniquePaths(m, n) {
  const row = new Array(n).fill(1);
  for (let i = 1; i < m; i++)
    for (let j = 1; j < n; j++) row[j] += row[j - 1];
  return row[n - 1];
}
// O(m × n) time, O(n) space after the rolling-row optimisation
```

**5. Two-sequence DP (LCS / edit distance)** — `dp[i][j]` compares prefixes of two strings; the foundation of diffing and fuzzy matching.

### Greedy vs DP

Greedy makes a locally optimal choice and never reconsiders. It is correct only when the problem has the **greedy-choice property**. Coin change with arbitrary denominations is *not* greedy-safe ({1, 3, 4}, amount 6 → greedy gives 4+1+1 = 3 coins, optimal is 3+3 = 2 coins). If you cannot prove greedy correctness, use DP.

### Real backend usage

Honest framing: explicit DP is uncommon in CRUD backends. Where it does appear:

- Diffing algorithms (document versioning, audit trails) use LCS/edit distance.
- Fuzzy search ranking uses Levenshtein distance.
- Resource allocation and bin-packing (scheduling jobs across workers) are knapsack variants.
- Pricing and discount engines with combinable rules.
- The *habit* transfers directly to memoising expensive pure computations per request.

### Edge cases

- Empty input, `n = 0`, `amount = 0`.
- Unreachable states — use `Infinity`/`-Infinity` sentinels and check them at the end.
- Integer overflow beyond `Number.MAX_SAFE_INTEGER` — use `BigInt` for counting problems with large `n`.
- Memory: a `dp[10000][10000]` table is 10⁸ cells — roll to one or two rows.

### Common mistakes

1. Not defining the state precisely before coding — the single biggest cause of DP failure.
2. Wrong iteration order, reading states that are not computed yet.
3. Forgetting base cases.
4. Using greedy where the greedy-choice property does not hold.
5. Building a full 2-D table when a rolling row suffices.
6. Unbounded memo caches that leak across requests.

### Interview answer

> "DP applies when a problem has optimal substructure and overlapping subproblems. I start by writing the brute-force recursion, then add memoisation to get top-down DP, and convert to bottom-up tabulation if I want to avoid recursion depth or optimise space. The hard part is defining the state precisely — once I can say in one sentence what dp[i] means and how it depends on earlier states, the code follows. For example, in coin change dp[a] is the fewest coins summing to a, and dp[a] = min over coins of dp[a - coin] + 1, which is O(amount × coins)."

**Frequently asked:** Memoisation vs tabulation · How do you spot a DP problem? · Greedy vs DP · Fibonacci complexity naive vs memoised · Coin change · Longest common subsequence · 0/1 knapsack.

### Practice problems

**Easy:** Climbing Stairs · Min Cost Climbing Stairs · Fibonacci · Maximum Subarray · Best Time to Buy and Sell Stock
**Medium:** House Robber I & II · Coin Change I & II · Longest Increasing Subsequence · Unique Paths I & II · Word Break · Partition Equal Subset Sum · Longest Common Subsequence · Decode Ways · Jump Game I & II

### Production considerations

- Memoise pure, expensive functions — but bound the cache and scope it correctly (per request, or LRU with TTL).
- A DP table sized by user input is a memory-exhaustion vector; validate bounds.
- Long-running DP blocks the event loop; move it to a worker thread (Phase 4.5).

---

## 3.18 Pattern Recognition Cheat Sheet

This table is the practical output of Phase 3. In an interview, spend the first 60 seconds mapping the problem to a row.

| Signal in the problem | Likely technique |
|---|---|
| "Sorted array" | Binary search or two pointers |
| "Find a pair / triplet summing to X" | Hash map (unsorted) or two pointers (sorted) |
| "Contiguous subarray / substring" + longest/shortest | Sliding window |
| "Top K" / "K-th largest" / "K closest" | Heap of size k (or quickselect) |
| "Seen before?" / duplicates / frequency | Hash map or set |
| "Matching brackets / nesting / undo" | Stack |
| "Next greater / smaller element" | Monotonic stack |
| "Shortest path, unweighted" / "minimum steps" | BFS |
| "Shortest path, weighted, non-negative" | Dijkstra (heap) |
| "All paths" / "cycle detection" / "connected components" | DFS |
| "Dependency order" / "prerequisites" | Topological sort |
| "Level by level" | BFS with level boundaries |
| "Generate all subsets / permutations / combinations" | Backtracking |
| "Count the ways" / "min or max cost to reach" | Dynamic programming |
| "In place, O(1) extra space" | Two pointers or index arithmetic |
| "Range sum queries" | Prefix sums |
| "Intervals, overlapping, merge" | Sort by start, then sweep |
| "Linked list, find middle / cycle" | Fast and slow pointers |
| "Tree, sorted output" | In-order traversal |
| "Tree, bottom-up aggregate" | Post-order traversal |
| "String, is it a rearrangement?" | Frequency map |
| n ≤ 20, "try all possibilities" | Bitmask or backtracking |

### Complexity-driven hints

| Target complexity the constraints imply | What it usually means |
|---|---|
| O(1) | Math formula or hash lookup |
| O(log n) | Binary search or balanced tree |
| O(n) | Single pass, two pointers, sliding window, hash map |
| O(n log n) | Sort first, then linear scan; or a heap |
| O(n²) | Nested loops or 2-D DP — acceptable only for small n |

---

## 3.19 Practice Plan

**Target: 100 easy + 50 medium, solved in JavaScript or TypeScript, with complexity stated aloud for each.**

### Rules of practice

1. **Time-box.** 25 minutes for easy, 40 for medium. When the timer ends, read the solution, understand it, then close it and re-implement from scratch.
2. **Always state complexity** before you look at anyone's solution. Say it out loud.
3. **Re-solve after 7 days.** If you cannot re-derive it, you memorised instead of learning.
4. **Keep a mistake log.** One line per failure: problem, what pattern you missed, what you'll notice next time. This log is worth more than the solved count.
5. **Write the brute force first**, then optimise. Interviewers explicitly value this; jumping to a memorised optimum and failing to explain it scores worse than a clear brute-force-then-improve path.
6. **Explain while coding.** Practice narration, not silent typing.

### 10-week schedule (≈1–2 hours daily)

| Week | Focus | Target |
|---|---|---|
| 1 | Big O + arrays + strings | 15 easy |
| 2 | Hash maps + sets | 15 easy |
| 3 | Two pointers + sliding window | 10 easy, 5 medium |
| 4 | Stacks + queues | 10 easy, 5 medium |
| 5 | Binary search + sorting | 10 easy, 5 medium |
| 6 | Recursion + backtracking | 10 easy, 8 medium |
| 7 | Linked lists | 10 easy, 5 medium |
| 8 | Trees + BFS/DFS | 12 easy, 8 medium |
| 9 | Heaps + graphs | 5 easy, 8 medium |
| 10 | DP basics + mixed revision | 3 easy, 6 medium |

Adjust the pace, not the method. Consistency beats intensity.

### Weekly rhythm (mirrors the roadmap's study method)

- **Mon** — learn the pattern and its internals.
- **Tue** — implement the data structure from scratch, no copying.
- **Wed** — find where it appears in your own backend project.
- **Thu** — break your solution deliberately (empty input, huge input, duplicates) and fix it.
- **Fri** — explain two solved problems out loud in plain English, timed.
- **Sat** — one medium problem under full interview conditions.
- **Sun** — revisit the mistake log and re-solve three older problems.

---

## 3.20 How to Solve a Problem in an Interview

A repeatable 6-step script. Practice the script, not just the problems.

**1. Clarify (1–2 min).** Input types and ranges. Can the array be empty? Duplicates? Sorted? Negative numbers? Is the input mutable? What is `n` at most? Do you return a value or modify in place?

**2. Examples (1 min).** Restate one given example, then invent one edge case yourself. This alone signals seniority.

**3. Brute force out loud (2 min).** "The naive approach is a nested loop, O(n²) time, O(1) space." State it; do not code it yet.

**4. Optimise (3–5 min).** Name the bottleneck, then the pattern: "The inner loop is a search, so a hash map makes it O(1) and the whole thing O(n) with O(n) space." Get agreement before coding.

**5. Code (10–15 min).** Narrate as you go. Use clear names (`left`/`right`, `seen`, `freq`), handle the base case on line one.

**6. Verify (3 min).** Trace one normal example and one edge case by hand. State final time and space complexity. Mention one trade-off or how it would change at scale.

### Phrases that score well

- "Let me confirm the constraints before I pick an approach."
- "The brute force is O(n²); the bottleneck is the repeated search."
- "I'll trade O(n) space for O(n) time here — that's the right trade because n can be large."
- "This assumes the input is sorted. If it isn't, I'd add an O(n log n) sort, or use a hash map instead."
- "Let me trace an edge case: empty input returns 0."

### Phrases that cost you

- Silence for three minutes.
- "I've seen this one before" followed by typing a memorised solution you cannot explain.
- "It's O(n)" when there is a `sort` on line two.
- Ignoring a hint. If the interviewer says "what if the array is huge?", they are telling you the answer.

---

## Phase 3 Completion Checklist

You are ready for Phase 4 when you can, without looking anything up:

**Complexity**
- [ ] State the time and space complexity of any function you write, and justify it.
- [ ] Recite the JavaScript operation cost table (`shift` vs `pop`, `includes` vs `Set.has`).
- [ ] Infer the target complexity from the input constraint.

**Core structures**
- [ ] Explain why `shift` is O(n) and implement an O(1) queue.
- [ ] Choose between `Map`, object, `Set` and `WeakMap` and justify it.
- [ ] Implement a stack, a queue and a min-heap from scratch in TypeScript.
- [ ] Implement a singly linked list with reversal and cycle detection.
- [ ] Write all four tree traversals, recursively and iteratively for in-order.
- [ ] Represent a graph as an adjacency list and run BFS and DFS on it.

**Techniques**
- [ ] Write the two-pointer, sliding-window, binary-search and backtracking templates from memory.
- [ ] Explain when a sliding window does *not* apply.
- [ ] Binary search on the answer, not just on an array.
- [ ] Define a DP state in one sentence and derive the recurrence.
- [ ] Detect a cycle in a directed graph and produce a topological order.

**Problem solving**
- [ ] 100 easy and 50 medium problems solved in JS/TS.
- [ ] Re-solve any of your last 20 problems within the time box.
- [ ] Map an unseen problem to a pattern within 60 seconds.
- [ ] Narrate a full solution out loud in under 25 minutes.

**Backend connection**
- [ ] Explain how a hash map eliminates an N+1 query.
- [ ] Explain why an O(n²) loop is worse in Node than in a multi-threaded runtime.
- [ ] Explain why database indexes are B+ trees and what that has to do with binary search.
- [ ] Name three places a queue appears in a production backend.

---

**Next:** Phase 4 — Node.js Core (fundamentals, file system, events and networking, streams and buffers, production Node.js).

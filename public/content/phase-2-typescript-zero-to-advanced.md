# Phase 2 — TypeScript from Zero to Advanced

> **Part of:** Backend Engineering Zero-to-Expert Roadmap
> **Comes after:** Phase 1 — JavaScript from Zero to Advanced
> **Comes next:** Phase 3 — Data Structures and Problem Solving
> **Priority:** Sections 2.1 and 2.2 are **MUST KNOW**. Section 2.3 is **IMPORTANT**. Section 2.4 has no label in the roadmap, but it is treated as **MUST KNOW** here because it is how real backend code is written.

---

## Why This Phase Matters

TypeScript is JavaScript with a **type-checking layer** on top. It does not change how your program runs. It changes how many mistakes reach production.

In a real backend, TypeScript helps you with:

1. **Catching bugs early** — a wrong field name or a missing `null` check is found while you type, not when a customer hits the API.
2. **Safe refactoring** — rename a field, and the compiler shows every place that breaks.
3. **Clear contracts** — request shapes, response shapes, service inputs, and repository outputs are written down in code.
4. **Better tooling** — autocomplete and instant documentation in the editor.

> **One picture to keep in your head for the whole phase:**
> TypeScript is a **building inspector who checks the blueprint before construction starts**.
> Once the building is finished (your JavaScript is running), the inspector has gone home.
> He cannot check the customers who walk in through the door.
>
> This is the most important rule of the phase:
> **Types disappear at runtime. Data from outside your app (HTTP body, query string, database, files, other APIs) must be checked at runtime.**

---

## How To Use This Phase

Every topic follows the same 12-step order as the roadmap:

| # | Step | What you do |
|---|------|-------------|
| 1 | Proper definition | Read the exact, correct meaning |
| 2 | Simple meaning | Understand it with a real-world analogy |
| 3 | Why it is needed | Know what problem it solves |
| 4 | How it works internally | See what the compiler is doing |
| 5 | Syntax and API | Learn the exact code form |
| 6 | Small example | Run a tiny example yourself |
| 7 | Real backend usage | See where it appears in Node.js/Express work |
| 8 | Edge cases | Learn the strange behaviors |
| 9 | Common mistakes | Learn what breaks in real projects |
| 10 | Interview answer | Practice a short, clear answer |
| 11 | Practice problem | Write code without copying |
| 12 | Production considerations | Know what matters when real users depend on it |

Steps 5 and 6 are combined into one code block.

**Priority labels:** **MUST KNOW**, **IMPORTANT**, **GOOD TO KNOW**, **SKIP FOR NOW** (same meaning as in the roadmap).

**Practice rule:** type every example by hand. Then **break it on purpose** and read the compiler error. Reading error messages is a core TypeScript skill.

---

## Setup For This Phase

```bash
mkdir phase-2-ts && cd phase-2-ts
npm init -y
npm i -D typescript tsx @types/node
npx tsc --init          # creates tsconfig.json
```

| Command | What it does |
|---------|--------------|
| `npx tsc --noEmit` | Only **checks** types, writes no files (use this all the time) |
| `npx tsc` | Checks and **compiles** `.ts` to `.js` (to the `outDir`) |
| `npx tsx src/index.ts` | Runs a TypeScript file directly (fast, for development) |

> `tsx` runs your code but **does not type-check** it. Always use `tsc --noEmit` (or your editor) for checking.

Use a folder per section: `2.1`, `2.2`, `2.3`, `2.4`. Turn on `"strict": true` from day one (see 2.3.8).

---

## Phase 2 Map and Time Guide

| Section | Topic | Priority | Rough time (1–2 hrs/day) |
|---------|-------|----------|--------------------------|
| 2.1 | TypeScript Fundamentals | MUST KNOW | ~1 week |
| 2.2 | Functions and Object Modeling | MUST KNOW | ~1 week |
| 2.3 | Advanced TypeScript | IMPORTANT | ~1.5 weeks |
| 2.4 | TypeScript Backend Standards | MUST KNOW | ~1.5 weeks |
| — | Phase 2 capstone project + revision | MUST KNOW | ~1 week |

The time is a guide, not a rule. If a section feels easy, do its practice tasks first. If you finish them without help, move on.

---

## Table of Contents

- [2.1 TypeScript Fundamentals](#21-typescript-fundamentals)
- [2.2 Functions and Object Modeling](#22-functions-and-object-modeling)
- [2.3 Advanced TypeScript](#23-advanced-typescript)
- [2.4 TypeScript Backend Standards](#24-typescript-backend-standards)
- [Phase 2 Capstone Project](#phase-2-capstone-project--typed-training-sessions-api)
- [Phase 2 Interview Question Bank](#phase-2-interview-question-bank)
- [Phase 2 Exit Checklist](#phase-2-exit-checklist)

---

# 2.1 TypeScript Fundamentals

**Priority: MUST KNOW**

**Goal:** Understand what TypeScript is, how it thinks, and write basic typed code without fighting the compiler.

**Topics in this section:** why TypeScript exists → type inference and primitive types → arrays and tuples → enums and alternatives → `any`, `unknown`, `never`, `void` → union and intersection types → type aliases, interfaces, optional and `readonly` properties.

---

## 2.1.1 Why TypeScript Exists

1. **Definition** — TypeScript is a **superset of JavaScript** that adds a **static type system**. You write `.ts` files, the **compiler (`tsc`)** checks the types, and then it removes them and produces plain JavaScript.
2. **Simple meaning** — TypeScript is a **spell-checker for your program's logic**. It underlines mistakes before you press "send."
   Or think of an **airport security check**: it happens *before* the flight. Once you are in the air (runtime), the check is finished.
3. **Why it is needed** — JavaScript only tells you about a mistake when that line **runs**. In a big backend, that might be at 3 AM in production. TypeScript finds many such mistakes while you write.
4. **How it works internally**
   - The compiler reads your code and builds a model of every value's type.
   - It reports errors where the types do not match.
   - It then **erases all type information** and writes JavaScript. Nothing about types exists in the final `.js` file.
   - Valid JavaScript is valid TypeScript. You can adopt it step by step.
5. **Syntax and API + 6. Small example**

```ts
// src/greet.ts
function greet(name: string): string {
  return `Hello ${name}`;
}

greet("Asha");   // OK
greet(42);       // Error: Argument of type 'number' is not assignable to parameter of type 'string'.

// After compiling, the .js output is only:
// function greet(name) { return `Hello ${name}`; }
```

7. **Real backend usage** — Almost every professional Node.js backend today (including NestJS-style codebases) is written in TypeScript. Types describe request bodies, database rows, service inputs, and error shapes.
8. **Edge cases**
   - Type errors do not stop the JavaScript from being produced by default (unless `noEmitOnError` is on). The program can still run with a type error.
   - Types are **not** a runtime check. `name: string` does not stop someone from sending a number in a JSON body.
9. **Common mistakes** — Thinking TypeScript validates incoming data at runtime. Silencing errors with `any` or `as` instead of understanding them. Running with `tsx` and never running `tsc --noEmit`.
10. **Interview answer** — "TypeScript is JavaScript with a static type system. The compiler checks types before the code runs, then removes them and outputs normal JavaScript. It catches mistakes early and makes refactoring safe, but it does not check data at runtime."
11. **Practice problem** — Take a small JavaScript utility (for example `formatPrice`) and rename the file to `.ts`. Fix every error the compiler reports. Then look at the compiled `.js` and find what disappeared.
12. **Production considerations** — Run `tsc --noEmit` in your CI pipeline so type errors block a merge. Treat type errors like failing tests.

---

## 2.1.2 Type Inference and Primitive Types

1. **Definition** — **Type inference** is the compiler working out a type by itself from the value you gave. **Primitive types** are the basic value types: `string`, `number`, `boolean`, `bigint`, `symbol`, `null`, `undefined`.
2. **Simple meaning** — Inference is a **smart assistant who guesses correctly from context**. If you hand him a number, he writes "number" on the box. You only write labels yourself when he cannot guess, or when you want a stricter promise.
3. **Why it is needed** — Without inference, you would write a type on every line. With it, you write types where they matter (function boundaries) and let the compiler fill in the rest.
4. **How it works internally** — For `let`, TypeScript widens the type (`let x = 5` is `number`). For `const`, it keeps the exact literal (`const x = 5` is the type `5`). For function return values, it looks at what you return.
5. **Syntax and API + 6. Small example**

```ts
let count = 5;              // number
count = "five";             // Error

const role = "admin";       // type is the literal "admin"
let ids = [1, 2, 3];        // number[]
const user = { name: "Asha", age: 25 };   // { name: string; age: number }

// Explicit annotations
let title: string = "Backend";
let isActive: boolean = true;
let big: bigint = 9007199254740993n;

// Functions: annotate parameters, let the return type be inferred (or annotate it too)
function add(a: number, b: number) {
  return a + b;              // return type inferred as number
}

// Use lowercase primitive types, never String / Number / Boolean
let good: string = "x";
```

7. **Real backend usage** — A good habit: **annotate function parameters and exported function return types**, and let inference handle local variables.
8. **Edge cases**
   - `let x;` with no value gives an implicit `any` (a hole in your safety).
   - `null` and `undefined` are separate types. With `strictNullChecks` (part of `strict`), `string` does **not** include `null`.
   - Inference of an empty array (`const list = []`) can become `any[]`, so annotate it: `const list: string[] = []`.
   - `object`, `Object`, and `{}` are different, and confusing. Prefer a real shape or `Record<string, unknown>`.
9. **Common mistakes** — Writing `String` (the wrapper object type) instead of `string`. Adding useless annotations everywhere. Not annotating an empty array or an empty object.
10. **Interview answer** — "Type inference means the compiler works out types from values, so I do not have to write them everywhere. I annotate function parameters and public return types, and let inference handle the rest. With `const`, TypeScript keeps the exact literal type; with `let`, it widens it."
11. **Practice problem** — Hover over 10 variables in your editor and predict each type before looking. Write a function with no annotations and see what breaks under `strict`.
12. **Production considerations** — Annotate the return type of exported functions. It makes the contract explicit and catches accidental changes when the implementation changes.

---

## 2.1.3 Arrays and Tuples

1. **Definition** — An **array type** describes a list of items of the same type (`number[]`). A **tuple** is an array with a **fixed length and a specific type at each position**.
2. **Simple meaning** — An array is a **shelf of identical jars**. A tuple is a **train ticket with fixed boxes**: box 1 is the seat number, box 2 is the passenger name. The order and meaning of each box are fixed.
3. **Why it is needed** — Arrays are everywhere. Tuples are used when a function returns several values of different types in a fixed order.
4. **How it works internally** — `T[]` and `Array<T>` mean the same thing. `readonly T[]` blocks methods that change the array (like `push`) at compile time.
5. **Syntax and API + 6. Small example**

```ts
const ids: number[] = [1, 2, 3];
const names: Array<string> = ["Asha", "Ravi"];
const locked: readonly number[] = [1, 2, 3];
// locked.push(4);                 // Error: 'push' does not exist on type 'readonly number[]'

// Tuples
const pair: [string, number] = ["age", 30];
type Range = [start: number, end: number];     // named tuple elements (clearer)
const range: Range = [1, 10];
const [start, end] = range;                    // destructuring keeps the types

// Tuples with optional and rest parts
type Row = [id: number, name: string, tags?: string[]];
type Log = [level: string, ...messages: string[]];

// Promise.all gives you a typed tuple
const [user, orders] = await Promise.all([getUser(1), getOrders(1)]);
// `user` and `orders` each keep their own type
```

7. **Real backend usage** — `Promise.all` results, database drivers returning `[rows, fields]`, and small fixed-shape returns like `[value, error]`.
8. **Edge cases** — A normal (non-`readonly`) tuple still allows `push` at compile time (a known gap). Use `readonly [string, number]` for a safer tuple. Reading an out-of-range index of a tuple is a compile error, but for a normal array it is not (unless `noUncheckedIndexedAccess` is on).
9. **Common mistakes** — Using a tuple when a small object with named fields would be clearer. Forgetting that `arr[0]` may be `undefined` at runtime, even if the type says otherwise.
10. **Interview answer** — "An array type is a list of the same type. A tuple has a fixed length and a specific type at each position, like `[string, number]`. I use tuples for small fixed results, and objects when I need named fields."
11. **Practice problem** — Write a function `minMax(nums: number[]): [min: number, max: number]`. Then write `parsePair(text: string): [key: string, value: string]`.
12. **Production considerations** — Prefer objects over tuples in public APIs, because names are self-documenting. Turn on `noUncheckedIndexedAccess` to make `arr[i]` include `undefined`.

---

## 2.1.4 Enums and Their Alternatives

1. **Definition** — An **enum** is a set of named constants. It is one of the few TypeScript features that **creates real JavaScript code** at runtime. Alternatives are **string literal unions** and **`as const` objects**, which have no runtime cost.
2. **Simple meaning** — A **fixed menu** at a restaurant. You can order only items from the menu, not anything you like.
3. **Why it is needed** — Fields like `status`, `role`, or `paymentMethod` should only have a few allowed values. This stops typos like `"actve"`.
4. **How it works internally** — A numeric enum becomes an object with two-way mapping (name to number, and number to name). A string enum becomes a plain object. A union of literals produces **no** JavaScript at all.
5. **Syntax and API + 6. Small example**

```ts
// 1) Numeric enum (avoid: numbers are hard to read in logs and databases)
enum Level { Low, Medium, High }        // 0, 1, 2

// 2) String enum
enum Role { Admin = "ADMIN", User = "USER" }
const r: Role = Role.Admin;

// 3) String literal union (simple, very common)
type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";
let s: OrderStatus = "paid";
// s = "payed";                         // Error: typo caught

// 4) `as const` object: one source of truth for values AND types
const STATUS = {
  Pending: "PENDING",
  Paid: "PAID",
} as const;
type Status = (typeof STATUS)[keyof typeof STATUS];   // "PENDING" | "PAID"

// 5) `as const` array: values for runtime, type for compile time
const ROLES = ["admin", "editor", "viewer"] as const;
type RoleName = (typeof ROLES)[number];               // "admin" | "editor" | "viewer"
function isRole(x: string): x is RoleName {
  return (ROLES as readonly string[]).includes(x);
}
```

7. **Real backend usage** — Order status, user roles, event names, error codes. The `as const` array is very useful: you can **loop over it at runtime** (for validation) and **use it as a type** at the same time.
8. **Edge cases**
   - Numeric enums are loosely checked. In older TypeScript versions, any number could be assigned to one.
   - `const enum` can cause problems with some build tools. Avoid it.
   - Some tools that only *remove* types (without compiling) do not support enums. Literal unions and `as const` objects work everywhere.
   - A string enum member is not assignable from a plain string. You must use the enum or convert.
9. **Common mistakes** — Using numeric enums that get stored in a database (numbers change meaning if you reorder them). Writing the same list twice, once as a type and once as an array.
10. **Interview answer** — "An enum is a set of named constants and it creates runtime code. Many teams prefer string literal unions or `as const` objects, because they add no runtime code and work with any tool. I use an `as const` array when I need the same list both for validation at runtime and as a type."
11. **Practice problem** — Model `OrderStatus` three ways (string enum, literal union, `as const` object). Write `isOrderStatus(value: unknown)` for one of them and use it to validate a query parameter.
12. **Production considerations** — Store readable strings (`"PAID"`) in the database, not enum numbers. Keep one source of truth for allowed values, and derive the type from it.

---

## 2.1.5 `any`, `unknown`, `never`, `void`

1. **Definition**
   - **`any`** turns type checking **off** for a value.
   - **`unknown`** is the **safe** version of "I do not know the type yet." You must check it before use.
   - **`never`** is the type of something that **can never happen** (a function that always throws, or an impossible branch).
   - **`void`** is the return type of a function that returns **nothing useful**.
2. **Simple meaning**
   - `any` = **switching off the building inspector**. Anything goes, and problems return at runtime.
   - `unknown` = a **sealed parcel**. You may hold it, but you must open it and check what is inside before using it.
   - `never` = a **road that leads nowhere**. Nothing ever arrives from it.
   - `void` = **a worker who finishes the job but hands back nothing**.
3. **Why it is needed** — Data sometimes has an unknown shape (JSON, `catch` errors, third-party responses). `unknown` lets you say "I do not know yet" and stay safe. `never` helps the compiler prove you handled every case.
4. **How it works internally** — Anything can be assigned **to** `unknown`, but nothing can be **used** from it until you narrow it (with `typeof`, `instanceof`, or a check function). `any` skips all checks, and it **spreads**: anything touched by `any` often becomes `any` too. Under `strict`, the variable in `catch (err)` is `unknown`.
5. **Syntax and API + 6. Small example**

```ts
// any: no safety at all
let a: any = "hello";
a.foo.bar();                    // compiles, then crashes at runtime

// unknown: must check before use
let u: unknown = JSON.parse('{"name":"Asha"}');
// u.name;                      // Error: 'u' is of type 'unknown'
if (typeof u === "object" && u !== null && "name" in u) {
  console.log((u as { name: unknown }).name);
}

// catch variable is unknown under strict
try {
  riskyCall();
} catch (err) {
  if (err instanceof Error) console.error(err.message);
  else console.error("Unknown error", err);
}

// never: a function that never returns normally
function fail(message: string): never {
  throw new Error(message);
}

// void: returns nothing useful
function logLine(text: string): void {
  console.log(text);
}

// Type assertion (`as`): you tell the compiler "trust me". Use rarely.
const el = JSON.parse(text) as { id: number };   // NOT checked at runtime!
```

7. **Real backend usage** — Use `unknown` for parsed JSON, request bodies, and caught errors, then **validate or narrow**. Use `never` for exhaustive `switch` checks (see 2.3.6).
8. **Edge cases**
   - `as` does not convert or check anything. It only silences the compiler.
   - `value!` (non-null assertion) tells the compiler "this is not null." If you are wrong, it crashes at runtime.
   - `void` as a callback return type means "the return value is ignored," so a callback returning something is still allowed.
   - `never` is assignable to everything, but nothing is assignable to `never`.
9. **Common mistakes** — Using `any` to make an error disappear. Treating `as SomeType` as a validation. Using `!` everywhere.
10. **Interview answer (any vs unknown)** — "`any` disables type checking, so bugs come back at runtime. `unknown` also accepts any value, but I must narrow it with a check before I can use it. So `unknown` is safe and `any` is not. I use `unknown` for external data and validate it."
11. **Practice problem** — Write `safeParse(text: string): unknown` and then a function that narrows the result to `{ id: number; name: string }` without using `as`. Write an `assertNever(x: never): never` helper.
12. **Production considerations** — Turn on ESLint rules `@typescript-eslint/no-explicit-any` and `no-non-null-assertion`. If you must use `any`, leave a comment with the reason, and keep it in the smallest possible place.

---

## 2.1.6 Union and Intersection Types (and Literal Types)

1. **Definition**
   - A **union** (`A | B`) means the value is **either A or B**.
   - An **intersection** (`A & B`) means the value is **both A and B at the same time**.
   - A **literal type** is an exact value as a type, like `"GET"` or `200`.
2. **Simple meaning**
   - Union = **"pay by card OR UPI"** — one of the options.
   - Intersection = **a person who is both a driver AND a mechanic** — has the skills of both.
   - Literal = **"only this exact word is allowed."**
3. **Why it is needed** — Real data is often "one of several shapes" (a success or an error, a string or a number). Intersections let you build big types from small pieces.
4. **How it works internally** — For a union, the compiler only lets you use members that are **common** to all options, until you **narrow** the type (with `typeof`, `in`, `===`, and so on). For an intersection, the result has **all** members of both types.
5. **Syntax and API + 6. Small example**

```ts
type Id = string | number;

function formatId(id: Id): string {
  if (typeof id === "string") return id.toUpperCase();   // narrowed to string
  return id.toFixed(0);                                   // narrowed to number
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type StatusCode = 200 | 201 | 400 | 404 | 500;

// Nullable value
type MaybeUser = User | null;

// Intersection: combine small pieces
type Timestamps = { createdAt: Date; updatedAt: Date };
type SoftDelete = { deletedAt: Date | null };
type UserRow = { id: number; email: string } & Timestamps & SoftDelete;

// Function that accepts a single item or a list
function toArray<T>(input: T | T[]): T[] {
  return Array.isArray(input) ? input : [input];
}
```

7. **Real backend usage** — `string | undefined` for optional query values. `Success | Failure` results. Combining shared field groups (`Timestamps`, `SoftDelete`) into many table types.
8. **Edge cases**
   - Intersecting two object types with the same property but different types can produce `never` for that property.
   - `string & number` is `never`.
   - Unions of object types can have overlapping fields, which is why a **discriminant** field (see 2.3.6) is helpful.
9. **Common mistakes** — Trying to use a member that only exists on one side of a union without narrowing. Using intersections where a union is meant. Very large unions of loose strings that should be a single named type.
10. **Interview answer** — "A union means one of several types, and I narrow it before using type-specific members. An intersection means all types at once, and I use it to combine small object types. Literal types let me restrict a value to exact allowed strings or numbers."
11. **Practice problem** — Type a function `parseLimit(input: string | number | undefined): number` that returns a safe default. Build `UserRow` from three small intersected types and try to create an object that is missing a field.
12. **Production considerations** — Name important unions (`OrderStatus`, `HttpMethod`) once and reuse them, so a change in one place updates everything.

---

## 2.1.7 Type Aliases, Interfaces, Optional and `readonly` Properties

1. **Definition**
   - A **type alias** (`type`) gives a name to any type.
   - An **interface** describes the **shape of an object** and can be extended.
   - **Optional properties** (`?`) may be missing. **`readonly`** properties cannot be re-assigned after creation (compile-time only).
2. **Simple meaning** — An interface is a **job description or a contract**: "anyone who wants this role must have these skills." Optional means "nice to have." `readonly` means **"written in pen, not in pencil."**
3. **Why it is needed** — Named object shapes are the core of typed code: request bodies, database rows, service inputs.
4. **How it works internally** — TypeScript uses **structural typing**: an object matches a type if it has the **required shape**, no matter what it is called ("if it walks like a duck..."). `readonly` and `?` are checked only at compile time.
5. **Syntax and API + 6. Small example**

```ts
interface User {
  readonly id: number;        // cannot be changed after creation
  name: string;
  email?: string;             // optional: string | undefined
}

const u: User = { id: 1, name: "Asha" };
// u.id = 2;                  // Error: read-only property

// Extending
interface Admin extends User {
  permissions: string[];
}

// Type alias: can name anything
type Point = { x: number; y: number };
type ID = string | number;
type Callback = (err: Error | null, data?: string) => void;

// Structural typing: no "implements" needed
interface HasName { name: string }
function hello(x: HasName) { return `Hi ${x.name}`; }
const ravi = { name: "Ravi", age: 30 };
hello(ravi);                                   // OK: extra fields are fine on a variable...
// hello({ name: "Ravi", age: 30 });           // ...but a fresh object literal gets an "excess property" error

// Declaration merging (interfaces only): two declarations combine
interface Settings { theme: string }
interface Settings { language: string }
// Settings now has both fields
```

7. **Real backend usage** — `interface` or `type` for DTOs, database row types, and service contracts (see 2.4). Optional fields for PATCH updates. `readonly` for IDs and created-at fields.
8. **Edge cases**
   - **`interface` vs `type`:** both describe objects. Only `interface` supports declaration merging. Only `type` can name unions, tuples, and mapped/conditional types.
   - `readonly` is shallow, and it is erased at runtime. Nothing stops JavaScript code from changing the field.
   - An optional property means the value may be `undefined`. Handle it.
   - A fresh object literal is checked for extra properties. A variable is not.
9. **Common mistakes** — Making everything optional "to make the error go away." Thinking `readonly` protects the value at runtime. Debating `type` vs `interface` for hours instead of picking one rule.
10. **Interview answer (interface vs type)** — "Both can describe an object shape. `interface` can be extended and merged across declarations, and gives clean error messages. `type` can also name unions, tuples, and computed types. My rule: `interface` for public object contracts that may be extended, and `type` for everything else. The most important thing is to stay consistent."
11. **Practice problem** — Define `CreateUserRequest`, `UpdateUserRequest` (all fields optional), and `UserResponse` (no password field). Show that a normal object passes the check without any `implements`.
12. **Production considerations** — Keep request types, response types, and database types **separate**, so a database change does not accidentally leak into your public API (more in 2.4).

---

## 2.1 Practice Projects

- **Convert a JavaScript utility file** from Phase 1 (your `debounce`, `memoize`, `retry`, or `mapWithLimit`) into TypeScript, with `strict` on and zero `any`.
- **Typed status model:** `OrderStatus` as an `as const` array, with a runtime `isOrderStatus` guard and a derived type.
- **Typed API shapes:** write request and response types for a small "users" API (create, update, list, get).

**2.1 is done when you can:**
- [ ] Explain what TypeScript does and what it does **not** do
- [ ] Explain `any` vs `unknown` with an example
- [ ] Choose between `type`, `interface`, enum, and literal union, and say why
- [ ] Read a basic compiler error and fix it without using `any`

---

# 2.2 Functions and Object Modeling

**Priority: MUST KNOW**

**Goal:** Type functions properly, write reusable generic code, and model real objects and lookups safely.

**Topics in this section:** parameter and return types → optional parameters → overloads → generic functions → generic interfaces and constraints → index signatures → `keyof` → `typeof` → indexed access types.

---

## 2.2.1 Function Parameter Types, Return Types and Optional Parameters

1. **Definition** — A function's **type** is made of its parameter types and its return type. A parameter can be **optional** (`?`), have a **default value**, or be a **rest** parameter. An `async` function always returns `Promise<T>`.
2. **Simple meaning** — A function type is a **recipe card with a strict ingredient list and a promised dish**: "give me these things, and I promise you this result."
3. **Why it is needed** — Function boundaries are where bugs enter: wrong argument order, missing arguments, wrong return values. Typing the boundary catches all of them.
4. **How it works internally** — The compiler checks every call against the parameter list, and checks every `return` against the declared return type. An optional parameter has type `T | undefined`. A parameter with a default value is automatically optional for callers.
5. **Syntax and API + 6. Small example**

```ts
type Role = "admin" | "editor" | "viewer";

function createUser(name: string, age?: number, role: Role = "viewer") {
  return { name, age, role };        // age is number | undefined
}
createUser("Asha");
createUser("Ravi", 30, "admin");
// createUser("X", "30");            // Error: string is not assignable to number

// Rest parameters
function sum(...nums: number[]): number {
  return nums.reduce((total, n) => total + n, 0);
}

// Object parameter (better than many positional parameters)
function listOrders(opts: { page?: number; limit?: number; status?: string } = {}) {
  const { page = 1, limit = 20 } = opts;
  return { page, limit };
}

// Function types and callbacks
type Handler = (input: string) => Promise<void>;
type Callback = (err: Error | null, data?: string) => void;

// Async functions return Promise<T>
async function getUser(id: number): Promise<User | null> {
  const row = await db.findUser(id);
  return row ?? null;
}

// Explicit return type on exported functions
export function toSlug(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "-");
}
```

7. **Real backend usage** — Controller and service functions with typed inputs and `Promise<Result>` outputs. An **options object** with optional fields for functions that would otherwise have many parameters.
8. **Edge cases**
   - A required parameter cannot come after an optional one.
   - A callback typed to return `void` may still return a value. The value is just ignored by the caller.
   - Without an annotation, an `async` function's return type is inferred, and an accidental change in the body can change the public return type.
   - A function that returns `undefined` in some branches and a value in others has return type `T | undefined`. Callers must handle that.
9. **Common mistakes** — Returning `Promise<any>`. Writing `function f(cb: Function)` (loses all information; write the real signature). Not annotating exported return types.
10. **Interview answer** — "I annotate parameters and the return type of exported functions. Optional parameters and default values make an argument optional for callers. `async` functions return `Promise<T>`. For functions with many inputs I use one options object with named fields."
11. **Practice problem** — Type these: `paginate(items, page, limit)`, `retry(fn, options)`, and a callback-style `readConfig(path, cb)`. Then convert `readConfig` to a `Promise`-returning function.
12. **Production considerations** — Explicit return types on exported functions act like a contract test at compile time. A change that alters the shape breaks the build, not a customer.

---

## 2.2.2 Function Overloads

1. **Definition** — **Overloads** let one function have **several call signatures**, each with its own input and output types, with **one implementation** underneath.
2. **Simple meaning** — A shop counter with **two signs**: "Give a single ID, get one item" and "Give a list of IDs, get a list of items." It is one counter and one worker, but two clear promises.
3. **Why it is needed** — Sometimes the return type depends on the input type. A plain union would force callers to check the result every time.
4. **How it works internally** — You write the overload signatures (no body), then one **implementation signature** that is broad enough to cover all of them. **Callers only see the overload signatures.** The implementation signature is hidden. The compiler picks the first overload that matches the call.
5. **Syntax and API + 6. Small example**

```ts
const users: User[] = [];

function findUsers(id: number): User | undefined;
function findUsers(ids: number[]): User[];
function findUsers(input: number | number[]): User | User[] | undefined {
  return Array.isArray(input)
    ? users.filter((u) => input.includes(u.id))
    : users.find((u) => u.id === input);
}

const one = findUsers(1);          // User | undefined
const many = findUsers([1, 2]);    // User[]
// findUsers("1");                 // Error: no overload matches
```

7. **Real backend usage** — Utility functions such as `toArray`, `getHeader`, or a `query` helper whose return type depends on an option. Also seen a lot in library typings.
8. **Edge cases** — Put the **most specific** overload first. The implementation signature must be compatible with every overload. Too many overloads are hard to read and to maintain.
9. **Common mistakes** — Thinking the implementation signature is callable from outside. Using overloads when a **generic** or a **union** would be simpler.
10. **Interview answer** — "Overloads give one function several typed call signatures, with one implementation. Callers see only the overload signatures. I use them only when the return type really depends on the input type; otherwise I prefer generics or unions."
11. **Practice problem** — Write `getHeader(name: string): string | undefined` and `getHeader(name: string, fallback: string): string`, then implement it once.
12. **Production considerations** — Keep overloads rare and well-tested. If you need more than 3, redesign into separate, clearly named functions.

---

## 2.2.3 Generic Functions

1. **Definition** — A **generic function** uses a **type parameter** (like `T`) as a placeholder for a type that is decided when the function is **called**.
2. **Simple meaning** — A generic function is a **reusable box with a label slot**. You can put apples in it, and it becomes an "apple box." You put books in it, and it becomes a "book box." The box code is written once, and the compiler remembers what went in.
3. **Why it is needed** — Without generics, you must write the same function for each type, or use `any` and lose safety.
4. **How it works internally** — At each call, the compiler **infers** `T` from the arguments. The output type then uses that same `T`, so the relationship between input and output is kept. Generics exist **only at compile time**. They are erased.
5. **Syntax and API + 6. Small example**

```ts
function first<T>(items: T[]): T | undefined {
  return items[0];
}
const n = first([1, 2, 3]);            // number | undefined
const s = first(["a", "b"]);           // string | undefined

// Two type parameters, one related to the other
function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = obj[key];
  return out;
}
const publicUser = pick({ id: 1, name: "Asha", password: "x" }, ["id", "name"]);
// type: { id: number; name: string }

// groupBy: a reusable data helper
function groupBy<T, K extends PropertyKey>(
  items: T[],
  getKey: (item: T) => K
): Partial<Record<K, T[]>> {
  const result: Partial<Record<K, T[]>> = {};
  for (const item of items) {
    const key = getKey(item);
    (result[key] ??= []).push(item);
  }
  return result;
}

// Generic default
async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  return (await res.json()) as T;   // WARNING: this cast is NOT checked at runtime
}
```

7. **Real backend usage** — Reusable helpers (`groupBy`, `pick`, `retry<T>`, `withTimeout<T>`), typed wrappers around `fetch`, and generic response or pagination types (see 2.2.4).
8. **Edge cases**
   - You can pass the type explicitly, `first<number>([1])`, but inference usually does it for you.
   - A generic that is used only once in a signature is often not needed.
   - `fetchJson<User>(url)` **looks** safe but is a lie: nothing checks that the server really sent a `User` (see 2.3.9).
9. **Common mistakes** — Naming everything `T` when several parameters exist (use meaningful names like `TItem`, `TKey`). Using a generic where a simple type would do. Trusting `as T` on external data.
10. **Interview answer** — "A generic function has type parameters so the same code works for many types and still keeps the relationship between input and output. The compiler infers the type at each call. Generics are erased at runtime, so they do not validate data."
11. **Practice problem** — Write `withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>`, `unique<T>(items: T[]): T[]`, and `indexBy<T, K extends keyof T>(items: T[], key: K): Map<T[K], T>`.
12. **Production considerations** — Generics should make code **easier** to use. If a reader needs 5 minutes to understand a signature, simplify it.

---

## 2.2.4 Generic Interfaces and Constraints

1. **Definition** — **Generic interfaces and classes** take type parameters just like functions. A **constraint** (`extends`) limits what types are allowed for the parameter.
2. **Simple meaning** — A generic interface is a **template for a form** — "Paginated list of ___." A constraint is a rule on the template: "the ___ must **have a handle**." You can put anything in the box, as long as it has a handle.
3. **Why it is needed** — Backend code repeats the same shapes with different data: API responses, paginated lists, repositories. Generics remove the duplication and keep the types exact.
4. **How it works internally** — `T extends { id: number }` means "T must be assignable to `{ id: number }`." Inside the function or class, the compiler lets you use `id`, because it is guaranteed.
5. **Syntax and API + 6. Small example**

```ts
// Generic response and pagination types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

const res: ApiResponse<Paginated<User>> = {
  success: true,
  data: { items: [], page: 1, limit: 20, total: 0 },
};

// Constraint: T must have an id
function getIds<T extends { id: number }>(items: T[]): number[] {
  return items.map((item) => item.id);
}

// Generic repository interface + an in-memory implementation
interface Repository<T extends { id: number }> {
  findById(id: number): Promise<T | undefined>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: number): Promise<boolean>;
}

class InMemoryRepository<T extends { id: number }> implements Repository<T> {
  private readonly store = new Map<number, T>();

  async findById(id: number) { return this.store.get(id); }
  async findAll()            { return [...this.store.values()]; }
  async save(entity: T)      { this.store.set(entity.id, entity); return entity; }
  async delete(id: number)   { return this.store.delete(id); }
}

const userRepo = new InMemoryRepository<User>();
```

7. **Real backend usage** — `ApiResponse<T>` and `Paginated<T>` for every endpoint. `Repository<T>` and `Service<T>` base contracts. The in-memory repository is very useful for **unit tests**, where you replace the real database.
8. **Edge cases** — Constraints can refer to other type parameters (`K extends keyof T`). A generic class's type parameter is not available in `static` members. Default type parameters (`<T = unknown>`) make a generic optional to specify.
9. **Common mistakes** — Making an `Entity` constraint too strict (so tests and simple types cannot use it). Creating a giant generic base repository that tries to do everything.
10. **Interview answer** — "Generic interfaces let me write a shape once, like `Paginated<T>`, and reuse it for any item type. A constraint like `T extends { id: number }` says what T must at least look like, so I can safely use `id` inside the code."
11. **Practice problem** — Build `Paginated<T>` and a function `paginate<T>(items: T[], page: number, limit: number): Paginated<T>`. Build `InMemoryRepository<T>` and use it for both `User` and `Product`.
12. **Production considerations** — A small, focused repository interface is easy to fake in tests. Keep generic base classes thin, and put business rules in services, not in generic repositories.

---

## 2.2.5 Index Signatures

1. **Definition** — An **index signature** describes an object whose **keys are not known in advance**, but whose keys and values follow a pattern: `{ [key: string]: number }`.
2. **Simple meaning** — A **phone book**. You do not know every name ahead of time, but you know that every name is a string and every entry is a phone number.
3. **Why it is needed** — Dictionaries, header maps, translations, and counters have dynamic keys.
4. **How it works internally** — Any property you read with a string key gets the declared value type. `Record<K, V>` is a shortcut for the same idea. When a key type is a **literal union**, `Record` requires **every** key to exist.
5. **Syntax and API + 6. Small example**

```ts
interface StringMap {
  [key: string]: string;
}
const headers: StringMap = { "content-type": "application/json" };

type Scores = Record<string, number>;
const scores: Scores = {};
scores.asha = 90;

const total = scores.ravi;      // type: number  (but at runtime it is undefined!)

// Known keys: Record requires ALL of them
type Env = "dev" | "staging" | "prod";
const urls: Record<Env, string> = {
  dev: "http://localhost:3000",
  staging: "https://staging.example.com",
  prod: "https://example.com",
};

// Mixing fixed and dynamic keys: fixed ones must fit the index signature
interface Options {
  name: string;
  [key: string]: string | number;
}

// Often better: Map
const cache = new Map<string, User>();
```

7. **Real backend usage** — HTTP headers, query objects, feature flags by name, and lookup tables by ID.
8. **Edge cases**
   - Without `noUncheckedIndexedAccess`, reading `scores["missing"]` is typed as `number`, even though it is really `undefined`. Turning that flag on makes the type `number | undefined`, which is honest.
   - Number keys are converted to strings in JavaScript objects.
   - Objects inherit properties like `toString`, so a plain object as a user-keyed dictionary is risky (use `Map` or `Object.create(null)`).
9. **Common mistakes** — Using index signatures when the keys are actually known. Not handling `undefined` when reading a dynamic key. Using an object as a dictionary for user-supplied keys.
10. **Interview answer** — "An index signature describes an object with dynamic keys of one type and values of another. `Record<K, V>` is the shorthand. I turn on `noUncheckedIndexedAccess` so reading a dynamic key gives `V | undefined`, and I use `Map` when keys come from users."
11. **Practice problem** — Type a `countWords(text): Record<string, number>` function. Turn on `noUncheckedIndexedAccess` and fix each new error.
12. **Production considerations** — Never trust user-supplied keys. Validate them against an allow-list, and prefer `Map` for dictionaries with untrusted keys.

---

## 2.2.6 `keyof`, `typeof` and Indexed Access Types

1. **Definition**
   - **`keyof T`** gives a union of all key names of `T`.
   - **`typeof value`** (in a **type** position) gives the type of an existing value.
   - **Indexed access `T[K]`** gives the type of the property `K` inside `T`.
2. **Simple meaning**
   - `keyof` = **the list of all labels on a form**.
   - `typeof` = **"whatever type this thing already has."**
   - `T[K]` = **"the type of the value written next to this label."**
3. **Why it is needed** — You can derive new types from existing ones instead of writing them twice. One source of truth means fewer bugs.
4. **How it works internally** — These are pure compile-time operations. They read the types the compiler already knows and create new types from them. (`typeof` in a type position is different from the JavaScript `typeof` operator that runs at runtime.)
5. **Syntax and API + 6. Small example**

```ts
interface User {
  id: number;
  name: string;
  email: string;
}

type UserKey = keyof User;                 // "id" | "name" | "email"
type EmailType = User["email"];            // string
type IdOrName = User["id" | "name"];       // number | string
type UserList = User[];
type OneUser = UserList[number];           // User

// typeof: derive a type from a value
const config = { port: 3000, host: "localhost" };
type Config = typeof config;               // { port: number; host: string }

const ROUTES = ["users", "orders", "products"] as const;
type Route = (typeof ROUTES)[number];      // "users" | "orders" | "products"

// Type of what a function returns
function createService() {
  return { start: () => "started" };
}
type Service = ReturnType<typeof createService>;

// Safe property access
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
getProp({ id: 1, name: "Asha" }, "name");  // string
// getProp({ id: 1 }, "email");            // Error: not a key
```

7. **Real backend usage** — A `sortBy: keyof User` parameter that can only be a real field. Deriving types from `as const` config or route tables. Building generic helpers like `pick` and `groupBy`.
8. **Edge cases** — `keyof` on a type with a string index signature is `string | number`. For a union type, `keyof (A | B)` gives only the keys **common** to both.
9. **Common mistakes** — **Treating a compile-time `keyof` check as a security check.** Types are erased at runtime, so a request can still send any string. If you use a field name in an SQL `ORDER BY`, you must check it against an **allow-list at runtime**.
10. **Interview answer** — "`keyof` gives the union of a type's keys. `typeof` in a type position gives the type of a value. `T[K]` looks up a property's type. I use them to derive types from one source of truth instead of repeating them."
11. **Practice problem** — Write `sortBy<T, K extends keyof T>(items: T[], key: K): T[]`. Then write a runtime allow-list `const SORTABLE = ["name", "createdAt"] as const` and derive the `SortField` type from it.
12. **Production considerations** — Derive types from runtime constants (`as const`) when you also need to validate at runtime. Types alone cannot protect you from bad input.

---

## 2.2 Practice Projects

- **Generic utility kit:** `first`, `pick`, `omit`, `groupBy`, `indexBy`, `unique`, `withTimeout<T>`, `retry<T>` — all with strict types and no `any`.
- **Generic pagination:** `Paginated<T>`, `PageQuery`, and `paginate<T>()`.
- **In-memory repository** for `User` and `Product`, with tests.

**2.2 is done when you can:**
- [ ] Type a function with optional, default, and rest parameters
- [ ] Write a generic function with a constraint, and explain what `T` does
- [ ] Explain `keyof`, `typeof`, and `T[K]` with an example each
- [ ] Explain why `noUncheckedIndexedAccess` makes index reads more honest

---

# 2.3 Advanced TypeScript

**Priority: IMPORTANT**

**Goal:** Build new types from old ones, narrow types safely, configure the compiler properly, and understand the gap between compile-time types and runtime data.

**Topics in this section:** conditional types → mapped types → template literal types → utility types → type guards → discriminated unions → declaration files and module augmentation → `tsconfig` and strict mode → runtime validation vs compile-time types.

> **Tip:** You do not need to write complex type-level code every day. You need to **read** it, use the built-in utility types well, and know how to fix an error message. Do not build clever types for fun in production code.

---

## 2.3.1 Conditional Types

1. **Definition** — A **conditional type** chooses one type or another based on a condition: `T extends U ? X : Y`. The keyword **`infer`** lets you capture a part of a type inside the condition.
2. **Simple meaning** — It is an **if/else that works on types**. Like a post office rule: "If the parcel is a *Promise of something*, deliver the *something*. If not, deliver the parcel as it is."
3. **Why it is needed** — It lets a type depend on another type, so helpers such as `ReturnType`, `Awaited`, and `NonNullable` can exist.
4. **How it works internally** — The compiler checks whether `T` is assignable to `U`. If `T` is a **union**, the condition is applied to **each member separately** and the results are joined (this is called *distribution*).
5. **Syntax and API + 6. Small example**

```ts
type IsString<T> = T extends string ? true : false;
type A = IsString<"hello">;    // true
type B = IsString<number>;     // false

// infer: capture the type inside a Promise
type Unwrap<T> = T extends Promise<infer U> ? U : T;
type R1 = Unwrap<Promise<User>>;   // User
type R2 = Unwrap<string>;          // string

// infer: element type of an array
type ElementOf<T> = T extends (infer E)[] ? E : never;
type E1 = ElementOf<string[]>;     // string

// Distribution over a union
type ToArray<T> = T extends unknown ? T[] : never;
type X = ToArray<string | number>;   // string[] | number[]

// Turn off distribution by wrapping in a tuple
type ToArrayOnce<T> = [T] extends [unknown] ? T[] : never;
type Y = ToArrayOnce<string | number>;   // (string | number)[]

// Real example: the result type of an async service method
type ServiceResult<F extends (...args: any[]) => Promise<unknown>> =
  F extends (...args: any[]) => Promise<infer R> ? R : never;
```

7. **Real backend usage** — Mostly indirect: through built-in utilities (`ReturnType`, `Awaited`, `NonNullable`). Direct use is common in library or framework code, and in generic helpers.
8. **Edge cases** — Distribution over unions surprises many people. `never` in a distributive position disappears (`ToArray<never>` is `never`). Deeply nested conditional types slow down the compiler and confuse readers.
9. **Common mistakes** — Using conditional types when a simple overload or a union would work. Writing types so clever that no teammate can maintain them.
10. **Interview answer** — "A conditional type is an if/else for types: `T extends U ? X : Y`. With `infer` I can pull a type out of another, like the value inside a `Promise`. Conditional types distribute over unions, and many built-in utility types are built with them."
11. **Practice problem** — Write `Unwrap<T>`, `ElementOf<T>`, and `FunctionReturn<T>` yourself. Then compare with the built-in `Awaited` and `ReturnType`.
12. **Production considerations** — Keep advanced types in one small `types/` folder with comments and examples. Prefer readable code over clever code.

---

## 2.3.2 Mapped Types

1. **Definition** — A **mapped type** builds a new object type by **looping over the keys of another type**: `{ [K in keyof T]: ... }`. You can add or remove `readonly` and `?` with `+` and `-`.
2. **Simple meaning** — A **stamp machine on a form**. It goes through every field and stamps it: "make optional," "make read-only," "wrap in a getter."
3. **Why it is needed** — You can create related types (update inputs, read-only views, nullable versions) from one main type, without copying and pasting fields.
4. **How it works internally** — The compiler goes through each key `K` in the key union, and creates a property with the type you describe. `as` inside the brackets can rename keys (*key remapping*).
5. **Syntax and API + 6. Small example**

```ts
type Optional<T>    = { [K in keyof T]?: T[K] };          // same as Partial<T>
type ReadonlyAll<T> = { readonly [K in keyof T]: T[K] };  // same as Readonly<T>
type Mutable<T>     = { -readonly [K in keyof T]: T[K] }; // remove readonly
type AllRequired<T> = { [K in keyof T]-?: T[K] };         // same as Required<T>
type Nullable<T>    = { [K in keyof T]: T[K] | null };

// Key remapping: create getter names
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
type UserGetters = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }

// Keep only string properties
type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

// Real use: a form of the same shape holding error messages
type FormErrors<T> = { [K in keyof T]?: string };
```

7. **Real backend usage** — Deriving `UpdateXInput`, `XResponse`, and validation-error maps from one entity type. Most of the time you will use the **built-in** ones (`Partial`, `Pick`, `Omit`, `Readonly`, `Record`).
8. **Edge cases** — Mapped types over `keyof T` keep the `readonly` and optional modifiers of the original (they are *homomorphic*). They are shallow. Nested objects are not changed.
9. **Common mistakes** — Writing your own `Partial` instead of using the built-in. Expecting deep changes from a shallow mapped type. Over-using key remapping.
10. **Interview answer** — "A mapped type loops over the keys of a type and builds a new type, and can add or remove `readonly` and optional. `Partial`, `Required`, `Readonly`, and `Pick` are all mapped types."
11. **Practice problem** — Write `DeepReadonly<T>` (recursive), `Nullable<T>`, and `PickByType<T, V>` (keep only properties whose type is `V`).
12. **Production considerations** — Use the built-in utility types first. A custom mapped type is worth it only when it removes real duplication in several places.

---

## 2.3.3 Template Literal Types

1. **Definition** — **Template literal types** build **string types** using the same backtick syntax as JavaScript template strings, and combine unions to make all possible strings.
2. **Simple meaning** — A **name-tag maker**. Give it the parts ("user" / "order" and "created" / "deleted") and it prints **every possible name tag**.
3. **Why it is needed** — Event names, route strings, and cache keys follow patterns. These types make the patterns checkable.
4. **How it works internally** — The compiler forms the cross-product of all unions inside `${ }`. Built-in helpers change the case: `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`.
5. **Syntax and API + 6. Small example**

```ts
type Entity = "user" | "order";
type Action = "created" | "deleted";
type EventName = `${Entity}.${Action}`;
// "user.created" | "user.deleted" | "order.created" | "order.deleted"

type ApiPath = `/api/${string}`;
const ok: ApiPath = "/api/users";
// const bad: ApiPath = "/users";       // Error

type CacheKey = `user:${number}` | `order:${number}`;
const key: CacheKey = "user:42";

// A small, typed event emitter
type Events = {
  "user.created": { id: number; email: string };
  "order.paid": { orderId: number; amount: number };
};

class TypedEmitter<E extends Record<string, unknown>> {
  private handlers = new Map<keyof E, Array<(payload: never) => void>>();

  on<K extends keyof E>(event: K, handler: (payload: E[K]) => void): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler as (payload: never) => void);
    this.handlers.set(event, list);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    for (const handler of this.handlers.get(event) ?? []) {
      (handler as (payload: E[K]) => void)(payload);
    }
  }
}

const bus = new TypedEmitter<Events>();
bus.on("order.paid", (p) => console.log(p.amount));   // p is typed
// bus.emit("order.paid", { orderId: 1 });            // Error: 'amount' is missing
```

7. **Real backend usage** — Event names for your domain events, typed cache keys, route patterns, and log categories.
8. **Edge cases** — A union with many members multiplies fast (3 × 4 × 5 = 60 strings). Huge unions slow down the compiler.
9. **Common mistakes** — Over-typing strings that are not really limited. Making a giant union that no one can read in an error message.
10. **Interview answer** — "Template literal types build string types from parts, and combine unions into every valid combination. I use them for event names, cache keys, and route patterns, so a typo becomes a compile error."
11. **Practice problem** — Type a `CacheKey` for `user:${id}` and `session:${string}`. Extend the `TypedEmitter` with an `off` method.
12. **Production considerations** — A typed event bus is a good way to keep modules loosely connected. Later, in message-queue phases, the same event types can describe your queue messages.

---

## 2.3.4 Utility Types

1. **Definition** — **Utility types** are ready-made generic types in TypeScript for common transformations.
2. **Simple meaning** — A **toolbox with the tools you use most**. You do not forge a hammer each time.
3. **Why it is needed** — They remove duplication. From one `User` type you can create create-input, update-input, and public-response types safely.
4. **How it works internally** — They are all built with mapped and conditional types (2.3.1 and 2.3.2).
5. **Syntax and API + 6. Small example**

| Utility | What it does |
|---------|--------------|
| `Partial<T>` | All properties optional |
| `Required<T>` | All properties required |
| `Readonly<T>` | All properties read-only |
| `Pick<T, K>` | Keep only the listed keys |
| `Omit<T, K>` | Remove the listed keys |
| `Record<K, V>` | Object with keys `K` and values `V` |
| `Exclude<U, X>` | Remove members `X` from union `U` |
| `Extract<U, X>` | Keep only members of `U` that match `X` |
| `NonNullable<T>` | Remove `null` and `undefined` |
| `ReturnType<F>` | Return type of function `F` |
| `Parameters<F>` | Parameter types of `F` as a tuple |
| `Awaited<T>` | The value inside a `Promise` (recursive) |

```ts
interface User {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

type CreateUserInput = Omit<User, "id" | "createdAt" | "passwordHash"> & { password: string };
type UpdateUserInput = Partial<Pick<User, "name" | "email">>;
type PublicUser      = Omit<User, "passwordHash">;
type UserSummary     = Pick<User, "id" | "name">;

type Status = "pending" | "paid" | "cancelled";
type OpenStatus = Exclude<Status, "cancelled">;       // "pending" | "paid"
type PaidOnly   = Extract<Status, "paid">;            // "paid"
type Clean      = NonNullable<string | null | undefined>;   // string

async function loadOrder(id: number) {
  return { id, total: 500 };
}
type LoadFn   = typeof loadOrder;
type OrderRes = Awaited<ReturnType<LoadFn>>;          // { id: number; total: number }
type LoadArgs = Parameters<LoadFn>;                   // [id: number]

const timeouts: Record<"http" | "db", number> = { http: 3000, db: 5000 };
```

7. **Real backend usage** — DTOs (`CreateXInput`, `UpdateXInput`, `XResponse`) from one entity type. `Partial` for PATCH bodies. `Omit` to hide sensitive fields.
8. **Edge cases**
   - **`Omit` does not check that the key exists.** `Omit<User, "pasword">` (typo) compiles and removes nothing. `Pick` does check.
   - `Partial` and `Readonly` are **shallow**.
   - `Partial<T>` for an update means "any field may be missing," so a runtime validator must still reject an empty update if that is not allowed.
9. **Common mistakes** — Trusting `Omit` with a misspelled key. Using `Omit` to hide `passwordHash` in the **type** only, while the runtime object still contains it (you must remove it in code).
10. **Interview answer** — "Utility types are built-in helpers like `Partial`, `Pick`, `Omit`, `Record`, and `ReturnType`. I use them to derive input and response types from one main entity type, which avoids duplicated field lists."
11. **Practice problem** — From a `Product` type, create `CreateProductInput`, `UpdateProductInput`, `ProductListItem`, and `ProductResponse`. Write a `toPublicUser(user: User): PublicUser` function that **really** removes the password hash.
12. **Production considerations** — A type that says a field is missing does not remove it from the object. Sensitive fields must be removed by **code** (a mapper function), not just by a type.

---

## 2.3.5 Type Guards and Narrowing

1. **Definition** — **Narrowing** is the compiler making a type more specific inside a branch of code. A **type guard** is a check that tells the compiler what the type is: `typeof`, `instanceof`, `in`, equality checks, or your own function with a **type predicate** (`x is T`).
2. **Simple meaning** — A **gate check with an ID card**. Before you let someone into the staff area, you check the card. After the check, everyone inside is known to be staff.
3. **Why it is needed** — Values often start wide (`unknown`, `string | number`, `T | null`). To use them safely, you must prove what they are.
4. **How it works internally** — The compiler follows the control flow of your code. After `if (typeof x === "string")`, inside the block `x` is `string`. With a user-defined guard, the compiler **trusts** the `x is T` claim, so **you** are responsible for a correct check.
5. **Syntax and API + 6. Small example**

```ts
function format(value: string | number | Date): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return value.toFixed(2);
  return value.toISOString();                       // Date
}

// instanceof: very common with errors
try {
  await doWork();
} catch (err) {                                     // err is unknown
  if (err instanceof AppError) console.log(err.status);
  else if (err instanceof Error) console.log(err.message);
}

// `in` narrowing
type Cat = { meow: () => void };
type Dog = { bark: () => void };
function speak(pet: Cat | Dog) {
  if ("meow" in pet) pet.meow();
  else pet.bark();
}

// User-defined type guard
interface User { id: number; name: string }
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === "number" &&
    typeof (value as Record<string, unknown>).name === "string"
  );
}

// Assertion function: throws if the check fails
function assertDefined<T>(value: T | null | undefined, name: string): asserts value is T {
  if (value == null) throw new Error(`${name} is required`);
}
const maybe: string | undefined = process.env.API_KEY;
assertDefined(maybe, "API_KEY");
maybe.length;                                        // now string
```

7. **Real backend usage** — Handling `unknown` errors in `catch`, validating parsed JSON, narrowing optional values (`user?.email`), and checking `Result` types.
8. **Edge cases** — A **wrong** type guard silently breaks type safety. If `isUser` returns `true` for a bad object, the compiler will believe it. Narrowing is lost inside callbacks if the variable can change. Truthiness checks remove `0` and `""` too.
9. **Common mistakes** — Guards that check only part of the shape. Using `as` instead of a guard. Forgetting `x !== null` because `typeof null === "object"`.
10. **Interview answer** — "Narrowing means TypeScript makes a type more specific inside a branch, based on checks like `typeof`, `instanceof`, `in`, or a custom guard with `x is T`. A custom guard is a promise from me to the compiler, so the check must be complete."
11. **Practice problem** — Write `isString`, `isNonEmptyArray`, and `isUser`. Write an `assertNever` function. Handle a `catch` block for three different error classes.
12. **Production considerations** — Hand-written guards do not scale to big shapes. For request bodies, use a validation library that produces both the check and the type (2.3.9).

---

## 2.3.6 Discriminated Unions

1. **Definition** — A **discriminated union** is a union of object types that all share one **literal field** (the *discriminant*, usually called `type`, `kind`, or `status`). Checking that field narrows the whole object.
2. **Simple meaning** — **Envelopes with a colored sticker.** A red sticker means "invoice" and a green sticker means "receipt." You look at the sticker first, and then you know exactly what is inside.
3. **Why it is needed** — Real data has states and events with **different fields**. A `failed` payment has a `reason`, but a `succeeded` payment has a `transactionId`. This models it exactly, and prevents impossible states.
4. **How it works internally** — The compiler narrows by the literal field in `switch` or `if`. If you handle every case, the leftover type is `never`. Assigning it to a `never` variable makes the compiler **check that you handled everything**.
5. **Syntax and API + 6. Small example**

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function parsePort(text: string): Result<number> {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 && n < 65536
    ? { ok: true, value: n }
    : { ok: false, error: `Invalid port: ${text}` };
}
const r = parsePort("3000");
if (r.ok) console.log(r.value);        // number
else console.error(r.error);           // string

// Events with different payloads
type PaymentEvent =
  | { type: "PAYMENT_STARTED"; orderId: number }
  | { type: "PAYMENT_SUCCEEDED"; orderId: number; transactionId: string }
  | { type: "PAYMENT_FAILED"; orderId: number; reason: string };

function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}

function describe(event: PaymentEvent): string {
  switch (event.type) {
    case "PAYMENT_STARTED":
      return `Started for order ${event.orderId}`;
    case "PAYMENT_SUCCEEDED":
      return `Paid: ${event.transactionId}`;
    case "PAYMENT_FAILED":
      return `Failed: ${event.reason}`;
    default:
      return assertNever(event);         // compile error if a new event type is added and not handled
  }
}
```

7. **Real backend usage** — `Result` types, domain events, job states (`pending | running | failed | done`), API responses, and state machines like order status.
8. **Edge cases** — The discriminant must be a **literal type** (not plain `string`). If you add a new member to the union, every `switch` with `assertNever` fails to compile until you handle it. That is the goal.
9. **Common mistakes** — Using one big object type with lots of optional fields (`{ status: string; reason?: string; transactionId?: string }`), which allows impossible combinations. Not adding the `never` check in the `default` branch.
10. **Interview answer** — "A discriminated union is a union of object types with a shared literal field, like `type` or `status`. Checking that field narrows the type. With a `never` check in the `default` branch, the compiler forces me to handle every case, including ones added later."
11. **Practice problem** — Model an `OrderState` as a discriminated union (`created | paid | shipped | cancelled`) where each state has different fields. Write a function `nextAction(order)` with a full `switch` and `assertNever`.
12. **Production considerations** — Exhaustive `switch` statements make refactoring safe. In production also keep the runtime `default` branch (`assertNever` throws), because data from outside can still carry a value your types never expected.

---

## 2.3.7 Declaration Files and Module Augmentation

1. **Definition**
   - A **declaration file** (`.d.ts`) contains **only types**, no code. It describes the shape of JavaScript code that has no types.
   - **Module augmentation** adds new types to an **existing** module or to the global scope.
2. **Simple meaning**
   - A `.d.ts` file is an **instruction manual for a machine somebody else built without labels**.
   - Augmentation is **sewing an extra pocket onto an existing jacket.**
3. **Why it is needed** — Many npm packages are plain JavaScript. Also, frameworks let you attach your own data (for example `req.user` in Express), and TypeScript must know about it.
4. **How it works internally** — `@types/*` packages (from DefinitelyTyped) provide declarations for JavaScript libraries. Many packages ship their own types. When you declare an `interface` with the same name as an existing one, TypeScript **merges** them. The declaration file must be included by your `tsconfig` (`include`), and to augment global or module types it must itself be a **module** (contain an `import` or `export`).
5. **Syntax and API + 6. Small example**

```bash
npm i -D @types/node @types/express     # types for JS libraries
```

```ts
// src/types/express.d.ts
// Add `user` to Express's Request (set later by your auth middleware)
export {};

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: "admin" | "editor" | "viewer" };
    }
  }
}
```

```ts
// src/types/env.d.ts
// Describe your environment variables
export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "test" | "production";
      PORT?: string;
      DATABASE_URL: string;
    }
  }
}
```

```ts
// src/types/untyped-lib.d.ts
// Minimal types for a JS library that has none
declare module "legacy-pdf-tool" {
  export function render(html: string): Promise<Buffer>;
}
```

7. **Real backend usage** — `req.user` and `req.requestId` in Express. Typed `process.env`. Small typings for an old npm package.
8. **Edge cases**
   - If your `.d.ts` is not picked up, check the `include` in `tsconfig.json`, and check that the file is a module (`export {}`).
   - Declaring env variables as `string` is a **promise, not a check**. The variable can still be missing at runtime. Validate config at startup (see 2.4).
   - `req.user?` is optional on purpose, because it does not exist before the auth middleware runs.
9. **Common mistakes** — Declaring types for env variables and then trusting them without validation. Putting augmentations in a file that is not included by `tsconfig`. Using `declare module "x";` (a blank declaration) everywhere, which makes the whole module `any`.
10. **Interview answer** — "A `.d.ts` file holds only type declarations, and describes JavaScript that has no types. Module augmentation lets me add to existing types, for example adding `user` to Express's `Request`, using declaration merging."
11. **Practice problem** — Augment Express `Request` with `user` and `requestId`. Write a `.d.ts` for a tiny JavaScript helper file with three functions.
12. **Production considerations** — Keep augmentations in one `types/` folder, documented. Validate the real value at runtime whenever the type claims something about external input (env variables, tokens, headers).

---

## 2.3.8 `tsconfig` and Strict Mode

1. **Definition** — `tsconfig.json` is the **settings file for the compiler**: which files to include, which JavaScript version to output, and how strict to be. **`strict`** is a group of checks that turn on the safest behavior.
2. **Simple meaning** — It is the **rulebook for the building inspector**. A loose rulebook lets many problems pass. A strict rulebook is annoying on day one, and saves you every day after.
3. **Why it is needed** — Without `strict`, TypeScript allows implicit `any`, unchecked `null`, and other holes. Most benefits of TypeScript come from strict mode.
4. **How it works internally** — Each option changes what the compiler accepts. `strict: true` turns on a group of flags together.

| Flag (inside `strict`) | What it protects you from |
|------------------------|---------------------------|
| `noImplicitAny` | Variables and parameters silently becoming `any` |
| `strictNullChecks` | Using a value that might be `null` or `undefined` |
| `strictFunctionTypes` | Unsafe assignment of function types |
| `strictBindCallApply` | Wrong arguments in `bind`, `call`, `apply` |
| `strictPropertyInitialization` | Class properties that are never set |
| `noImplicitThis` | `this` with an unknown type |
| `useUnknownInCatchVariables` | `catch (err)` being `any` instead of `unknown` |
| `alwaysStrict` | Emits `"use strict"` in the output |

**Recommended extra flags (not part of `strict`):**

| Flag | Why turn it on |
|------|----------------|
| `noUncheckedIndexedAccess` | `arr[i]` and `record[key]` include `undefined` |
| `noImplicitOverride` | Requires the `override` keyword for overridden methods |
| `noFallthroughCasesInSwitch` | Catches missing `break` in `switch` |
| `noUnusedLocals`, `noUnusedParameters` | Finds dead code (or leave to ESLint) |
| `exactOptionalPropertyTypes` | Separates "missing" from "set to undefined" (stricter, optional) |

5. **Syntax and API + 6. Small example** — a sensible starting `tsconfig.json` for a Node.js backend:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,

    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,

    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

7. **Real backend usage** — Every backend project starts with a `tsconfig.json`. Many teams keep a shared base config, and extend it (`"extends"`) in each service.
8. **Edge cases**
   - With `module: "NodeNext"`, the file type follows `package.json` (`"type": "module"` means ES modules). In ES module mode, **relative imports need the `.js` extension** in the source (`import { x } from "./utils.js"`), even though the file is `.ts`.
   - `skipLibCheck` skips type-checking of `.d.ts` files inside `node_modules`. It speeds up builds and avoids errors from third-party typings.
   - Turning on `strict` in an old project produces many errors. Fix folder by folder, not by switching it off.
9. **Common mistakes** — Leaving `strict` off "for now" and never turning it on. Using `// @ts-ignore` to hide errors (use `// @ts-expect-error` with a reason, which warns you when it is no longer needed). Wrong `rootDir` / `outDir`, so the output folder structure is unexpected.
10. **Interview answer** — "`tsconfig.json` controls the compiler. I always enable `strict`, which includes `noImplicitAny` and `strictNullChecks`, and I add `noUncheckedIndexedAccess`. Strict mode catches most real bugs, like unhandled `null` values and accidental `any`."
11. **Practice problem** — Start a project with `strict: false`, write 10 lines of sloppy code, then turn on `strict` and `noUncheckedIndexedAccess` and fix every error properly, with no `any`.
12. **Production considerations** — Run `tsc --noEmit` in CI. Keep the build output (`dist/`) out of Git. Pin the TypeScript version in `package.json`, since a new compiler version can add new errors.

---

## 2.3.9 Runtime Validation vs Compile-Time Types

> **Important rule:**
> TypeScript types disappear at runtime. Validate external input with a runtime validation library or custom validation.

1. **Definition** — **Compile-time types** are checked by the compiler and then erased. **Runtime validation** is real code that checks real data while the program runs, such as a request body, query string, environment variable, or database row.
2. **Simple meaning** — The **building inspector** (TypeScript) checks the blueprint before construction. But the **security guard at the door** (runtime validation) checks every real visitor. Two different jobs. You need both.
3. **Why it is needed** — In `req.body as CreateUserInput`, the cast does not check anything. A client can send `{ "age": "abc" }`, or a hacker can send anything. Your types would still say "it is a `CreateUserInput`," and the code would run with wrong data.
4. **How it works internally** — A validation library lets you write a **schema** (runtime object). It provides a function that checks data against the schema. It can also **derive the TypeScript type** from the same schema, so the type and the check can never drift apart.
5. **Syntax and API + 6. Small example**

```ts
import { z } from "zod";     // popular schema library (others: Joi, Valibot, TypeBox, Ajv)

// One schema = runtime check AND compile-time type
const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),          // check your version's docs; newer versions also offer z.email()
  age: z.number().int().min(0).max(150).optional(),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;
// { name: string; email: string; age?: number | undefined }

app.post("/users", (req, res) => {
  // BAD: a lie. Nothing is checked.
  // const input = req.body as CreateUserInput;

  // GOOD: check at runtime
  const parsed = CreateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.issues });
  }
  const input: CreateUserInput = parsed.data;   // now it is really safe
  // ... create the user
});

// Custom validation (no library): possible for small cases
function parseLimit(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error("limit must be 1-100");
  return n;
}
```

7. **Real backend usage** — Validate at every **boundary**: HTTP request (body, params, query, headers), environment variables at startup, messages from queues, responses from third-party APIs, and JSON files. After validation, the rest of the code can trust the types.
8. **Edge cases**
   - Query strings are always strings. Convert first (`z.coerce.number()` or your own code), then validate.
   - Schemas can **transform** data (trim, lowercase, parse dates), so the **input** type and **output** type may differ.
   - Validation costs CPU. For huge payloads, set body size limits first.
   - Reject unknown fields, or strip them, so clients cannot sneak extra data through (mass assignment).
9. **Common mistakes** — `req.body as SomeType`. Trusting the return type of `res.json()` (`fetchJson<User>`). Validating in the middle of business logic instead of at the boundary. Writing the type by hand **and** the validator by hand, so they drift.
10. **Interview answer** — "TypeScript types are erased at runtime, so they cannot protect against bad input. I validate external data at the boundary with a schema library, and I derive the TypeScript type from the same schema. After validation, the rest of the code can trust the type."
11. **Practice problem** — Write a schema for `CreateUserRequest` and `ListUsersQuery` (with `page`, `limit`, `sort`). Reject invalid input with a `400` and clear messages. Then write the same check by hand and compare the effort.
12. **Production considerations** — Validate **all** external input. Return clear `400` responses without leaking internals. Log validation failures (without sensitive data) to spot broken clients or attacks.

---

## 2.3 Practice Projects

- **Typed event bus:** a `TypedEmitter<Events>` with `on`, `off`, `once`, `emit`.
- **Discriminated-union state machine:** an order or job state machine with an exhaustive `switch`.
- **Validated boundary:** a small script that reads `process.env`, validates it with a schema, and exports a typed `config` object.
- **`.d.ts` practice:** augment Express `Request`, and type a small untyped JavaScript library.

**2.3 is done when you can:**
- [ ] Build `CreateInput`, `UpdateInput`, and `PublicResponse` types from one entity with utility types
- [ ] Write a discriminated union with an exhaustive `switch`
- [ ] Explain why `req.body as Type` is unsafe, and fix it with a validation schema
- [ ] Explain `strict` mode and name four flags it turns on
- [ ] Augment a library's types with a `.d.ts` file

---

# 2.4 TypeScript Backend Standards

**Priority: MUST KNOW** (no label in the roadmap; treated as MUST KNOW here)

**Goal:** Use TypeScript the way professional backend teams do: clear layers, typed contracts, safe errors, validated config, and a reliable build.

**Topics in this section:** DTOs and domain types → repository interfaces and service contracts → error types and the `Result` pattern → typed configuration → avoiding unsafe `any` → build, source maps, and ESM vs CommonJS.

**A common project layout (used by the practice project):**

```text
src/
  config/
    env.ts                 # validated, typed configuration
  errors/
    app-error.ts           # AppError + NotFoundError, ValidationError, ...
  shared/
    pagination.ts          # PageQuery, Paginated<T>
  modules/
    users/
      user.types.ts        # domain type + DTO types
      user.schemas.ts      # runtime validation schemas
      user.mapper.ts       # row <-> domain <-> DTO
      user.repository.ts   # interface + implementations
      user.service.ts      # business logic (depends on interfaces)
      user.controller.ts   # HTTP layer
  types/
    express.d.ts           # augmentations
  index.ts                 # start-up
```

---

## 2.4.1 DTOs and Domain Types

1. **Definition**
   - A **DTO (Data Transfer Object)** is a type for data that **crosses a boundary**: the request body coming in, or the response going out.
   - A **domain type** is the type your **business logic** uses inside the app.
   - A **database row type** matches the table exactly.
2. **Simple meaning** — Think of a **shipping company**. The **shipping box** (DTO) has a label and a fixed size, made for travel. The **product** (domain type) is what the business really works with. The **warehouse record** (row type) is how the storage system writes it down. They are related, but **not the same thing**.
3. **Why it is needed** — If you use the database row as the API response, you may leak `password_hash`. If you rename a column, your public API breaks. Separate types give you control.
4. **How it works internally** — Nothing special: they are ordinary types. The value comes from the **rule** that data passes through **mapper functions** when it crosses a layer: `request → validate → DTO → domain → row → database`, and back.
5. **Syntax and API + 6. Small example**

```ts
// Database row: matches the table
interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
}

// Domain type: what business code uses
interface User {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

// DTOs: what crosses the API boundary
interface CreateUserDto {
  email: string;
  password: string;
}
interface UserResponseDto {
  id: number;
  email: string;
  createdAt: string;            // ISO string in JSON
}

// Mappers: the ONLY place where shapes change
const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
});

const toUserResponse = (user: User): UserResponseDto => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt.toISOString(),
});
```

7. **Real backend usage** — Every module has `CreateXDto`, `UpdateXDto`, `XResponseDto`, and a mapper. Validation schemas (2.3.9) produce the input DTO types.
8. **Edge cases** — `Date` becomes a string in JSON, so the DTO should say `string`. Dates and BigInt values from MySQL may come as different types than you expect. Check the driver's behavior. A mapper is also the right place to convert `snake_case` to `camelCase`.
9. **Common mistakes** — Returning the domain object or the database row directly from a controller. One giant `User` type used everywhere. Putting business rules inside DTOs.
10. **Interview answer** — "A DTO describes data that crosses a boundary, like a request or a response. A domain type is what my business logic uses. I keep them separate and convert with mapper functions, so a database change or a new column does not leak into the public API."
11. **Practice problem** — For a `Product` entity, write `ProductRow`, `Product`, `CreateProductDto`, `UpdateProductDto`, `ProductResponseDto`, and the mappers. Prove that `passwordHash`-style fields cannot appear in the response.
12. **Production considerations** — Response mappers act as an **allow-list**: you list exactly which fields leave your system. This is a strong protection against accidental data leaks.

---

## 2.4.2 Repository Interfaces and Service Contracts

1. **Definition**
   - A **repository interface** describes **how data is stored and read**, without saying which database is used.
   - A **service contract** describes **what the business layer offers** to controllers and other services.
2. **Simple meaning** — A **librarian**: you ask for a book by title, and you do not care which shelf it is on or how the room is arranged. The **interface** is the promise "I can find, add, and remove books." The **implementation** is the actual librarian's method.
3. **Why it is needed** — Business logic should not depend on MySQL details. With an interface, you can **swap in a fake repository in tests**, change the database later, and read the contract to see what a module can do.
4. **How it works internally** — The service **depends on an interface**, and receives an implementation through its constructor (*dependency injection*). TypeScript checks that the implementation has every method with the correct types (`implements`).
5. **Syntax and API + 6. Small example**

```ts
// shared/pagination.ts
export interface PageQuery {
  page: number;     // 1-based
  limit: number;
}
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export function toPaginated<T>(items: T[], total: number, q: PageQuery): Paginated<T> {
  return { items, page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) };
}

// modules/users/user.repository.ts
export type NewUser = Omit<User, "id" | "createdAt">;

export interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(query: PageQuery): Promise<Paginated<User>>;
  create(data: NewUser): Promise<User>;
  delete(id: number): Promise<boolean>;
}

// modules/users/user.service.ts
export interface UserService {
  register(input: CreateUserDto): Promise<UserResponseDto>;
  getById(id: number): Promise<UserResponseDto>;   // throws NotFoundError
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
}

export class DefaultUserService implements UserService {
  constructor(
    private readonly users: UserRepository,        // depends on the interface
    private readonly hasher: PasswordHasher
  ) {}

  async register(input: CreateUserDto): Promise<UserResponseDto> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictError("Email already registered");
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({ email: input.email, passwordHash });
    return toUserResponse(user);
  }

  async getById(id: number): Promise<UserResponseDto> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User", id);
    return toUserResponse(user);
  }
}
```

7. **Real backend usage** — `UserRepository` with a MySQL implementation in production and an in-memory implementation in tests. Services receive their dependencies in the constructor, which prepares you for the design patterns and LLD phases.
8. **Edge cases** — Return `null` (or a `Result`) for "not found" in the repository, and let the **service** decide to throw `NotFoundError`. Keep transactions in mind (a repository method that takes a transaction context comes later).
9. **Common mistakes** — Leaking database types (query builders, row shapes) through the repository interface. A giant "god" repository with 40 methods. Creating dependencies inside the service (`new MySqlUserRepository()`), which makes it impossible to test in isolation.
10. **Interview answer** — "A repository interface hides the storage details, and a service contract describes the business operations. The service receives its dependencies through the constructor as interfaces, so I can use an in-memory fake in tests and swap the database without touching business code."
11. **Practice problem** — Write a `UserRepository` interface and an in-memory implementation. Write `DefaultUserService` and unit tests (with `node:test`) for "register succeeds," "duplicate email is rejected," and "get by id not found."
12. **Production considerations** — Keep interfaces small and focused on what the service really needs. Put all SQL and driver details inside the implementation.

---

## 2.4.3 Error Types and the Result Pattern

1. **Definition**
   - **Typed errors** are custom error classes (with a `code`, an HTTP `status`, and safe details) that carry meaning.
   - The **`Result` pattern** returns success or failure as a **value** (`{ ok: true, value }` or `{ ok: false, error }`), instead of throwing.
2. **Simple meaning**
   - A typed error is like a **hospital wristband with a color code**: everyone instantly knows what kind of problem it is and how to react.
   - A `Result` is a **sealed envelope marked on the outside "success" or "failure"**. You must look at the outside before you open it.
3. **Why it is needed** — Clients need clear error codes. Your central error handler needs to tell "user sent bad data" (`400`) from "our database died" (`500`). And **expected failures** should be visible in the function's type.
4. **How it works internally** — Custom errors extend `Error`, so `instanceof` works and stack traces are kept. A central handler maps `AppError` to a status and a safe message, and everything else to a generic `500`. A `Result` is a discriminated union (see 2.3.6), so the compiler forces callers to check `ok`.
5. **Syntax and API + 6. Small example**

```ts
// errors/app-error.ts
export type ErrorCode =
  | "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT"
  | "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    options: { cause?: unknown; details?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, 400, { details });
  }
}
export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super("NOT_FOUND", `${resource} ${id} not found`, 404);
  }
}
export class ConflictError extends AppError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
  }
}

// Central mapping (used by one Express error-handling middleware)
export function toErrorResponse(err: unknown) {
  if (err instanceof AppError) {
    return { status: err.status, body: { code: err.code, message: err.message, details: err.details } };
  }
  // Unknown error: log it on the server, but never leak internals
  return { status: 500, body: { code: "INTERNAL" as const, message: "Something went wrong" } };
}

// Result pattern for EXPECTED failures
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const fail = <E>(error: E): Result<never, E> => ({ ok: false, error });

function parseAmount(input: string): Result<number, "NOT_A_NUMBER" | "NEGATIVE"> {
  const n = Number(input);
  if (Number.isNaN(n)) return fail("NOT_A_NUMBER");
  if (n < 0) return fail("NEGATIVE");
  return ok(n);
}

const parsed = parseAmount("12.5");
if (!parsed.ok) {
  // parsed.error is "NOT_A_NUMBER" | "NEGATIVE"
} else {
  // parsed.value is number
}
```

7. **Real backend usage** — `NotFoundError`, `ValidationError`, `ConflictError`, and `UnauthorizedError` thrown from services and handled in **one** place. `Result` for parsing, business rules with several expected outcomes, and helpers used by other code.
8. **Edge cases**
   - `instanceof` can fail if the same class is loaded twice (duplicate packages), or when errors cross a process boundary (worker, queue). Also add a string `code` to check on.
   - `err.cause` keeps the original error for logs (needs `target` ES2022 or a matching `lib`).
   - Never send `err.stack` or database messages to clients.
9. **Common mistakes** — Throwing plain strings. Returning `200` with `{ error: ... }`. Using exceptions for normal control flow in hot paths. Using `Result` **everywhere** so that all code becomes noisy.
10. **Interview answer** — "I use custom error classes that extend `Error`, with a code and an HTTP status, and one central handler that turns them into safe responses. For expected failures where the caller must decide, I can return a `Result` union instead of throwing, so the compiler forces the caller to handle it."
11. **Practice problem** — Build the error hierarchy above. Write an Express-style error middleware using `toErrorResponse`. Convert a function that throws for "invalid input" into one that returns `Result`, and compare how callers look.
12. **Production considerations** — Log the full error and a request ID on the server. Return a stable `code` so clients do not depend on message text. Alert on `INTERNAL` errors, not on `400`s.

---

## 2.4.4 Typed Configuration

1. **Definition** — **Typed configuration** means reading environment variables **once at startup**, validating them at runtime, and exposing a **typed, read-only config object** to the rest of the app.
2. **Simple meaning** — A **pre-flight checklist**: before the plane takes off, the crew checks fuel, weather, and equipment. If anything is missing, the plane does **not** take off. Your app should also refuse to start with a broken configuration.
3. **Why it is needed** — `process.env.PORT` is `string | undefined`. If it is missing, you find out much later (maybe at 2 AM). Typed and validated config **fails fast**, with a clear message.
4. **How it works internally** — A schema describes each variable, with conversion (`"3000"` to `3000`), default values, and limits. Loading runs the schema once. If it fails, the process stops with a readable error. If it passes, you get a typed object.
5. **Syntax and API + 6. Small example**

```ts
// config/env.ts
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Readonly<Config> {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `- ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return Object.freeze(parsed.data);
}

export const config = loadConfig();

// Usage anywhere:  import { config } from "./config/env.js";
```

7. **Real backend usage** — Database URL, JWT secret, port, third-party API keys, feature flags. Tests can call `loadConfig({ ...fake })` with their own values, so nothing depends on the real environment.
8. **Edge cases** — Env variables are always strings, so convert numbers and booleans carefully (`"false"` is a truthy string!). Do not log the whole config, because it contains secrets. Import the config in **one** place, and pass values down.
9. **Common mistakes** — Reading `process.env.X` all over the code. Using `process.env.PORT || 3000` with no validation. Declaring `ProcessEnv` types (2.3.7) and assuming the values exist.
10. **Interview answer** — "I validate environment variables once at startup with a schema, convert types, apply defaults, and export a frozen typed config object. If something is missing or wrong, the app fails fast with a clear message instead of failing later at runtime."
11. **Practice problem** — Write `loadConfig` for 6 variables, including a boolean flag done correctly. Write tests: valid env passes, missing `DATABASE_URL` fails, `PORT="abc"` fails.
12. **Production considerations** — Keep secrets out of Git and out of logs. Use a secrets manager in production (later phase). Different environments should use the same schema and different values.

---

## 2.4.5 Avoiding Unsafe `any`

1. **Definition** — Writing code so that `any` does not appear, or appears only in tiny, documented places at the edge of the system.
2. **Simple meaning** — Every `any` is a **hole in the hull of a ship**. One small hole may be fine for a while, but holes spread. Values that touch `any` often become `any` too.
3. **Why it is needed** — `any` turns the compiler off exactly where you need it. Bugs return at runtime, and you lose autocomplete and refactoring safety.
4. **How it works internally** — `any` is assignable to and from everything, and property access on it is never checked. It **infects** results. For example, `JSON.parse(text)` returns `any`, and `res.json()` may return `any` depending on your type setup.

| Instead of `any`, use... | When |
|--------------------------|------|
| `unknown` + narrowing or a schema | External data of unknown shape |
| A generic `<T>` | Code that works for many types |
| A proper interface/type | You know the shape |
| `Record<string, unknown>` | "An object with unknown fields" |
| A union type | A few known possibilities |
| `satisfies` | Check a value against a type while keeping the exact type |

5. **Syntax and API + 6. Small example**

```ts
// BAD
function parseBody(text: string) {
  return JSON.parse(text);                 // any
}
const body = parseBody(input);
body.user.emial.toLowerCase();             // typo, no error, crashes at runtime

// GOOD: unknown + schema
function parseBodySafe(text: string): unknown {
  return JSON.parse(text);
}
const result = CreateUserSchema.safeParse(parseBodySafe(input));

// `satisfies`: check the shape, keep the exact types
const routes = {
  users: "/users",
  orders: "/orders",
} satisfies Record<string, `/${string}`>;

routes.users;                              // type is "/users", not just string

// If you MUST use any, isolate it and explain why
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party callback has no types
function legacyCallback(cb: (err: any, data: any) => void) { /* ... */ }
```

7. **Real backend usage** — Turn on the ESLint rules: `@typescript-eslint/no-explicit-any`, `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-call`, `no-unsafe-return`, and `no-floating-promises` (which also catches missing `await`, a big Phase 1 bug class).
8. **Edge cases** — Some third-party libraries return `any`. Wrap them in a small, typed function at the boundary. `as unknown as T` is a **double lie**. Treat it as a bug report waiting to happen.
9. **Common mistakes** — Adding `any` to "fix" an error you do not understand. Using `Function` or `object` as a type. Using `as any` to bypass a wrong type instead of fixing the type.
10. **Interview answer** — "I avoid `any` because it disables checking and spreads. For unknown data I use `unknown` and validate it. For reusable code I use generics. If I truly need `any`, I keep it in one small place, with a comment explaining why."
11. **Practice problem** — Take a 100-line JavaScript or loose TypeScript file, enable `no-explicit-any` and the `no-unsafe-*` rules, and remove every `any` honestly.
12. **Production considerations** — Treat lint errors as build failures in CI. Track `any` count as a code-quality signal, and let it go down over time.

---

## 2.4.6 Build, Source Maps, and ESM vs CommonJS

1. **Definition**
   - **Build** — running `tsc` to turn `src/*.ts` into `dist/*.js`.
   - **Source map** — a `.js.map` file that connects the compiled JavaScript back to your TypeScript lines.
   - **CommonJS (CJS)** — the old Node.js module system (`require`, `module.exports`). **ESM** — the standard module system (`import`, `export`).
2. **Simple meaning**
   - The build is **translating a book** from your language (TypeScript) into the language the machine reads (JavaScript).
   - A source map is the **page-number index that points from the translation back to the original**, so when something goes wrong you can find the exact original line.
3. **Why it is needed** — Node.js runs JavaScript, not TypeScript source. In production, error stack traces should point to your `.ts` lines, and not to a confusing compiled file. Module format decides how imports work and which packages you can use.
4. **How it works internally**
   - `tsc` reads `tsconfig.json`, checks types, and writes JavaScript to `outDir`.
   - With `"sourceMap": true` and `node --enable-source-maps`, stack traces show original TypeScript positions.
   - With `"module": "NodeNext"`, Node decides CJS or ESM per file, based on the nearest `package.json` `"type"` field (`"module"` for ESM).
5. **Syntax and API + 6. Small example**

```json
{
  "name": "training-api",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "start": "node --enable-source-maps dist/index.js"
  }
}
```

```ts
// ESM style (with "type": "module" and module: NodeNext)
import { createServer } from "node:http";
import { config } from "./config/env.js";      // NOTE: .js extension in the source

// __dirname does not exist in ESM. Use this instead:
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// (Newer Node.js versions also provide import.meta.dirname)
```

| | CommonJS | ES Modules |
|---|----------|------------|
| Syntax | `require()` / `module.exports` | `import` / `export` |
| Set by | default (no `"type"`), or `.cjs` | `"type": "module"`, or `.mjs` |
| Relative import extension | optional | **required** (`./file.js`) |
| `__dirname`, `__filename` | available | not available (use `import.meta.url`) |
| Top-level `await` | no | yes |
| Loading | synchronous | asynchronous |

7. **Real backend usage** — Development: `tsx watch` for fast reloads. CI: `tsc --noEmit`. Deploy: `tsc`, then run `node dist/index.js` (often inside a Docker image). Source maps make production stack traces readable.
8. **Edge cases**
   - Some older npm packages are CJS-only, and some newer ones are ESM-only. Mixing them can be painful, so check before choosing.
   - The `.js` extension in TypeScript imports looks strange, but it is what Node.js needs at runtime.
   - Path aliases (`@/utils`) are **not** rewritten by `tsc`. You need a bundler, or extra tooling, or avoid them.
   - Do not commit `dist/`. Do not run `tsx` in production unless you have decided it is acceptable for your team.
9. **Common mistakes** — Forgetting `.js` in relative imports. Setting `"type": "module"` but compiling to CommonJS (or the opposite). Deploying without source maps, then debugging unreadable stack traces.
10. **Interview answer** — "I compile with `tsc` to a `dist` folder, and run the compiled JavaScript in production with `--enable-source-maps` so stack traces point to TypeScript lines. For new projects I prefer ES modules with `NodeNext`, remembering that relative imports need the `.js` extension. I keep type checking in CI with `tsc --noEmit`."
11. **Practice problem** — Set up a new project two ways: ESM with `NodeNext` and CJS. Log an error from a nested function and compare stack traces with and without `--enable-source-maps`.
12. **Production considerations** — Build once, deploy the same artifact everywhere. Pin your Node.js and TypeScript versions. Keep dev-only tools (`tsx`, type packages) as `devDependencies`, and install only production dependencies in the final image.

---

## 2.4 Practice Projects

The roadmap's practice list for this section, in order:

1. **Build a typed CRUD API** (see the capstone below).
2. **Add validation and typed errors** (schemas at the boundary, `AppError` hierarchy, one central error handler).
3. **Create reusable generic pagination types** (`PageQuery`, `Paginated<T>`, `toPaginated<T>()`, and a query schema).

**2.4 is done when you can:**
- [ ] Explain why DTOs, domain types, and row types are separate, and write the mappers
- [ ] Write a repository interface, an in-memory implementation, and a service that uses it
- [ ] Build an error hierarchy with one central handler
- [ ] Validate `process.env` at startup and export a typed config
- [ ] Set up `tsc`, source maps, and an ESM project from scratch

---

# Phase 2 Capstone Project — Typed Training Sessions API

**Goal:** Combine everything from Phase 2 in one small, clean backend. This also starts the "Training session API" project from the roadmap's Express phase (Phase 5), so you will reuse it there.

**What you build:** a small HTTP API for live training sessions with full typing, validation, typed errors, and tests. Use minimal Express (only routes and middleware). A deep Express study comes in Phase 5. The store is **in memory** for now. MySQL replaces it in a later phase, and your repository interface makes that swap easy.

### Domain

```ts
type SessionStatus = "scheduled" | "live" | "completed" | "cancelled";

interface TrainingSession {
  id: number;
  title: string;
  trainerId: number;
  startsAt: Date;
  durationMinutes: number;
  status: SessionStatus;
  createdAt: Date;
}
```

### Requirements

1. **Endpoints:** create, get by ID, list (paginated, filter by `status`, sort by an allowed field), update (`PATCH`), cancel, delete.
2. **Layers:** controller → service → repository interface (with an in-memory implementation). Constructor injection.
3. **Types:** separate `TrainingSessionRow` (optional for now), domain type, `CreateSessionDto`, `UpdateSessionDto`, and `SessionResponseDto`, with mappers.
4. **Validation:** schemas for body, params, and query at the boundary. Reject unknown fields. `sort` must be checked against a runtime allow-list derived from an `as const` array.
5. **Errors:** `AppError` hierarchy, one central error middleware, no internal details leaked.
6. **State rules:** model allowed status changes (for example `scheduled → live → completed`, `scheduled → cancelled`). Use a discriminated union or a transition table, and an exhaustive `switch` with `assertNever`.
7. **Generic pagination:** `Paginated<T>` and `PageQuery` reused by the list endpoint.
8. **Typed config:** validated `PORT`, `NODE_ENV`, `LOG_LEVEL`.
9. **Augmentation:** `req.requestId` added through a `.d.ts`.
10. **Tooling:** `strict` and `noUncheckedIndexedAccess` on, ESLint with `no-explicit-any`, ESM with `NodeNext`, source maps on.
11. **Tests:** at least 10 tests using `node:test` against the service and the in-memory repository (create, not found, invalid transition, pagination edge cases, filter, sort).

### Where each Phase 2 idea is used

| Phase 2 idea | Where you use it |
|--------------|------------------|
| Type inference and annotations | Function boundaries and exported returns |
| Literal unions and `as const` | `SessionStatus`, sortable fields |
| Interfaces and readonly | DTOs and domain types |
| Generics and constraints | `Paginated<T>`, `Repository<T>` |
| `keyof`, `typeof`, indexed access | Sort field types derived from constants |
| Utility types | `Omit`, `Partial`, `Pick` for DTOs |
| Discriminated unions | Status transitions and `Result` |
| Type guards | Narrowing errors and validated input |
| Declaration files | `req.requestId` augmentation |
| `tsconfig` strict | Whole project |
| Runtime validation | Body, params, query, env |
| Typed errors | `AppError` hierarchy |
| Build and source maps | `tsc` build and `node --enable-source-maps` |

### Milestones

- **Day 1–2:** project setup (strict `tsconfig`, ESLint, ESM), domain types, DTOs, mappers.
- **Day 3:** repository interface, in-memory implementation, generic pagination.
- **Day 4:** schemas, typed config, error hierarchy.
- **Day 5:** service with status transitions and exhaustive checks.
- **Day 6:** controllers, error middleware, `req.requestId`.
- **Day 7:** tests, cleanup, and a short README that explains every design choice **in simple English**.

### Done when

- [ ] `tsc --noEmit` passes with `strict` and `noUncheckedIndexedAccess`
- [ ] The project has zero explicit `any` (lint passes)
- [ ] Bad input returns clear `400` errors, and unknown routes/IDs return correct `404`s
- [ ] An invalid status change is rejected, and the compiler reminds you if a new status is added but not handled
- [ ] The app refuses to start with a bad `.env`
- [ ] Production build runs from `dist/` and stack traces show `.ts` lines
- [ ] You can explain the design to another developer out loud in 5 minutes

---

# Phase 2 Interview Question Bank

Practice these **out loud, in simple English**, in 60–90 seconds each. Use one analogy and one code example.

### Fundamentals (2.1)
1. What is TypeScript, and what does it not do?
2. What is type inference? When should you write types yourself?
3. `interface` vs `type`: what are the differences, and which do you use?
4. `any` vs `unknown` vs `never` vs `void`?
5. What is a union type? What is an intersection type?
6. Enums vs literal unions vs `as const` objects?
7. What is a tuple, and when would you use one?
8. What is structural typing?

### Functions and objects (2.2)
9. What are generics, and why do we need them?
10. What is a generic constraint? Give an example.
11. What does `keyof` do? What does `typeof` do in a type position?
12. What is an index signature? What does `noUncheckedIndexedAccess` change?
13. When would you use function overloads?
14. What is the difference between an optional parameter and a parameter with a default value?

### Advanced (2.3)
15. What are `Partial`, `Pick`, `Omit`, `Record`, and `ReturnType`?
16. What is a mapped type? What is a conditional type?
17. What is a discriminated union? How do you check that all cases are handled?
18. What is a type guard? Type predicate? Assertion function?
19. What does `strict` turn on? Name four flags.
20. Why do types not protect you at runtime? How do you fix that?
21. What is a `.d.ts` file? What is module augmentation? Give a real example.
22. What is the difference between `@ts-ignore` and `@ts-expect-error`?

### Backend standards (2.4)
23. Why separate DTOs, domain types, and database row types?
24. Why depend on a repository interface instead of a concrete database class?
25. How do you design errors in a backend? Where do you handle them?
26. Exceptions vs `Result` types: when do you use each?
27. How do you validate configuration at startup, and why?
28. How do you avoid `any`, and what do you do at the boundaries of a system?
29. What is the difference between CommonJS and ES modules in Node.js? What is different in imports with `NodeNext`?
30. What do source maps do, and why do you need `--enable-source-maps`?

### Predict the type (check your answers in your editor)

```ts
// 1
const x = [1, "a"];
// Answer: (string | number)[]

// 2
const t = ["a", 1] as const;
// Answer: readonly ["a", 1]

// 3
type K = keyof { a: 1; b: 2 };
// Answer: "a" | "b"

// 4
type P = Partial<{ a: number }>["a"];
// Answer: number | undefined

// 5
type E = Exclude<"a" | "b" | "c", "b">;
// Answer: "a" | "c"

// 6
async function n() { return 5; }
type R = Awaited<ReturnType<typeof n>>;
// Answer: number

// 7 (a trap): does this compile?
interface User { id: number; passwordHash: string }
type Public = Omit<User, "pasword">;   // typo
// Answer: YES, it compiles. Omit does not check the key. Public still has passwordHash.
```

```ts
// 8) The most important trap of the phase: what prints at RUNTIME?
const body = JSON.parse('{"age":"25"}') as { age: number };
console.log(body.age + 1);
// Answer: "251"  (a string!). The type says number, but nothing checked it.
```

---

# Weekly Study Method for Phase 2

Use this every week, for every section (from the roadmap):

| Day | Focus | What to do in Phase 2 |
|-----|-------|-----------------------|
| **Monday — Learn** | Definition, internals, examples | Read the topic. Draw the analogy. Read the official TypeScript handbook page for the same topic. |
| **Tuesday — Code** | Write without copying | Type every example. Change the types. Predict each editor hover before looking. |
| **Wednesday — Backend usage** | Use it in a Node.js project | Apply the topic to your capstone project (DTOs, generics, errors, config). |
| **Thursday — Debugging** | Break things on purpose | Cause type errors and read them slowly. Try to fix each one **without** `any` or `as`. |
| **Friday — Interview practice** | Answer out loud in simple English | Pick 5 questions from the bank. 60–90 seconds each. |
| **Saturday — Project work** | One meaningful feature | Implement one feature of the capstone. |
| **Sunday — Revision** | Review and record | Re-do 3 exercises from memory. Add new entries to `mistakes.md`. |

**Tip for reading errors:** read a TypeScript error **from the bottom line up**. The last line is usually the real reason.

---

# Top 10 TypeScript Backend Mistakes (Quick Review)

| # | Mistake | Better habit |
|---|---------|--------------|
| 1 | Turning `strict` off | `strict: true` plus `noUncheckedIndexedAccess` from day one |
| 2 | `req.body as SomeType` | Validate with a schema, then use the derived type |
| 3 | Using `any` to remove an error | Use `unknown`, generics, or fix the real type |
| 4 | Trusting `fetchJson<User>()` or typed `process.env` | Validate external data at the boundary |
| 5 | Returning database rows directly from the API | DTOs and mapper functions (allow-list of fields) |
| 6 | `Omit<T, "typo">` compiles silently | Prefer `Pick`, or derive keys from constants; add tests |
| 7 | Business logic depending on a concrete database class | Depend on a small interface, inject it |
| 8 | Throwing plain strings or leaking internal errors | `AppError` hierarchy and one central handler |
| 9 | Forgetting `.js` in ESM relative imports | Use `NodeNext` and follow the compiler's error |
| 10 | Clever type gymnastics nobody can read | Simple types first; keep advanced types small and documented |

---

# Phase 2 Exit Checklist

You are ready for **Phase 3 — Data Structures and Problem Solving** when you can do **all** of these without looking at notes:

**Concepts**
- [ ] Explain what TypeScript does, and what it cannot do at runtime
- [ ] Explain `any` vs `unknown`, and `interface` vs `type`
- [ ] Explain generics and constraints with a real backend example
- [ ] Explain discriminated unions and exhaustive `switch` with `never`
- [ ] Explain why external input must be validated at runtime
- [ ] Explain `strict` mode and the extra flags you always enable
- [ ] Explain DTO vs domain vs row types, and why they are separate
- [ ] Explain ESM vs CommonJS in Node.js and what `NodeNext` requires

**Skills**
- [ ] Write typed utilities (`groupBy`, `pick`, `withTimeout<T>`, `retry<T>`) with no `any`
- [ ] Derive Create/Update/Response types from one entity with utility types
- [ ] Write a validation schema and derive its TypeScript type
- [ ] Write an `AppError` hierarchy and a central error mapper
- [ ] Write a repository interface, an in-memory implementation, and tests
- [ ] Augment Express types with a `.d.ts` file
- [ ] Read a long type error and find the real cause

**Proof of work**
- [ ] Your Phase 1 utilities converted to TypeScript with `strict`
- [ ] Capstone "Typed Training Sessions API" finished, with tests and zero `any`
- [ ] At least 15 interview questions answered out loud in simple English
- [ ] New entries in your `mistakes.md` file

> **Reminder from the roadmap:** TypeScript types disappear at runtime. Validate external input with a runtime validation library or custom validation.

**Next:** Phase 3 — Data Structures and Problem Solving. You will solve problems in JavaScript or TypeScript, so keep your `strict` setup, because typed solutions are easier to reason about and to explain in interviews.

---

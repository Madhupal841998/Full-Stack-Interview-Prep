# Phase 1 — JavaScript from Zero to Advanced

> **Part of:** Backend Engineering Zero-to-Expert Roadmap
> **Comes after:** Phase 0 — Engineering Foundation
> **Comes next:** Phase 2 — TypeScript from Zero to Advanced
> **Priority:** Sections 1.1 to 1.5 are **MUST KNOW**. Section 1.6 is **IMPORTANT**.

---

## Why This Phase Matters

Everything in the backend roadmap (TypeScript, Node.js, Express, databases, queues) sits on top of JavaScript.
If JavaScript is weak, every later phase feels like magic. If JavaScript is strong, later phases feel like "the same ideas, bigger."

The most important ideas in this phase are:

1. How values are stored (primitive vs reference)
2. How functions remember things (closures)
3. How async code really runs (promises and the event loop)

> **One picture to keep in your head for the whole phase:**
> A Node.js server is like a **small restaurant with one chef**.
> The chef (the call stack) can cook only one dish at a time.
> Waiters (Node.js APIs) take slow jobs, like fetching ingredients (disk, network, database), and bring the result back later.
> Tickets wait in a line (the queues). The chef takes the next ticket only when his hands are free.
> If one dish takes 5 minutes of non-stop chef work, **every customer waits**.

---

## How To Use This Phase

For every topic, this file follows the same 12-step order from the roadmap:

| # | Step | What you do |
|---|------|-------------|
| 1 | Proper definition | Read the exact, correct meaning |
| 2 | Simple meaning | Understand it with a real-world analogy |
| 3 | Why it is needed | Know what problem it solves |
| 4 | How it works internally | See what JavaScript does behind the scenes |
| 5 | Syntax and API | Learn the exact code form |
| 6 | Small example | Run a tiny example yourself |
| 7 | Real backend usage | See where it appears in Node.js/Express work |
| 8 | Edge cases | Learn the strange behaviors |
| 9 | Common mistakes | Learn what breaks in real projects |
| 10 | Interview answer | Practice a short, clear answer |
| 11 | Practice problem | Write code without copying |
| 12 | Production considerations | Know what matters when real users depend on it |

Steps 5 and 6 are combined into one code block in this file.

**Priority labels used:**

- **MUST KNOW** — needed for backend work and interviews
- **IMPORTANT** — strongly recommended for professional work
- **GOOD TO KNOW** — useful after the core is clear
- **SKIP FOR NOW** — learn later

**Rule for practice:** type every example by hand. Do not copy and paste. Change the example, break it on purpose, and fix it.

---

## Phase 1 Map and Time Guide

| Section | Topic | Priority | Rough time (1–2 hrs/day) |
|---------|-------|----------|--------------------------|
| 1.1 | JavaScript Fundamentals | MUST KNOW | ~1 week |
| 1.2 | Functions and Execution | MUST KNOW | ~1 week |
| 1.3 | Objects, Arrays and Modern JavaScript | MUST KNOW | ~1 week |
| 1.4 | Asynchronous JavaScript | MUST KNOW | ~1.5 weeks |
| 1.5 | Event Loop and Internals | MUST KNOW | ~1 week |
| 1.6 | Advanced JavaScript | IMPORTANT | ~1.5 weeks |
| — | Phase 1 capstone project + revision | MUST KNOW | ~1 week |

The time is a guide, not a rule. If a section feels easy, do its practice tasks first. If you can finish them without help, move on.

**Setup for this phase:** Node.js (current LTS), VS Code, a folder named `phase-1-js/` with one folder per section (`1.1`, `1.2`, …). Run files with `node file.js`.

---

## Table of Contents

- [1.1 JavaScript Fundamentals](#11-javascript-fundamentals)
- [1.2 Functions and Execution](#12-functions-and-execution)
- [1.3 Objects, Arrays and Modern JavaScript](#13-objects-arrays-and-modern-javascript)
- [1.4 Asynchronous JavaScript](#14-asynchronous-javascript)
- [1.5 Event Loop and Internals](#15-event-loop-and-internals)
- [1.6 Advanced JavaScript](#16-advanced-javascript)
- [Phase 1 Capstone Project](#phase-1-capstone-project--mini-job-runner)
- [Phase 1 Interview Question Bank](#phase-1-interview-question-bank)
- [Phase 1 Exit Checklist](#phase-1-exit-checklist)

---

# 1.1 JavaScript Fundamentals

**Priority: MUST KNOW**

**Goal:** Write basic JavaScript without surprises. Know how values are stored, compared, and converted.

**Topics in this section:** variables → data types → primitive vs reference → operators → type coercion → truthy/falsy → conditions → loops → functions (first look) → scope → hoisting → strict mode.

---

## 1.1.1 Variables: `let`, `const`, `var`

1. **Definition** — A variable is a named place in memory that holds a value. `let` and `const` are *block-scoped*. `const` cannot be re-assigned. `var` is *function-scoped* and is the old way.
2. **Simple meaning** — A variable is a **labeled box**. `let` is a box where you can swap the contents. `const` is a box where the **label is glued on one box forever**. You cannot move the label to another box, but if the box holds a drawer (an object), you can still change what is inside the drawer.
3. **Why it is needed** — Programs need names for data, so we can store, read, and change it later.
4. **How it works internally** — Before running your code, JavaScript reads the scope and registers the names.
   - `var` is registered and set to `undefined` right away.
   - `let` and `const` are registered too, but you cannot touch them until the line where they are declared runs. The time before that line is called the **Temporal Dead Zone (TDZ)**. Touching them early throws a `ReferenceError`.
5. **Syntax and API + 6. Small example**

```js
const port = 3000;          // will not change
let retries = 0;            // will change
retries += 1;

const user = { name: "Asha" };
user.name = "Ravi";         // OK: the object inside is changed
// user = { name: "New" };  // TypeError: Assignment to constant variable

if (true) {
  var a = 1;                // leaks out of the block
  let b = 2;                // stays inside the block
}
console.log(a);             // 1
// console.log(b);          // ReferenceError: b is not defined

console.log(x);             // undefined  (var is hoisted)
var x = 5;
// console.log(y);          // ReferenceError (TDZ)
let y = 5;
```

7. **Real backend usage** — Use `const` for config values, imported modules, and most variables. Use `let` only when the value truly changes (counters, accumulators, loop state).
8. **Edge cases**
   - `const` protects the *variable*, not the *value*. Arrays and objects can still change.
   - `var` inside loops shares one variable for all iterations:

   ```js
   for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0); // 3 3 3
   for (let j = 0; j < 3; j++) setTimeout(() => console.log(j), 0); // 0 1 2
   ```
9. **Common mistakes** — Using `var` out of habit. Thinking `const` means "frozen." Forgetting to declare a variable (in non-strict code this creates an accidental global).
10. **Interview answer** — "`var` is function-scoped and hoisted with the value `undefined`. `let` and `const` are block-scoped and stay in the temporal dead zone until declared. `const` cannot be re-assigned, but the object it points to can still change. I use `const` by default and `let` only when I must re-assign."
11. **Practice problem** — Predict the output of 5 small snippets mixing `var`, `let`, `const`, and `setTimeout` in loops. Then run them and compare.
12. **Production considerations** — Turn on ESLint rules `no-var` and `prefer-const`. It catches accidental globals and re-assignments before they reach production.

---

## 1.1.2 Data Types, and Primitive vs Reference Values

1. **Definition** — JavaScript has **7 primitive types**: `string`, `number`, `bigint`, `boolean`, `undefined`, `null`, `symbol`. Everything else is an **object** (arrays, functions, dates, maps, and so on).
2. **Simple meaning**
   - A **primitive** is like a **photocopy**. When you give someone a copy, they can scribble on it and your paper stays clean.
   - A **reference** is like a **house address**. If two people have the same address, they walk into the *same house*. If one moves the sofa, the other sees it moved.
3. **Why it is needed** — You must know whether a change in one place will secretly change data somewhere else. Many real bugs come from this.
4. **How it works internally** — Primitives are stored directly in the variable. Objects are stored in memory (the *heap*), and the variable holds only the *address* (the reference). Assigning an object to another variable copies the address, not the object. `===` on objects compares addresses.
5. **Syntax and API + 6. Small example**

```js
// Primitives: copied by value
let a = 10;
let b = a;
b = 20;
console.log(a); // 10

// Objects: copied by reference
const u1 = { role: "admin" };
const u2 = u1;
u2.role = "user";
console.log(u1.role); // "user"  (same object!)

console.log({} === {});            // false (two different objects)
console.log(typeof "hi");          // "string"
console.log(typeof null);          // "object"  (old bug, cannot be fixed)
console.log(typeof []);            // "object"
console.log(Array.isArray([]));    // true
console.log(typeof function () {}); // "function"

console.log(0.1 + 0.2);                // 0.30000000000000004
console.log(Number.MAX_SAFE_INTEGER);  // 9007199254740991
console.log(10n ** 20n);               // BigInt: 100000000000000000000n
```

7. **Real backend usage**
   - **Money:** never store money as a float. Use whole numbers in the smallest unit (paise or cents), or `DECIMAL` in MySQL.
   - **Big IDs:** IDs larger than `Number.MAX_SAFE_INTEGER` lose precision as numbers. Keep them as strings (or `BigInt` in code).
   - **Dates:** send dates as ISO strings (`"2026-09-20T10:00:00Z"`) in JSON.
   - **Shared config objects:** passing one object to many functions means any function can change it for all.
8. **Edge cases**
   - `NaN !== NaN`. Use `Number.isNaN(x)`.
   - `typeof null` is `"object"`. Check with `x === null`.
   - You cannot mix `BigInt` and `number` in math (`1n + 1` throws `TypeError`).
   - `JSON.stringify` throws on `BigInt`.
   - `-0` exists, and `-0 === 0` is `true`.
9. **Common mistakes** — Using floats for money. Mutating an object that came in as a function argument. Using `typeof` to check for arrays or `null`.
10. **Interview answer** — "Primitives are stored by value, so copying gives an independent copy. Objects are stored by reference, so two variables can point to the same object and changes show in both. That is why comparing two objects with `===` checks identity, not content."
11. **Practice problem** — Write a function `updateUser(user)` that changes a field. Show how it changes the caller's object. Then rewrite it so it returns a new object and leaves the original unchanged.
12. **Production considerations** — Never trust `typeof` alone for validation. Store money as integers. Return IDs as strings in JSON if they can be large. Avoid mutating shared objects; return new ones.

---

## 1.1.3 Operators, Type Coercion, Truthy and Falsy

1. **Definition** — **Type coercion** is JavaScript automatically converting a value from one type to another during an operation. **Truthy/falsy** describes how a value behaves when used as a boolean (for example in an `if`).
2. **Simple meaning** — Coercion is like a **currency-exchange counter that converts money silently**. It is helpful, but sometimes the rate is bad and you lose money without noticing.
3. **Why it is needed** — JavaScript was designed to be forgiving. You must know the rules, or the forgiveness becomes bugs.
4. **How it works internally**
   - `+` : if either side is a string, it joins them as text. Otherwise it adds numbers.
   - `-`, `*`, `/` : always convert both sides to numbers.
   - `==` converts types before comparing. `===` does not convert (strict).
   - **The 8 falsy values:** `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`. **Everything else is truthy**, including `"0"`, `"false"`, `[]`, and `{}`.
5. **Syntax and API + 6. Small example**

```js
"5" + 1;          // "51"   (string join)
"5" - 1;          // 4      (number math)
[] + [];          // ""
null == undefined; // true
null === undefined; // false
0 == "";          // true   (surprise)
0 === "";         // false

Boolean([]);      // true
Boolean("0");     // true
Boolean("");      // false

Number("");       // 0
Number("12px");   // NaN
parseInt("12px"); // 12

// Useful modern operators
const page = req.query.page ?? 1;   // only null/undefined use the default
const name = user?.profile?.name;   // optional chaining
let count = 0;
count ||= 10;   // assigns only if count is falsy
count ??= 10;   // assigns only if count is null/undefined
2 ** 10;        // 1024
```

7. **Real backend usage** — Query-string and header values are **always strings**. `req.query.limit + 10` gives `"1010"`, not `20`. Convert and validate first. Use `??` for defaults so that `0` and `""` are kept as valid input.
8. **Edge cases**
   - `page = req.query.page || 1` turns a valid `0` into `1`. `??` does not.
   - `Number(null)` is `0`, `Number(undefined)` is `NaN`.
   - `[] == false` is `true`, but `[]` is truthy. Both are true at once. This is why we avoid `==`.
   - `x == null` is `true` for both `null` and `undefined` (the one accepted use of `==`).
9. **Common mistakes** — Using `||` for defaults when `0` or empty string is valid. Comparing user input strings to numbers with `==`. Forgetting that `"10" > "9"` is `false` (text comparison).
10. **Interview answer** — "Coercion is JavaScript's automatic type conversion. `+` prefers string joining, other math operators convert to numbers. I use `===` so no hidden conversion happens, and `??` instead of `||` for defaults so that valid values like `0` are not replaced."
11. **Practice problem** — Predict the result of 15 coercion expressions (`[] + {}`, `"3" * "4"`, `true + 1`, `null + 1`, and so on). Then write a function `toPositiveInt(input, fallback)` that safely converts request input.
12. **Production considerations** — Always convert and validate external input at the edge of your app. Use `===` everywhere. Turn on the ESLint rule `eqeqeq`.

---

## 1.1.4 Conditions and Loops

1. **Definition** — **Conditions** (`if/else`, `switch`, ternary) choose which code runs. **Loops** (`for`, `while`, `do...while`, `for...of`, `for...in`) repeat code.
2. **Simple meaning** — A condition is a **traffic signal**: red, stop; green, go. A loop is **washing a pile of dishes**: pick one, wash it, repeat until the pile is empty.
3. **Why it is needed** — Programs must make decisions and work through lists of data.
4. **How it works internally**
   - `switch` compares using `===`. Without `break`, execution *falls through* into the next case.
   - `for...of` uses the **iterator protocol**, so it works on arrays, strings, Maps, Sets, and generators.
   - `for...in` walks **enumerable property names (as strings)**, including inherited ones. Use it only for plain objects, and rarely.
5. **Syntax and API + 6. Small example**

```js
// Guard clauses: return early instead of deep nesting
function getDiscount(user) {
  if (!user) return 0;
  if (!user.isActive) return 0;
  return user.isPremium ? 20 : 5;
}

// switch on an event type
function handleEvent(type) {
  switch (type) {
    case "USER_CREATED":
      return "send welcome email";
    case "USER_DELETED":
      return "clean up data";
    default:
      return "ignore";
  }
}

const ids = [101, 102, 103];
for (const id of ids) {              // values
  console.log(id);
}
for (const [index, id] of ids.entries()) { // index + value
  console.log(index, id);
}

const scores = { asha: 90, ravi: 75 };
for (const [name, score] of Object.entries(scores)) {
  console.log(name, score);
}

let n = 0;
while (n < 3) n++;
```

7. **Real backend usage** — Guard clauses at the top of controllers (`if (!req.body.email) return res.status(400)...`). `switch` for event types or status codes. `for...of` to process rows in a batch.
8. **Edge cases**
   - `for...in` on an array gives indexes as **strings** (`"0"`, `"1"`).
   - `break` and `continue` work in `for`, `while`, `for...of`. They **do not** work inside `forEach`.
   - `forEach` **does not wait** for `await` inside it (more in 1.4).
9. **Common mistakes** — Forgetting `break` in `switch`. Infinite `while` loops. Changing an array while looping over it. Using `await` inside `forEach` and expecting it to wait.
10. **Interview answer** — "`for...of` loops over values of any iterable. `for...in` loops over property names, including inherited ones, so I avoid it for arrays. I use guard clauses to keep `if` nesting flat."
11. **Practice problem** — Write `paginate(items, page, pageSize)` using a loop, then rewrite it with `slice`. Write a `switch`-based status-code-to-message function.
12. **Production considerations** — Put a limit on every loop that depends on external data. Prefer guard clauses to keep controllers readable.

---

## 1.1.5 Functions (First Look)

1. **Definition** — A function is a reusable block of code that takes input (parameters), does work, and can return a value.
2. **Simple meaning** — A function is a **recipe card**. Give it ingredients (arguments) and it gives you a dish (return value). You can use the same card many times.
3. **Why it is needed** — Without functions, you would copy the same code everywhere.
4. **How it works internally** — Each time a function is called, JavaScript creates a new *execution context* (its own workspace) and puts it on the call stack. When the function returns, the workspace is removed. (Full detail in 1.2.)
5. **Syntax and API + 6. Small example**

```js
function add(a, b) {
  return a + b;
}
console.log(add(2, 3)); // 5
console.log(add(2));    // NaN  (b is undefined)
```

7. **Real backend usage** — Small, single-purpose functions: `validateEmail()`, `hashPassword()`, `buildPagination()`.
8. **Edge cases** — A function with no `return` gives `undefined`. Missing arguments become `undefined`.
9. **Common mistakes** — Writing one giant function that does everything. Forgetting `return`.
10. **Interview answer** — "A function is a reusable unit of code. In JavaScript, functions are values, so I can store them in variables, pass them as arguments, and return them from other functions."
11. **Practice problem** — Write 5 small functions: `isEven`, `clamp(n, min, max)`, `slugify(text)`, `sum(...nums)`, `formatPrice(paise)`.
12. **Production considerations** — Keep functions small and named clearly. One job per function makes testing easy.

---

## 1.1.6 Scope and Hoisting

1. **Definition** — **Scope** decides where a variable can be seen. **Hoisting** is JavaScript registering declarations at the top of their scope before running the code.
2. **Simple meaning**
   - **Scope** is like **rooms in a house with one-way glass**. From inside a room you can see out into the hallway and the house. From the hallway you cannot see inside the room.
   - **Hoisting** is like a **class attendance sheet written before class starts**. The names are already on the sheet (declared), but the students have not arrived yet (no value assigned).
3. **Why it is needed** — Scope stops variables from clashing. Understanding hoisting explains many "why is this `undefined`?" bugs.
4. **How it works internally**
   - Scope types: **global**, **function**, **block** (`let`/`const`), and **module** (each file in Node.js).
   - When JavaScript looks for a variable, it checks the current scope, then the outer scope, then the next, until the global scope. This is the **scope chain**.
   - Hoisting results:
     - Function declarations → fully hoisted (you can call them before they appear).
     - `var` → hoisted, value is `undefined`.
     - `let`/`const`/`class` → hoisted but in the TDZ (cannot be used before declaration).
5. **Syntax and API + 6. Small example**

```js
sayHi();                      // works
function sayHi() { console.log("hi"); }

// hello();                   // TypeError: hello is not a function
var hello = function () {};

const secret = "global";
function outer() {
  const inner = "outer-level";
  function deep() {
    console.log(secret, inner); // can see both (scope chain)
  }
  deep();
}
outer();
// console.log(inner);        // ReferenceError
```

7. **Real backend usage** — Each Node.js file is its own module scope, so top-level variables in one file do not leak to another. This is why we use `module.exports` / `export`.
8. **Edge cases** — A function expression assigned to `var` is hoisted as `undefined` (not as a function). Inner variables can *shadow* outer ones with the same name.
9. **Common mistakes** — Calling a `const` arrow function before its line. Accidentally shadowing a variable. Creating globals by forgetting `const`.
10. **Interview answer** — "Scope is where a name is visible, and JavaScript resolves names by walking outward through the scope chain. Hoisting means declarations are registered before code runs: function declarations fully, `var` as `undefined`, and `let`/`const` in the temporal dead zone."
11. **Practice problem** — Write 6 snippets that mix hoisting of functions, `var`, `let`, and function expressions. Predict each output before running.
12. **Production considerations** — Declare things before you use them, even when hoisting would allow it. It keeps code readable and avoids TDZ errors.

---

## 1.1.7 Strict Mode

1. **Definition** — Strict mode is an opt-in mode (`"use strict"`) that turns some silent mistakes into real errors and removes a few unsafe features.
2. **Simple meaning** — It is a **strict teacher**. Sloppy mode says "okay, fine" to your mistakes. Strict mode says "that is wrong, fix it."
3. **Why it is needed** — It catches bugs early, like typos in variable names.
4. **How it works internally** — The engine changes a few rules: assigning to an undeclared variable throws, duplicate parameter names throw, and `this` inside a plain function call is `undefined` (not the global object).
5. **Syntax and API + 6. Small example**

```js
"use strict";

// undeclaredVar = 5;   // ReferenceError in strict mode
function show() {
  console.log(this);    // undefined in strict mode
}
show();
```

7. **Real backend usage** — ES modules (`import`/`export`) and classes are **always strict**. TypeScript output usually adds it for you. In CommonJS files, add `"use strict";` at the top if you are not in a module.
8. **Edge cases** — The directive must be at the top of the file or function to work. Strict mode applies to the whole file (or function) where it is set.
9. **Common mistakes** — Thinking it is a linter. It only changes a few rules.
10. **Interview answer** — "Strict mode makes JavaScript throw on silent mistakes, like using undeclared variables, and stops `this` from defaulting to the global object. Modules and classes are strict by default."
11. **Practice problem** — Write a file with 4 common sloppy-mode mistakes. Turn on strict mode and note which ones now throw.
12. **Production considerations** — Use ES modules or TypeScript so you get strict behavior without thinking about it.

---

## 1.1 Practice Projects

**Project A — Command-line calculator** (`node calc.js 12 + 5`)
- Read arguments from `process.argv`
- Support `+ - * / %`
- Reject bad input with clear messages
- Handle division by zero

**Project B — User input validator**
- Function `validateUser(input)` that checks `name`, `email`, `age`, `phone`
- Returns `{ valid: boolean, errors: string[] }`
- Never throws on bad input, and never mutates the input

**Solve 30 basic problems** (write each one yourself, then test edge cases):

| Group | Problems |
|-------|----------|
| Numbers | 1. even/odd · 2. FizzBuzz · 3. factorial · 4. prime check · 5. sum of digits · 6. reverse a number · 7. GCD of two numbers · 8. nth Fibonacci |
| Strings | 9. reverse a string · 10. palindrome check · 11. count vowels · 12. capitalize each word · 13. most frequent character · 14. anagram check · 15. remove duplicate characters · 16. truncate text with "..." |
| Arrays | 17. find max/min without `Math.max` · 18. sum of array · 19. remove duplicates · 20. second largest · 21. merge two sorted arrays · 22. rotate array by k · 23. flatten one level · 24. chunk array into groups |
| Objects and logic | 25. word frequency count · 26. swap object keys and values · 27. get a value by path string (`"a.b.c"`) · 28. validate email/phone format · 29. cart total with discount · 30. check if two objects have the same keys |

**1.1 is done when you can:**
- [ ] Explain `var` vs `let` vs `const` with a TDZ example
- [ ] Explain primitive vs reference with a bug example
- [ ] Predict coercion results without running the code
- [ ] Explain hoisting and scope chain in your own words

---

# 1.2 Functions and Execution

**Priority: MUST KNOW**

**Goal:** Understand how functions run, how they remember their surroundings (closures), and how they can be passed around like values.

**Topics in this section:** function forms → arrow functions and `this` → parameters, defaults, rest and spread → call stack and execution context → lexical scope and closures → higher-order functions and callbacks → IIFE.

---

## 1.2.1 Function Declarations, Expressions and Arrow Functions

1. **Definition**
   - **Declaration:** `function name() {}` — hoisted fully.
   - **Expression:** a function stored in a variable, `const f = function () {}` — not hoisted as a function.
   - **Arrow function:** a shorter form, `const f = () => {}`, with **no own `this`**, no own `arguments`, and it cannot be used with `new`.
2. **Simple meaning** — All three are recipe cards. The arrow function is a **short note on a sticky pad** — quick to write, but it does not have its own "who am I?" (`this`). It borrows that from the place where it was written.
3. **Why it is needed** — Different forms fit different jobs. Arrow functions are perfect for short callbacks. Normal functions are needed when you want your own `this` (for example object methods and constructors).
4. **How it works internally** — A normal function decides `this` **when it is called** (depends on how you call it). An arrow function decides `this` **when it is written** (it uses the `this` of the surrounding code, called *lexical this*).
5. **Syntax and API + 6. Small example**

```js
function add(a, b) { return a + b; }           // declaration
const sub = function (a, b) { return a - b; }; // expression
const mul = (a, b) => a * b;                   // arrow, implicit return
const makeUser = (name) => ({ name });         // returning an object needs ( )

const timer = {
  seconds: 0,
  startBad() {
    setTimeout(function () {
      this.seconds++;                // `this` is NOT timer here
      console.log(this.seconds);     // NaN or wrong
    }, 100);
  },
  startGood() {
    setTimeout(() => {
      this.seconds++;                // arrow uses timer's `this`
      console.log(this.seconds);     // 1
    }, 100);
  },
};
```

7. **Real backend usage** — Arrow functions for `.map`, `.filter`, Express middleware helpers, and promise callbacks. Normal methods (or classes) for services where `this` holds dependencies.
8. **Edge cases**
   - Arrow functions cannot be used as constructors (`new` throws).
   - Arrow functions have no `arguments` object (use rest parameters).
   - `call`, `apply`, and `bind` cannot change an arrow function's `this`.
   - Arrow functions are a poor choice for object methods that need `this` to be the object.
9. **Common mistakes** — Forgetting the `( )` when returning an object literal from an arrow. Using an arrow as an object method and getting the wrong `this`. Passing `obj.method` as a callback and losing `this`.
10. **Interview answer (why arrow functions behave differently with `this`)** — "A normal function gets its `this` at call time, based on how it is called. An arrow function has no `this` of its own. It uses the `this` from the place where it was written. This is why arrows are good for callbacks inside methods, and bad as object methods."
11. **Practice problem** — Create a class `Counter` with a method that uses `setTimeout`. Make it fail with a normal function, then fix it in two ways: an arrow function, and `.bind(this)`.
12. **Production considerations** — Pick one style for your team. A common style: arrow functions for callbacks and small helpers, normal `function` or class methods for named, exported logic.

---

## 1.2.2 Parameters, Arguments, Default Values, Rest and Spread

1. **Definition** — **Parameters** are the names in the function definition. **Arguments** are the actual values you pass. A **default parameter** is used when the argument is `undefined`. **Rest** (`...args`) collects extra arguments into an array. **Spread** (`...arr`) expands an array or object into separate items.
2. **Simple meaning** — Parameters are **empty slots on a form**. Arguments are **what you write in them**. Rest is a **"put everything else in this bag"**. Spread is **"empty the bag onto the table."**
3. **Why it is needed** — Flexible functions, safe defaults, and easy copying and merging of data.
4. **How it works internally** — Missing arguments become `undefined`. A default is used **only** for `undefined` (not for `null`, `0`, or `""`). Spread makes a **shallow** copy (only the first level).
5. **Syntax and API + 6. Small example**

```js
function createUser(name, role = "viewer", { active = true } = {}) {
  return { name, role, active };
}
createUser("Asha");                          // { name: "Asha", role: "viewer", active: true }
createUser("Ravi", "admin", { active: false });

function sum(...nums) {                      // rest
  return nums.reduce((total, n) => total + n, 0);
}
sum(1, 2, 3);                                // 6

const defaults = { limit: 10, sort: "asc" };
const options = { ...defaults, limit: 50 };  // spread: later value wins
const both = [...[1, 2], ...[3, 4]];         // [1, 2, 3, 4]
Math.max(...[4, 9, 2]);                      // 9
```

7. **Real backend usage** — Merging default config with user config. Building query options. Passing a variable number of IDs. Using an **options object** for functions with many parameters, instead of a long list.
8. **Edge cases**
   - `null` does not trigger a default. Only `undefined` does.
   - Defaults are evaluated at call time, and can use earlier parameters.
   - Spread copies only the first level. Nested objects are still shared.
   - The rest parameter must be last.
9. **Common mistakes** — Functions with 6 positional parameters that are easy to mix up. Expecting a default for `null`. Thinking spread makes a deep copy.
10. **Interview answer** — "Default parameters apply only when the argument is `undefined`. Rest gathers extra arguments into a real array. Spread expands values, and it makes a shallow copy."
11. **Practice problem** — Write `mergeConfig(defaults, overrides)` that returns a new object and does not change either input. Write `logger(level, ...messages)`.
12. **Production considerations** — Use an options object for anything with more than 3 parameters. Keep the "required" parameters positional and the rest in options.

---

## 1.2.3 Call Stack and Execution Context

1. **Definition** — The **call stack** is the list of functions currently running. An **execution context** is the workspace JavaScript creates for a piece of running code. It holds the variables, the scope chain, and the value of `this`.
2. **Simple meaning** — Think of a **stack of plates**. You put a new plate on top when a function is called, and take the top plate off when it finishes. You can only work on the **top plate**. Or think of the chef with one order at a time: the current order is on top.
3. **Why it is needed** — It explains the order of execution, what "stack overflow" means, and why one long task blocks everything.
4. **How it works internally**
   - JavaScript first creates the **global execution context**.
   - Each function call creates a new **function execution context**, which has two phases: a *creation phase* (register variables, set up scope chain and `this`) and an *execution phase* (run the code line by line).
   - When a function finishes, its context is popped off the stack.
   - If calls go too deep (usually endless recursion), you get `RangeError: Maximum call stack size exceeded`.
5. **Syntax and API + 6. Small example**

```js
function third()  { console.log("third");  }
function second() { third(); console.log("second"); }
function first()  { second(); console.log("first"); }
first();
// Stack grows:   first → second → third
// Output order:  third, second, first

function forever() { return forever(); }
// forever();      // RangeError: Maximum call stack size exceeded
```

7. **Real backend usage** — Reading an error stack trace is reading the call stack. It tells you which function called which. Recursive functions (walking folder trees, nested comments) need a base case to stop.
8. **Edge cases** — Recursion depth is limited (about ten thousand frames, and it depends on the engine and frame size). Async callbacks run later, so they have a **new, short stack**, and the original stack is gone. This is why async stack traces can look odd.
9. **Common mistakes** — Recursion without a base case. Not reading the stack trace from top to bottom when debugging.
10. **Interview answer** — "The call stack tracks running functions, last in, first out. Each call creates an execution context with its variables, scope chain, and `this`. JavaScript can only run the top one, which is why long synchronous work blocks everything else."
11. **Practice problem** — Draw the stack for a 3-level call chain on paper. Then trigger a stack overflow on purpose and read the error. Convert a deep recursion into a loop.
12. **Production considerations** — Avoid unbounded recursion on user-controlled input (for example deeply nested JSON). Use loops or an explicit stack for large data.

---

## 1.2.4 Lexical Scope and Closures

1. **Definition**
   - **Lexical scope:** a function can use variables from the place where it was **written** (not where it is called).
   - **Closure:** a function together with the variables from its outer scope that it remembers, even after the outer function has finished.
2. **Simple meaning** — A closure is like a **backpack**. When a function is created, it packs the variables it might need from its birthplace. Even if it travels far away, the backpack goes with it. Another picture: a **bank locker** — the function holds the key, so it can still open the locker after the bank employee who set it up has left.
3. **Why it is needed** — Closures give you **private data**, **function factories**, **memoization**, **debounce/throttle**, and most async callback logic.
4. **How it works internally** — When a function is created, it stores a hidden link to the scope where it was created. When the outer function returns, its variables are **not** deleted if the inner function still uses them. They stay alive in memory as long as the inner function exists.
5. **Syntax and API + 6. Small example**

```js
function createCounter() {
  let count = 0;                 // private, cannot be reached from outside
  return {
    increment: () => ++count,
    get: () => count,
  };
}
const counter = createCounter();
counter.increment();
counter.increment();
console.log(counter.get());      // 2
// console.log(count);           // ReferenceError

// Function factory
function createRateLimiter(maxCalls) {
  let calls = 0;
  return function allow() {
    calls++;
    return calls <= maxCalls;
  };
}
const limiter = createRateLimiter(2);
limiter(); // true
limiter(); // true
limiter(); // false

// Memoize: cache results of a slow pure function
function memoize(fn) {
  const cache = new Map();
  return (arg) => {
    if (cache.has(arg)) return cache.get(arg);
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}
```

7. **Real backend usage** — Config-aware helpers (`createLogger("orders-service")`), rate limiters, caches, middleware factories like `requireRole("admin")`, and every callback that uses a variable from the outer function.
8. **Edge cases**
   - **Loop trap:** `var` in a loop gives all closures the same variable. `let` gives each iteration a new one.
   - A closure keeps the **variable** alive, not just its value at that moment. If the variable changes later, the closure sees the new value.
   - A closure can keep a **large object** alive longer than you expect (memory leak risk).
9. **Common mistakes** — The `var` loop trap. Creating closures that hold huge objects forever. Thinking a closure copies the value (it keeps a live link to the variable).
10. **Interview answer** — "A closure is a function that remembers the variables from the scope where it was created, even after that scope has finished. A practical example is a counter factory: the `count` variable is private, and only the returned functions can read or change it."
11. **Practice problem** — Build: (a) a `once(fn)` wrapper that runs `fn` only the first time, (b) a `createCounter` with `increment`, `decrement`, `reset`, (c) a `memoize` that handles multiple arguments, (d) a `requireRole(role)` middleware factory.
12. **Production considerations** — Be careful with closures inside long-lived objects (caches, event listeners, timers). They can keep memory alive. Unbounded caches are a memory leak. Give them a size limit or an expiry.

---

## 1.2.5 Higher-Order Functions and Callbacks

1. **Definition** — A **higher-order function** takes a function as an argument, returns a function, or both. A **callback** is a function you pass to another function to be called later.
2. **Simple meaning** — A callback is like **leaving your phone number at a restaurant**: "Call me when the table is ready." You do not wait at the door. The higher-order function is the restaurant that promises to call.
3. **Why it is needed** — Functions are values in JavaScript. This lets us write reusable logic (`map`, `filter`, middleware, event handlers) and handle "do this when that finishes."
4. **How it works internally** — A function value is just an object that can be stored and passed around. Passing it does not run it. It runs when the receiving code calls it with `( )`.
5. **Syntax and API + 6. Small example**

```js
// Function as argument
[1, 2, 3].map((n) => n * 2);          // [2, 4, 6]

// Function returned from function
const multiplyBy = (factor) => (n) => n * factor;
const double = multiplyBy(2);
double(5);                            // 10

// A simple higher-order wrapper: add timing to any function
function withTiming(fn) {
  return async (...args) => {
    const start = Date.now();
    try {
      return await fn(...args);
    } finally {
      console.log(`${fn.name} took ${Date.now() - start}ms`);
    }
  };
}

// Node.js error-first callback style
const fs = require("node:fs");
fs.readFile("data.txt", "utf8", (err, data) => {
  if (err) return console.error(err);
  console.log(data);
});
```

7. **Real backend usage** — Express middleware is a higher-order pattern. Wrappers for logging, retry, timeouts, and try/catch (`asyncHandler(fn)`). Older Node.js APIs use error-first callbacks.
8. **Edge cases**
   - Passing `fn()` instead of `fn` runs it immediately (a very common mistake).
   - **Callback hell:** deeply nested callbacks that are hard to read (solved by promises in 1.4).
   - A callback can be called **zero, one, or many times**, so document what your function does.
9. **Common mistakes** — Calling the function instead of passing it. Forgetting to handle the `err` argument. Calling a callback twice by accident.
10. **Interview answer** — "A higher-order function accepts or returns another function. It lets me pass behavior as data. `map` and `filter` are examples, and so is an Express middleware wrapper."
11. **Practice problem** — Write your own `map`, `filter`, and `reduce`. Write `asyncHandler(fn)` that catches errors from an async Express handler and passes them to `next`.
12. **Production considerations** — Always handle errors in callbacks. Prefer promises and `async/await` for new code. Keep wrappers small and transparent, and keep the wrapped function's name and errors easy to see.

---

## 1.2.6 IIFE (Immediately Invoked Function Expression)

1. **Definition** — An IIFE is a function that is created and run in the same step.
2. **Simple meaning** — It is like a **pop-up stall** that opens, does its job, and packs up. Nothing is left behind on the street (no global variables).
3. **Why it is needed** — Before ES modules existed, an IIFE created a private scope, so variables did not leak to the global scope. Today it is mostly used for one-time setup and for using `await` at the top level of a CommonJS file.
4. **How it works internally** — Wrapping the function in `( )` makes it an *expression*, and the last `( )` calls it.
5. **Syntax and API + 6. Small example**

```js
(function () {
  const secret = "hidden";
  console.log("runs once");
})();

(() => {
  console.log("arrow IIFE");
})();

// Async IIFE: a common pattern to run await in a CommonJS entry file
(async () => {
  try {
    const data = await loadSomething();
    console.log(data);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
```

7. **Real backend usage** — A `main()` bootstrap in an old CommonJS entry file. One-off scripts and database seed scripts.
8. **Edge cases** — Missing semicolons before a line that starts with `(` can join two statements by mistake. ES modules support top-level `await`, so you need this trick less.
9. **Common mistakes** — Forgetting the outer `( )`. Forgetting `try/catch` in an async IIFE, so a failure becomes an unhandled rejection.
10. **Interview answer** — "An IIFE is a function that runs as soon as it is defined. It creates a private scope so variables do not leak. Today I mostly use it for async bootstrap code."
11. **Practice problem** — Build a module-pattern object (a private counter with public methods) using an IIFE. Then rewrite it as an ES module and compare.
12. **Production considerations** — Always catch errors in an async IIFE and set a non-zero exit code on failure.

---

## 1.2 Practice Projects

- **Middleware pipeline:** write `compose(...fns)` that runs functions in order on a `context` object, with a `next` function (a mini Express).
- **Utility library:** `once`, `memoize`, `pipe`, `curry`, `partial`, `debounce` (see 1.6).
- **Function factory set:** `createLogger(prefix)`, `createRateLimiter(max)`, `requireRole(role)`.

**1.2 is done when you can:**
- [ ] Explain a closure with a real example (no copy-paste)
- [ ] Explain lexical scope and the scope chain
- [ ] Explain why arrow functions and normal functions differ for `this`
- [ ] Draw the call stack for a 3-level call

---

# 1.3 Objects, Arrays and Modern JavaScript

**Priority: MUST KNOW**

**Goal:** Handle real API data confidently: create, read, transform, copy, and group objects and arrays without accidental changes.

**Topics in this section:** object creation → destructuring → optional chaining and nullish coalescing → object methods → array methods → sorting → shallow vs deep copy → immutability → `Map`, `Set`, `WeakMap`, `WeakSet`.

---

## 1.3.1 Objects, Destructuring, Optional Chaining, Nullish Coalescing

1. **Definition** — An **object** is a collection of key-value pairs. **Destructuring** pulls values out of objects/arrays into variables. **Optional chaining** (`?.`) safely reads deep properties. **Nullish coalescing** (`??`) gives a default only for `null` or `undefined`.
2. **Simple meaning** — An object is a **form with labeled fields**. Destructuring is **taking specific fields off the form**. Optional chaining is **knocking before you enter each room** — if a room does not exist, you stop and get `undefined` instead of crashing.
3. **Why it is needed** — API data is nested and often incomplete. These features let you read it safely with less code.
4. **How it works internally** — `a?.b` checks whether `a` is `null` or `undefined`. If so, the whole chain stops and returns `undefined`. `??` returns the right side only when the left side is `null` or `undefined`.
5. **Syntax and API + 6. Small example**

```js
const user = {
  id: 1,
  name: "Asha",
  address: { city: "Mumbai" },
  tags: ["admin", "dev"],
  greet() { return `Hi ${this.name}`; },   // method shorthand
};

// Destructuring with rename + default
const { name, address: { city }, role = "viewer" } = user;
const [firstTag, ...otherTags] = user.tags;

// Function parameter destructuring
function printUser({ name, age = 18 }) {
  console.log(name, age);
}

// Optional chaining + nullish coalescing
const zip = user.address?.zip ?? "not provided";
const firstItem = response?.data?.items?.[0];
const result = user.someMethod?.();             // call only if it exists

// Computed keys, shorthand
const key = "status";
const update = { [key]: "active", name };       // { status: "active", name: "Asha" }
```

7. **Real backend usage** — Reading `req.body`, `req.params`, and third-party API responses. Picking only the fields you want to return. Setting defaults for optional input.
8. **Edge cases**
   - Destructuring `null` or `undefined` throws a `TypeError`. `const { a } = null` fails.
   - `?.` does not protect against wrong types (for example, calling a non-function).
   - Property order: integer-like keys come first in ascending order, then string keys in insertion order.
9. **Common mistakes** — Using `||` instead of `??` and losing `0`, `false`, or `""`. Destructuring a value that might be `undefined` without a default (`= {}`). Using `?.` to hide real bugs.
10. **Interview answer** — "Destructuring lets me pull fields out of objects and arrays directly. Optional chaining stops safely at `null` or `undefined`. Nullish coalescing gives a default only for `null` or `undefined`, so `0` and empty string are kept."
11. **Practice problem** — Take a nested API response and write `toUserDTO(response)` that returns only `id`, `name`, `city`, and `firstTag`, with safe defaults for any missing field.
12. **Production considerations** — Never return raw database rows or full external responses to clients. Pick fields explicitly (allow-list). Do not use `?.` to silence errors you should handle.

---

## 1.3.2 Object Methods

1. **Definition** — Built-in helpers on `Object` for reading, copying, and locking objects.
2. **Simple meaning** — A **toolbox for the form**: list all the labels, list all the values, copy the form, or lock it.
3. **Why it is needed** — You will often loop over, convert, merge, and protect objects.
4. **How it works internally** — `Object.keys/values/entries` only return **own, enumerable** properties. `Object.assign` and spread copy only the first level. `Object.freeze` blocks changes at the top level only (shallow).
5. **Syntax and API + 6. Small example**

```js
const order = { id: 7, status: "paid", total: 499 };

Object.keys(order);      // ["id", "status", "total"]
Object.values(order);    // [7, "paid", 499]
Object.entries(order);   // [["id", 7], ["status", "paid"], ["total", 499]]

// entries + fromEntries = transform an object
const doubled = Object.fromEntries(
  Object.entries({ a: 1, b: 2 }).map(([k, v]) => [k, v * 2])
); // { a: 2, b: 4 }

const merged = Object.assign({}, order, { status: "shipped" });
const same   = { ...order, status: "shipped" };      // preferred

Object.hasOwn(order, "id");   // true (safer than obj.hasOwnProperty)

const config = Object.freeze({ retries: 3 });
config.retries = 5;           // ignored (throws in strict mode)
```

7. **Real backend usage** — Removing sensitive fields (`password`) before sending a response. Converting query params to a filter object. Freezing constant config.
8. **Edge cases** — `Object.freeze` is shallow: nested objects can still change. Keys are always strings or symbols. Objects created with `Object.create(null)` have no prototype, so they are safe as pure dictionaries.
9. **Common mistakes** — Assuming `freeze` makes everything deeply read-only. Using a plain object as a map with user-controlled keys (risk of `__proto__` tricks).
10. **Interview answer** — "`Object.entries` gives key-value pairs, so I can loop or transform an object and turn it back with `Object.fromEntries`. `Object.freeze` is shallow, so nested objects still need care."
11. **Practice problem** — Write `pick(obj, keys)`, `omit(obj, keys)`, and `mapValues(obj, fn)` without any library.
12. **Production considerations** — Use `Map` (see 1.3.6) for dictionaries with user-controlled keys. Always allow-list fields that go to clients or into database queries.

---

## 1.3.3 Array Methods: `map`, `filter`, `reduce`, `find`, `some`, `every`, `flatMap`

1. **Definition** — Array methods that take a callback and process each element without a manual loop.
2. **Simple meaning** — An **assembly line**:
   - `map` = paint every item a new color (same count, changed items)
   - `filter` = keep only the good items
   - `reduce` = combine everything into one result (like a total bill)
   - `find` = pick the first match
   - `some` = "does *any* item pass?"
   - `every` = "do *all* items pass?"
   - `flatMap` = map, then flatten one level
3. **Why it is needed** — Shorter, clearer data transformation than hand-written loops.
4. **How it works internally** — Each method calls your callback with `(item, index, array)`. `map` and `filter` return **new arrays** (they do not change the original). `find`, `some`, and `every` **stop early** when the answer is known. `reduce` carries an *accumulator* from one step to the next.
5. **Syntax and API + 6. Small example**

```js
const orders = [
  { id: 1, user: "asha", total: 300, paid: true },
  { id: 2, user: "ravi", total: 150, paid: false },
  { id: 3, user: "asha", total: 500, paid: true },
];

orders.map((o) => o.total);                     // [300, 150, 500]
orders.filter((o) => o.paid);                   // orders 1 and 3
orders.find((o) => o.id === 2);                 // the order object, or undefined
orders.some((o) => !o.paid);                    // true
orders.every((o) => o.total > 100);             // true
orders.flatMap((o) => [o.id, o.total]);         // [1, 300, 2, 150, 3, 500]

// reduce: total
const total = orders.reduce((sum, o) => sum + o.total, 0);   // 950

// reduce: group by user
const byUser = orders.reduce((acc, o) => {
  (acc[o.user] ??= []).push(o);
  return acc;
}, {});

// Remove duplicates
const unique = [...new Set([1, 2, 2, 3])];      // [1, 2, 3]

// Newer Node.js versions also have Object.groupBy(orders, (o) => o.user)
```

7. **Real backend usage** — Turning database rows into API responses, building filters, computing totals, grouping records, and checking permissions (`roles.some(...)`).
8. **Edge cases**
   - `reduce` on an empty array **without** an initial value throws a `TypeError`. Always give an initial value.
   - `forEach` returns `undefined` and cannot be stopped early.
   - `map` with `async` callbacks returns an array of **promises** (use `Promise.all`).
   - `find` returns `undefined` if nothing matches (`filter` returns `[]`).
9. **Common mistakes** — Using `map` when you do not use its result (use `forEach` or `for...of`). Chaining many methods on a huge array (many passes). Mutating items inside `map`.
10. **Interview answer** — "`map` transforms each item into a new array of the same length. `filter` keeps items that pass a test. `reduce` folds all items into a single value. They return new arrays and do not change the original."
11. **Practice problem** — Group records by a property, remove duplicates by a key (not just by value), build pagination and filtering (`?status=paid&page=2&limit=10`), and transform an API response into a lookup object by ID.
12. **Production considerations** — For huge data sets, prefer one pass (a single loop or `reduce`) over long method chains. For big lists in memory, use streams or paginate at the database (see later phases).

---

## 1.3.4 Sorting

1. **Definition** — `Array.prototype.sort` orders array items using a compare function.
2. **Simple meaning** — Like **arranging students in a line by height**. You must tell it *how* to compare two students.
3. **Why it is needed** — Lists in APIs are almost always ordered (latest first, by name, by price).
4. **How it works internally** — Without a compare function, `sort` turns items into **strings** and compares them, so numbers sort wrongly. The compare function `(a, b) => ...` returns a negative number (a first), positive (b first), or zero (keep order). `sort` **changes the original array** (in place). The sort is stable in modern engines (equal items keep their order).
5. **Syntax and API + 6. Small example**

```js
[10, 9, 1].sort();                     // [1, 10, 9]   (string order!)
[10, 9, 1].sort((a, b) => a - b);      // [1, 9, 10]
[10, 9, 1].sort((a, b) => b - a);      // [10, 9, 1]

const users = [{ name: "Ravi", age: 30 }, { name: "Asha", age: 25 }];
users.sort((a, b) => a.name.localeCompare(b.name));  // by name

// Do not change the original: copy first
const sorted = [...users].sort((a, b) => a.age - b.age);
// or (newer Node.js): users.toSorted((a, b) => a.age - b.age)

// Sort by two fields: age, then name
users.sort((a, b) => a.age - b.age || a.name.localeCompare(b.name));
```

7. **Real backend usage** — Sorting small in-memory lists. For large data, **sort in the database** with `ORDER BY` (and an index), not in JavaScript.
8. **Edge cases** — `undefined` values are moved to the end. Mixed types cause odd order. `localeCompare` handles accents and language rules better than `<`.
9. **Common mistakes** — Forgetting the compare function for numbers. Changing a shared array by accident. Returning a boolean from the compare function (it should be a number).
10. **Interview answer** — "By default `sort` compares as strings, so I pass a compare function for numbers. It also sorts in place, so I copy the array first if I need the original."
11. **Practice problem** — Sort orders by `status` then by `createdAt` (newest first). Write a `sortBy(key, direction)` helper.
12. **Production considerations** — Let the database sort and paginate. Never sort huge arrays in the request path, because sorting is CPU work that blocks the event loop.

---

## 1.3.5 Shallow vs Deep Copy, and Immutability

1. **Definition** — A **shallow copy** copies only the top level. Nested objects are still shared. A **deep copy** copies every level. **Immutability** means you do not change existing data; you make a new version with the change.
2. **Simple meaning** — A shallow copy is like **photocopying the cover page of a file folder** while the papers inside are still the same papers. A deep copy is photocopying **every page**.
3. **Why it is needed** — To avoid one part of the code secretly changing data that another part is using.
4. **How it works internally** — Spread (`{...obj}`, `[...arr]`), `Object.assign`, and `slice` copy references of nested objects. `structuredClone` (built into Node.js 17+) walks the whole structure and makes new copies.
5. **Syntax and API + 6. Small example**

```js
const original = { name: "Asha", address: { city: "Mumbai" } };

const shallow = { ...original };
shallow.address.city = "Pune";
console.log(original.address.city);      // "Pune"  (shared!)

const deep = structuredClone(original);
deep.address.city = "Delhi";
console.log(original.address.city);      // "Pune"  (safe)

// JSON trick: works, but loses data
const viaJson = JSON.parse(JSON.stringify({ d: new Date(), u: undefined }));
// d becomes a string, u disappears

// Immutable update: new object, new nested object, original untouched
const updated = {
  ...original,
  address: { ...original.address, city: "Chennai" },
};
```

7. **Real backend usage** — Updating state without side effects. Copying config for each request. Keeping the original request data for audit logs while you change a copy.
8. **Edge cases**
   - `structuredClone` cannot clone functions (it throws) and does not keep class methods or prototypes.
   - The JSON trick loses `Date`, `Map`, `Set`, `undefined`, functions, and it fails on circular references.
   - `Object.freeze` is shallow.
9. **Common mistakes** — Thinking spread is a deep copy. Deep-cloning huge objects on every request (slow). Mutating function arguments.
10. **Interview answer** — "A shallow copy duplicates the top level only, so nested objects are shared. A deep copy duplicates everything. I use `structuredClone` for deep copies and spread with nested spreads for small immutable updates."
11. **Practice problem** — Write your own `deepClone` for plain objects and arrays, including a circular reference guard. Compare with `structuredClone`. Write `setIn(obj, path, value)` that returns a new object.
12. **Production considerations** — Deep clone is costly for big objects. Prefer immutable updates of only the parts that change. Treat function inputs as read-only.

---

## 1.3.6 `Map`, `Set`, `WeakMap`, `WeakSet`

1. **Definition**
   - **`Map`:** key-value pairs where keys can be **any type**, with insertion order kept.
   - **`Set`:** a collection of **unique** values.
   - **`WeakMap` / `WeakSet`:** like `Map` / `Set`, but keys/values must be **objects**, and they are held **weakly**, so the garbage collector can remove them when nothing else uses them.
2. **Simple meaning**
   - `Map` is a **proper dictionary** (any kind of key).
   - `Set` is a **guest list with no repeated names**.
   - `WeakMap` is **sticky notes attached to objects**. When the object is thrown away, the note disappears too.
3. **Why it is needed** — Plain objects have limits: keys are strings/symbols only, and they carry inherited properties. `Map` and `Set` are faster and safer for many lookup jobs.
4. **How it works internally** — `Map` and `Set` use hash-based lookup, so `get`, `set`, `has`, and `delete` are fast on average (roughly constant time). Weak collections do not stop the garbage collector from removing their keys, and they cannot be looped over or measured (no `size`, no iteration).
5. **Syntax and API + 6. Small example**

```js
const cache = new Map();
cache.set("user:1", { name: "Asha" });
cache.get("user:1");
cache.has("user:2");        // false
cache.size;                 // 1
for (const [key, value] of cache) { /* ... */ }

const seen = new Set([1, 2, 2, 3]);   // {1, 2, 3}
seen.add(4);
seen.has(2);                          // true

// Objects as keys (impossible with plain objects)
const meta = new WeakMap();
function track(req) { meta.set(req, { startedAt: Date.now() }); }
// When `req` is no longer used anywhere, its entry is cleaned automatically.
```

7. **Real backend usage** — `Map` for in-memory caches and lookup tables by ID. `Set` for removing duplicates and for fast "have I seen this ID?" checks. `WeakMap` to attach metadata to request objects without leaking memory.
8. **Edge cases** — `Map` and `Set` compare keys with "same value zero" (`NaN` equals `NaN`). Objects as keys match by reference, not by content. `JSON.stringify(new Map())` gives `{}`.
9. **Common mistakes** — Using arrays with `includes` for big lookups (slow). Using a plain object as a dictionary with user-controlled keys. Expecting a `WeakMap` to be iterable.
10. **Interview answer** — "`Map` allows any type of key and keeps insertion order. `Set` keeps unique values. `WeakMap` holds object keys weakly, so it does not prevent garbage collection, which makes it useful for attaching hidden data to objects."
11. **Practice problem** — Build an LRU cache (fixed size, removes the least recently used item) using a `Map`. Use a `Set` to find the first duplicate in a list.
12. **Production considerations** — In-memory `Map` caches grow forever unless you limit them. Set a max size or expiry. Remember that an in-memory cache is **per process**, so with several servers each one has its own copy.

---

## 1.3 Practice Projects

- **Data transformer:** take a large JSON of orders and produce (a) totals per user, (b) top 3 products, (c) a paginated, filtered, sorted list.
- **LRU cache** using `Map`.
- **API response mapper:** convert a messy third-party response into a clean internal shape with safe defaults.

**1.3 is done when you can:**
- [ ] Group, filter, and sort records without a library
- [ ] Explain shallow vs deep copy with a bug example
- [ ] Choose between object, `Map`, and `Set` for a job and say why
- [ ] Write safe code for missing or partial API data

---

# 1.4 Asynchronous JavaScript

**Priority: MUST KNOW**

**Goal:** Write async code that is correct, readable, and safe when things fail or go slow.

**Topics in this section:** sync vs async → callbacks → promises → `async/await` → `Promise.all`, `allSettled`, `race`, `any` → error handling → sequential vs parallel → concurrency limits, timeout, and retry.

---

## 1.4.1 Synchronous vs Asynchronous Execution, and Callbacks

1. **Definition** — **Synchronous** code runs line by line, and each line waits for the one before. **Asynchronous** code starts a slow job (network, disk, timer) and continues, and the result arrives later through a callback, promise, or `await`.
2. **Simple meaning**
   - **Sync** = standing in line at a counter until your order is ready. Nobody behind you can be served.
   - **Async** = ordering at a café and getting a **token number**. You sit down, and they call you when it is ready. Meanwhile the counter serves other people.
3. **Why it is needed** — Reading a file, calling an API, or querying MySQL takes time. If the chef (the main thread) waited for each one, the server could handle only one user at a time.
4. **How it works internally** — JavaScript runs your code on **one thread**. Slow work is handed to the system (Node.js APIs and the OS). When the work finishes, its callback is placed in a queue. The event loop moves it onto the call stack when the stack is empty (see 1.5).
5. **Syntax and API + 6. Small example**

```js
console.log("A");
setTimeout(() => console.log("B (later)"), 0);
console.log("C");
// Output: A, C, B (later)

// Error-first callback (old Node.js style)
const fs = require("node:fs");
fs.readFile("config.json", "utf8", (err, text) => {
  if (err) return console.error("Read failed:", err.message);
  console.log("Read OK:", text.length);
});
```

7. **Real backend usage** — Almost every backend action is async: database queries, HTTP calls, file reads, cache calls, message queues.
8. **Edge cases** — `setTimeout(fn, 0)` does not run immediately. It runs *after* current code and after microtasks. Errors thrown inside an async callback **cannot** be caught by a `try/catch` around the original call.
9. **Common mistakes** — Assuming code runs top to bottom when it uses callbacks. **Callback hell** (deep nesting). Calling a callback twice. Throwing inside a callback and crashing the process.
10. **Interview answer** — "JavaScript has one main thread. For slow tasks it starts the work and continues, and when the work finishes the callback goes into a queue. The event loop runs it when the stack is empty. That is how one thread can serve many requests."
11. **Practice problem** — Read three files using nested callbacks. Notice how messy it gets. (You will fix this in the next topics.)
12. **Production considerations** — Every async operation can fail or hang. Always plan for errors and timeouts.

---

## 1.4.2 Promises

1. **Definition** — A **Promise** is an object that represents a value that will be available **later**. It has three states: **pending**, **fulfilled** (success), or **rejected** (failure). Once settled, it never changes.
2. **Simple meaning** — A promise is a **food-delivery order**. When you place the order, you get a tracking screen (the promise). It says *pending*. Later it becomes *delivered* (fulfilled) or *cancelled* (rejected). You can say "when delivered, do this; if cancelled, do that."
3. **Why it is needed** — Promises replace callback hell with chains that are flat and have one place for errors.
4. **How it works internally** — `.then()`, `.catch()`, and `.finally()` register handlers. When the promise settles, those handlers are placed in the **microtask queue**, which runs before timers and I/O callbacks. Each `.then()` returns a **new promise**, which is why chaining works.
5. **Syntax and API + 6. Small example**

```js
const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function getUser(id) {
  return new Promise((resolve, reject) => {
    if (!id) return reject(new Error("id is required"));
    setTimeout(() => resolve({ id, name: "Asha" }), 100);
  });
}

getUser(1)
  .then((user) => {
    console.log(user.name);
    return user.id;                 // passed to the next .then
  })
  .then((id) => console.log("id:", id))
  .catch((err) => console.error("Failed:", err.message))  // catches any error above
  .finally(() => console.log("done"));

// Turn a callback API into a promise (promisify)
const { promisify } = require("node:util");
const readFileAsync = promisify(fs.readFile);
// Modern Node.js also has: require("node:fs/promises")
```

7. **Real backend usage** — Almost all modern libraries (`fetch`, `fs/promises`, database drivers, AWS SDK) return promises.
8. **Edge cases**
   - Returning a value from `.then` wraps it in a new promise. Returning a promise makes the chain wait for it.
   - If you forget to `return` inside `.then`, the next step gets `undefined`.
   - A rejected promise with no `.catch` is an **unhandled rejection**. In modern Node.js (15+), it **crashes the process by default**.
   - `.catch` returns a normal promise, so the chain continues after it.
9. **Common mistakes** — Forgetting `return` in chains. Forgetting `.catch`. Nesting `.then` inside `.then` (the "promise pyramid"). Wrapping something that already returns a promise in `new Promise` (the "explicit construction" anti-pattern).
10. **Interview answer** — "A promise represents a future result with three states: pending, fulfilled, or rejected. `then` handlers run as microtasks after it settles. Each `then` returns a new promise, so I can chain steps and handle all errors in one `catch`."
11. **Practice problem** — Write `delay(ms, value)`. Write `promisify` yourself for error-first callbacks. Convert the three-nested-callback file reader from 1.4.1 into a flat promise chain.
12. **Production considerations** — Log unhandled rejections, and let the process exit and restart, rather than ignoring them. Never leave a promise without a way to observe its failure.

---

## 1.4.3 `async` / `await`

1. **Definition** — `async` marks a function that always returns a promise. `await` pauses *that function* until a promise settles, then gives its value (or throws its error).
2. **Simple meaning** — It is **the same food-delivery order**, but written like a normal story: "Order the food. *Wait.* Eat it." The rest of the restaurant keeps working while you wait.
3. **Why it is needed** — Promise chains are better than callbacks, but `async/await` reads like normal synchronous code, and `try/catch` works naturally.
4. **How it works internally** — `await` splits your function into pieces. The code after `await` becomes a **microtask** that runs when the promise settles. The function gives control back to the caller at the `await`, so the thread is **not blocked**.
5. **Syntax and API + 6. Small example**

```js
async function getOrderSummary(orderId) {
  try {
    const order = await db.getOrder(orderId);
    const user  = await db.getUser(order.userId);
    return { orderId, user: user.name, total: order.total };
  } catch (err) {
    console.error("Summary failed:", err.message);
    throw err;                       // rethrow so the caller knows
  }
}

// An async function ALWAYS returns a promise
getOrderSummary(1).then(console.log);
```

7. **Real backend usage** — Express route handlers, service functions, and repository methods are almost all `async`.
8. **Edge cases**
   - `await` only works inside `async` functions (or at the top level of an ES module).
   - `return await` inside `try` matters: without `await`, a rejection escapes the `try/catch`.
   - `await` in `forEach` **does not wait**, because `forEach` ignores the returned promises.
   - Express 4 does **not** catch rejected promises from async handlers on its own. Express 5 does. Check your version.
9. **Common mistakes** — Forgetting `await` (you get a `Promise` object, not the value). Awaiting in a loop when tasks are independent (slow). Swallowing errors with an empty `catch`.
10. **Interview answer** — "`async` functions always return a promise. `await` pauses only that function until the promise settles, while the main thread keeps serving other work. Errors from a rejected promise become exceptions that I can catch with `try/catch`."
11. **Practice problem** — Rewrite the promise chain from 1.4.2 with `async/await`. Then write an Express-style `asyncHandler` that catches rejections.
12. **Production considerations** — Every `await` on I/O should have a timeout plan. Keep `try/catch` blocks focused, and do not hide errors.

---

## 1.4.4 Promise Combinators: `all`, `allSettled`, `race`, `any`

1. **Definition** — Built-in helpers to work with many promises at once.
2. **Simple meaning** — You order from **four shops** at the same time.
   - `Promise.all` — "I need **all four** parcels. If any shop cancels, forget the whole order."
   - `Promise.allSettled` — "Tell me the result of **each** order, good or bad."
   - `Promise.race` — "Give me whichever shop replies **first** (success or failure)."
   - `Promise.any` — "Give me the **first success**. Ignore failures unless all fail."
3. **Why it is needed** — Running independent tasks together is much faster than one after another.
4. **How it works internally** — All the tasks **start immediately** (the promises are already running when you pass them in). The combinator only decides how to collect the results.

| Method | Resolves when | Rejects when | Result |
|--------|---------------|--------------|--------|
| `all` | all succeed | **any** fails (first failure) | array of values, in order |
| `allSettled` | all finish | never | array of `{status, value/reason}` |
| `race` | first one settles (success) | first one settles (failure) | that one result |
| `any` | first success | all fail (`AggregateError`) | first success value |

5. **Syntax and API + 6. Small example**

```js
// Fetch data from three APIs in parallel
const [users, orders, products] = await Promise.all([
  fetchJson("https://api.example.com/users"),
  fetchJson("https://api.example.com/orders"),
  fetchJson("https://api.example.com/products"),
]);

// Handle partial failure: one service is down, others still useful
const results = await Promise.allSettled([
  fetchJson("/recommendations"),
  fetchJson("/reviews"),
  fetchJson("/inventory"),
]);
const data = results.map((r) =>
  r.status === "fulfilled" ? r.value : { error: r.reason.message }
);

// Fastest mirror wins
const fastest = await Promise.any([
  fetchJson("https://mirror-1.example.com/data"),
  fetchJson("https://mirror-2.example.com/data"),
]);
```

7. **Real backend usage** — `all` for a dashboard endpoint that needs several independent queries. `allSettled` for "best effort" features (recommendations, analytics) where one failure should not break the page. `race` for timeouts. `any` for redundant sources.
8. **Edge cases**
   - `Promise.all` fails fast, but the *other* tasks **keep running** (they are not cancelled).
   - The result order of `all` matches the input order, not the finishing order.
   - An empty array: `all` and `allSettled` resolve with `[]`; `any` rejects.
9. **Common mistakes** — Using `all` when one failure should not break the response. Building the promises inside a loop with `await` (which makes them sequential). Running thousands of promises at once (see 1.4.7).
10. **Interview answer** — "`all` waits for all and fails on the first error. `allSettled` waits for all and reports each result. `race` returns the first to settle. `any` returns the first success. I use `allSettled` when partial failure is acceptable."
11. **Practice problem** — Fetch data from three APIs, and return a combined result even if one fails, with a clear `errors` field.
12. **Production considerations** — Parallel does not mean "unlimited." Too many parallel calls can overload your database or a downstream API. Combine with a concurrency limit and timeouts.

---

## 1.4.5 Error Handling in Async Code

1. **Definition** — Handling failures from promises and async functions so the app stays correct and does not crash.
2. **Simple meaning** — A **safety net** under a trapeze. Each risky move should have a net, and you should decide clearly what happens after a fall.
3. **Why it is needed** — Networks fail, databases time out, users send bad data. Unhandled errors crash servers or leave data half-updated.
4. **How it works internally** — `throw` inside an `async` function turns into a **rejected promise**. `await` turns a rejection back into a thrown error, which `try/catch` can catch. A rejection with no handler triggers an `unhandledRejection` event, and Node.js 15+ crashes by default.
5. **Syntax and API + 6. Small example**

```js
class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL", cause } = {}) {
    super(message, { cause });
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

async function getUser(id) {
  try {
    const row = await db.findUser(id);
    if (!row) throw new AppError("User not found", { status: 404, code: "USER_NOT_FOUND" });
    return row;
  } catch (err) {
    if (err instanceof AppError) throw err;                 // known error: pass it up
    throw new AppError("Database failure", { cause: err }); // unknown: wrap, keep the cause
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);            // let your process manager restart the app
});
```

7. **Real backend usage** — Custom error classes with HTTP status codes. A central Express error-handling middleware. Clear separation between **expected errors** (validation, not found) and **unexpected errors** (bugs, outages).
8. **Edge cases** — Throwing a string instead of an `Error` loses the stack trace. `finally` runs even after `return` or `throw`. Errors thrown inside `setTimeout` callbacks or event handlers are **not** caught by an outer `try/catch`.
9. **Common mistakes** — Empty `catch {}` blocks. Catching an error, logging it, and then continuing as if nothing happened. Leaking internal error details to the client.
10. **Interview answer** — "In async code, a `throw` becomes a rejected promise, and `await` turns it back into an exception I can catch with `try/catch`. I handle expected errors at the right layer, wrap unknown errors with context, and let a central handler return a safe response."
11. **Practice problem** — Create `AppError`, `NotFoundError`, `ValidationError`. Write an Express-style error middleware that maps them to status codes and hides internal details.
12. **Production considerations** — Log full errors (with stack and request ID) on the server, and return only safe messages to clients. Decide clearly which errors are *retryable* and which are not.

---

## 1.4.6 Sequential vs Parallel Execution

1. **Definition** — **Sequential:** tasks run one after another. **Parallel (concurrent):** tasks are started together, and their waiting times overlap.
2. **Simple meaning** — Boiling water, chopping vegetables, and heating the pan: if you do them one by one, dinner takes 30 minutes. If you start the water first and chop while it boils, it takes 15.
3. **Why it is needed** — Independent I/O tasks should overlap in time. Dependent tasks must stay in order.
4. **How it works internally** — With `await` in a loop, each iteration waits for the last one. With `Promise.all(items.map(...))`, all tasks start together, and the total time is about the slowest single task.
5. **Syntax and API + 6. Small example**

```js
// Sequential: 3 x 1s = ~3s
for (const id of ids) {
  await fetchUser(id);
}

// Parallel: ~1s (but starts every request at once)
await Promise.all(ids.map((id) => fetchUser(id)));

// Dependent steps MUST be sequential
const user  = await getUser(id);
const order = await getLatestOrder(user.id);   // needs user.id

// Start early, wait later (independent tasks)
const userPromise   = getUser(id);
const configPromise = getConfig();
const [u, c] = await Promise.all([userPromise, configPromise]);
```

7. **Real backend usage** — Loading a user profile plus their settings in parallel. Running database writes in order when they depend on each other (or inside one transaction).
8. **Edge cases** — Parallel writes to the same record can cause race conditions. If order of side effects matters (for example, sending messages in order), keep it sequential.
9. **Common mistakes** — Awaiting independent tasks one by one (slow). Starting 10,000 tasks at once. Running dependent steps in parallel.
10. **Interview answer** — "If tasks depend on each other, I run them sequentially. If they are independent I start them together and use `Promise.all`. But I limit concurrency so I do not overload the database or an external API."
11. **Practice problem** — Measure the time difference between sequential and parallel for 10 tasks that each wait 200 ms.
12. **Production considerations** — Parallel work uses connections. A database pool of 10 connections will queue anything beyond 10 parallel queries. Design with pool size and downstream limits in mind.

---

## 1.4.7 Concurrency Limits, Timeout and Retry

1. **Definition** — A **concurrency limit** caps how many tasks run at the same time. A **timeout** stops waiting after a set time. A **retry** repeats a failed operation, usually with a growing delay (**exponential backoff**) and a bit of random jitter.
2. **Simple meaning** — A **bank with 4 counters**: only 4 customers are served at once, and the rest wait in a line (concurrency limit). If a customer takes too long, staff asks them to step aside (timeout). If a call did not go through, you wait a bit longer before each redial, so you do not flood the line (backoff).
3. **Why it is needed** — Without limits, one slow service can pile up thousands of waiting requests and take down your whole app. Retries fix short-term problems, and backoff stops them from making things worse.
4. **How it works internally**
   - A limiter starts up to *N* "workers." Each worker takes the next item from a shared list, waits for it, then takes another.
   - A timeout uses `AbortController` (to actually cancel the request) or `Promise.race` (to stop *waiting*).
   - Retry uses a loop with a delay: `delay = base * 2^attempt + random jitter`.
5. **Syntax and API + 6. Small example**

```js
// --- Concurrency limiter: process items, at most `limit` at a time ---
async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function runner() {
    while (next < items.length) {
      const i = next++;                       // synchronous: safe, no two runners get the same i
      results[i] = await worker(items[i], i);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, runner);
  await Promise.all(runners);
  return results;
}

// --- Timeout with real cancellation ---
async function fetchWithTimeout(url, ms = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);                      // always clean up
  }
}
// Shortcut in modern Node.js: fetch(url, { signal: AbortSignal.timeout(3000) })

// --- Retry with exponential backoff + jitter ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, { retries = 3, baseMs = 200, shouldRetry = () => true } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === retries || !shouldRetry(err)) break;
      const delay = baseMs * 2 ** attempt + Math.random() * 100;
      await sleep(delay);
    }
  }
  throw lastError;
}

// Use all three together
const pages = await mapWithLimit(urls, 5, (url) =>
  retry(() => fetchWithTimeout(url, 2000), { retries: 2 })
);
```

7. **Real backend usage** — Calling payment or email providers, bulk-processing rows, syncing data with a third-party API, calling other microservices. Limit concurrency to match the provider's rate limit.
8. **Edge cases**
   - `Promise.race` for timeout stops **waiting**, but the original work keeps running unless you also cancel it (use `AbortController`).
   - Retrying a **non-idempotent** operation (like "charge the card") can do the action twice. Only retry safe operations, or make them idempotent with an idempotency key (a later phase).
   - Retrying on every error is wrong. Retry only temporary errors (timeouts, `503`, network resets), not validation errors (`400`) or "not found."
9. **Common mistakes** — Retrying instantly with no delay. No jitter, so many clients retry at the same moment. No maximum retry count. Forgetting `clearTimeout`.
10. **Interview answer** — "I limit concurrency with a small pool of workers that pull from a shared list. I add a timeout with `AbortController`, and retry only temporary errors with exponential backoff and jitter. I also make sure retried operations are safe to repeat."
11. **Practice problem** — Build these three helpers yourself: `mapWithLimit`, `withTimeout`, `retry`. Test with a fake flaky function that fails 2 of 3 times, and a slow function that takes 5 s.
12. **Production considerations** — Set timeouts on *every* outbound call. Cap retries. Log each retry with the attempt number. Respect `Retry-After` headers. Add a circuit breaker later (in a resilience phase) for services that stay down.

---

## 1.4 Practice Projects

- **Multi-API aggregator:** fetch data from three public APIs, return a combined response, handle partial failure, include timeouts and retries.
- **Bulk URL checker:** check 200 URLs with a concurrency limit of 10, a 3-second timeout, and a report of status and response time.
- **Async utility kit:** `sleep`, `timeout`, `retry`, `mapWithLimit`, `promisify`, `settleAll`.

**1.4 is done when you can:**
- [ ] Write a promise chain and the same logic with `async/await`
- [ ] Choose the correct `Promise` combinator for a case
- [ ] Build a concurrency limiter, timeout, and retry without help
- [ ] Explain why `await` inside `forEach` does not work as expected

---

# 1.5 Event Loop and Internals

**Priority: MUST KNOW**

**Goal:** Predict the order in which code runs, and know why blocking the main thread is dangerous for a Node.js server.

**Topics in this section:** call stack → Node.js APIs and libuv → task queues → microtask queue → timers → `process.nextTick` → `setImmediate` → event loop phases → blocking vs non-blocking → CPU-heavy work and workers.

---

## 1.5.1 The Event Loop, Queues and Phases

1. **Definition** — The **event loop** is the mechanism that takes finished async work (callbacks) from queues and runs it on the call stack when the stack is empty. In Node.js, it is provided by a library called **libuv**.
2. **Simple meaning** — Back to the **restaurant with one chef**:
   - The **chef** = the call stack (runs one thing at a time).
   - The **waiters and helpers** = Node.js APIs and the OS (they fetch ingredients: network, disk, database).
   - The **order tickets waiting** = the callback queues.
   - The **event loop** = the manager who says: "Chef, your hands are free. Here is the next ticket."
   - **Urgent sticky notes on the counter** = the microtask queue (promises). The chef reads *all* of them before taking the next ticket.
3. **Why it is needed** — It lets a single-threaded language handle thousands of connections. It is also the top JavaScript interview topic, and it explains many production slowdowns.
4. **How it works internally**
   - **Step 1:** your main script runs on the call stack until it finishes.
   - **Step 2:** the loop starts. It moves through **phases** in a fixed order:

   | Phase | What runs here |
   |-------|----------------|
   | **timers** | `setTimeout` / `setInterval` callbacks whose time has come |
   | **pending callbacks** | some system-level callbacks (for example certain TCP errors) |
   | **idle, prepare** | internal use only |
   | **poll** | new I/O events: finished file reads, network data, database results. The loop may wait here for I/O |
   | **check** | `setImmediate` callbacks |
   | **close callbacks** | cleanup callbacks such as `socket.on("close")` |

   - **Between callbacks**, Node.js empties the **`process.nextTick` queue** first, and then the **promise microtask queue**. Microtasks always run before the loop moves to the next callback or phase.
   - Some work (file system, `crypto`, `zlib`, DNS lookups) runs on libuv's **thread pool** (default: 4 threads, changeable with `UV_THREADPOOL_SIZE`). Network I/O uses the operating system's own async tools and does not use the pool.
5. **Syntax and API + 6. Small example**

```js
console.log("1: start");

setTimeout(() => console.log("2: setTimeout 0"), 0);
setImmediate(() => console.log("3: setImmediate"));

Promise.resolve().then(() => console.log("4: promise microtask"));
process.nextTick(() => console.log("5: nextTick"));

console.log("6: end");

// Output (CommonJS file):
// 1: start
// 6: end
// 5: nextTick               <- nextTick queue runs first
// 4: promise microtask      <- then promise microtasks
// 2: setTimeout 0  \  these two can swap when run from the main script
// 3: setImmediate  /  (it depends on how fast the process starts)
```

**Inside an I/O callback, the order is fixed:**

```js
const fs = require("node:fs");
fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
});
// Always: immediate, then timeout (the check phase comes right after poll)
```

7. **Real backend usage** — Understanding why an API becomes slow under load, why `setTimeout` is "late," why logs appear in a strange order, and why a long loop freezes every user.
8. **Edge cases**
   - A `setTimeout(fn, 100)` means "**at least** 100 ms." If the chef is busy, it runs later.
   - A microtask that keeps adding microtasks can **starve** the loop (I/O never gets a turn). Recursive `process.nextTick` does the same.
   - In **ES modules**, the order of `process.nextTick` vs promise callbacks at the top level can differ from CommonJS. Do not depend on it.
   - Browser and Node.js event loops are similar in idea, but not identical.
9. **Common mistakes** — Believing JavaScript runs many things at once in your code (it runs one thing at a time). Using `setTimeout` for precise timing. Running heavy loops in a request handler.
10. **Interview answer** — "JavaScript runs on one thread with a call stack. When I start async work, Node.js hands it to libuv or the OS. When it finishes, the callback waits in a queue, and the event loop moves it to the stack when the stack is empty. After each callback, Node.js runs `nextTick` callbacks and then promise microtasks before moving on. That is why promises run before timers."
11. **Practice problem** — Write 5 programs that mix `console.log`, `setTimeout`, `setImmediate`, `Promise.then`, `process.nextTick`, and `async/await`. Predict the output on paper first, then run them.
12. **Production considerations** — Keep every request handler short on CPU work. Monitor **event loop delay** (see below). Never start endless microtask loops.

---

## 1.5.2 Blocking vs Non-Blocking Code, and CPU-Heavy Work

1. **Definition** — **Blocking** code keeps the call stack busy, so nothing else can run. **Non-blocking** code starts work and returns quickly, letting the loop serve others. **CPU-heavy work** (big loops, hashing, parsing huge JSON, image processing) is blocking, because a background helper cannot do it for you unless you send it to a **worker thread**.
2. **Simple meaning** — If the chef spends 5 minutes carving a huge ice sculpture (CPU work), **no other order is cooked**. The fix: give the sculpture to a **second kitchen** (a worker thread), and the chef keeps serving the tables.
3. **Why it is needed** — One blocking request can make the whole server look "down" for every user.
4. **How it works internally** — While the stack is busy, the event loop cannot run anything else: no timers, no I/O callbacks, no new requests. Async I/O is *not* the problem, because waiting for I/O costs no CPU. **Long synchronous CPU work** is the problem. Worker threads run JavaScript in a **separate thread with its own event loop and memory**, and talk to the main thread by messages.
5. **Syntax and API + 6. Small example**

```js
// BAD: blocks the whole server for a few seconds
const http = require("node:http");

function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }

http.createServer((req, res) => {
  if (req.url === "/slow") {
    res.end(String(fib(42)));        // every other request waits!
  } else {
    res.end("fast");
  }
}).listen(3000);
```

```js
// GOOD: move CPU work to a worker thread
// main.js
const { Worker } = require("node:worker_threads");

function runInWorker(n) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./fib-worker.js", { workerData: n });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with code ${code}`));
    });
  });
}

// fib-worker.js
const { parentPort, workerData } = require("node:worker_threads");
function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }
parentPort.postMessage(fib(workerData));
```

```js
// Measure event loop delay (how "late" the loop is)
const { monitorEventLoopDelay } = require("node:perf_hooks");
const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();
setInterval(() => {
  console.log("p99 delay (ms):", histogram.percentile(99) / 1e6);
  histogram.reset();
}, 5000);
```

7. **Real backend usage** — Password hashing with `bcrypt` (use the async version), image resize, PDF generation, big CSV/JSON parsing, encryption, and report calculation are common CPU-heavy jobs. Typical fixes: worker threads, a background job queue, or a separate service.
8. **Edge cases**
   - `JSON.parse` and `JSON.stringify` on very large data block the loop.
   - A regular expression with catastrophic backtracking (ReDoS) can freeze the process on malicious input.
   - `*Sync` functions (`readFileSync`, `pbkdf2Sync`) block. They are fine at startup, but not inside request handlers.
   - Worker threads cost memory and startup time. For many small tasks, use a pool (a library such as `piscina`, covered later).
9. **Common mistakes** — Using `Sync` APIs in request handlers. Doing big array work (`sort`, `map`) over hundreds of thousands of rows per request. Thinking `async` makes CPU work non-blocking (it does not; `async` only helps with waiting).
10. **Interview answer** — "Node.js is great at I/O-heavy work, but CPU-heavy synchronous code blocks the event loop and delays every request. I move heavy work to worker threads, a job queue, or another service, and I use non-blocking or streamed APIs for I/O."
11. **Practice problem** — Build the `/slow` vs `/fast` server. Hit `/slow` and `/fast` together and observe. Then move `fib` to a worker and compare. Measure event loop delay in both cases.
12. **Production considerations** — Monitor event loop delay and p99 latency. Ban `*Sync` calls in request paths with lint rules. Set limits on body size and input complexity. Run more than one Node.js process (cluster or containers) to use all CPU cores.

---

## 1.5 Practice Projects

- **Execution-order quiz:** write 15 tricky snippets with expected outputs, run them, and write a one-line reason for each.
- **Blocking demo:** show how a synchronous loop delays a health-check endpoint, then fix it with a worker.
- **Event loop monitor:** a tiny module that logs event loop delay and warns above a threshold.

**1.5 is done when you can:**
- [ ] Predict the output order of a mixed timers/promises/nextTick snippet
- [ ] Explain, using the restaurant analogy, why CPU work freezes a server
- [ ] Explain microtasks vs macrotasks (timers, I/O)
- [ ] Move CPU-heavy work to a worker thread

---

# 1.6 Advanced JavaScript

**Priority: IMPORTANT**

**Goal:** Understand the deeper mechanics behind classes, `this`, iteration, and memory, so that frameworks and libraries stop feeling like magic.

**Topics in this section:** prototypes and the prototype chain → classes → `this`, `call`, `apply`, `bind` → iterators and generators → symbols → property descriptors → `Proxy` and `Reflect` → memory management and garbage collection → debouncing and throttling → functional programming concepts.

---

## 1.6.1 Prototypes and the Prototype Chain

1. **Definition** — Every JavaScript object has a hidden link (`[[Prototype]]`) to another object, its **prototype**. When you read a property that the object does not have, JavaScript looks at the prototype, then the prototype's prototype, and so on. This path is the **prototype chain**. It ends at `null`.
2. **Simple meaning** — It is like asking your **teacher** a question. If the teacher does not know, the teacher asks the **principal**, who may ask the **board**. The chain of "who can I ask?" is the prototype chain.
3. **Why it is needed** — It is how JavaScript shares behavior between objects without copying it. Every array can use `.map` because all arrays link to `Array.prototype`.
4. **How it works internally** — `obj.x` → own properties → `obj`'s prototype → its prototype → ... → `null`. `Object.getPrototypeOf(obj)` reads the link. Writing to `obj.x` always creates the property on `obj` itself.
5. **Syntax and API + 6. Small example**

```js
const animal = {
  eat() { return `${this.name} eats`; },
};
const dog = Object.create(animal);   // dog's prototype is animal
dog.name = "Bruno";
dog.eat();                           // "Bruno eats" (found on animal)

Object.getPrototypeOf(dog) === animal;   // true
dog.hasOwnProperty("eat");               // false
Object.hasOwn(dog, "name");              // true

// Constructor function (the old way that classes are built on)
function User(name) { this.name = name; }
User.prototype.hello = function () { return `Hi ${this.name}`; };
const u = new User("Asha");
u.hello();                               // "Hi Asha"
```

7. **Real backend usage** — Reading library code and error stack traces. Understanding why `instanceof` works with custom errors. Debugging "method not found" or "wrong `this`" problems.
8. **Edge cases**
   - Methods put on a prototype are **shared** by all instances (saves memory). A method created inside a constructor is **copied** for every instance.
   - Changing built-in prototypes (`Array.prototype.myMethod = ...`) is dangerous.
   - `__proto__` can be abused in user input (prototype pollution, see 1.6.5). Avoid merging untrusted objects into your own carelessly.
9. **Common mistakes** — Mixing up `prototype` (a property on **functions**) and `[[Prototype]]` (the link on **objects**, read via `Object.getPrototypeOf`). Modifying built-in prototypes.
10. **Interview answer** — "Every object links to a prototype. If a property is not found on the object, JavaScript walks up the prototype chain until it finds it or reaches `null`. Classes are simpler syntax over this same system."
11. **Practice problem** — Build a small inheritance chain with `Object.create` only (no `class`). Then rebuild it with `class` and `extends`. Print the prototype chain of an array.
12. **Production considerations** — Guard against **prototype pollution**: never blindly merge user JSON into objects with helpers that copy `__proto__`, `constructor`, or `prototype` keys. Validate input, and consider `Object.create(null)` or `Map` for user-keyed data.

---

## 1.6.2 Classes

1. **Definition** — A `class` is a cleaner syntax for creating objects with shared methods, built on top of prototypes.
2. **Simple meaning** — A class is a **blueprint for a house**. Each `new` call builds a new house from the blueprint. Inheritance (`extends`) is a **blueprint for a bigger house that starts from the smaller blueprint**.
3. **Why it is needed** — Readable, familiar structure for services, repositories, errors, and domain objects. It also sets up your later work with TypeScript, dependency injection, and design patterns.
4. **How it works internally** — Methods are stored on `ClassName.prototype`. `extends` links the prototype chains. `super(...)` calls the parent constructor (you must call it before using `this` in a child). Classes are strict mode by default and are **not** hoisted like functions (TDZ applies).
5. **Syntax and API + 6. Small example**

```js
class Account {
  #balance = 0;                       // private field (truly private)
  static count = 0;                   // belongs to the class

  constructor(owner) {
    this.owner = owner;
    Account.count++;
  }

  deposit(amount) {
    if (amount <= 0) throw new RangeError("Amount must be positive");
    this.#balance += amount;
    return this;                      // allows chaining
  }

  get balance() { return this.#balance; }   // getter

  static create(owner) { return new Account(owner); }
}

class SavingsAccount extends Account {
  constructor(owner, rate) {
    super(owner);                     // must come first
    this.rate = rate;
  }
  addInterest() { return this.deposit(this.balance * this.rate); }
}

const acc = new SavingsAccount("Asha", 0.05);
acc.deposit(1000).addInterest();
acc.balance;                          // 1050
// acc.#balance                       // SyntaxError (private)
acc instanceof Account;               // true
```

7. **Real backend usage** — Service classes (`UserService`), repositories, custom error classes (`class NotFoundError extends AppError`), and framework-style code (NestJS, Angular). Private fields for internal state.
8. **Edge cases**
   - Class methods lose `this` when passed as callbacks (`arr.map(obj.method)`). Use an arrow function or `.bind`.
   - `class` is syntax on prototypes. `typeof MyClass` is `"function"`.
   - Class fields with arrow functions (`handle = () => {}`) fix `this`, but create a new function per instance.
9. **Common mistakes** — Forgetting `super()` in a child constructor. Losing `this` in callbacks. Deep inheritance trees when composition (an object *having* another object) would be simpler.
10. **Interview answer** — "A class is syntax over prototypes. Methods live on the prototype, `extends` connects prototype chains, and `#` fields give real privacy. I prefer composition over deep inheritance."
11. **Practice problem** — Build `AppError` → `NotFoundError` / `ValidationError` with status codes. Build a `Logger` class with a private buffer and a `flush()` method.
12. **Production considerations** — Keep classes small and focused. Use composition and dependency passing (constructor injection) so code is easy to test.

---

## 1.6.3 `this`, `call`, `apply`, `bind`

1. **Definition** — `this` is the object that the current function is running "for." Its value depends on **how the function is called**. `call`, `apply`, and `bind` let you set `this` yourself.
2. **Simple meaning** — `this` is **"who is speaking right now."** If Asha calls `intro()`, then `this` is Asha. If you take the function and hand it to someone else to call, the speaker changes — and things go wrong.
3. **Why it is needed** — It lets one function work for many objects. Knowing the rules removes the "why is `this` undefined?" problem.
4. **How it works internally — the four rules (in priority order):**
   1. **`new` binding:** `new Foo()` → `this` is the new object.
   2. **Explicit binding:** `call`, `apply`, `bind` → `this` is what you pass.
   3. **Implicit binding:** `obj.method()` → `this` is `obj` (whatever is left of the dot).
   4. **Default binding:** plain `fn()` → `this` is `undefined` in strict mode (or the global object in sloppy mode).
   - **Arrow functions** ignore all four rules and use the `this` of the surrounding code.
5. **Syntax and API + 6. Small example**

```js
function intro(greeting, punctuation) {
  return `${greeting}, I am ${this.name}${punctuation}`;
}
const asha = { name: "Asha" };

intro.call(asha, "Hello", "!");        // call: arguments one by one
intro.apply(asha, ["Hello", "!"]);     // apply: arguments as an array
const bound = intro.bind(asha, "Hi");  // bind: returns a NEW function, does not call it
bound("?");                            // "Hi, I am Asha?"

// Losing `this`
const user = {
  name: "Ravi",
  hello() { return `Hi ${this.name}`; },
};
const fn = user.hello;
// fn();                               // this is undefined (strict) → error or wrong result
const safe = user.hello.bind(user);
safe();                                // "Hi Ravi"
```

7. **Real backend usage** — Passing class methods as Express handlers (`router.get("/", controller.list)` loses `this`). Fixing with `.bind(controller)` or arrow class fields. Borrowing methods from other objects.
8. **Edge cases** — `bind` can be applied only once effectively (a bound function cannot be re-bound). Event emitters call listeners with `this` set to the emitter (unless you use an arrow function).
9. **Common mistakes** — Passing `obj.method` as a callback. Using an arrow function as an object method. Confusing `call` and `apply`.
10. **Interview answer** — "`this` is decided at call time: `new` first, then explicit `call/apply/bind`, then the object left of the dot, then the default (undefined in strict mode). Arrow functions do not have their own `this`; they use the outer one."
11. **Practice problem** — Predict `this` in 10 snippets: plain call, method call, extracted method, `setTimeout`, arrow inside a method, class method as callback, `bind`, `new`. Then write your own `bind` polyfill.
12. **Production considerations** — For services that pass methods around, bind in the constructor or use small arrow wrappers at the route definition. Avoid relying on `this` in utility functions.

---

## 1.6.4 Iterators, Generators and Symbols

1. **Definition**
   - **Iterator:** an object with a `next()` method that returns `{ value, done }`.
   - **Iterable:** an object that provides an iterator through `[Symbol.iterator]()`. `for...of`, spread, and destructuring use it.
   - **Generator:** a function (`function*`) that can **pause** at `yield` and resume later. It automatically makes an iterator.
   - **Symbol:** a unique, non-string value, often used as a hidden property key or a special protocol name.
2. **Simple meaning**
   - An iterator is a **ticket dispenser**: each press gives the next ticket and a signal when tickets are over.
   - A generator is **a video you can pause**. It plays until `yield`, hands you one piece, and waits.
   - A Symbol is a **one-of-a-kind ID card**. Even two symbols with the same label are not equal.
3. **Why it is needed** — Lazy sequences (values created only when needed), custom loops, memory-friendly processing of big data, and the base of `async` iteration (used by Node.js streams).
4. **How it works internally** — Calling a generator function does **not** run the body. It returns a generator object. Each `.next()` runs until the next `yield`, and the local state stays alive between calls (a closure-like effect).
5. **Syntax and API + 6. Small example**

```js
function* idGenerator(start = 1) {
  let id = start;
  while (true) yield id++;          // infinite, but lazy: costs nothing until asked
}
const ids = idGenerator();
ids.next();   // { value: 1, done: false }
ids.next();   // { value: 2, done: false }

// Lazy pagination: pull pages only as needed
function* chunk(arr, size) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}
for (const page of chunk([1, 2, 3, 4, 5], 2)) console.log(page);

// Make your own object iterable
const range = {
  from: 1, to: 3,
  *[Symbol.iterator]() { for (let i = this.from; i <= this.to; i++) yield i; },
};
[...range];                          // [1, 2, 3]

// Async iteration (used with streams and paginated APIs)
async function* fetchPages(url) {
  let page = 1;
  while (true) {
    const rows = await fetchJson(`${url}?page=${page++}`);
    if (rows.length === 0) return;
    yield rows;
  }
}
for await (const rows of fetchPages("/api/orders")) { /* process rows */ }

// Symbols
const ID = Symbol("id");
const item = { [ID]: 123, name: "Book" };
Object.keys(item);                   // ["name"] (symbol keys are hidden here)
```

7. **Real backend usage** — `for await...of` over Node.js **streams** and database cursors. Lazy pagination through external APIs. Reading big files line by line without loading everything. Symbols appear in library internals.
8. **Edge cases** — Generators are single-use (once done, they stay done). A `return()` call or `break` in `for...of` closes the iterator early. `Symbol("a") !== Symbol("a")`, but `Symbol.for("a") === Symbol.for("a")` (global registry).
9. **Common mistakes** — Forgetting that calling a generator function does not run it. Creating infinite generators and spreading them (`[...infinite]` never ends).
10. **Interview answer** — "A generator is a function that can pause with `yield` and resume later, producing values lazily. It gives me an iterator without writing the `next()` logic by hand. I use `for await...of` with async generators to process streams and paginated data piece by piece."
11. **Practice problem** — Write a `take(iterable, n)` generator, an infinite Fibonacci generator, and an async generator that walks through a paginated API.
12. **Production considerations** — Lazy iteration keeps memory low for large data. Always make sure iteration can be stopped (closing streams and cursors on `break`).

---

## 1.6.5 Property Descriptors, `Proxy` and `Reflect`

1. **Definition**
   - **Property descriptor:** the hidden settings of a property: `value`, `writable`, `enumerable`, `configurable` (or `get`/`set`).
   - **`Proxy`:** an object that wraps another object and can **intercept** operations like read, write, delete, and `in`.
   - **`Reflect`:** a set of functions that perform the default version of those operations.
2. **Simple meaning**
   - A descriptor is the **rules sticker** on a property: "read-only," "hidden from lists," "cannot be removed."
   - A Proxy is a **security guard at the door**. Every visitor (property access) goes through the guard, who can log it, change it, or block it.
3. **Why it is needed** — Fine control over objects: read-only properties, validation, logging, and it is the base of features like reactive frameworks (Vue 3 uses Proxy) and some ORMs.
4. **How it works internally** — Defining or reading a property uses its descriptor. A `Proxy` takes a **target** and a **handler** with "traps" (`get`, `set`, `has`, `deleteProperty`, and others). Inside a trap, `Reflect.get(...)` and `Reflect.set(...)` do the normal action safely.
5. **Syntax and API + 6. Small example**

```js
const config = {};
Object.defineProperty(config, "env", {
  value: "production",
  writable: false,        // cannot change
  enumerable: true,       // shows in loops
  configurable: false,    // cannot delete or redefine
});
config.env = "dev";       // ignored (throws in strict mode)
Object.getOwnPropertyDescriptor(config, "env");

// Proxy: validation + logging
const user = new Proxy({}, {
  set(target, prop, value, receiver) {
    if (prop === "age" && (!Number.isInteger(value) || value < 0)) {
      throw new TypeError("age must be a non-negative integer");
    }
    console.log(`set ${String(prop)} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },
  get(target, prop, receiver) {
    if (!(prop in target)) return `no field "${String(prop)}"`;
    return Reflect.get(target, prop, receiver);
  },
});
user.age = 30;
user.age = -5;            // TypeError
```

7. **Real backend usage** — `Object.freeze`/`defineProperty` for read-only constants. Proxies for "strict config" objects that throw on unknown keys, for lazy loading, or for access logging in tools and libraries.
8. **Edge cases** — Proxies add overhead, so avoid them in hot paths. `Object.freeze` sets all properties to non-writable and non-configurable (shallow). Some built-ins (like `Map`) need care when proxied.
9. **Common mistakes** — Overusing Proxy for simple problems. Forgetting to return `true` from a `set` trap in strict mode. Forgetting that `freeze` is shallow.
10. **Interview answer** — "Property descriptors control a property's writable, enumerable, and configurable settings. A Proxy wraps an object and intercepts operations, and `Reflect` performs the default behavior. I use them sparingly, mostly for validation or read-only guarantees."
11. **Practice problem** — Build a `strictConfig(obj)` Proxy that throws when you read a key that does not exist. Build a `deepFreeze` function.
12. **Production considerations** — Prefer simple explicit code (validation functions, `Object.freeze`) over Proxy magic. Magic is hard to debug and slower.

---

## 1.6.6 Memory Management and Garbage Collection

1. **Definition** — JavaScript manages memory for you. The **garbage collector (GC)** frees objects that can no longer be reached from the running program. A **memory leak** happens when objects are still reachable, but no longer needed.
2. **Simple meaning** — GC is a **cleaner who removes anything nobody can reach or use**. If some forgotten cupboard is still connected to the house by a key (a reference), the cleaner thinks it is still needed, and leaves it.
3. **Why it is needed** — A Node.js server may run for weeks. Even a tiny leak per request eventually crashes it with an out-of-memory error.
4. **How it works internally** — V8 (the engine in Node.js) uses **reachability**: start from "roots" (global variables, the current stack) and mark everything you can reach. Unmarked objects are removed (**mark-and-sweep**). V8 is **generational**: new objects go in a small "young generation" that is cleaned often and quickly. Objects that survive are moved to an "old generation" that is cleaned less often. GC work can briefly pause your code.
5. **Syntax and API + 6. Small example**

```js
// Classic leak 1: cache that never shrinks
const cache = new Map();
function getUser(id) {
  if (!cache.has(id)) cache.set(id, loadUser(id));   // grows forever
  return cache.get(id);
}

// Classic leak 2: listener added on every request, never removed
app.get("/", (req, res) => {
  emitter.on("update", () => { /* uses req, res */ });   // leak
});

// Classic leak 3: timer never cleared
const timer = setInterval(doWork, 1000);
// later: clearInterval(timer);

// Look at memory in Node.js
console.log(process.memoryUsage());  // { rss, heapTotal, heapUsed, external, ... }
```

- **Tools:** `node --inspect` with Chrome DevTools (heap snapshots and allocation timeline), `process.memoryUsage()`, and `node --max-old-space-size=<MB>` to set the heap limit.

7. **Real backend usage** — Watching memory in production dashboards. Finding leaks by taking two heap snapshots (before and after load) and comparing them.
8. **Edge cases** — Closures can keep big objects alive. Global variables live forever. `WeakMap`/`WeakRef` do not stop GC. Buffers and native memory are counted outside the normal heap (`external`, `rss`).
9. **Common mistakes** — Unbounded caches. Forgetting `removeListener`, `clearTimeout`, `clearInterval`. Storing request data in a global array. Keeping references to huge objects in closures.
10. **Interview answer** — "V8 frees objects that are no longer reachable from roots, using a generational mark-and-sweep collector. A leak happens when I keep references I no longer need, for example a growing cache, listeners that are never removed, or timers that are never cleared. I find them with heap snapshots."
11. **Practice problem** — Write a leaking server on purpose (growing `Map` + un-removed listeners). Load it with a tool like `autocannon`, watch `heapUsed` grow, take heap snapshots, find the leak, and fix it.
12. **Production considerations** — Set memory limits on your containers, alert on rising heap usage, give caches a maximum size or expiry, and restart policies as a safety net (not a fix).

---

## 1.6.7 Debouncing and Throttling

1. **Definition**
   - **Debounce:** wait until calls **stop** for a set time, then run once.
   - **Throttle:** run at most **once per time window**, no matter how many calls come.
2. **Simple meaning**
   - **Debounce** is an **elevator door**: it waits until nobody presses the button for a moment, then closes.
   - **Throttle** is a **ticket gate that lets one person in every 2 seconds**, however big the crowd is.
3. **Why it is needed** — Protects expensive work (search calls, saves, API calls) from being triggered too often.
4. **How it works internally** — Both use closures to remember a timer or a last-run time between calls.
5. **Syntax and API + 6. Small example**

```js
function debounce(fn, waitMs) {
  let timer;
  return function (...args) {
    clearTimeout(timer);                       // reset the wait on every call
    timer = setTimeout(() => fn.apply(this, args), waitMs);
  };
}

function throttle(fn, waitMs) {
  let lastRun = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastRun >= waitMs) {
      lastRun = now;
      fn.apply(this, args);
    }
  };
}

const saveDraft = debounce((text) => console.log("saved", text), 500);
saveDraft("a"); saveDraft("ab"); saveDraft("abc");   // saves only once: "abc"
```

7. **Real backend usage** — Debounce for saving file changes or batching config reloads. Throttle for limiting how often a log line, metric, or alert is sent. On the server, **rate limiting** (per user or IP) is the bigger cousin of throttling. On the client, both are used heavily for search boxes and scroll events.
8. **Edge cases** — Debounce may delay forever if calls never stop (add a `maxWait` in real libraries). Throttle can drop the last call (a "trailing" option fixes this). Keep the right `this` and `args`.
9. **Common mistakes** — Creating a new debounced function on every call (so the timer is never shared). Mixing up debounce and throttle.
10. **Interview answer** — "Debounce waits until calls stop, then runs once. Throttle runs at most once per interval. I implement both with closures that hold a timer or timestamp."
11. **Practice problem** — Add `leading`/`trailing` options to your `debounce` and `throttle`. Add `cancel()` and `flush()`.
12. **Production considerations** — For server APIs, use proper rate limiting (Phase 5 and later). For heavy shared state, a debounce inside one process will not coordinate multiple servers.

---

## 1.6.8 Functional Programming Concepts

1. **Definition** — A style of writing code with **pure functions**, **immutable data**, and functions as values. Key ideas: pure functions, no side effects, immutability, composition, currying, and higher-order functions.
2. **Simple meaning** — A **pure function** is like a **vending machine**: same coin, same button, same snack, every time, and it does not secretly change anything else. A **side effect** is like the vending machine also turning off the lights in the building.
3. **Why it is needed** — Pure functions are easy to test, easy to reason about, and safe to run in parallel. Backend code often mixes pure business rules with impure I/O. Separating them makes the code much cleaner.
4. **How it works internally** — No new engine feature is needed. You use closures, higher-order functions, and copies instead of mutations.
5. **Syntax and API + 6. Small example**

```js
// Impure: changes outside data, and result depends on hidden state
let tax = 0.18;
function priceImpure(p) { tax += 0.01; return p * (1 + tax); }

// Pure: same input → same output, no side effects
const priceWithTax = (price, rate) => price * (1 + rate);

// Composition
const pipe = (...fns) => (input) => fns.reduce((acc, fn) => fn(acc), input);
const slugify = pipe(
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.replace(/\s+/g, "-")
);
slugify("  Hello Backend World ");   // "hello-backend-world"

// Currying
const curry = (fn) =>
  function curried(...args) {
    return args.length >= fn.length
      ? fn(...args)
      : (...more) => curried(...args, ...more);
  };
const add = curry((a, b, c) => a + b + c);
add(1)(2)(3);                        // 6
add(1, 2)(3);                        // 6

// Immutable update
const addItem = (cart, item) => [...cart, item];   // does not change the old cart
```

7. **Real backend usage** — Pure functions for pricing, validation, and permission rules (easy unit tests). Data pipelines (`map → filter → reduce`). Impure code (database, network) kept at the edges, in a thin layer.
8. **Edge cases** — Copying big data on every update can cost time and memory. Perfect purity is not the goal; predictable code is.
9. **Common mistakes** — Hiding side effects inside "helper" functions. Mutating arguments. Over-engineering with too much currying and composition, making code hard to read.
10. **Interview answer** — "A pure function always returns the same output for the same input and has no side effects. I keep business rules pure and push I/O to the edges, which makes the logic easy to test and reason about."
11. **Practice problem** — Refactor an impure order-total function into a pure one that takes the order and a tax config. Write `pipe`, `compose`, and `curry`.
12. **Production considerations** — Use FP ideas where they help clarity. Do not force them where a simple loop is clearer or faster.

---

## 1.6 Practice Projects

- **Mini event emitter:** implement `on`, `off`, `once`, `emit` with closures, then compare with Node's `EventEmitter`.
- **Custom error hierarchy** with classes, `cause`, and `instanceof` checks.
- **Lazy pagination reader:** an async generator that walks a paginated API and yields records one at a time.
- **Memory leak lab:** create, detect, and fix a leak with heap snapshots.

**1.6 is done when you can:**
- [ ] Explain the prototype chain and how `class` sits on top of it
- [ ] Predict `this` in the common cases and fix a lost `this`
- [ ] Write a generator and use `for await...of`
- [ ] Name three common memory leaks in Node.js and how to find them
- [ ] Write `debounce`, `throttle`, `pipe`, and `curry` from memory

---

# Phase 1 Capstone Project — Mini Job Runner

**Goal:** Combine everything from Phase 1 in one small project. No framework. Only Node.js built-in modules.

**What you build:** a small library that runs background jobs safely.

### Requirements

1. **Add jobs:** `runner.add(name, asyncFn, options)` puts a job in a queue.
2. **Concurrency limit:** run at most `N` jobs at the same time (default 3).
3. **Timeout:** every job has a time limit. It is cancelled (via `AbortSignal`) when time is over.
4. **Retry:** failed jobs retry with exponential backoff and jitter. Only retry errors marked as retryable.
5. **Status tracking:** each job has a status: `pending → running → succeeded | failed`. Store attempts, start time, end time, and last error.
6. **Events:** the runner emits `job:started`, `job:succeeded`, `job:failed`, and `idle`.
7. **CPU jobs:** a job can be marked `{ cpu: true }`, and then it runs in a worker thread.
8. **Graceful stop:** `runner.stop()` stops taking new jobs and waits for running jobs to finish.
9. **Health:** an event-loop-delay monitor logs a warning above a set threshold.
10. **Tests:** at least 8 tests using the built-in `node:test` runner (retry count, timeout, concurrency limit, failure handling, stop behavior).

### Where each Phase 1 idea is used

| Phase 1 idea | Where you use it |
|--------------|------------------|
| Closures | `createRunner()` keeps private state (queue, counters) |
| Classes | `Job`, `JobRunner`, and custom errors (`TimeoutError`, `RetryableError`) |
| Higher-order functions | wrappers `withTimeout(fn)` and `withRetry(fn)` |
| Promises and `async/await` | job execution and waiting for `idle` |
| `Promise.race`, `AbortController` | timeouts and cancellation |
| Concurrency limiter | picking the next job from the queue |
| `Map` / `Set` | job registry and a set of running job IDs |
| Generators | (bonus) `jobs()` iterator to list jobs by status |
| Event loop knowledge | keeping the runner non-blocking, and worker threads for CPU jobs |
| Error handling | separating retryable and non-retryable errors, no unhandled rejections |
| `this` / `bind` | correct handler binding for events |

### Milestones

- **Day 1–2:** queue + concurrency limit + status tracking.
- **Day 3:** timeout and retry with backoff.
- **Day 4:** events, graceful stop.
- **Day 5:** worker-thread jobs + event loop monitor.
- **Day 6–7:** tests, cleanup, a short README that explains every design choice **in simple English**.

### Done when

- [ ] 20 jobs (some fail, some are slow, some are CPU-heavy) run correctly with a limit of 3
- [ ] Timeouts really stop the work (not just the waiting)
- [ ] `stop()` never loses a running job
- [ ] No unhandled promise rejections in any scenario
- [ ] You can explain the design to another developer out loud in 5 minutes

---

# Phase 1 Interview Question Bank

Practice these **out loud, in simple English**, in 60–90 seconds each. Use one analogy and one code example.

### Fundamentals (1.1)
1. What is the difference between `var`, `let`, and `const`?
2. What is the Temporal Dead Zone?
3. Primitive vs reference types: what changes when you copy them?
4. Why is `typeof null` equal to `"object"`?
5. What is type coercion? Explain `==` vs `===`.
6. Which values are falsy?
7. What is hoisting? Does it work the same for `var`, `let`, and function declarations?

### Functions (1.2)
8. What is a closure? Give a practical use case.
9. What is lexical scope?
10. Why do arrow functions handle `this` differently?
11. What is a higher-order function?
12. What is an IIFE and why was it used?
13. What is the call stack? What causes a stack overflow?

### Objects and arrays (1.3)
14. Shallow copy vs deep copy: how do you make each?
15. What do `map`, `filter`, and `reduce` do? What does `sort` do by default?
16. When would you use a `Map` instead of an object?
17. What is a `WeakMap` and when is it useful?
18. What is the difference between `||` and `??`?

### Async (1.4)
19. Callbacks vs promises vs `async/await`: why did each appear?
20. What are the three states of a promise?
21. Difference between `Promise.all`, `allSettled`, `race`, and `any`?
22. Why does `await` inside `forEach` not work as expected?
23. How would you add a timeout and retry to an API call?
24. How would you process 10,000 items with only 10 running at a time?

### Event loop and internals (1.5)
25. Explain the event loop.
26. Microtasks vs macrotasks: which runs first?
27. `process.nextTick` vs `setImmediate` vs `setTimeout(0)`?
28. Why does CPU-heavy code hurt a Node.js server? What do you do about it?

### Advanced (1.6)
29. Explain the prototype chain.
30. How is `class` related to prototypes?
31. Explain the four `this` binding rules.
32. `call` vs `apply` vs `bind`?
33. What is a generator? Where would you use one?
34. What causes memory leaks in Node.js, and how do you find them?
35. Debounce vs throttle?
36. What is a pure function and why does it matter?

### Predict the output (check your answers by running them)

```js
// 1) Order of execution
console.log("a");
setTimeout(() => console.log("b"), 0);
Promise.resolve().then(() => console.log("c"));
(async () => {
  console.log("d");
  await null;
  console.log("e");
})();
console.log("f");
// Answer: a, d, f, c, e, b
```

```js
// 2) Lost `this`
const user = { name: "Asha", hi() { return this?.name; } };
const hi = user.hi;
console.log(user.hi()); // "Asha"
console.log(hi());      // undefined
```

```js
// 3) Closure in a loop
const fns = [];
for (var i = 0; i < 3; i++) fns.push(() => i);
console.log(fns.map((f) => f()));  // [3, 3, 3]  (use let → [0, 1, 2])
```

```js
// 4) A famous trap
console.log([1, 2, 3].map(parseInt));  // [1, NaN, NaN]  (map passes index as 2nd argument)
console.log([10, 9, 1].sort());        // [1, 10, 9]      (string comparison)
```

```js
// 5) Promise.all with one failure
Promise.all([Promise.resolve(1), Promise.reject(new Error("x")), Promise.resolve(3)])
  .then(console.log)
  .catch((e) => console.log("caught", e.message));   // caught x
```

---

# Weekly Study Method for Phase 1

Use this every week, for every section (from the roadmap):

| Day | Focus | What to do in Phase 1 |
|-----|-------|-----------------------|
| **Monday — Learn** | Definition, internals, examples | Read the topic in this file. Draw the analogy in your notebook. |
| **Tuesday — Code** | Write without copying | Type every example. Change it. Predict, then run. |
| **Wednesday — Backend usage** | Use it in a Node.js project | Use the topic in a small script or an Express-style handler. |
| **Thursday — Debugging** | Break things on purpose | Create errors (lost `this`, un-awaited promise, blocked loop) and fix them. |
| **Friday — Interview practice** | Answer out loud in simple English | Pick 5 questions from the bank above and answer each in 60–90 seconds. |
| **Saturday — Project work** | One meaningful feature | Work on the section's practice project or the capstone. |
| **Sunday — Revision** | Review and record | Re-read notes, solve 3 problems again, write down every mistake you made. |

**Mistake log:** keep a file `mistakes.md`. For each mistake write: *what I expected, what happened, why, the rule.* Review it every Sunday.

---

# Top 10 Beginner-to-Intermediate JavaScript Mistakes (Quick Review)

| # | Mistake | Better habit |
|---|---------|--------------|
| 1 | Using `var` | `const` by default, `let` when needed |
| 2 | Using `==` | Always `===` |
| 3 | Using `||` for defaults | Use `??` when `0` or `""` is valid |
| 4 | Thinking spread or `Object.assign` makes a deep copy | Use `structuredClone` when you need one |
| 5 | Sorting numbers without a compare function | `arr.sort((a, b) => a - b)` |
| 6 | Forgetting `await` | Lint rule for floating promises, and review async code carefully |
| 7 | `await` inside `forEach` | Use `for...of` or `Promise.all(map(...))` |
| 8 | Unlimited parallel calls | Concurrency limit + timeout |
| 9 | Heavy synchronous work in a request | Worker thread, queue, or separate service |
| 10 | Empty `catch`, or swallowing errors | Handle, wrap with context, or rethrow |

---

# Phase 1 Exit Checklist

You are ready for **Phase 2 — TypeScript** when you can do **all** of these without looking at notes:

**Concepts**
- [ ] Explain `var` / `let` / `const`, TDZ, and hoisting
- [ ] Explain primitive vs reference and shallow vs deep copy with bug examples
- [ ] Explain closures, lexical scope, and the scope chain with real examples
- [ ] Explain `this` binding rules, and fix a lost `this`
- [ ] Explain promises, `async/await`, and all four `Promise` combinators
- [ ] Explain the event loop, microtasks, `nextTick`, and `setImmediate`
- [ ] Explain why CPU-heavy code blocks Node.js, and three ways to fix it
- [ ] Explain the prototype chain, and how `class` builds on it

**Skills**
- [ ] Group, filter, sort, and transform records with array methods
- [ ] Write `debounce`, `throttle`, `memoize`, `pipe`, and `once` from memory
- [ ] Write a concurrency limiter, timeout, and retry helper from memory
- [ ] Read a stack trace and find the failing line quickly
- [ ] Find a simple memory leak using a heap snapshot

**Proof of work**
- [ ] 30 basic problems solved
- [ ] Calculator and validator projects finished
- [ ] Capstone Mini Job Runner finished, with tests
- [ ] At least 15 interview questions answered out loud in simple English
- [ ] A `mistakes.md` file with real entries

> **Reminder from the roadmap:** the goal is mastery through implementation, not merely finishing topics.

**Next:** Phase 2 — TypeScript from Zero to Advanced. Every idea in Phase 1 stays valid there. TypeScript only adds a type-checking layer on top of JavaScript.

---

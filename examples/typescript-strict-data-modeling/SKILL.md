---
name: typescript-strict-data-modeling
description: Model frontend data in TypeScript so invalid states cannot be represented, using discriminated unions, exhaustiveness checks, and precise generics. Use when replacing any-typed API payloads, designing a state shape for a UI feature, adding runtime validation at a boundary, or fixing unsafe type assertions.
license: Proprietary
metadata:
  version: "1.0.0"
  difficulty: advanced
  technology: typescript
---

# TypeScript Strict Data Modeling

## Name

`typescript-strict-data-modeling`

## Description

Model frontend data in TypeScript so invalid states cannot be represented, using discriminated unions,
exhaustiveness checks, and precise generics. Use when replacing `any`-typed API payloads, designing a
state shape for a UI feature, adding runtime validation at a boundary, or fixing unsafe type assertions.

## Purpose

Move correctness from review comments into the type system, so a component cannot be handed a shape it
cannot render and a missing case is a compile error rather than a blank screen.

## When to use

Use this skill when:

- An API response, `JSON.parse` result, or form input is typed as `any` or `unknown` and needs a type.
- A component has boolean flag combinations such as `isLoading`, `isError`, and `hasData` that can be
  contradictory.
- Adding runtime validation for data crossing a trust boundary.
- Reviewing type assertions and non-null assertions.
- Typing a reusable generic function or a state container.

Do not use this skill when:

- The project has not enabled `strict`. Turn it on first; every rule here assumes it.
- The problem is build configuration, bundler resolution, or declaration file emission.
- Typing third-party library types rather than your own data.

## Prerequisites

- TypeScript installed with `"strict": true`.
- Recommended additional flags: `noUncheckedIndexedAccess`, which turns an out-of-range index access
  into `T | undefined` instead of a silent `T`.
- Read access to the installed TypeScript major version's release notes before relying on a feature
  introduced in a specific release.

Assumptions:

- `strict` is already enabled. If it is not, enabling it is a separate task with its own migration.
- No runtime schema validation library is assumed. If the project uses one, use it; the patterns here
  work with or without one.

## Core concepts

- **Model states, not flags.** `isLoading` plus `data` can represent loading-with-stale-data,
  error-with-data, and empty. A discriminated union makes each state a separate, explicit case.
- **Types are erased.** Nothing stops a caller lying to the compiler. Any data from outside the
  program must be validated at runtime before it is trusted as a type.
- **`unknown` is the safe default.** It accepts any value and permits no operations. `any` disables
  checking in both directions and propagates.
- **Exhaustiveness is the payoff.** A `never` check in the `default` branch turns a new variant into a
  compile error at every site that must handle it.
- **Assertions are debt.** `as` and `!` move the burden from the compiler to the reader. Each one is a
  claim that must be true, and there is no check that it is.

## Step-by-step workflow

1. **Identify the states.** List every mutually exclusive situation the data can be in, including
   empty, loading, error, and success-with-no-results, which are usually conflated by accident.
2. **Choose the representation.** A discriminated union when the states differ in shape. An optional
   property only when absence is genuinely independent of the rest. A generic parameter when the shape
   is structurally identical across several types.
3. **Add the discriminant.** A literal-valued field: `status`, `kind`, `type`. It enables narrowing and
   gives the compiler something to switch on.
4. **Write the exhaustive handler.** End every `switch` with a `default` that assigns the value to
   `never`. Add a new variant and the build breaks exactly where handling is missing.
5. **Validate at the boundary.** For `JSON.parse`, `fetch().json()`, form input, `postMessage`, or local
   storage, write a validator that returns the type or throws. Do not cast the result.
6. **Replace `any` at the edges first.** Start where untyped data enters. Interior `any` is usually
   downstream of a boundary that was never typed.
7. **Remove assertions one at a time.** Each removal either compiles, which proves it was unnecessary,
   or exposes a real modelling gap worth fixing properly.
8. **Turn on `noUncheckedIndexedAccess`.** Expect errors on array and record indexing. Fix them with
   explicit handling rather than `!`.

## Recommended project structure

Keep types next to the code that owns them, and keep validators separate from the types they check.

```text
src/
  features/
    checkout/
      types.ts        # discriminated unions for checkout state
      schema.ts       # runtime validation for external payloads
      validate.ts     # hand-written validators
      checkout.ts     # state transitions
  shared/
    types/
      result.ts       # reusable Result type
```

Only extract a type into `shared/` once a second module imports it. A `types.ts` file with one
importer is indirection without benefit.

## Code examples

Flags replaced by a discriminated union:

```ts
// Before: every impossible combination is representable.
interface SearchState {
  isLoading: boolean
  isError: boolean
  data?: Result[]
  error?: string
}

// After: only real states exist.
type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Result[] }
  | { status: 'error'; message: string }
```

Narrowing plus an exhaustiveness check:

```ts
function describe(state: SearchState): string {
  switch (state.status) {
    case 'idle':
      return 'Type to search'
    case 'loading':
      return 'Searching…'
    case 'success':
      return `${state.data.length} results`
    case 'error':
      return state.message
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}
```

Add a `'refreshing'` variant and `describe` fails to compile, which is the point.

A validator at the trust boundary:

```ts
type User = { id: string; name: string; roles: Array<'admin' | 'editor' | 'viewer'> }

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function parseUser(input: unknown): User {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Expected an object')
  }

  const record = input as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string') {
    throw new Error('User requires string id and name')
  }
  if (!isStringArray(record.roles)) {
    throw new Error('User requires an array of roles')
  }

  return { id: record.id, name: record.name, roles: record.roles as User['roles'] }
}
```

The single remaining assertion is checked immediately before use and cannot be deferred.

`satisfies` for configuration objects, keeping literal inference while still being checked:

```ts
const routes = {
  home: '/',
  products: '/products',
  product: '/products/:id',
} satisfies Record<string, `/${string}`>

// Type is the literal union, so routes.home has type '/'.
type RouteKey = keyof typeof routes
```

Precise generics that preserve the input type:

```ts
function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key])
}

const names = pluck(users, 'name')
//    ^? string[]
```

## Best practices

- Start at the boundary. One typed `parseUser` is worth more than ten annotated call sites downstream.
- Use a `status` discriminant over a cluster of booleans as soon as there are three or more.
- End every `switch` over a union with a `never` assignment. It is the cheapest exhaustiveness check
  available.
- Prefer `unknown` to `any` at every external boundary.
- Model failure in the type when failure is expected. A `Result`-style union removes the class of bug
  where an error is silently dropped.
- Keep unions shallow. Three nested unions are harder to read than one flat variant with an optional
  nested field.
- Derive types from data with `typeof` and `satisfies` rather than writing them twice.

## Common mistakes

- **Casting a `fetch` response to the expected type.** This asserts a shape you have not checked, and
  fails at runtime exactly when the backend drifts. Parse and validate instead.
- **Optional fields standing in for a union.** `{ data?: T; error?: string }` permits both, and
  neither, and neither.
- **`!` to silence a possibly-undefined value.** The value is genuinely absent; handle it.
- **`as` to make an incompatible type fit.** It moves the error to the consumer and deletes the
  compiler's ability to help.
- **An enum for a closed set of strings.** A union of string literals is simpler, tree-shakes, and
  works with template literal types.
- **A union with no discriminant**, forcing `in` checks and optional chaining on every property.
- **`noUncheckedIndexedAccess` disabled globally** to silence errors that were correct.
- **Generic parameters used without constraints**, leaving the body full of assertions.

## Security considerations

- Runtime validation is a security control at a trust boundary, not just a type-safety convenience.
  A `fetch` response typed as `User` with no parser is an unchecked dependency on the server's
  behaviour.
- Never let unvalidated input reach a `dangerouslySetInnerHTML` sink or a raw HTML builder, even when
  the type says it is a string. A type is a claim; the parser is the check.
- Do not type secrets as user data and pass them through generic containers. A broad `Record<string,
  unknown>` boundary that logs its input can serialise a token into a log.
- Validate redirect targets and URLs from user data against an allowlist, and type the allowlist so it
  cannot hold an arbitrary string.
- Treat deserialising persisted client storage as untrusted input. It is user-editable.

## Performance considerations

- `unknown` plus a validator is faster at runtime than a schema library with reflection, and the cost
  is linear in payload size. Validate once at the boundary, then work with the parsed value.
- Prefer discriminated unions over classes for state. A plain object shape costs one allocation;
  getter and method machinery is not free in a hot render path.
- Deeply recursive types can defeat the compiler's own optimisations and slow builds noticeably.
  Prefer bounded nesting over unbounded recursion.
- Type-level computation is erased and free at runtime, but it is paid at build time. Heavy mapped
  types over large unions will show up in CI time before they show up in the browser.

## Testing/verification checklist

- [ ] `strict: true` is enabled in `tsconfig.json`.
- [ ] `noUncheckedIndexedAccess` is enabled, or its absence is a recorded decision.
- [ ] Every `JSON.parse`, `fetch().json()`, storage read, and message payload has a runtime validator.
- [ ] No `any` remains at a trust boundary. A deliberate one is commented with a reason.
- [ ] State is modelled as a discriminated union wherever there are three or more states.
- [ ] Every `switch` over a union ends with a `never` exhaustiveness check.
- [ ] No `!` non-null assertions on values that can legitimately be absent.
- [ ] Each remaining `as` is immediately preceded by a check that justifies it.
- [ ] `npx tsc --noEmit` passes with no errors.
- [ ] Tests cover at least one invalid input per validator, asserting that it is rejected.

## Final implementation checklist

- [ ] `strict` enabled.
- [ ] Types written next to the code that owns them.
- [ ] Boundaries validated at runtime, not asserted.
- [ ] States modelled as discriminated unions with exhaustiveness checks.
- [ ] `any` removed from every entry point into the program.
- [ ] Unsafe assertions removed or justified inline.
- [ ] `npx tsc --noEmit` clean, and validator rejection paths tested.
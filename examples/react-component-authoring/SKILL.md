---
name: react-component-authoring
description: Author production React function components with correct state, effects, list rendering, and prop design. Use when writing or reviewing a React component, deciding between controlled and uncontrolled inputs, fixing an effect that runs too often, or diagnosing a list that re-renders or loses focus.
license: Proprietary
metadata:
  version: "1.0.0"
  difficulty: intermediate
  technology: react
---

# React Component Authoring

## Name

`react-component-authoring`

## Description

Author production React function components with correct state, effects, list rendering, and prop
design. Use when writing or reviewing a React component, deciding between controlled and uncontrolled
inputs, fixing an effect that runs too often, or diagnosing a list that re-renders or loses focus.

## Purpose

Produce React components that hold no stale state, run no unnecessary effects, and keep identity stable
across renders, without reaching for memoisation that has not been measured.

## When to use

Use this skill when:

- Writing a new function component or refactoring an existing one.
- Deciding whether a value belongs in state, a ref, derived data, or a prop.
- Converting between controlled and uncontrolled form inputs.
- A list re-renders on every keystroke, loses focus, or shows stale rows.
- Reviewing a component before it goes to production.

Do not use this skill when:

- Setting up a project, build tool, or router. This skill assumes an existing React application.
- Writing server-side rendering, streaming, or data fetching strategy beyond client effects.
- Choosing a state management library. That is a separate decision.

## Prerequisites

- An existing React application with a working build and development server.
- React installed. Check the installed major version before relying on any API introduced or removed
  in a specific release.
- TypeScript is optional. If the project uses it, keep prop types in the project's existing style.

Assumptions:

- Function components with hooks. Class components are out of scope.
- The project already has a styling approach. This skill does not introduce one.

## Core concepts

- **Render is a pure function.** A component returns a description of the UI from props and state. It
  must not mutate anything outside itself, start a network request, or write to a ref during render.
- **State is a snapshot.** The `state` variable in a given render is frozen. Reading it inside an
  asynchronous callback reads the value from that render, which is why "stale closure" bugs happen.
- **Derived data is not state.** If a value can be computed from props or state during render, compute
  it. Storing it in state creates a synchronisation bug waiting to happen.
- **Effects synchronise with something outside React.** Subscriptions, timers, network requests,
  imperative DOM, third-party widgets. Effects are not for deriving values.
- **Identity matters.** `key` tells React which item in a list is which. An unstable or index-based key
  causes remounts, lost focus, and incorrect animation.

## Step-by-step workflow

1. **Define the contract.** Decide what the component owns versus what it receives. Props are inputs;
  state is owned. If a value can arrive from the parent, it is a prop.
2. **Classify every piece of data.** For each value: prop, state, derived, or ref. Write the list down
   before writing code. Values that are only needed by event handlers, and never rendered, are ref
   candidates rather than state.
3. **Model state as a unit.** If two values must change together, use a single state object or a
   reducer so they cannot desynchronise. Reducers make transitions testable without rendering.
4. **Decide control for inputs.** Controlled when the parent or form library needs the value; otherwise
   uncontrolled with a `defaultValue`. Do not mix the two on one input.
5. **Write the render path.** Markup first, using props and derived values only.
6. **Add effects last, and only for external synchronisation.** Every effect needs a teardown if it
   subscribes, schedules, or requests. Include the correct dependency list rather than suppressing
   the lint rule.
7. **Handle states, not just the happy path.** Empty, loading, error, and overflow all need markup.
8. **Verify identity.** For any mapped list, check that `key` is a stable identifier from the data, not
   the array index and not a value derived from position.
9. **Test behaviour, not implementation.** Assert what the user sees after interaction. Do not assert
   that a hook was called a certain number of times.

## Recommended project structure

Place the component and its test together. Colocation is the React default and beats a global
`components/` bucket once a project has more than a handful of them.

```text
src/
  features/
    checkout/
      PaymentForm.tsx
      PaymentForm.test.tsx
      usePaymentDraft.ts      # state logic, extracted when the component grows
  shared/
    ui/
      Button.tsx
```

Extract a custom hook when state logic needs testing independently of rendering, or when two
components need the same behaviour. Do not extract one preemptively.

## Code examples

Derived data belongs in the render body, not in state:

```jsx
function Cart({ items }) {
  // Derived: recomputed every render, can never go stale.
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return <p>Total: {total}</p>
}
```

A controlled input with a stable update:

```jsx
function SearchField({ value, onChange }) {
  return (
    <label>
      Search
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
```

State that must change together, modelled as one unit:

```jsx
import { useReducer } from 'react'

const initialForm = { email: '', password: '', submitting: false, error: null }

function reducer(state, action) {
  switch (action.type) {
    case 'field':
      return { ...state, [action.field]: action.value }
    case 'submit':
      return { ...state, submitting: true, error: null }
    case 'failure':
      return { ...state, submitting: false, error: action.error }
    default:
      return state
  }
}

function LoginForm() {
  const [state, dispatch] = useReducer(reducer, initialForm)
  // ...
}
```

An effect that subscribes and cleans up:

```jsx
import { useEffect, useState } from 'react'

function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
```

A stable list key:

```jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.label}</li>
      ))}
    </ul>
  )
}
```

## Best practices

- Keep components small enough that you can read the whole render path at once. Split by
  responsibility, not by line count.
- Colocate state with the component that owns it. Lifting state up is correct only when two siblings
  genuinely need the same value.
- Prefer a controlled input when the value must be validated or submitted from outside the component.
- Use a stable data identifier as `key`. Index keys are correct only for a list that is never
  reordered, filtered, or removed from.
- Name booleans as assertions: `isOpen`, `hasError`, `canSubmit`.
- Give every async boundary an explicit loading, error, and empty state rather than letting the
  component render `null`.
- Use function updater form, `setCount((c) => c + 1)`, whenever the next value depends on the previous
  one.

## Common mistakes

- **Deriving state in an effect.** Compute it during render. An effect that sets state from other state
  adds a render pass and a stale-value window.
- **Fixing a stale closure by adding a dependency and creating an infinite loop.** The real fix is
  usually to move the read into a functional update.
- **Using the array index as a `key`.** Removing or reordering a row then remounts the wrong elements,
  losing focus and input state.
- **Memoising everything.** `useMemo` and `useCallback` have real cost. Measure, then memoise the
  measured problem.
- **Copying props into state and syncing with an effect.** The props changed; render from the props.
  Initialise state from a prop only when the prop is a genuine seed for later edits.
- **Mutating a prop or a state object in place.** Create a new value instead.
- **Running a fetch on every render** because the effect has no dependency array and no abort.

## Security considerations

- **Never render untrusted HTML.** `dangerouslySetInnerHTML` is an XSS sink. Sanitise with a maintained
  sanitiser if rich text is genuinely required, and treat any bypass of it as a full review.
- **Validate on the server too.** Client validation is a usability feature, not a control.
- **Do not put secrets in props.** Anything in props can be serialised into SSR payloads and appears in
  the React devtools tree. Read credentials on the server.
- **Escape by default.** JSX escapes interpolated strings. Do not defeat it by building HTML strings.
- **Watch redirect targets.** A prop used as a post-login redirect is an open-redirect vector unless it
  is validated against an allowlist.

## Performance considerations

- Measure before optimising. Use the React DevTools profiler to find the component that actually
  re-renders; the usual cause is context or prop identity, not a missing memo.
- When memoising is warranted, stabilise the props that trigger it: pass a primitive, hoist a stable
  handler, or pass children as content.
- Long lists need virtualisation, not memoisation. Render only what is visible once the list is long
  enough that the DOM cost is measurable.
- Do not memoise cheap computations. Sorting a few hundred items during render is not a bottleneck;
  a memo that recomputes every render anyway is worse.
- Colocate `useState` so a state change re-renders the smallest possible subtree.

## Testing/verification checklist

- [ ] Every value is classified as prop, state, derived, or ref.
- [ ] No effect exists whose only job is to derive a value.
- [ ] Every subscription, timer, or request has a teardown.
- [ ] Every list uses a stable data identifier as `key`, not the index.
- [ ] The component renders a defined state for empty, loading, error, and populated input.
- [ ] Type checking passes: `npx tsc --noEmit`.
- [ ] Tests pass: `npm test`.
- [ ] Tests assert user-visible behaviour after interaction, not hook call counts.
- [ ] Profile with React DevTools before adding any memoisation.

## Final implementation checklist

- [ ] Props documented and typed in the project's existing style.
- [ ] No value stored in state that could be derived.
- [ ] No prop or state mutation.
- [ ] Effects have accurate dependency lists and clean up.
- [ ] Controlled and uncontrolled never mixed on one input.
- [ ] No `dangerouslySetInnerHTML` without sanitisation and a stated reason.
- [ ] Empty, loading, error, and populated states all render.
- [ ] `npx tsc --noEmit` and `npm test` both pass.
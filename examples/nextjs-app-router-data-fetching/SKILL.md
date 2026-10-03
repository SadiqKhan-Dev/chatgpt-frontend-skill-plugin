---
name: nextjs-app-router-data-fetching
description: Fetch and render data in the Next.js App Router using server components, streaming boundaries, and explicit cache lifetimes. Use when choosing between server and client components, deciding whether a fetch should be cached, streaming slow data with Suspense, or fixing stale data after a mutation.
license: Proprietary
metadata:
  version: "1.0.0"
  difficulty: advanced
  technology: nextjs
---

# Next.js App Router Data Fetching

## Name

`nextjs-app-router-data-fetching`

## Description

Fetch and render data in the Next.js App Router using server components, streaming boundaries, and
explicit cache lifetimes. Use when choosing between server and client components, deciding whether a
fetch should be cached, streaming slow data with Suspense, or fixing stale data after a mutation.

## Purpose

Place data fetching where it belongs, make every cache lifetime a deliberate choice, and keep the slow
parts of a page from blocking the fast parts.

## When to use

Use this skill when:

- Adding data fetching to a route under `app/`.
- Deciding whether a component needs `'use client'`.
- A page blocks on one slow request and the whole route feels slow.
- Data is stale after a mutation and you need to choose a revalidation strategy.
- Moving a page from the Pages Router to the App Router.

Do not use this skill when:

- Setting up the project, styling, or routing conventions.
- Writing purely client-side interactivity with no server data involved.
- Working outside the App Router. The Pages Router has a different data model and different APIs.

## Prerequisites

- A Next.js application using the App Router. Confirm this before anything else; the Pages Router is
  not covered here.
- A reachable data source: a database, an internal service, or a third-party API.
- Read access to the installed Next.js version's documentation for caching defaults.

Assumptions:

- The App Router, not the Pages Router.
- React Server Components are available.
- Cache revalidation helpers are present in the installed version. Their signatures and default
  caching behaviour have changed across major releases, so verify against the installed version before
  relying on a specific one.

## Core concepts

- **Server Components are the default.** A component without `'use client'` runs on the server. Adding
  the directive moves it, and everything it imports, into the client bundle. Add it as late as
  possible.
- **The client boundary is where interactivity starts.** Event handlers, state, and browser-only APIs
  require a client component. Server components can be passed into a client component as props, but
  the reverse requires serialisable props.
- **Streaming is per-boundary.** `loading.tsx` and inline `Suspense` create boundaries. Slow data
  behind a boundary does not block the rest of the route.
- **Caching is opt-in and per-fetch.** In current App Router versions `fetch` is not cached by default.
  Treat every request as live unless you have chosen otherwise, and say what you chose.
- **Mutations need revalidation.** After a write, cached reads elsewhere are stale until you revalidate
  a path or tag, or until the next request.

## Step-by-step workflow

1. **Confirm the router.** Check for an `app/` directory and the installed Next.js major version.
2. **Classify the data.** Public and identical for every user, user-specific, or request-specific.
   This determines the cache lifetime, and it is the most consequential decision in this workflow.
3. **Start on the server.** Fetch in a server component by default. Do not add `'use client'` to make a
   fetch work.
4. **Push interactivity down.** Move only the smallest interactive leaf into a client component. Keep
   data fetching above the boundary and pass serialisable props across it.
5. **Declare the cache lifetime.** Make it explicit per request, using the mechanism the installed
   version documents. Do not rely on a default you have not checked.
6. **Add a streaming boundary around slow data.** Put `loading.tsx` at the route level for a whole-page
   fallback, and inline `Suspense` for a specific slow region so the rest renders immediately.
7. **Handle failure explicitly.** Add `error.tsx` for the segment. Do not let a rejected fetch surface
   as an unhandled error with no recovery path.
8. **Revalidate after mutations.** After a Server Action or Route Handler writes, revalidate the
   affected path or tag so subsequent reads are correct.
9. **Verify.** Check the rendered HTML for the streamed content, not just the final hydrated state.

## Recommended project structure

Data fetching belongs close to the route that renders it, not in a global client cache.

```text
src/
  app/
    products/
      page.tsx            # server component, fetches the list
      loading.tsx         # route-level streaming boundary
      error.tsx           # segment-level error boundary
      [productId]/
        page.tsx          # fetches one product
  lib/
    db.ts                 # data access, used by server code only
  components/
    AddToCart.tsx         # client component; receives data as props
```

Keep database access in `lib/` imported only by server components. Importing it from a client module
either fails the build or drags the driver into the browser bundle.

## Code examples

Fetching in a server component, with the cache lifetime stated:

```jsx
// app/products/page.tsx
// Server Component by default: no 'use client' here.

export default async function ProductsPage() {
  const response = await fetch(`${process.env.API_ORIGIN}/products`, {
    // Live data: no caching directive.
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to load products: ${response.status}`)
  }

  const products = await response.json()
  return <ProductList products={products} />
}
```

Streaming a slow region while the rest renders:

```jsx
import { Suspense } from 'react'

async function Reviews() {
  const response = await fetch(`${process.env.API_ORIGIN}/reviews`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Failed to load reviews')
  return <ReviewList reviews={await response.json()} />
}

export default function ProductPage({ params }) {
  return (
    <main>
      <ProductSummary id={params.productId} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews />
      </Suspense>
    </main>
  )
}
```

Interactivity at the smallest possible boundary:

```jsx
// components/AddToCart.tsx
'use client'

import { useState } from 'react'

export function AddToCart({ productId, price }) {
  const [quantity, setQuantity] = useState(1)
  return (
    <form action="/api/cart">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="price" value={price} />
      <label>
        Quantity
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
      </label>
      <button type="submit">Add to cart</button>
    </form>
  )
}
```

A revalidating Server Action:

```jsx
// app/products/actions.js
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function deleteProduct(formData) {
  const id = formData.get('id')

  const deleted = await db.products.delete(id)
  if (!deleted) {
    throw new Error('Product not found')
  }

  revalidatePath('/products')
}
```

Confirm `revalidatePath` and the surrounding mutation pattern against the installed version before
copying this into a project.

## Best practices

- Fetch as close to the component that needs the data as possible. A shared cache at the root turns
  every navigation into a cache-coherence problem.
- Push `'use client'` down to leaves. It is a bundling boundary, so a directive near the root drags
  the whole tree into the client.
- Pass the narrowest props across the server/client boundary. Props are serialised into the HTML
  payload, so passing a whole record when the component needs a label costs bytes on every request.
- Give every slow fetch its own boundary so one slow region does not hold the page.
- Treat every cache lifetime as a decision to justify, not a default to inherit.
- Revalidate the specific path or tag that changed. Revalidating everything is a performance bug with
  extra steps.
- Make error and not-found states real routes, not inline conditionals scattered across components.

## Common mistakes

- **Adding `'use client'` at the top of a layout or page** because one descendant needed an event
  handler. This is the most common performance mistake in the App Router.
- **Fetching in a client component** that could fetch on the server, losing streaming and adding a
  waterfall.
- **A serial request waterfall.** Sequential `await`s that do not depend on each other should be
  started together with `Promise.all`.
- **Assuming `fetch` caches.** In current versions it does not by default. Verify the installed
  version's behaviour rather than writing from memory.
- **Mutating without revalidating**, then debugging stale reads as a cache bug.
- **Passing a non-serialisable prop across the server/client boundary**, such as a function, a `Date`
  instance, or a database row with methods.
- **Reading a secret into a client component**, which exposes it in the browser bundle.

## Security considerations

- **Never fetch with credentials from a client component.** Server-side fetches can attach the session
  or service token; client-side fetches cannot, and attempting to expose the token ships it to the
  browser.
- **Keep secrets in server-only modules.** A module imported only by server components can use
  `server-only` to turn an accidental client import into a build error rather than a leak.
- **Validate in Route Handlers and Server Actions.** Both accept arbitrary input from the network.
  Treat every parameter as untrusted and authorise the session before reading or writing.
- **Do not leak internal errors.** `error.tsx` receives an error object that may carry internal detail.
  Log it server-side and show a generic message.
- **Set an explicit cache lifetime on authenticated responses.** A shared cache entry containing one
  user's data is a data leak.
- **Sanitise any HTML rendered from stored content** before returning it from a route.

## Performance considerations

- Streaming is the cheapest win available. Put `loading.tsx` on any route whose slowest fetch is user
  visible.
- Start independent requests concurrently with `Promise.all` rather than awaiting them in sequence.
- Move the client boundary down; the size of the client bundle is roughly the size of everything
  under the nearest `'use client'`.
- Keep payloads narrow. Fetch the fields the route renders, not the whole record.
- Set the longest cache lifetime the data actually allows, and the shortest the user experience needs.
  An over-long lifetime serves stale data; an over-short one refetches on every request.
- Measure the HTML response, not only the hydrated page. Streaming shows up in time-to-first-byte.

## Testing/verification checklist

- [ ] The installed Next.js major version is recorded, and the caching defaults for that version were
      read rather than assumed.
- [ ] `'use client'` appears only on leaves that need interactivity.
- [ ] No client component performs an authenticated fetch.
- [ ] Independent requests are started concurrently, not awaited in sequence.
- [ ] Every slow fetch sits behind a `loading.tsx` or inline `Suspense` boundary.
- [ ] `error.tsx` exists for each segment that fetches, and shows no internal detail.
- [ ] Cache lifetime is explicit for every request, with a written reason.
- [ ] Every mutation revalidates the affected path or tag.
- [ ] Auth is checked in every Route Handler and Server Action that writes.
- [ ] `npm run build` succeeds, and streaming is visible in the served HTML.

## Final implementation checklist

- [ ] App Router confirmed, Pages Router assumptions removed.
- [ ] All `lib/` data access imported only by server code.
- [ ] No unnecessary `'use client'` directives.
- [ ] No request waterfalls.
- [ ] Cache lifetimes explicit and justified.
- [ ] Streaming boundaries in place for every slow region.
- [ ] Revalidation wired for every mutation.
- [ ] No secrets in client modules, and no internal errors surfaced to the UI.
- [ ] `npm run build` passes.
---
name: tailwind-responsive-layout
description: Build responsive layouts with Tailwind CSS using mobile-first breakpoints, container queries, and intrinsic sizing instead of fixed breakpoints. Use when laying out a page or component that must adapt across viewport widths, replacing a grid of breakpoint overrides, or stopping a layout from breaking at an intermediate width.
license: Proprietary
metadata:
  version: "1.0.0"
  difficulty: intermediate
  technology: tailwind-css
---

# Tailwind Responsive Layout

## Name

`tailwind-responsive-layout`

## Description

Build responsive layouts with Tailwind CSS using mobile-first breakpoints, container queries, and
intrinsic sizing instead of fixed breakpoints. Use when laying out a page or component that must adapt
across viewport widths, replacing a grid of breakpoint overrides, or stopping a layout from breaking at
an intermediate width.

## Purpose

Produce layouts that adapt to the space a component actually gets, not to a guess about the viewport,
so the same component works in a full page and inside a narrow panel without a second set of classes.

## When to use

Use this skill when:

- Building or fixing a page, section, grid, or card layout.
- A layout breaks between two breakpoints rather than at either of them.
- The same component must work at different widths depending on where it is placed.
- Replacing hard-coded pixel widths and heights with intrinsic sizing.
- Deciding between a grid and a flex layout for a set of items.

Do not use this skill when:

- The project does not use Tailwind CSS. Do not introduce it for a single layout problem.
- Theming, colour systems, or typography scales are the actual question.
- You need a CSS feature Tailwind does not cover. Write plain CSS in a stylesheet rather than
  assembling a fragile arbitrary-value chain.

## Prerequisites

- Tailwind CSS installed and configured in the project.
- The installed Tailwind major version. Configuration moved from a JavaScript config file to a
  CSS-first setup in v4, and v3.2 introduced container queries. Verify which mechanism the installed
  version uses before writing configuration.
- Content detection must be scanning the files being styled, or classes will be missing from the
  output.

Assumptions:

- Tailwind CSS, not Bootstrap or another utility framework. Do not mix two utility systems in one
  component.
- Dark mode and design tokens follow whatever the project already configures.

## Core concepts

- **Mobile-first.** Unprefixed utilities describe the smallest viewport. A prefixed utility is a
  minimum: `md:flex-row` means "at `md` and above", not "until `md`".
- **The default breakpoint set is coarse.** `sm`, `md`, `lg`, `xl`, and `2xl` cover common cases.
  Intermediate widths between them are where fixed layouts fail.
- **Breakpoints follow the viewport. Container queries follow the element.** A card in a two-column
  layout needs to respond to its column, not the window.
- **Prefer intrinsic sizing.** `grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]` adapts continuously.
  A fixed column count cannot.
- **Flow is the default.** Let content determine height with padding and gap rather than fixed heights.

## Step-by-step workflow

1. **Identify the container.** Full page, sidebar, or reusable component embedded somewhere unknown.
   This decides whether viewport breakpoints or container queries are correct.
2. **Write the narrow layout first.** It is the unprefixed form and the one most users see on the
   smallest supported device.
3. **Add breakpoints for genuine mode changes,** not for small size nudges. If two adjacent breakpoints
   only adjust a gap, the layout should be intrinsic instead.
4. **Switch to intrinsic sizing** wherever a fixed count is the source of the problem: `auto-fit` with
   `minmax` for card grids, `flex-wrap` for tag lists, `min-w-0` on flex children that contain text.
5. **Use a container query for reusable components** whose width does not track the viewport. Mark the
   parent as a container, then query it.
6. **Let content set the height.** Replace fixed heights with padding, `min-h-*`, or aspect ratios.
7. **Check the awkward widths,** not just the named breakpoints: 320px, roughly 640px, 768px, 1024px,
   1440px, and the width of the narrowest column the component actually appears in.
8. **Verify dark mode and focus states** alongside the layout, since both are easy to lose in a
   rewrite.

## Recommended project structure

Keep layout utilities with the component. Extract them into a component variant only when the same
arrangement appears in three or more places.

```text
src/
  components/
    layout/
      Container.tsx     # max-width + horizontal padding, one place
      CardGrid.tsx      # intrinsic grid
    ui/
      Card.tsx
  styles/
    globals.css         # Tailwind entry point and tokens
```

Reserving `Container` and `CardGrid` as the only places that define page width and grid behaviour is
what stops breakpoint overrides from spreading across the codebase.

## Code examples

An intrinsically sizing card grid, no breakpoints at all:

```html
<ul class="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-6">
  <li class="rounded-lg border border-neutral-200 p-6">…</li>
  <li class="rounded-lg border border-neutral-200 p-6">…</li>
</ul>
```

Mobile-first with a real mode change: stacked on small screens, side-by-side from `md` up.

```html
<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
  <div class="flex flex-col gap-1">
    <h2 class="text-lg font-semibold">Billing</h2>
    <p class="text-sm text-neutral-600">Manage payment methods and invoices.</p>
  </div>
  <button class="rounded-md bg-neutral-900 px-4 py-2 text-white">Update card</button>
</div>
```

Note that `md:flex-row` is a floor, not a range. Nothing at a larger breakpoint reverses it, because
the layout does not need reversing.

A wrapping tag list that never overflows:

```html
<ul class="flex flex-wrap gap-2">
  <li class="rounded-full border border-neutral-200 px-3 py-1 text-sm">design</li>
  <li class="rounded-full border border-neutral-200 px-3 py-1 text-sm">accessibility</li>
</ul>
```

A container query for a component that must adapt to its column, not the window:

```html
<!-- Parent establishes the query container. -->
<div class="@container">
  <article class="flex flex-col gap-4 @md:flex-row">
    <img src="/cover.jpg" alt="" class="aspect-video w-full object-cover @md:w-48 @md:shrink-0" />
    <div class="min-w-0 flex-1">
      <h3 class="font-semibold">Release notes</h3>
      <p class="text-sm text-neutral-600">…</p>
    </div>
  </article>
</div>
```

`min-w-0` on the flex child matters: a flex item defaults to a minimum width driven by its content, so
long unbroken strings overflow without it.

Intrinsic sizing instead of fixed dimensions:

```html
<!-- Fixed: breaks with translated or resized content. -->
<img src="/hero.png" alt="" width="1200" height="400" />

<!-- Intrinsic: keeps the aspect ratio and never overflows its column. -->
<img src="/hero.png" alt="" class="h-auto w-full max-w-3xl rounded-lg" />
```

## Best practices

- Write the unprefixed layout first and let it be the fallback. Every prefixed class is an override
  on top of a working default.
- Reach for `auto-fit` and `minmax` before a breakpoint. Continuous adaptation beats discrete jumps.
- Use container queries for anything reusable. A component that assumes it owns the full viewport will
  break the first time it is placed in a sidebar.
- Always include `min-w-0` on a flex child containing text, and `min-h-0` on a grid or flex child that
  scrolls. Without them, overflow is silently clipped.
- Use `gap` instead of margin-based spacing between siblings. It avoids the last-child margin problem
  entirely.
- Size with `rem` units so layouts respect the user's font-size preference.
- Keep the number of distinct breakpoints small. Each one is a rule to remember and a layout to test.

## Common mistakes

- **Writing desktop-first with `md:` doing the base work** and `sm:` undoing it. The classes read
  backwards and the mobile case becomes an afterthought.
- **A fixed column count.** Three columns at every width is wrong on a phone, and one column is wrong
  on a wide display. `auto-fit` handles both.
- **Fixed pixel heights** on text containers, which clip when the user increases font size or content
  changes.
- **Viewport breakpoints inside a reusable component**, so it looks correct in the storybook and wrong
  in the app.
- **Missing `min-w-0`**, producing mysterious overflow that only appears with long unbroken strings such
  as URLs.
- **Arbitrary values used as a substitute for configuration.** A long chain of square-bracket classes
  is harder to read than a small stylesheet or a theme token.
- **Using `@apply` heavily**, which rebuilds the utility layer in userland and defeats the point of
  utility classes.
- **Testing only the named breakpoints,** so the layout breaks at 900px, between `md` and `lg`.

## Security considerations

- **Never interpolate untrusted input into a class name.** Building a class from a URL parameter or
  form field lets an attacker inject arbitrary utilities. Map input to a fixed, known set of class
  strings with an explicit lookup, and fall back to a safe default for anything unrecognised.
- **Treat arbitrary values as code generation.** An arbitrary value containing a `url()` can reference
  an external or attacker-controlled resource. Keep such values in your own stylesheet.
- **Do not load remote assets through arbitrary values** or CSS injection points. A leaked token in a
  `background-image` URL is a data leak that never appears in a request log.
- **Sanitise any HTML injected into a styled container.** Layout classes do not make untrusted markup
  safe.

## Performance considerations

- Large numbers of distinct classes increase the amount of CSS the build must generate and, in
  development, the work Tailwind does on each change. A design system with a small, reused set of
  utilities beats per-component improvisation.
- Complex arbitrary values are re-evaluated by the browser on every style recalculation. Prefer
  utility classes the engine already understands.
- `will-change` and layout-affecting transitions on many elements cost memory and main-thread time.
  Apply them to a few elements, not a grid of 500 cards.
- Animating layout properties such as `width`, `top`, or `height` forces layout on each frame.
  Animate `transform` and `opacity` instead, which stay on the compositor.
- Content-visibility can cut initial render cost for long below-the-fold sections. Measure first;
  it can interfere with find-in-page and accessibility tooling.

## Testing/verification checklist

- [ ] Narrow layout written first, with unprefixed classes only.
- [ ] Layout verified at 320px, 640px, 768px, 1024px, and 1440px, plus the narrowest real container.
- [ ] Grid or list uses intrinsic sizing rather than a fixed column count.
- [ ] Reusable components respond to their container, not only to viewport width.
- [ ] Flex and grid children containing text have `min-w-0`.
- [ ] No fixed heights on text containers.
- [ ] No class name is built by interpolating untrusted input.
- [ ] Dark mode and focus-visible states verified alongside the layout.
- [ ] Browser zoom to 200% and a user font-size increase both leave the layout usable.
- [ ] Layout tested with long unbroken content such as a URL or a translated string.

## Final implementation checklist

- [ ] Narrow-first base layout in place.
- [ ] Continuous adaptation used wherever a fixed count caused the problem.
- [ ] Container queries used for reusable components.
- [ ] Overflow guards in place on flex and grid children.
- [ ] No arbitrary-value class chains where a stylesheet rule would read better.
- [ ] No untrusted input reaching a class name.
- [ ] Checked at awkward widths, not only at named breakpoints.
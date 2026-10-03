# Supported technologies

The catalog is defined once, in `scripts/lib/technologies.mjs`. This document is the human-readable
view of it. Validation, the reference table, and the skill instructions all read from that module, so
they cannot drift apart.

## Enumerated by kind

`kind` changes how a skill for that entry must be written.

- `language`, `framework`, `library`, `component-library`, `styling`, `build-tool` may imply an
  install, a dependency, or a build step.
- `practice` is a cross-cutting concern. **A skill for a practice must not introduce a library,
  framework, build tool, or configuration the user did not ask for.**

| id                        | Label                    | Kind               |
| ------------------------- | ------------------------ | ------------------ |
| `html`                    | HTML                     | `language`         |
| `css`                     | CSS                      | `styling`          |
| `javascript`              | JavaScript               | `language`         |
| `typescript`              | TypeScript               | `language`         |
| `react`                   | React                    | `library`          |
| `nextjs`                  | Next.js                  | `framework`        |
| `vue`                     | Vue                      | `framework`        |
| `angular`                 | Angular                  | `framework`        |
| `tailwind-css`            | Tailwind CSS             | `styling`          |
| `bootstrap`               | Bootstrap                | `styling`          |
| `vite`                    | Vite                     | `build-tool`       |
| `shadcn-ui`               | ShadCN UI                | `component-library`|
| `web-apis`                | Web APIs                 | `practice`         |
| `accessibility`           | Accessibility            | `practice`         |
| `responsive-design`       | Responsive Design        | `practice`         |
| `frontend-testing`        | Frontend Testing         | `practice`         |
| `performance-optimization`| Performance Optimization | `practice`         |

## Accepted aliases

Resolution is case-insensitive and ignores punctuation, so `Next.js`, `nextjs`, and `NextJS` all match
`nextjs`.

| id                        | Also accepts                                                                     |
| ------------------------- | -------------------------------------------------------------------------------- |
| `html`                    | `html5`, `html 5`                                                                |
| `css`                     | `css3`, `css 3`                                                                  |
| `javascript`              | `js`, `ecmascript`, `vanilla js`, `vanilla javascript`                          |
| `typescript`              | `ts`                                                                             |
| `react`                   | `reactjs`, `react.js`                                                            |
| `nextjs`                  | `next`, `next.js`, `nextjs`                                                      |
| `vue`                     | `vuejs`, `vue.js`, `vue3`                                                        |
| `angular`                 | `angularjs`, `angular.js`                                                        |
| `tailwind-css`            | `tailwind`, `tailwindcss`                                                        |
| `bootstrap`               | `bootstrap5`                                                                     |
| `vite`                    | `vitejs`                                                                         |
| `shadcn-ui`               | `shadcn`, `shadcnui`, `shadcn/ui`                                                |
| `web-apis`                | `web api`, `browser api`, `browser apis`, `web platform api`, `web platform apis`, `fetch api` |
| `accessibility`           | `a11y`, `wcag`, `accessible`, `web accessibility`, `accessibility auditing`       |
| `responsive-design`       | `responsive`, `responsive layouts`, `mobile first`, `mobile-first`               |
| `frontend-testing`        | `testing`, `frontend tests`, `component testing`, `unit testing frontend`, `e2e testing` |
| `performance-optimization`| `performance`, `web performance`, `frontend performance`, `perf`, `web vitals`, `core web vitals` |

## Notes that prevent invented guidance

Each entry carries a `notes` field. These exist because each technology has a specific way an agent
goes wrong. Read the note before writing a skill for the entry.

- **Next.js** — the App Router and the Pages Router differ substantially. State which one the skill
  assumes.
- **Angular** — Angular (2+) only. Do not mix in AngularJS-era APIs.
- **Vue** — state whether Options API or Composition API is assumed.
- **ShadCN UI** — component source copied into the repository, not a runtime package import. Never
  describe it as an installed dependency.
- **Bootstrap vs Tailwind CSS** — they overlap heavily. Do not recommend both unless asked.
- **Vite** — framework-agnostic. Do not imply a framework.
- **Web APIs** — verify support against MDN before naming a specific API or option.
- **Frontend Testing** — introduce a runner only when the user names one or asks for a recommendation.
- **Performance Optimization** — require a measurement step. Do not prescribe a profiling tool.
- **Tailwind CSS** — confirm the major version before naming version-specific configuration.

## Intake questions

Each entry also carries a `questions` field: the decisions that change the skill materially and that
cannot be inferred from the technology name. `plan_skill` returns them, and `list_technologies`
returns them with the rest of the entry.

Ask them, or record each unanswered one as a labelled assumption in the draft. Both are acceptable.
Silently choosing one is not.

The full list per technology is the `questions` array in
[`scripts/lib/technologies.mjs`](../scripts/lib/technologies.mjs). A few that change the output most:

| id                | Question that must be settled                                                   |
| ----------------- | -------------------------------------------------------------------------------- |
| `nextjs`          | App Router or Pages Router?                                                      |
| `vue`             | Options API or Composition API? Vue 2 or Vue 3?                                 |
| `angular`         | Standalone components or NgModules? Signals or zone-based change detection?      |
| `tailwind-css`    | Which major version? Configuration differs between v3 and v4.                   |
| `typescript`      | Which compiler strictness level should the skill assume?                          |
| `shadcn-ui`       | Is Tailwind CSS already configured, and is that setup in scope?                  |
| `accessibility`   | Which WCAG version and conformance level is the target?                          |

## Unmatched input

If the technology is not in the catalog, `resolveTechnology` returns `unsupported` with the closest
candidates when any are within edit distance. Near matches are shown as a **hint only**. Never
substitute one.

To add a technology:

1. Append an entry to `TECHNOLOGIES` in `scripts/lib/technologies.mjs`, with `id`, `label`, `kind`,
   `aliases`, `notes`, and `questions`.
2. Add a row to the tables in this document.
3. Run `npm test`. The catalog test asserts id uniqueness, alias uniqueness, valid `kind` values, and
   that every entry has intake questions.

That is the whole extension mechanism. `plan_skill` and `list_technologies` read the same catalog, so
no tool code changes.
/**
 * Supported frontend technology catalog.
 *
 * This is the single source of truth for technology-name validation. Add a new
 * technology by appending one entry to TECHNOLOGIES; every consumer (skill
 * instructions, references/technologies.md, validators, the MCP tools) reads
 * from here.
 *
 * `kind` matters when writing a skill:
 *   - "technology" kinds may imply an install, dependency, or build step.
 *   - "practice" kinds are cross-cutting concerns. A skill for one of these must
 *     not introduce a library, framework, or build tool that the user did not ask
 *     for.
 *
 * `notes` states the mistake a writer is most likely to make for that entry.
 * `questions` lists the intake questions that must be answered or recorded as a
 * stated assumption before drafting starts. Both are consumed by the MCP
 * `plan_skill` tool, which is why they live beside the identity fields rather
 * than in the MCP layer: adding a technology stays a one-file change.
 */

export const TECHNOLOGY_KINDS = Object.freeze([
  'language',
  'framework',
  'library',
  'component-library',
  'styling',
  'build-tool',
  'practice',
])

/** @type {ReadonlyArray<{id: string, label: string, kind: string, aliases: readonly string[], notes: string, questions: readonly string[]}>} */
export const TECHNOLOGIES = Object.freeze([
  {
    id: 'html',
    label: 'HTML',
    kind: 'language',
    aliases: ['html5', 'html 5'],
    notes: 'Markup language. No build step is required; introduce a bundler only if the user asks for one.',
    questions: [
      'Is this plain static HTML, or is a template or build step in scope?',
      'Which browsers or accessibility baseline must the markup support?',
      'Should the skill cover semantic structure, or document structure such as head metadata?',
    ],
  },
  {
    id: 'css',
    label: 'CSS',
    kind: 'styling',
    aliases: ['css3', 'css 3'],
    notes: 'Styling language. Distinguish plain CSS from a preprocessor; do not assume Sass or PostCSS.',
    questions: [
      'Plain CSS, or a preprocessor such as Sass?',
      'Which layout approach is in scope: Flexbox, Grid, or both?',
      'What browser baseline must be supported, and is progressive enhancement acceptable?',
    ],
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    kind: 'language',
    aliases: ['js', 'ecmascript', 'vanilla js', 'vanilla javascript'],
    notes: 'Language only. Do not assume a framework, module format, or transpiler.',
    questions: [
      'Which runtime and module format is in scope: ES modules in the browser, or a bundled build?',
      'Is this about language fundamentals, or about DOM and browser APIs?',
      'Which browser baseline must be supported?',
    ],
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    kind: 'language',
    aliases: ['ts'],
    notes: 'Typed superset of JavaScript. State the assumed tsconfig strictness instead of inventing compiler flags.',
    questions: [
      'Which compiler strictness level should the skill assume?',
      'Is the topic type modelling, narrowing and generics, or configuration and tooling?',
      'Should the skill cover type testing, declaration files, or library authoring?',
    ],
  },
  {
    id: 'react',
    label: 'React',
    kind: 'library',
    aliases: ['reactjs', 'react.js'],
    notes: 'UI library. Ask whether a routing, styling, or data solution is in scope rather than adding one.',
    questions: [
      'Which React version should version-specific guidance target?',
      'Are hooks, classes, or both in scope?',
      'Is routing, styling, or data fetching in scope, or should the skill deliberately exclude them?',
      'Which test renderer should the testing guidance assume, if any?',
    ],
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    kind: 'framework',
    aliases: ['next', 'next.js', 'nextjs'],
    notes: 'React meta-framework. The App Router and the Pages Router differ; state which one the skill assumes.',
    questions: [
      'App Router or Pages Router?',
      'Which Next.js version should version-specific guidance target?',
      'Are Server Actions, caching, or streaming in scope, or is rendering the only concern?',
      'Is authentication in scope, and if so which approach: a library or platform primitives?',
    ],
  },
  {
    id: 'vue',
    label: 'Vue',
    kind: 'framework',
    aliases: ['vuejs', 'vue.js', 'vue3'],
    notes: 'Progressive framework. State whether Options API or Composition API is assumed.',
    questions: [
      'Vue 2 or Vue 3?',
      'Options API, Composition API, or both?',
      'Is a state management or routing solution in scope, or deliberately excluded?',
      'Single-file components only, or render functions and JSX as well?',
    ],
  },
  {
    id: 'angular',
    label: 'Angular',
    kind: 'framework',
    aliases: ['angularjs', 'angular.js'],
    notes: 'Angular (2+). Do not mix AngularJS-era APIs such as ng-controller into the skill.',
    questions: [
      'Which Angular version should version-specific guidance target?',
      'Standalone components or NgModules?',
      'Are signals in scope, or zone-based change detection?',
      'Is a state management or routing solution in scope, or deliberately excluded?',
    ],
  },
  {
    id: 'tailwind-css',
    label: 'Tailwind CSS',
    kind: 'styling',
    aliases: ['tailwind', 'tailwindcss'],
    notes: 'Utility-first CSS. Confirm the major version before naming version-specific configuration.',
    questions: [
      'Which Tailwind major version? Configuration differs between v3 and v4.',
      'Should design tokens be expressed as CSS variables, or as a Tailwind theme extension?',
      'Is responsive design, dark mode, or state variants the focus?',
      'How should class composition be handled: a helper such as clsx, or plain string joining?',
    ],
  },
  {
    id: 'bootstrap',
    label: 'Bootstrap',
    kind: 'styling',
    aliases: ['bootstrap5'],
    notes: 'Component and utility CSS framework. Note that it overlaps Tailwind; do not recommend both unless asked.',
    questions: [
      'Which Bootstrap version?',
      'Is Bootstrap used alone, or combined with another styling system?',
      'Is the focus the component set, the grid and utility API, or custom theming?',
    ],
  },
  {
    id: 'vite',
    label: 'Vite',
    kind: 'build-tool',
    aliases: ['vitejs'],
    notes: 'Dev server and bundler. Framework-agnostic; do not imply a framework.',
    questions: [
      'Which Vite major version?',
      'Is the topic dev server behaviour, build configuration, or authoring a Vite plugin?',
      'Is a framework plugin in scope, or is this framework-agnostic?',
    ],
  },
  {
    id: 'shadcn-ui',
    label: 'ShadCN UI',
    kind: 'component-library',
    aliases: ['shadcn', 'shadcnui'],
    notes: 'Component source you copy into the repository, not a runtime package import. Do not describe it as an installed dependency.',
    questions: [
      'Is Tailwind CSS already configured, and is that setup in scope?',
      'Which base style or theme preset should the examples follow?',
      'Is the focus composing existing components, or adding and editing new ones?',
      'Which icon set and form library are already present in the target project?',
    ],
  },
  {
    id: 'web-apis',
    label: 'Web APIs',
    kind: 'practice',
    aliases: [
      'web api',
      'browser api',
      'browser apis',
      'web platform api',
      'web platform apis',
      'fetch api',
    ],
    notes: 'Browser platform capabilities, not an installable package. Verify support and behaviour against MDN before naming a specific API or option.',
    questions: [
      'Which specific APIs are in scope?',
      'Which browsers must be supported, and is feature detection with a fallback acceptable?',
      'Should polyfills be discussed, or is a modern baseline assumed?',
    ],
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    kind: 'practice',
    aliases: ['a11y', 'wcag', 'accessible', 'web accessibility', 'accessibility auditing'],
    notes: 'Cross-cutting practice that applies to any technology. Must not introduce a library or build tool on its own.',
    questions: [
      'Which WCAG version and conformance level is the target?',
      'Is automated testing in scope, manual audit only, or both?',
      'Is assistive-technology testing required, and with which tools?',
    ],
  },
  {
    id: 'responsive-design',
    label: 'Responsive Design',
    kind: 'practice',
    aliases: ['responsive', 'responsive layouts', 'mobile first', 'mobile-first'],
    notes: 'Cross-cutting practice. Ask which CSS approach is in scope; do not assume a framework or utility library.',
    questions: [
      'Which CSS approach: media queries, container queries, or a utility framework?',
      'Which breakpoints and device classes must be supported?',
      'Is mobile-first or desktop-first the agreed starting point?',
    ],
  },
  {
    id: 'frontend-testing',
    label: 'Frontend Testing',
    kind: 'practice',
    aliases: [
      'testing',
      'frontend tests',
      'component testing',
      'unit testing frontend',
      'e2e testing',
    ],
    notes: 'Cross-cutting practice. Introduce a specific runner only when the user names one or asks for a recommendation.',
    questions: [
      'Which test runner is already in use, if any, or should the skill stay runner-agnostic?',
      'Which test types are in scope: unit, component, integration, or end-to-end?',
      'Is accessibility or performance testing part of the definition of done?',
    ],
  },
  {
    id: 'performance-optimization',
    label: 'Performance Optimization',
    kind: 'practice',
    aliases: [
      'performance',
      'web performance',
      'frontend performance',
      'perf',
      'web vitals',
      'core web vitals',
    ],
    notes: 'Cross-cutting practice. Require a measurement step before and after any change; do not prescribe a profiling tool unless asked.',
    questions: [
      'Which metrics are the target, and does the project already have a measurement tool?',
      'Which layer is suspected: bundle size, rendering, network, or runtime work?',
      'Is there a performance budget or regression gate already defined?',
    ],
  },
])

const BY_ID = new Map(TECHNOLOGIES.map((tech) => [tech.id, tech]))

/** Case-insensitive normalized form used for fuzzy matching. */
export function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

/** Every string a user might type for this technology. */
function forms(tech) {
  return [tech.id, tech.label, ...tech.aliases]
}

function rank(tech, needle) {
  const candidates = forms(tech).map(normalize)
  if (candidates.includes(needle)) return 0
  let best = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    if (candidate.startsWith(needle) || needle.startsWith(candidate)) {
      best = Math.min(best, 1)
      continue
    }
    best = Math.min(best, levenshtein(needle, candidate))
  }
  return best
}

/** Technologies closest to `input`, best first. */
export function suggestTechnologies(input, limit = 3) {
  const needle = normalize(input)
  if (needle === '') return []
  return TECHNOLOGIES.map((tech) => ({ tech, score: rank(tech, needle) }))
    .filter(({ score }) => score <= Math.max(2, Math.floor(needle.length / 3)))
    .sort((a, b) => a.score - b.score || a.tech.id.localeCompare(b.tech.id))
    .slice(0, limit)
    .map(({ tech }) => tech.id)
}

/** Exact match against every id, label, and alias, ignoring case and punctuation. */
function findExact(raw) {
  const needle = normalize(raw)
  if (needle === '') return null
  for (const tech of TECHNOLOGIES) {
    for (const form of forms(tech)) {
      if (normalize(form) === needle) return { technology: tech, matchedOn: form }
    }
  }
  return null
}

/**
 * Resolve a user-supplied technology name.
 *
 * @returns
 *   | { status: 'ok', technology: object, matchedOn: string }
 *   | { status: 'empty' }
 *   | { status: 'compound', reason: string, candidates: string[] }
 *   | { status: 'unsupported', input: string, suggestions: string[] }
 */
export function resolveTechnology(input) {
  if (typeof input !== 'string' || input.trim() === '') return { status: 'empty' }

  const raw = input.trim()

  // An exact catalog match is authoritative, even when the name contains a
  // separator such as "shadcn/ui".
  const exact = findExact(raw)
  if (exact !== null) return { status: 'ok', ...exact }

  // A single SKILL.md covers one technology. Multi-technology requests are a
  // planning decision for the caller, not something to guess at.
  const compound = raw.match(/[,;/]|\s+(?:and|with|plus)\s+|\s*[&+]\s*/i)
  if (compound) {
    const parts = raw
      .split(compound[0])
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length > 1) {
      return {
        status: 'compound',
        reason:
          'More than one technology was named. Create or update one SKILL.md per technology, then link them from a hub skill.',
        candidates: parts,
      }
    }
  }

  return { status: 'unsupported', input: raw, suggestions: suggestTechnologies(raw) }
}

export function getTechnology(id) {
  return BY_ID.get(id) ?? null
}

/** True when the technology is a cross-cutting practice rather than a package. */
export function isPractice(tech) {
  return tech.kind === 'practice'
}
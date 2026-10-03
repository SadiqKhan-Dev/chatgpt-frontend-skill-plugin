import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  TECHNOLOGIES,
  TECHNOLOGY_KINDS,
  normalize,
  resolveTechnology,
  suggestTechnologies,
  getTechnology,
  isPractice,
} from '../skills/frontend-skill-builder/scripts/lib/technologies.mjs'

const EXPECTED_IDS = [
  'html',
  'css',
  'javascript',
  'typescript',
  'react',
  'nextjs',
  'vue',
  'angular',
  'tailwind-css',
  'bootstrap',
  'vite',
  'shadcn-ui',
  'web-apis',
  'accessibility',
  'responsive-design',
  'frontend-testing',
  'performance-optimization',
]

test('catalog covers every technology in the plugin brief', () => {
  assert.deepEqual(TECHNOLOGIES.map((tech) => tech.id), EXPECTED_IDS)
})

test('every entry declares a valid kind', () => {
  for (const tech of TECHNOLOGIES) {
    assert.ok(TECHNOLOGY_KINDS.includes(tech.kind), `${tech.id} has unknown kind ${tech.kind}`)
  }
})

test('every entry has notes that explain the likely mistake', () => {
  for (const tech of TECHNOLOGIES) {
    assert.ok(tech.notes.length > 20, `${tech.id} needs a substantive note`)
  }
})

test('every entry has intake questions, not statements', () => {
  for (const tech of TECHNOLOGIES) {
    assert.ok(Array.isArray(tech.questions), `${tech.id} must declare a questions array`)
    assert.ok(tech.questions.length > 0, `${tech.id} needs at least one intake question`)
    for (const question of tech.questions) {
      // A question may carry a trailing clarifying sentence, so require the mark
      // somewhere rather than as the final character.
      assert.ok(question.includes('?'), `${tech.id} has a question that is not a question: ${question}`)
      assert.ok(question.trim().length > 10, `${tech.id} has a placeholder-quality question: ${question}`)
    }
  }
})

test('ids are unique and kebab-case', () => {
  const ids = TECHNOLOGIES.map((tech) => tech.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/)
})

test('no two technologies claim the same name after normalization', () => {
  // Within one entry, id and label may normalize alike ("html" / "HTML").
  // Across entries that would make resolution ambiguous, so it is an error.
  const owner = new Map()
  for (const tech of TECHNOLOGIES) {
    for (const form of [tech.id, tech.label, ...tech.aliases]) {
      const key = normalize(form)
      const previous = owner.get(key)
      assert.ok(
        previous === undefined || previous === tech.id,
        `"${form}" (${tech.id}) collides with "${previous}"`,
      )
      owner.set(key, tech.id)
    }
  }
})

test('resolves every catalog id', () => {
  for (const tech of TECHNOLOGIES) {
    const result = resolveTechnology(tech.id)
    assert.equal(result.status, 'ok', `${tech.id} did not resolve`)
    assert.equal(result.technology.id, tech.id)
  }
})

test('resolves labels and common aliases', () => {
  const cases = [
    ['Next.js', 'nextjs'],
    ['nextjs', 'nextjs'],
    ['NEXTJS', 'nextjs'],
    ['React', 'react'],
    ['react.js', 'react'],
    ['Tailwind CSS', 'tailwind-css'],
    ['tailwind', 'tailwind-css'],
    ['TypeScript', 'typescript'],
    ['ts', 'typescript'],
    ['ShadCN UI', 'shadcn-ui'],
    ['shadcn/ui', 'shadcn-ui'],
    ['Web APIs', 'web-apis'],
    ['a11y', 'accessibility'],
    ['Performance Optimization', 'performance-optimization'],
    ['web vitals', 'performance-optimization'],
    ['Mobile First', 'responsive-design'],
    ['unit testing frontend', 'frontend-testing'],
  ]

  for (const [input, expected] of cases) {
    const result = resolveTechnology(input)
    assert.equal(result.status, 'ok', `"${input}" did not resolve`)
    assert.equal(result.technology.id, expected, `"${input}" resolved to the wrong entry`)
  }
})

test('rejects an unsupported technology', () => {
  const result = resolveTechnology('svelte')
  assert.equal(result.status, 'unsupported')
  assert.equal(result.input, 'svelte')
})

test('never substitutes a near match', () => {
  // "react" is close to nothing in particular, and "taillwind" is close to tailwind.
  // Neither may silently resolve.
  assert.equal(resolveTechnology('taillwind').status, 'unsupported')
  assert.equal(resolveTechnology('reactt').status, 'unsupported')
})

test('suggests candidates for a near miss without resolving it', () => {
  const result = resolveTechnology('taillwind')
  assert.equal(result.status, 'unsupported')
  assert.ok(result.suggestions.includes('tailwind-css'))
})

test('treats empty input as missing rather than unsupported', () => {
  assert.equal(resolveTechnology('').status, 'empty')
  assert.equal(resolveTechnology('   ').status, 'empty')
  assert.equal(resolveTechnology(undefined).status, 'empty')
})

test('flags a compound request instead of guessing which one was meant', () => {
  for (const input of ['react and typescript', 'react, typescript', 'react + typescript', 'react/vue']) {
    const result = resolveTechnology(input)
    assert.equal(result.status, 'compound', `"${input}" was not flagged as compound`)
    assert.equal(result.candidates.length, 2)
  }
})

test('does not flag a single name containing a slash as compound', () => {
  assert.equal(resolveTechnology('shadcn/ui').status, 'ok')
})

test('practice entries are marked as practices', () => {
  assert.ok(isPractice(getTechnology('accessibility')))
  assert.ok(isPractice(getTechnology('performance-optimization')))
  assert.ok(isPractice(getTechnology('web-apis')))
  assert.ok(!isPractice(getTechnology('react')))
  assert.ok(!isPractice(getTechnology('tailwind-css')))
})

test('suggestions are empty for an empty query', () => {
  assert.deepEqual(suggestTechnologies(''), [])
  assert.deepEqual(suggestTechnologies('   '), [])
})

test('getTechnology returns null for an unknown id', () => {
  assert.equal(getTechnology('svelte'), null)
})
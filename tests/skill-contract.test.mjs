import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  LIMITS,
  SECTIONS,
  SECTION_IDS,
  REQUIRED_SECTION_IDS,
  CONDITIONAL_SECTION_IDS,
  DIFFICULTY_LEVELS,
  resolveDifficulty,
  normalizeHeading,
  matchSection,
  parseHeadings,
} from '../skills/frontend-skill-builder/scripts/lib/skill-contract.mjs'

test('the contract is exactly the 15 sections from the brief', () => {
  assert.equal(SECTIONS.length, 15)
  assert.deepEqual(SECTION_IDS, [
    'name',
    'description',
    'purpose',
    'when-to-use',
    'prerequisites',
    'core-concepts',
    'step-by-step-workflow',
    'best-practices',
    'recommended-project-structure',
    'code-examples',
    'common-mistakes',
    'security-considerations',
    'performance-considerations',
    'testing-verification-checklist',
    'final-implementation-checklist',
  ])
})

test('exactly 11 sections are required and 4 are conditional', () => {
  assert.equal(REQUIRED_SECTION_IDS.length, 11)
  assert.equal(CONDITIONAL_SECTION_IDS.length, 4)
  assert.deepEqual(CONDITIONAL_SECTION_IDS, [
    'recommended-project-structure',
    'code-examples',
    'security-considerations',
    'performance-considerations',
  ])
})

test('every section has a unique id, an intent, and at least one heading form', () => {
  assert.equal(new Set(SECTION_IDS).size, SECTIONS.length)
  for (const section of SECTIONS) {
    assert.ok(section.intent.length > 10, `${section.id} needs an intent`)
    assert.ok(section.heading.length > 0, `${section.id} needs a heading`)
    assert.equal(typeof section.required, 'boolean')
  }
})

test('only recommended-project-structure is suppressed for practice topics', () => {
  const suppressed = SECTIONS.filter((section) => section.skipForPractices).map((section) => section.id)
  assert.deepEqual(suppressed, ['recommended-project-structure'])
})

test('resolves each difficulty level and its aliases', () => {
  const cases = [
    ['beginner', 'beginner'],
    ['Beginner', 'beginner'],
    ['junior', 'beginner'],
    ['entry-level', 'beginner'],
    ['intermediate', 'intermediate'],
    ['standard', 'intermediate'],
    ['advanced', 'advanced'],
    ['Advanced', 'advanced'],
    ['expert', 'advanced'],
    ['deep dive', 'advanced'],
  ]

  for (const [input, expected] of cases) {
    const result = resolveDifficulty(input)
    assert.equal(result.status, 'ok', `"${input}" did not resolve`)
    assert.equal(result.level.id, expected)
  }
})

test('rejects an unsupported difficulty level', () => {
  const result = resolveDifficulty('expert-level-plus')
  assert.equal(result.status, 'unsupported')
  assert.deepEqual(result.valid, ['beginner', 'intermediate', 'advanced'])
})

test('treats an empty difficulty as missing, not unsupported', () => {
  assert.equal(resolveDifficulty('').status, 'empty')
  assert.equal(resolveDifficulty(undefined).status, 'empty')
})

test('there are exactly three difficulty levels, each with intent', () => {
  assert.equal(DIFFICULTY_LEVELS.length, 3)
  for (const level of DIFFICULTY_LEVELS) assert.ok(level.intent.length > 40)
})

test('normalizes headings regardless of case, punctuation, or emphasis', () => {
  assert.equal(normalizeHeading('Testing/verification checklist'), 'testing verification checklist')
  assert.equal(normalizeHeading('TESTING/VERIFICATION CHECKLIST'), 'testing verification checklist')
  assert.equal(normalizeHeading('**Security Considerations**'), 'security considerations')
  assert.equal(normalizeHeading('`Code Examples`:'), 'code examples')
  assert.equal(normalizeHeading('## When to use'), 'when to use')
  // Connector words are preserved, so "and" variants resolve through aliases.
  assert.equal(normalizeHeading('Testing and Verification Checklist'), 'testing and verification checklist')
})

test('matches every canonical heading to itself', () => {
  for (const section of SECTIONS) {
    assert.equal(matchSection(section.heading), section.id, `failed to match "${section.heading}"`)
  }
})

test('matches documented aliases to their section', () => {
  const cases = [
    ['When to use this', 'when-to-use'],
    ['Use when', 'when-to-use'],
    ['Prereqs', 'prerequisites'],
    ['Workflow', 'step-by-step-workflow'],
    ['Pitfalls', 'common-mistakes'],
    ['Verification checklist', 'testing-verification-checklist'],
    ['Definition of done', 'final-implementation-checklist'],
    ['Project structure', 'recommended-project-structure'],
  ]

  for (const [heading, expected] of cases) {
    assert.equal(matchSection(heading), expected, `failed to match "${heading}"`)
  }
})

test('returns null for a heading that is not part of the contract', () => {
  assert.equal(matchSection('Assumptions'), null)
  assert.equal(matchSection('Install guide'), null)
  assert.equal(matchSection(''), null)
})

test('no two sections claim the same heading form', () => {
  const lookup = new Map()
  for (const section of SECTIONS) {
    for (const form of [section.heading, ...section.aliases]) {
      const key = normalizeHeading(form)
      const previous = lookup.get(key)
      assert.ok(previous === undefined || previous === section.id, `"${form}" collides with "${previous}"`)
      lookup.set(key, section.id)
    }
  }
})

test('parses headings with levels and line numbers', () => {
  const body = ['# Title', '', '## Purpose', '', 'text', '', '### Nested', ''].join('\n')
  const headings = parseHeadings(body, 10)

  assert.deepEqual(headings.map((h) => [h.level, h.text, h.line]), [
    [1, 'Title', 10],
    [2, 'Purpose', 12],
    [3, 'Nested', 16],
  ])
})

test('ignores hash characters inside fenced code blocks', () => {
  const body = [
    '## Purpose',
    '',
    '```css',
    '/* not a heading */',
    '# not a heading either',
    '```',
    '',
    '## Prerequisites',
  ].join('\n')

  const headings = parseHeadings(body, 1)
  assert.deepEqual(headings.map((h) => h.text), ['Purpose', 'Prerequisites'])
})

test('ignores tilde-fenced blocks too', () => {
  const body = ['## Purpose', '', '~~~', '# hidden', '~~~', '', '## Prerequisites'].join('\n')
  assert.deepEqual(parseHeadings(body, 1).map((h) => h.text), ['Purpose', 'Prerequisites'])
})

test('strips closing hashes from ATX headings', () => {
  const headings = parseHeadings('## Purpose ##\n', 1)
  assert.equal(headings[0].text, 'Purpose')
})

test('the documented limits match the Agent Skills specification', () => {
  assert.equal(LIMITS.nameMaxChars, 64)
  assert.equal(LIMITS.descriptionMaxChars, 1024)
  assert.equal(LIMITS.compatibilityMaxChars, 500)
  assert.equal(LIMITS.bodyMaxLines, 500)
})

test('the skill name pattern matches the specification regex', () => {
  for (const valid of ['react', 'react-components', 'a1', 'web-apis-2']) {
    assert.ok(LIMITS.skillDirNamePattern.test(valid), `${valid} should be valid`)
  }
  for (const invalid of ['React', '-react', 'react-', 'react--components', 'react_components', '']) {
    assert.ok(!LIMITS.skillDirNamePattern.test(invalid), `${invalid} should be invalid`)
  }
})
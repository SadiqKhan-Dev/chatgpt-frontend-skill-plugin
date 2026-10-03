/**
 * Unit tests for the MCP tools.
 *
 * These call handlers directly, which is faster than a handshake but cannot see
 * protocol-level problems. `npm run validate:mcp` covers that layer; the two
 * suites are complementary, not redundant.
 *
 * The whole file skips when the MCP SDK is not installed, so `npm test` still
 * works on a fresh clone before `npm run setup`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = resolve(HERE, '..', '..')
const SKIP_REASON = 'the MCP SDK is not installed; run `npm run setup`'

let TOOLS
let guard
let fault
try {
  ;({ TOOLS } = await import('../../mcp/src/server.mjs'))
  ;({ guard, fault } = await import('../../mcp/src/toolkit.mjs'))
} catch {
  TOOLS = null
}

const skip = TOOLS === null ? SKIP_REASON : false
const byName = Object.fromEntries((TOOLS ?? []).map((tool) => [tool.name, tool]))

function example(name) {
  return readFileSync(join(PLUGIN_ROOT, 'examples', name, 'SKILL.md'), 'utf8')
}

/** Call a tool handler and return its structured content. */
async function call(name, args) {
  const result = await byName[name].handler(args)
  assert.notEqual(result.isError, true, `${name} returned a tool error: ${JSON.stringify(result.content)}`)
  return result.structuredContent
}

test('all seven tools are registered under distinct names', { skip }, () => {
  const names = TOOLS.map((tool) => tool.name).sort()
  assert.deepEqual(names, [
    'audit_skill',
    'get_skill_template',
    'list_sections',
    'list_technologies',
    'plan_skill',
    'resolve_technology',
    'validate_skill',
  ])
})

test('every tool declares complete metadata for the model', { skip }, () => {
  for (const tool of TOOLS) {
    assert.ok(tool.title, `${tool.name} has no title`)
    assert.ok(tool.description && tool.description.length > 40, `${tool.name} has a thin description`)
    assert.ok(tool.inputSchema, `${tool.name} has no input schema`)
    assert.ok(tool.outputSchema, `${tool.name} has no output schema`)
    assert.match(tool.description, /Use this|use this/, `${tool.name} does not say when to use it`)
  }
})

test('every tool is annotated read-only, non-destructive, and closed-world', { skip }, () => {
  for (const tool of TOOLS) {
    assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} is not marked read-only`)
    assert.equal(tool.annotations.destructiveHint, false, `${tool.name} is marked destructive`)
    assert.equal(tool.annotations.openWorldHint, false, `${tool.name} is marked open-world`)
  }
})

// --- plan_skill -----------------------------------------------------------

test('plan_skill resolves the technology and plans the full contract', { skip }, async () => {
  const data = await call('plan_skill', {
    technology: 'Next.js',
    topic: 'App Router data fetching',
    difficulty: 'advanced',
  })

  assert.equal(data.ok, true)
  assert.equal(data.technology.id, 'nextjs')
  assert.equal(data.difficulty.id, 'advanced')
  assert.equal(data.sections.required.length, 11)
  assert.ok(data.openQuestions.length > 0, 'expected intake questions')
  assert.ok(data.constraints.length > 0, 'expected constraints')
  assert.ok(data.nextSteps.length > 0, 'expected a next-step sequence')
})

test('plan_skill rejects an unsupported technology instead of approximating it', { skip }, async () => {
  const data = await call('plan_skill', { technology: 'Svelte', topic: 'x', difficulty: 'advanced' })
  assert.equal(data.ok, false)
  assert.match(data.reason, /not in the supported catalog/)
})

test('plan_skill rejects a request naming two technologies', { skip }, async () => {
  const data = await call('plan_skill', {
    technology: 'React and TypeScript',
    topic: 'x',
    difficulty: 'advanced',
  })
  assert.equal(data.ok, false)
  assert.deepEqual(data.suggestions, ['React', 'TypeScript'])
})

test('plan_skill accepts a documented difficulty alias', { skip }, async () => {
  const data = await call('plan_skill', { technology: 'vue', topic: 'x', difficulty: 'expert' })
  assert.equal(data.ok, true)
  assert.equal(data.difficulty.id, 'advanced')
})

test('plan_skill rejects an unknown difficulty and lists the valid ones', { skip }, async () => {
  const data = await call('plan_skill', { technology: 'vue', topic: 'x', difficulty: 'wizard' })
  assert.equal(data.ok, false)
  assert.deepEqual(data.suggestions, ['beginner', 'intermediate', 'advanced'])
})

test('plan_skill omits project structure for a practice topic but not a framework', { skip }, async () => {
  const practice = await call('plan_skill', {
    technology: 'accessibility',
    topic: 'x',
    difficulty: 'intermediate',
  })
  assert.deepEqual(
    practice.sections.omittedByDefault.map((s) => s.id),
    ['recommended-project-structure'],
  )

  const framework = await call('plan_skill', { technology: 'vue', topic: 'x', difficulty: 'intermediate' })
  assert.deepEqual(framework.sections.omittedByDefault, [])
  assert.equal(framework.sections.recommended.length, 4)
})

test('plan_skill warns against adding a library for a practice topic', { skip }, async () => {
  const data = await call('plan_skill', {
    technology: 'responsive-design',
    topic: 'x',
    difficulty: 'intermediate',
  })
  assert.ok(
    data.constraints.some((line) => /must not introduce a library/i.test(line)),
    'expected a no-extra-dependency constraint for a practice topic',
  )
})

// --- resolve_technology ---------------------------------------------------

test('resolve_technology ignores case and punctuation', { skip }, async () => {
  for (const name of ['Next.js', 'nextjs', 'NEXTJS', 'next']) {
    const data = await call('resolve_technology', { name })
    assert.equal(data.ok, true, `${name} should resolve`)
    assert.equal(data.technology.label, 'Next.js')
  }
})

test('resolve_technology reports an unsupported name without inventing a match', { skip }, async () => {
  const data = await call('resolve_technology', { name: 'Svelte' })
  assert.equal(data.ok, false)
  assert.deepEqual(data.suggestions, [])
})

test('resolve_technology treats a blank name as empty', { skip }, async () => {
  const data = await call('resolve_technology', { name: '   ' })
  assert.equal(data.ok, false)
  assert.match(data.reason, /No technology name/)
})

// --- list tools -----------------------------------------------------------

test('list_technologies returns the catalog and filters by kind', { skip }, async () => {
  const all = await call('list_technologies', {})
  assert.equal(all.count, all.technologies.length)
  assert.ok(all.count >= 17)

  const practices = await call('list_technologies', { kind: 'practice' })
  assert.ok(practices.technologies.length > 0)
  assert.ok(practices.technologies.every((tech) => tech.kind === 'practice'))
})

test('every catalog entry carries intake questions', { skip }, async () => {
  const { technologies } = await call('list_technologies', {})
  for (const tech of technologies) {
    assert.ok(tech.questions.length > 0, `${tech.id} has no intake questions`)
    assert.ok(tech.notes.length > 20, `${tech.id} has a thin note`)
  }
})

test('list_sections reports 15 sections split 11 required and 4 conditional', { skip }, async () => {
  const all = await call('list_sections', {})
  assert.equal(all.count, 15)
  assert.equal(all.requiredCount, 11)
  assert.equal(all.conditionalCount, 4)

  const required = await call('list_sections', { requiredOnly: true })
  assert.equal(required.count, 11)
  assert.ok(required.sections.every((section) => section.required))
})

// --- get_skill_template ---------------------------------------------------

test('get_skill_template fills the identifier but leaves prose to the model', { skip }, async () => {
  const data = await call('get_skill_template', {
    name: 'react-form-validation',
    technology: 'react',
    topic: 'Controlled form validation',
  })

  assert.match(data.template, /^---\nname: react-form-validation\n/)
  assert.ok(data.template.includes('Controlled form validation') === false, 'topic must not leak into the template body')
  assert.ok(
    data.template.includes('<One sentence: what the skill does>'),
    'the description must stay a placeholder rather than be generated',
  )
  assert.equal(data.suggestedName, 'react-form-validation')
  assert.ok(data.placeholders.length > 0)
})

test('get_skill_template decides conditional sections by technology kind', { skip }, async () => {
  const practice = await call('get_skill_template', { technology: 'accessibility' })
  assert.equal(
    practice.conditionalSections.find((s) => s.id === 'recommended-project-structure').decision,
    'omit',
  )

  const undecided = await call('get_skill_template', {})
  assert.ok(
    undecided.conditionalSections.every((s) => s.decision === 'undecided'),
    'without a technology every conditional section must be undecided',
  )
})

// --- validate_skill -------------------------------------------------------

test('validate_skill accepts a known-good example', { skip }, async () => {
  const data = await call('validate_skill', {
    source: example('react-component-authoring'),
    skillName: 'react-component-authoring',
  })
  assert.equal(data.passed, true)
  assert.equal(data.errorCount, 0)
})

test('validate_skill checks that the name matches the directory', { skip }, async () => {
  const data = await call('validate_skill', {
    source: example('react-component-authoring'),
    skillName: 'some-other-directory',
  })
  assert.equal(data.passed, false)
  assert.ok(data.findings.some((f) => /must match the containing directory/.test(f.message)))
})

test('validate_skill honours strict mode', { skip }, async () => {
  const source = example('react-component-authoring').replace(
    /## Performance considerations[\s\S]*?(?=\n## )/,
    '',
  )
  const lenient = await call('validate_skill', { source })
  const strict = await call('validate_skill', { source, strict: true })
  assert.equal(lenient.passed, true)
  assert.equal(strict.passed, false)
})

test('validate_skill reports invalid input as findings, not an exception', { skip }, async () => {
  const data = await call('validate_skill', { source: 'not a skill' })
  assert.equal(data.passed, false)
  assert.ok(data.errorCount > 0)
  assert.ok(data.findings.every((f) => typeof f.message === 'string'))
})

test('the MCP verdict matches the CLI verdict for every example', { skip }, async () => {
  const { validateSkillFile } = await import(
    '../../skills/frontend-skill-builder/scripts/validate-skill.mjs'
  )
  const names = [
    'react-component-authoring',
    'nextjs-app-router-data-fetching',
    'typescript-strict-data-modeling',
    'tailwind-responsive-layout',
  ]

  for (const name of names) {
    const viaMcp = await call('validate_skill', {
      source: example(name),
      skillName: name,
    })
    const viaCli = validateSkillFile(join(PLUGIN_ROOT, 'examples', name, 'SKILL.md'))

    assert.equal(viaMcp.errorCount, viaCli.errorCount, `${name}: error count differs`)
    assert.equal(viaMcp.warningCount, viaCli.warningCount, `${name}: warning count differs`)
    assert.equal(viaMcp.passed, viaCli.errorCount === 0, `${name}: verdict differs`)
  }
})

// --- audit_skill ----------------------------------------------------------

test('audit_skill preserves every section of a known-good example', { skip }, async () => {
  const data = await call('audit_skill', { source: example('react-component-authoring') })
  assert.equal(data.parsed, true)
  assert.equal(data.rewrite.length, 0)
  assert.equal(data.preserve.length, 15)
  assert.deepEqual(data.templateLeftovers, [])
})

test('audit_skill does not flag the name section as too thin', { skip }, async () => {
  // Regression: the specification caps `name` at 64 characters, below the
  // thin-content threshold, so without an exemption every valid skill reports
  // its own name section as needing a rewrite.
  for (const name of [
    'react-component-authoring',
    'nextjs-app-router-data-fetching',
    'typescript-strict-data-modeling',
    'tailwind-responsive-layout',
  ]) {
    const data = await call('audit_skill', { source: example(name) })
    assert.ok(
      !data.rewrite.some((entry) => entry.id === 'name'),
      `${name}: the name section must never be reported as thin`,
    )
  }
})

test('audit_skill does not mistake generics or JSX for template placeholders', { skip }, async () => {
  // Regression: a naive `<...>` scan flags Array<T> and <Wrapper /> in valid
  // TypeScript and JSX, which would make the finding meaningless.
  const source = example('typescript-strict-data-modeling')
  const data = await call('audit_skill', { source })
  assert.deepEqual(data.templateLeftovers, [])
})

test('audit_skill reports template placeholders left in a draft', { skip }, async () => {
  // Take the real token from the bundled template, longest first, so this test
  // cannot drift from the asset and covers the long-placeholder path.
  const { templatePlaceholders } = await import('../../mcp/src/core.mjs')
  const longest = templatePlaceholders().reduce((a, b) => (b.length > a.length ? b : a))

  const source = example('react-component-authoring').replace('## Purpose', `## Purpose\n\n${longest}`)
  const data = await call('audit_skill', { source })

  assert.ok(data.templateLeftovers.includes(longest), 'expected the leftover placeholder to be detected')
  assert.ok(
    data.rewrite.some((entry) => entry.id === 'purpose'),
    'the section holding the placeholder must be marked for rewrite',
  )
  assert.ok(
    !data.preserve.some((entry) => entry.id === 'purpose'),
    'a section with a leftover placeholder must not appear in the preserve list',
  )
})

test('audit_skill flags a stub section as thin', { skip }, async () => {
  const source = example('react-component-authoring').replace(
    /## Common mistakes[\s\S]*?(?=\n## )/,
    '## Common mistakes\n\ntodo\n',
  )
  const data = await call('audit_skill', { source })

  const entry = data.rewrite.find((item) => item.id === 'common-mistakes')
  assert.ok(entry, 'expected common-mistakes to be marked for rewrite')
  assert.match(entry.reason, /Too thin/)
})

test('audit_skill degrades with an actionable error on unparseable frontmatter', { skip }, async () => {
  const data = await call('audit_skill', { source: 'no frontmatter here' })
  assert.equal(data.parsed, false)
  assert.deepEqual(data.preserve, [])
  assert.deepEqual(data.rewrite, [])
  assert.ok(data.findings.some((f) => /could not be parsed/.test(f.message)))
})

test('audit_skill reports structural facts without inventing judgements', { skip }, async () => {
  const data = await call('audit_skill', { source: example('tailwind-responsive-layout') })
  assert.ok(data.structure.bodyLines > 0)
  assert.equal(data.structure.bodyLineLimit, 500)
  assert.ok(data.structure.codeBlocks > 0)
  assert.equal(data.structure.untaggedCodeBlocks, 0, 'the examples tag their code fences')
  // Tailwind's example pins a major version, which is exactly the kind of claim
  // the audit should surface for a human to verify.
  assert.ok(data.versionReferences.includes('v3.2'))
  assert.equal(data.description.hasTriggerPhrase, true)
})

// --- error handling -------------------------------------------------------

test('guard converts an unexpected exception into an actionable tool error', { skip }, async () => {
  const wrapped = guard(() => {
    throw new Error('template asset is missing')
  })
  const result = await wrapped({})

  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /template asset is missing/)
  assert.match(result.content[0].text, /bug in the plugin/)
})

test('fault composes a hint without losing the message', { skip }, () => {
  const result = fault('something broke', 'try this instead')
  assert.equal(result.isError, true)
  assert.match(result.content[0].text, /something broke/)
  assert.match(result.content[0].text, /try this instead/)
})
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { validateSkillSource } from '../skills/frontend-skill-builder/scripts/validate-skill.mjs'
import { REQUIRED_SECTION_IDS, SECTIONS } from '../skills/frontend-skill-builder/scripts/lib/skill-contract.mjs'

/** Build a complete, valid SKILL.md that individual tests then break in one way. */
function buildSkill({ frontmatter = {}, omit = [], extraSections = [], includeConditionals = true } = {}) {
  const fm = {
    name: 'example-skill',
    description: 'Does one specific thing well. Use when the user asks for that specific thing by name.',
    ...frontmatter,
  }

  const frontmatterText = Object.entries(fm)
    .map(([key, value]) => (key === 'metadata' ? 'metadata:\n  version: "1.0.0"' : `${key}: ${value}`))
    .join('\n')

  const headings = SECTIONS.filter((section) => includeConditionals || section.required)
    .filter((section) => !omit.includes(section.id))
    .map((section) => `## ${section.heading}\n\nContent for ${section.id}.\n`)

  const body = [
    '# Example Skill',
    '',
    ...headings,
    ...extraSections.map((text) => `## ${text}\n\nExtra content.\n`),
  ].join('\n')

  return `---\n${frontmatterText}\n---\n\n${body}`
}

function findingsFor(source, options = {}) {
  return validateSkillSource(source, options).findings
}

function errorsFor(source, options = {}) {
  return findingsFor(source, options)
    .filter((finding) => finding.level === 'error')
    .map((finding) => finding.message)
}

function warningsFor(source, options = {}) {
  return findingsFor(source, options)
    .filter((finding) => finding.level === 'warning')
    .map((finding) => finding.message)
}

test('accepts a complete skill with no findings', () => {
  const report = validateSkillSource(buildSkill())
  assert.deepEqual(report.findings, [])
})

test('omitting a conditional section is a warning, not an error', () => {
  const source = buildSkill({ omit: ['security-considerations'] })
  const errors = errorsFor(source)

  assert.deepEqual(errors, [])
  assert.equal(warningsFor(source).length, 1)
  assert.match(warningsFor(source)[0], /conditional section "Security considerations"/)
})

test('omitting every conditional section yields only warnings', () => {
  const source = buildSkill({
    omit: [
      'recommended-project-structure',
      'code-examples',
      'security-considerations',
      'performance-considerations',
    ],
  })

  assert.deepEqual(errorsFor(source), [])
  assert.equal(warningsFor(source).length, 4)
})

test('omitting a required section is an error', () => {
  const source = buildSkill({ omit: ['core-concepts'] })
  const errors = errorsFor(source)

  assert.equal(errors.length, 1)
  assert.match(errors[0], /missing required section "Core concepts"/)
})

test('reports every missing required section at once', () => {
  const source = buildSkill({ omit: [...REQUIRED_SECTION_IDS] })
  assert.equal(errorsFor(source).filter((m) => m.includes('missing required section')).length, 11)
})

test('rejects a name that does not match the containing directory', () => {
  const errors = errorsFor(buildSkill(), { filePath: '/tmp/some-other-name/SKILL.md' })
  assert.ok(errors.some((message) => message.includes('must match the containing directory name')))
})

test('accepts a name that matches the containing directory', () => {
  const errors = errorsFor(buildSkill(), { filePath: '/tmp/example-skill/SKILL.md' })
  assert.deepEqual(errors, [])
})

test('rejects an invalid directory name', () => {
  const errors = errorsFor(buildSkill(), { filePath: '/tmp/Example_Skill/SKILL.md' })
  assert.ok(errors.some((message) => message.includes('is not a valid skill name')))
})

test('rejects an uppercase or malformed frontmatter name', () => {
  const source = buildSkill({ frontmatter: { name: 'Example Skill' } })
  assert.ok(errorsFor(source).some((message) => message.includes('lowercase alphanumeric')))
})

test('rejects a missing name or description', () => {
  const source = ['---', 'license: Proprietary', '---', '', '# Title', ''].join('\n')
  const errors = errorsFor(source)

  assert.ok(errors.some((message) => message.includes('`name` is required')))
  assert.ok(errors.some((message) => message.includes('`description` is required')))
})

test('rejects a description over the specification limit', () => {
  const source = buildSkill({ frontmatter: { description: 'x'.repeat(1025) } })
  assert.ok(errorsFor(source).some((message) => message.includes('max 1024')))
})

test('warns about a description that is too short to route on', () => {
  const source = buildSkill({ frontmatter: { description: 'Short.' } })
  assert.ok(warningsFor(source).some((message) => message.includes('`description` is very short')))
})

test('rejects compatibility over the specification limit', () => {
  const source = buildSkill({ frontmatter: { compatibility: 'x'.repeat(501) } })
  assert.ok(errorsFor(source).some((message) => message.includes('max 500')))
})

test('rejects a duplicate section heading', () => {
  const source = `${buildSkill()}\n## Purpose\n\nA second purpose.\n`
  assert.ok(errorsFor(source).some((message) => message.includes('duplicate section "Purpose"')))
})

test('warns about an unrecognised heading without failing', () => {
  const source = buildSkill({ extraSections: ['Assumptions'] })
  const errors = errorsFor(source)

  assert.deepEqual(errors, [])
  assert.ok(warningsFor(source).some((message) => message.includes('unrecognised level-2 heading "Assumptions"')))
})

test('does not require a level-1 heading', () => {
  const source = buildSkill().replace('# Example Skill\n', '')
  assert.deepEqual(errorsFor(source), [])
  assert.ok(warningsFor(source).some((message) => message.includes('no level-1 heading')))
})

test('rejects a body with no headings', () => {
  const source = ['---', 'name: a-skill', 'description: Has a description long enough to pass.', '---', '', 'Just prose.'].join('\n')
  assert.ok(errorsFor(source).some((message) => message.includes('no Markdown headings found')))
})

test('rejects an empty body', () => {
  const source = ['---', 'name: a-skill', 'description: Has a description long enough to pass.', '---'].join('\n')
  assert.ok(errorsFor(source).some((message) => message.includes('no content after the frontmatter')))
})

test('warns when the body exceeds 500 lines', () => {
  const filler = Array.from({ length: 520 }, (_, i) => `Line ${i}.`).join('\n')
  const source = `${buildSkill()}\n${filler}\n`
  assert.ok(warningsFor(source).some((message) => message.includes('exceeds the 500-line recommendation')))
})

test('surfaces a frontmatter parse error rather than guessing', () => {
  const source = ['---', 'name: a-skill', 'description: Has a description long enough.', 'tools: [Read]', '---', '', '# T'].join('\n')
  assert.ok(errorsFor(source).some((message) => message.includes('frontmatter')))
})

test('suppresses the project-structure warning for a practice topic', () => {
  const source = buildSkill({
    omit: ['recommended-project-structure'],
    extraSections: ['Assumptions', 'Accessibility audit'],
  })

  assert.ok(
    !warningsFor(source).some((message) => message.includes('Recommended project structure')),
    'project structure should be suppressed for a practice topic',
  )
})

test('keeps the project-structure warning for a non-practice topic', () => {
  const source = buildSkill({ omit: ['recommended-project-structure'] })
  assert.ok(warningsFor(source).some((message) => message.includes('Recommended project structure')))
})

test('accepts heading aliases in place of canonical headings', () => {
  const canonical = buildSkill()
  const aliased = canonical
    .replace('## Testing/verification checklist', '## Verification checklist')
    .replace('## Final implementation checklist', '## Definition of done')
    .replace('## Step-by-step workflow', '## Workflow')

  assert.deepEqual(errorsFor(aliased), [])
})

test('validates a real file from disk, including the directory-name rule', async () => {
  const { validateSkillFile } = await import('../skills/frontend-skill-builder/scripts/validate-skill.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'fsb-'))
  try {
    const skillDir = join(dir, 'example-skill')
    mkdirSync(skillDir)
    writeFileSync(join(skillDir, 'SKILL.md'), buildSkill(), 'utf8')

    const report = validateSkillFile(join(skillDir, 'SKILL.md'))
    assert.equal(report.subject, 'example-skill/SKILL.md')
    assert.deepEqual(report.findings, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('reports a missing file instead of throwing', async () => {
  const { validateSkillFile } = await import('../skills/frontend-skill-builder/scripts/validate-skill.mjs')
  const report = validateSkillFile(join(tmpdir(), 'definitely-not-here', 'SKILL.md'))
  assert.ok(report.errorCount > 0)
})

test('resolveSkillPath accepts the skill directory as well as the file', async () => {
  const { resolveSkillPath } = await import('../skills/frontend-skill-builder/scripts/validate-skill.mjs')
  const dir = mkdtempSync(join(tmpdir(), 'fsb-'))
  try {
    const skillDir = join(dir, 'example-skill')
    mkdirSync(skillDir)
    const file = join(skillDir, 'SKILL.md')
    writeFileSync(file, buildSkill(), 'utf8')

    assert.equal(resolveSkillPath(skillDir), resolve(file))
    assert.equal(resolveSkillPath(file), resolve(file))
    assert.equal(resolveSkillPath(join(dir, 'nope')), null)
    assert.equal(resolveSkillPath(dir), null, 'a directory without SKILL.md is not validatable')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
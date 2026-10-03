import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateSkillFile } from '../skills/frontend-skill-builder/scripts/validate-skill.mjs'
import { validatePlugin } from '../skills/frontend-skill-builder/scripts/validate-plugin.mjs'
import { TECHNOLOGIES, getTechnology } from '../skills/frontend-skill-builder/scripts/lib/technologies.mjs'
import { parseFrontmatter } from '../skills/frontend-skill-builder/scripts/lib/frontmatter.mjs'
import {
  REQUIRED_SECTION_IDS,
  CONDITIONAL_SECTION_IDS,
  getSection,
} from '../skills/frontend-skill-builder/scripts/lib/skill-contract.mjs'

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EXAMPLES_DIR = join(PLUGIN_ROOT, 'examples')

const exampleDirs = readdirSync(EXAMPLES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

test('the four documented example technologies are present', () => {
  assert.deepEqual(exampleDirs, [
    'nextjs-app-router-data-fetching',
    'react-component-authoring',
    'tailwind-responsive-layout',
    'typescript-strict-data-modeling',
  ])
})

for (const name of exampleDirs) {
  test(`example ${name} passes the output contract`, () => {
    const report = validateSkillFile(join(EXAMPLES_DIR, name, 'SKILL.md'))
    const problems = report.sorted().map((finding) => `${finding.level}: ${finding.message}`)
    assert.deepEqual(problems, [])
  })
}

test('every example declares a supported technology in its metadata', () => {
  for (const name of exampleDirs) {
    const { data } = parseFrontmatter(readFileSync(join(EXAMPLES_DIR, name, 'SKILL.md'), 'utf8'))
    assert.ok(data.metadata?.technology, `${name} has no metadata.technology`)
    assert.ok(getTechnology(data.metadata.technology), `${name} names an unknown technology`)
  }
})

test('every example declares a supported difficulty in its metadata', () => {
  const valid = ['beginner', 'intermediate', 'advanced']
  for (const name of exampleDirs) {
    const { data } = parseFrontmatter(readFileSync(join(EXAMPLES_DIR, name, 'SKILL.md'), 'utf8'))
    assert.ok(valid.includes(data.metadata?.difficulty), `${name} has an invalid difficulty`)
  }
})

test('every example metadata technology is a real catalog entry', () => {
  const ids = new Set(TECHNOLOGIES.map((tech) => tech.id))
  for (const name of exampleDirs) {
    const { data } = parseFrontmatter(readFileSync(join(EXAMPLES_DIR, name, 'SKILL.md'), 'utf8'))
    assert.ok(ids.has(data.metadata.technology))
  }
})

test('the plugin package passes its own validator', () => {
  const reports = validatePlugin(PLUGIN_ROOT)
  const problems = reports.flatMap((report) =>
    report.sorted().map((finding) => `${report.subject} -> ${finding.level}: ${finding.message}`),
  )

  const sdkInstalled = existsSync(
    join(PLUGIN_ROOT, 'mcp', 'node_modules', '@modelcontextprotocol', 'sdk'),
  )

  // The MCP SDK is an optional install, so its absence is reported as a warning
  // rather than an error. It must not be treated as a package defect, but it
  // must also not hide any other finding: with the SDK present the package is
  // expected to be completely clean.
  const tolerated = sdkInstalled
    ? []
    : problems.filter((problem) => problem.includes('mcp/node_modules is not installed'))

  assert.deepEqual(
    problems.filter((problem) => !tolerated.includes(problem)),
    [],
  )
})

test('every file referenced from the primary SKILL.md exists', () => {
  const skillFile = join(PLUGIN_ROOT, 'skills', 'frontend-skill-builder', 'SKILL.md')
  const source = readFileSync(skillFile, 'utf8')
  const root = dirname(skillFile)

  const referenced = [...source.matchAll(/\]\((references\/[^)\s]+|assets\/[^)\s]+|scripts\/[^)\s]+)\)/g)].map(
    (match) => match[1],
  )

  assert.ok(referenced.length >= 8, 'expected the primary skill to link its supporting files')
  for (const rel of referenced) {
    assert.ok(existsSync(join(root, rel)), `missing referenced file: ${rel}`)
  }
})

test('the primary skill documents every supported technology somewhere', () => {
  const primary = readFileSync(join(PLUGIN_ROOT, 'skills', 'frontend-skill-builder', 'SKILL.md'), 'utf8')
  const catalog = readFileSync(join(PLUGIN_ROOT, 'skills', 'frontend-skill-builder', 'references', 'technologies.md'), 'utf8')

  for (const tech of TECHNOLOGIES) {
    assert.ok(catalog.includes(tech.id), `references/technologies.md is missing ${tech.id}`)
  }
  assert.ok(primary.includes('references/technologies.md'))
})

test('the template ships the required sections live and the conditional ones commented out', () => {
  const template = readFileSync(
    join(PLUGIN_ROOT, 'skills', 'frontend-skill-builder', 'assets', 'SKILL.template.md'),
    'utf8',
  )

  assert.ok(template.includes('name: <kebab-case-name>'), 'template should show the name placeholder')
  assert.ok(template.includes('description: <'), 'template should show the description placeholder')

  // Strip comments: what remains is what an agent would ship if it copied the
  // template without editing it.
  const shipped = template.replace(/<!--[\s\S]*?-->/g, '')

  for (const id of REQUIRED_SECTION_IDS) {
    const { heading } = getSection(id)
    assert.ok(shipped.includes(`## ${heading}`), `template must ship "${heading}"`)
  }

  for (const id of CONDITIONAL_SECTION_IDS) {
    const { heading } = getSection(id)
    assert.ok(
      !shipped.includes(`## ${heading}`),
      `"${heading}" must stay commented out so an unedited template does not ship an empty section`,
    )
  }
})
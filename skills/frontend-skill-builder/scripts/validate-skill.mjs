#!/usr/bin/env node
/**
 * Validate a generated (or user-authored) SKILL.md against the output contract.
 *
 * Usage:
 *   node validate-skill.mjs <path/to/SKILL.md> [more paths...]
 *   node validate-skill.mjs --all-examples
 *   node validate-skill.mjs --technology "Next.js" [--difficulty advanced] [--topic "..."]
 *   node validate-skill.mjs --list-sections
 *
 * Options:
 *   --strict        treat warnings as errors
 *   --json          emit machine-readable findings
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseFrontmatter, FrontmatterError } from './lib/frontmatter.mjs'
import {
  LIMITS,
  SECTIONS,
  REQUIRED_SECTION_IDS,
  CONDITIONAL_SECTION_IDS,
  parseHeadings,
  matchSection,
  resolveDifficulty,
} from './lib/skill-contract.mjs'
import { resolveTechnology, isPractice, TECHNOLOGIES } from './lib/technologies.mjs'
import { createReport, printReports, fail } from './lib/report.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = resolve(HERE, '..', '..', '..')
const EXAMPLES_DIR = join(PLUGIN_ROOT, 'examples')

const ALLOWED_FRONTMATTER_KEYS = [
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]

/**
 * Validate one SKILL.md file on disk.
 *
 * @param {string} filePath path to a SKILL.md
 * @returns {ReturnType<typeof createReport>}
 */
export function validateSkillFile(filePath) {
  const label = basename(dirname(filePath)) + '/SKILL.md'
  const report = createReport(label)

  let source
  try {
    source = readFileSync(filePath, 'utf8')
  } catch (error) {
    report.error(`cannot read file: ${error.message}`)
    return report
  }

  return validateSkillSource(source, { filePath, report })
}

/**
 * Validate SKILL.md content. Split out from the file wrapper so tests can feed
 * strings directly.
 */
export function validateSkillSource(source, { filePath = null, report = createReport('SKILL.md') } = {}) {
  let parsed
  try {
    parsed = parseFrontmatter(source)
  } catch (error) {
    if (error instanceof FrontmatterError) {
      report.error(`frontmatter: ${error.message}`)
      return report
    }
    throw error
  }

  const { data, body, bodyStartLine } = parsed

  validateFrontmatterFields(data, report)

  const expectedName = filePath ? basename(dirname(resolve(filePath))) : null
  if (expectedName !== null) {
    if (typeof data.name === 'string' && data.name !== expectedName) {
      report.error(
        `frontmatter name "${data.name}" must match the containing directory name "${expectedName}"`,
        'The Agent Skills specification requires name to match the parent directory name.',
      )
    }
    if (expectedName !== '.' && !LIMITS.skillDirNamePattern.test(expectedName)) {
      report.error(
        `directory name "${expectedName}" is not a valid skill name`,
        'Use lowercase letters, digits, and single hyphens.',
      )
    }
  }

  validateBody(body, bodyStartLine, report, { technologyHint: detectTechnologyHint(body) })

  return report
}

function validateFrontmatterFields(data, report) {
  for (const key of Object.keys(data)) {
    if (!ALLOWED_FRONTMATTER_KEYS.includes(key)) {
      report.error(`frontmatter: unsupported key "${key}"`, `Allowed keys: ${ALLOWED_FRONTMATTER_KEYS.join(', ')}`)
    }
  }

  if (typeof data.name !== 'string' || data.name.trim() === '') {
    report.error('frontmatter: `name` is required')
  } else if (data.name.length > LIMITS.nameMaxChars) {
    report.error(`frontmatter: \`name\` is ${data.name.length} characters, max ${LIMITS.nameMaxChars}`)
  } else if (!LIMITS.skillDirNamePattern.test(data.name)) {
    report.error(
      `frontmatter: \`name\` "${data.name}" must be lowercase alphanumeric with single hyphens`,
      'Example: react-component-authoring',
    )
  }

  if (typeof data.description !== 'string' || data.description.trim() === '') {
    report.error('frontmatter: `description` is required')
  } else if (data.description.length > LIMITS.descriptionMaxChars) {
    report.error(
      `frontmatter: \`description\` is ${data.description.length} characters, max ${LIMITS.descriptionMaxChars}`,
    )
  } else if (data.description.length < 40) {
    report.warn(
      'frontmatter: `description` is very short',
      'Describe both what the skill does and when to use it so agents can select it correctly.',
    )
  }

  if (data.compatibility !== undefined) {
    if (typeof data.compatibility !== 'string' || data.compatibility.trim() === '') {
      report.error('frontmatter: `compatibility` must be a non-empty string when present')
    } else if (data.compatibility.length > LIMITS.compatibilityMaxChars) {
      report.error(
        `frontmatter: \`compatibility\` is ${data.compatibility.length} characters, max ${LIMITS.compatibilityMaxChars}`,
      )
    }
  }

  if (data.metadata !== undefined) {
    const entries = Object.entries(data.metadata)
    if (entries.length === 0) {
      report.error('frontmatter: `metadata` must declare at least one entry')
    }
    for (const [key, value] of entries) {
      if (typeof value !== 'string') {
        report.error(`frontmatter: metadata.${key} must be a string`)
      }
      if (/\s/.test(key)) {
        report.error(`frontmatter: metadata key "${key}" must not contain whitespace`)
      }
    }
  }

  if (data['allowed-tools'] !== undefined && typeof data['allowed-tools'] !== 'string') {
    report.error('frontmatter: `allowed-tools` must be a single space-separated string')
  }
}

function validateBody(body, bodyStartLine, report, { technologyHint }) {
  const lineCount = body.split(/\r?\n/).length
  if (body.trim() === '') {
    report.error('body: SKILL.md has no content after the frontmatter')
    return
  }
  if (lineCount > LIMITS.bodyMaxLines) {
    report.warn(
      `body: ${lineCount} lines exceeds the ${LIMITS.bodyMaxLines}-line recommendation`,
      'Move detail into references/ files so the skill stays cheap to load.',
    )
  }

  const headings = parseHeadings(body, bodyStartLine)
  if (headings.length === 0) {
    report.error('body: no Markdown headings found', 'Sections are declared with level-2 headings.')
    return
  }
  if (!headings.some((heading) => heading.level === 1)) {
    report.warn('body: no level-1 heading', 'Add a single "# Title" heading for readability.')
  }

  const matched = new Map()
  for (const heading of headings) {
    if (heading.level !== 2) continue
    const sectionId = matchSection(heading.text)
    if (sectionId === null) continue
    if (matched.has(sectionId)) {
      report.error(
        `body: duplicate section "${heading.text}" (line ${heading.line})`,
        `"${heading.text}" was already defined on line ${matched.get(sectionId).line}.`,
      )
      continue
    }
    matched.set(sectionId, heading)
  }

  for (const id of REQUIRED_SECTION_IDS) {
    if (matched.has(id)) continue
    const section = SECTIONS.find((entry) => entry.id === id)
    report.error(`body: missing required section "${section.heading}"`, section.intent)
  }

  const practiceHint = technologyHint !== null && isPractice(technologyHint)
  for (const id of CONDITIONAL_SECTION_IDS) {
    if (matched.has(id)) continue
    const section = SECTIONS.find((entry) => entry.id === id)
    if (section.skipForPractices && practiceHint) continue
    report.warn(
      `body: conditional section "${section.heading}" not present`,
      `${section.intent} Omit it deliberately if it does not apply.`,
    )
  }

  for (const heading of headings) {
    if (heading.level !== 2) continue
    if (matchSection(heading.text) === null) {
      report.warn(
        `body: unrecognised level-2 heading "${heading.text}" (line ${heading.line})`,
        'Extra headings are allowed, but confirm this is not a misspelled required section.',
      )
    }
  }
}

/**
 * Best-effort technology detection from an `## Assumptions` or `## Purpose`
 * section, used only to decide whether project-structure advice is noise.
 */
function detectTechnologyHint(body) {
  const text = body.toLowerCase()
  for (const needle of [
    'accessibility',
    'responsive design',
    'performance optimization',
    'frontend testing',
    'web apis',
  ]) {
    if (text.includes(needle)) {
      const match = resolveTechnology(needle)
      if (match.status === 'ok') return match.technology
    }
  }
  return null
}

function collectExampleFiles() {
  if (!existsSync(EXAMPLES_DIR)) return []
  return readdirSync(EXAMPLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(EXAMPLES_DIR, entry.name, 'SKILL.md'))
    .filter((filePath) => existsSync(filePath) && statSync(filePath).isFile())
    .sort()
}

function validateTechnologyInput(value, report) {
  const result = resolveTechnology(value)
  switch (result.status) {
    case 'ok':
      report.info(
        `technology: "${value}" resolved to ${result.technology.label} (id: ${result.technology.id}, kind: ${result.technology.kind})`,
      )
      report.info(`technology notes: ${result.technology.notes}`)
      return result
    case 'empty':
      report.error('technology: required field is missing', 'Ask the user which frontend technology to target.')
      return result
    case 'compound':
      report.error(`technology: ${result.reason}`, `Detected: ${result.candidates.join(' | ')}`)
      return result
    default: {
      const hint =
        result.suggestions.length > 0
          ? `Did you mean: ${result.suggestions.join(', ')}?`
          : 'Run with --list-technologies to see every supported technology.'
      report.error(`technology: "${result.input}" is not a supported technology`, hint)
      return result
    }
  }
}

function validateDifficultyInput(value, report) {
  const result = resolveDifficulty(value)
  switch (result.status) {
    case 'ok':
      report.info(`difficulty: "${value}" resolved to ${result.level.label}`)
      report.info(`difficulty intent: ${result.level.intent}`)
      return result
    case 'empty':
      report.error('difficulty: required field is missing', 'Ask the user for Beginner, Intermediate, or Advanced.')
      return result
    default:
      report.error(
        `difficulty: "${result.input}" is not a valid level`,
        `Valid levels: ${result.valid.join(', ')}`,
      )
      return result
  }
}

function parseArgs(argv) {
  const options = { paths: [], strict: false, json: false, allExamples: false }
  const flags = { technology: null, difficulty: null, topic: null }
  let listSections = false
  let listTechnologies = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      const value = argv[i + 1]
      if (value === undefined) fail(`${arg} requires a value`)
      i += 1
      return value
    }
    switch (arg) {
      case '--strict':
        options.strict = true
        break
      case '--json':
        options.json = true
        break
      case '--all-examples':
        options.allExamples = true
        break
      case '--list-sections':
        listSections = true
        break
      case '--list-technologies':
        listTechnologies = true
        break
      case '--technology':
        flags.technology = next()
        break
      case '--difficulty':
        flags.difficulty = next()
        break
      case '--topic':
        flags.topic = next()
        break
      case '-h':
      case '--help':
        options.help = true
        break
      default:
        if (arg.startsWith('-')) fail(`unknown option "${arg}"`)
        options.paths.push(arg)
    }
  }

  return { options, flags, listSections, listTechnologies }
}

const HELP = `Validate SKILL.md files and workflow inputs.

Usage:
  node validate-skill.mjs <path/to/SKILL.md> [...]
  node validate-skill.mjs --all-examples
  node validate-skill.mjs --technology "<name>" [--difficulty <level>] [--topic "<text>"]
  node validate-skill.mjs --list-sections | --list-technologies

Options:
  --strict               treat warnings as errors
  --json                 emit machine-readable findings
  --all-examples         validate every examples/*/SKILL.md
`

/**
 * Resolve a CLI path to a SKILL.md file.
 *
 * Accepting the skill directory itself is the common case: people point at the
 * folder they just wrote, not at the file inside it.
 *
 * @returns {string | null} the file path, or null when nothing validatable is there
 */
export function resolveSkillPath(inputPath) {
  const target = resolve(inputPath)
  if (!existsSync(target)) return null
  if (statSync(target).isDirectory()) {
    const nested = join(target, 'SKILL.md')
    return existsSync(nested) && statSync(nested).isFile() ? nested : null
  }
  return target
}

function main(argv) {
  const { options, flags, listSections, listTechnologies } = parseArgs(argv)

  if (options.help) {
    console.log(HELP)
    return 0
  }

  if (listSections) {
    for (const section of SECTIONS) {
      const kind = section.required ? 'required  ' : 'conditional'
      console.log(`${kind}  ${section.heading} (aliases: ${section.aliases.join(', ') || 'none'})`)
      console.log(`           ${section.intent}`)
    }
    return 0
  }

  if (listTechnologies) {
    for (const tech of TECHNOLOGIES) {
      console.log(`${tech.id.padEnd(26)} ${tech.kind.padEnd(18)} ${tech.label}`)
      console.log(`${' '.repeat(26)} aliases: ${tech.aliases.join(', ') || 'none'}`)
    }
    return 0
  }

  const inputMode = flags.technology !== null || flags.difficulty !== null || flags.topic !== null
  const reports = []

  if (inputMode) {
    const report = createReport('workflow inputs')
    if (flags.technology === null) {
      report.error('technology: required field is missing', 'Ask the user which frontend technology to target.')
    } else {
      validateTechnologyInput(flags.technology, report)
    }
    if (flags.difficulty === null) {
      report.error(
        'difficulty: required field is missing',
        'Ask the user for Beginner, Intermediate, or Advanced.',
      )
    } else {
      validateDifficultyInput(flags.difficulty, report)
    }
    if (flags.topic !== null && flags.topic.trim() === '') {
      report.error('topic: must not be empty', 'Ask the user which skill or topic they want.')
    }
    reports.push(report)
  }

  const paths = options.allExamples
    ? collectExampleFiles()
    : options.paths.map((inputPath) => resolveSkillPath(inputPath))

  if (!inputMode && options.paths.length > 0) {
    options.paths.forEach((inputPath, index) => {
      if (paths[index] !== null) return
      const target = resolve(inputPath)
      reports.push(
        withUnresolvablePath(
          inputPath,
          existsSync(target) && statSync(target).isDirectory()
            ? 'directory contains no SKILL.md'
            : 'no such file',
        ),
      )
    })
  }

  if (!inputMode && paths.length === 0) {
    fail('nothing to validate. Pass a SKILL.md path, --all-examples, or --technology. Run with --help.')
  }

  for (const filePath of paths) {
    if (filePath === null) continue
    reports.push(validateSkillFile(filePath))
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          reports: reports.map((report) => ({
            subject: report.subject,
            findings: report.sorted(),
          })),
        },
        null,
        2,
      ),
    )
    return reports.some((report) => report.errorCount > 0) ? 1 : 0
  }

  return printReports(reports, { strict: options.strict })
}

function withUnresolvablePath(inputPath, reason) {
  const report = createReport(inputPath)
  report.error(reason)
  return report
}

// Only run the CLI when invoked directly. validate-plugin.mjs imports
// validateSkillFile from this module and must not trigger argument parsing.
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2))
}
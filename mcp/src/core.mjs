/**
 * Bridge between the MCP layer and the plugin's deterministic core.
 *
 * The core lives in the skill directory so the skill stays portable and
 * dependency-free: an agent that only copies `skills/frontend-skill-builder/`
 * still gets the validators. The MCP server is the second consumer.
 *
 * This module is the single place that knows where the core lives. If the skill
 * directory is ever renamed or moved, only the two path constants below change.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `<plugin-root>/mcp/src` */
const HERE = dirname(fileURLToPath(import.meta.url))

/** `<plugin-root>` */
export const PLUGIN_ROOT = resolve(HERE, '..', '..')

/** Absolute path to the shared skill directory, discovered rather than hardcoded. */
export const SKILL_DIR = resolveSkillDir(PLUGIN_ROOT)

/** Absolute path to the bundled SKILL.md template. */
export const TEMPLATE_PATH = join(SKILL_DIR, 'assets', 'SKILL.template.md')

function readPluginName(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'plugin.json'), 'utf8')).name ?? null
  } catch {
    return null
  }
}

/**
 * Locate `skills/<name>/` by looking for a directory that actually contains a
 * SKILL.md. The plugin name is preferred when several skills ship, but a
 * plugin with one skill works even if its name differs from the skill name.
 */
function resolveSkillDir(root) {
  const skillsDir = join(root, 'skills')
  if (!existsSync(skillsDir)) {
    throw new Error(`skills directory not found at ${skillsDir}. The plugin layout looks wrong.`)
  }

  const candidates = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(skillsDir, name, 'SKILL.md')))
    .sort()

  if (candidates.length === 0) {
    throw new Error(`no skills/<name>/SKILL.md found under ${skillsDir}`)
  }

  const pluginName = readPluginName(root)
  const chosen = candidates.includes(pluginName) ? pluginName : candidates[0]
  return join(skillsDir, chosen)
}

// ---------------------------------------------------------------------------
// Core re-exports
//
// These are the tested, dependency-free implementations. The MCP tools are thin
// adapters over them; they never re-implement contract logic, because a second
// copy of the rules would drift from the first.
// ---------------------------------------------------------------------------

export {
  TECHNOLOGIES,
  TECHNOLOGY_KINDS,
  resolveTechnology,
  suggestTechnologies,
  getTechnology,
  isPractice,
} from '../../skills/frontend-skill-builder/scripts/lib/technologies.mjs'

export {
  SECTIONS,
  SECTION_IDS,
  REQUIRED_SECTION_IDS,
  CONDITIONAL_SECTION_IDS,
  LIMITS,
  DIFFICULTY_LEVELS,
  getSection,
  resolveDifficulty,
  parseHeadings,
  matchSection,
} from '../../skills/frontend-skill-builder/scripts/lib/skill-contract.mjs'

export { parseFrontmatter, FrontmatterError } from '../../skills/frontend-skill-builder/scripts/lib/frontmatter.mjs'

export { createReport } from '../../skills/frontend-skill-builder/scripts/lib/report.mjs'

export { validateSkillSource } from '../../skills/frontend-skill-builder/scripts/validate-skill.mjs'

// ---------------------------------------------------------------------------
// Helpers shared by the tool modules
// ---------------------------------------------------------------------------

/** Read a bundled text asset, failing with an actionable message. */
export function readAsset(absolutePath, label) {
  try {
    return readFileSync(absolutePath, 'utf8')
  } catch (error) {
    throw new Error(`cannot read ${label} at ${absolutePath}: ${error.message}`)
  }
}

let cachedPlaceholders = null

/**
 * Longest placeholder token recognised. The bound only stops a match running
 * away across a line; it must exceed the longest placeholder in the template,
 * which is 95 characters. A tighter bound silently skips the longest tokens,
 * which are exactly the ones a hurried writer leaves behind.
 */
const PLACEHOLDER_MAX_CHARS = 200

/**
 * Every placeholder token in the bundled template, read from the template
 * itself rather than hardcoded here.
 *
 * Reading it back is what makes `audit_skill` precise: an unfinished draft is
 * detected by matching these exact tokens. A generic `<...>` scan would false-
 * positive on TypeScript generics like `Array<T>` and JSX like `<Wrapper>`, both
 * of which are correct code.
 */
export function templatePlaceholders() {
  if (cachedPlaceholders === null) {
    const withoutComments = readAsset(TEMPLATE_PATH, 'SKILL template').replace(/<!--[\s\S]*?-->/g, '')
    const pattern = new RegExp(`<[^<>\\n]{2,${PLACEHOLDER_MAX_CHARS}}>`, 'g')
    cachedPlaceholders = [...new Set(withoutComments.match(pattern) ?? [])]
  }
  return cachedPlaceholders
}

/**
 * Convert a core `report` into plain JSON.
 *
 * `report.findings` is the machine-readable payload; `report.sorted()` orders
 * it deterministically so repeated calls produce identical output.
 */
export function findingsOf(report) {
  return report.sorted().map((finding) => ({
    level: finding.level,
    message: finding.message,
    ...(finding.hint ? { hint: finding.hint } : {}),
  }))
}

/**
 * Decide pass/fail the same way the CLI does, so the MCP tool and
 * `validate-skill.mjs` never disagree about whether a skill is valid.
 */
export function verdictOf(report, strict) {
  const errors = report.errorCount
  const warnings = report.warningCount
  return {
    passed: errors === 0 && !(strict && warnings > 0),
    errorCount: errors,
    warningCount: warnings,
  }
}

/** Trim a technology record down to what a caller needs, omitting internals. */
export function publicTechnology(tech) {
  return {
    id: tech.id,
    label: tech.label,
    kind: tech.kind,
    aliases: [...tech.aliases],
    notes: tech.notes,
    questions: [...tech.questions],
  }
}
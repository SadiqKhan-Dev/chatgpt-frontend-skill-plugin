/**
 * `audit_skill` — decide what to keep and what to rewrite in an existing skill.
 *
 * `validate_skill` answers "is this valid?". This answers the improve-mode
 * question: "what is actually wrong, and what must I not touch?". A tool that
 * only reports errors pushes the model toward rewriting the whole file, which
 * loses correct content and is exactly the behaviour the plugin is meant to
 * prevent. So the primary output here is a preserve-list.
 *
 * The checks are structural and factual. There is deliberately no list of
 * "deprecated APIs": such a list goes stale, and a stale list is worse than no
 * list. Instead the audit reports the version references and untagged code blocks
 * it actually found, so a human or the model can verify those specific claims.
 */

import { z } from 'zod'

import {
  LIMITS,
  SECTIONS,
  parseFrontmatter,
  FrontmatterError,
  parseHeadings,
  matchSection,
  templatePlaceholders,
  validateSkillSource,
  createReport,
  findingsOf,
  verdictOf,
} from '../core.mjs'
import { ok, guard, findingsArray, READ_ONLY } from '../toolkit.mjs'

/** A section shorter than this is treated as a stub rather than content. */
const THIN_SECTION_CHARS = 80

/**
 * Sections where brevity is correct, so the thin-content check must not apply.
 *
 * `name` is bounded by the specification at 64 characters, which is below
 * THIN_SECTION_CHARS. Without this exemption every valid skill reports its own
 * name section as needing a rewrite, which trains the model to ignore the audit.
 */
const THINNESS_EXEMPT = new Set(['name'])

export const auditSkill = {
  name: 'audit_skill',
  title: 'Audit an existing SKILL.md before improving it',
  description:
    'Use this for improve, convert, and update requests, before editing anything. Reports the contract violations, the sections that are present but thin, any template placeholders left behind, and, most importantly, an explicit preserve-list of sections that are already correct and must not be rewritten. Also surfaces the version references and untagged code blocks that need checking against current documentation.',
  inputSchema: {
    source: z
      .string()
      .min(1)
      .max(400_000)
      .describe('The full existing SKILL.md source, frontmatter included.'),
  },
  outputSchema: {
    parsed: z.boolean().describe('False when the frontmatter could not be parsed, so no structural analysis was possible.'),
    passed: z.boolean().describe('True when the source already satisfies the contract.'),
    errorCount: z.number(),
    warningCount: z.number(),
    findings: findingsArray.describe('Contract findings, errors first.'),
    preserve: z.array(z.object({ id: z.string(), heading: z.string(), characters: z.number() })).describe('Sections that are already correct. Do not rewrite these.'),
    rewrite: z.array(z.object({ id: z.string(), heading: z.string(), reason: z.string() })).describe('Sections that are missing, thin, or still hold template text.'),
    extraHeadings: z.array(z.object({ heading: z.string(), line: z.number() })).describe('Level-2 headings that are not part of the contract.'),
    templateLeftovers: z.array(z.string()).describe('Placeholder tokens from the bundled template that are still present.'),
    description: z
      .object({
        length: z.number(),
        maxChars: z.number(),
        hasTriggerPhrase: z.boolean().describe('True when it says when to use the skill, not only what it does.'),
      })
      .optional(),
    structure: z
      .object({
        bodyLines: z.number(),
        bodyLineLimit: z.number(),
        codeBlocks: z.number(),
        untaggedCodeBlocks: z.number(),
      })
      .optional(),
    versionReferences: z.array(z.string()).describe('Version strings found in the text. Verify each against current documentation.'),
    inlineComments: z.number().describe('HTML comment blocks still present. Generated skills ship without them.'),
  },
  annotations: READ_ONLY,
  handler: guard(({ source }) => {
    const report = createReport('SKILL.md')
    validateSkillSource(source, { filePath: null, report })
    const findings = findingsOf(report)
    const verdict = verdictOf(report, false)

    let parsed
    try {
      parsed = parseFrontmatter(source)
    } catch (error) {
      const message = error instanceof FrontmatterError ? error.message : String(error)
      return ok(
        {
          ...verdict,
          parsed: false,
          findings: [
            ...findings,
            {
              level: 'error',
              message: `frontmatter could not be parsed, so no structural analysis was run: ${message}`,
              hint: 'Fix the frontmatter first, then audit again.',
            },
          ],
          preserve: [],
          rewrite: [],
          extraHeadings: [],
          templateLeftovers: [],
          versionReferences: [],
          inlineComments: 0,
        },
        `Cannot audit structurally: ${message} Fix the frontmatter, then run audit_skill again.`,
      )
    }

    const { data, body, bodyStartLine } = parsed
    const placeholders = templatePlaceholders()

    const found = levelTwoSections(body, bodyStartLine)
    const bySectionId = new Map()
    for (const entry of found) {
      if (entry.sectionId !== null && !bySectionId.has(entry.sectionId)) {
        bySectionId.set(entry.sectionId, entry)
      }
    }

    const preserve = []
    const rewrite = []

    for (const section of SECTIONS) {
      const entry = bySectionId.get(section.id)
      const leftover = entry ? placeholders.filter((token) => entry.text.includes(token)) : []

      if (entry === undefined) {
        if (section.required) {
          rewrite.push({ id: section.id, heading: section.heading, reason: 'Required section is missing.' })
        }
        continue
      }

      if (leftover.length > 0) {
        rewrite.push({
          id: section.id,
          heading: section.heading,
          reason: `Still contains template placeholders: ${leftover.join(', ')}.`,
        })
        continue
      }

      if (!THINNESS_EXEMPT.has(section.id) && entry.text.length < THIN_SECTION_CHARS) {
        rewrite.push({
          id: section.id,
          heading: section.heading,
          reason: `Only ${entry.text.length} characters. Too thin to be useful to an agent.`,
        })
        continue
      }

      preserve.push({ id: section.id, heading: section.heading, characters: entry.text.length })
    }

    const extraHeadings = found
      .filter((entry) => entry.sectionId === null)
      .map((entry) => ({ heading: entry.heading.text, line: entry.heading.line }))

    const description = typeof data.description === 'string' ? data.description : ''
    const stats = codeBlockStats(body)
    // Scan the body only. Frontmatter metadata such as `version: "1.0.0"` is the
    // skill declaring itself, not a technical claim that needs verifying.
    const versionReferences = [...new Set(body.match(/\bv?\d+\.\d+(?:\.\d+)?\b/g) ?? [])].sort()

    const summary =
      `Audit: ${verdict.errorCount} error(s), ${verdict.warningCount} warning(s). ` +
      `Preserve ${preserve.length} section(s); rewrite or add ${rewrite.length}. ` +
      `${placeholders.filter((token) => source.includes(token)).length} template placeholder(s) left behind.`

    return ok(
      {
        ...verdict,
        parsed: true,
        findings,
        preserve,
        rewrite,
        extraHeadings,
        templateLeftovers: placeholders.filter((token) => source.includes(token)),
        description: {
          length: description.length,
          maxChars: LIMITS.descriptionMaxChars,
          hasTriggerPhrase: /\buse when\b|\bwhen to use\b|\bwhen you\b/i.test(description),
        },
        structure: {
          bodyLines: body.split(/\r?\n/).length,
          bodyLineLimit: LIMITS.bodyMaxLines,
          codeBlocks: stats.total,
          untaggedCodeBlocks: stats.untagged,
        },
        versionReferences,
        inlineComments: (source.match(/<!--[\s\S]*?-->/g) ?? []).length,
      },
      summary,
    )
  }),
}

/**
 * Split the body into its level-2 sections.
 *
 * `parseHeadings` reports absolute line numbers, offset by `bodyStartLine`, so
 * subtracting it recovers the zero-based index into the split body.
 */
function levelTwoSections(body, bodyStartLine) {
  const lines = body.split(/\r?\n/)
  const headings = parseHeadings(body, bodyStartLine).filter((heading) => heading.level === 2)

  return headings.map((heading, index) => {
    const start = heading.line - bodyStartLine
    const end = index + 1 < headings.length ? headings[index + 1].line - bodyStartLine : lines.length
    return {
      heading,
      sectionId: matchSection(heading.text),
      text: lines.slice(start + 1, end).join('\n').trim(),
    }
  })
}

/** Count fenced code blocks, and how many have no language tag. */
function codeBlockStats(body) {
  let total = 0
  let untagged = 0
  let openChar = null

  for (const line of body.split(/\r?\n/)) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/)
    if (fence === null) continue
    const char = fence[1][0]
    const info = fence[2].trim()

    if (openChar === null) {
      openChar = char
      total += 1
      if (info === '') untagged += 1
    } else if (char === openChar && info === '') {
      openChar = null
    }
  }

  return { total, untagged }
}
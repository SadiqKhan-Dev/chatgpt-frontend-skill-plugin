/**
 * Output-contract tools: the section list and the SKILL.md template.
 *
 * These make the 15-section contract available to the model as data rather than
 * as prose it has to remember. Both read the same `SECTIONS` table the validator
 * enforces, so the instructions and the checker cannot disagree.
 *
 * Deliberate limit: this module fills in the parts a machine can decide
 * (identifier, title, which conditional sections are plausible) and refuses to
 * invent the parts that need judgement (the description, the section content).
 * A template with plausible-looking generated prose in it teaches the model to
 * accept filler, which is the failure this plugin exists to prevent.
 */

import { z } from 'zod'

import {
  SECTIONS,
  REQUIRED_SECTION_IDS,
  CONDITIONAL_SECTION_IDS,
  LIMITS,
  TEMPLATE_PATH,
  readAsset,
  getSection,
  isPractice,
  resolveTechnology,
  templatePlaceholders,
} from '../core.mjs'
import { ok, guard, sectionObject, READ_ONLY } from '../toolkit.mjs'

export const listSections = {
  name: 'list_sections',
  title: 'List the sections a generated skill must contain',
  description:
    'Use this before drafting or while checking a draft. Every generated SKILL.md has the same 15 sections: 11 required, where a missing section is an error, and 4 conditional, where a missing section is only a warning because whether it applies is a judgement call. Returns the canonical heading, accepted aliases, and what each section must contain.',
  inputSchema: {
    requiredOnly: z
      .boolean()
      .optional()
      .describe('Return only the 11 required sections. Omit for all 15.'),
  },
  outputSchema: {
    count: z.number().describe('Number of sections returned.'),
    requiredCount: z.number().describe('Total required sections in the contract.'),
    conditionalCount: z.number().describe('Total conditional sections in the contract.'),
    bodyLineLimit: z.number().describe('Recommended maximum body length in lines.'),
    sections: z.array(sectionObject).describe('The section definitions.'),
  },
  annotations: READ_ONLY,
  handler: guard(({ requiredOnly }) => {
    const sections = (requiredOnly ? SECTIONS.filter((entry) => entry.required) : SECTIONS).map((section) => ({
      id: section.id,
      heading: section.heading,
      aliases: [...section.aliases],
      required: section.required,
      intent: section.intent,
      ...(section.skipForPractices ? { skipForPractices: true } : {}),
    }))

    return ok(
      {
        count: sections.length,
        requiredCount: REQUIRED_SECTION_IDS.length,
        conditionalCount: CONDITIONAL_SECTION_IDS.length,
        bodyLineLimit: LIMITS.bodyMaxLines,
        sections,
      },
      `${sections.length} section(s): ${REQUIRED_SECTION_IDS.length} required, ${CONDITIONAL_SECTION_IDS.length} conditional. Keep the body under ${LIMITS.bodyMaxLines} lines.`,
    )
  }),
}

export const getSkillTemplate = {
  name: 'get_skill_template',
  title: 'Get the SKILL.md template to start from',
  description:
    'Use this at the start of the create, convert, or from-docs workflow. Returns the bundled template with the identifier and title filled in, plus the exact list of placeholders that must all be replaced and the decision for each conditional section. The description and the section bodies are deliberately left as placeholders: write real content, do not ship filler.',
  inputSchema: {
    name: z
      .string()
      .optional()
      .describe('Intended skill name in kebab-case. Must match the directory the skill is written to.'),
    technology: z
      .string()
      .optional()
      .describe('Technology label. Decides which conditional sections are plausible.'),
    topic: z.string().optional().describe('What the skill teaches. Used to draft the description.'),
  },
  outputSchema: {
    template: z.string().describe('The template SKILL.md, ready to copy.'),
    templatePath: z.string().describe('Absolute path of the bundled template on disk.'),
    suggestedName: z.string().describe('The name to use, or a placeholder if none was supplied.'),
    descriptionDraft: z
      .string()
      .describe('A starting description. Rewrite it: the trigger conditions must be concrete, not generic.'),
    placeholders: z.array(z.string()).describe('Tokens still present in the template. All must be replaced.'),
    conditionalSections: z.array(
      z.object({
        id: z.string(),
        heading: z.string(),
        decision: z.enum(['include', 'omit', 'undecided']),
        reason: z.string(),
      }),
    ),
  },
  annotations: READ_ONLY,
  handler: guard(({ name, technology, topic }) => {
    const template = readAsset(TEMPLATE_PATH, 'SKILL template')

    const skillName = name ?? '<kebab-case-name>'
    const title = name === undefined ? '<Skill Title>' : humanise(name)

    // Substitute only the two machine-decidable tokens. The description and every
    // body section stay as placeholders on purpose.
    let materialised = template
    if (name !== undefined) {
      materialised = materialised.replaceAll('<kebab-case-name>', name)
      materialised = materialised.replace('<Skill Title>', title)
    }

    const practice = technology === undefined ? null : resolvePractice(technology)
    const conditionalSections = CONDITIONAL_SECTION_IDS.map((id) => {
      const section = getSection(id)
      let decision = 'undecided'
      let reason = 'No technology supplied. Include it only if it applies to the topic.'
      if (practice !== undefined) {
        if (practice === null) {
          reason = `"${technology}" is not in the supported catalog, so relevance is undecided.`
        } else if (section.skipForPractices && practice) {
          decision = 'omit'
          reason = `${practice.label} is a cross-cutting practice topic. Omitting this avoids implying a file layout the skill does not produce.`
        } else {
          decision = 'include'
          reason = `Usually relevant for ${practice.label}. Still confirm it fits the topic.`
        }
      }
      return { id, heading: section.heading, decision, reason }
    })

    // Placeholders are read from a comment-stripped copy: the template's own
    // instruction comment contains tokens like <placeholder> that are not
    // authoring work.
    const placeholders = templatePlaceholders().filter((token) => materialised.includes(token))

    const descriptionDraft =
      topic === undefined
        ? '<What the skill does>. Use when <the concrete situations a developer or agent should reach for it>.'
        : `${topic}. Use when <the concrete situations a developer or agent should reach for it>.`

    const include = conditionalSections.filter((entry) => entry.decision === 'include').map((entry) => entry.heading)
    const omit = conditionalSections.filter((entry) => entry.decision === 'omit').map((entry) => entry.heading)

    return ok(
      {
        template: materialised,
        templatePath: TEMPLATE_PATH,
        suggestedName: skillName,
        descriptionDraft,
        placeholders,
        conditionalSections,
      },
      `Template ready${name === undefined ? '' : ` for "${name}"`}. ${
        placeholders.length
      } placeholder(s) must all be replaced and the HTML instruction comments deleted. Conditional sections to include: ${
        include.join(', ') || 'none decided'
      }. Omit: ${omit.join(', ') || 'none decided'}.`,
    )
  }),
}

/** The technology record when it resolves, or `null` when it does not. */
function resolvePractice(technology) {
  const result = resolveTechnology(technology)
  return result.status === 'ok' ? result.technology : null
}

/** "react-form-validation" -> "React Form Validation" */
function humanise(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
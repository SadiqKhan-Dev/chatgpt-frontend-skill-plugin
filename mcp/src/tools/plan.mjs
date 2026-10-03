/**
 * `plan_skill` — the reusable frontend skill-generation workflow.
 *
 * This is the tool that encodes the plugin's method rather than its data. It
 * resolves the three blocking inputs, decides which sections apply, and returns
 * the open questions and constraints that must be settled before any prose is
 * written.
 *
 * It deliberately does not draft the skill. The parts of a good skill that
 * matter most, such as an accurate boundary and a verifiable checklist, are
 * judgement calls. A tool that filled them in would produce a document that
 * passes validation and teaches nothing.
 */

import { z } from 'zod'

import {
  REQUIRED_SECTION_IDS,
  CONDITIONAL_SECTION_IDS,
  DIFFICULTY_LEVELS,
  LIMITS,
  getSection,
  isPractice,
  resolveTechnology,
  resolveDifficulty,
  publicTechnology,
} from '../core.mjs'
import { ok, rejected, guard, statusShape, technologyObject, READ_ONLY } from '../toolkit.mjs'

export const planSkill = {
  name: 'plan_skill',
  title: 'Plan a frontend skill before writing it',
  description:
    'Use this first for every create, convert, from-docs, or improve request. It resolves the technology and difficulty against the catalog, decides which of the 15 contract sections apply, and returns the intake questions and constraints you must settle before drafting. Call it before writing any prose: it tells you what to ask the user and what not to invent.',
  inputSchema: {
    technology: z.string().min(1).describe('The technology the skill is about, as the user named it.'),
    topic: z.string().min(1).describe('The specific job the skill teaches, not the technology name.'),
    difficulty: z.string().min(1).describe('beginner, intermediate, or advanced.'),
  },
  outputSchema: {
    ...statusShape,
    technology: technologyObject.optional().describe('The resolved catalog entry.'),
    topic: z.string().describe('The topic as supplied.'),
    difficulty: z
      .object({
        id: z.string(),
        label: z.string(),
        intent: z.string(),
      })
      .optional()
      .describe('The resolved difficulty and how it should change the writing.'),
    sections: z
      .object({
        required: z.array(z.object({ id: z.string(), heading: z.string(), intent: z.string() })),
        recommended: z.array(z.object({ id: z.string(), heading: z.string(), intent: z.string() })),
        omittedByDefault: z.array(z.object({ id: z.string(), heading: z.string(), reason: z.string() })),
      })
      .optional()
      .describe('The section plan for this technology. Absent when the request was rejected.'),
    // Everything below describes a resolved plan. The rejection branches return
    // only `ok`, `topic`, `reason`, and `suggestions`, so these must be optional
    // or the SDK rejects the result as malformed and the model sees a tool error
    // instead of the guidance it needs.
    openQuestions: z
      .array(z.string())
      .optional()
      .describe('Ask these, or record each as a labelled assumption.'),
    constraints: z
      .array(z.string())
      .optional()
      .describe('Rules that bound what the skill may recommend.'),
    bodyLineLimit: z.number().optional().describe('Recommended maximum body length in lines.'),
    nextSteps: z.array(z.string()).optional().describe('The tool sequence to follow from here.'),
    reason: z.string().optional().describe('Why the request was rejected.'),
    suggestions: z.array(z.string()).optional().describe('Closest supported technologies, when rejected.'),
  },
  annotations: READ_ONLY,
  handler: guard(({ technology, topic, difficulty }) => {
    const techResult = resolveTechnology(technology)

    if (techResult.status === 'compound') {
      return rejected(
        { ok: false, topic, reason: techResult.reason, suggestions: techResult.candidates },
        `Rejected: ${techResult.reason} Named separately: ${techResult.candidates.join('; ')}.`,
      )
    }

    if (techResult.status === 'unsupported') {
      const suffix =
        techResult.suggestions.length > 0 ? ` Closest supported: ${techResult.suggestions.join(', ')}.` : ''
      return rejected(
        {
          ok: false,
          topic,
          reason: `"${technology}" is not in the supported catalog.${suffix}`,
          suggestions: techResult.suggestions,
        },
        `Rejected: "${technology}" is not in the supported catalog.${suffix} Ask the user which supported technology they meant. Do not map it to the nearest entry.`,
      )
    }

    if (techResult.status === 'empty') {
      return rejected(
        { ok: false, topic, reason: 'No technology was supplied.' },
        'Rejected: no technology was supplied. Ask which frontend technology the skill is about.',
      )
    }

    const tech = techResult.technology
    const difficultyResult = resolveDifficulty(difficulty)

    if (difficultyResult.status !== 'ok') {
      const valid = DIFFICULTY_LEVELS.map((level) => level.id)
      return rejected(
        {
          ok: false,
          topic,
          technology: publicTechnology(tech),
          reason:
            difficultyResult.status === 'empty'
              ? 'No difficulty was supplied.'
              : `"${difficulty}" is not a valid difficulty. Valid levels: ${valid.join(', ')}.`,
          suggestions: valid,
        },
        `Rejected: ${
          difficultyResult.status === 'empty' ? 'no difficulty was supplied.' : `"${difficulty}" is not a valid difficulty.`
        } Valid levels: ${valid.join(', ')}. Ask the user, or state the choice as an assumption.`,
      )
    }

    const level = difficultyResult.level
    const practice = isPractice(tech)

    const required = REQUIRED_SECTION_IDS.map((id) => {
      const section = getSection(id)
      return { id, heading: section.heading, intent: section.intent }
    })

    const recommended = []
    const omittedByDefault = []
    for (const id of CONDITIONAL_SECTION_IDS) {
      const section = getSection(id)
      if (section.skipForPractices && practice) {
        omittedByDefault.push({
          id,
          heading: section.heading,
          reason: `${tech.label} is a cross-cutting practice topic, so suggesting a project layout would imply files this skill does not produce.`,
        })
      } else {
        recommended.push({ id, heading: section.heading, intent: section.intent })
      }
    }

    const constraints = [
      tech.notes,
      `Write for ${level.label.toLowerCase()} difficulty: ${level.intent}`,
      'State every assumption explicitly instead of silently choosing a default.',
      'Do not add a library, framework, or build tool the user did not ask for.',
      'Verify anything version-specific against official documentation, or leave it out and record it as an open question.',
      'Never place credentials, tokens, internal hostnames, or customer data in the skill.',
    ]
    if (practice) {
      constraints.push(
        `${tech.label} is a cross-cutting practice. The skill must not introduce a library or build tool on its own.`,
      )
    }

    const nextSteps = [
      'get_skill_template with the name, technology, and topic, for the skeleton and placeholder list.',
      'Ask the user the openQuestions above, or record each unanswered one as a labelled assumption.',
      'Draft the required sections with topic-specific content. Delete the template instruction comments.',
      'validate_skill with the finished source. Fix every error; decide each warning deliberately.',
      'Report the path, the resolved technology and difficulty, which conditional sections were included or omitted and why, and every open question.',
    ]

    return ok(
      {
        ok: true,
        technology: publicTechnology(tech),
        topic,
        difficulty: { id: level.id, label: level.label, intent: level.intent },
        sections: { required, recommended, omittedByDefault },
        openQuestions: [...tech.questions],
        constraints,
        bodyLineLimit: LIMITS.bodyMaxLines,
        nextSteps,
      },
      `Planned "${topic}" for ${tech.label} at ${level.label} difficulty. ` +
        `${required.length} required section(s), ${recommended.length} recommended, ${omittedByDefault.length} omitted by default. ` +
        `${tech.questions.length} open question(s) to settle before drafting. Keep the body under ${LIMITS.bodyMaxLines} lines.`,
    )
  }),
}
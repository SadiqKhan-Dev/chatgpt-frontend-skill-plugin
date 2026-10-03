/**
 * Technology catalog tools.
 *
 * Thin adapters over `scripts/lib/technologies.mjs`. They add transport shape
 * and nothing else: the resolution rules, alias handling, and suggestions are
 * the tested core's job.
 */

import { z } from 'zod'

import {
  TECHNOLOGIES,
  resolveTechnology,
  publicTechnology,
} from '../core.mjs'
import { ok, rejected, guard, statusShape, technologyObject, READ_ONLY } from '../toolkit.mjs'

export const listTechnologies = {
  name: 'list_technologies',
  title: 'List supported frontend technologies',
  description:
    'Use this first when you need to know which technologies the plugin supports, or when a user names a technology you are unsure is in the catalog. Returns every entry with its kind, aliases, the mistake a writer is most likely to make, and the intake questions for that technology.',
  inputSchema: {
    kind: z
      .enum(['language', 'framework', 'library', 'component-library', 'styling', 'build-tool', 'practice'])
      .optional()
      .describe('Return only technologies of this kind. Omit for all.'),
  },
  outputSchema: {
    count: z.number().describe('Number of technologies returned.'),
    technologies: z.array(technologyObject).describe('The catalog entries.'),
  },
  annotations: READ_ONLY,
  handler: guard(({ kind }) => {
    const all = TECHNOLOGIES.map(publicTechnology)
    const technologies = kind ? all.filter((tech) => tech.kind === kind) : all
    return ok(
      { count: technologies.length, technologies },
      technologies.length === 0
        ? `No supported technology has kind "${kind}".`
        : `${technologies.length} supported technolog${technologies.length === 1 ? 'y' : 'ies'}: ${technologies
            .map((tech) => tech.label)
            .join(', ')}.`,
    )
  }),
}

export const resolveTechnologyTool = {
  name: 'resolve_technology',
  title: 'Resolve a technology name against the catalog',
  description:
    'Use this before drafting, to check that the technology a user asked for is actually supported. Names resolve case-insensitively and ignore punctuation, so "Next.js", "nextjs", and "NextJS" all match. An unsupported name is rejected with suggestions rather than mapped to the nearest entry, and a request naming two technologies is rejected because one skill covers one technology.',
  inputSchema: {
    name: z.string().min(1).describe('The technology name exactly as the user wrote it.'),
  },
  outputSchema: {
    ...statusShape,
    input: z.string().describe('The name that was submitted.'),
    matchedOn: z.string().optional().describe('Which catalog form matched, for example an alias.'),
    technology: technologyObject.optional().describe('The resolved catalog entry.'),
    suggestions: z.array(z.string()).optional().describe('Closest supported ids, when the name was rejected.'),
    candidates: z.array(z.string()).optional().describe('The separate technologies named, for a compound request.'),
    reason: z.string().optional().describe('Why the request was rejected.'),
  },
  annotations: READ_ONLY,
  handler: guard(({ name }) => {
    const result = resolveTechnology(name)

    if (result.status === 'ok') {
      return ok(
        { ok: true, input: name, matchedOn: result.matchedOn, technology: publicTechnology(result.technology) },
        `"${name}" resolved to ${result.technology.label} (${result.technology.kind}). ${
          result.technology.questions.length
        } intake question(s) apply; see plan_skill.`,
      )
    }

    if (result.status === 'compound') {
      return rejected(
        { ok: false, input: name, reason: result.reason, candidates: result.candidates },
        `Rejected: ${result.reason} Named separately: ${result.candidates.join('; ')}.`,
      )
    }

    const suggestions =
      result.status === 'unsupported' && result.suggestions.length > 0
        ? ` Closest supported: ${result.suggestions.join(', ')}.`
        : ''

    return rejected(
      {
        ok: false,
        input: name,
        reason:
          result.status === 'empty'
            ? 'No technology name was supplied.'
            : `"${name}" is not in the supported catalog.${suggestions}`,
        suggestions: result.status === 'unsupported' ? result.suggestions : [],
      },
      `Rejected: ${
        result.status === 'empty' ? 'no technology name was supplied.' : `"${name}" is not in the supported catalog.`
      }${suggestions} Ask the user which supported technology they meant, or list_technologies to show the catalog. Do not map it to the nearest entry.`,
    )
  }),
}
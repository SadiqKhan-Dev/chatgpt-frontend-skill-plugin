/**
 * Shared result-shaping helpers for the MCP tools.
 *
 * Two distinct failure modes are handled separately, because they need different
 * behaviour from the model:
 *
 *   - A *domain rejection* (unsupported technology, ambiguous difficulty) comes
 *     back as a normal result with `ok: false`. The model reads it, then asks the
 *     user a clarifying question. Returning `isError` here would surface a tool
 *     failure in the UI for what is really a question.
 *   - An *unexpected fault* (missing bundled asset, filesystem problem) returns
 *     `isError: true` with an actionable message. That is a genuine failure and
 *     should be visible.
 */

import { z } from 'zod'

/** A single MCP text content block. */
export function text(value) {
  return { type: 'text', text: value }
}

/** A successful result: structured data for follow-up calls, prose for the reply. */
export function ok(structuredContent, summary) {
  return { structuredContent, content: [text(summary)] }
}

/** A domain rejection the model is expected to act on. */
export function rejected(structuredContent, summary) {
  return { structuredContent, content: [text(summary)] }
}

/** A genuine fault. */
export function fault(message, hint) {
  return {
    isError: true,
    content: [text(hint ? `${message}\n\n${hint}` : message)],
  }
}

/**
 * Wrap a handler so an unexpected exception becomes an actionable tool error
 * instead of an opaque protocol failure.
 */
export function guard(handler) {
  return async (args) => {
    try {
      return await handler(args)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return fault(
        `The frontend-skill-builder tool failed: ${detail}`,
        'This is a bug in the plugin, not in the request. Report it with the tool name and arguments used.',
      )
    }
  }
}

/** Shared output fragments so every tool reports status the same way. */
export const statusShape = {
  ok: z.boolean().describe('False when the request was rejected and the model should ask the user.'),
}

export const findingsShape = {
  level: z.enum(['error', 'warning', 'info']).describe('Severity of the finding.'),
  message: z.string().describe('What is wrong.'),
  hint: z.string().optional().describe('How to fix it.'),
}

export const sectionShape = {
  id: z.string().describe('Stable section identifier.'),
  heading: z.string().describe('Canonical level-2 heading text.'),
  aliases: z.array(z.string()).describe('Accepted alternative heading texts.'),
  required: z.boolean().describe('True when a missing section is an error.'),
  intent: z.string().describe('What the section must contain.'),
  skipForPractices: z.boolean().optional().describe('True when a cross-cutting practice topic should omit it.'),
}

export const technologyShape = {
  id: z.string().describe('Stable identifier, kebab-case.'),
  label: z.string().describe('Display name.'),
  kind: z.string().describe('language, framework, library, component-library, styling, build-tool, or practice.'),
  aliases: z.array(z.string()).describe('Other names that resolve to this technology.'),
  notes: z.string().describe('The mistake a writer is most likely to make here.'),
  questions: z.array(z.string()).describe('Intake questions to answer or record as stated assumptions.'),
}

/**
 * The shapes above are ZodRawShapes so they can be spread into a tool's
 * `outputSchema`. These wrappers are for nesting them as values.
 */
export const technologyObject = z.object(technologyShape)
export const sectionObject = z.object(sectionShape)
export const findingsArray = z.array(z.object(findingsShape))

/** Annotations shared by every tool. None of them write, delete, or reach the network. */
export const READ_ONLY = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
})
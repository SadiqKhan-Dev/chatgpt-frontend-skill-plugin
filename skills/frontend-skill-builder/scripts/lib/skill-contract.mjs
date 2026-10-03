/**
 * The SKILL.md output contract.
 *
 * A generated skill must contain every `required` section. Conditional sections
 * are reported as warnings when absent, because whether they apply depends on the
 * technology and topic, and the skill author (an agent) is better placed than
 * this validator to decide.
 *
 * Difficulty is an input to the workflow, so it lives here next to the section
 * rules it influences.
 */

export const LIMITS = Object.freeze({
  /** Agent Skills: name must be 1-64 characters. */
  nameMaxChars: 64,
  /** Agent Skills: description must be 1-1024 characters. */
  descriptionMaxChars: 1024,
  /** Agent Skills: compatibility must be 1-500 characters. */
  compatibilityMaxChars: 500,
  /** Agent Skills: keep SKILL.md under 500 lines (progressive disclosure). */
  bodyMaxLines: 500,
  /** Directory name must equal the frontmatter name. */
  skillDirNamePattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
})

export const SECTIONS = Object.freeze([
  {
    id: 'name',
    heading: 'Name',
    required: true,
    aliases: ['skill name'],
    intent: 'The skill name exactly as written in the frontmatter `name` field.',
  },
  {
    id: 'description',
    heading: 'Description',
    required: true,
    aliases: ['skill description'],
    intent: 'One or two sentences matching the frontmatter `description`, covering what it does and when to use it.',
  },
  {
    id: 'purpose',
    heading: 'Purpose',
    required: true,
    aliases: ['overview', 'about'],
    intent: 'The outcome this skill produces, in one short paragraph.',
  },
  {
    id: 'when-to-use',
    heading: 'When to use',
    required: true,
    aliases: [
      'when to use this',
      'when to use this skill',
      'use when',
      'when this applies',
      'applicability',
    ],
    intent: 'Concrete trigger conditions, plus an explicit "do not use when" boundary.',
  },
  {
    id: 'prerequisites',
    heading: 'Prerequisites',
    required: true,
    aliases: ['requirements', 'preconditions', 'prereqs', 'before you start'],
    intent: 'Tools, versions, and knowledge required before step 1. Empty is not acceptable: write "None".',
  },
  {
    id: 'core-concepts',
    heading: 'Core concepts',
    required: true,
    aliases: ['key concepts', 'concepts', 'fundamentals', 'terminology'],
    intent: 'The vocabulary and mental model needed to follow the workflow correctly.',
  },
  {
    id: 'step-by-step-workflow',
    heading: 'Step-by-step workflow',
    required: true,
    aliases: ['workflow', 'step by step', 'steps', 'procedure', 'process', 'how to'],
    intent: 'Numbered, ordered, actionable steps an agent can execute.',
  },
  {
    id: 'best-practices',
    heading: 'Best practices',
    required: true,
    aliases: ['best practice', 'guidelines', 'conventions', 'do and dont'],
    intent: 'Production habits specific to this technology, including what to avoid.',
  },
  {
    id: 'recommended-project-structure',
    heading: 'Recommended project structure',
    required: false,
    aliases: [
      'project structure',
      'recommended structure',
      'file structure',
      'directory structure',
    ],
    intent: 'Only when the skill produces files or modules that need a home.',
    skipForPractices: true,
  },
  {
    id: 'code-examples',
    heading: 'Code examples',
    required: false,
    aliases: ['examples', 'example code', 'code sample', 'samples'],
    intent: 'Only when runnable or illustrative code clarifies the workflow.',
  },
  {
    id: 'common-mistakes',
    heading: 'Common mistakes',
    required: true,
    aliases: ['mistakes to avoid', 'pitfalls', 'anti patterns', 'common pitfalls', 'gotchas'],
    intent: 'Concrete failure modes with the correct alternative.',
  },
  {
    id: 'security-considerations',
    heading: 'Security considerations',
    required: false,
    aliases: ['security', 'security notes', 'security and privacy'],
    intent: 'Only when user input, auth, data handling, or rendering is in scope.',
  },
  {
    id: 'performance-considerations',
    heading: 'Performance considerations',
    required: false,
    aliases: ['performance', 'performance notes'],
    intent: 'Only when a measurable performance concern exists for this technology.',
  },
  {
    id: 'testing-verification-checklist',
    heading: 'Testing/verification checklist',
    required: true,
    aliases: [
      'testing and verification checklist',
      'testing checklist',
      'verification checklist',
      'testing and verification',
      'how to verify',
    ],
    intent: 'Commands and observable checks that prove the work is correct.',
  },
  {
    id: 'final-implementation-checklist',
    heading: 'Final implementation checklist',
    required: true,
    aliases: ['implementation checklist', 'final checklist', 'definition of done', 'done checklist'],
    intent: 'The last pass before the work is called complete.',
  },
])

export const SECTION_IDS = Object.freeze(SECTIONS.map((section) => section.id))
export const REQUIRED_SECTION_IDS = Object.freeze(
  SECTIONS.filter((section) => section.required).map((section) => section.id),
)
export const CONDITIONAL_SECTION_IDS = Object.freeze(
  SECTIONS.filter((section) => !section.required).map((section) => section.id),
)

const SECTION_BY_ID = new Map(SECTIONS.map((section) => [section.id, section]))

export function getSection(id) {
  return SECTION_BY_ID.get(id) ?? null
}

export const DIFFICULTY_LEVELS = Object.freeze([
  {
    id: 'beginner',
    label: 'Beginner',
    aliases: ['junior', 'entry level', 'entry-level', 'basic', 'novice', 'fundamentals'],
    intent: 'Assume no prior knowledge of the technology. Explain terminology on first use, show every step, and favour copy-pasteable snippets over elided code.',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    aliases: ['mid level', 'mid-level', 'standard', 'working knowledge'],
    intent: 'Assume the reader can use the technology but not its ecosystem. Cover the recommended path and the trade-offs behind it.',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    aliases: ['expert', 'senior', 'deep dive', 'deep-dive'],
    intent: 'Assume fluency. Focus on internals, edge cases, performance and security implications, and the reasoning behind each recommendation.',
  },
])

const DIFFICULTY_BY_ID = new Map(DIFFICULTY_LEVELS.map((level) => [level.id, level]))

/**
 * Resolve a user-supplied difficulty level.
 *
 * @returns {{ status: 'ok', level: object } | { status: 'empty' } | { status: 'unsupported', input: string, valid: string[] }}
 */
export function resolveDifficulty(input) {
  if (typeof input !== 'string' || input.trim() === '') return { status: 'empty' }
  const raw = input.trim()
  const needle = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  for (const level of DIFFICULTY_LEVELS) {
    const forms = [level.id, level.label, ...level.aliases]
    if (forms.some((form) => form.toLowerCase().replace(/[^a-z0-9]+/g, ' ') === needle)) {
      return { status: 'ok', level }
    }
  }
  return {
    status: 'unsupported',
    input: raw,
    valid: DIFFICULTY_LEVELS.map((level) => level.id),
  }
}

/** Reduce heading text to a comparable form: lowercase words, no punctuation. */
export function normalizeHeading(text) {
  return String(text)
    .replace(/`/g, '')
    .replace(/\*\*?/g, '')
    .replace(/^#+\s*/, '')
    .replace(/[:：]\s*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const HEADING_LOOKUP = (() => {
  const lookup = new Map()
  for (const section of SECTIONS) {
    for (const form of [section.heading, ...section.aliases]) {
      lookup.set(normalizeHeading(form), section.id)
    }
  }
  return lookup
})()

/** Map heading text to a section id, or null when it is an extra heading. */
export function matchSection(headingText) {
  return HEADING_LOOKUP.get(normalizeHeading(headingText)) ?? null
}

/**
 * Parse ATX headings from a Markdown body.
 *
 * Fenced code blocks are skipped so that `# comment` lines inside examples are
 * never mistaken for headings.
 */
export function parseHeadings(body, startLine = 1) {
  const headings = []
  let fence = null
  body.split(/\r?\n/).forEach((line, index) => {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) fence = marker
      else if (fence === marker) fence = null
      return
    }
    if (fence !== null) return
    const match = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) return
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      line: startLine + index,
    })
  })
  return headings
}
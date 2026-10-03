/**
 * `validate_skill` — run the output contract over a draft.
 *
 * A thin adapter over `validateSkillSource`. It adds no rules of its own: if this
 * tool and `scripts/validate-skill.mjs` ever disagree about whether a skill is
 * valid, one of them has a bug, and the CLI is the reference because CI uses it.
 */

import { z } from 'zod'

import { LIMITS, validateSkillSource, createReport, findingsOf, verdictOf } from '../core.mjs'
import { ok, guard, findingsArray, READ_ONLY } from '../toolkit.mjs'

export const validateSkill = {
  name: 'validate_skill',
  title: 'Validate a SKILL.md against the output contract',
  description:
    'Use this on every draft before showing it to the user, and again after any edit. Checks frontmatter, the directory-name rule, all 11 required sections, the 4 conditional sections, body length, and heading spelling. Returns structured findings split into errors and warnings. A missing required section is an error; a missing conditional section is a warning, because whether it applies is a judgement call. Fix every error before delivering.',
  inputSchema: {
    source: z
      .string()
      .min(1)
      .max(400_000)
      .describe('The full SKILL.md source, frontmatter included.'),
    skillName: z
      .string()
      .regex(LIMITS.skillDirNamePattern, 'Must be lowercase alphanumeric with single hyphens, for example react-component-authoring')
      .optional()
      .describe('The directory the skill will live in. Supply it to also check the name-matches-directory rule.'),
    strict: z
      .boolean()
      .optional()
      .describe('Treat warnings as failures, matching `validate-skill.mjs --strict`.'),
  },
  outputSchema: {
    passed: z.boolean().describe('True when the skill satisfies the contract under the chosen strictness.'),
    errorCount: z.number().describe('Number of errors.'),
    warningCount: z.number().describe('Number of warnings.'),
    findings: findingsArray.describe('All findings, errors first.'),
    bodyLineLimit: z.number().describe('The line budget the body was measured against.'),
  },
  annotations: READ_ONLY,
  handler: guard(({ source, skillName, strict }) => {
    const report = createReport(skillName ? `${skillName}/SKILL.md` : 'SKILL.md')

    // `validateSkillSource` derives the expected directory name from the parent
    // directory of `filePath`. Synthesising a path lets it run the same
    // name-matches-directory check it runs for a real file, with no temporary
    // file on disk and no duplicated rule.
    const filePath = skillName === undefined ? null : `${skillName}/SKILL.md`

    validateSkillSource(source, { filePath, report })

    const findings = findingsOf(report)
    const verdict = verdictOf(report, strict === true)

    const errors = findings.filter((finding) => finding.level === 'error')
    const summary = verdict.passed
      ? `Valid. ${verdict.warningCount} warning(s) to consider.`
      : `${errors.length} error(s) must be fixed: ${errors.map((finding) => finding.message).join('; ')}`

    return ok({ ...verdict, findings, bodyLineLimit: LIMITS.bodyMaxLines }, summary)
  }),
}
# SKILL.md output contract

Every generated skill uses the same 15 sections. 11 are always required. 4 are conditional.

Enforcement lives in `scripts/lib/skill-contract.mjs` and `scripts/validate-skill.mjs`. This document
explains what each section must contain and why; the validator only checks presence and duplication.

## Heading matching

Sections are level-2 (`##`) headings. Matching is case-insensitive and ignores punctuation, so
`## Testing/verification checklist`, `## Testing and Verification Checklist`, and
`## Verification checklist` all resolve to the same section.

Headings inside fenced code blocks are ignored, so a `# comment` line in an example is never mistaken
for a heading.

Extra level-2 headings are allowed but produce a warning. Use level-3 headings for internal structure.
A duplicated section is an error, not a warning: two `## Security considerations` headings means an
agent has to guess which one to follow.

## Required sections

| Section                        | Must contain                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------- |
| Name                           | The frontmatter `name`, verbatim.                                             |
| Description                    | One or two sentences matching the frontmatter `description`.                  |
| Purpose                        | The outcome, in one short paragraph.                                          |
| When to use                    | Concrete trigger conditions **and** an explicit "do not use when" boundary.  |
| Prerequisites                  | Tools, versions, knowledge. Write `None` rather than deleting the section.    |
| Core concepts                  | The vocabulary needed to follow the workflow correctly.                       |
| Step-by-step workflow          | Numbered, ordered, executable steps.                                          |
| Best practices                 | Production habits for this technology, including what to avoid.              |
| Common mistakes                | Concrete failure modes, each with the correct alternative.                   |
| Testing/verification checklist | Commands and observable checks that prove the work is correct.               |
| Final implementation checklist | The last pass before the work is called complete.                             |

## Conditional sections

Omit these when they do not apply. An empty heading is worse than no heading: it advertises coverage
the skill does not have. The validator reports an absent conditional section as a **warning**, not an
error, precisely because relevance is a judgement call.

| Section                           | Include when                                                             | Suppressed for            |
| --------------------------------- | ------------------------------------------------------------------------ | ------------------------- |
| Recommended project structure     | The skill produces files or modules that need a home.                     | `practice` kind topics    |
| Code examples                     | Runnable or illustrative code removes ambiguity the prose cannot.         | never                     |
| Security considerations           | User input, authentication, data handling, or rendering is in scope.       | never                     |
| Performance considerations        | A measurable performance concern exists for this technology.              | never                     |

`Recommended project structure` is suppressed for `practice` topics such as Accessibility or
Performance Optimization, because there is no project layout to recommend. Adding one anyway is a
signal that the skill has padded itself.

## Frontmatter

Only these keys are recognised by the Agent Skills specification:

| Key               | Required | Constraints                                            |
| ----------------- | -------- | ------------------------------------------------------ |
| `name`            | yes      | 1-64 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`, equals the directory name |
| `description`     | yes      | 1-1024 chars                                           |
| `license`         | no       | SPDX identifier or a proprietary note                   |
| `compatibility`   | no       | 1-500 chars                                            |
| `metadata`        | no       | Flat string-to-string map                              |
| `allowed-tools`   | no       | Space-separated string. Experimental.                  |

The bundled parser accepts this subset only and raises an error on anything else, including nested
maps, block scalars, and inline flow collections. That is deliberate: a mis-parsed `description`
produces a skill that loads with the wrong trigger conditions.

## Length

Keep the body under 500 lines. This is the specification's own recommendation for progressive
disclosure, not a stylistic preference. Past that point, agents pay for the whole body on every
activation.

Move material out when:

- A table has more than about eight rows and is only needed sometimes.
- A code sample is longer than the workflow step it supports.
- Reference material applies to one technology version or one sub-case.

Put it in `references/`, name it in one sentence from `SKILL.md`, and keep the reference one level
deep. Agents load references on demand, so a focused file costs nothing until it is needed.

## Validating

```bash
node scripts/validate-skill.mjs path/to/<skill-name>/SKILL.md
node scripts/validate-skill.mjs --strict path/to/<skill-name>/SKILL.md   # warnings fail
node scripts/validate-skill.mjs --list-sections                         # show the contract
```

| Result             | Meaning                                                     |
| ------------------ | ----------------------------------------------------------- |
| error              | The skill will not meet the contract. Fix before delivery.   |
| warning            | A judgement call. Add the section or confirm it does not apply. |
| info               | Resolved detail, for example a technology match.            |
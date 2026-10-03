---
name: <kebab-case-name>
description: <One sentence: what the skill does>. Use when <concrete trigger conditions and keywords>.
license: Proprietary
metadata:
  version: "1.0.0"
---

# <Skill Title>

<!--
Template for a generated SKILL.md.

Rules:
  - Delete every <!-- comment --> before delivering.
  - Replace every <placeholder>. Nothing ships with angle brackets in it.
  - Keep the 11 required sections. Drop a conditional section only when it does
    not apply, and say so in your report to the user.
  - Keep the body under 500 lines. Move overflow into references/.
  - Validate: node scripts/validate-skill.mjs <this-file>
-->

## Name

`<kebab-case-name>`

## Description

<One or two sentences matching the frontmatter description. What it does, then when to use it.>

## Purpose

<The outcome this skill produces, in one short paragraph. Not a summary of the whole document.>

## When to use

Use this skill when:

- <Concrete trigger condition, phrased the way a developer would ask.>
- <Second trigger.>

Do not use this skill when:

- <The adjacent task this skill should decline, so it does not activate wrongly.>

## Prerequisites

- <Tool, version, or knowledge required before step 1.>
- <Or: None.>

<!-- Assumptions belong here or in a short list directly below this section.
     Label anything you inferred instead of being told. Example:
     "Assumption: this project uses the App Router, not the Pages Router." -->

## Core concepts

- **<Term>**: <Definition, in one or two sentences.>
- **<Term>**: <Definition.>

## Step-by-step workflow

1. <First action, concrete enough to execute.>
2. <Second action.>
3. <Third action.>

## Best practices

- <Production habit specific to this technology.>
- <What to avoid, and what to do instead.>

## Common mistakes

- **<Mistake>**: <Why it is wrong.> Do <correct alternative> instead.

## Testing/verification checklist

- [ ] <Command or observable check that proves correctness.>
- [ ] <Second check.>

## Final implementation checklist

- [ ] <Last-pass item.>
- [ ] <Last-pass item.>

<!--
Conditional sections. Include only when they apply.

## Recommended project structure
   Only when the skill produces files or modules that need a home.

## Code examples
   Only when runnable or illustrative code clarifies the workflow. Keep snippets
   short enough to stay correct; do not include a long tutorial inline.

## Security considerations
   Only when user input, auth, data handling, or rendering is in scope.

## Performance considerations
   Only when a measurable performance concern exists. Always pair a claim with a
   measurement step.
-->
---
name: frontend-skill-builder
description: Create, improve, convert, and update production-ready SKILL.md files for frontend development technologies, including HTML, CSS, JavaScript, TypeScript, React, Next.js, Vue, Angular, Tailwind CSS, Bootstrap, Vite, ShadCN UI, Web APIs, Accessibility, Responsive Design, Frontend Testing, and Performance Optimization. Use when the user asks to write a skill, author or restructure a SKILL.md, turn rough developer notes or existing documentation into a reusable skill, refresh a skill that has drifted, or check whether a SKILL.md is valid.
license: Proprietary
compatibility: Requires Node.js 20 or newer to run the bundled validators. The instructions themselves work in any agent that reads SKILL.md.
metadata:
  version: "0.2.0"
  plugin: frontend-skill-builder
---

# Frontend Skill Builder

## Name

`frontend-skill-builder`

## Description

Create, improve, convert, and update production-ready `SKILL.md` files for frontend development
technologies. Use when the user asks to write a skill, author or restructure a `SKILL.md`, turn rough
developer notes or existing documentation into a reusable skill, refresh a skill that has drifted, or
check whether a `SKILL.md` is valid.

## Purpose

Produce a `SKILL.md` that a coding agent can follow without re-deriving the basics: a specific,
production-oriented procedure with an explicit boundary, verifiable steps, and a final checklist.

A finished skill is one directory containing `SKILL.md`, optionally with `references/`, `assets/`,
and `scripts/`. It follows the Agent Skills open specification, so the same file loads in Claude Code,
Codex, Gemini CLI, Qwen Code, OpenCode, and similar agents.

## When to use

Use this skill when the user wants to:

- Create a new skill for a frontend technology or topic.
- Improve an existing `SKILL.md` that is incomplete, stale, or badly structured.
- Convert rough developer instructions, notes, or a checklist into a structured `SKILL.md`.
- Create a skill from existing documentation, a README, or an internal guide.
- Update a skill after a framework version change, without rewriting unrelated sections.
- Validate a `SKILL.md` and report what is missing.

Do not use this skill when:

- The user wants application code written. Write the code instead.
- The target is not a frontend technology. The catalog in
  [references/technologies.md](references/technologies.md) is the boundary; ask before extending it.
- The user only wants a rename or a typo fix. Edit the file directly.

## Prerequisites

None for reading these instructions, and no install step for the workflow itself.

The MCP tools are optional. When they are available they replace the manual steps
below; when they are not, the bundled scripts do the same job:

- Node.js 20 or newer on `PATH`, to run `scripts/validate-skill.mjs` and the MCP
  server.
- The MCP SDK, installed once with `npm run setup`, only if the tools are wanted.

No package is needed to follow the method. The validators use only the Node.js
standard library.

## Core concepts

### The unit of work is a skill directory

```text
<skill-name>/
  SKILL.md          required: YAML frontmatter + Markdown instructions
  references/       optional: detail loaded only when needed
  assets/           optional: templates and files to copy
  scripts/          optional: deterministic validation or generation
```

The directory name must equal the frontmatter `name`. Agents use that name to namespace and load the
skill, so a mismatch makes the skill unloadable.

### Frontmatter is the API surface

Only these keys are recognised: `name`, `description`, `license`, `compatibility`, `metadata`, and the
experimental `allowed-tools`.

- `name`: 1-64 characters, lowercase letters, digits, and single hyphens.
- `description`: 1-1024 characters, and the only text loaded before activation. It must state what the
  skill does **and** when to use it, with concrete trigger keywords front-loaded.

Everything else lives in the body. Write the body for an agent that has general knowledge but no
project context.

### Skills load progressively

Agents load `name` and `description` for every installed skill, then load the full body only when the
skill activates. Keep `SKILL.md` under 500 lines and push long reference material into
`references/`. A skill that is always slightly wrong is worse than no skill, because it is always
partially loaded.

### The plugin has both instructions and tools

This file carries the judgement: scope, boundaries, tone, what counts as a real
verification step. The plugin also ships an MCP server carrying the deterministic
part: the technology catalog, the 15-section contract, the template, the
validator, and the improvement audit.

No tool writes skill content. `get_skill_template` fills in the identifier and
leaves the description and every body section as placeholders on purpose. Write
the prose yourself; a generated draft that validates but teaches nothing is worse
than an obvious blank, because it does not look wrong.

Full tool reference in [references/mcp-tools.md](references/mcp-tools.md). Every step below has a
CLI equivalent, so check which one you have before planning the work. If the tools are not
connected, use `scripts/validate-skill.mjs` for the same checks rather than describing the tool
calls you would have made.

### Structure is a contract, not a suggestion

Every generated skill contains the same 15 sections. 11 are always required. 4 are conditional and are
only included when they apply to the technology and topic. Full rules, accepted heading aliases, and
what each section must contain are in
[references/skill-contract.md](references/skill-contract.md).

Validate before delivering. The contract is machine-checkable, so there is no reason to eyeball it:

```bash
node scripts/validate-skill.mjs path/to/<skill-name>/SKILL.md
```

## Step-by-step workflow

### Phase 1 - Intake gate

Collect three inputs. Do not begin drafting until all three are known.

| Input           | Required | With tools                            | Without tools                                          |
| --------------- | -------- | ------------------------------------- | ------------------------------------------------------ |
| Technology      | yes      | `plan_skill`, or `resolve_technology` | `scripts/validate-skill.mjs --technology "<name>"`     |
| Topic           | yes      | Ask directly                          | Ask directly. Do not invent one from the technology name. |
| Difficulty      | yes      | `plan_skill`                          | `scripts/validate-skill.mjs --difficulty "<level>"`    |

Difficulty is one of `beginner`, `intermediate`, `advanced`. It changes the writing, not the section
list. See [references/difficulty-levels.md](references/difficulty-levels.md).

If the technology is not in the catalog, stop and ask. Do not map it to the nearest entry. Adding a
technology means editing `scripts/lib/technologies.mjs` and
[references/technologies.md](references/technologies.md), which is a deliberate change, not a
guess.

**Ask, do not assume.** These are the only three questions worth blocking on. Everything else can be
recorded as a stated assumption. A short clarifying question is cheaper than a skill built on a wrong
premise.

`plan_skill` returns the technology's `openQuestions`: the decisions that change the skill
materially. Ask them, or record each unanswered one as a labelled assumption. Either is fine.
Silently choosing one is not.

### Phase 2 - Choose the mode

| User intent                                | Mode         | Reference                                             |
| ------------------------------------------ | ------------ | ----------------------------------------------------- |
| "Make me a skill for X"                    | create       | [references/workflows.md](references/workflows.md)     |
| "Improve / fix this skill"                 | improve      | same                                                  |
| "Turn these notes into a skill"            | convert      | same                                                  |
| "Build a skill from our docs"              | from-docs    | same                                                  |
| "Update it for the new version"            | update       | same                                                  |

In every mode except `create`, read the existing `SKILL.md` completely before writing anything.
For `improve`, `convert`, and `update`, call `audit_skill` first and treat its `preserve` list as
off-limits. Those sections are already correct. Work only from its `rewrite` list.

### Phase 3 - Gather material

- For `from-docs`, read the source documentation and extract only what applies to this technology and
  topic. Ignore content about other tools.
- For `update`, identify exactly what changed. Version migrations, renamed APIs, and removed options
  are the usual triggers.
- For `improve`, list what is wrong before fixing it: missing sections, stale advice, invented APIs,
  unclear boundaries, or an unverifiable checklist. `audit_skill` reports the structural part of this;
  the judgement calls are yours.

Verify anything version-specific against official documentation. If it cannot be verified, leave it out
and record it as an open question.

### Phase 4 - Draft

1. Start from `get_skill_template`, or copy
   [assets/SKILL.template.md](assets/SKILL.template.md).
2. Fill the 11 required sections.
3. Add conditional sections only where they apply. A missing conditional section that does not apply is
   correct; a padded one is not.
4. Delete the template's HTML instruction comments.
5. Keep the body under 500 lines. Move long material to `references/`.
6. Write the frontmatter last so `description` reflects the finished body.
7. Replace every `<placeholder>`. `get_skill_template` returns the exact list; `audit_skill` reports any
   that survived.

Apply the writing rules in [references/quality-rules.md](references/quality-rules.md). The short
version: state assumptions, never invent APIs, add no dependency the user did not ask for, and prefer
modern practice only when you can say why.

### Phase 5 - Validate

With tools, call `validate_skill` with the finished source. Without them:

```bash
node scripts/validate-skill.mjs path/to/<skill-name>/SKILL.md
```

Fix every error. Warnings are judgement calls: either add the section or accept that it does not
apply. Use `--strict`, or `strict: true`, in CI to fail on warnings too.

### Phase 6 - Deliver

Report the skill path, the resolved technology and difficulty, which conditional sections you included
or deliberately omitted and why, and any assumption or open question the user should confirm.

## Recommended project structure

A generated skill directory:

```text
<skill-name>/
  SKILL.md
  references/     one focused document per topic, loaded on demand
  assets/         templates the agent copies
  scripts/        deterministic checks the agent runs
```

Keep every file reference one level deep from `SKILL.md`. Deep reference chains cost context and
break silently.

## Code examples

The starting point for any generated skill is
[assets/SKILL.template.md](assets/SKILL.template.md). Its frontmatter:

```markdown
---
name: <kebab-case-name>
description: <What it does>. Use when <concrete trigger conditions and keywords>.
license: Proprietary
metadata:
  version: "1.0.0"
---

# <Title>

## Purpose

...
```

The `description` is the only part every agent sees before activation. Front-load the literal words a
developer would type: "Use when building accessible React components", not "Helps with React".

## Best practices

- **One technology per skill.** If a request spans two, split it and link the skills from a hub.
- **Name the boundary.** Every skill needs a "do not use when" line, or it will activate on adjacent
  tasks and mislead.
- **Make the checklist executable.** "Run the test suite" beats "verify tests pass". Prefer commands
  the agent can actually run.
- **Prefer deleting advice to adding hedges.** A skill that says "it depends" without saying on what is
  not decision support.
- **Do not restate general knowledge.** The agent already knows what an array is. Spend the space on
  this technology's specifics.
- **Keep prerequisites honest.** Write "None" rather than omitting the section.
- **Explain the why once.** Reasoning that prevents a mistake is worth more than the rule itself.

## Common mistakes

- **Copying an API from memory.** Framework APIs change. Verify, or describe the behaviour and let the
  agent check the exact call.
- **Padding conditional sections.** An empty "Security considerations" heading signals a generated
  document, not a considered one.
- **Matching the technology name to the skill name.** `react` as a skill name is too broad to be
  useful. `react-component-authoring` tells an agent when to activate.
- **Rewriting the whole file during an update.** Preserve sections that are still correct and say what
  changed.
- **Silently narrowing scope.** If the request was ambiguous, ask once, then proceed.
- **Treating the technology as the topic.** "React" is a catalog entry, not a skill. The topic is the
  specific job, such as "writing accessible controlled form components".
- **Adding a stack the user did not ask for.** No state library because every React app has one. If it
  is genuinely needed, say why it is out of scope.

## Security considerations

- Never place credentials, tokens, internal hostnames, or customer data in a `SKILL.md`. Skills are
  distributed to many agents and are frequently committed to shared repositories.
- Instruct agents to read secrets from the environment or a secret manager, never from source.
- When a generated skill covers user input, rendering, or authentication, include the specific concerns
  for that stack rather than a generic warning: output encoding, CSRF, XSS sinks, and dependency
  provenance.
- If source documentation contains secrets, do not carry them into the skill.

## Performance considerations

- A skill that recommends a performance pattern without a measurement step teaches cargo cult
  optimisation. Require a before-and-after measurement.
- Do not recommend memoisation, caching, or code splitting by default. Name the condition that makes
  each one correct.
- In the generated skill, prefer the current default over a legacy optimisation. Most performance
  folklore in circulation is obsolete.

## Testing/verification checklist

Before delivering, confirm each of these:

1. The three inputs are known: technology, topic, difficulty.
2. The technology resolves against `scripts/lib/technologies.mjs`; no near-match substitution.
3. `validate_skill`, or `node scripts/validate-skill.mjs <path>`, reports zero errors.
4. All 11 required sections are present and non-empty.
5. The directory name equals the frontmatter `name`.
6. The body is under 500 lines.
7. The `description` states what the skill does and when to use it, with trigger keywords.
8. Every conditional section is either present with real content or deliberately omitted.
9. No invented APIs. Anything version-specific was verified or flagged.
10. No dependency, framework, or tool that the user did not request.
11. Every assumption is labelled as an assumption.
12. No `<placeholder>` survives from the template.
13. For `improve`, `convert`, `from-docs`, and `update`: unrelated existing content is preserved, and
    every section on the `audit_skill` preserve-list is untouched.

## Final implementation checklist

- [ ] Directory created with a name matching the frontmatter `name`
- [ ] `SKILL.md` written from the template
- [ ] 11 required sections filled with topic-specific content
- [ ] Conditional sections included only where relevant
- [ ] Assumptions collected into an explicit list
- [ ] `references/` used for anything that pushed the body toward 500 lines
- [ ] `validate_skill`, or `node scripts/validate-skill.mjs <path>`, passes
- [ ] Skill reported to the user with omissions and open questions stated
# Workflows

Five modes. Four of them start by reading an existing file, which is the main thing that separates
them from `create`.

Every mode ends the same way: run `scripts/validate-skill.mjs`, then report the path, the resolved
technology and difficulty, which conditional sections were included or omitted, and every assumption
and open question.

## Shared preflight

1. Resolve the technology. An unsupported name is a blocker, not something to map to the nearest
   entry.
2. Resolve the difficulty.
3. Establish the topic in one sentence. If the user's request is broad ("a React skill"), ask which
   specific job before drafting.
4. Confirm the target directory. Never overwrite an existing skill without reading it first.

---

## create

No existing file.

1. Resolve technology, topic, and difficulty.
2. Copy `assets/SKILL.template.md` to `<skill-name>/SKILL.md`.
3. Derive a `name` that is specific rather than a technology label. `react-component-authoring`, not
   `react`.
4. Fill the 11 required sections with topic-specific content.
5. Add conditional sections that apply. Omit the rest.
6. Write the frontmatter last, so `description` matches the finished body.
7. Validate.

---

## improve

An existing `SKILL.md` that needs work.

1. Read the whole file.
2. List the concrete problems before fixing any of them. Typical findings: missing required sections,
   stale or unverifiable advice, no "do not use when" boundary, a checklist nothing can execute, an
   over-broad `name`, a description that lacks trigger keywords.
3. Report the findings to the user before rewriting. Improvement that silently changes direction is
   indistinguishable from a rewrite.
4. Fix them. Preserve every section that is already correct.
5. Validate.

Keep the original `name` unless it is genuinely unusable, and say so explicitly if you change it: it
is the skill's identity for every agent that has installed it.

---

## convert

Rough developer instructions, notes, or a checklist that were never a skill.

1. Read the source material completely.
2. Separate content that belongs in this skill from content that does not. A page of notes usually
   covers several topics; take the one that matches the requested topic.
3. Identify what is missing rather than inventing it. A note that says "use the app router" does not
   tell you which files to create. That is an open question, not a gap to fill with a guess.
4. Structure what survived into the required sections. Most raw notes map to `Prerequisites`,
   `Core concepts`, and `Step-by-step workflow`.
5. Preserve the author's own wording for anything specific to their setup. It is evidence.
6. Validate, and report every open question.

---

## from-docs

Existing documentation, a README, or an internal guide.

1. Read the source. For a large document, read the sections that match the technology and topic first,
   then check whether anything else in it contradicts them.
2. Extract only what applies. Content about other tools in the same document is noise; if the user
   wanted it, they would have asked for a second skill.
3. Convert prose into procedure. Documentation describes what a thing is; a skill describes what to
   do. This conversion is the main work.
4. Strip anything sensitive. Documentation routinely contains internal hostnames, tokens, and customer
   examples. None of it belongs in a skill.
5. Prefer the documentation's own examples over invented ones. They are already correct.
6. Where the documentation and current upstream docs disagree, prefer upstream and report the
   discrepancy.
7. Validate, and list what was deliberately left out of the source.

---

## update

An existing `SKILL.md` that is correct but out of date. Triggered by a version change, a renamed API,
a removed option, or a new team convention.

This is the mode where restraint matters most.

1. Read the whole file.
2. Identify precisely what changed. Name it before writing: "React 19 removed `ReactDOM.render`", "the
   config file moved", "the default export is now named".
3. Change only the affected content. Everything else stays.
4. Update dependent content in the same pass: a workflow step that referenced the old behaviour, a
   common mistake that is no longer a mistake, a checklist item that tests the old path.
5. Do not restructure while updating. A version bump and a rewrite in one change makes the diff
   unreadable and the review impossible.
6. Re-verify everything you kept that was version-dependent, since it may have moved too.
7. Validate.
8. Report: what changed, what was re-verified, and what you deliberately left alone.

---

## Mode selection

| The user says                              | Mode      |
| ------------------------------------------ | --------- |
| "make me a skill for X"                    | `create`  |
| "this skill is incomplete / bad / stale"   | `improve` |
| "turn these notes into a skill"            | `convert` |
| "build a skill from our docs"              | `from-docs` |
| "update it for vN"                         | `update`  |
| "make it advanced"                         | `update` with a difficulty change |

When the intent is genuinely ambiguous, ask which mode before drafting. Rewriting a file the user
wanted preserved is the expensive mistake here, and it is not recoverable from a diff.
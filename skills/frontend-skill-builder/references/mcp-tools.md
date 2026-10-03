# MCP tools

The plugin ships an MCP server that exposes the deterministic parts of this
workflow as tools. It is bundled and local: `mcp.json` declares a stdio server, so
there is no deployment, no endpoint, and nothing listening on a port.

## Why there are tools at all

The split is deliberate.

**Judgement goes in this file.** Choosing a scope, writing an accurate "do not
use when" boundary, deciding what a real verification step looks like, noticing
that an example is subtly wrong. None of that is deterministic, and none of it
should be hidden behind a tool call.

**Determinism goes in the tools.** Which technologies exist, what the 15 sections
are, what the template looks like, whether a draft satisfies the contract, and
which parts of an existing draft are already correct. These have right answers,
and a tool gets them right the same way every time.

So no tool writes skill content. `get_skill_template` hands you a skeleton with
the identifier filled in and deliberately leaves the description and every body
section as placeholders. A tool that generated plausible prose would produce a
document that passes validation and teaches nothing, which is worse than an
obvious blank because it does not look wrong.

## The tools

| Tool | Call it when | Returns |
| ---- | ------------ | ------- |
| `plan_skill` | Always, first, for create/convert/from-docs/improve | Resolved technology and difficulty, the section plan, open questions, constraints, and the next tool to call |
| `resolve_technology` | You want to check a name without building a full plan | The catalog entry, or a structured rejection with suggestions |
| `list_technologies` | You need to show or choose from the catalog | All 17 entries with kind, aliases, notes, and questions |
| `list_sections` | Before drafting, or when checking a draft | The 15 sections with canonical headings, aliases, and intent |
| `get_skill_template` | At the start of drafting | The template with the identifier filled, the exact placeholder list, and a decision per conditional section |
| `validate_skill` | Before showing the user anything, and again after edits | Findings split into errors and warnings, plus a pass/fail verdict |
| `audit_skill` | For improve, convert, and update, before editing | What is wrong, what to rewrite, and a **preserve-list** of what is already correct |

## The two that carry the method

### `plan_skill` is the intake gate

Call it before writing anything. It refuses to proceed on a bad input rather than
guessing, which is the whole point of the "ask, do not assume" rule.

It returns `openQuestions`: the decisions that change the skill materially and
that you cannot infer. Ask them, or record each unanswered one as a labelled
assumption in the draft. Both are acceptable. Silently picking one is not.

Its `constraints` array is the writing brief. For a cross-cutting practice topic
it includes a line forbidding you from introducing a library or build tool,
because that is the most common way a practice skill goes wrong.

### `audit_skill` is how you avoid a rewrite

The default failure mode when improving a skill is to regenerate it. That throws
away correct content and produces churn the user did not ask for.

`audit_skill` returns a `preserve` list. Those sections are present, substantial,
and free of contract violations. **Leave them alone.** Work only from `rewrite`,
which lists what is missing, too thin, or still holds template text.

It also returns `templateLeftovers`, matched against the real template tokens
rather than a generic `<...>` scan. That is deliberate: a naive scan flags
`Array<T>` and `<Wrapper>` in correct TypeScript and JSX, and a finding that cries
wolf gets ignored.

## Tool or script?

Both paths work and produce identical results. A test asserts the MCP verdict
matches the CLI verdict for every bundled example, so they cannot drift.

| Situation | Use |
| --------- | --- |
| ChatGPT, Codex, or any MCP host | The tools |
| A host without MCP, or the SDK not installed | `scripts/validate-skill.mjs` |
| CI | `npm run check` |

The scripts are the reference implementation. When the two appear to disagree,
the script is right.

## Two failure modes, handled differently

A **rejected request** comes back as a normal result with `ok: false`: an
unsupported technology, a blank name, an invalid difficulty. That is not a tool
failure. It means your input was wrong, and the fix is to ask the user a
clarifying question. Do not retry with a near-match name.

An **unexpected fault** comes back with `isError: true`: a missing bundled asset,
a filesystem problem. That is a plugin bug. Report it with the tool name and the
arguments rather than working around it.

## Checking the server

```bash
npm run setup          # once, installs the MCP SDK into mcp/
npm run validate:mcp   # handshake plus every tool, valid and invalid input
```

`validate:mcp` spawns the real server over stdio and drives it with a real MCP
client, so it catches handshake failures and output-schema violations that
calling the handlers directly cannot. It is part of `npm run check`.
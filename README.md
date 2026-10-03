# Frontend Skill Builder

A private ChatGPT plugin that authors production-ready `SKILL.md` files for frontend
development technologies, with a local MCP server that exposes the output contract as tools.

Give it a technology, a topic, and a difficulty. It produces a structured, practical skill that an
AI coding agent can follow without re-deriving the basics, and validates the result against a
machine-checked contract before handing it over.

## What it does

1. You pick a frontend technology.
2. You say what skill or topic you want.
3. You pick a difficulty: Beginner, Intermediate, or Advanced.
4. The plugin generates a complete, reusable `SKILL.md`.
5. The plugin validates the output against a machine-checked contract.

It also improves an existing skill, converts rough developer notes into a structured skill, builds a
skill from your documentation, and updates a skill without rewriting sections that are still correct.

## Architecture: instructions and tools, deliberately split

This is the central design decision, so it is worth stating plainly.

**Judgement lives in `SKILL.md`.** Choosing a scope, writing an accurate "do not use when" boundary,
deciding what a real verification step looks like, noticing that an example is subtly wrong.

**Determinism lives in the MCP server.** Which technologies exist, what the 15 sections are, what the
template looks like, whether a draft satisfies the contract, and which parts of an existing draft are
already correct.

No tool writes skill content. `get_skill_template` fills in the identifier and deliberately leaves the
description and every body section as placeholders. A tool that generated plausible prose would
produce a document that passes validation and teaches nothing, which is worse than an obvious blank
because it does not look wrong.

```
ChatGPT / Codex / Claude Code / OpenCode
   │
   ├── skills/frontend-skill-builder/SKILL.md ──► judgement: scope, wording, examples
   │
   └── mcp.json (stdio, local) ──► mcp/src/server.mjs ──► skills/.../scripts/lib/*.mjs
                                     7 read-only tools        the tested, dependency-free core
```

The tools are thin adapters over the same core the CLI scripts use. A test asserts the MCP verdict
matches the CLI verdict for every bundled example, so the two cannot drift.

## Requirements

- Node.js 20 or newer on `PATH`.
- For the MCP tools only: one `npm run setup` to install the SDK into `mcp/`.

The skill itself needs nothing. The validators use only the Node.js standard library, so
`skills/frontend-skill-builder/` remains a portable, dependency-free Agent Skill.

## Setup

```bash
npm run setup   # once: installs @modelcontextprotocol/sdk and zod into mcp/
npm run check   # validates the manifests, the contract, the MCP server, and 119 tests
```

`npm run setup` is only needed for the tools. Without it the skill, the CLI validators, and the
bundled examples all still work; `npm run validate` warns that the MCP server cannot start rather
than failing, and the MCP tests skip.

## Layout

The repository root is simultaneously the **plugin root** and the **marketplace root**, which is where
hosts expect their default component locations.

```text
.
├── plugin.json                       portable Agent Plugins 1.0.0 manifest
├── mcp.json                          bundled stdio MCP server
├── .claude-plugin/
│   ├── plugin.json                   Claude Code manifest
│   └── marketplace.json              Claude Code local marketplace
├── .agents/plugins/marketplace.json  ChatGPT / Codex repo marketplace
├── opencode.json                     points OpenCode at ./skills
├── package.json                      dev scripts only, no dependencies
│
├── skills/frontend-skill-builder/
│   ├── SKILL.md                      the primary skill
│   ├── references/
│   │   ├── skill-contract.md         the 15 sections and what each must contain
│   │   ├── technologies.md           the supported technology catalog
│   │   ├── difficulty-levels.md      how difficulty changes the writing
│   │   ├── quality-rules.md          ask-don't-guess, no invented APIs, no extra deps
│   │   ├── workflows.md              create / improve / convert / from-docs / update
│   │   └── mcp-tools.md              the tool reference and when to use it
│   ├── assets/SKILL.template.md      copy-paste starting point
│   └── scripts/
│       ├── validate-skill.mjs        validate a SKILL.md or the workflow inputs
│       ├── validate-plugin.mjs       validate the manifests, skills, and mcp.json
│       └── lib/
│           ├── frontmatter.mjs       strict YAML frontmatter reader
│           ├── technologies.mjs      technology catalog and name resolution
│           ├── skill-contract.mjs    sections, difficulty levels, heading matching
│           └── report.mjs            findings collection and exit codes
│
├── mcp/                              the MCP server; the only place with dependencies
│   ├── package.json
│   ├── scripts/inspect-tools.mjs     spawns the real server and drives it with a real client
│   └── src/
│       ├── server.mjs                stdio by default, optional streamable HTTP
│       ├── core.mjs                  the one place that knows where the core lives
│       ├── toolkit.mjs               shared result shaping, zod schemas, annotations
│       └── tools/                    catalog, contract, plan, validate, audit
│
├── examples/                         four complete generated skills
│   ├── react-component-authoring/
│   ├── nextjs-app-router-data-fetching/
│   ├── typescript-strict-data-modeling/
│   └── tailwind-responsive-layout/
│
└── tests/                            119 node:test cases, no dependencies
    ├── *.test.mjs                    core: frontmatter, contract, technologies, validator, examples
    └── mcp/tools.test.mjs            MCP tools, self-skipping when the SDK is absent
```

## Installing

### ChatGPT and Codex

The repo marketplace at `.agents/plugins/marketplace.json` is a local marketplace source, so nothing
is published and nothing leaves your machine.

```bash
codex plugin marketplace add ./local-marketplace-root
```

Or register it in the ChatGPT desktop app: enable developer mode under **Settings → Security and
login**, then add the plugin from your local source in the Plugins Directory.

ChatGPT installs local plugins into `~/.codex/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION/` and loads
the **installed copy**, not your source directory. After changing any plugin file, reinstall from the
local source or restart the desktop app, or you will be testing a stale copy.

Because the MCP server is bundled through `mcp.json` as a local stdio server, you do **not** need to
register it in developer mode or obtain a `plugin_asdk_app…` identifier. That step is only for remote
MCP servers.

### Claude Code

```bash
claude plugin marketplace add .
claude plugin install frontend-skill-builder@frontend-skill-builder-local
claude plugin validate .
```

### OpenCode

Already wired up. `opencode.json` sets `skills.paths` to `./skills`, so restarting OpenCode in this
directory is enough.

### Gemini CLI and Qwen Code

These read skills from `.agents/skills/`, which is not where this plugin keeps them. Install from the
local directory:

```bash
gemini skills install ./skills/frontend-skill-builder
```

### Anywhere else

The skill is portable on its own. Copy `skills/frontend-skill-builder/` to any location those tools
scan and it works with no plugin packaging:

| Tool         | Location                                    |
| ------------ | ------------------------------------------- |
| Claude Code  | `.claude/skills/frontend-skill-builder/`   |
| Codex        | `.agents/skills/frontend-skill-builder/`   |
| Gemini CLI   | `.agents/skills/frontend-skill-builder/`   |
| Qwen Code    | `.agents/skills/frontend-skill-builder/`   |
| OpenCode     | `.opencode/skills/frontend-skill-builder/` |

## Usage

Once installed, ask in plain language:

> Create a beginner skill for building accessible React controlled form components.

> Create an advanced Next.js App Router skill.

> Turn these rough notes about TypeScript generics into a structured SKILL.md.

> Improve my existing SKILL.md for Next.js App Router. Don't rewrite sections that are still correct.

> Build a skill from our frontend README. Ignore the backend sections.

> Validate this SKILL.md and tell me what's missing.

The plugin resolves the technology and difficulty, asks about anything it cannot infer, and states its
assumptions rather than guessing.

## The tools

| Tool | Purpose |
| ---- | ------- |
| `plan_skill` | Always first. Resolves technology and difficulty, plans the sections, returns the open questions and constraints, and names the next tool to call. |
| `resolve_technology` | Check one name against the catalog. Case- and punctuation-insensitive. |
| `list_technologies` | The whole catalog with kind, aliases, notes, and intake questions. |
| `list_sections` | The 15 sections with canonical headings, aliases, and intent. |
| `get_skill_template` | The template with the identifier filled, the exact placeholder list, and a decision per conditional section. |
| `validate_skill` | Contract findings as data, plus a pass/fail verdict. Honours strict mode. |
| `audit_skill` | For improve mode: what is wrong, what to rewrite, and a **preserve-list** of what is already correct. |

Two failure modes are handled differently on purpose. A **rejected request** (unsupported technology,
blank name, invalid difficulty) comes back as `ok: false` with suggestions, because the fix is to ask
the user a clarifying question. An **unexpected fault** comes back with `isError: true`, because that
is a plugin bug worth reporting.

## Commands

Run from the repository root.

```bash
npm run setup            # once: install the MCP SDK into mcp/
npm run validate         # manifests, skill discovery, mcp.json, cross-manifest consistency
npm run validate:examples# every examples/*/SKILL.md against the output contract
npm run validate:mcp     # real stdio handshake, then every tool with valid and invalid input
npm test                 # 119 tests, node:test, no dependencies
npm run check            # all four
npm run mcp:start        # run the MCP server on stdio for an external client
```

Validate a single skill:

```bash
node skills/frontend-skill-builder/scripts/validate-skill.mjs path/to/my-skill/SKILL.md
node skills/frontend-skill-builder/scripts/validate-skill.mjs --strict path/to/my-skill/SKILL.md
```

Validate the workflow inputs, including technology name resolution:

```bash
node skills/frontend-skill-builder/scripts/validate-skill.mjs --technology "Next.js" --difficulty advanced
node skills/frontend-skill-builder/scripts/validate-skill.mjs --list-technologies
node skills/frontend-skill-builder/scripts/validate-skill.mjs --list-sections
```

Add `--json` for machine-readable findings. Exit codes: `0` pass, `1` failure, `2` usage error.

Inspect the server interactively with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

Choose **stdio**, command `node`, arguments `D:\CODING\1-chat\mcp\src\server.mjs`.

## The output contract

Every generated skill has the same 15 sections. 11 are required; 4 are conditional and included only
when they apply. Section rules live in
[`references/skill-contract.md`](skills/frontend-skill-builder/references/skill-contract.md).

| Required                                                       | Conditional                             |
| -------------------------------------------------------------- | --------------------------------------- |
| Name, Description, Purpose, When to use, Prerequisites,        | Recommended project structure            |
| Core concepts, Step-by-step workflow, Best practices,           | Code examples                            |
| Common mistakes, Testing/verification checklist,                | Security considerations                  |
| Final implementation checklist                                   | Performance considerations               |

A missing required section is an error. A missing conditional section is a warning, because whether it
applies is a judgement call. `--strict` promotes warnings to failures for CI.

Frontmatter follows the Agent Skills specification: `name` (must equal the containing directory
name), `description`, and optionally `license`, `compatibility`, `metadata`, and `allowed-tools`.

## Supported technologies

HTML, CSS, JavaScript, TypeScript, React, Next.js, Vue, Angular, Tailwind CSS, Bootstrap, Vite,
ShadCN UI, Web APIs, Accessibility, Responsive Design, Frontend Testing, Performance Optimization.

Names resolve case-insensitively and ignore punctuation, so `Next.js`, `nextjs`, and `NextJS` all work.
Aliases are listed in
[`references/technologies.md`](skills/frontend-skill-builder/references/technologies.md).

An unsupported name is rejected with suggestions rather than mapped to the nearest entry. A request
naming two technologies is rejected too, because one skill covers one technology.

Each entry carries `notes`, the mistake a writer is most likely to make, and `questions`, the intake
questions that change the output. `plan_skill` returns both.

### Adding a technology

1. Append an entry to `TECHNOLOGIES` in
   [`scripts/lib/technologies.mjs`](skills/frontend-skill-builder/scripts/lib/technologies.mjs) with
   `id`, `label`, `kind`, `aliases`, `notes`, and `questions`.
2. Add a row to both tables in
   [`references/technologies.md`](skills/frontend-skill-builder/references/technologies.md).
3. Run `npm test`.

Nothing else needs to change. `plan_skill` and `list_technologies` read the same catalog, so the tool
surface updates with no code change. The catalog stays the single source of truth for validation, the
tool schemas, and the reference documentation, so they cannot drift apart.

`kind` is one of `language`, `framework`, `library`, `component-library`, `styling`, `build-tool`, or
`practice`. A `practice` entry is a cross-cutting concern; `plan_skill` then forbids the skill from
introducing a library or build tool the user did not ask for, and omits the project-structure section
by default.

### Adding a tool

1. Add a module under `mcp/src/tools/` exporting `{ name, title, description, inputSchema,
   outputSchema, annotations, handler }`.
2. Wrap the handler with `guard()` from `toolkit.mjs` so an unexpected exception becomes an
   actionable tool error.
3. Register it in the `TOOLS` array in `mcp/src/server.mjs`.
4. Add a case to `mcp/scripts/inspect-tools.mjs` and tests to `tests/mcp/tools.test.mjs`.

Every field in the `outputSchema` that is not `.optional()` must be present on **every** return path,
including rejections. The SDK validates structured results against that schema, and a rejection path
that omits a required field surfaces to the model as an opaque tool error instead of the guidance you
intended.

## Validation

| Command | What it proves |
| ------- | -------------- |
| `npm run validate` | Manifests match the published schemas, `mcp.json` is well formed and its paths exist, skill discovery works, names agree across manifests |
| `npm run validate:examples` | Every bundled example satisfies the output contract |
| `npm run validate:mcp` | The server completes a real handshake and every tool behaves with valid and invalid input |
| `npm test` | 119 unit tests across the core and the tools |

`validate:mcp` is not redundant with the unit tests. It catches protocol-level faults that calling a
handler directly cannot: a tool the SDK refuses to register, a structured result that fails its own
declared output schema, and a missing description or input schema that would leave the model unable
to choose the tool correctly.

## Design notes

**Errors versus warnings.** Presence of a required section is machine-checkable, so it is an error.
Relevance of a conditional section is not, so it is a warning.

**Placeholder detection reads the real template.** `audit_skill` matches the exact placeholder tokens
from `assets/SKILL.template.md` rather than scanning for `<...>`. A generic scan flags `Array<T>` and
`<Wrapper>` in correct TypeScript and JSX, and a finding that cries wolf gets ignored.

**The name section is exempt from the thin-content check.** The specification caps `name` at 64
characters, below the thin threshold. Without the exemption every valid skill reports its own name
section as needing a rewrite.

**No deprecated-API list.** `audit_skill` reports the version references and untagged code blocks it
actually found so they can be verified, rather than embedding a list of stale API names. A list like
that goes out of date, and a stale list is worse than none.

**Strict frontmatter parsing.** The parser accepts the documented subset and raises an error on
anything else, including nested maps, block scalars, and inline flow collections. A mis-parsed
`description` produces a skill that loads with the wrong trigger conditions and still looks fine.

**Two transports, one tool set.** stdio is the default and what `mcp.json` declares. Streamable HTTP
is available behind `FRONTEND_SKILL_BUILDER_HTTP=1` for a future hosted endpoint, and is kept out of
the default path so a local install has no listening socket.

## Specifications

Built against the current published specifications rather than the older formats:

- Agent Plugins manifest and MCP config:
  [`plugin.schema.json`](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json) and
  [`mcp.schema.json`](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json)
- Skills: [agentskills.io specification](https://agentskills.io/specification)
- ChatGPT and Codex packaging, marketplaces, and local install:
  [Package your plugin](https://developers.openai.com/plugins/build/plugins)
- MCP servers: [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- Claude Code manifests and marketplaces:
  [Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference) and
  [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference)
- OpenCode skills and config: [Agent Skills](https://opencode.ai/docs/skills)
- Gemini CLI and Qwen Code skills: [Agent Skills](https://geminicli.com/docs/cli/skills)

The legacy ChatGPT plugin format (`/.well-known/ai-plugin.json` plus `openapi.yaml`) is deprecated.
OpenAI retired custom GPTs in favour of MCP-based plugins, which is the format used here.

## Before you publish or share this

It is a private plugin, but three placeholder values need real ones if you submit it anywhere:

- `author.name` and `author.email` in `plugin.json` and `.claude-plugin/plugin.json`, plus `owner` in
  `.claude-plugin/marketplace.json`.
- `category` in `.agents/plugins/marketplace.json` and in `extensions.com.openai.interface`. Both are
  set to `"Productivity"`, the value used in the official documentation examples. Replace it with
  whatever your directory taxonomy uses.

`license` is `UNLICENSED` and the skill declares `license: Proprietary`, matching a private internal
plugin. Change both if that is wrong.

Publishing publicly additionally requires a stable, publicly reachable HTTPS MCP endpoint. A local
stdio server is enough for private use and is not enough for public submission.

## Troubleshooting

| Symptom | Cause and fix |
| ------- | ------------- |
| Plugin does not appear in the host | Restart the host. Plugin and skill files are loaded at startup, not hot-reloaded. |
| ChatGPT shows an old version after editing | ChatGPT loads an installed copy from `~/.codex/plugins/cache/`. Reinstall from the local source. |
| MCP tools are missing but the skill works | `npm run setup` was not run, or `node` is not on the host's PATH. `npm run validate` warns about this. |
| MCP server fails to start | Run `npm run validate:mcp` for the exact error. It spawns the real server and reports the failure. |
| A tool returns an opaque error on a rejected input | A return path is missing a field declared non-optional in its `outputSchema`. See "Adding a tool". |
| `frontmatter name ... must match the containing directory name` | Rename the directory to match `name`, or change `name`. |
| `conditional section ... not present` | A warning, not a failure. Add the section or confirm it does not apply. |
| OpenCode does not see the skill | `opencode.json` must keep `skills.paths: ["./skills"]`. |
| `unsupported technology` with no suggestions | The name is genuinely not in the catalog. Add it rather than mapping to a near match. |
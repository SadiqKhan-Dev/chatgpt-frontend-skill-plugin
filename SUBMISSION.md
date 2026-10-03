# Submitting to the ChatGPT plugin directory

The repository is submission-ready except for the rows marked **you**. Everything in the
"Automated" column is checked by `npm run package`, which refuses to write an archive when a
published limit is exceeded.

```bash
npm run setup     # once, installs the MCP server's one dependency
npm run check     # manifests, examples, MCP handshake, 120 tests
npm run package   # dist/frontend-skill-builder-0.2.0.zip
```

Upload `dist/frontend-skill-builder-0.2.0.zip` at <https://platform.openai.com/plugins> using
**Upload new or existing plugin**.

## Why the archive is skills-only

A public listing must reach its MCP server over public HTTPS. The portal does not accept a bundled
`stdio` server, so `mcp.json` and `mcp/` are excluded from the ZIP and stay in the repository for
local installs. `SKILL.md` already documents a CLI path for every tool, so the plugin is fully
functional without them.

If you later want the seven tools in the directory listing, deploy `mcp/src/server.mjs` to a public
HTTPS host, switch `mcp.json` to `"type": "streamable-http"`, and expect a heavier review: five
positive and three negative test cases, a demo recording, reviewer credentials, and explicit
`readOnlyHint` / `destructiveHint` / `openWorldHint` annotations on all seven tools.

## Status

| Requirement | Limit | Value | Status |
| --- | --- | --- | --- |
| `displayName` | 30 chars, single line | `Frontend Skill Builder` (22) | Automated |
| `shortDescription` | 30 chars, single line | `Write frontend SKILL.md files` (29) | Automated |
| `longDescription` | 4000 chars | 628 | Automated |
| `developerName` | 80 chars | `SadiqKhan-Dev` | Automated |
| `category` | published enum | `Developer Tools` | Automated |
| `capabilities` | 20 entries, 120 chars each | `Read`, `Write` | Automated |
| `defaultPrompt` | 3 prompts, 128 chars each | 3 prompts, longest 85 | Automated |
| `brandColor` | `#RRGGBB`, 2:1 vs white | `#0B6E55` at 6.22:1 | Automated |
| `brandColorDark` | `#RRGGBB`, 2:1 vs `#212121` | `#10A37F` at 5.04:1 | Automated |
| `logo` / `composerIcon` | square, 48-4096px, 5 MiB | `assets/icon.png`, 512x512, 8.1 KiB | Automated |
| `version` | semver | `0.2.0` | Automated |
| `description` | required, 1024 chars | 117 | Automated |
| `author.name` / `author.email` | required, no placeholders | `SadiqKhan-Dev`, `saiqkhan7777@gmail.com` | Automated |
| Skill description | 1024 chars | 539 | Automated |
| `plugin-name:skill-name` | 64 chars | 45 | Automated |
| Archive | 100 MB, 5000 entries, 20 deep | 61 KiB, 19 entries | Automated |
| Verified developer identity | required at review | - | **you** |
| `websiteURL` | HTTPS | set to the repository URL | Automated |
| `privacyPolicyURL` | HTTPS, published | absent on purpose | **you** |
| `termsOfServiceURL` | HTTPS, published | absent on purpose | **you** |
| `supportURL` | HTTPS, monitored | absent on purpose | **you** |
| Publishing | explicit, not automatic | - | **you** |
| Security scan | up to 2 hours | - | **you** |

## The four things left

1. **Verified developer identity.** Pick a verified individual or business identity in the portal.
   OpenAI overwrites `developerName` from it regardless of what the archive says, and review rejects
   a listing that does not match the identity's name, website, and contact details. Use the same
   name here as on the identity.

2. **Three policy pages, on a real HTTPS host.** All three must be reachable without a login, and
   the privacy policy must state the categories of personal data collected, the purposes, the
   categories of recipients, the retention timelines, and the controls a user has. This plugin
   collects nothing and sends nothing anywhere: it reads and writes files in the user's workspace
   and makes no network request, so the policy can say exactly that. Publish them wherever you host
   static pages, then add all three to `extensions.com.openai.interface` in `plugin.json` and
   re-run `npm run package`.

3. **Permission.** The submitting identity needs an org role with `api.apps.write`, shown as **Apps
   Management: Write**. Pick the right org and project in the portal before uploading.

4. **Publish yourself.** Validation passing is not publication. Review runs asynchronously, and you
   publish from the portal when it clears.

## Descriptions are checked by a human

OpenAI's guidelines reject copy that compares the plugin with other products, disparages
alternatives, makes unverifiable claims, or advertises pricing and promotions. The manifest text is
written to describe behaviour only:

- No competitor names, no "better than", no "instead of".
- No claim about output quality that cannot be checked. The validator's guarantees are stated as
  what the script checks, not as a claim about the prose.
- `Frontend Skill Builder` names the job rather than the format, and does not append "MCP" or
  "Plugin" to a product name, both of which the guidelines call out.

If you rewrite `longDescription`, keep it to what the plugin does.

## Not required

- **Open source.** `license` is optional in the manifest schema and no published rule requires
  public source. `UNLICENSED` is a valid choice.
- **`agents/openai.yaml`.** Optional per-skill interface metadata. The manifest `interface` block
  already carries the listing text.
- **`screenshots`.** Only needed when a starter prompt opens a UI, which this plugin does not.
- **`hooks` and `.app.json`.** Not submittable in a ZIP.
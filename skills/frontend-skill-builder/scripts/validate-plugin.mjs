#!/usr/bin/env node
/**
 * Validate this plugin package without contacting a host application.
 *
 * Usage:
 *   node validate-plugin.mjs [path/to/plugin] [--strict] [--json]
 *
 * Checks performed:
 *   1. Root plugin.json against the Agent Plugins 1.0.0 manifest schema.
 *   2. .claude-plugin/plugin.json (Claude Code manifest rules and path rules).
 *   3. .claude-plugin/marketplace.json (marketplace + plugin entry rules).
 *   4. .agents/plugins/marketplace.json (Codex local marketplace rules).
 *   5. Skill discovery from the default skills/ location, delegating each
 *      SKILL.md to the output contract in validate-skill.mjs.
 *   6. Cross-manifest consistency of the plugin name and version.
 *   7. That relative files referenced from a SKILL.md actually exist.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createReport, printReports, fail } from './lib/report.mjs'
import { validateSkillFile } from './validate-skill.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '..', '..', '..')

const AGENT_PLUGINS_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
const AGENT_PLUGINS_NAME_PATTERN = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/
const MANIFEST_ALLOWED_KEYS = [
  '$schema',
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'extensions',
]
const AUTHOR_ALLOWED_KEYS = ['name', 'email', 'url']

const CLAUDE_RESERVED_PLUGIN_NAMES = new Set([
  'claude',
  'anthropic',
  'anthropics',
  'claude-code',
  'claude-mods',
])
const CLAUDE_RESERVED_PLUGIN_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-']

const CLAUDE_RESERVED_MARKETPLACES = new Set([
  'claude-code-marketplace',
  'claude-code-plugins',
  'claude-plugins-official',
  'anthropic-marketplace',
  'anthropic-plugins',
  'agent-skills',
  'anthropic-agent-skills',
  'life-sciences',
  'knowledge-work-plugins',
  'claude-for-legal',
  'claude-for-financial-services',
  'financial-services-plugins',
  'first-party-plugins',
  'claude-tag-plugins',
  'claude-community',
  'claude-plugins-community',
  'healthcare',
  'anthropic-plugin-directory',
  'claude-plugin-directory',
  'inline',
  'builtin',
  'skills-dir',
  'synced',
  'claude-plugin-test',
  'npm',
  'pip',
  'uv',
  'cargo',
  'github',
  'gh',
])

const MARKETPLACE_ENTRY_REQUIRED = ['name', 'source']
const CODEX_ENTRY_REQUIRED = ['name', 'source', 'policy', 'category']
const CODEX_POLICY_REQUIRED = ['installation', 'authentication']

function readJson(filePath, report, label) {
  if (!existsSync(filePath)) {
    report.error(`${label}: file not found at ${filePath}`)
    return null
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (error) {
    report.error(`${label}: invalid JSON - ${error.message}`)
    return null
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reject paths that escape the plugin root or are not `./`-prefixed. */
function checkComponentPath(value, root, report, label) {
  if (typeof value !== 'string') {
    report.error(`${label}: must be a string path`)
    return
  }
  if (value.includes('..')) {
    report.error(`${label}: path contains ".." which could escape the plugin directory`)
    return
  }
  if (!value.startsWith('./') && value !== '.') {
    report.error(`${label}: path must start with "./" (got "${value}")`)
    return
  }
  const target = resolve(root, value)
  const rel = relative(root, target)
  if (rel.startsWith('..') || (rel !== '' && rel.startsWith(`..${sep}`))) {
    report.error(`${label}: path escapes the plugin directory`)
    return
  }
  if (!existsSync(target)) {
    report.error(`${label}: path not found - ${value}`)
  }
}

function validateAgentPluginsManifest(data, root, report) {
  if (!isPlainObject(data)) {
    report.error('plugin.json: root must be an object')
    return
  }

  // `skills` gets a dedicated message below, so it is not also reported as unknown.
  for (const key of Object.keys(data)) {
    if (key === 'skills') continue
    if (!MANIFEST_ALLOWED_KEYS.includes(key)) {
      report.error(
        `plugin.json: unknown key "${key}"`,
        'The Agent Plugins manifest schema sets additionalProperties: false.',
      )
    }
  }

  if (data.$schema !== AGENT_PLUGINS_SCHEMA) {
    report.error(
      `plugin.json: $schema must be "${AGENT_PLUGINS_SCHEMA}"`,
      'Agents use this to pick the manifest contract. Get it wrong and the plugin silently fails to load.',
    )
  }

  if (typeof data.name !== 'string' || data.name.length === 0) {
    report.error('plugin.json: `name` is required')
  } else if (data.name.length > 64) {
    report.error(`plugin.json: \`name\` is ${data.name.length} characters, max 64`)
  } else if (!AGENT_PLUGINS_NAME_PATTERN.test(data.name)) {
    report.error(
      `plugin.json: \`name\` "${data.name}" does not match the required pattern`,
      'Use lowercase letters, digits, dots, and single hyphens; no leading, trailing, or doubled separators.',
    )
  }

  if (data.version !== undefined && typeof data.version !== 'string') {
    report.error('plugin.json: `version` must be a string')
  }
  if (data.description !== undefined && typeof data.description !== 'string') {
    report.error('plugin.json: `description` must be a string')
  }
  for (const key of ['homepage', 'repository', 'license']) {
    if (data[key] !== undefined && typeof data[key] !== 'string') {
      report.error(`plugin.json: \`${key}\` must be a string`)
    }
  }
  if (data.homepage !== undefined && !isUrl(data.homepage)) {
    report.error(`plugin.json: \`homepage\` must parse as a URL (got "${data.homepage}")`)
  }
  if (data.keywords !== undefined) {
    if (!Array.isArray(data.keywords) || data.keywords.some((entry) => typeof entry !== 'string')) {
      report.error('plugin.json: `keywords` must be an array of strings')
    }
  }
  if (data.author !== undefined) {
    if (!isPlainObject(data.author)) {
      report.error('plugin.json: `author` must be an object')
    } else {
      for (const key of Object.keys(data.author)) {
        if (!AUTHOR_ALLOWED_KEYS.includes(key)) {
          report.error(`plugin.json: unknown author key "${key}"`, `Allowed: ${AUTHOR_ALLOWED_KEYS.join(', ')}`)
        }
        if (typeof data.author[key] !== 'string') {
          report.error(`plugin.json: author.${key} must be a string`)
        }
      }
    }
  }
  if (data.extensions !== undefined) {
    if (!isPlainObject(data.extensions)) {
      report.error('plugin.json: \`extensions\` must be an object keyed by reverse-domain namespace')
    } else {
      for (const [namespace, value] of Object.entries(data.extensions)) {
        if (!isPlainObject(value)) {
          report.error(`plugin.json: extensions["${namespace}"] must be an object`)
        }
      }
      if ('com.openai' in data.extensions && isPlainObject(data.extensions['com.openai'])) {
        const openai = data.extensions['com.openai']
        if ('interface' in openai && !isPlainObject(openai.interface)) {
          report.error('plugin.json: extensions["com.openai"].interface must be an object')
        }
        for (const key of ['apps', 'hooks']) {
          if (key in openai) checkComponentPath(openai[key], root, report, `plugin.json: extensions.com.openai.${key}`)
        }
      }
    }
  }

  if ('skills' in data) {
    report.error(
      'plugin.json: `skills` is not a valid Agent Plugins manifest key',
      'Portable packages discover skills from the root skills/ directory. Remove the key.',
    )
  }
}

function isUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol.length > 1
  } catch {
    return false
  }
}

function validateClaudeManifest(data, root, report) {
  if (!isPlainObject(data)) {
    report.error('.claude-plugin/plugin.json: root must be an object')
    return
  }
  if (typeof data.name !== 'string' || data.name.trim() === '') {
    report.error('.claude-plugin/plugin.json: `name` is required')
  } else {
    const name = data.name
    if (/[\s@:]/.test(name) || /[/\\]/.test(name) || /[\u0000-\u001f\u007f]/.test(name)) {
      report.error(
        `.claude-plugin/plugin.json: \`name\` "${name}" contains a space, "@", ":", path separator, or control character`,
      )
    }
    if (CLAUDE_RESERVED_PLUGIN_PREFIXES.some((prefix) => name.toLowerCase().startsWith(prefix))) {
      report.error(
        `.claude-plugin/plugin.json: \`name\` "${name}" is reserved: it passes as one of Anthropic's own plugins`,
      )
    } else if (CLAUDE_RESERVED_PLUGIN_NAMES.has(name.toLowerCase())) {
      report.error(
        `.claude-plugin/plugin.json: \`name\` "${name}" is reserved: it passes as one of Anthropic's own plugins`,
      )
    } else if (/(^|[^a-z0-9])(claude|anthropic|anthropics)([^a-z0-9]|$)/i.test(name)) {
      report.warn(
        `.claude-plugin/plugin.json: \`name\` "${name}" reads as one of Anthropic's own`,
        'Pick a name that cannot be mistaken for a first-party plugin.',
      )
    }
  }

  for (const key of ['version', 'description']) {
    if (data[key] === undefined) {
      report.warn(`.claude-plugin/plugin.json: \`${key}\` is not set`, 'claude plugin validate warns when it is missing.')
    }
  }
  if (data.author === undefined) {
    report.warn('.claude-plugin/plugin.json: `author` is not set', 'claude plugin validate warns when it is missing.')
  }

  for (const key of ['skills', 'commands', 'outputStyles', 'workflows']) {
    const value = data[key]
    if (value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value]) {
      checkComponentPath(entry, root, report, `.claude-plugin/plugin.json: ${key}`)
    }
  }
  for (const key of ['agents', 'hooks', 'lspServers']) {
    const value = data[key]
    if (value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (isPlainObject(entry)) continue
      checkComponentPath(entry, root, report, `.claude-plugin/plugin.json: ${key}`)
    }
  }
}

function validateClaudeMarketplace(data, root, report) {
  if (!isPlainObject(data)) {
    report.error('.claude-plugin/marketplace.json: root must be an object')
    return
  }

  if (typeof data.name !== 'string' || data.name.trim() === '') {
    report.error('.claude-plugin/marketplace.json: marketplace must have a name')
  } else {
    const name = data.name
    if (/\s/.test(name)) {
      report.error(`.claude-plugin/marketplace.json: name "${name}" cannot contain spaces. Use kebab-case.`)
    }
    if (/[/\\]/.test(name) || name.includes('..') || name === '.') {
      report.error(`.claude-plugin/marketplace.json: name "${name}" cannot contain path separators or ".."`)
    }
    if (CLAUDE_RESERVED_MARKETPLACES.has(name.toLowerCase())) {
      report.error(`.claude-plugin/marketplace.json: name "${name}" is reserved by Claude Code`)
    }
    if (name.toLowerCase().startsWith('claudeai-')) {
      report.error(`.claude-plugin/marketplace.json: names starting with "claudeai-" are reserved`)
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
      report.warn(
        `.claude-plugin/marketplace.json: name "${name}" is not accepted by Claude Desktop`,
        'Use letters, digits, ".", "_", "-"; start with a letter or digit.',
      )
    }
  }

  if (!isPlainObject(data.owner) || typeof data.owner.name !== 'string' || data.owner.name.trim() === '') {
    report.error('.claude-plugin/marketplace.json: owner.name is required')
  }
  if (data.description === undefined) {
    report.warn('.claude-plugin/marketplace.json: no description provided')
  }

  if (!Array.isArray(data.plugins)) {
    report.error('.claude-plugin/marketplace.json: `plugins` must be an array')
    return
  }
  if (data.plugins.length === 0) {
    report.warn('.claude-plugin/marketplace.json: marketplace has no plugins defined')
  }

  const seen = new Set()
  const pluginRoot = isPlainObject(data.metadata) && typeof data.metadata.pluginRoot === 'string'
    ? data.metadata.pluginRoot
    : null

  data.plugins.forEach((entry, index) => {
    const label = `.claude-plugin/marketplace.json: plugins[${index}]`
    if (!isPlainObject(entry)) {
      report.error(`${label}: entry must be an object`)
      return
    }
    for (const key of MARKETPLACE_ENTRY_REQUIRED) {
      if (entry[key] === undefined) report.error(`${label}: \`${key}\` is required`)
    }
    if (typeof entry.name !== 'string') return
    if (seen.has(entry.name)) {
      report.error(`${label}: duplicate plugin name "${entry.name}"`)
    }
    seen.add(entry.name)

    const source = entry.source
    if (typeof source === 'string') {
      validateRelativeSource(source, root, pluginRoot, report, `${label}.source`)
    } else if (isPlainObject(source)) {
      if (source.source === 'local' || source.source === undefined) {
        validateRelativeSource(source.path, root, pluginRoot, report, `${label}.source.path`)
      }
    } else if (source !== undefined) {
      report.error(`${label}.source: matches no known plugin source type`)
    }
  })
}

/**
 * A local source may be "./path", ".", or a bare name when metadata.pluginRoot
 * is set. It must resolve inside the marketplace root and exist on disk.
 */
function validateRelativeSource(value, root, pluginRoot, report, label) {
  if (typeof value !== 'string' || value === '') {
    report.error(`${label}: relative source must be a "./" path or "."`)
    return
  }
  if (value.includes('..')) {
    report.error(`${label}: path contains ".."`, 'A relative source may not escape the marketplace root.')
    return
  }
  const isBare = !value.includes('/') && !value.includes('\\')
  if (isBare && value !== '.') {
    if (pluginRoot === null) {
      report.error(
        `${label}: bare source name "${value}" needs a metadata.pluginRoot to resolve under`,
        'Use a "./"-prefixed path, or set metadata.pluginRoot in the marketplace file.',
      )
      return
    }
    const target = resolve(root, pluginRoot, value)
    if (!existsSync(target)) report.error(`${label}: path not found - ${value}`)
    return
  }
  if (!value.startsWith('./') && value !== '.') {
    report.error(`${label}: relative path must start with "./" (got "${value}")`)
    return
  }
  const target = resolve(root, value)
  const rel = relative(root, target)
  if (rel.startsWith('..')) {
    report.error(`${label}: path escapes the marketplace root`)
    return
  }
  if (!existsSync(target)) {
    report.error(`${label}: path not found - ${value}`)
  }
}

function validateCodexMarketplace(data, root, report) {
  if (!isPlainObject(data)) {
    report.error('.agents/plugins/marketplace.json: root must be an object')
    return
  }
  if (typeof data.name !== 'string' || data.name.trim() === '') {
    report.error('.agents/plugins/marketplace.json: marketplace must have a name')
  }
  if (!isPlainObject(data.interface) || typeof data.interface.displayName !== 'string') {
    report.warn(
      '.agents/plugins/marketplace.json: interface.displayName is not set',
      'Without it the marketplace title falls back to the raw name in the picker.',
    )
  }
  if (!Array.isArray(data.plugins) || data.plugins.length === 0) {
    report.error('.agents/plugins/marketplace.json: `plugins` must be a non-empty array')
    return
  }

  data.plugins.forEach((entry, index) => {
    const label = `.agents/plugins/marketplace.json: plugins[${index}]`
    if (!isPlainObject(entry)) {
      report.error(`${label}: entry must be an object`)
      return
    }
    for (const key of CODEX_ENTRY_REQUIRED) {
      if (entry[key] === undefined) report.error(`${label}: \`${key}\` is required`)
    }
    if (isPlainObject(entry.policy)) {
      for (const key of CODEX_POLICY_REQUIRED) {
        if (typeof entry.policy[key] !== 'string') {
          report.error(`${label}: policy.${key} is required and must be a string`)
        }
      }
    }
    if (!isPlainObject(entry.source)) {
      report.error(`${label}.source: must be an object with a source type`)
      return
    }
    if (entry.source.source === 'local') {
      if (typeof entry.source.path !== 'string') {
        report.error(`${label}.source.path is required for a local source`)
        return
      }
      validateRelativeSource(entry.source.path, root, null, report, `${label}.source.path`)
    }
  })
}

/** Discover skills from the default `skills/<name>/SKILL.md` location. */
function discoverSkills(root) {
  const skillsDir = join(root, 'skills')
  if (!existsSync(skillsDir)) return []
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(skillsDir, entry.name, 'SKILL.md'))
    .filter((filePath) => existsSync(filePath) && statSync(filePath).isFile())
    .sort()
}

const AGENT_PLUGINS_MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json'
const MCP_SERVER_TYPES = new Set(['stdio', 'streamable-http', 'sse'])
// The forward slash must be escaped: an unescaped one would terminate the
// literal early. This mirrors the pattern in the Agent Plugins MCP schema.
const MCP_CWD_PATTERN = /^(?:\.\/|\$\{PLUGIN_ROOT\}(?:\/|$)|\$\{PLUGIN_DATA\}(?:\/|$))/
const MCP_RESERVED_ENV = new Set(['PLUGIN_ROOT', 'PLUGIN_DATA'])

/**
 * Validate the bundled MCP configuration.
 *
 * The rule set mirrors the Agent Plugins 1.0.0 MCP schema: an exact $schema
 * const, additionalProperties false at the root, and a oneOf over the three
 * transports. Checking it here means a typo in mcp.json is caught by
 * `npm run validate` instead of surfacing as an MCP handshake failure inside
 * ChatGPT with no useful message.
 */
function validateMcpConfig(root, report) {
  const label = 'mcp.json (Agent Plugins 1.0.0)'

  if (!existsSync(join(root, 'mcp.json'))) {
    report.warn(`${label}: not present`, 'The plugin ships no MCP server; the skill works without one.')
    return
  }

  let data
  try {
    data = JSON.parse(readFileSync(join(root, 'mcp.json'), 'utf8'))
  } catch (error) {
    report.error(`${label}: invalid JSON - ${error.message}`)
    return
  }

  if (!isPlainObject(data)) {
    report.error(`${label}: root must be an object`)
    return
  }

  for (const key of Object.keys(data)) {
    if (key !== '$schema' && key !== 'mcpServers') {
      report.error(`${label}: unknown key "${key}"`, 'The schema sets additionalProperties: false.')
    }
  }

  if (data.$schema !== AGENT_PLUGINS_MCP_SCHEMA) {
    report.error(`${label}: $schema must be "${AGENT_PLUGINS_MCP_SCHEMA}"`)
  }

  if (!isPlainObject(data.mcpServers)) {
    report.error(`${label}: \`mcpServers\` is required and must be an object`)
    return
  }

  const names = Object.keys(data.mcpServers)
  if (names.length === 0) {
    report.warn(`${label}: no MCP servers declared`, 'Remove mcp.json if the plugin is skills-only.')
  }

  let declaresStdio = false

  for (const [name, server] of Object.entries(data.mcpServers)) {
    const entryLabel = `${label}: mcpServers["${name}"]`

    if (!isPlainObject(server)) {
      report.error(`${entryLabel}: must be an object`)
      continue
    }

    const type = server.type
    if (typeof type !== 'string' || !MCP_SERVER_TYPES.has(type)) {
      report.error(
        `${entryLabel}: \`type\` must be one of ${[...MCP_SERVER_TYPES].join(', ')} (got ${JSON.stringify(type)})`,
      )
      continue
    }

    if (type === 'stdio') {
      declaresStdio = true
      validateStdioServer(server, root, report, entryLabel)
    } else {
      validateHttpServer(server, report, entryLabel)
    }
  }

  if (declaresStdio) checkMcpDependencies(root, report)
}

function validateStdioServer(server, root, report, label) {
  const allowed = ['type', 'command', 'args', 'env', 'cwd']
  for (const key of Object.keys(server)) {
    if (!allowed.includes(key)) {
      report.error(`${label}: unknown key "${key}"`, `Allowed: ${allowed.join(', ')}`)
    }
  }

  if (typeof server.command !== 'string' || server.command.length === 0) {
    report.error(`${label}: \`command\` is required and must be a non-empty string`)
  } else if (server.command.includes('/') || server.command.includes('\\')) {
    report.warn(
      `${label}: \`command\` "${server.command}" looks like a path, not an executable token`,
      'Use a bare executable name such as "node" so resolution follows the host PATH.',
    )
  }

  if (server.args !== undefined) {
    if (!Array.isArray(server.args) || server.args.some((entry) => typeof entry !== 'string')) {
      report.error(`${label}: \`args\` must be an array of strings`)
    } else {
      checkEntryPaths(root, report, label, server.args, server.cwd)
    }
  }

  if (server.env !== undefined) {
    if (!isPlainObject(server.env)) {
      report.error(`${label}: \`env\` must be an object`)
    } else {
      for (const [key, value] of Object.entries(server.env)) {
        if (MCP_RESERVED_ENV.has(key)) {
          report.error(
            `${label}: \`env\` must not set "${key}"`,
            'The host provides it. Setting it would override the plugin root or data directory.',
          )
        }
        if (typeof value !== 'string') {
          report.error(`${label}: env.${key} must be a string`)
        }
      }
    }
  }

  if (server.cwd !== undefined) {
    if (typeof server.cwd !== 'string' || !MCP_CWD_PATTERN.test(server.cwd)) {
      report.error(
        `${label}: \`cwd\` must start with "./" or be rooted at \${PLUGIN_ROOT} or \${PLUGIN_DATA}`,
        `Got ${JSON.stringify(server.cwd)}.`,
      )
    } else if (!server.cwd.includes('${')) {
      checkEntryPaths(root, report, label, [server.cwd], server.cwd)
    }
  }
}

function validateHttpServer(server, report, label) {
  const allowed = ['type', 'url', 'headers']
  for (const key of Object.keys(server)) {
    if (!allowed.includes(key)) {
      report.error(`${label}: unknown key "${key}"`, `Allowed: ${allowed.join(', ')}`)
    }
  }

  if (typeof server.url !== 'string' || server.url.length === 0) {
    report.error(`${label}: \`url\` is required for a ${server.type} server`)
  }

  if (server.headers !== undefined && !isPlainObject(server.headers)) {
    report.error(`${label}: \`headers\` must be an object`)
  }
}

/**
 * A path argument is only meaningful relative to the declared `cwd`, so resolve
 * it that way before deciding whether it exists.
 */
function checkEntryPaths(root, report, label, values, cwd) {
  const base = typeof cwd === 'string' && !cwd.includes('${') ? resolve(root, cwd) : root

  for (const value of values) {
    if (typeof value !== 'string') continue
    if (/^[a-z]+:/i.test(value) || value.startsWith('-')) continue

    const looksLikePath = value.includes('/') || value.includes('\\')
    if (!looksLikePath) continue

    const stripped = value.replace(/^\$\{PLUGIN_ROOT\}/, '.').replace(/^\$\{PLUGIN_DATA\}/, '.')
    if (stripped.includes('..')) {
      report.error(`${label}: path "${value}" escapes the plugin directory`)
      continue
    }
    if (!existsSync(resolve(base, stripped))) {
      report.error(`${label}: path not found - ${value}`, `Resolved against ${base}.`)
    }
  }
}

/**
 * A bundled stdio server imports the MCP SDK. Warn when that has not been
 * installed, because the failure otherwise appears only as an MCP handshake
 * error inside the host with a stack trace the user cannot act on.
 */
function checkMcpDependencies(root, report) {
  const sdkDir = join(root, 'mcp', 'node_modules', '@modelcontextprotocol', 'sdk')
  if (existsSync(sdkDir)) return

  report.warn(
    'mcp/node_modules is not installed',
    'Run `npm run setup` once. Without it the bundled MCP server cannot start, and the skill still works on its own.',
  )
}

/**
 * A SKILL.md may point at references/, assets/, and scripts/ files. A broken link
 * is a silent failure for the agent that later tries to read it.
 */
function validateSkillReferences(skillFile, report) {
  const root = dirname(skillFile)
  const source = readFileSync(skillFile, 'utf8')
  const pattern = /\]\((references\/[^)\s]+|assets\/[^)\s]+|scripts\/[^)\s]+)\)/g
  const seen = new Set()
  for (const match of source.matchAll(pattern)) {
    const rel = match[1]
    if (seen.has(rel)) continue
    seen.add(rel)
    if (!existsSync(join(root, rel))) {
      report.error(`${rel}: referenced from ${basename(root)}/SKILL.md but not found on disk`)
    }
  }
}

export function validatePlugin(root = DEFAULT_ROOT) {
  const reports = []

  const manifest = createReport('plugin.json (Agent Plugins 1.0.0)')
const manifestData = readJson(join(root, 'plugin.json'), manifest, 'plugin.json')
  if (manifestData !== null) validateAgentPluginsManifest(manifestData, root, manifest)
  reports.push(manifest)

  const claude = createReport('.claude-plugin/plugin.json (Claude Code)')
  const claudeData = readJson(join(root, '.claude-plugin', 'plugin.json'), claude, '.claude-plugin/plugin.json')
  if (claudeData !== null) validateClaudeManifest(claudeData, root, claude)
  reports.push(claude)

  const claudeMarket = createReport('.claude-plugin/marketplace.json (Claude Code)')
  const claudeMarketData = readJson(
    join(root, '.claude-plugin', 'marketplace.json'),
    claudeMarket,
    '.claude-plugin/marketplace.json',
  )
  if (claudeMarketData !== null) validateClaudeMarketplace(claudeMarketData, root, claudeMarket)
  reports.push(claudeMarket)

  const codexMarket = createReport('.agents/plugins/marketplace.json (Codex)')
  const codexMarketData = readJson(
    join(root, '.agents', 'plugins', 'marketplace.json'),
    codexMarket,
    '.agents/plugins/marketplace.json',
  )
  if (codexMarketData !== null) validateCodexMarketplace(codexMarketData, root, codexMarket)
  reports.push(codexMarket)

  const discovery = createReport('skill discovery')
  const skillFiles = discoverSkills(root)
  if (skillFiles.length === 0) {
    discovery.error('no skills found', 'Expected at least one skills/<name>/SKILL.md')
  }
  for (const skillFile of skillFiles) {
    const skillReport = validateSkillFile(skillFile)
    reports.push(skillReport)
    if (skillReport.errorCount === 0) validateSkillReferences(skillFile, skillReport)
  }
  reports.push(discovery)

  const consistency = createReport('manifest consistency')
  const names = [
    ['plugin.json', manifestData?.name],
    ['.claude-plugin/plugin.json', claudeData?.name],
    ['.claude-plugin/marketplace.json', claudeMarketData?.plugins?.[0]?.name],
    ['.agents/plugins/marketplace.json', codexMarketData?.plugins?.[0]?.name],
  ].filter(([, value]) => typeof value === 'string')

  const distinctNames = new Set(names.map(([, value]) => value))
  if (distinctNames.size > 1) {
    consistency.error(
      `plugin name differs across manifests: ${names.map(([where, value]) => `${where}=${value}`).join(', ')}`,
      'Hosts namespace components under the manifest name, so a mismatch breaks lookups.',
    )
  }

  const versions = [
    ['plugin.json', manifestData?.version],
    ['.claude-plugin/plugin.json', claudeData?.version],
    ['.claude-plugin/marketplace.json', claudeMarketData?.plugins?.[0]?.version],
  ].filter(([, value]) => typeof value === 'string')
  if (new Set(versions.map(([, value]) => value)).size > 1) {
    consistency.warn(
      `plugin version differs across manifests: ${versions.map(([where, value]) => `${where}=${value}`).join(', ')}`,
    )
  }

  if (existsSync(join(root, 'CLAUDE.md'))) {
    consistency.warn(
      'CLAUDE.md sits at the plugin root',
      'Claude Code does not load it as context and `claude plugin validate` warns. Move it into a skill.',
    )
  }
  reports.push(consistency)

  const mcp = createReport('mcp.json (bundled MCP servers)')
  validateMcpConfig(root, mcp)
  reports.push(mcp)

  return reports
}

function parseArgs(argv) {
  const options = { root: DEFAULT_ROOT, strict: false, json: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--strict') options.strict = true
    else if (arg === '--json') options.json = true
    else if (arg === '-h' || arg === '--help') options.help = true
    else if (arg.startsWith('-')) fail(`unknown option "${arg}"`)
    else options.root = resolve(arg)
  }
  return options
}

const HELP = `Validate the plugin package.

Usage:
  node validate-plugin.mjs [path/to/plugin] [--strict] [--json]

Defaults to the plugin this script ships with.
`

function main(argv) {
  const options = parseArgs(argv)
  if (options.help) {
    console.log(HELP)
    return 0
  }
  if (!existsSync(options.root)) fail(`plugin root not found: ${options.root}`)

  const reports = validatePlugin(options.root)

  if (options.json) {
    console.log(
      JSON.stringify(
        { reports: reports.map((r) => ({ subject: r.subject, findings: r.sorted() })) },
        null,
        2,
      ),
    )
    return reports.some((r) => r.errorCount > 0) ? 1 : 0
  }

  return printReports(reports, { strict: options.strict })
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2))
}
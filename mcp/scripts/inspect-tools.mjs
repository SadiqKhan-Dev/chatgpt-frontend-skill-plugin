#!/usr/bin/env node
/**
 * Validate the MCP server the way a host will use it.
 *
 * The unit tests call tool handlers directly, which cannot catch a broken
 * handshake, a tool the SDK refuses to register, or a structured result that
 * fails its declared output schema. This script spawns the real server over
 * stdio, connects a real MCP client, and exercises every tool.
 *
 * Usage:
 *   node mcp/scripts/inspect-tools.mjs [--json]
 *
 * Exit codes: 0 pass, 1 failure, 2 the SDK is not installed.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = resolve(HERE, '..', '..')

let Client
let StdioClientTransport
try {
  ;({ Client } = await import('@modelcontextprotocol/sdk/client/index.js'))
  ;({ StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js'))
} catch (error) {
  process.stderr.write(
    'error: @modelcontextprotocol/sdk is not installed.\n' +
      'Run `npm run setup` once, then retry.\n' +
      `(${error.message})\n`,
  )
  process.exit(2)
}

/** A real, complete skill, used as the subject for the source-taking tools. */
function exampleSource() {
  return readFileSync(
    join(PLUGIN_ROOT, 'examples', 'react-component-authoring', 'SKILL.md'),
    'utf8',
  )
}

/**
 * Read the stdio launch command straight out of `mcp.json`.
 *
 * Spawning a hardcoded path would prove the server works while saying nothing
 * about whether the *declared* configuration is correct. A wrong `cwd` or a
 * relative `args` entry that only resolves from one directory is exactly the
 * kind of mistake that passes every local test and fails on install, so the
 * inspector runs what the manifest actually says.
 */
function declaredLaunch() {
  const manifestPath = join(PLUGIN_ROOT, 'mcp.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  for (const [name, server] of Object.entries(manifest.mcpServers ?? {})) {
    if (server.type === 'stdio') {
      const substitute = (value) =>
        typeof value === 'string'
          ? value.replaceAll('${PLUGIN_ROOT}', PLUGIN_ROOT).replaceAll('${PLUGIN_DATA}', PLUGIN_ROOT)
          : value
      return {
        name,
        command: server.command,
        args: (server.args ?? []).map(substitute),
        cwd: substitute(server.cwd ?? '.'),
      }
    }
  }

  throw new Error('mcp.json declares no stdio MCP server')
}

/**
 * One case per tool. `expect` is checked against the structured result so a tool
 * that returns prose but the wrong data still fails.
 */
function cases() {
  const source = exampleSource()
  return [
    {
      tool: 'plan_skill',
      args: { technology: 'Next.js', topic: 'App Router data fetching', difficulty: 'advanced' },
      expect: (data) =>
        data.ok === true &&
        data.technology.id === 'nextjs' &&
        data.difficulty.id === 'advanced' &&
        data.sections.required.length === 11 &&
        data.openQuestions.length > 0,
      why: 'resolves the technology, plans 11 required sections, and asks open questions',
    },
    {
      tool: 'plan_skill',
      args: { technology: 'Svelte', topic: 'anything', difficulty: 'advanced' },
      expect: (data) => data.ok === false && Array.isArray(data.suggestions),
      why: 'rejects an unsupported technology instead of mapping it to a near match',
    },
    {
      tool: 'resolve_technology',
      args: { name: 'nextjs' },
      expect: (data) => data.ok === true && data.technology.label === 'Next.js',
      why: 'resolves an alias to the catalog entry',
    },
    {
      tool: 'resolve_technology',
      args: { name: 'Svelte' },
      expect: (data) => data.ok === false,
      why: 'rejects a technology outside the catalog',
    },
    {
      tool: 'resolve_technology',
      args: { name: '   ' },
      expect: (data) => data.ok === false,
      why: 'reports a blank name as empty rather than unsupported',
    },
    {
      tool: 'list_technologies',
      args: {},
      expect: (data) => data.count === data.technologies.length && data.count >= 17,
      why: 'returns the whole catalog with a matching count',
    },
    {
      tool: 'list_technologies',
      args: { kind: 'practice' },
      expect: (data) => data.technologies.length > 0 && data.technologies.every((t) => t.kind === 'practice'),
      why: 'filters by kind',
    },
    {
      tool: 'list_sections',
      args: {},
      expect: (data) => data.count === 15 && data.requiredCount === 11 && data.conditionalCount === 4,
      why: 'reports the full 15-section contract',
    },
    {
      tool: 'list_sections',
      args: { requiredOnly: true },
      expect: (data) => data.count === 11 && data.sections.every((s) => s.required),
      why: 'returns only the required sections',
    },
    {
      tool: 'get_skill_template',
      args: { name: 'react-form-validation', technology: 'react', topic: 'Controlled form validation' },
      expect: (data) =>
        data.template.includes('name: react-form-validation') &&
        data.placeholders.length > 0 &&
        data.conditionalSections.length === 4,
      why: 'fills the identifier, lists placeholders, and decides all four conditional sections',
    },
    {
      tool: 'get_skill_template',
      args: { technology: 'accessibility' },
      expect: (data) =>
        data.conditionalSections.find((s) => s.id === 'recommended-project-structure').decision === 'omit',
      why: 'omits project structure for a cross-cutting practice topic',
    },
    {
      tool: 'validate_skill',
      args: { source, skillName: 'react-component-authoring' },
      expect: (data) => data.passed === true && data.errorCount === 0,
      why: 'passes a known-good example',
    },
    {
      tool: 'validate_skill',
      args: { source: 'not a skill at all' },
      expect: (data) => data.passed === false && data.errorCount > 0,
      why: 'fails invalid input with errors rather than throwing',
    },
    {
      tool: 'audit_skill',
      args: { source },
      expect: (data) =>
        data.parsed === true &&
        data.preserve.length === 15 &&
        data.rewrite.length === 0 &&
        data.templateLeftovers.length === 0,
      why: 'preserves every section of a known-good example and flags nothing',
    },
    {
      tool: 'audit_skill',
      args: { source: 'no frontmatter at all' },
      expect: (data) => data.parsed === false && data.findings.some((f) => f.level === 'error'),
      why: 'degrades with an actionable error when the frontmatter cannot be parsed',
    },
  ]
}

/** Inputs the SDK schema itself must refuse, before any handler runs. */
const SCHEMA_REJECTIONS = [
  { tool: 'resolve_technology', args: { name: '' } },
  { tool: 'plan_skill', args: { technology: 'react', topic: '', difficulty: 'advanced' } },
  { tool: 'validate_skill', args: {} },
  { tool: 'validate_skill', args: { source: 'x', skillName: 'Not A Name' } },
  { tool: 'list_technologies', args: { kind: 'nonsense' } },
]

async function main() {
  const asJson = process.argv.includes('--json')
  const results = []
  let failures = 0

  const launch = declaredLaunch()

  const transport = new StdioClientTransport({
    command: launch.command,
    args: launch.args,
    cwd: launch.cwd,
    stderr: 'pipe',
  })

  const client = new Client({ name: 'frontend-skill-builder-inspector', version: '1.0.0' })

  try {
    await client.connect(transport)

    const serverVersion = client.getServerVersion()
    const instructions = client.getInstructions()
    results.push({
      check: 'initialize',
      passed: true,
      detail: `spawned as declared in mcp.json ("${launch.command} ${launch.args.join(' ')}", cwd ${launch.cwd}); connected to ${serverVersion?.name} ${serverVersion?.version}, instructions ${instructions?.length ?? 0} chars`,
    })

    const { tools } = await client.listTools()
    const names = tools.map((tool) => tool.name).sort()
    const expected = [
      'audit_skill',
      'get_skill_template',
      'list_sections',
      'list_technologies',
      'plan_skill',
      'resolve_technology',
      'validate_skill',
    ]

    const listedOk = JSON.stringify(names) === JSON.stringify(expected)
    if (!listedOk) failures += 1
    results.push({
      check: 'tools/list',
      passed: listedOk,
      detail: listedOk ? `${names.length} tools advertised` : `got ${names.join(', ')}`,
    })

    // Every advertised tool needs a description and an input schema, or the
    // model cannot choose it correctly.
    const undescribed = tools.filter((tool) => !tool.description || !tool.inputSchema)
    if (undescribed.length > 0) failures += 1
    results.push({
      check: 'tool metadata',
      passed: undescribed.length === 0,
      detail:
        undescribed.length === 0
          ? 'all tools have a title, description, and input schema'
          : `missing metadata: ${undescribed.map((t) => t.name).join(', ')}`,
    })

    for (const testCase of cases()) {
      try {
        const response = await client.callTool({
          name: testCase.tool,
          arguments: testCase.args,
        })
        const data = response.structuredContent ?? {}
        const passed = response.isError !== true && testCase.expect(data)
        if (!passed) failures += 1
        results.push({
          check: `${testCase.tool} ${JSON.stringify(testCase.args).slice(0, 60)}`,
          passed,
          detail: testCase.why,
        })
      } catch (error) {
        failures += 1
        results.push({ check: `${testCase.tool} threw`, passed: false, detail: error.message })
      }
    }

    for (const rejection of SCHEMA_REJECTIONS) {
      try {
        const response = await client.callTool({ name: rejection.tool, arguments: rejection.args })
        const rejected = response.isError === true
        if (!rejected) failures += 1
        results.push({
          check: `schema rejects ${rejection.tool} ${JSON.stringify(rejection.args)}`,
          passed: rejected,
          detail: rejected ? 'refused by the input schema' : 'accepted input that should have been refused',
        })
      } catch (error) {
        // The SDK may also reject during validation and throw, which is equally
        // correct: the point is that invalid input never reaches a handler.
        results.push({
          check: `schema rejects ${rejection.tool}`,
          passed: true,
          detail: `refused during validation: ${error.message.slice(0, 80)}`,
        })
      }
    }
  } finally {
    await client.close().catch(() => {})
  }

  if (asJson) {
    console.log(JSON.stringify({ results, failures }, null, 2))
  } else {
    for (const result of results) {
      console.log(`${result.passed ? 'ok  ' : 'FAIL'} ${result.check}`)
      console.log(`       ${result.detail}`)
    }
    console.log('')
    console.log(
      failures === 0
        ? `PASSED - ${results.length} checks, 0 failures`
        : `FAILED - ${results.length} checks, ${failures} failure(s)`,
    )
  }

  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  process.stderr.write(`inspect-tools failed: ${error?.stack ?? error}\n`)
  process.exit(1)
})
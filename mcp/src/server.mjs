#!/usr/bin/env node
/**
 * Frontend Skill Builder MCP server.
 *
 * Exposes the plugin's deterministic core as tools: technology resolution, the
 * output contract, the template, the validator, and the improvement audit.
 *
 * Two transports, one tool set:
 *   - stdio, the default. This is what `mcp.json` declares, so the plugin works
 *     entirely locally with no deployment and nothing listening on a port.
 *   - streamable HTTP, when FRONTEND_SKILL_BUILDER_HTTP=1. Optional, and only
 *     needed if you later want a hosted endpoint.
 *
 * No tool writes files, reaches the network, or calls a model. Every tool is
 * read-only and deterministic, which is what makes the output verifiable.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PLUGIN_ROOT, SKILL_DIR } from './core.mjs'
import { listTechnologies, resolveTechnologyTool } from './tools/catalog.mjs'
import { listSections, getSkillTemplate } from './tools/contract.mjs'
import { planSkill } from './tools/plan.mjs'
import { validateSkill } from './tools/validate.mjs'
import { auditSkill } from './tools/audit.mjs'

const NAME = 'frontend-skill-builder'
const VERSION = '0.2.0'

const TOOLS = [
  planSkill,
  resolveTechnologyTool,
  listTechnologies,
  listSections,
  getSkillTemplate,
  validateSkill,
  auditSkill,
]

const INSTRUCTIONS = [
  'Tools for authoring production-ready frontend SKILL.md files.',
  '',
  'For any create, convert, from-docs, or improve request, call plan_skill first.',
  'It resolves the technology and difficulty, decides which of the 15 contract sections',
  'apply, and returns the questions to settle before drafting. Do not draft prose before',
  'calling it.',
  '',
  'Typical sequence: plan_skill, get_skill_template, write the skill yourself, then',
  'validate_skill. For an existing skill, run audit_skill first and respect its',
  'preserve-list: sections listed there are already correct and must not be rewritten.',
  '',
  'Write the prose yourself. These tools plan, supply the contract, and verify; they do',
  'not generate skill content, and a skill they generated would be no better than',
  'filler that happens to validate.',
].join('\n')

function buildServer() {
  const server = new McpServer({ name: NAME, version: VERSION }, { instructions: INSTRUCTIONS })

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      tool.handler,
    )
  }

  return server
}

async function main() {
  const useHttp = process.env.FRONTEND_SKILL_BUILDER_HTTP === '1'

  const server = buildServer()

  if (!useHttp) {
    await server.connect(new StdioServerTransport())
    return
  }

  // Optional hosted transport. Kept out of the default path so a local install
  // has no listening socket and no attack surface.
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  )
  const port = Number(process.env.FRONTEND_SKILL_BUILDER_PORT ?? 3000)
  const { createServer } = await import('node:http')

  const http = createServer(async (req, res) => {
    if (req.url !== '/mcp') {
      res.writeHead(404).end('not found')
      return
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => transport.close())
    await server.connect(transport)
    await transport.handleRequest(req, res)
  })

  await new Promise((resolve) => http.listen(port, resolve))
  process.stderr.write(`${NAME} MCP server listening on http://localhost:${port}/mcp\n`)
}

// Only connect a transport when run as a program. Importing this module, as the
// tests do, must not open stdin or a socket.
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (invokedDirectly) {
  main().catch((error) => {
    // stdout is the MCP transport on stdio, so diagnostics must go to stderr.
    process.stderr.write(`${NAME} MCP server failed to start: ${error?.stack ?? error}\n`)
    process.exit(1)
  })
}

export { buildServer, TOOLS, NAME, VERSION, INSTRUCTIONS, PLUGIN_ROOT, SKILL_DIR }
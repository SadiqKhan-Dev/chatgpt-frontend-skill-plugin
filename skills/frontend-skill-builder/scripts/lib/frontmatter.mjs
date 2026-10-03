/**
 * Strict YAML frontmatter reader for SKILL.md files.
 *
 * This deliberately supports only the Agent Skills frontmatter subset:
 * top-level scalars plus a flat `metadata` string map. Anything outside that
 * subset raises a FrontmatterError instead of being silently misparsed, because a
 * wrong guess here produces a skill that loads with the wrong metadata.
 */

const DELIMITER = /^---\r?$/
const KEY_VALUE = /^([A-Za-z0-9_-]+):(?:[ \t]+(.*))?$/
const MAP_ENTRY = /^[ \t]+([A-Za-z0-9_.-]+):(?:[ \t]+(.*))?$/

const KNOWN_KEYS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']

export class FrontmatterError extends Error {
  constructor(message, line) {
    super(line === undefined ? message : `${message} (line ${line})`)
    this.name = 'FrontmatterError'
    this.line = line
  }
}

/** Unwrap a single-quoted, double-quoted, or plain YAML scalar. */
function readScalar(raw, line) {
  const value = raw.trim()
  if (value === '') return ''
  if (value.startsWith('"')) {
    if (!value.endsWith('"') || value.length < 2) {
      throw new FrontmatterError('unterminated double-quoted value', line)
    }
    return value
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\')
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) {
      throw new FrontmatterError('unterminated single-quoted value', line)
    }
    return value.slice(1, -1).replace(/''/g, "'")
  }
  if (value.startsWith('[') || value.startsWith('{') || value.startsWith('&') || value.startsWith('*')) {
    throw new FrontmatterError(`unsupported YAML construct: ${value}`, line)
  }
  if (value === '|' || value === '>') {
    throw new FrontmatterError(`unsupported YAML block scalar: ${value}`, line)
  }
  return value
}

/**
 * Parse the frontmatter block of a Markdown document.
 *
 * @returns {{ data: Record<string, unknown>, body: string, bodyStartLine: number }}
 * @throws {FrontmatterError}
 */
export function parseFrontmatter(source) {
  const text = source.replace(/^﻿/, '')
  const lines = text.split(/\r?\n/)

  if (lines.length === 0 || !DELIMITER.test(lines[0] ?? '')) {
    throw new FrontmatterError('missing opening "---" frontmatter delimiter on line 1', 1)
  }

  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (DELIMITER.test(lines[i])) {
      end = i
      break
    }
  }
  if (end === -1) {
    throw new FrontmatterError('missing closing "---" frontmatter delimiter')
  }

  const data = {}
  let mapKey = null
  let map = null

  for (let i = 1; i < end; i += 1) {
    const lineNo = i + 1
    const line = lines[i]
    if (line.trim() === '' || line.trim().startsWith('#')) continue

    if (/^[ \t]/.test(line)) {
      const entry = MAP_ENTRY.exec(line)
      if (!entry) throw new FrontmatterError(`unsupported indented YAML line: ${line.trim()}`, lineNo)
      if (mapKey === null) {
        throw new FrontmatterError(`indented line appears before any mapping key: ${line.trim()}`, lineNo)
      }
      const entryValue = entry[2] ?? ''
      if (entryValue.trim() === '') {
        // A valueless key here is a nested map or an empty entry. Both would
        // otherwise be flattened into a wrong value.
        throw new FrontmatterError(
          `metadata.${entry[1]} must have a value; nested maps are not supported`,
          lineNo,
        )
      }
      map[entry[1]] = readScalar(entryValue, lineNo)
      continue
    }

    const pair = KEY_VALUE.exec(line)
    if (!pair) throw new FrontmatterError(`unsupported YAML line: ${line.trim()}`, lineNo)

    const [, key, rawValue] = pair
    if (!KNOWN_KEYS.includes(key)) {
      throw new FrontmatterError(
        `unsupported frontmatter key "${key}" (allowed: ${KNOWN_KEYS.join(', ')})`,
        lineNo,
      )
    }
    if (key in data) throw new FrontmatterError(`duplicate frontmatter key "${key}"`, lineNo)

    if (key === 'metadata') {
      const inline = readScalar(rawValue ?? '', lineNo)
      if (inline !== '') {
        if (inline.startsWith('{')) {
          throw new FrontmatterError('inline metadata maps are not supported; use one "  key: value" line per entry', lineNo)
        }
        throw new FrontmatterError(`metadata must be a block mapping, got: ${inline}`, lineNo)
      }
      mapKey = 'metadata'
      map = {}
      data.metadata = map
      continue
    }

    mapKey = null
    map = null
    data[key] = readScalar(rawValue ?? '', lineNo)
  }

  if (mapKey !== null && Object.keys(map).length === 0) {
    throw new FrontmatterError('metadata must declare at least one entry')
  }

  return {
    data,
    body: lines.slice(end + 1).join('\n'),
    bodyStartLine: end + 2,
  }
}
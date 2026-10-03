#!/usr/bin/env node
/**
 * Build the ZIP that gets uploaded to the ChatGPT plugin submission portal.
 *
 * The submission is skills-only: the portal rejects a bundled stdio MCP server,
 * so `mcp.json`, `mcp/`, and every dev-only file are left out of the archive
 * and stay in the repository. Run `npm run check` before this.
 *
 * Every rule enforced here is published by OpenAI or the Agent Plugins spec.
 * See SUBMISSION.md for the limits and their sources.
 *
 *   node scripts/package-submission.mjs [--out <dir>] [--force]
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const LIMITS = {
  archiveBytes: 100 * 1024 * 1024,
  uncompressedBytes: 512 * 1024 * 1024,
  entries: 5000,
  memberBytes: 100 * 1024 * 1024,
  pathDepth: 20,
  imageBytes: 5 * 1024 * 1024,
  imageMinPx: 48,
  imageMaxPx: 4096,
  displayName: 30,
  shortDescription: 30,
  longDescription: 4000,
  developerName: 80,
  description: 1024,
  capabilityEntries: 20,
  capabilityLength: 120,
  defaultPrompts: 3,
  defaultPromptLength: 128,
  skillDescription: 1024,
  skillLines: 500,
}

/** Files and directories copied into the archive, in this order. */
const INCLUDE = ['plugin.json', 'README.md', 'skills', 'assets']

/**
 * Repository-only tooling that has no business inside an installed plugin.
 * `validate-plugin.mjs` checks the multi-manifest development layout, so in a skills-only archive
 * it reports the dev manifests as missing. `SKILL.md` never points at it.
 */
const EXCLUDE = [/^skills\/[^/]+\/scripts\/validate-plugin\.mjs$/u]

/** DOS date for 1980-01-01, so repeated builds are byte-identical. */
const DOS_TIME = 0
const DOS_DATE = 0x0021

const findings = []
const fail = (message) => findings.push({ level: 'error', message })
const warn = (message) => findings.push({ level: 'warn', message })
const check = (ok, message) => {
  if (!ok) fail(message)
}

// ---------------------------------------------------------------- file listing

function walk(absolute, prefix, out) {
  for (const name of readdirSync(absolute).sort()) {
    const child = join(absolute, name)
    const stats = statSync(child)
    const entry = posix.join(prefix, name)
    if (stats.isDirectory()) walk(child, entry, out)
    else if (stats.isFile()) out.push({ entry, absolute: child, bytes: stats.size })
  }
}

const members = []
for (const item of INCLUDE) {
  const absolute = join(ROOT, item)
  let stats
  try {
    stats = statSync(absolute)
  } catch {
    fail(`missing from the package: ${item}`)
    continue
  }
  if (stats.isDirectory()) walk(absolute, item, members)
  else members.push({ entry: item, absolute, bytes: stats.size })
}

const included = members.filter(({ entry }) => !EXCLUDE.some((pattern) => pattern.test(entry)))
for (const excluded of members.filter(({ entry }) => EXCLUDE.some((pattern) => pattern.test(entry)))) {
  console.log(`  note   left out ${excluded.entry} (repository-only tooling)`)
}
members.length = 0
members.push(...included)

for (const { entry, bytes } of members) {
  check(entry.includes('/') || !entry.startsWith('./'), `archive_member_path: ${entry} must be relative to the plugin root`)
  check(!entry.includes('\\'), `archive_member_path: ${entry} must use forward slashes`)
  check(!entry.split('/').includes('..'), `archive_member_path: ${entry} must not contain ".."`)
  check(!entry.split('/').some((s) => s === ''), `archive_member_path: ${entry} has an empty path segment`)
  check(entry === entry.trim(), `archive_member_path: ${entry} has leading or trailing whitespace`)
  check(entry.split('/').length <= LIMITS.pathDepth, `archive_member_path_too_deep: ${entry}`)
  check(bytes <= LIMITS.memberBytes, `archive_member_too_large: ${entry}`)
}

check(members.length + 1 <= LIMITS.entries, `archive_too_many_entries: ${members.length + 1} exceeds ${LIMITS.entries}`)

// -------------------------------------------------------------------- manifest

const manifest = JSON.parse(readFileSync(join(ROOT, 'plugin.json'), 'utf8'))
const iface = manifest.extensions?.['com.openai']?.interface ?? {}
const singleLine = (value) => typeof value === 'string' && !/[\r\n]/.test(value)

for (const field of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category']) {
  check(singleLine(iface[field]) || field === 'longDescription', `interface.${field} is required`)
}
check(singleLine(manifest.description), 'description is required at submission')

check(iface.displayName?.length <= LIMITS.displayName, `displayName is ${iface.displayName?.length} characters, limit ${LIMITS.displayName}`)
check(
  iface.shortDescription?.length <= LIMITS.shortDescription,
  `shortDescription is ${iface.shortDescription?.length} characters, limit ${LIMITS.shortDescription}`,
)
check(
  iface.longDescription?.length <= LIMITS.longDescription,
  `longDescription is ${iface.longDescription?.length} characters, limit ${LIMITS.longDescription}`,
)
check(
  iface.developerName?.length <= LIMITS.developerName,
  `developerName is ${iface.developerName?.length} characters, limit ${LIMITS.developerName}`,
)
check(
  (manifest.description?.length ?? 0) <= LIMITS.description,
  `description is ${manifest.description?.length} characters, limit ${LIMITS.description}`,
)

const CATEGORIES = [
  'Productivity', 'Creativity', 'Developer Tools', 'Business & Operations',
  'Data & Analytics', 'Communication', 'Education & Research', 'Security',
  'Finance', 'Healthcare', 'Travel', 'Entertainment', 'Other',
]
check(CATEGORIES.includes(iface.category), `category "${iface.category}" is not one of the published values`)

check(
  singleLine(manifest.author?.name) && !/your name|example\.com|placeholder/i.test(`${manifest.author?.name} ${manifest.author?.email}`),
  'author.name and author.email must be real values, not placeholders',
)
check(singleLine(iface.developerName) && !/your name/i.test(iface.developerName), 'developerName must not be a placeholder')

const capabilities = iface.capabilities ?? []
check(Array.isArray(capabilities), 'capabilities must be an array')
check(capabilities.length <= LIMITS.capabilityEntries, `capabilities has ${capabilities.length} entries, limit ${LIMITS.capabilityEntries}`)
for (const capability of capabilities) {
  check(singleLine(capability) && capability.length > 0, 'each capability must be a non-empty single line')
  check(capability.length <= LIMITS.capabilityLength, `capability "${capability}" exceeds ${LIMITS.capabilityLength} characters`)
}

const prompts = iface.defaultPrompt ?? []
check(Array.isArray(prompts), 'defaultPrompt must be a string or an array')
check(prompts.length <= LIMITS.defaultPrompts, `defaultPrompt has ${prompts.length} prompts, limit ${LIMITS.defaultPrompts}`)
check(
  new Set(prompts.map((p) => p.replace(/\s+/gu, ''))).size === prompts.length,
  'defaultPrompt entries must be unique after whitespace normalisation',
)
for (const prompt of prompts) {
  check(singleLine(prompt), `defaultPrompt "${prompt}" must be a single line`)
  check(prompt.length <= LIMITS.defaultPromptLength, `defaultPrompt entry is ${prompt.length} characters, limit ${LIMITS.defaultPromptLength}`)
  check(!/@\w/u.test(prompt), `defaultPrompt "${prompt}" must not contain an @mention`)
}

for (const field of ['brandColor', 'brandColorDark']) {
  const value = iface[field]
  if (value === undefined) continue
  check(/^#[0-9A-Fa-f]{6}$/u.test(value), `${field} "${value}" must be #RRGGBB`)
}
const luminance = (hex) => {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}
if (iface.brandColor) {
  const ratio = contrast(iface.brandColor, '#FFFFFF')
  check(ratio >= 2, `brandColor contrast against white is ${ratio.toFixed(2)}:1, minimum 2:1`)
}
if (iface.brandColorDark) {
  const ratio = contrast(iface.brandColorDark, '#212121')
  check(ratio >= 2, `brandColorDark contrast against #212121 is ${ratio.toFixed(2)}:1, minimum 2:1`)
}

// ----------------------------------------------------------------------- assets

for (const field of ['logo', 'composerIcon']) {
  const target = iface[field]
  if (target === undefined) continue
  check(target.startsWith('./'), `interface.${field} must start with "./"`)
  const absolute = join(ROOT, target.slice(2))
  let bytes
  try {
    bytes = readFileSync(absolute)
  } catch {
    fail(`interface.${field} points at ${target}, which is not in the package`)
    continue
  }
  check(bytes.length <= LIMITS.imageBytes, `interface.${field} is ${bytes.length} bytes, limit ${LIMITS.imageBytes}`)
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    check(width === height, `interface.${field} must be square, got ${width}x${height}`)
    check(width >= LIMITS.imageMinPx, `interface.${field} must be at least ${LIMITS.imageMinPx}px, got ${width}`)
    check(width <= LIMITS.imageMaxPx, `interface.${field} must be at most ${LIMITS.imageMaxPx}px, got ${width}`)
  }
}
if (!members.some((m) => m.entry === 'plugin.json')) fail('plugin.json must sit at the archive root')

// ----------------------------------------------------------------------- skills

const skillDirs = new Set(
  members.filter((m) => m.entry.startsWith('skills/')).map((m) => m.entry.split('/')[1]),
)
check(skillDirs.size > 0, 'the archive must contain at least one skill')
for (const skill of skillDirs) {
  const manifestEntry = `skills/${skill}/SKILL.md`
  const file = members.find((m) => m.entry === manifestEntry)
  if (!file) {
    fail(`skills/${skill} has no SKILL.md`)
    continue
  }
  const source = readFileSync(file.absolute, 'utf8')
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(source)
  if (!frontmatter) {
    fail(`${manifestEntry} has no YAML frontmatter`)
    continue
  }
  const name = /^name:\s*(.+)$/mu.exec(frontmatter[1])?.[1].trim()
  const description = /^description:\s*([\s\S]*?)(?=\r?\n[a-z_-]+:|\r?\n?$)/mu.exec(frontmatter[1])?.[1]
    .trim()
    .replace(/\s+/gu, ' ')
  check(name === skill, `${manifestEntry} declares name "${name}" but lives in "${skill}"`)
  check(Boolean(description), `${manifestEntry} has no description`)
  check(
    (description?.length ?? 0) <= LIMITS.skillDescription,
    `${manifestEntry} description is ${description?.length} characters, limit ${LIMITS.skillDescription}`,
  )
  const bodyLines = source.slice(frontmatter[0].length).split(/\r?\n/u).length
  if (bodyLines > LIMITS.skillLines) warn(`${manifestEntry} body is ${bodyLines} lines, over ${LIMITS.skillLines}`)
  const bundle = members.filter((m) => m.entry.startsWith(`skills/${skill}/`)).reduce((sum, m) => sum + m.bytes, 0)
  warn(`skills/${skill} bundle is ${(bundle / 1024).toFixed(1)} KiB (the portal enforces a per-skill MiB cap)`)
}

// ------------------------------------------------------------------- zip writer

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function buildZip(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const { name, data } of files) {
    const nameBytes = Buffer.from(name, 'utf8')
    const deflated = deflateRawSync(data, { level: 9 })
    const stored = deflated.length >= data.length
    const payload = stored ? data : deflated
    const method = stored ? 0 : 8
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBytes, payload)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(DOS_TIME, 12)
    central.writeUInt16LE(DOS_DATE, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(payload.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBytes)

    offset += local.length + nameBytes.length + payload.length
  }
  const centralBuffer = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, centralBuffer, end])
}

// ------------------------------------------------------------------------ main

const args = process.argv.slice(2)
const outIndex = args.indexOf('--out')
const outDir = outIndex === -1 ? join(ROOT, 'dist') : join(ROOT, args[outIndex + 1])

for (const finding of findings.filter((f) => f.level === 'error')) {
  console.error(`  error  ${finding.message}`)
}
for (const finding of findings.filter((f) => f.level === 'warn')) {
  console.log(`  warn   ${finding.message}`)
}
if (findings.some((f) => f.level === 'error')) {
  console.error(`\nFAILED - ${findings.filter((f) => f.level === 'error').length} blocking problem(s). Nothing written.`)
  process.exit(1)
}

const files = [
  ...members.map(({ entry, absolute }) => ({ name: entry, data: readFileSync(absolute) })),
]
const zip = buildZip(files)
const total = files.reduce((sum, f) => sum + f.data.length, 0)
check(zip.length <= LIMITS.archiveBytes, `archive_too_large: ${zip.length} bytes`)
check(total <= LIMITS.uncompressedBytes, `archive_uncompressed_too_large: ${total} bytes`)

mkdirSync(outDir, { recursive: true })
const target = join(outDir, `${manifest.name}-${manifest.version}.zip`)
writeFileSync(target, zip)

console.log(`\n${relative(process.cwd(), target) || target}`)
console.log(`  ${files.length} entries, ${(zip.length / 1024).toFixed(1)} KiB compressed, ${(total / 1024).toFixed(1)} KiB raw`)
console.log(`  skills: ${[...skillDirs].join(', ')}`)
console.log(`  left out: mcp.json, mcp/, tests/, and the dev manifests (submission is skills-only)`)
console.log('\nUpload this file at https://platform.openai.com/plugins. Remaining manual steps are in SUBMISSION.md.')
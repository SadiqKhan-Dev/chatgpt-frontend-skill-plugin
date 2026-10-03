import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseFrontmatter, FrontmatterError } from '../skills/frontend-skill-builder/scripts/lib/frontmatter.mjs'

test('parses the minimal documented shape', () => {
  const { data, body } = parseFrontmatter(
    ['---', 'name: my-skill', 'description: Does a thing. Use when relevant.', '---', '', '# Title'].join('\n'),
  )

  assert.equal(data.name, 'my-skill')
  assert.equal(data.description, 'Does a thing. Use when relevant.')
  assert.equal(body.trim(), '# Title')
})

test('parses a flat metadata map', () => {
  const { data } = parseFrontmatter(
    ['---', 'name: a-skill', 'description: A description that is long enough to be useful.', 'metadata:', '  version: "1.0.0"', '  technology: react', '---'].join('\n'),
  )

  assert.deepEqual(data.metadata, { version: '1.0.0', technology: 'react' })
})

test('parses every documented optional key', () => {
  const { data } = parseFrontmatter(
    [
      '---',
      'name: a-skill',
      'description: A description that is long enough to be useful.',
      'license: Proprietary',
      'compatibility: Requires Node.js 20 or newer.',
      'allowed-tools: Bash(node:*) Read',
      'metadata:',
      '  plugin: example',
      '---',
    ].join('\n'),
  )

  assert.equal(data.license, 'Proprietary')
  assert.equal(data.compatibility, 'Requires Node.js 20 or newer.')
  assert.equal(data['allowed-tools'], 'Bash(node:*) Read')
  assert.deepEqual(data.metadata, { plugin: 'example' })
})

test('handles CRLF line endings', () => {
  const { data } = parseFrontmatter(
    '---\r\nname: a-skill\r\ndescription: A description that is long enough.\r\n---\r\n\r\n# Title\r\n',
  )
  assert.equal(data.name, 'a-skill')
})

test('preserves a colon inside a quoted value', () => {
  const { data } = parseFrontmatter(
    ['---', 'name: a-skill', 'description: "Use when: the thing matters."', '---'].join('\n'),
  )
  assert.equal(data.description, 'Use when: the thing matters.')
})

test('rejects a missing opening delimiter', () => {
  assert.throws(() => parseFrontmatter('name: a-skill\n'), FrontmatterError)
})

test('rejects a missing closing delimiter', () => {
  assert.throws(() => parseFrontmatter('---\nname: a-skill\n'), /closing/)
})

test('rejects an unknown frontmatter key rather than guessing', () => {
  assert.throws(
    () => parseFrontmatter(['---', 'name: a-skill', 'description: d', 'tools: [Read]', '---'].join('\n')),
    /unsupported frontmatter key "tools"/,
  )
})

test('rejects an inline flow collection instead of mis-parsing it', () => {
  assert.throws(
    () => parseFrontmatter(['---', 'name: a-skill', 'description: d', 'license: [a, b]', '---'].join('\n')),
    FrontmatterError,
  )
})

test('rejects a block scalar', () => {
  assert.throws(
    () => parseFrontmatter(['---', 'name: a-skill', 'description: |', '  text', '---'].join('\n')),
    /block scalar/,
  )
})

test('rejects a nested metadata map', () => {
  assert.throws(
    () =>
      parseFrontmatter(
        ['---', 'name: a-skill', 'description: d', 'metadata:', '  nested:', '    deep: "1"', '---'].join('\n'),
      ),
    FrontmatterError,
  )
})

test('rejects an empty metadata map', () => {
  assert.throws(
    () => parseFrontmatter(['---', 'name: a-skill', 'description: d', 'metadata:', '---'].join('\n')),
    /at least one entry/,
  )
})

test('rejects a duplicate key', () => {
  assert.throws(
    () => parseFrontmatter(['---', 'name: a-skill', 'name: b-skill', 'description: d', '---'].join('\n')),
    /duplicate/,
  )
})

test('reports the line number of a problem', () => {
  try {
    parseFrontmatter(['---', 'name: a-skill', 'description: d', 'oops', '---'].join('\n'))
    assert.fail('expected a FrontmatterError')
  } catch (error) {
    assert.ok(error instanceof FrontmatterError)
    assert.equal(error.line, 4)
  }
})
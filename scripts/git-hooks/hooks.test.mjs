import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const source = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const zero = '0'.repeat(40)
const fakeToken = [
  'ghp',
  '_',
  createHash('sha256')
    .update('hook-test-not-a-real-credential')
    .digest('hex')
    .slice(0, 36),
].join('')

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webapp-hooks-test-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const log = path.join(directory, 'checks.jsonl')
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', HOOK_TEST_LOG: log }
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_PREFIX',
    'GIT_COMMON_DIR',
  ])
    delete env[key]
  delete env.SKIP_PRE_PUSH
  const command = (program, args, options = {}) =>
    spawnSync(program, args, {
      cwd: directory,
      env,
      encoding: 'utf8',
      ...options,
    })
  const ok = (result) => {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    return result.stdout.trim()
  }
  const git = (...args) => ok(command('git', args))
  const write = (file, text, executable = false) => {
    const target = path.join(directory, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, text, { mode: executable ? 0o755 : 0o644 })
  }
  const copy = (file) => {
    const target = path.join(directory, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.cpSync(path.join(source, file), target, { recursive: true })
  }
  const recorder = (name) => `#!/usr/bin/env node
const fs = require('node:fs')
const cp = require('node:child_process')
const args = process.argv.slice(2)
const files = args.filter((arg) => fs.existsSync(arg) && fs.statSync(arg).isFile())
const contents = files.map((file) => fs.readFileSync(file, 'utf8'))
fs.appendFileSync(process.env.HOOK_TEST_LOG, JSON.stringify({name: ${JSON.stringify(name)}, args, cwd: process.cwd(), contents, head: cp.execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim()})+'\\n')
if (args.includes('--write') || args.includes('--fix') || contents.some((content) => content.includes('BAD_FORMAT'))) process.exit(1)
`
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.name', 'Hook Test')
  git('config', 'user.email', 'hook-test@example.invalid')
  git('config', 'core.hooksPath', '.githooks')
  for (const file of [
    '.githooks/pre-commit',
    '.githooks/pre-push',
    'scripts/git-hooks/pre-commit.sh',
    'scripts/git-hooks/pre-push.sh',
    'scripts/git-hooks/pre-push.mjs',
    'scripts/qa/error-code-sync.sh',
    'scripts/qa/secrets.sh',
    'scripts/gen-error-codes.mjs',
    'scripts/qa/skill-health.mjs',
    '.agents/skills',
  ])
    copy(file)
  write('.gitignore', 'web/node_modules/\nchecks.jsonl\n')
  write('README.md', '# Hook fixture\n')
  write('web/src/example.js', 'export const value = 1\n')
  write(
    'server/internal/errcode/catalog.go',
    'Invalid = Definition{Name: "Invalid", Code: 40001, Message: "Invalid"}\n'
  )
  fs.mkdirSync(path.join(directory, 'web/src/common/consts'), {
    recursive: true,
  })
  ok(command(process.execPath, ['scripts/gen-error-codes.mjs']))
  for (const name of [
    'shellcheck',
    'error-codes',
    'go-vet',
    'golangci-lint',
    'yamllint',
  ]) {
    write(
      `scripts/qa/${name}.sh`,
      `#!/usr/bin/env bash\nset -euo pipefail\nnode scripts/qa/record.cjs ${name} "$@"\n`,
      true
    )
  }
  write('scripts/qa/record.cjs', recorder('qa'))
  write(
    'scripts/qa/shfmt.sh',
    '#!/usr/bin/env bash\nset -euo pipefail\n[[ "${SHFMT_CHECK:-}" == 1 ]]\nnode scripts/qa/record.cjs shfmt "$@"\n',
    true
  )
  write(
    'scripts/qa/full.sh',
    '#!/usr/bin/env bash\nset -euo pipefail\nnode scripts/qa/record.cjs full README.md\n',
    true
  )
  for (const name of ['prettier', 'eslint'])
    write(`web/node_modules/.bin/${name}`, recorder(name), true)
  const commit = () => {
    git('add', '--all')
    git(
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '--quiet',
      '-m',
      'test: fixture'
    )
    return git('rev-parse', 'HEAD')
  }
  const base = commit()
  const events = () =>
    fs.existsSync(log)
      ? fs
          .readFileSync(log, 'utf8')
          .trim()
          .split('\n')
          .filter(Boolean)
          .map(JSON.parse)
      : []
  const state = () => ({
    index: fs
      .readFileSync(path.join(directory, '.git/index'))
      .toString('base64'),
    staged: git('diff', '--cached', '--binary'),
    unstaged: git('diff', '--binary'),
  })
  const push = (lines) =>
    command('bash', ['.githooks/pre-push', 'test-remote', 'unused'], {
      input: lines.join('\n') + '\n',
    })
  const ref = (local, remote = base, name = 'main') =>
    `refs/heads/${name} ${local} refs/heads/${name} ${remote}`
  return {
    directory,
    write,
    git,
    command,
    ok,
    commit,
    base,
    events,
    state,
    push,
    ref,
  }
}

test('pre-commit checks staged content and preserves partially staged hunks and index bytes', (t) => {
  const f = fixture(t)
  f.write('web/src/example.js', 'export const value = 2\n')
  f.git('add', 'web/src/example.js')
  f.write('web/src/example.js', 'BAD_FORMAT unstaged work\n')
  const before = f.state()
  f.ok(f.command('bash', ['.githooks/pre-commit']))
  assert.deepEqual(f.state(), before)
  const prettier = f.events().find((entry) => entry.name === 'prettier')
  assert.ok(prettier.args.includes('--check'))
  assert.deepEqual(prettier.contents, ['export const value = 2\n'])
  assert.notEqual(prettier.cwd, path.join(f.directory, 'web'))
})

test('pre-commit rejects broken staged content even when the working file is fixed', (t) => {
  const f = fixture(t)
  f.write('web/src/example.js', 'BAD_FORMAT staged\n')
  f.git('add', 'web/src/example.js')
  f.write('web/src/example.js', 'export const value = 2\n')
  const before = f.state()
  assert.notEqual(f.command('bash', ['.githooks/pre-commit']).status, 0)
  assert.deepEqual(f.state(), before)
})

test('pre-commit blocks staged generator drift without regenerating or staging the working result', (t) => {
  const f = fixture(t)
  f.write(
    'server/internal/errcode/catalog.go',
    'Invalid = Definition{Name: "Invalid", Code: 40002, Message: "Invalid"}\n'
  )
  f.git('add', 'server/internal/errcode/catalog.go')
  f.ok(f.command(process.execPath, ['scripts/gen-error-codes.mjs']))
  const before = f.state()
  const result = f.command('bash', ['.githooks/pre-commit'])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /生成文件未同步/u)
  assert.deepEqual(f.state(), before)
})

test('pre-commit scans staged secrets as files, including when the working copy is clean', (t) => {
  const f = fixture(t)
  f.write('README.md', `token: ${fakeToken}\n`)
  f.git('add', 'README.md')
  f.write('README.md', '# Safe working copy\n')
  const before = f.state()
  assert.notEqual(f.command('bash', ['.githooks/pre-commit']).status, 0)
  assert.deepEqual(f.state(), before)
})

test('docs push validates the requested commit while leaving a different HEAD and dirty index intact', (t) => {
  const f = fixture(t)
  f.write('README.md', '# Documentation update\n')
  const docs = f.commit()
  f.write('server/feature.go', 'package server\n')
  f.commit()
  f.write('README.md', '# Staged work\n')
  f.git('add', 'README.md')
  f.write('README.md', '# Unstaged work\n')
  const before = f.state()
  const result = f.push([f.ref(docs)])
  f.ok(result)
  assert.match(result.stdout, /profile=docs/u)
  assert.match(result.stdout, /skill-health.*status=ok/u)
  assert.equal(f.events().length, 0)
  assert.deepEqual(f.state(), before)
})

test('skill metadata uses the light profile and is validated from the pushed tree', (t) => {
  const f = fixture(t)
  const metadata =
    '.agents/skills/webapp-template-test-governance/agents/openai.yaml'
  const original = fs.readFileSync(path.join(f.directory, metadata), 'utf8')
  f.write(
    metadata,
    original.replace(/short_description:.*/u, 'short_description: "x"')
  )
  const bad = f.commit()
  f.write(metadata, original)
  const result = f.push([f.ref(bad)])
  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /profile=docs/u)
  assert.match(result.stderr, /short_description length/u)
  assert.equal(f.events().length, 0)
})

test('code, dependencies, CI, skill scripts and unknown paths retain full checks', async (t) => {
  for (const file of [
    'server/feature.go',
    'web/pnpm-lock.yaml',
    '.github/workflows/ci.yml',
    '.agents/skills/example/scripts/run.sh',
    'unknown.conf',
  ]) {
    await t.test(file, (sub) => {
      const f = fixture(sub)
      f.write(file, 'test content\n')
      const tip = f.commit()
      const result = f.push([f.ref(tip)])
      f.ok(result)
      assert.match(result.stdout, /profile=full/u)
      const full = f.events().find((entry) => entry.args[0] === 'full')
      assert.equal(full.head, tip)
      assert.notEqual(full.cwd, f.directory)
    })
  }
})

test('full checks read the pushed commit rather than a different HEAD or working copy', (t) => {
  const f = fixture(t)
  f.write('server/feature.go', 'package server\n')
  f.write('README.md', '# Candidate\n')
  const candidate = f.commit()
  f.write('README.md', 'BAD_FORMAT later commit\n')
  f.commit()
  f.write('README.md', 'BAD_FORMAT working file\n')
  const before = f.state()
  f.ok(f.push([f.ref(candidate)]))
  const full = f.events().find((entry) => entry.args[0] === 'full')
  assert.equal(full.head, candidate)
  assert.deepEqual(full.contents, ['# Candidate\n'])
  assert.deepEqual(f.state(), before)
})

test('multiple refs are checked independently, while deletions perform no content checks', (t) => {
  const f = fixture(t)
  f.write('README.md', '# Docs\n')
  const docs = f.commit()
  f.write('server/feature.go', 'package server\n')
  const code = f.commit()
  const result = f.push([
    f.ref(docs, f.base, 'docs'),
    f.ref(code, docs, 'code'),
    f.ref(zero, f.base, 'removed'),
  ])
  f.ok(result)
  assert.equal((result.stdout.match(/profile=docs/gu) || []).length, 1)
  assert.equal((result.stdout.match(/profile=full/gu) || []).length, 1)
  assert.equal(f.events().filter((entry) => entry.args[0] === 'full').length, 1)
  const removed = fixture(t)
  f.ok(removed.push([removed.ref(zero)]))
  assert.equal(removed.events().length, 0)
})

test('new refs and executable Markdown retain full checks', async (t) => {
  await t.test('new ref', (sub) => {
    const f = fixture(sub)
    f.write('README.md', '# New branch\n')
    const result = f.push([f.ref(f.commit(), zero)])
    f.ok(result)
    assert.match(result.stdout, /profile=full（新 ref）/u)
  })
  await t.test('executable Markdown', (sub) => {
    const f = fixture(sub)
    fs.chmodSync(path.join(f.directory, 'README.md'), 0o755)
    const result = f.push([f.ref(f.commit())])
    f.ok(result)
    assert.match(result.stdout, /profile=full/u)
  })
})

test('renaming code to Markdown and reverting code do not hide changes from the profile', async (t) => {
  for (const kind of ['rename', 'revert']) {
    await t.test(kind, (sub) => {
      const f = fixture(sub)
      f.write('server/feature.go', 'package server\n')
      const codeBase = f.commit()
      if (kind === 'rename') {
        fs.mkdirSync(path.join(f.directory, 'docs'))
        f.git('mv', 'server/feature.go', 'docs/feature.md')
      } else fs.unlinkSync(path.join(f.directory, 'server/feature.go'))
      const result = f.push([
        f.ref(f.commit(), kind === 'rename' ? codeBase : f.base),
      ])
      f.ok(result)
      assert.match(result.stdout, /profile=full/u)
    })
  }
})

test('a secret removed by a later docs commit still blocks the push', (t) => {
  const f = fixture(t)
  f.write('README.md', `token: ${fakeToken}\n`)
  f.commit()
  f.write('README.md', '# Removed token\n')
  const result = f.push([f.ref(f.commit())])
  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /profile=docs/u)
  assert.match(result.stderr, /gitleaks/u)
  assert.ok(!result.stderr.includes(fakeToken))
})

test('a checker cannot silently repair the pushed candidate before reporting success', (t) => {
  const f = fixture(t)
  f.write(
    'scripts/qa/full.sh',
    '#!/usr/bin/env bash\nset -euo pipefail\nprintf "autofixed\\n" >> README.md\n',
    true
  )
  const tip = f.commit()
  const before = f.state()
  const result = f.push([f.ref(tip)])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /检查器改写了推送快照/u)
  assert.deepEqual(f.state(), before)
})

test('unknown remote objects and non-fast-forward branch updates fail closed', (t) => {
  const f = fixture(t)
  f.write('README.md', '# Next\n')
  const tip = f.commit()
  assert.notEqual(f.push([f.ref(tip, '1'.repeat(40))]).status, 0)
  assert.notEqual(f.push([f.ref(f.base, tip)]).status, 0)
  assert.equal(f.events().length, 0)
})

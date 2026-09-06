#!/usr/bin/env node

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' }

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  })
  if (result.error || result.status !== 0) {
    throw new Error(
      result.error?.message ||
        `${command} 检查失败（exit ${result.status}）${options.quiet ? '' : `\n${result.stderr || ''}`}`
    )
  }
  return result.stdout || ''
}

function git(args, options) {
  return run('git', args, options)
}

// 临时验证仓库不能继承调用方的 index、worktree 或对象目录。
for (const key of git(['rev-parse', '--local-env-vars']).trim().split('\n'))
  delete env[key]

function isDocumentation(file) {
  return (
    /^(README|AGENTS|CHANGELOG|progress)\.md$/u.test(file) ||
    /^(docs\/.*|scripts\/README|server\/README|web\/README)\.md$/u.test(file) ||
    /^\.agents\/skills\/README\.md$/u.test(file) ||
    /^\.agents\/skills\/[^/]+\/(SKILL\.md|agents\/openai\.yaml|references\/.*\.md)$/u.test(
      file
    )
  )
}

function profileFor(range) {
  // 包括中间提交、删除和重命名前的路径，避免净 diff 掩盖曾推入的代码。
  const records = git([
    'log',
    '--format=',
    '--raw',
    '-z',
    '--no-renames',
    '-m',
    range,
  ]).split('\0')
  for (let index = 0; index < records.length; index += 1) {
    if (!records[index].trim()) continue
    const header = records[index]
      .trim()
      .match(/^:([0-7]{6}) ([0-7]{6}) [0-9a-f]+ [0-9a-f]+ [A-Z]$/u)
    const file = records[++index]
    if (!header || !file || !isDocumentation(file)) return 'full'
    if (header.slice(1).some((mode) => !['000000', '100644'].includes(mode)))
      return 'full'
  }
  return 'docs'
}

function snapshot(commit) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webapp-pre-push-'))
  try {
    const format = git(['rev-parse', '--show-object-format']).trim()
    git(['init', '--quiet', `--object-format=${format}`, directory])
    const objects = path.resolve(
      root,
      git(['rev-parse', '--git-path', 'objects']).trim()
    )
    if (/[\r\n]/u.test(objects)) throw new Error('Git 对象路径不能包含换行')
    fs.writeFileSync(
      path.join(directory, '.git/objects/info/alternates'),
      `${objects}\n`
    )
    git(['update-ref', '--no-deref', 'HEAD', commit], { cwd: directory })
    git(['read-tree', commit], { cwd: directory })
    git(['checkout-index', '--all'], { cwd: directory })
    return directory
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true })
    throw error
  }
}

function checkUpdate(line) {
  const fields = line.trim().split(/\s+/u)
  if (fields.length !== 4 || !fields[2].startsWith('refs/'))
    throw new Error('无效的 pre-push ref 输入')
  const [, local, remoteRef, remote] = fields
  if (
    ![local, remote].every((oid) =>
      /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(oid)
    )
  ) {
    throw new Error('无效的 Git 对象 ID')
  }
  if (/^0+$/u.test(local) || local === remote) return

  const commit = git(['rev-parse', '--verify', `${local}^{commit}`]).trim()
  const isNew = /^0+$/u.test(remote)
  let base
  if (!isNew) {
    try {
      base = git(['rev-parse', '--verify', `${remote}^{commit}`]).trim()
    } catch {
      throw new Error(`${remoteRef} 的远端提交不在本地；请先 fetch 对应 remote`)
    }
    if (remoteRef.startsWith('refs/heads/'))
      git(['merge-base', '--is-ancestor', base, commit])
  }
  const range = isNew ? commit : `${base}..${commit}`
  const profile = isNew ? 'full' : profileFor(range)
  console.log(
    `[pre-push] ${process.argv[2] || 'remote'} ${remoteRef} ${commit.slice(0, 12)} profile=${profile}${isNew ? '（新 ref）' : ''}`
  )
  const directory = snapshot(commit)
  try {
    const diffBase =
      base ||
      git(['hash-object', '-w', '-t', 'tree', '--stdin'], {
        cwd: directory,
        input: '',
      }).trim()
    git(['diff', '--check', diffBase, commit], {
      cwd: directory,
      stdio: 'inherit',
    })

    // 扫描这次推送的提交历史；只扫描最终文件会漏掉已在中间提交删除的密钥。
    run(
      'gitleaks',
      ['git', '--no-banner', '--redact', `--log-opts=${range}`, directory],
      {
        cwd: directory,
        quiet: true,
      }
    )
    const checkEnv = {
      ...env,
      QA_BASE_RANGE: `${diffBase}..${commit}`,
      SKIP_SECRETS_SCAN: '0',
      SECRETS_STRICT: '1',
      SKIP_SHELLCHECK: '0',
      SHELLCHECK_STRICT: '1',
    }
    if (profile === 'docs') {
      run(process.execPath, ['scripts/qa/skill-health.mjs'], {
        cwd: directory,
        env: checkEnv,
        stdio: 'inherit',
      })
    } else {
      const dependencies = path.join(root, 'web/node_modules')
      const target = path.join(directory, 'web/node_modules')
      if (fs.existsSync(dependencies)) {
        if (
          fs.existsSync(target) ||
          fs.lstatSync(path.dirname(target)).isSymbolicLink()
        ) {
          throw new Error(
            '推送快照不得跟踪 web/node_modules 或以符号链接替代 web'
          )
        }
        fs.symlinkSync(dependencies, target, 'dir')
      }
      run('bash', ['scripts/qa/shellcheck.sh'], {
        cwd: directory,
        env: checkEnv,
        stdio: 'inherit',
      })
      run('bash', ['scripts/qa/full.sh'], {
        cwd: directory,
        env: checkEnv,
        stdio: 'inherit',
      })
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

try {
  for (const line of fs
    .readFileSync(0, 'utf8')
    .split('\n')
    .filter((entry) => entry.trim()))
    checkUpdate(line)
  console.log(
    '[pre-push] 完成（仅校验实际推送的 ref，未改写当前工作区或 index）'
  )
} catch (error) {
  console.error(`[pre-push] ${error.message}`)
  process.exitCode = 1
}

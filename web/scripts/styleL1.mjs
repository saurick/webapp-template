import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

import { chromium } from 'playwright'

const webDir = path.resolve(import.meta.dirname, '..')
const outputDir = path.resolve(webDir, 'output', 'playwright', 'style-l1')
const devServerPort = Number(process.env.STYLE_L1_PORT || 4173)
const externalBaseURL = String(process.env.STYLE_L1_BASE_URL || '').trim()
const baseURL = externalBaseURL || `http://127.0.0.1:${devServerPort}`
const headless = process.env.HEADED !== '1'

let devServerProcess = null
let devServerLogs = ''

const scenarios = [
  {
    name: 'home-desktop',
    path: '/',
    viewport: { width: 1440, height: 900 },
    verify: async (page) => {
      await expectHeading(page, '欢迎回来，访客')
      await expectRole(page, 'link', '登录')
      await expectRole(page, 'link', '注册')
      await expectNoText(page, '管理员登录')
    },
  },
  {
    name: 'home-mobile',
    path: '/',
    viewport: { width: 390, height: 844 },
    verify: async (page) => {
      await expectHeading(page, '欢迎回来，访客')
      await expectRole(page, 'link', '登录')
      await expectRole(page, 'link', '注册')
      await expectNoText(page, '管理员登录')
    },
  },
  {
    name: 'login-desktop',
    path: '/login',
    viewport: { width: 1280, height: 800 },
    verify: async (page) => {
      await expectText(page, '用户登录')
      await expectRole(page, 'button', '登录')
      await expectRole(page, 'link', '注册')
      await expectNoText(page, '管理员登录')
    },
  },
  {
    name: 'register-mobile',
    path: '/register',
    viewport: { width: 390, height: 844 },
    verify: async (page) => {
      await expectText(page, '用户注册')
      await expectRole(page, 'button', '注册并登录')
      await expectNoText(page, '管理员登录')
    },
  },
  {
    name: 'admin-login-mobile',
    path: '/admin-login',
    viewport: { width: 390, height: 844 },
    verify: async (page) => {
      await expectText(page, '管理员登录')
      await expectRole(page, 'button', '管理员登录')
      await expectText(page, '普通用户账号不可登录后台')
      await expectNoText(page, '用户注册')
    },
  },
  {
    name: 'admin-menu-redirect',
    path: '/admin-menu',
    viewport: { width: 1280, height: 800 },
    expectPath: '/admin-login',
    verify: async (page) => {
      await expectText(page, '管理员登录')
      await expectRole(page, 'button', '管理员登录')
      await expectNoText(page, '用户注册')
    },
  },
  {
    name: 'admin-menu-auth-desktop',
    path: '/admin-menu',
    viewport: { width: 1280, height: 800 },
    setup: seedAdminAuth,
    verify: async (page) => {
      await expectText(page, 'Admin Preset')
      await expectText(page, '管理控制台')
      await expectText(page, '账号目录')
      await expectText(page, '角色权限')
    },
  },
  {
    name: 'admin-menu-stale-auth-recovers',
    path: '/admin-menu',
    viewport: { width: 1280, height: 800 },
    setup: seedStaleAdminAuth,
    verify: async (page) => {
      await expectText(page, 'admin')
      await expectText(page, '账号目录')
      await expectText(page, '角色权限')
      const permissions = await page.evaluate(() =>
        JSON.parse(window.localStorage.getItem('admin_permissions') || '[]')
      )
      assert(permissions.includes('admin.user.read'))
      assert(permissions.includes('admin.rbac.read'))
    },
  },
  {
    name: 'admin-accounts-auth-desktop',
    path: '/admin-accounts',
    viewport: { width: 1366, height: 900 },
    setup: seedAdminAuth,
    verify: async (page) => {
      await expectText(page, '账号目录')
      await expectText(page, 'demo_user')
      await expectText(page, '共 8 条')
    },
  },
  {
    name: 'admin-rbac-auth-mobile',
    path: '/admin-rbac',
    viewport: { width: 390, height: 844 },
    setup: seedAdminAuth,
    verify: async (page) => {
      await expectText(page, '角色权限')
      await expectText(page, 'super_admin')
      await expectText(page, 'admin.user.read')
    },
  },
]

async function main() {
  await fs.mkdir(outputDir, { recursive: true })

  try {
    if (!externalBaseURL) {
      devServerProcess = startDevServer()
      await waitForServer(baseURL)
    }

    const browser = await chromium.launch({ headless })
    try {
      for (const scenario of scenarios) {
        await runScenario(browser, scenario)
      }
    } finally {
      await browser.close()
    }

    console.log(`[style:l1] 通过，共验证 ${scenarios.length} 个场景`)
  } finally {
    await stopDevServer()
  }
}

function startDevServer() {
  const child = spawn(
    'pnpm',
    [
      'exec',
      'vite',
      '--host',
      '127.0.0.1',
      '--port',
      String(devServerPort),
      '--strictPort',
    ],
    {
      cwd: webDir,
      env: {
        ...process.env,
        BROWSER: 'none',
        VITE_ENABLE_RPC_MOCK: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )

  child.stdout.on('data', (chunk) => {
    devServerLogs += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    devServerLogs += chunk.toString()
  })

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      devServerLogs += `\n[vite exited with code ${code}]`
    }
  })

  return child
}

async function stopDevServer() {
  if (!devServerProcess) {
    return
  }

  if (devServerProcess.exitCode === null) {
    devServerProcess.kill('SIGTERM')
    await Promise.race([
      new Promise((resolve) => devServerProcess.once('exit', resolve)),
      delay(3000),
    ])
  }

  if (devServerProcess.exitCode === null) {
    devServerProcess.kill('SIGKILL')
  }

  devServerProcess = null
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000
  let lastError = 'server did not become ready'

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
      })
      if (response.ok || response.status === 302 || response.status === 304) {
        return
      }
      lastError = `unexpected status ${response.status}`
    } catch (error) {
      lastError = error.message
    }
    await delay(300)
  }

  throw new Error(
    `[style:l1] 无法启动前端预览：${lastError}\n最近 vite 输出：\n${tailLogs(devServerLogs)}`
  )
}

async function runScenario(browser, scenario) {
  const page = await browser.newPage({ viewport: scenario.viewport })
  const errors = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console error: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    errors.push(`page error: ${error.message}`)
  })

  try {
    if (scenario.setup) {
      await scenario.setup(page)
    }
    await page.goto(new URL(scenario.path, `${baseURL}/`).toString(), {
      waitUntil: 'domcontentloaded',
    })
    await delay(300)

    if (scenario.expectPath) {
      await waitForPath(page, scenario.expectPath)
    }

    await scenario.verify(page)
    await assertNoHorizontalOverflow(page, scenario.name)
    assert.deepEqual(errors, [], `${scenario.name} 出现控制台或运行时错误`)

    const screenshotPath = path.resolve(outputDir, `${scenario.name}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
  } catch (error) {
    throw new Error(
      `[style:l1] 场景失败: ${scenario.name}\n${error.message}\n最近 vite 输出：\n${tailLogs(devServerLogs)}`
    )
  } finally {
    await page.close()
  }
}

async function waitForPath(page, expectedPath) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (new URL(page.url()).pathname === expectedPath) {
      return
    }
    await delay(100)
  }
  assert.equal(new URL(page.url()).pathname, expectedPath)
}

async function expectHeading(page, text) {
  const locator = page.getByRole('heading', { name: text })
  await locator.waitFor({ state: 'visible', timeout: 10_000 })
}

async function expectRole(page, role, name) {
  const locator = page.getByRole(role, { name }).first()
  await locator.waitFor({ state: 'visible', timeout: 10_000 })
}

async function expectText(page, text) {
  const locator = page.getByText(text, { exact: false })
  await locator.first().waitFor({ state: 'visible', timeout: 10_000 })
}

async function expectNoText(page, text) {
  const count = await page.getByText(text, { exact: false }).count()
  assert.equal(count, 0, `不应出现文本：${text}`)
}

async function seedAdminAuth(page) {
  await page.addInitScript(() => {
    const payload = {
      uid: 1,
      uname: 'admin',
      role: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }
    const token = `${window.btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${window.btoa(JSON.stringify(payload))}.mock`
    window.localStorage.setItem('admin_access_token', token)
    window.localStorage.setItem('admin_user_id', '1')
    window.localStorage.setItem('admin_username', 'admin')
    window.localStorage.setItem('admin_roles', JSON.stringify(['super_admin']))
    window.localStorage.setItem(
      'admin_permissions',
      JSON.stringify([
        'admin.access',
        'admin.user.read',
        'admin.user.write',
        'admin.rbac.read',
      ])
    )
  })
}

async function seedStaleAdminAuth(page) {
  await page.addInitScript(() => {
    const payload = {
      uid: 1,
      uname: 'admin',
      role: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }
    const token = `${window.btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${window.btoa(JSON.stringify(payload))}.mock`
    window.localStorage.setItem('admin_access_token', token)
    window.localStorage.setItem('admin_user_id', '1')
    window.localStorage.setItem('admin_username', 'admin')
    window.localStorage.removeItem('admin_roles')
    window.localStorage.removeItem('admin_permissions')
  })
}

async function assertNoHorizontalOverflow(page, scenarioName) {
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  assert(
    metrics.bodyScrollWidth <= metrics.viewportWidth + 2,
    `${scenarioName} body 出现横向溢出: ${JSON.stringify(metrics)}`
  )
  assert(
    metrics.docScrollWidth <= metrics.viewportWidth + 2,
    `${scenarioName} document 出现横向溢出: ${JSON.stringify(metrics)}`
  )
}

function tailLogs(text) {
  return text.trim().split('\n').slice(-20).join('\n')
}

await main()

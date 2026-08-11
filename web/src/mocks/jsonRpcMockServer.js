// src/mocks/jsonRpcMockServer.js

let originalFetch = null

const MOCK_ADMIN_PERMISSIONS = [
  'admin.access',
  'admin.user.read',
  'admin.user.write',
  'admin.rbac.read',
]

const nowTs = () => Math.floor(Date.now() / 1000)

const MOCK_USERS = [
  ['admin', false, 3600, 120],
  ['ops01', false, 7200, 180],
  ['dev01', false, 86400, 2400],
  ['dev02', false, 93600, 5400],
  ['qa01', false, 120000, 9000],
  ['readonly', true, 220000, 60000],
  ['demo_user', false, 260000, 1200],
  ['alice', false, 300000, 8200],
]

const MOCK_ROLES = [
  {
    id: 1,
    key: 'super_admin',
    name: '超级管理员',
    description: '模板内置最高权限角色，初始化管理员默认绑定',
    builtin: true,
    admin_count: 1,
    permission_keys: MOCK_ADMIN_PERMISSIONS,
  },
  {
    id: 2,
    key: 'ops_admin',
    name: '运营管理员',
    description: '可查看账号目录并执行基础账号操作',
    builtin: true,
    admin_count: 2,
    permission_keys: ['admin.access', 'admin.user.read', 'admin.user.write'],
  },
  {
    id: 3,
    key: 'readonly_auditor',
    name: '只读审计',
    description: '可查看后台信息，不具备写操作权限',
    builtin: true,
    admin_count: 1,
    permission_keys: ['admin.access', 'admin.user.read', 'admin.rbac.read'],
  },
]

const MOCK_PERMISSIONS = [
  ['admin.access', '后台访问', '系统', '允许进入后台控制台'],
  ['admin.user.read', '查看账号', '账号', '查看普通用户账号目录'],
  ['admin.user.write', '管理账号', '账号', '启用或禁用普通用户账号'],
  ['admin.rbac.read', '查看 RBAC', '权限', '查看角色与权限码概览'],
  ['admin.health.read', '查看健康检查', '运维', '查看 healthz / readyz 状态'],
  ['admin.deploy.read', '查看部署基线', '部署', '查看 Compose 与 lab-ha 边界'],
]

const MOCK_WORK_ITEMS = [
  {
    id: 'WQ-1001',
    title: '确认客户资料',
    summary: '资料已提交，等待业务人员核对。',
    status: 'pending',
    status_label: '待处理',
    tone: 'warning',
    updated_at: nowTs() - 600,
    version: 1,
  },
  {
    id: 'WQ-1002',
    title: '处理异常记录',
    summary: '上一步返回异常，需要人工确认后继续。',
    status: 'risk',
    status_label: '需关注',
    tone: 'danger',
    updated_at: nowTs() - 1800,
    version: 3,
  },
  {
    id: 'WQ-0998',
    title: '复核完成结果',
    summary: '事项已完成，可查看最终回执。',
    status: 'completed',
    status_label: '已完成',
    tone: 'success',
    updated_at: nowTs() - 7200,
    version: 2,
  },
]

function mockWorkItemDetail(item) {
  return {
    ...item,
    description:
      item.status === 'completed'
        ? '该事项已经处理完成，当前只保留结果查看。'
        : '请核对事项摘要和来源信息，再选择允许执行的动作。',
    fields: [
      { label: '事项编号', value: item.id },
      { label: '当前状态', value: item.status_label },
      {
        label: '更新时间',
        value: new Date(item.updated_at * 1000).toLocaleString('zh-CN'),
      },
      { label: '数据来源', value: '开发环境 JSON-RPC Mock' },
    ],
    actions:
      item.status === 'completed'
        ? []
        : [
            {
              key: 'complete',
              label: '标记完成',
              confirm_text: '确认资料已经核对完成，并提交本次处理结果吗？',
              tone: 'primary',
            },
          ],
  }
}

function makeMockJwt({ uid = 1, uname = 'admin', role = 1 } = {}) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      uid,
      uname,
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  )
  return `${header}.${payload}.mock`
}

// 构造一个 JSON-RPC 成功响应
function makeJsonRpcSuccess(id, payload = {}) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      code: 0,
      message: 'OK',
      ...payload, // 比如 { ping: {...} } / { login: {...} }
    },
    error: '',
  }
}

// 构造一个 JSON-RPC 业务错误响应（code != 0）
function makeJsonRpcBizError(id, code, message) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      code,
      message,
    },
    error: '',
  }
}

/**
 * 启用浏览器端 JSON-RPC mock server
 * 拦截 /rpc/** 的请求
 */
export function setupJsonRpcMockServer() {
  if (typeof window === 'undefined') return
  if (originalFetch) return // 已经装过了

  originalFetch = window.fetch.bind(window)

  window.fetch = async (input, init = {}) => {
    let url

    // 兼容 fetch('/rpc/...') 和 fetch(new Request(...))
    if (typeof input === 'string') {
      url = input
    } else if (input && typeof input.url === 'string') {
      url = input.url
    } else {
      return originalFetch(input, init)
    }

    const u = new URL(url, window.location.origin)

    // 只拦截 /rpc/**，其他请求照旧走原 fetch
    if (!u.pathname.startsWith('/rpc')) {
      return originalFetch(input, init)
    }

    // ---------------------------
    // 解析 JSON-RPC body
    // ---------------------------
    let bodyText = ''

    // 我们假设你前端都是用 fetch(url, { body: JSON.stringify(...) }) 调的
    if (init && typeof init.body === 'string') {
      bodyText = init.body
    } else if (input && typeof input.text === 'function') {
      // 兜底：如果用 Request 对象
      bodyText = await input.text()
    }

    let jsonBody = {}
    try {
      jsonBody = bodyText ? JSON.parse(bodyText) : {}
    } catch (e) {
      // body 不是合法 JSON，返回 400
      return new Response(
        JSON.stringify({
          code: 400,
          message: 'Invalid JSON body in mock server',
          metadata: {},
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const { id = 'mock-id', method, params = {} } = jsonBody
    const pathParts = u.pathname.split('/').filter(Boolean) // ["rpc","system"]
    const domain = pathParts[1] || '' // 第二段作为 url，例如 system / auth

    console.log('[MOCK RPC]', { domain, method, params })

    // ---------------------------
    // 根据 domain + method 分发
    // ---------------------------

    let responseBody

    if (domain === 'system') {
      if (method === 'ping') {
        responseBody = makeJsonRpcSuccess(id, {
          ping: { pong: 'mock-pong' },
        })
      } else if (method === 'version') {
        responseBody = makeJsonRpcSuccess(id, {
          version: { version: 'mock-1.0.0' },
        })
      } else {
        responseBody = makeJsonRpcBizError(
          id,
          400,
          `unknown system method: ${method}`
        )
      }
    } else if (domain === 'auth') {
      if (method === 'login') {
        // 模拟一个简单登录规则：username === 'error' 时返回业务错误
        if (params.username === 'error') {
          responseBody = makeJsonRpcBizError(id, 401, 'invalid username')
        } else {
          responseBody = makeJsonRpcSuccess(id, {
            data: {
              user_id: 101,
              username: params.username || 'mock-user',
              access_token: makeMockJwt({
                uid: 101,
                uname: params.username || 'mock-user',
                role: 0,
              }),
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              token_type: 'Bearer',
            },
          })
        }
      } else if (method === 'register') {
        responseBody = makeJsonRpcSuccess(id, {
          data: {
            user_id: 202,
            username: params.username || 'new-user',
            access_token: makeMockJwt({
              uid: 202,
              uname: params.username || 'new-user',
              role: 0,
            }),
            expires_at: nowTs() + 3600,
            token_type: 'Bearer',
          },
        })
      } else if (method === 'admin_login') {
        responseBody = makeJsonRpcSuccess(id, {
          data: {
            user_id: 1,
            username: params.username || 'admin',
            roles: ['super_admin'],
            permissions: MOCK_ADMIN_PERMISSIONS,
            access_token: makeMockJwt({
              uid: 1,
              uname: params.username || 'admin',
              role: 1,
            }),
            expires_at: nowTs() + 3600,
            token_type: 'Bearer',
          },
        })
      } else if (method === 'logout') {
        responseBody = makeJsonRpcSuccess(id, {
          data: { success: true },
        })
      } else if (method === 'me') {
        responseBody = makeJsonRpcSuccess(id, {
          data: {
            id: 1,
            username: 'admin',
            role: 1,
            disabled: false,
            roles: ['super_admin'],
            permissions: MOCK_ADMIN_PERMISSIONS,
          },
        })
      } else {
        responseBody = makeJsonRpcBizError(
          id,
          400,
          `unknown auth method: ${method}`
        )
      }
    } else if (domain === 'user') {
      if (method === 'list') {
        const allUsers = MOCK_USERS.map(
          ([username, disabled, createdAgo, loginAgo], index) => ({
            id: index + 1,
            username,
            disabled,
            created_at: nowTs() - createdAgo,
            last_login_at: nowTs() - loginAgo,
          })
        )
        const search = String(params.search || '')
          .trim()
          .toLowerCase()
        const matchedUsers = search
          ? allUsers.filter((user) =>
              user.username.toLowerCase().includes(search)
            )
          : allUsers
        const offset = Math.max(0, Number(params.offset) || 0)
        const limit = Math.max(1, Number(params.limit) || 30)
        const users = matchedUsers.slice(offset, offset + limit)
        responseBody = makeJsonRpcSuccess(id, {
          data: {
            users,
            total: matchedUsers.length,
            limit,
            offset,
            search,
          },
        })
      } else if (method === 'set_disabled') {
        responseBody = makeJsonRpcSuccess(id, {
          data: {
            success: true,
            user_id: params.user_id,
            disabled: !!params.disabled,
          },
        })
      } else {
        responseBody = makeJsonRpcBizError(
          id,
          40020,
          `unknown user method: ${method}`
        )
      }
    } else if (domain === 'rbac') {
      if (method === 'overview') {
        responseBody = makeJsonRpcSuccess(id, {
          data: {
            roles: MOCK_ROLES,
            permissions: MOCK_PERMISSIONS.map(
              ([key, name, group, description]) => ({
                key,
                name,
                group,
                description,
                builtin: true,
              })
            ),
          },
        })
      } else {
        responseBody = makeJsonRpcBizError(
          id,
          40020,
          `unknown rbac method: ${method}`
        )
      }
    } else if (domain === 'work_item') {
      if (method === 'list') {
        const view = params.view || 'pending'
        const items = MOCK_WORK_ITEMS.filter((item) => {
          if (view === 'mine') return true
          return item.status === view
        })
        responseBody = makeJsonRpcSuccess(id, {
          data: { items },
        })
      } else if (method === 'detail') {
        const item = MOCK_WORK_ITEMS.find(
          (candidate) => candidate.id === String(params.id || '')
        )
        responseBody = item
          ? makeJsonRpcSuccess(id, {
              data: { item: mockWorkItemDetail(item) },
            })
          : makeJsonRpcBizError(id, 40410, 'work item not found')
      } else if (method === 'act') {
        const item = MOCK_WORK_ITEMS.find(
          (candidate) => candidate.id === String(params.id || '')
        )
        if (!item) {
          responseBody = makeJsonRpcBizError(id, 40410, 'work item not found')
        } else if (Number(params.expected_version) !== item.version) {
          responseBody = makeJsonRpcBizError(
            id,
            40910,
            'work item version changed'
          )
        } else if (params.action_key !== 'complete') {
          responseBody = makeJsonRpcBizError(id, 40020, 'unsupported action')
        } else {
          item.status = 'completed'
          item.status_label = '已完成'
          item.tone = 'success'
          item.updated_at = nowTs()
          item.version += 1
          responseBody = makeJsonRpcSuccess(id, {
            data: {
              receipt: {
                id: `R-${item.id}-${item.version}`,
                message: '事项状态已更新，结果已写入当前数据源。',
                processed_at: nowTs(),
              },
            },
          })
        }
      } else {
        responseBody = makeJsonRpcBizError(
          id,
          40020,
          `unknown work_item method: ${method}`
        )
      }
    } else {
      // 未知领域
      responseBody = makeJsonRpcBizError(
        id,
        404,
        `unknown rpc domain: ${domain}`
      )
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.info('[MOCK RPC] jsonRpcMockServer installed')
}

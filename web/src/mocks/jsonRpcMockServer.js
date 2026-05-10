// src/mocks/jsonRpcMockServer.js

let originalFetch = null

const MOCK_ADMIN_PERMISSIONS = [
  'admin.access',
  'admin.user.read',
  'admin.user.write',
  'admin.rbac.read',
]

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
            expires_at: Math.floor(Date.now() / 1000) + 3600,
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
        responseBody = makeJsonRpcSuccess(id, {
          data: {
            users: [
              {
                id: 101,
                username: 'demo_user',
                disabled: false,
                created_at: Math.floor(Date.now() / 1000) - 86400,
                last_login_at: Math.floor(Date.now() / 1000) - 1200,
              },
            ],
            total: 1,
            limit: params.limit || 30,
            offset: params.offset || 0,
            search: params.search || '',
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
            roles: [
              {
                id: 1,
                key: 'super_admin',
                name: '超级管理员',
                description: '模板内置最高权限角色，初始化管理员默认绑定',
                builtin: true,
                admin_count: 1,
              },
            ],
            permissions: MOCK_ADMIN_PERMISSIONS.map((key) => ({
              key,
              name: key,
              group: key.includes('user') ? '账号' : '系统',
              description: 'mock 权限码',
              builtin: true,
            })),
          },
        })
      } else {
        responseBody = makeJsonRpcBizError(
          id,
          40020,
          `unknown rbac method: ${method}`
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

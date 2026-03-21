import { ensureAuthConfig } from './lib/config.js'
import {
  authTokenMissing,
  rpcBizFailed,
  rpcPayloadFailed,
} from './lib/http.js'
import {
  runAuthFlow,
  runHealthFlow,
  runSystemFlow,
} from './lib/workflows.js'

void rpcBizFailed
void rpcPayloadFailed
void authTokenMissing

ensureAuthConfig()

const defaultDuration = __ENV.LOADTEST_DURATION || '30s'

export const options = {
  scenarios: {
    health: {
      executor: 'constant-vus',
      exec: 'healthExec',
      vus: Number(__ENV.LOADTEST_HEALTH_VUS || 2),
      duration: __ENV.LOADTEST_HEALTH_DURATION || defaultDuration,
    },
    system: {
      executor: 'constant-vus',
      exec: 'systemExec',
      vus: Number(__ENV.LOADTEST_SYSTEM_VUS || 1),
      duration: __ENV.LOADTEST_SYSTEM_DURATION || defaultDuration,
    },
    auth: {
      executor: 'per-vu-iterations',
      exec: 'authExec',
      vus: Number(__ENV.LOADTEST_AUTH_VUS || 1),
      iterations: Number(__ENV.LOADTEST_AUTH_ITERATIONS || 3),
      maxDuration: __ENV.LOADTEST_AUTH_MAX_DURATION || '5m',
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1200'],
    rpc_biz_failed: ['rate<0.01'],
    rpc_payload_failed: ['rate<0.01'],
    auth_token_missing: ['rate<0.01'],
  },
}

export function healthExec() {
  runHealthFlow()
}

export function systemExec() {
  runSystemFlow()
}

export function authExec() {
  runAuthFlow()
}


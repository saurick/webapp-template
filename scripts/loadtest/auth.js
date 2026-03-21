import { ensureAuthConfig } from './lib/config.js'
import {
  authTokenMissing,
  rpcBizFailed,
  rpcPayloadFailed,
} from './lib/http.js'
import { runAuthFlow } from './lib/workflows.js'

void rpcBizFailed
void rpcPayloadFailed
void authTokenMissing

ensureAuthConfig()

export const options = {
  vus: Number(__ENV.LOADTEST_VUS || 1),
  iterations: Number(__ENV.LOADTEST_ITERATIONS || 5),
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1200'],
    rpc_biz_failed: ['rate<0.01'],
    rpc_payload_failed: ['rate<0.01'],
    auth_token_missing: ['rate<0.01'],
  },
}

export default function authScenario() {
  runAuthFlow()
}


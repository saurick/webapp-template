import { rpcBizFailed, rpcPayloadFailed } from './lib/http.js'
import { runSystemFlow } from './lib/workflows.js'

void rpcBizFailed
void rpcPayloadFailed

export const options = {
  vus: Number(__ENV.LOADTEST_VUS || 3),
  duration: __ENV.LOADTEST_DURATION || '30s',
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    rpc_biz_failed: ['rate<0.01'],
    rpc_payload_failed: ['rate<0.01'],
  },
}

export default function systemScenario() {
  runSystemFlow()
}


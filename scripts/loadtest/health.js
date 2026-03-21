import { runHealthFlow } from './lib/workflows.js'

export const options = {
  vus: Number(__ENV.LOADTEST_VUS || 5),
  duration: __ENV.LOADTEST_DURATION || '30s',
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
}

export default function healthScenario() {
  runHealthFlow()
}


import { AUTH_SCOPE } from '@/common/auth/auth'
import { JsonRpc } from '@/common/utils/jsonRpc'

function dataFrom(result) {
  return result?.data || result?.result?.data || {}
}

export class WorkQueueClient {
  constructor() {
    this.rpc = new JsonRpc({
      url: 'work_item',
      authScope: AUTH_SCOPE.USER,
    })
  }

  async list(view) {
    return dataFrom(await this.rpc.call('list', { view }))
  }

  async detail(id) {
    return dataFrom(await this.rpc.call('detail', { id }))
  }

  async act({ id, actionKey, expectedVersion }) {
    return dataFrom(
      await this.rpc.call('act', {
        id,
        action_key: actionKey,
        expected_version: expectedVersion,
      })
    )
  }
}

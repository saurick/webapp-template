import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeActionReceipt,
  normalizeWorkItemDetail,
  normalizeWorkItemList,
  normalizeWorkQueueView,
} from './workQueueModel.mjs'

test('mobile work queue accepts only known views', () => {
  assert.equal(normalizeWorkQueueView('risk'), 'risk')
  assert.equal(normalizeWorkQueueView('custom-status'), 'pending')
})

test('mobile work queue drops rows without stable identifiers', () => {
  const items = normalizeWorkItemList([
    { id: 'W-1', title: '核对事项', tone: 'warning' },
    { title: '缺少编号' },
  ])

  assert.equal(items.length, 1)
  assert.equal(items[0].id, 'W-1')
  assert.equal(items[0].tone, 'warning')
})

test('mobile work queue normalizes detail actions and receipts', () => {
  const detail = normalizeWorkItemDetail({
    id: 'W-1',
    title: '核对事项',
    fields: [{ label: '来源', value: '接口' }],
    actions: [
      { key: 'complete', label: '完成', tone: 'primary' },
      { label: '无动作键' },
    ],
  })
  const receipt = normalizeActionReceipt({ message: '已处理' })

  assert.equal(detail.actions.length, 1)
  assert.equal(detail.actions[0].confirmText, '确认执行此操作吗？')
  assert.equal(detail.fields[0].key, '来源-0')
  assert.equal(receipt.message, '已处理')
})

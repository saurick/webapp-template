import assert from 'node:assert/strict'
import test from 'node:test'

import { importWithRetry } from './lazyRoute.mjs'

test('route import retries one transient chunk failure', async () => {
  let attempts = 0
  const loaded = await importWithRetry(async () => {
    attempts += 1
    if (attempts === 1) throw new Error('temporary chunk failure')
    return { default: 'page' }
  })

  assert.equal(attempts, 2)
  assert.equal(loaded.default, 'page')
})

test('route import keeps the final error when retries are exhausted', async () => {
  await assert.rejects(
    () => importWithRetry(async () => Promise.reject(new Error('broken'))),
    /broken/
  )
})

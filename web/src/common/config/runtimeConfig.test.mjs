import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeRuntimeConfig,
  readRuntimeConfig,
  resolveProductName,
} from './runtimeConfig.mjs'

test('runtime config keeps safe defaults when deployment config is absent', () => {
  const config = readRuntimeConfig({})

  assert.equal(config.branding.productName, '')
  assert.equal(resolveProductName(config, '构建期标题'), '构建期标题')
  assert.equal(config.features.adminGuide, true)
  assert.equal(config.features.mobileWorkQueue, false)
})

test('runtime config accepts known fields and ignores wrong value types', () => {
  const config = normalizeRuntimeConfig({
    branding: {
      productName: '  客户工作台  ',
      shortName: 42,
    },
    features: {
      mobileWorkQueue: true,
      auditLog: 'true',
      unknownFeature: true,
    },
  })

  assert.equal(config.branding.productName, '客户工作台')
  assert.equal(resolveProductName(config, '构建期标题'), '客户工作台')
  assert.equal(config.branding.shortName, 'Workspace')
  assert.equal(config.features.mobileWorkQueue, true)
  assert.equal(config.features.auditLog, false)
  assert.equal('unknownFeature' in config.features, false)
})

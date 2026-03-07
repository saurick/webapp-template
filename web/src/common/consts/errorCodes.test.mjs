import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const filePath = path.resolve(import.meta.dirname, './errorCodes.js')
const source = fs.readFileSync(filePath, 'utf8')
const transformed = source
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  .concat(
    '\nmodule.exports = { RpcErrorCode, AUTH_FAILURE_ERROR_CODES, isAuthFailureCode, DEFAULT_RPC_ERROR_MESSAGES };\n'
  )

const sandbox = { module: { exports: {} }, exports: {} }
vm.runInNewContext(transformed, sandbox, { filename: filePath })
const {
  RpcErrorCode,
  AUTH_FAILURE_ERROR_CODES,
  isAuthFailureCode,
  DEFAULT_RPC_ERROR_MESSAGES,
} = sandbox.module.exports

test('errorCodes: 所有错误码保持唯一', () => {
  const values = Object.values(RpcErrorCode)
  assert.equal(new Set(values).size, values.length)
})

test('errorCodes: 仅登录态失效错误触发重新登录', () => {
  assert.deepEqual(
    [...AUTH_FAILURE_ERROR_CODES],
    [
      RpcErrorCode.AUTH_EXPIRED,
      RpcErrorCode.AUTH_INVALID,
      RpcErrorCode.AUTH_REQUIRED,
    ]
  )
  assert.equal(isAuthFailureCode(RpcErrorCode.AUTH_REQUIRED), true)
  assert.equal(isAuthFailureCode(RpcErrorCode.PERMISSION_DENIED), false)
})

test('errorCodes: 默认文案覆盖核心鉴权错误', () => {
  assert.equal(
    DEFAULT_RPC_ERROR_MESSAGES[RpcErrorCode.AUTH_REQUIRED],
    '请先登录'
  )
  assert.equal(
    DEFAULT_RPC_ERROR_MESSAGES[RpcErrorCode.PERMISSION_DENIED],
    '权限不足'
  )
})

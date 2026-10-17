const DEFAULT_BRANDING = Object.freeze({
  productName: '',
  shortName: 'Workspace',
  adminName: 'Admin Preset',
  adminSubtitle: 'basic RBAC',
})

const DEFAULT_FEATURES = Object.freeze({
  adminGuide: true,
  mobileWorkQueue: false,
  auditLog: false,
  businessAttachments: false,
  printWorkspace: false,
  historyCenter: false,
})

export const OPTIONAL_EXTENSION_DEFINITIONS = Object.freeze([
  {
    key: 'mobileWorkQueue',
    name: '移动工作队列',
    boundary:
      '提供列表、详情、动作与回执界面；业务状态和动作规则由派生项目接口负责。',
  },
  {
    key: 'auditLog',
    name: '审计记录',
    boundary:
      '记录谁在何时对什么对象执行了什么动作；不以内存日志代替审计真源。',
  },
  {
    key: 'businessAttachments',
    name: '业务附件',
    boundary: '由业务单据持有附件关系；对象存储只保存文件，不拥有业务归属。',
  },
  {
    key: 'printWorkspace',
    name: '打印工作台',
    boundary:
      '模板、数据快照和打印版本需要由派生项目定义，不从列表展示字段临时拼装。',
  },
  {
    key: 'historyCenter',
    name: '历史记录',
    boundary: '展示业务事实的版本或事件来源；不能用前端缓存冒充历史真源。',
  },
])

function normalizeText(value, fallback, maxLength = 48) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized ? normalized.slice(0, maxLength) : fallback
}

function normalizeFeature(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeRuntimeConfig(rawConfig = {}) {
  const rawBranding = rawConfig?.branding || {}
  const rawFeatures = rawConfig?.features || {}

  const branding = Object.fromEntries(
    Object.entries(DEFAULT_BRANDING).map(([key, fallback]) => [
      key,
      normalizeText(rawBranding[key], fallback),
    ])
  )
  const features = Object.fromEntries(
    Object.entries(DEFAULT_FEATURES).map(([key, fallback]) => [
      key,
      normalizeFeature(rawFeatures[key], fallback),
    ])
  )

  return Object.freeze({
    branding: Object.freeze(branding),
    features: Object.freeze(features),
  })
}

export function readRuntimeConfig(target = globalThis) {
  return normalizeRuntimeConfig(target?.__WEBAPP_CONFIG__)
}

export function resolveProductName(config, buildTitle = '') {
  return normalizeText(
    config?.branding?.productName,
    normalizeText(buildTitle, 'Project Workspace')
  )
}

export const runtimeConfig = readRuntimeConfig()

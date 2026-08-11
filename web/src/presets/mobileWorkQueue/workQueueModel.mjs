export const WORK_QUEUE_VIEWS = Object.freeze([
  { key: 'pending', label: '待处理' },
  { key: 'completed', label: '已完成' },
  { key: 'risk', label: '需关注' },
  { key: 'mine', label: '我的' },
])

const VIEW_KEYS = new Set(WORK_QUEUE_VIEWS.map((view) => view.key))
const TONES = new Set(['default', 'success', 'warning', 'danger'])

function text(value, fallback = '', maxLength = 240) {
  const normalized = value == null ? '' : String(value).trim()
  return (normalized || fallback).slice(0, maxLength)
}

function timestamp(value) {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0
    ? Math.trunc(normalized)
    : 0
}

export function normalizeWorkQueueView(value) {
  return VIEW_KEYS.has(value) ? value : 'pending'
}

export function normalizeWorkItem(raw = {}) {
  const id = text(raw.id, '', 80)
  if (!id) return null

  return {
    id,
    title: text(raw.title, '未命名事项', 120),
    summary: text(raw.summary, '', 240),
    status: text(raw.status, 'unknown', 48),
    statusLabel: text(raw.status_label, '状态未知', 32),
    tone: TONES.has(raw.tone) ? raw.tone : 'default',
    updatedAt: timestamp(raw.updated_at),
    version: Math.max(0, Number.parseInt(raw.version, 10) || 0),
  }
}

export function normalizeWorkItemList(rawItems) {
  if (!Array.isArray(rawItems)) return []
  return rawItems.map(normalizeWorkItem).filter(Boolean)
}

export function normalizeWorkItemDetail(raw = {}) {
  const item = normalizeWorkItem(raw)
  if (!item) return null

  const fields = Array.isArray(raw.fields)
    ? raw.fields
        .map((field, index) => {
          const label = text(field?.label, '', 48)
          return {
            key: text(field?.key, `${label}-${index}`, 80),
            label,
            value: text(field?.value, '—', 240),
          }
        })
        .filter((field) => field.label)
    : []
  const actions = Array.isArray(raw.actions)
    ? raw.actions
        .map((action) => ({
          key: text(action?.key, '', 64),
          label: text(action?.label, '', 32),
          confirmText: text(action?.confirm_text, '确认执行此操作吗？', 160),
          tone: action?.tone === 'danger' ? 'danger' : 'primary',
        }))
        .filter((action) => action.key && action.label)
    : []

  return {
    ...item,
    description: text(raw.description, '', 1000),
    fields,
    actions,
  }
}

export function normalizeActionReceipt(raw = {}) {
  return {
    id: text(raw.id, '', 80),
    message: text(raw.message, '操作已完成', 240),
    processedAt: timestamp(raw.processed_at),
  }
}

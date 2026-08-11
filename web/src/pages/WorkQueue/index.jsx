import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AUTH_SCOPE, logout, useCurrentUser } from '@/common/auth/auth'
import AsyncState from '@/common/components/state/AsyncState'
import AppModal from '@/common/components/modal/AppModal'
import { runtimeConfig } from '@/common/config/runtimeConfig.mjs'
import ThemeToggle from '@/common/theme/ThemeToggle'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import { WorkQueueClient } from '@/presets/mobileWorkQueue/workQueueClient'
import {
  normalizeActionReceipt,
  normalizeWorkItemDetail,
  normalizeWorkItemList,
  normalizeWorkQueueView,
  WORK_QUEUE_VIEWS,
} from '@/presets/mobileWorkQueue/workQueueModel.mjs'
import './workQueue.css'

function formatTime(value) {
  if (!value) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value * 1000))
}

export default function WorkQueuePage() {
  const navigate = useNavigate()
  const user = useCurrentUser(AUTH_SCOPE.USER)
  const [searchParams, setSearchParams] = useSearchParams()
  const view = normalizeWorkQueueView(searchParams.get('view'))
  const selectedId = (searchParams.get('item') || '').trim()
  const listSequence = useRef(0)
  const detailSequence = useRef(0)
  const client = useMemo(() => new WorkQueueClient(), [])
  const [lists, setLists] = useState({})
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
  const [acting, setActing] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const items = lists[view] || []

  const fetchList = useCallback(
    async (targetView = view) => {
      const sequence = listSequence.current + 1
      listSequence.current = sequence
      setListError('')
      setListLoading(true)
      try {
        const data = await client.list(targetView)
        if (sequence !== listSequence.current) return
        setLists((current) => ({
          ...current,
          [targetView]: normalizeWorkItemList(data.items),
        }))
      } catch (error) {
        if (sequence !== listSequence.current) return
        setListError(getActionErrorMessage(error, '获取工作事项'))
      } finally {
        if (sequence === listSequence.current) setListLoading(false)
      }
    },
    [client, view]
  )

  useEffect(() => {
    fetchList(view)
  }, [fetchList, view])

  const fetchDetail = useCallback(async () => {
    if (!selectedId) return
    const sequence = detailSequence.current + 1
    detailSequence.current = sequence
    setDetailError('')
    setDetailLoading(true)
    setReceipt(null)
    try {
      const data = await client.detail(selectedId)
      if (sequence !== detailSequence.current) return
      const nextDetail = normalizeWorkItemDetail(data.item)
      if (!nextDetail) throw new Error('服务端没有返回有效事项')
      setDetail(nextDetail)
    } catch (error) {
      if (sequence !== detailSequence.current) return
      setDetail(null)
      setDetailError(getActionErrorMessage(error, '获取事项详情'))
    } finally {
      if (sequence === detailSequence.current) setDetailLoading(false)
    }
  }, [client, selectedId])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setDetailError('')
      return
    }
    fetchDetail()
  }, [fetchDetail, selectedId])

  const selectView = (nextView) => {
    const next = new URLSearchParams()
    if (nextView !== 'pending') next.set('view', nextView)
    setSearchParams(next)
  }

  const openItem = (id) => {
    try {
      sessionStorage.setItem(
        `work-queue-scroll:${view}`,
        String(window.scrollY)
      )
    } catch {
      // 无存储权限时仍然保持 URL 可返回。
    }
    const next = new URLSearchParams(searchParams)
    next.set('item', id)
    setSearchParams(next)
  }

  const closeDetail = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('item')
    setSearchParams(next)
    window.requestAnimationFrame(() => {
      try {
        const scrollTop = Number(
          sessionStorage.getItem(`work-queue-scroll:${view}`) || 0
        )
        window.scrollTo({ top: scrollTop })
      } catch {
        window.scrollTo({ top: 0 })
      }
    })
  }

  const performAction = async () => {
    if (!pendingAction || !detail) return
    setActing(true)
    setDetailError('')
    try {
      const data = await client.act({
        id: detail.id,
        actionKey: pendingAction.key,
        expectedVersion: detail.version,
      })
      setPendingAction(null)
      setReceipt(normalizeActionReceipt(data.receipt))
      await fetchList(view)
    } catch (error) {
      setDetailError(getActionErrorMessage(error, pendingAction.label))
      setPendingAction(null)
    } finally {
      setActing(false)
    }
  }

  const handleLogout = () => {
    logout(AUTH_SCOPE.USER)
    navigate('/login', { replace: true })
  }

  const navigation = (
    <nav className="work-queue__views" aria-label="工作队列分类">
      {WORK_QUEUE_VIEWS.map((option) => (
        <button
          type="button"
          key={option.key}
          className={option.key === view ? 'is-active' : ''}
          aria-current={option.key === view ? 'page' : undefined}
          onClick={() => selectView(option.key)}
        >
          {option.label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="work-queue">
      <header className="work-queue__header">
        <div>
          <Link to="/" className="work-queue__brand">
            {runtimeConfig.branding.shortName}
          </Link>
          <h1>移动工作队列</h1>
        </div>
        <div className="work-queue__header-actions">
          <ThemeToggle compact />
          <button type="button" onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>

      {!selectedId ? (
        <>
          <main className="work-queue__main">
            <div className="work-queue__intro">
              <div>
                <p className="work-queue__eyebrow">
                  {user?.username || '用户'}
                </p>
                <h2>
                  {
                    WORK_QUEUE_VIEWS.find((option) => option.key === view)
                      ?.label
                  }
                </h2>
              </div>
              <button
                type="button"
                className="work-queue__secondary-action"
                disabled={listLoading}
                onClick={() => fetchList(view)}
              >
                {listLoading ? '刷新中…' : '刷新'}
              </button>
            </div>
            <div className="work-queue__desktop-nav">{navigation}</div>
            <AsyncState
              loading={listLoading}
              error={listError}
              hasData={items.length > 0}
              empty={!listLoading && items.length === 0}
              emptyTitle="当前没有事项"
              emptyDescription="此分类下暂时没有需要处理的内容。"
              onRetry={() => fetchList(view)}
            >
              <div className="work-queue__list">
                {items.map((item) => (
                  <button
                    type="button"
                    className="work-queue__item"
                    key={item.id}
                    onClick={() => openItem(item.id)}
                  >
                    <span className="work-queue__item-main">
                      <strong>{item.title}</strong>
                      {item.summary ? <span>{item.summary}</span> : null}
                    </span>
                    <span className="work-queue__item-meta">
                      <span className={`work-queue__status is-${item.tone}`}>
                        {item.statusLabel}
                      </span>
                      {item.updatedAt ? (
                        <time
                          dateTime={new Date(
                            item.updatedAt * 1000
                          ).toISOString()}
                        >
                          {formatTime(item.updatedAt)}
                        </time>
                      ) : (
                        <span>时间未知</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </AsyncState>
          </main>
          <div className="work-queue__mobile-nav">{navigation}</div>
        </>
      ) : (
        <main className="work-queue__main work-queue__detail-page">
          <button
            type="button"
            className="work-queue__back"
            onClick={closeDetail}
          >
            返回列表
          </button>
          {receipt ? (
            <section className="work-queue__receipt" role="status">
              <p className="work-queue__eyebrow">操作回执</p>
              <h2>操作已完成</h2>
              <p>{receipt.message}</p>
              {receipt.id ? <span>回执编号：{receipt.id}</span> : null}
              {receipt.processedAt ? (
                <span>处理时间：{formatTime(receipt.processedAt)}</span>
              ) : null}
              <button
                type="button"
                className="work-queue__primary-action"
                onClick={closeDetail}
              >
                返回工作队列
              </button>
            </section>
          ) : (
            <AsyncState
              loading={detailLoading}
              error={detailError}
              hasData={Boolean(detail)}
              onRetry={fetchDetail}
            >
              {detail ? (
                <article className="work-queue__detail">
                  <div className="work-queue__detail-heading">
                    <div>
                      <p className="work-queue__eyebrow">事项 {detail.id}</p>
                      <h2>{detail.title}</h2>
                    </div>
                    <span className={`work-queue__status is-${detail.tone}`}>
                      {detail.statusLabel}
                    </span>
                  </div>
                  {detail.description ? (
                    <p className="work-queue__description">
                      {detail.description}
                    </p>
                  ) : null}
                  <dl className="work-queue__fields">
                    {detail.fields.map((field) => (
                      <div key={field.key}>
                        <dt>{field.label}</dt>
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="work-queue__action-bar">
                    {detail.actions.length > 0 ? (
                      detail.actions.map((action) => (
                        <button
                          type="button"
                          key={action.key}
                          className={`work-queue__primary-action ${
                            action.tone === 'danger' ? 'is-danger' : ''
                          }`}
                          disabled={acting}
                          onClick={() => setPendingAction(action)}
                        >
                          {action.label}
                        </button>
                      ))
                    ) : (
                      <span>当前状态没有可执行操作。</span>
                    )}
                  </div>
                </article>
              ) : null}
            </AsyncState>
          )}
        </main>
      )}

      <AppModal
        open={Boolean(pendingAction)}
        onClose={() => (acting ? null : setPendingAction(null))}
        labelledBy="work-queue-action-title"
      >
        <div className="work-queue__confirm">
          <h2 id="work-queue-action-title">{pendingAction?.label}</h2>
          <p>{pendingAction?.confirmText}</p>
          <div>
            <button
              type="button"
              className="work-queue__secondary-action"
              disabled={acting}
              onClick={() => setPendingAction(null)}
            >
              取消
            </button>
            <button
              type="button"
              className={`work-queue__primary-action ${
                pendingAction?.tone === 'danger' ? 'is-danger' : ''
              }`}
              disabled={acting}
              onClick={performAction}
            >
              {acting ? '处理中…' : '确认执行'}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  )
}

import React from 'react'
import { Loading } from '@/common/components/loading'
import './asyncState.css'

export default function AsyncState({
  loading = false,
  error = '',
  hasData = false,
  empty = false,
  emptyTitle = '暂无数据',
  emptyDescription = '当前没有可展示的内容。',
  onRetry,
  children,
}) {
  if (loading && !hasData) {
    return <Loading embedded label="正在获取最新数据" />
  }

  if (error && !hasData) {
    return (
      <section className="async-state" role="alert">
        <strong>加载失败</strong>
        <p>{error}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry}>
            重试
          </button>
        ) : null}
      </section>
    )
  }

  if (empty && !hasData) {
    return (
      <section className="async-state" aria-live="polite">
        <strong>{emptyTitle}</strong>
        <p>{emptyDescription}</p>
      </section>
    )
  }

  return (
    <>
      {error ? (
        <div className="async-state__inline-error" role="alert">
          <span>{error}</span>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              重试
            </button>
          ) : null}
        </div>
      ) : null}
      {children}
    </>
  )
}

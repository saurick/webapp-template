import React from 'react'
import './loading.css'

// 通用加载占位；嵌入式状态不会覆盖仍然可读的旧数据。
export const Loading = ({ embedded = false, label = '页面加载中' }) => {
  return (
    <div
      className={`loading-page ${embedded ? 'loading-page--embedded' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="loading-page__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

import React, { forwardRef } from 'react'

// 通用表单容器保持白底薄边，和后台卡片共用同一套轻量层级。
const SurfacePanel = forwardRef(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`app-surface relative overflow-hidden rounded-2xl border shadow-[var(--app-shadow)] ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

export default SurfacePanel

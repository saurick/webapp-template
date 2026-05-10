import React from 'react'

// 通用表单容器保持白底薄边，和后台卡片共用同一套轻量层级。
export default function SurfacePanel({ children, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#d8e5e8] bg-white shadow-[0_14px_34px_rgba(28,56,82,0.12)] ${className}`}
    >
      {children}
    </div>
  )
}

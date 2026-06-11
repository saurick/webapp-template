import React from 'react'

// 应用级浅色背景统一承载门户与登录页，避免各页面重复定义视觉基调。
export default function AppShell({ children, className = '' }) {
  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-[#f4f8f6] text-[#172b3f] ${className}`}
    >
      <div className="relative min-h-screen">{children}</div>
    </div>
  )
}

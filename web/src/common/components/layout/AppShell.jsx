import React from 'react'

// 应用级浅色背景统一承载门户与登录页，避免各页面重复定义视觉基调。
export default function AppShell({ children, className = '' }) {
  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-[#f5f9fb] text-[#172b3f] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,#e9f5fb_0%,#f7fbfb_44%,#fff7e4_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.46] [background-image:linear-gradient(rgba(28,56,82,0.045)_1px,transparent_1px)] [background-size:100%_42px]" />
      <div className="relative min-h-screen">{children}</div>
    </div>
  )
}

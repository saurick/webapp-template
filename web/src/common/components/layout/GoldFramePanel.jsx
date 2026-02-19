// web/src/common/components/layout/GoldFramePanel.jsx
import React from 'react'

// 负责提供一个金框的背景颜色和内边距效果
export default function GoldFramePanel({ children, className = '' }) {
  return (
    <div
      className={`relative rounded-[32px] border-[6px] border-[#e0a84b] bg-[#0b3a2c] shadow-[0_0_40px_rgba(0,0,0,0.7)] ${
        className
      }`}
    >
      {/* 内侧稍微留一点 padding，类似原来的内框效果 */}
      <div className="h-full w-full rounded-[26px] border border-[#224b3b]/70 bg-gradient-to-b from-[#0f4a36] to-[#06241a]">
        {children}
      </div>
    </div>
  )
}

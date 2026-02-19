// web/src/common/components/layout/CasinoScreen.jsx
import React from 'react'

// 负责提供整个的布局和背景颜色
export default function CasinoScreen({ children, className = '' }) {
  return (
    <div
      className={`min-h-screen w-full bg-[#3b1020] text-amber-100 ${className}`}
    >
      {children}
    </div>
  )
}

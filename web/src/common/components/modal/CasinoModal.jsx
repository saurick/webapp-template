// web/src/common/components/modal/CasinoModal.jsx
import React from 'react'
import GoldFramePanel from '@/common/components/layout/GoldFramePanel'

export default function CasinoModal({
  open,
  onClose,
  children,
  className = '',
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="absolute inset-0" onClick={onClose} />
      <GoldFramePanel
        className={`relative z-10 w-[640px] max-w-[720px] px-10 py-8 ${className}`}
      >
        {children}
      </GoldFramePanel>
    </div>
  )
}

// web/src/common/components/modal/CasinoAlertModal.jsx
import React from 'react'
import CasinoModal from '@/common/components/modal/CasinoModal'

export default function CasinoAlertModal({
  open,
  onClose,
  title = '提示',
  message = '',
  confirmText = '確定',
  onConfirm = null,
  className = '',
}) {
  const handleConfirm = () => {
    if (onConfirm) onConfirm()
    if (onClose) onClose()
  }

  return (
    <CasinoModal open={open} onClose={onClose} className={className}>
      <div className="flex flex-col items-center gap-6 py-4">
        {/* 标题 */}
        {title && (
          <div className="text-center text-2xl font-semibold text-amber-100">
            {title}
          </div>
        )}

        {/* 内容（支持字符串 or JSX） */}
        {message && (
          <div className="whitespace-pre-line text-center text-lg leading-relaxed text-amber-100">
            {message}
          </div>
        )}

        {/* 底部按钮 */}
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={handleConfirm}
            className="min-w-[140px] rounded-[999px] bg-gradient-to-b from-[#ffb15a] to-[#c96b20] px-8 py-2 text-xl font-semibold text-[#7a2b00] shadow-[0_3px_0_#864c26] active:translate-y-[1px]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </CasinoModal>
  )
}

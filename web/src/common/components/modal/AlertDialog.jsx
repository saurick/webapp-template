import React from 'react'
import AppModal from '@/common/components/modal/AppModal'

export default function AlertDialog({
  open,
  onClose,
  title = '提示',
  message = '',
  confirmText = '确定',
  onConfirm = null,
  className = '',
}) {
  const handleConfirm = () => {
    onConfirm?.()
    onClose?.()
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      className={className}
      labelledBy="app-alert-title"
    >
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        {title ? (
          <div
            id="app-alert-title"
            className="text-xl font-semibold tracking-wide text-[var(--app-text)] sm:text-2xl"
          >
            {title}
          </div>
        ) : null}

        {message ? (
          <div className="whitespace-pre-line text-sm leading-7 text-[var(--app-text-muted)] sm:text-base">
            {message}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleConfirm}
          className="app-primary-button min-w-[152px] rounded-full px-6 py-2.5 text-sm font-semibold transition"
        >
          {confirmText}
        </button>
      </div>
    </AppModal>
  )
}

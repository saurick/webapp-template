import React, { useEffect, useRef } from 'react'
import SurfacePanel from '@/common/components/layout/SurfacePanel'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function AppModal({
  open,
  onClose,
  children,
  className = '',
  labelledBy,
}) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    previousFocusRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusables = dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
    const initialFocus = focusables?.[0] || dialogRef.current
    initialFocus?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus?.()
    }
  }, [open])

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose?.()
      return
    }

    if (event.key !== 'Tab') return
    const focusables = Array.from(
      dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || []
    )
    if (focusables.length === 0) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }

    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!open) return null

  return (
    <div className="bg-slate-950/72 fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <SurfacePanel
        className={`relative z-10 w-full max-w-[640px] px-6 py-6 sm:px-8 sm:py-8 ${className}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </SurfacePanel>
    </div>
  )
}

// web/src/common/components/modal/CasinoAlertProvider.jsx
import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import CasinoAlertModal from '@/common/components/modal/CasinoAlertModal'
import { registerAlert } from '@/common/components/modal/alertBridge'

const AlertContext = createContext(null)

export function CasinoAlertProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: '提示',
    message: '',
    confirmText: '確定',
    onConfirm: null,
  })

  const close = useCallback(() => {
    setState(s => ({ ...s, open: false }))
  }, [])

  const alert = useCallback((opts = {}) => {
    // opts: { title, message, confirmText, onConfirm }
    setState({
      open: true,
      title: opts.title ?? '提示',
      message: opts.message ?? '',
      confirmText: opts.confirmText ?? '確定',
      onConfirm: opts.onConfirm ?? null,
    })
  }, [])

  // 让非 React 文件也能调用 alert()
  useEffect(() => {
    registerAlert(alert)
  }, [alert])

  const value = useMemo(() => ({ alert, close }), [alert, close])

  return (
    <AlertContext.Provider value={value}>
      {children}
      <CasinoAlertModal
        open={state.open}
        onClose={close}
        title={state.title}
        message={state.message}
        confirmText={state.confirmText}
        onConfirm={state.onConfirm}
      />
    </AlertContext.Provider>
  )
}

export function useCasinoAlert() {
  const ctx = useContext(AlertContext)
  if (!ctx) {
    throw new Error('useCasinoAlert must be used within <CasinoAlertProvider />')
  }
  return ctx
}
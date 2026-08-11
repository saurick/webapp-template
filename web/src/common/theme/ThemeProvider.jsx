import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import './theme.css'

const THEME_STORAGE_KEY = 'workspace_theme_preference'
const THEME_PREFERENCES = new Set(['system', 'light', 'dark'])

const ThemeContext = createContext({
  preference: 'system',
  resolvedTheme: 'light',
  setPreference: () => {},
})

function readPreference() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return THEME_PREFERENCES.has(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function systemTheme() {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  return media?.matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readPreference)
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    preference === 'system' ? systemTheme() : preference
  )

  useLayoutEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const nextTheme = preference === 'system' ? systemTheme() : preference
      setResolvedTheme(nextTheme)
      document.documentElement.dataset.appTheme = nextTheme
      document.documentElement.style.colorScheme = nextTheme
    }

    applyTheme()
    media?.addEventListener?.('change', applyTheme)
    return () => media?.removeEventListener?.('change', applyTheme)
  }, [preference])

  const setPreference = (nextPreference) => {
    const safePreference = THEME_PREFERENCES.has(nextPreference)
      ? nextPreference
      : 'system'
    setPreferenceState(safePreference)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, safePreference)
    } catch {
      // 隐私模式下存储可能不可用；当前会话仍然可以切换主题。
    }
  }

  const contextValue = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme]
  )
  const antdConfig = useMemo(
    () => ({
      algorithm:
        resolvedTheme === 'dark'
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#147a42',
        borderRadius: 8,
        colorBgLayout: resolvedTheme === 'dark' ? '#101713' : '#f4f8f6',
      },
    }),
    [resolvedTheme]
  )

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider theme={antdConfig}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  )
}

export function useAppTheme() {
  return useContext(ThemeContext)
}

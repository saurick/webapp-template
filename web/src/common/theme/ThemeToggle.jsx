import React from 'react'
import { useAppTheme } from './ThemeProvider'

const OPTIONS = [
  ['system', '跟随系统'],
  ['light', '浅色'],
  ['dark', '深色'],
]

const COMPACT_ICONS = {
  system: '◐',
  light: '☼',
  dark: '☾',
}

export default function ThemeToggle({ compact = false }) {
  const { preference, setPreference } = useAppTheme()

  if (compact) {
    const currentIndex = OPTIONS.findIndex(([value]) => value === preference)
    const currentLabel = OPTIONS[currentIndex]?.[1] || '跟随系统'
    const nextPreference = OPTIONS[(currentIndex + 1) % OPTIONS.length][0]
    return (
      <button
        type="button"
        className="theme-toggle__button"
        aria-label={`切换界面主题，当前：${currentLabel}`}
        title={`当前主题：${currentLabel}`}
        onClick={() => setPreference(nextPreference)}
      >
        <span aria-hidden="true">{COMPACT_ICONS[preference]}</span>
      </button>
    )
  }

  return (
    <label className="theme-toggle">
      <span>主题</span>
      <select
        aria-label="界面主题"
        value={preference}
        onChange={(event) => setPreference(event.target.value)}
      >
        {OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

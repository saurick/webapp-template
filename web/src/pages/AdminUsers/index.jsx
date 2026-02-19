// web/src/pages/AdminUsers/index.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CasinoScreen from '@/common/components/layout/CasinoScreen'
import GoldFramePanel from '@/common/components/layout/GoldFramePanel'
import { JsonRpc } from '@/common/utils/jsonRpc'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { AUTH_SCOPE } from '@/common/auth/auth'

function fmtTs(ts) {
  if (!ts) return '-'
  const d = new Date(Number(ts) * 1000)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString()
}

function clampInt(v, fallback = 0) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

function clampInt64(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toDatetimeLocalValue(unixSec) {
  if (!unixSec) return ''
  const d = new Date(Number(unixSec) * 1000)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function datetimeLocalToUnixSec(v) {
  if (!v) return 0
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return 0
  return Math.floor(d.getTime() / 1000)
}

export default function AdminUsersPage() {
  const navigate = useNavigate()

  const userRpc = useMemo(
    () =>
      new JsonRpc({
        url: 'user',
        basePath: ADMIN_BASE_PATH,
        authScope: AUTH_SCOPE.ADMIN,
      }),
    []
  )
  const subRpc = useMemo(
    () =>
      new JsonRpc({
        url: 'subscription',
        basePath: ADMIN_BASE_PATH,
        authScope: AUTH_SCOPE.ADMIN,
      }),
    []
  )

  const PAGE_SIZE = 30

  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)

  // 分页（1-based）
  const [page, setPage] = useState(1)

  // 搜索（按用户名）
  const [searchInput, setSearchInput] = useState('')
  const [searchName, setSearchName] = useState('') // 生效值
  const [filter, setFilter] = useState('') // '' | 'expired' | 'expiring_soon' | 'normal'
  const [stats, setStats] = useState({
    expired: 0,
    expiring_soon: 0,
    normal: 0,
    warning_days: 3,
  })

  // subscription options（可选，失败 fallback）
  const [subOptions, setSubOptions] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  // per-user inputs
  const [editingPoints, setEditingPoints] = useState({})
  const [editingDelta, setEditingDelta] = useState({})
  const [editingExpiresAt, setEditingExpiresAt] = useState({})
  const [customDays, setCustomDays] = useState({})

  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const options = useMemo(() => {
    if (subOptions && subOptions.length) return subOptions
    return [
      { code: 'D30', days: 30, title: '30 天订阅' },
      { code: 'D90', days: 90, title: '90 天订阅' },
      { code: 'D180', days: 180, title: '180 天订阅' },
      { code: 'CUSTOM', days: 0, title: '自定义天数' },
    ]
  }, [subOptions])

  const loadOptions = async () => {
    setLoadingOptions(true)
    try {
      const r = await subRpc.call('options', {})
      const opts = r?.data?.options || []
      setSubOptions(Array.isArray(opts) ? opts : [])
    } catch {
      setSubOptions([])
    } finally {
      setLoadingOptions(false)
    }
  }

  const fetchStats = async () => {
    try {
      const r = await userRpc.call('stats')
      const d = r?.data || {}
      setStats({
        expired: Number(d.expired) || 0,
        expiring_soon: Number(d.expiring_soon) || 0,
        normal: Number(d.normal) || 0,
        warning_days: Number(d.warning_days) || 3,
      })
    } catch (e) {
      console.warn('fetchStats error', e)
    }
  }

  const fetchList = async (p = page, q = searchName, f = filter) => {
    setErrMsg('')
    setLoading(true)
    try {
      const safePage = Math.max(1, clampInt(p, 1))
      const offset = (safePage - 1) * PAGE_SIZE

      const r = await userRpc.call('list', {
        limit: PAGE_SIZE,
        offset,
        search: (q || '').trim(),
        filter: f,
      })

      const data = r?.data || r?.result?.data || {}
      const list = Array.isArray(data?.users) ? data.users : []

      const t = clampInt64(data?.total, 0)
      setTotal(t)
      setItems(list)

      const tp = Math.max(1, Math.ceil((t || 0) / PAGE_SIZE))
      if (safePage > tp) setPage(tp)
    } catch (e) {
      setErrMsg(e?.message || String(e))
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  // 初次加载
  useEffect(() => {
    fetchList(1, '', '')
    loadOptions()
    fetchStats()
  }, [])

  // page / searchName / filter 改变就刷新
  useEffect(() => {
    fetchList(page, searchName, filter)
    fetchStats()
  }, [page, searchName, filter])

  // 初始化 expires 输入框默认值
  useEffect(() => {
    setEditingExpiresAt((prev) => {
      const next = { ...prev }
      for (const u of items) {
        const uid = u.id
        if (next[uid] === undefined) {
          next[uid] = toDatetimeLocalValue(u.expires_at)
        }
      }
      return next
    })
  }, [items])

  const onSearch = (e) => {
    e.preventDefault()
    setErrMsg('')
    setPage(1)
    setSearchName((searchInput || '').trim())
  }

  const onClearSearch = () => {
    setErrMsg('')
    setSearchInput('')
    setSearchName('')
    setFilter('')
    setPage(1)
  }

  const gotoFirst = () => setPage(1)
  const gotoPrev = () => setPage((p) => Math.max(1, p - 1))
  const gotoNext = () => setPage((p) => Math.min(totalPages, p + 1))
  const gotoLast = () => setPage(totalPages)

  const setDisabled = async (userId, disabled) => {
    setErrMsg('')
    try {
      await userRpc.call('set_disabled', {
        user_id: userId,
        disabled: !!disabled,
      })
      await fetchList(page, searchName, filter)
    } catch (e) {
      setErrMsg(e?.message || String(e))
    }
  }

  const doSetPoints = async (userId) => {
    setErrMsg('')
    const points = clampInt64(editingPoints[userId], NaN)
    if (!Number.isFinite(points) || points < 0) {
      setErrMsg('积分必须是 >= 0 的数字')
      return
    }
    try {
      await userRpc.call('points.set', { user_id: userId, points })
      setEditingPoints((prev) => ({ ...prev, [userId]: '' }))
      await fetchList(page, searchName, filter)
    } catch (e) {
      setErrMsg(e?.message || String(e))
    }
  }

  const doAddPoints = async (userId) => {
    setErrMsg('')
    const delta = clampInt64(editingDelta[userId], NaN)
    if (!Number.isFinite(delta)) {
      setErrMsg('增减积分必须是数字（可为负数）')
      return
    }
    try {
      await userRpc.call('points.add', { user_id: userId, delta })
      setEditingDelta((prev) => ({ ...prev, [userId]: '' }))
      await fetchList(page, searchName, filter)
    } catch (e) {
      setErrMsg(e?.message || String(e))
    }
  }

  const doSetExpiresAt = async (userId) => {
    setErrMsg('')
    const v = (editingExpiresAt[userId] || '').trim()
    const exp = v ? datetimeLocalToUnixSec(v) : 0
    if (v && !exp) {
      setErrMsg('有效期时间格式不正确')
      return
    }
    try {
      await userRpc.call('expires.set', { user_id: userId, expires_at: exp })
      await fetchList(page, searchName, filter)
      fetchStats()
    } catch (e) {
      setErrMsg(e?.message || String(e))
    }
  }

  const applyDays = async (userId, days) => {
    setErrMsg('')
    const d = clampInt(days, 0)
    if (d <= 0) {
      setErrMsg('天数必须大于 0')
      return
    }
    try {
      await subRpc.call('apply', { user_id: userId, add_days: d })
      await fetchList(page, searchName, filter)
      fetchStats()
    } catch (e) {
      setErrMsg(e?.message || String(e))
    }
  }

  const applyCustom = async (userId) => {
    setErrMsg('')
    const d = clampInt(customDays[userId], 0)
    if (d <= 0) {
      setErrMsg('自定义天数必须大于 0')
      return
    }
    try {
      await subRpc.call('apply', { user_id: userId, code: 'CUSTOM', days: d })
      setCustomDays((prev) => ({ ...prev, [userId]: '' }))
      await fetchList(page, searchName, filter)
      fetchStats()
    } catch (e) {
      setErrMsg(e?.message || String(e))
    }
  }

  return (
    <CasinoScreen>
      <div className="w-full">
        <div className="px-1.5 pt-1.5 sm:px-2 sm:pt-2 md:px-2.5 md:pt-2.5">
          <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:mb-6 sm:flex-row">
            <div>
              <div className="text-xl font-extrabold tracking-wide text-amber-200 sm:text-2xl">
                用户管理
              </div>
              <div className="mt-1 text-xs text-amber-100/70 sm:text-sm">
                管理用户状态 / 积分 / 订阅有效期（每页 {PAGE_SIZE} 条）
                {loadingOptions ? '（订阅选项加载中…）' : ''}
              </div>
            </div>

            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:gap-3">
              <button
                onClick={() => navigate('/admin-menu')}
                className="flex-1 rounded-2xl bg-amber-400 px-3 py-1.5 text-sm font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500 sm:flex-none sm:px-4 sm:py-2 sm:text-base"
              >
                返回菜單
              </button>
              <button
                onClick={() => {
                  fetchList(page, searchName, filter)
                  fetchStats()
                }}
                className="flex-1 rounded-2xl bg-amber-400 px-3 py-1.5 text-sm font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500 sm:flex-none sm:px-4 sm:py-2 sm:text-base"
                disabled={loading}
              >
                {loading ? '刷新中…' : '刷新'}
              </button>
            </div>
          </div>

          {/* 统计提示条 / 过滤器 */}
          {(stats.expired > 0 ||
            stats.expiring_soon > 0 ||
            stats.normal > 0 ||
            filter === 'expired' ||
            filter === 'expiring_soon' ||
            filter === 'normal') && (
            <div className="mb-4 flex flex-wrap gap-3">
              {(stats.expired > 0 || filter === 'expired') && (
                <button
                  onClick={() =>
                    setFilter(filter === 'expired' ? '' : 'expired')
                  }
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                    filter === 'expired'
                      ? 'border-red-500 bg-red-500/30 text-red-100 ring-2 ring-red-500/50'
                      : stats.expired > 0
                        ? 'border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                        : 'border-white/10 bg-black/20 text-white/40' // 0 expired but filter active (rare case if auto-refresh)
                  }`}
                >
                  <span className="text-base">⚠️</span>
                  <span>{stats.expired} 位用户已过期</span>
                  {filter === 'expired' && (
                    <span className="ml-1 text-xs opacity-60">(点击取消)</span>
                  )}
                </button>
              )}
              {(stats.expiring_soon > 0 || filter === 'expiring_soon') && (
                <button
                  onClick={() =>
                    setFilter(filter === 'expiring_soon' ? '' : 'expiring_soon')
                  }
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                    filter === 'expiring_soon'
                      ? 'border-yellow-500 bg-yellow-500/30 text-yellow-100 ring-2 ring-yellow-500/50'
                      : stats.expiring_soon > 0
                        ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20'
                        : 'border-white/10 bg-black/20 text-white/40'
                  }`}
                >
                  <span className="text-base">⏰</span>
                  <span>
                    {stats.expiring_soon} 位用户即将过期（{stats.warning_days}
                    天内）
                  </span>
                  {filter === 'expiring_soon' && (
                    <span className="ml-1 text-xs opacity-60">(点击取消)</span>
                  )}
                </button>
              )}
              {(stats.normal > 0 || filter === 'normal') && (
                <button
                  onClick={() => setFilter(filter === 'normal' ? '' : 'normal')}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                    filter === 'normal'
                      ? 'border-emerald-500 bg-emerald-500/30 text-emerald-100 ring-2 ring-emerald-500/50'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  }`}
                >
                  <span className="text-base">✅</span>
                  <span>{stats.normal} 位用户正常</span>
                  {filter === 'normal' && (
                    <span className="ml-1 text-xs opacity-60">(点击取消)</span>
                  )}
                </button>
              )}
            </div>
          )}

          {errMsg ? (
            <div className="mb-3 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-100 sm:mb-4 sm:px-4 sm:py-3 sm:text-sm">
              {errMsg}
            </div>
          ) : null}
        </div>

        <GoldFramePanel className="p-3 sm:p-4 md:p-6">
          <div className="p-3 sm:p-4 md:p-6">
            {/* 顶部：搜索 + 分页 + 订阅选项 */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <form onSubmit={onSearch} className="flex-1">
                <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                  按用户名搜索
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="min-w-[220px] flex-1 rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20 sm:px-4 sm:py-3 sm:text-base"
                    placeholder="输入用户名关键字"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500 sm:px-4 sm:py-3 sm:text-sm"
                    disabled={loading}
                  >
                    搜索
                  </button>
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-xs font-bold text-amber-200 hover:border-amber-200/60 sm:px-4 sm:py-3 sm:text-sm"
                    disabled={loading}
                  >
                    清空
                  </button>
                </div>
              </form>
            </div>

            {/* 列表 */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-base font-bold text-amber-200 sm:text-lg">
                用户列表
              </div>
              <div className="text-xs text-amber-100/70 sm:text-sm">
                本页 {items.length} 条 · 共 {total} 条
                {searchName ? `（搜索：${searchName}）` : ''}
              </div>
            </div>

            <div className="mt-3 h-[520px] overflow-auto overflow-y-auto rounded-2xl border border-amber-200/20 sm:h-[640px]">
              <table className="min-w-[1200px] text-left text-xs sm:text-sm">
                <thead className="sticky top-0 bg-black/25 text-amber-100/80">
                  <tr>
                    <th className="min-w-[80px] px-2 py-2 sm:px-4 sm:py-3">
                      ID
                    </th>
                    <th className="min-w-[150px] px-2 py-2 sm:px-4 sm:py-3">
                      用户名
                    </th>
                    <th className="min-w-[140px] px-2 py-2 sm:px-4 sm:py-3">
                      类型
                    </th>
                    <th className="min-w-[120px] px-2 py-2 sm:px-4 sm:py-3">
                      所属管理员
                    </th>
                    <th className="min-w-[90px] px-2 py-2 sm:px-4 sm:py-3">
                      状态
                    </th>
                    <th className="min-w-[220px] px-2 py-2 sm:px-4 sm:py-3">
                      积分
                    </th>
                    <th className="min-w-[260px] px-2 py-2 sm:px-4 sm:py-3">
                      有效期
                    </th>
                    <th className="min-w-[420px] px-2 py-2 sm:px-4 sm:py-3">
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-amber-200/10">
                  {items.map((u) => {
                    const { id } = u
                    const disabled = !!u.disabled
                    const roleText =
                      Number(u.role) === 1 ? '超级管理员' : '普通用户'

                    return (
                      <tr key={String(id)} className="bg-black/10 align-top">
                        <td className="px-2 py-2 font-mono text-amber-200 sm:px-4 sm:py-3">
                          {id}
                        </td>

                        <td className="px-2 py-2 sm:px-4 sm:py-3">
                          <div className="font-bold text-amber-100">
                            {u.username}
                          </div>
                        </td>

                        <td className="px-2 py-2 sm:px-4 sm:py-3">
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-bold sm:px-2 sm:py-1 ${
                              roleText === '超级管理员'
                                ? 'bg-purple-500/15 text-purple-200'
                                : 'bg-sky-500/15 text-sky-200'
                            }`}
                          >
                            {roleText}
                          </span>
                        </td>

                        <td className="px-2 py-2 text-amber-100/80 sm:px-4 sm:py-3">
                          {u.admin_name || '-'}
                        </td>

                        <td className="px-2 py-2 sm:px-4 sm:py-3">
                          <span
                            className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-bold sm:px-2 sm:py-1 ${
                              disabled
                                ? 'bg-zinc-500/15 text-zinc-200'
                                : 'bg-emerald-500/15 text-emerald-200'
                            }`}
                          >
                            {disabled ? '已禁用' : '已启用'}
                          </span>
                        </td>

                        <td className="px-2 py-2 sm:px-4 sm:py-3">
                          <div className="text-amber-100/90">
                            当前：{u.points ?? 0}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1 sm:gap-2">
                            <input
                              value={editingPoints[id] ?? ''}
                              onChange={(e) =>
                                setEditingPoints((prev) => ({
                                  ...prev,
                                  [id]: e.target.value,
                                }))
                              }
                              inputMode="numeric"
                              className="w-[110px] rounded-xl border border-amber-200/30 bg-black/25 px-2 py-1.5 text-xs text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20 sm:px-3 sm:py-2 sm:text-sm"
                              placeholder="设为"
                            />
                            <button
                              type="button"
                              className="rounded-xl border border-amber-200/30 bg-black/25 px-2 py-1.5 text-xs text-amber-200 hover:border-amber-200/60 sm:px-3 sm:py-2 sm:text-sm"
                              onClick={() => doSetPoints(id)}
                            >
                              设置
                            </button>

                            <input
                              value={editingDelta[id] ?? ''}
                              onChange={(e) =>
                                setEditingDelta((prev) => ({
                                  ...prev,
                                  [id]: e.target.value,
                                }))
                              }
                              className="w-[110px] rounded-xl border border-amber-200/30 bg-black/25 px-2 py-1.5 text-xs text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20 sm:px-3 sm:py-2 sm:text-sm"
                              placeholder="+/-"
                            />
                            <button
                              type="button"
                              className="rounded-xl border border-amber-200/30 bg-black/25 px-2 py-1.5 text-xs text-amber-200 hover:border-amber-200/60 sm:px-3 sm:py-2 sm:text-sm"
                              onClick={() => doAddPoints(id)}
                            >
                              加/减
                            </button>
                          </div>
                        </td>

                        <td className="px-2 py-2 sm:px-4 sm:py-3">
                          <div className="text-amber-100/80">
                            当前：{fmtTs(u.expires_at)}
                            {(() => {
                              if (!u.expires_at) return null
                              const now = Date.now() / 1000
                              const diff = u.expires_at - now
                              // dynamic warning days
                              const near = (stats.warning_days || 3) * 24 * 3600

                              if (diff <= 0) {
                                return (
                                  <div className="mt-1 text-xs font-bold text-red-400">
                                    ⚠️ 已过期
                                  </div>
                                )
                              }
                              if (diff < near) {
                                const d = Math.floor(diff / 86400)
                                const h = Math.floor((diff % 86400) / 3600)
                                return (
                                  <div className="mt-1 text-xs font-bold text-yellow-400">
                                    ⚠️ 即将过期 ({d}天{h}小时)
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1 sm:gap-2">
                            <input
                              type="datetime-local"
                              value={editingExpiresAt[id] ?? ''}
                              step={60}
                              onChange={(e) =>
                                setEditingExpiresAt((prev) => ({
                                  ...prev,
                                  [id]: e.target.value,
                                }))
                              }
                              onClick={(e) => {
                                // 兼容：支持 showPicker 的浏览器会直接弹出选择器
                                const el = e.currentTarget
                                if (typeof el.showPicker === 'function') {
                                  try {
                                    el.showPicker()
                                  } catch {}
                                }
                              }}
                              onPointerDown={(e) => {
                                // 有些桌面端 click 触发时机晚，pointerdown 更“像移动端点击即弹”
                                const el = e.currentTarget
                                if (typeof el.showPicker === 'function') {
                                  try {
                                    el.showPicker()
                                  } catch {}
                                }
                              }}
                              className="cursor-pointer rounded-xl border border-amber-200/30 bg-black/25 px-2 py-1.5 text-xs text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20 sm:px-3 sm:py-2 sm:text-sm"
                            />

                            <button
                              type="button"
                              className="rounded-xl border border-amber-200/30 bg-black/25 px-2 py-1.5 text-xs text-amber-200 hover:border-amber-200/60 sm:px-3 sm:py-2 sm:text-sm"
                              onClick={() => doSetExpiresAt(id)}
                              title="清空输入框后点设置 = 永久/未开通"
                            >
                              设置
                            </button>
                          </div>

                          <div className="mt-2 text-xs text-amber-100/50">
                            清空时间后点“设置”= 永久/未开通
                          </div>
                        </td>

                        <td className="px-2 py-2 sm:px-4 sm:py-3">
                          <div className="flex flex-wrap gap-1 sm:gap-2">
                            <button
                              type="button"
                              className="rounded-xl bg-amber-400 px-2 py-1.5 text-xs font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500 sm:px-3 sm:py-2 sm:text-sm"
                              onClick={() => setDisabled(id, !disabled)}
                            >
                              {disabled ? '启用用户' : '禁用用户'}
                            </button>

                            {options
                              .filter(
                                (o) => o.code !== 'CUSTOM' && Number(o.days) > 0
                              )
                              .map((o) => (
                                <button
                                  key={o.code}
                                  type="button"
                                  className="rounded-xl border border-amber-200/30 bg-black/25 px-2 py-1.5 text-xs text-amber-200 hover:border-amber-200/60 sm:px-3 sm:py-2 sm:text-sm"
                                  onClick={() => applyDays(id, Number(o.days))}
                                  title={o.title || `${o.days} 天`}
                                >
                                  +{Number(o.days)}天
                                </button>
                              ))}

                            <div className="flex items-center gap-1 sm:gap-2">
                              <input
                                value={customDays[id] ?? ''}
                                onChange={(e) =>
                                  setCustomDays((prev) => ({
                                    ...prev,
                                    [id]: e.target.value,
                                  }))
                                }
                                inputMode="numeric"
                                className="w-[100px] rounded-xl border border-amber-200/30 bg-black/25 px-2 py-1.5 text-xs text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20 sm:px-3 sm:py-2 sm:text-sm"
                                placeholder="自定义天数"
                              />
                              <button
                                type="button"
                                className="rounded-xl border border-amber-200/30 bg-black/25 px-2 py-1.5 text-xs text-amber-200 hover:border-amber-200/60 sm:px-3 sm:py-2 sm:text-sm"
                                onClick={() => applyCustom(id)}
                              >
                                延长
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {!items.length ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-xs text-amber-100/60 sm:py-8 sm:text-sm"
                      >
                        暂无用户
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* 底部分页（再放一组） */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:mt-4">
              <div className="text-xs text-amber-100/70 sm:text-sm">
                第 {page} / {totalPages} 页 · 本页 {items.length} 条 · 共{' '}
                {total} 条
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={gotoFirst}
                  className="rounded-2xl border border-amber-200/30 bg-black/25 px-3 py-1.5 text-xs font-bold text-amber-200 hover:border-amber-200/60 sm:text-sm"
                  disabled={loading || !hasPrev}
                >
                  第一页
                </button>
                <button
                  type="button"
                  onClick={gotoPrev}
                  className="rounded-2xl border border-amber-200/30 bg-black/25 px-3 py-1.5 text-xs font-bold text-amber-200 hover:border-amber-200/60 sm:text-sm"
                  disabled={loading || !hasPrev}
                >
                  上一页
                </button>
                <button
                  type="button"
                  onClick={gotoNext}
                  className="rounded-2xl border border-amber-200/30 bg-black/25 px-3 py-1.5 text-xs font-bold text-amber-200 hover:border-amber-200/60 sm:text-sm"
                  disabled={loading || !hasNext}
                >
                  下一页
                </button>
                <button
                  type="button"
                  onClick={gotoLast}
                  className="rounded-2xl border border-amber-200/30 bg-black/25 px-3 py-1.5 text-xs font-bold text-amber-200 hover:border-amber-200/60 sm:text-sm"
                  disabled={loading || page >= totalPages}
                >
                  最后一页
                </button>
              </div>
            </div>
          </div>
        </GoldFramePanel>
      </div>
    </CasinoScreen>
  )
}

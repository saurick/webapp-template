// web/src/pages/AdminHierarchy/index.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CasinoScreen from '@/common/components/layout/CasinoScreen'
import GoldFramePanel from '@/common/components/layout/GoldFramePanel'
import { JsonRpc } from '@/common/utils/jsonRpc'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { AUTH_SCOPE } from '@/common/auth/auth'

const LEVEL_LABELS = {
  0: '超级管理员',
  1: '一级管理员',
  2: '二级管理员',
}
const PAGE_SIZE = 20

function levelLabel(level) {
  if (level === 0 || level === 1 || level === 2) return LEVEL_LABELS[level]
  return '-'
}

function clampInt(v, fallback = 0) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

function fmtTs(ts) {
  if (!ts) return '-'
  const d = new Date(Number(ts) * 1000)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString()
}

export default function AdminHierarchyPage() {
  const navigate = useNavigate()
  const adminRpc = useMemo(
    () =>
      new JsonRpc({
        url: 'admin',
        basePath: ADMIN_BASE_PATH,
        authScope: AUTH_SCOPE.ADMIN,
      }),
    []
  )

  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [currentAdmin, setCurrentAdmin] = useState(null)
  const [admins, setAdmins] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [searchName, setSearchName] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '' | 'enabled' | 'disabled'
  const [page, setPage] = useState(1)

  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    level: '1',
    parentId: '',
  })
  const [updateForm, setUpdateForm] = useState({
    id: '',
    level: '1',
    parentId: '',
  })
  const [revokeForm, setRevokeForm] = useState({
    id: '',
    transferTo: '',
  })

  const adminNameMap = useMemo(() => {
    const map = {}
    admins.forEach((a) => {
      map[a.id] = a.username
    })
    return map
  }, [admins])

  const level1Admins = useMemo(
    () => admins.filter((a) => a.level === 1 && !a.disabled),
    [admins]
  )

  const adminStats = useMemo(() => {
    let enabled = 0
    let disabled = 0
    admins.forEach((a) => {
      if (a?.disabled) disabled += 1
      else enabled += 1
    })
    return {
      total: admins.length,
      enabled,
      disabled,
    }
  }, [admins])

  const filteredAdmins = useMemo(() => {
    const keyword = searchName.trim().toLowerCase()
    return admins.filter((a) => {
      // 关键入口：列表筛选只影响展示，不影响下方管理表单候选集。
      if (
        keyword &&
        !String(a?.username || '')
          .toLowerCase()
          .includes(keyword)
      ) {
        return false
      }
      if (statusFilter === 'enabled') return !a?.disabled
      if (statusFilter === 'disabled') return !!a?.disabled
      return true
    })
  }, [admins, searchName, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedAdmins = useMemo(() => {
    // 关键入口：先筛选再分页，确保统计和列表口径一致。
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredAdmins.slice(start, start + PAGE_SIZE)
  }, [filteredAdmins, currentPage])

  const revokeTargetAdminID = clampInt(revokeForm.id, 0)
  const revokeTargetAdmin = useMemo(
    () => admins.find((a) => a.id === revokeTargetAdminID) || null,
    [admins, revokeTargetAdminID]
  )

  const revokeTransferCandidates = useMemo(() => {
    const operatorLevel = currentAdmin?.level
    const operatorID = clampInt(currentAdmin?.id, 0)
    const targetLevel = revokeTargetAdmin?.level

    return admins.filter((a) => {
      if (!a || a.disabled) return false
      if (a.id === revokeTargetAdminID) return false

      // 按后端 revoke 规则做前端候选过滤，避免用户选到必然失败的接管人。
      if (operatorLevel === 1) {
        if (a.id === operatorID) return true
        return a.level === 2 && a.parent_id === operatorID
      }

      // 撤销一级管理员时，接管人不能是二级管理员。
      if (targetLevel === 1) {
        return a.level === 0 || a.level === 1
      }

      return true
    })
  }, [
    admins,
    currentAdmin?.id,
    currentAdmin?.level,
    revokeTargetAdmin?.level,
    revokeTargetAdminID,
  ])

  useEffect(() => {
    const selectedID = clampInt(revokeForm.transferTo, 0)
    if (selectedID <= 0) return
    if (revokeTransferCandidates.some((a) => a.id === selectedID)) return
    setRevokeForm((prev) => ({ ...prev, transferTo: '' }))
  }, [revokeForm.transferTo, revokeTransferCandidates])

  const refresh = async () => {
    setErrMsg('')
    setLoading(true)
    try {
      const me = await adminRpc.call('me', {})
      const meData = me?.data || null
      setCurrentAdmin(meData)

      if (meData?.level === 0 || meData?.level === 1) {
        const list = await adminRpc.call('list', {})
        const items = list?.data?.admins || []
        setAdmins(Array.isArray(items) ? items : [])
      } else {
        setAdmins([])
      }
    } catch (e) {
      setErrMsg(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const onSearch = (e) => {
    e.preventDefault()
    setSearchName(searchInput.trim())
    setPage(1)
  }

  const onResetFilters = () => {
    setSearchInput('')
    setSearchName('')
    setStatusFilter('')
    setPage(1)
  }

  const onCreate = async (e) => {
    e.preventDefault()
    setErrMsg('')
    setLoading(true)
    try {
      const isPrimary = currentAdmin?.level === 1
      const level = isPrimary ? 2 : clampInt(createForm.level, 1)
      const parentId = isPrimary
        ? currentAdmin?.id
        : clampInt(createForm.parentId, 0)
      await adminRpc.call('create', {
        username: createForm.username.trim(),
        password: createForm.password,
        level,
        parent_id: parentId,
      })
      setCreateForm({ username: '', password: '', level: '1', parentId: '' })
      await refresh()
    } catch (e) {
      setErrMsg(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const onUpdate = async (e) => {
    e.preventDefault()
    setErrMsg('')
    const targetAdminID = clampInt(updateForm.id, 0)
    if (targetAdminID <= 0) {
      setErrMsg('请输入有效的管理员 ID')
      return
    }

    const isPrimary = currentAdmin?.level === 1
    const level = isPrimary ? 2 : clampInt(updateForm.level, 1)

    let parentId = 0
    if (isPrimary) {
      parentId = clampInt(currentAdmin?.id, 0)
    } else if (level === 2) {
      parentId = clampInt(updateForm.parentId, 0)
    }

    if (level === 2 && parentId <= 0) {
      setErrMsg('二级管理员必须选择上级管理员')
      return
    }

    setLoading(true)
    try {
      const payload = {
        id: targetAdminID,
        level,
      }
      if (parentId > 0) {
        payload.parent_id = parentId
      }
      await adminRpc.call('update', payload)
      setUpdateForm({ id: '', level: '1', parentId: '' })
      await refresh()
    } catch (e) {
      setErrMsg(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const onRevoke = async (e) => {
    e.preventDefault()
    setErrMsg('')
    const targetID = clampInt(revokeForm.id, 0)
    if (targetID <= 0) {
      setErrMsg('请输入有效的管理员 ID')
      return
    }

    const isPrimary = currentAdmin?.level === 1
    const transferTo = isPrimary
      ? currentAdmin?.id
      : clampInt(revokeForm.transferTo, 0)
    if (!isPrimary && transferTo > 0) {
      const isAllowed = revokeTransferCandidates.some(
        (a) => a.id === transferTo
      )
      if (!isAllowed) {
        setErrMsg('接管管理员选择不合法，请重新选择')
        return
      }
    }

    setLoading(true)
    try {
      await adminRpc.call('revoke', {
        id: targetID,
        transfer_to_admin_id: transferTo,
      })
      setRevokeForm({ id: '', transferTo: '' })
      await refresh()
    } catch (e) {
      setErrMsg(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const isSuperAdmin = currentAdmin?.level === 0
  const isPrimaryAdmin = currentAdmin?.level === 1
  const canManageAdmins = isSuperAdmin || isPrimaryAdmin

  return (
    <CasinoScreen>
      <div className="w-full">
        <div className="mb-4 flex flex-col items-start justify-between gap-3 px-1.5 pt-1.5 sm:mb-6 sm:flex-row sm:px-2 sm:pt-2 md:px-2.5 md:pt-2.5">
          <div>
            <div className="text-xl font-extrabold tracking-wide text-amber-200 sm:text-2xl">
              分级管理
            </div>
            <div className="mt-1 text-xs text-amber-100/70 sm:text-sm">
              管理员层级与权限设置
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin-menu')}
              className="flex-1 rounded-2xl bg-amber-400 px-3 py-1.5 text-sm font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500 sm:flex-none sm:px-4 sm:py-2 sm:text-base"
            >
              返回菜单
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="flex-1 rounded-2xl bg-amber-400 px-3 py-1.5 text-sm font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-400/40 sm:flex-none sm:px-4 sm:py-2 sm:text-base"
            >
              {loading ? '刷新中…' : '刷新'}
            </button>
          </div>
        </div>

        <GoldFramePanel className="overflow-hidden p-4 sm:p-5 md:p-6">
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col gap-2 text-sm text-amber-100/90 sm:text-base">
              <div>
                当前管理员：
                <span className="ml-2 font-semibold text-amber-200">
                  {currentAdmin?.username || '-'}
                </span>
              </div>
              <div>
                等级：
                <span className="ml-2 font-semibold text-amber-200">
                  {levelLabel(currentAdmin?.level)}
                </span>
              </div>
            </div>

            {errMsg ? (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-100 sm:px-4 sm:py-3 sm:text-sm">
                {errMsg}
              </div>
            ) : null}

            {!canManageAdmins ? (
              <div className="rounded-xl border border-amber-200/20 bg-black/30 px-3 py-3 text-xs text-amber-100/80 sm:px-4 sm:py-4 sm:text-sm">
                只有超级管理员或一级管理员可以查看与管理分级结构。
              </div>
            ) : null}

            {canManageAdmins ? (
              <div className="grid w-full gap-4 sm:gap-6 lg:h-[calc(100vh-220px)] lg:grid-cols-2 lg:items-stretch">
                <div className="flex h-full min-h-0 min-w-0 flex-col">
                  <div className="mb-2 text-sm font-semibold tracking-wide text-amber-200 sm:text-base">
                    管理员列表
                  </div>
                  <div className="mb-3 space-y-3 sm:mb-4">
                    <form
                      onSubmit={onSearch}
                      className="flex flex-col gap-2 sm:flex-row sm:items-end"
                    >
                      <div className="flex-1">
                        <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                          按账号搜索
                        </label>
                        <input
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                          placeholder="输入管理员账号"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500"
                        >
                          搜索
                        </button>
                        <button
                          type="button"
                          onClick={onResetFilters}
                          className="rounded-xl border border-amber-200/30 bg-black/30 px-4 py-2 text-sm text-amber-100/90 hover:bg-black/40"
                        >
                          清空
                        </button>
                      </div>
                    </form>

                    {(adminStats.enabled > 0 ||
                      adminStats.disabled > 0 ||
                      statusFilter === 'enabled' ||
                      statusFilter === 'disabled') && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter(
                              statusFilter === 'enabled' ? '' : 'enabled'
                            )
                            setPage(1)
                          }}
                          className={`rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                            statusFilter === 'enabled'
                              ? 'border-emerald-500 bg-emerald-500/30 text-emerald-100 ring-2 ring-emerald-500/50'
                              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          }`}
                        >
                          ✅ {adminStats.enabled} 位管理员启用中
                          {statusFilter === 'enabled' ? '（点击取消）' : ''}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter(
                              statusFilter === 'disabled' ? '' : 'disabled'
                            )
                            setPage(1)
                          }}
                          className={`rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                            statusFilter === 'disabled'
                              ? 'border-red-500 bg-red-500/30 text-red-100 ring-2 ring-red-500/50'
                              : 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                          }`}
                        >
                          ⛔ {adminStats.disabled} 位管理员已禁用
                          {statusFilter === 'disabled' ? '（点击取消）' : ''}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 桌面端固定双栏高度后，列表区域在列内滚动，避免拉长整页。 */}
                  <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-amber-200/20 bg-black/20">
                    <table className="min-w-full text-xs text-amber-100/90 sm:text-sm">
                      <thead className="sticky top-0 z-10 bg-black/40 text-amber-200">
                        <tr>
                          <th className="px-3 py-2 text-left">ID</th>
                          <th className="px-3 py-2 text-left">账号</th>
                          <th className="px-3 py-2 text-left">等级</th>
                          <th className="px-3 py-2 text-left">上级</th>
                          <th className="px-3 py-2 text-left">状态</th>
                          <th className="px-3 py-2 text-left">直属用户数</th>
                          <th className="px-3 py-2 text-left">
                            可管理总用户数
                          </th>
                          <th className="px-3 py-2 text-left">下级数</th>
                          <th className="px-3 py-2 text-left">最后登录</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAdmins.length === 0 ? (
                          <tr>
                            <td
                              className="px-3 py-3 text-center text-amber-100/60"
                              colSpan={9}
                            >
                              {loading
                                ? '加载中…'
                                : admins.length === 0
                                  ? '暂无管理员记录'
                                  : '无匹配管理员'}
                            </td>
                          </tr>
                        ) : (
                          pagedAdmins.map((a) => (
                            <tr
                              key={a.id}
                              className="border-t border-amber-200/10"
                            >
                              <td className="px-3 py-2">{a.id}</td>
                              <td className="px-3 py-2">{a.username}</td>
                              <td className="px-3 py-2">
                                {levelLabel(a.level)}
                              </td>
                              <td className="px-3 py-2">
                                {a.parent_id
                                  ? adminNameMap[a.parent_id] ||
                                    `#${a.parent_id}`
                                  : '-'}
                              </td>
                              <td className="px-3 py-2">
                                {a.disabled ? '已禁用' : '启用中'}
                              </td>
                              <td className="px-3 py-2">{a.user_count || 0}</td>
                              <td className="px-3 py-2">
                                {a.manageable_user_count || a.user_count || 0}
                              </td>
                              <td className="px-3 py-2">
                                {a.child_admin_count || 0}
                              </td>
                              <td className="px-3 py-2">
                                {fmtTs(a.last_login_at)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {filteredAdmins.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2 text-xs text-amber-100/80 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
                      <div>
                        共 {filteredAdmins.length} 位管理员，当前第{' '}
                        {currentPage}/{totalPages} 页
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          className="rounded-xl border border-amber-200/30 bg-black/30 px-3 py-1.5 text-amber-100/90 hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          上一页
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage >= totalPages}
                          className="rounded-xl border border-amber-200/30 bg-black/30 px-3 py-1.5 text-amber-100/90 hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="h-full min-h-0 min-w-0 overflow-y-auto">
                  <div className="mb-2 text-sm font-semibold tracking-wide text-amber-200 sm:text-base">
                    管理操作
                  </div>
                  <div className="space-y-4 sm:space-y-6">
                    <div className="rounded-xl border border-amber-200/20 bg-black/20 p-3 sm:p-4">
                      <div className="mb-3 text-sm font-semibold tracking-wide text-amber-200 sm:text-base">
                        创建管理员
                      </div>
                      <form onSubmit={onCreate} className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                            账号
                          </label>
                          <input
                            value={createForm.username}
                            onChange={(e) =>
                              setCreateForm((prev) => ({
                                ...prev,
                                username: e.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                            placeholder="输入账号"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                            密码
                          </label>
                          <input
                            type="password"
                            value={createForm.password}
                            onChange={(e) =>
                              setCreateForm((prev) => ({
                                ...prev,
                                password: e.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                            placeholder="输入密码"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                            等级
                          </label>
                          {isPrimaryAdmin ? (
                            <div className="rounded-xl border border-amber-200/20 bg-black/20 px-3 py-2 text-sm text-amber-100/70">
                              二级管理员（一级管理员只能创建二级管理员）
                            </div>
                          ) : (
                            <select
                              value={createForm.level}
                              onChange={(e) =>
                                setCreateForm((prev) => ({
                                  ...prev,
                                  level: e.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                            >
                              <option value="1">一级管理员</option>
                              <option value="2">二级管理员</option>
                            </select>
                          )}
                        </div>
                        {createForm.level === '2' || isPrimaryAdmin ? (
                          <div>
                            <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                              上级管理员
                            </label>
                            {isPrimaryAdmin ? (
                              <div className="rounded-xl border border-amber-200/20 bg-black/20 px-3 py-2 text-xs text-amber-100/70">
                                默认归属当前一级管理员
                              </div>
                            ) : (
                              <select
                                value={createForm.parentId}
                                onChange={(e) =>
                                  setCreateForm((prev) => ({
                                    ...prev,
                                    parentId: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                              >
                                <option value="">请选择一级管理员</option>
                                {level1Admins.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.username} (ID: {a.id})
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : null}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-bold tracking-wide text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-400/40"
                        >
                          {loading ? '提交中…' : '创建管理员'}
                        </button>
                      </form>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-amber-200/20 bg-black/20 p-3 sm:p-4">
                        <div className="mb-3 text-sm font-semibold tracking-wide text-amber-200 sm:text-base">
                          调整管理员等级
                        </div>
                        <form onSubmit={onUpdate} className="space-y-3">
                          <div>
                            <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                              管理员 ID
                            </label>
                            <input
                              value={updateForm.id}
                              onChange={(e) =>
                                setUpdateForm((prev) => ({
                                  ...prev,
                                  id: e.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                              placeholder="输入管理员 ID"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                              等级
                            </label>
                            {isPrimaryAdmin ? (
                              <div className="rounded-xl border border-amber-200/20 bg-black/20 px-3 py-2 text-sm text-amber-100/70">
                                二级管理员（一级管理员只能管理二级管理员）
                              </div>
                            ) : (
                              <select
                                value={updateForm.level}
                                onChange={(e) =>
                                  setUpdateForm((prev) => ({
                                    ...prev,
                                    level: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                              >
                                <option value="1">一级管理员</option>
                                <option value="2">二级管理员</option>
                              </select>
                            )}
                          </div>
                          {updateForm.level === '2' || isPrimaryAdmin ? (
                            <div>
                              <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                                上级管理员
                              </label>
                              {isPrimaryAdmin ? (
                                <div className="rounded-xl border border-amber-200/20 bg-black/20 px-3 py-2 text-xs text-amber-100/70">
                                  默认归属当前一级管理员
                                </div>
                              ) : (
                                <select
                                  value={updateForm.parentId}
                                  onChange={(e) =>
                                    setUpdateForm((prev) => ({
                                      ...prev,
                                      parentId: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                                >
                                  <option value="">请选择上级管理员</option>
                                  {level1Admins.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.username} (ID: {a.id})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ) : null}
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-bold tracking-wide text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-400/40"
                          >
                            {loading ? '提交中…' : '更新等级'}
                          </button>
                        </form>
                      </div>

                      <div className="rounded-xl border border-amber-200/20 bg-black/20 p-3 sm:p-4">
                        <div className="mb-3 text-sm font-semibold tracking-wide text-amber-200 sm:text-base">
                          撤销管理员权限
                        </div>
                        <form onSubmit={onRevoke} className="space-y-3">
                          <div>
                            <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                              管理员 ID
                            </label>
                            <input
                              value={revokeForm.id}
                              onChange={(e) =>
                                setRevokeForm((prev) => ({
                                  ...prev,
                                  id: e.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                              placeholder="输入管理员 ID"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                              接管管理员（可选）
                            </label>
                            <select
                              value={revokeForm.transferTo}
                              onChange={(e) =>
                                setRevokeForm((prev) => ({
                                  ...prev,
                                  transferTo: e.target.value,
                                }))
                              }
                              disabled={isPrimaryAdmin}
                              className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-200/60"
                            >
                              {isPrimaryAdmin ? (
                                <option value="">
                                  默认由当前一级管理员接管
                                </option>
                              ) : (
                                <option value="">默认由超级管理员接管</option>
                              )}
                              {revokeTransferCandidates.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.username} ({levelLabel(a.level)} / ID:{' '}
                                  {a.id})
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-2xl bg-red-400 px-4 py-2.5 text-sm font-bold tracking-wide text-[#1b1b1b] hover:bg-red-300 active:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-400/40"
                          >
                            {loading ? '提交中…' : '撤销权限并转移'}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </GoldFramePanel>
      </div>
    </CasinoScreen>
  )
}

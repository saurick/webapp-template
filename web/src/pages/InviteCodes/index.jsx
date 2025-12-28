import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CasinoScreen from '@/common/components/layout/CasinoScreen'
import GoldFramePanel from '@/common/components/layout/GoldFramePanel'
import { JsonRpc } from '@/common/utils/jsonRpc'

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

function genCode(len = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 避免 0/O 1/I
  let s = ''
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

export default function InviteCodesPage() {
  const navigate = useNavigate()
  // 建议放 auth 域：/rpc/auth
  const authRpc = useMemo(() => new JsonRpc({ url: 'auth' }), [])

  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const [items, setItems] = useState([])
  const [copiedIds, setCopiedIds] = useState(new Set()) // 跟踪已复制的邀请码 ID

  // 新建表单
  const [code, setCode] = useState('')
  const [maxUses, setMaxUses] = useState('10') // 0 表示无限
  const [expiresAt, setExpiresAt] = useState('') // datetime-local
  const [createDisabled, setCreateDisabled] = useState(false)
  const [creating, setCreating] = useState(false)

  const refresh = async () => {
    setErrMsg('')
    setLoading(true)
    try {
      // ✅ 你需要在后端实现这个 method
      // 返回：result.data = { invite_codes: [...] }
      const r = await authRpc.call('invite.list', {})
      const list = r?.data?.invite_codes || []
      setItems(Array.isArray(list) ? list : [])
    } catch (e) {
      setErrMsg(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCreate = async (e) => {
    e.preventDefault()
    setErrMsg('')

    const finalCode = (code || '').trim() || genCode(10)

    // expiresAt 从 datetime-local 转成秒级时间戳
    let expTs = 0
    if (expiresAt) {
      const d = new Date(expiresAt)
      if (!Number.isNaN(d.getTime())) expTs = Math.floor(d.getTime() / 1000)
    }

    const payload = {
      code: finalCode,                 // 允许指定；也可以后端自动生成
      max_uses: clampInt(maxUses, 0),  // 0 = unlimited
      expires_at: expTs || 0,          // 0/空 = no expiry
      disabled: !!createDisabled,
    }

    setCreating(true)
    try {
      // ✅ 你需要在后端实现这个 method
      // 返回：result.data = { invite_code: {...} } 或 { success: true }
      await authRpc.call('invite.create', payload)
      setCode('')
      setMaxUses('10')
      setExpiresAt('')
      setCreateDisabled(false)
      await refresh()
    } catch (e2) {
      setErrMsg(e2?.message || String(e2))
    } finally {
      setCreating(false)
    }
  }

  const setDisabled = async (id, disabled) => {
    setErrMsg('')
    try {
      // ✅ 你需要在后端实现这个 method
      await authRpc.call('invite.set_disabled', { id, disabled: !!disabled })
      await refresh()
    } catch (e) {
      setErrMsg(e?.message || String(e))
    }
  }

  const incUsed = async (id) => {
    setErrMsg('')
    try {
      // ✅ 可选：你需要在后端实现这个 method（一般不需要前端手动加）
      await authRpc.call('invite.increase_used', { id, delta: 1 })
      await refresh()
    } catch (e) {
      setErrMsg(e?.message || String(e))
    }
  }

  const copy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(String(text))
      // 标记为已复制
      setCopiedIds((prev) => new Set(prev).add(id))
      // 3秒后恢复
      setTimeout(() => {
        setCopiedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 3000)
    } catch {
      // fallback：不强求
    }
  }

  return (
    <CasinoScreen className="px-4 py-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <div className="text-2xl font-extrabold tracking-wide text-amber-200">
              邀请码管理
            </div>
            <div className="text-amber-100/70 mt-1 text-sm">
              用于控制注册入口
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="rounded-2xl px-4 py-2 font-bold bg-amber-400 text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500"
            >
              返回菜单
            </button>
            <button
              onClick={refresh}
              className="rounded-2xl px-4 py-2 font-bold bg-amber-400 text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500"
              disabled={loading}
            >
              {loading ? '刷新中…' : '刷新'}
            </button>
          </div>
        </div>

        {errMsg ? (
          <div className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errMsg}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* 左侧：创建邀请码 */}
          <GoldFramePanel className="lg:col-span-2 p-4 sm:p-6">
            <div className="p-4 sm:p-6">
              <div className="text-lg font-bold text-amber-200">新建邀请码</div>

              <form onSubmit={onCreate} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm text-amber-100/80 mb-1">邀请码（可选）</label>
                  <div className="flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="flex-1 rounded-xl bg-black/25 border border-amber-200/30 px-4 py-3 text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                      placeholder="留空则自动生成"
                    />
                    <button
                      type="button"
                      onClick={() => setCode(genCode(10))}
                      className="rounded-xl px-3 py-2 font-bold bg-black/25 border border-amber-200/30 text-amber-200 hover:border-amber-200/60"
                    >
                      生成
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-amber-100/80 mb-1">最大使用次数（0=无限）</label>
                  <input
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-xl bg-black/25 border border-amber-200/30 px-4 py-3 text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                    placeholder="比如 10"
                  />
                </div>

                <div>
                  <label className="block text-sm text-amber-100/80 mb-1">过期时间（可选）</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-xl bg-black/25 border border-amber-200/30 px-4 py-3 text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  />
                  <div className="text-xs text-amber-100/60 mt-1">
                    不填 = 永不过期
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-amber-100/80">
                  <input
                    type="checkbox"
                    checked={createDisabled}
                    onChange={(e) => setCreateDisabled(e.target.checked)}
                  />
                  创建后默认禁用
                </label>

                <button
                  type="submit"
                  disabled={creating}
                  className={
                    'w-full rounded-2xl px-4 py-3 font-bold tracking-wide ' +
                    (creating
                      ? 'bg-amber-400/40 text-amber-100/70 cursor-not-allowed'
                      : 'bg-amber-400 text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500')
                  }
                >
                  {creating ? '创建中…' : '创建邀请码'}
                </button>
              </form>
            </div>
          </GoldFramePanel>

          {/* 右侧：列表 */}
          <GoldFramePanel className="lg:col-span-3 p-4 sm:p-6">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-amber-200">邀请码列表</div>
                <div className="text-sm text-amber-100/70">
                  共 {items.length} 条
                </div>
              </div>

              <div className="mt-4 overflow-auto rounded-2xl border border-amber-200/20 h-[400px] overflow-y-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-black/25 text-amber-100/80">
                    <tr>
                      <th className="px-4 py-3">邀请码</th>
                      <th className="px-4 py-3 min-w-[100px]">最大使用次数</th>
                      <th className="px-4 py-3 min-w-[100px]">已使用次数</th>
                      <th className="px-4 py-3 min-w-[100px]">过期时间</th>
                      <th className="px-4 py-3 min-w-[100px]">状态</th>
                      <th className="px-4 py-3 min-w-[100px]">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200/10">
                    {items.map((it) => {
                      const id = it.id
                      const disabled = !!it.disabled
                      const used = Number(it.used_count || 0)
                      const max = Number(it.max_uses || 0)
                      const usedUp = max > 0 && used >= max
                      const expired = it.expires_at ? (Number(it.expires_at) * 1000 < Date.now()) : false

                      let statusText = disabled ? 'Disabled' : 'Enabled'
                      if (usedUp) statusText = 'Used Up'
                      if (expired) statusText = 'Expired'

                      return (
                        <tr key={String(id)} className="bg-black/10">
                          <td className="px-4 py-3 font-mono text-amber-200">
                            {it.code}
                            <button
                              className="ml-2 text-xs text-amber-100/60 hover:text-amber-100 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-amber-100/60"
                              onClick={() => copy(id, it.code)}
                              type="button"
                              disabled={copiedIds.has(id)}
                            >
                              {copiedIds.has(id) ? '已复制' : '复制'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">{max || '∞'}</td>
                          <td className="px-4 py-3 text-center">{used}</td>
                          <td className="px-4 py-3 text-center">{fmtTs(it.expires_at)}</td>
                          <td className="px-4 py-3 text-center min-w-[110px]">
                            <span
                              className={
                                'inline-flex rounded-full px-2 py-1 text-xs font-bold text-center ' +
                                (statusText === 'Enabled'
                                  ? 'bg-emerald-500/15 text-emerald-200'
                                  : statusText === 'Disabled'
                                    ? 'bg-zinc-500/15 text-zinc-200'
                                    : 'bg-red-500/15 text-red-200')
                              }
                            >
                              {statusText === 'Enabled' ? '已启用' : statusText === 'Disabled' ? '已禁用' : '已过期'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-xl px-3 py-1.5 bg-black/25 border border-amber-200/30 text-amber-200 hover:border-amber-200/60"
                                onClick={() => setDisabled(id, !disabled)}
                              >
                                {disabled ? '启用' : '禁用'}
                              </button>

                              {/* 这个按钮一般不需要，仅用于你测试邀请码消耗逻辑 */}
                              <button
                                type="button"
                                className="rounded-xl px-3 py-1.5 bg-black/25 border border-amber-200/30 text-amber-200 hover:border-amber-200/60"
                                onClick={() => incUsed(id)}
                                title="仅用于测试：手动增加 used_count"
                              >
                                增加1次
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {!items.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-amber-100/60">
                          暂无邀请码
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {/* <div className="text-xs text-amber-100/50 mt-4">
                后端建议：invite.list 只返回必要字段；invite.create 支持 code 留空自动生成
              </div> */}
            </div>
          </GoldFramePanel>
        </div>
      </div>
    </CasinoScreen>
  )
}

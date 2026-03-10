import React from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import SurfacePanel from '@/common/components/layout/SurfacePanel'

const DEFAULT_ITEMS = [
  '管理员登录入口与受保护路由',
  '最小账号目录页（搜索、查看、启用/禁用）',
  '项目初始化扫描、健康检查和质量门禁',
]

const CUSTOMIZE_ITEMS = [
  '权限模型、角色矩阵、组织树和审批流',
  '积分、订阅、邀请码、会员有效期等业务字段',
  '外部系统集成、消息通知、审计策略和告警规则',
]

const INIT_COMMANDS = [
  'bash scripts/init-project.sh',
  'bash scripts/bootstrap.sh',
  'bash scripts/doctor.sh',
  'bash scripts/init-project.sh --project --strict',
  'bash scripts/qa/fast.sh',
]

function GuideList({ title, description, items, accentClass }) {
  return (
    <SurfacePanel className="p-5 sm:p-6">
      <div className="space-y-4">
        <div
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${accentClass}`}
        >
          {title}
        </div>
        <div className="text-sm leading-6 text-slate-300">{description}</div>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-100"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </SurfacePanel>
  )
}

export default function AdminGuidePage() {
  const navigate = useNavigate()

  return (
    <AppShell className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-100">
              Project Guide
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              后台默认只保留通用骨架
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              关键入口：这里故意保持为静态说明页，避免模板继续固化某一种后台业务模型。
              新项目需要的权限体系、会员策略和业务字段，应在初始化后按真实需求补齐。
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/admin-menu')}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
          >
            返回控制台
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GuideList
            title="Keep"
            description="下面这些能力适合作为模板默认后台基线，后续项目通常可以直接继承。"
            items={DEFAULT_ITEMS}
            accentClass="border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
          />
          <GuideList
            title="Customize"
            description="下面这些能力带有明显业务语义，不再作为模板默认后台的一部分。"
            items={CUSTOMIZE_ITEMS}
            accentClass="border-amber-300/30 bg-amber-300/10 text-amber-100"
          />
        </div>

        <SurfacePanel className="p-5 sm:p-6">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-100">
              Init Flow
            </div>
            <div className="text-sm leading-6 text-slate-300">
              如果项目是由当前模板初始化出来的，建议先完成一次模板收口，再继续业务开发。
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {INIT_COMMANDS.map((command) => (
                <div
                  key={command}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs text-cyan-100 sm:text-sm"
                >
                  {command}
                </div>
              ))}
            </div>
          </div>
        </SurfacePanel>
      </div>
    </AppShell>
  )
}

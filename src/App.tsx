import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/cn'
import {
  LayoutDashboard, Search, Cpu, Network, Target, FileText,
  Shield, Settings, ChevronLeft, ChevronRight, RefreshCw,
  Database, GitBranch, AlertTriangle, Activity, Clock,
  Zap, BarChart3, Eye, CheckCircle2, XCircle, Loader2,
  ArrowUpRight, TrendingUp, TrendingDown, Minus,
  Users, Globe, Building2, Code2, Brain, FileSearch,
  MessageSquare, ClipboardCheck, Bot, ScrollText,
  Layers, Workflow, Sparkles, AlertCircle, Archive,
  Send, Mail, HardDrive, Cloud, TestTube, LogOut
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend,
  AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import { StructureFlowBackground } from './components/StructureFlowBackground'
import { LoginPage } from './components/LoginPage'

// ─── Types ────────────────────────────────────────────────────────────
type View = 'dashboard' | 'discovery' | 'automation' | 'architecture' | 'opportunities' | 'reports' | 'governance' | 'admin' | 'delivery'

interface DashboardData {
  kpis: {
    totalSources: number; activeSources: number; totalFindings: number;
    newFindings: number; totalAutomations: number; totalOpportunities: number;
    highScoreOpps: number; pendingReviews: number; totalAgentRuns: number;
  }
  recentChanges: any[]
  domainCounts: any[]
  typeCounts: any[]
  scoreDistribution: any[]
  weeklyTrend: any[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const CONFIDENCE_COLORS: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  corroborated: 'bg-blue-100 text-blue-800 border-blue-200',
  inferred: 'bg-amber-100 text-amber-800 border-amber-200',
  speculative: 'bg-red-100 text-red-800 border-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  identified: 'bg-gray-100 text-gray-700',
  validated: 'bg-emerald-100 text-emerald-700',
  recommended: 'bg-purple-100 text-purple-700',
  approved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
  running: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-purple-100 text-purple-700',
}

const TYPE_ICONS: Record<string, any> = {
  new_capability: Sparkles,
  enhancement: TrendingUp,
  deprecation: AlertTriangle,
  architecture_change: Network,
  documentation_clarification: FileText,
  event_announcement: Bell,
}

function Bell(props: any) { return <AlertCircle {...props} /> }

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setData(body)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => { refetch() }, [refetch])
  return { data, loading, error, refetch }
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = score >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    score >= 65 ? 'text-blue-600 bg-blue-50 border-blue-200' :
    score >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-red-600 bg-red-50 border-red-200'
  const sizeClass = size === 'lg' ? 'text-2xl font-bold px-3 py-1' : size === 'sm' ? 'text-xs font-medium px-1.5 py-0.5' : 'text-sm font-semibold px-2 py-0.5'
  return <span className={cn('inline-flex items-center rounded-md border', color, sizeClass)}>{score.toFixed(1)}</span>
}

function ConfidenceBadge({ level }: { level: string }) {
  return <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', CONFIDENCE_COLORS[level] || 'bg-gray-100 text-gray-700')}>{level}</span>
}

function StatusBadge({ status }: { status: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[status] || 'bg-gray-100 text-gray-700')}>{status}</span>
}

// ─── Sidebar ──────────────────────────────────────────────────────────
const NAV_ITEMS: { id: View; label: string; icon: any; group: string }[] = [
  { id: 'dashboard', label: 'Weekly Pulse', icon: LayoutDashboard, group: 'Intelligence' },
  { id: 'discovery', label: 'Discovery', icon: Search, group: 'Intelligence' },
  { id: 'automation', label: 'Automation', icon: Cpu, group: 'Intelligence' },
  { id: 'architecture', label: 'Architecture', icon: Network, group: 'Intelligence' },
  { id: 'opportunities', label: 'Opportunities', icon: Target, group: 'Intelligence' },
  { id: 'reports', label: 'Saturday Reports', icon: FileText, group: 'Intelligence' },
  { id: 'delivery', label: 'Report Delivery', icon: Send, group: 'Operations' },
  { id: 'governance', label: 'Governance', icon: Shield, group: 'Operations' },
  { id: 'admin', label: 'Administration', icon: Settings, group: 'Operations' },
]

function Sidebar({ active, onNavigate, user, onLogout }: { active: View; onNavigate: (v: View) => void; user: { name: string; role: string; email: string }; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const groups = [...new Set(NAV_ITEMS.map(n => n.group))]

  return (
    <aside className={cn(
      'flex flex-col border-r border-slate-200 bg-slate-50/80 transition-all duration-200',
      collapsed ? 'w-16' : 'w-60'
    )}>
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shrink-0">SA</div>
        {!collapsed && <div className="overflow-hidden"><div className="text-sm font-semibold text-slate-900 truncate">SAIE</div><div className="text-[10px] text-slate-500 truncate">SAP Automation Intelligence</div></div>}
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map(group => (
          <div key={group}>
            {!collapsed && <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</div>}
            {NAV_ITEMS.filter(n => n.group === group).map(item => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button key={item.id} onClick={() => onNavigate(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors',
                    isActive ? 'bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 px-3 py-3">
        {!collapsed && user && (
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
              {user.name?.charAt(0) || '?'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-slate-900 truncate">{user.name || 'User'}</div>
              <div className="text-[10px] text-slate-500 truncate">{user.role || 'user'}</div>
            </div>
          </div>
        )}
        <div className="flex gap-1">
          <button onClick={() => setCollapsed(!collapsed)}
            className="flex-1 flex items-center justify-center py-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded hover:bg-slate-100">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button onClick={onLogout} title="Sign out"
            className="flex items-center justify-center py-1.5 text-slate-400 hover:text-red-600 transition-colors rounded hover:bg-red-50">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────
function Dashboard({ data, loading, onSeed }: { data: DashboardData | null; loading: boolean; onSeed: () => void }) {
  if (loading || !data) return <LoadingState />

  const kpiCards = [
    { label: 'Sources Monitored', value: data.kpis.activeSources, total: data.kpis.totalSources, icon: Database, color: 'blue' },
    { label: 'Findings', value: data.kpis.totalFindings, delta: `+${data.kpis.newFindings} new`, icon: FileSearch, color: 'emerald' },
    { label: 'Automations', value: data.kpis.totalAutomations, icon: Workflow, color: 'violet' },
    { label: 'Opportunities', value: data.kpis.totalOpportunities, badge: `${data.kpis.highScoreOpps} high-score`, icon: Target, color: 'amber' },
    { label: 'Pending Reviews', value: data.kpis.pendingReviews, icon: ClipboardCheck, color: 'rose' },
    { label: 'Agent Runs', value: data.kpis.totalAgentRuns, icon: Bot, color: 'cyan' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Weekly Pulse</h1><p className="text-sm text-slate-500">SAP Automation Intelligence — Current Week</p></div>
        <button onClick={onSeed} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"><RefreshCw className="h-3.5 w-3.5" /> Re-seed Data</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map(kpi => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-slate-500">{kpi.label}</span><Icon className={`h-4 w-4 text-${kpi.color}-500`} /></div>
              <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
              {kpi.total !== undefined && <div className="text-xs text-slate-400 mt-0.5">of {kpi.total} total</div>}
              {kpi.delta && <div className="text-xs text-emerald-600 mt-0.5">{kpi.delta}</div>}
              {kpi.badge && <div className="text-xs text-amber-600 mt-0.5">{kpi.badge}</div>}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Findings by Domain</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.domainCounts.map(d => ({ name: d.domain, count: d._count }))}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Automation Types</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.typeCounts.map(t => ({ name: t.automationType, value: t._count }))} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {data.typeCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Recent Changes</h3>
        <div className="space-y-3">
          {data.recentChanges.map((change: any) => {
            const TypeIcon = TYPE_ICONS[change.type] || AlertCircle
            return (
              <div key={change.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50"><TypeIcon className="h-4 w-4 text-blue-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-slate-900 truncate">{change.title}</span>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[change.type] || 'bg-gray-100 text-gray-600')}>{change.type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{change.summary}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-slate-400">{change.version?.source?.name}</span>
                    <span className="text-[10px] text-slate-400">•</span>
                    <span className="text-[10px] text-slate-400">{formatDateTime(change.classifiedAt)}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', change.confidence >= 0.9 ? 'bg-emerald-50 text-emerald-700' : change.confidence >= 0.8 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700')}>{(change.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Discovery ────────────────────────────────────────────────────────
const TIER_INFO: Record<number, { label: string; color: string; desc: string }> = {
  1: { label: 'Official Documentation', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', desc: 'SAP Help, Product Docs, API Hub — highest authority' },
  2: { label: 'Official Product Pages', color: 'bg-blue-100 text-blue-800 border-blue-300', desc: 'SAP product pages — official announcements & capabilities' },
  3: { label: 'Official News & Events', color: 'bg-violet-100 text-violet-800 border-violet-300', desc: 'SAP News Center, Sapphire, Innovation Guide' },
  4: { label: 'Community & Blogs', color: 'bg-amber-100 text-amber-800 border-amber-300', desc: 'SAP Community, expert blogs, discussions — user-generated insights' },
  5: { label: 'Industry Domains', color: 'bg-rose-100 text-rose-800 border-rose-300', desc: 'Industry-specific SAP pages — sector innovation & solutions' },
  6: { label: 'Functional Domains & Migration', color: 'bg-cyan-100 text-cyan-800 border-cyan-300', desc: 'S/4HANA functional areas, ECC-to-S/4 migration, clean core' },
}

function Discovery({ data, loading }: { data: any; loading: boolean }) {
  const [tab, setTab] = useState<'sources' | 'runs' | 'changes'>('sources')
  const [tierFilter, setTierFilter] = useState<number | null>(null)
  const [crawling, setCrawling] = useState<string | null>(null)
  const [crawlResults, setCrawlResults] = useState<Record<string, any>>({})
  if (loading || !data) return <LoadingState />

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Discovery & Source Intelligence</h1><p className="text-sm text-slate-500">Monitor sources, track crawl runs, and explore changes</p></div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {(['sources', 'runs', 'changes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{t === 'runs' ? 'Crawl Runs' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'sources' && (
        <>
          {/* Tier Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {Object.entries(TIER_INFO).map(([tier, info]) => {
              const count = data.sources?.filter((s: any) => s.tier === Number(tier)).length || 0
              return (
                <button key={tier} onClick={() => setTierFilter(tierFilter === Number(tier) ? null : Number(tier))}
                  className={cn('rounded-xl border-2 p-3 text-left transition-all hover:shadow-md', tierFilter === Number(tier) ? 'ring-2 ring-blue-400 border-blue-400' : 'border-transparent bg-white shadow-sm')}>
                  <div className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold mb-2', info.color)}>TIER {tier}</div>
                  <div className="text-lg font-bold text-slate-900">{count}</div>
                  <div className="text-[10px] text-slate-500 leading-tight">{info.label}</div>
                </button>
              )
            })}
          </div>
          {tierFilter && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold', TIER_INFO[tierFilter].color)}>Tier {tierFilter}</span>
                <span className="text-sm text-slate-700">{TIER_INFO[tierFilter].desc}</span>
              </div>
              <button onClick={() => setTierFilter(null)} className="text-xs text-blue-600 hover:text-blue-800">Clear filter</button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(tierFilter ? data.sources?.filter((s: any) => s.tier === tierFilter) : data.sources)?.map((s: any) => {
              const tierInfo = TIER_INFO[s.tier] || TIER_INFO[1]
              const result = crawlResults[s.id]
              return (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Database className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-sm font-semibold text-slate-900 truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold', tierInfo.color)}>T{s.tier}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>{s.active ? 'Active' : 'Off'}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mb-2 truncate font-mono">{s.url}</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{s.type}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{s.domain}</span>
                    {s.industry && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">{s.industry}</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>{s._count?.crawlRuns || 0} crawls</span>
                      {s.lastCrawl && <span>Last: {formatDateTime(s.lastCrawl)}</span>}
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        setCrawling(s.id)
                        try {
                          const res = await fetch('/api/crawl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: s.id }) })
                          const data = await res.json()
                          setCrawlResults((prev) => ({ ...prev, [s.id]: data }))
                        } catch { }
                        setCrawling(null)
                      }}
                      disabled={crawling === s.id}
                      className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                        crawling === s.id ? 'bg-blue-100 text-blue-500' : 'bg-blue-600 text-white hover:bg-blue-700')}>
                      {crawling === s.id ? <><Loader2 className="h-3 w-3 animate-spin" /> Crawling...</> : '🔗 Crawl'}
                    </button>
                  </div>
                  {result && (
                    <div className={cn('mt-3 rounded-lg border p-2.5 text-[10px]', result.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
                      {result.ok ? (
                        <div>
                          <div className="font-semibold text-emerald-700 mb-1">✅ Crawled: {result.crawl.contentLength} • {result.crawl.duration}</div>
                          <div className="text-emerald-600">Title: {result.crawl.title}</div>
                          {result.crawl.headings?.length > 0 && <div className="text-emerald-600">Headings: {result.crawl.headings.slice(0, 3).join(' | ')}</div>}
                          {result.crawl.automationKeywords?.length > 0 && <div className="text-blue-600 font-medium mt-1">🤖 Keywords: {result.crawl.automationKeywords.join(', ')}</div>}
                          {result.crawl.changed && <div className="text-amber-600 font-medium mt-1">⚡ Content changed from previous version</div>}
                        </div>
                      ) : (
                        <div className="text-red-600">❌ {result.error}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'runs' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Source</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Items Found</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Changed</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Started</th>
            </tr></thead>
            <tbody>
              {data.runs?.map((r: any) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.source?.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-slate-700">{r.itemsFound}</td>
                  <td className="px-4 py-3 text-slate-700">{r.itemsChanged}</td>
                  <td className="px-4 py-3 text-slate-500">{r.duration}s</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(r.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'changes' && (
        <div className="space-y-3">
          {data.changes?.map((ch: any) => {
            const TypeIcon = TYPE_ICONS[ch.type] || AlertCircle
            return (
              <div key={ch.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50"><TypeIcon className="h-4 w-4 text-blue-600" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-900">{ch.title}</span>
                      <StatusBadge status={ch.type.replace(/_/g, ' ')} />
                      {ch.material && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Material</span>}
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{ch.summary}</p>
                    <div className="flex items-center gap-3">
                      <ConfidenceBadge level={ch.confidence >= 0.9 ? 'confirmed' : ch.confidence >= 0.8 ? 'corroborated' : 'inferred'} />
                      <span className="text-[10px] text-slate-400">Source: {ch.version?.source?.name}</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(ch.classifiedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Automation Intelligence ──────────────────────────────────────────
function AutomationBoard({ data, loading }: { data: any; loading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)
  if (loading || !data) return <LoadingState />

  const items = data.automations || []
  const detail = selected ? items.find((a: any) => a.id === selected) : null

  if (detail) {
    return (
      <div className="space-y-6">
        <button onClick={() => setSelected(null)} className="text-sm text-blue-600 hover:text-blue-800">&larr; Back to all automations</button>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div><h2 className="text-xl font-bold text-slate-900">{detail.title}</h2><p className="text-sm text-slate-500 mt-1">{detail.description}</p></div>
            <StatusBadge status={detail.status} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <InfoCard label="Domain" value={detail.domain} />
            <InfoCard label="Type" value={detail.automationType?.replace(/_/g, ' ')} />
            <InfoCard label="SAP Products" value={detail.sapProducts} />
            <InfoCard label="Human in Loop" value={detail.humanInLoop ? 'Yes' : 'No'} />
          </div>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4"><h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Business Problem</h4><p className="text-sm text-slate-700">{detail.businessProblem}</p></div>
            {detail.currentProcess && <div className="rounded-lg bg-slate-50 p-4"><h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Current Process</h4><p className="text-sm text-slate-700">{detail.currentProcess}</p></div>}
            {detail.newCapability && <div className="rounded-lg bg-slate-50 p-4"><h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">New Capability</h4><p className="text-sm text-slate-700">{detail.newCapability}</p></div>}
            {detail.approach && <div className="rounded-lg bg-blue-50 p-4"><h4 className="text-xs font-semibold text-blue-500 uppercase mb-1">Approach</h4><p className="text-sm text-blue-700">{detail.approach}</p></div>}
            {detail.benefits && <div className="rounded-lg bg-emerald-50 p-4"><h4 className="text-xs font-semibold text-emerald-500 uppercase mb-1">Benefits ({detail.benefitSource})</h4><p className="text-sm text-emerald-700">{detail.benefits}</p></div>}
          </div>
          {detail.finding && <div className="mt-4 rounded-lg border border-slate-200 p-4"><h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Source Finding</h4><p className="text-sm font-medium text-slate-900">{detail.finding.title}</p><p className="text-xs text-slate-500 mt-1">{detail.finding.description}</p></div>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Automation Intelligence Board</h1><p className="text-sm text-slate-500">Extracted automation patterns from SAP ecosystem changes</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((auto: any) => (
          <div key={auto.id} onClick={() => setSelected(auto.id)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-violet-500" /><span className="text-sm font-semibold text-slate-900">{auto.title}</span></div>
              <StatusBadge status={auto.status} />
            </div>
            <p className="text-xs text-slate-500 line-clamp-2 mb-3">{auto.description}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">{auto.automationType?.replace(/_/g, ' ')}</span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">{auto.domain}</span>
              {auto.humanInLoop && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Human-in-Loop</span>}
            </div>
            <div className="text-[10px] text-slate-400">{auto.finding?.title}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] font-semibold text-slate-400 uppercase">{label}</div><div className="text-sm font-medium text-slate-900 mt-0.5">{value || '—'}</div></div>
}

// ─── Architecture Viewer ──────────────────────────────────────────────
function ArchitectureViewer({ data, loading }: { data: any; loading: boolean }) {
  const [selectedAuto, setSelectedAuto] = useState<string | null>(null)
  const [archData, setArchData] = useState<any>(null)
  if (loading || !data) return <LoadingState />

  const automations = data.automations || []
  const arch = archData

  if (arch && selectedAuto) {
    const auto = automations.find((a: any) => a.id === selectedAuto)
    return (
      <div className="space-y-6">
        <button onClick={() => { setSelectedAuto(null); setArchData(null) }} className="text-sm text-blue-600 hover:text-blue-800">&larr; Back to automations</button>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-1">{auto?.title || 'Architecture'}</h2>
          <p className="text-sm text-slate-500 mb-6">Evidence-backed technical architecture</p>

          <div className="relative min-h-[400px] bg-slate-50 rounded-lg border border-slate-200 p-4 overflow-auto">
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
              {arch.edges?.map((e: any, i: number) => {
                const from = arch.nodes?.find((n: any) => n.id === e.fromNodeId)
                const to = arch.nodes?.find((n: any) => n.id === e.toNodeId)
                if (!from || !to) return null
                return (
                  <g key={i}>
                    <line x1={(from.x || 100) + 60} y1={(from.y || 100) + 25} x2={(to.x || 100) + 60} y2={(to.y || 100) + 25} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrow)" />
                    <text x={((from.x || 100) + (to.x || 100)) / 2 + 60} y={((from.y || 100) + (to.y || 100)) / 2 + 25} textAnchor="middle" fill="#64748b" fontSize="9" dy="-4">{e.label || e.relation}</text>
                  </g>
                )
              })}
              <defs><marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="#94a3b8" /></marker></defs>
            </svg>
            {arch.nodes?.map((node: any) => {
              const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
                trigger: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700' },
                data_source: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700' },
                processing: { bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700' },
                decision: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700' },
                workflow: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700' },
                api: { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700' },
                target: { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700' },
                monitoring: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700' },
              }
              const c = nodeColors[node.nodeType] || { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-700' }
              return (
                <div key={node.id} className={`absolute ${c.bg} ${c.border} ${c.text} rounded-lg border-2 p-2 shadow-sm cursor-default`} style={{ left: node.x || 0, top: node.y || 0, minWidth: 120 }}>
                  <div className="text-[10px] font-semibold uppercase opacity-60">{node.nodeType.replace(/_/g, ' ')}</div>
                  <div className="text-xs font-bold">{node.name}</div>
                  {node.technology && <div className="text-[10px] opacity-70">{node.technology}</div>}
                  <div className="mt-1">{node.confirmed ? <span className="text-[10px] text-emerald-600">✓ Confirmed</span> : <span className="text-[10px] text-amber-600">? Inferred</span>}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Architecture Reconstruction</h1><p className="text-sm text-slate-500">Evidence-backed technical architecture for automation patterns</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automations.map((auto: any) => (
          <div key={auto.id} onClick={() => {
            setSelectedAuto(auto.id)
            fetch(`/api/architecture/${auto.id}`).then(r => r.json()).then(d => {
              setArchData(d)
            })
          }} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-200">
            <div className="flex items-center gap-2 mb-2"><Network className="h-4 w-4 text-blue-500" /><span className="text-sm font-semibold text-slate-900">{auto.title}</span></div>
            <p className="text-xs text-slate-500 line-clamp-2 mb-3">{auto.description}</p>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span>{auto._count?.archNodes || 0} nodes</span>
              <span>{auto._count?.archEdges || 0} edges</span>
              <span className="text-blue-500 font-medium">Click to explore →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Opportunity Radar ────────────────────────────────────────────────
function OpportunityRadar({ data, loading }: { data: any; loading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  if (loading || !data) return <LoadingState />

  const items = data.opportunities || []
  const filtered = filter === 'all' ? items : items.filter((o: any) => o.category?.includes(filter))
  const detail = selected ? items.find((o: any) => o.id === selected) : null

  if (detail) {
    const radarData = [
      { metric: 'Business Value', value: detail.businessValue, fullMark: 100 },
      { metric: 'Automation Potential', value: detail.automationPotential, fullMark: 100 },
      { metric: 'Technical Feasibility', value: detail.technicalFeasibility, fullMark: 100 },
      { metric: 'Reusability', value: detail.reusability, fullMark: 100 },
      { metric: 'Demand', value: detail.demand, fullMark: 100 },
      { metric: 'Differentiation', value: detail.differentiation, fullMark: 100 },
      { metric: 'Clean-Core', value: detail.cleanCoreRelevance, fullMark: 100 },
    ]

    return (
      <div className="space-y-6">
        <button onClick={() => setSelected(null)} className="text-sm text-blue-600 hover:text-blue-800">&larr; Back to opportunities</button>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div><h2 className="text-xl font-bold text-slate-900">{detail.title}</h2><p className="text-sm text-slate-500 mt-1">{detail.description}</p></div>
            <div className="text-right"><ScoreBadge score={detail.overrideScore || detail.totalScore} size="lg" /><div className="text-[10px] text-slate-400 mt-1">{detail.category}</div></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Score Breakdown</h3>
              <div className="space-y-2">
                {detail.scores?.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-40 shrink-0">{s.metric.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${s.value}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-900 w-8 text-right">{s.value}</span>
                    <span className="text-[10px] text-slate-400 w-12 text-right">×{(s.weight * 100).toFixed(0)}%</span>
                  </div>
                ))}
                {detail.complexityPenalty > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-red-600 w-40 shrink-0">Complexity Penalty</span>
                    <div className="flex-1 bg-red-100 rounded-full h-2"><div className="h-2 rounded-full bg-red-400" style={{ width: `${detail.complexityPenalty}%` }} /></div>
                    <span className="text-xs font-semibold text-red-600 w-8 text-right">-{detail.complexityPenalty}</span>
                  </div>
                )}
              </div>
              {detail.scoreRationale && <div className="mt-4 rounded-lg bg-slate-50 p-3"><h4 className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Rationale</h4><p className="text-xs text-slate-700">{detail.scoreRationale}</p></div>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Score Radar</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-900">Opportunity Radar</h1><p className="text-sm text-slate-500">Ranked automation and product opportunities</p></div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {['all', 'BTP Automation', 'Clean-Core', 'AI/Agentic', 'Standard SAP'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors', filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{f === 'all' ? 'All' : f}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((opp: any) => (
          <div key={opp.id} onClick={() => setSelected(opp.id)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2"><Target className="h-4 w-4 text-amber-500" /><span className="text-sm font-semibold text-slate-900">{opp.title}</span></div>
              <ScoreBadge score={opp.overrideScore || opp.totalScore} />
            </div>
            <p className="text-xs text-slate-500 line-clamp-2 mb-3">{opp.description}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              <StatusBadge status={opp.status} />
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{opp.category}</span>
              {opp.owner && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">{opp.owner}</span>}
            </div>
            <div className="flex items-center gap-1">
              {opp.scores?.slice(0, 5).map((s: any) => (
                <div key={s.id} className="flex-1 bg-slate-100 rounded h-1.5" title={`${s.metric}: ${s.value}`}>
                  <div className="h-1.5 rounded" style={{ width: `${s.value}%`, backgroundColor: s.value >= 80 ? '#10b981' : s.value >= 60 ? '#3b82f6' : '#f59e0b' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Reports ──────────────────────────────────────────────────────────
function Reports({ data, loading }: { data: any; loading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)
  if (loading || !data) return <LoadingState />

  const reports = data.reports || []
  const detail = selected ? data.reportDetail : null

  if (detail) {
    const highlights = detail.items?.filter((i: any) => i.highlight) || []
    const others = detail.items?.filter((i: any) => !i.highlight) || []

    return (
      <div className="space-y-6">
        <button onClick={() => setSelected(null)} className="text-sm text-blue-600 hover:text-blue-800">&larr; Back to reports</button>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div><h2 className="text-xl font-bold text-slate-900">{detail.title}</h2><p className="text-sm text-slate-500 mt-1">Period: {detail.period} • Generated: {formatDateTime(detail.generatedAt)}</p></div>
            <StatusBadge status={detail.status} />
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <InfoCard label="Sources Scanned" value={String(detail.sourcesScanned)} />
            <InfoCard label="Changes Found" value={String(detail.changesFound)} />
            <InfoCard label="Automations" value={String(detail.automationsFound)} />
            <InfoCard label="Opportunities" value={String(detail.opportunitiesFound)} />
          </div>

          {highlights.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Top Highlights</h3>
              <div className="space-y-3">
                {highlights.map((item: any) => (
                  <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-amber-600">#{item.rank}</span>
                      <span className="text-sm font-semibold text-slate-900">{item.finding?.title}</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{item.finding?.description}</p>
                    <div className="flex items-center gap-3">
                      <ConfidenceBadge level={item.finding?.evidenceLevel || 'inferred'} />
                      <span className="text-[10px] text-slate-400">{item.finding?.domain}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">All Findings</h3>
            <div className="space-y-2">
              {others.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 w-6">#{item.rank}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-900">{item.finding?.title}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <ConfidenceBadge level={item.finding?.evidenceLevel || 'inferred'} />
                      <span className="text-[10px] text-slate-400">{item.finding?.domain}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Saturday Intelligence Reports</h1><p className="text-sm text-slate-500">Weekly intelligence packages with executive summaries and detailed findings</p></div>
      <div className="space-y-4">
        {reports.map((report: any) => (
          <div key={report.id} onClick={async () => {
            setSelected(report.id)
            const res = await fetch(`/api/reports/${report.id}`)
            const detail = await res.json()
            data.reportDetail = detail.report
          }} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{report.title}</h3>
                <p className="text-xs text-slate-500 mt-1">Period: {report.period} • Generated: {report.generatedAt ? formatDateTime(report.generatedAt) : 'Not yet'}</p>
              </div>
              <StatusBadge status={report.status} />
            </div>
            <div className="flex items-center gap-6 mt-4">
              <div className="text-center"><div className="text-lg font-bold text-blue-600">{report.sourcesScanned}</div><div className="text-[10px] text-slate-400">Sources</div></div>
              <div className="text-center"><div className="text-lg font-bold text-emerald-600">{report.changesFound}</div><div className="text-[10px] text-slate-400">Changes</div></div>
              <div className="text-center"><div className="text-lg font-bold text-violet-600">{report.automationsFound}</div><div className="text-[10px] text-slate-400">Automations</div></div>
              <div className="text-center"><div className="text-lg font-bold text-amber-600">{report.opportunitiesFound}</div><div className="text-[10px] text-slate-400">Opportunities</div></div>
              <div className="text-center"><div className="text-lg font-bold text-slate-600">{report._count?.items || 0}</div><div className="text-[10px] text-slate-400">Items</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Governance ───────────────────────────────────────────────────────
function Governance({ data, loading }: { data: any; loading: boolean }) {
  const [tab, setTab] = useState<'reviews' | 'audit' | 'agents'>('reviews')
  if (loading || !data) return <LoadingState />

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Governance & Operations</h1><p className="text-sm text-slate-500">Review queue, audit trail, and agent health</p></div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {(['reviews', 'audit', 'agents'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{t === 'reviews' ? 'Review Queue' : t === 'audit' ? 'Audit Log' : 'Agent Operations'}</button>
        ))}
      </div>

      {tab === 'reviews' && (
        <div className="space-y-3">
          {data.reviews?.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-900">{r.entityType} review</span>
                </div>
                <StatusBadge status={r.decision} />
              </div>
              {r.comments && <p className="text-xs text-slate-600 mb-2">{r.comments}</p>}
              <div className="flex items-center gap-3">
                {r.confidence && <span className="text-[10px] text-slate-400">Confidence: {(r.confidence * 100).toFixed(0)}%</span>}
                {r.reviewedAt && <span className="text-[10px] text-slate-400">Reviewed: {formatDateTime(r.reviewedAt)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Actor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Details</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Timestamp</th>
            </tr></thead>
            <tbody>
              {data.auditLogs?.map((log: any) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 font-medium">{log.actor}</td>
                  <td className="px-4 py-3"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{log.action}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{log.entityType}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">{log.details}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'agents' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.agentRuns?.map((run: any) => (
              <div key={run.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold text-slate-900 capitalize">{run.agentType} Agent</span>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div><div className="text-[10px] text-slate-400 uppercase">Model</div><div className="text-xs font-medium text-slate-700">{run.model || '—'}</div></div>
                  <div><div className="text-[10px] text-slate-400 uppercase">Duration</div><div className="text-xs font-medium text-slate-700">{run.duration ? `${run.duration}s` : '—'}</div></div>
                  <div><div className="text-[10px] text-slate-400 uppercase">Cost</div><div className="text-xs font-medium text-slate-700">${run.cost?.toFixed(4) || '0'}</div></div>
                </div>
                {run.error && <div className="mt-2 rounded bg-red-50 px-2 py-1 text-[10px] text-red-600">{run.error}</div>}
                <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                  <span>Input: {run.inputTokens?.toLocaleString()} tokens</span>
                  <span>Output: {run.outputTokens?.toLocaleString()} tokens</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Delivery Settings ────────────────────────────────────────────────
function DeliverySettings() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [sendResult, setSendResult] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'email' | 'local' | 'drive'>('email')

  useEffect(() => {
    fetch('/api/delivery/config')
      .then(r => r.json())
      .then(data => { setConfig(data.config); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/delivery/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.ok) setConfig(data.config)
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    setTestResult({ loading: true })
    const res = await fetch('/api/delivery/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    const data = await res.json()
    setTestResult(data)
  }

  const handleTestDrive = async () => {
    setTestResult({ loading: true })
    const res = await fetch('/api/delivery/test-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    const data = await res.json()
    setTestResult(data)
  }

  const handleSendNow = async () => {
    setSendResult({ loading: true })
    const res = await fetch('/api/delivery/send', { method: 'POST' })
    const data = await res.json()
    setSendResult(data)
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Report Delivery</h1>
          <p className="text-sm text-slate-500">Configure how Saturday Intelligence Reports are delivered</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSendNow} disabled={sendResult?.loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Send className="h-4 w-4" />
            {sendResult?.loading ? 'Sending...' : 'Send Report Now'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {sendResult && !sendResult.loading && (
        <div className={`rounded-lg border p-4 ${sendResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-sm font-medium">{sendResult.ok ? '✅ Report Sent Successfully' : '❌ Send Failed'}</div>
          {sendResult.channels && (
            <div className="mt-2 text-xs space-y-1">
              <div>Email: {sendResult.channels.email?.ok ? '✅ Sent' : `❌ ${sendResult.channels.email?.error}`}</div>
              <div>Local Files: {sendResult.channels.local?.ok ? `✅ ${sendResult.channels.local.files?.length} files saved` : `❌ ${sendResult.channels.local?.error}`}</div>
              <div>Google Drive: {sendResult.channels.googleDrive?.ok ? '✅ Uploaded' : `❌ ${sendResult.channels.googleDrive?.error}`}</div>
            </div>
          )}
        </div>
      )}

      {/* Channel Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {(['email', 'local', 'drive'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>
            {tab === 'email' && <><Mail className="inline h-4 w-4 mr-1" /> Email (SMTP)</>}
            {tab === 'local' && <><HardDrive className="inline h-4 w-4 mr-1" /> Local Files</>}
            {tab === 'drive' && <><Cloud className="inline h-4 w-4 mr-1" /> Google Drive</>}
          </button>
        ))}
      </div>

      {/* Email Configuration */}
      {activeTab === 'email' && config && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Email (SMTP) Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">SMTP Server</label>
              <select value={config.smtpHost} onChange={e => setConfig({ ...config, smtpHost: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="smtp.gmail.com">Gmail (Free, Unlimited)</option>
                <option value="smtp-relay.brevo.com">Brevo (Free, 300/day)</option>
                <option value="smtp.mailgun.org">Mailgun (Free, 1K/month)</option>
                <option value="smtp-mail.outlook.com">Outlook</option>
                <option value="smtp.mail.yahoo.com">Yahoo</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Port</label>
              <input type="number" value={config.smtpPort} onChange={e => setConfig({ ...config, smtpPort: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email Address</label>
              <input type="email" value={config.smtpUser} onChange={e => setConfig({ ...config, smtpUser: e.target.value })}
                placeholder="you@gmail.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">App Password</label>
              <input type="password" value={config.smtpPass} onChange={e => setConfig({ ...config, smtpPass: e.target.value })}
                placeholder="xxxx-xxxx-xxxx-xxxx" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Recipients (comma-separated)</label>
              <input type="text" value={config.emailRecipients?.join(', ')} onChange={e => setConfig({ ...config, emailRecipients: e.target.value.split(',').map((s: string) => s.trim()) })}
                placeholder="team-lead@company.com, coe@company.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleTestEmail} className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
              <TestTube className="h-4 w-4" /> Test Connection
            </button>
            {testResult && !testResult.loading && (
              <span className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.ok ? '✅ Connection successful' : `❌ ${testResult.error}`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Local Files Configuration */}
      {activeTab === 'local' && config && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Local File Export</h3>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Export Path</label>
            <input type="text" value={config.localExportPath} onChange={e => setConfig({ ...config, localExportPath: e.target.value })}
              placeholder="C:\Users\DELL\Desktop\SAIE_Reports" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <p className="text-xs text-slate-400 mt-1">Reports will be saved here every Saturday at 10 PM IST</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Export Formats</label>
            <div className="flex gap-4">
              {(['html', 'json', 'csv'] as const).map(fmt => (
                <label key={fmt} className="flex items-center gap-2">
                  <input type="checkbox" checked={config.exportFormats?.includes(fmt)}
                    onChange={e => {
                      const formats = config.exportFormats || []
                      setConfig({
                        ...config,
                        exportFormats: e.target.checked ? [...formats, fmt] : formats.filter((f: string) => f !== fmt)
                      })
                    }} className="rounded" />
                  <span className="text-sm uppercase font-medium">{fmt}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-700">Files generated each Saturday:</div>
            <div className="mt-2 text-xs text-slate-500 space-y-1">
              <div>📄 SAIE_2026-W32.html — Formatted report</div>
              <div>📊 SAIE_2026-W32.json — Structured data</div>
              <div>📈 SAIE_2026-W32.csv — Spreadsheet-ready</div>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Configuration */}
      {activeTab === 'drive' && config && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Google Drive (OAuth2)</h3>
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.googleDriveEnabled}
                onChange={e => setConfig({ ...config, googleDriveEnabled: e.target.checked })}
                className="rounded" />
              <span className="text-sm font-medium">Enable Google Drive Upload</span>
            </label>
          </div>
          {config.googleDriveEnabled && (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm">
                <div className="font-medium text-blue-800">Setup Instructions:</div>
                <ol className="mt-2 text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" className="underline">Google Cloud Console</a></li>
                  <li>Create a project → Enable Google Drive API</li>
                  <li>Create OAuth2 credentials (Web application)</li>
                  <li>Add your redirect URI: <code className="bg-blue-100 px-1 rounded">http://localhost:3001/api/auth/google/callback</code></li>
                  <li>Copy Client ID, Client Secret, and Refresh Token below</li>
                </ol>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Client ID</label>
                  <input type="text" value={config.googleDriveClientId} onChange={e => setConfig({ ...config, googleDriveClientId: e.target.value })}
                    placeholder="xxxx.apps.googleusercontent.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Client Secret</label>
                  <input type="password" value={config.googleDriveClientSecret} onChange={e => setConfig({ ...config, googleDriveClientSecret: e.target.value })}
                    placeholder="GOCSPX-..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Refresh Token</label>
                  <input type="password" value={config.googleDriveRefreshToken} onChange={e => setConfig({ ...config, googleDriveRefreshToken: e.target.value })}
                    placeholder="1//0..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Folder ID (optional)</label>
                  <input type="text" value={config.googleDriveFolderId} onChange={e => setConfig({ ...config, googleDriveFolderId: e.target.value })}
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <p className="text-xs text-slate-400 mt-1">Leave empty to save to root folder</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Share With (emails)</label>
                  <input type="text" value={config.googleDriveSharedWith?.join(', ')} onChange={e => setConfig({ ...config, googleDriveSharedWith: e.target.value.split(',').map((s: string) => s.trim()) })}
                    placeholder="team@company.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleTestDrive} className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                  <TestTube className="h-4 w-4" /> Test Connection
                </button>
                {testResult && !testResult.loading && (
                  <span className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.ok ? `✅ Connected as ${testResult.email}` : `❌ ${testResult.error}`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule Configuration */}
      {config && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Schedule</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Day</label>
              <select value={config.scheduleDay} onChange={e => setConfig({ ...config, scheduleDay: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="saturday">Saturday</option>
                <option value="friday">Friday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Time</label>
              <input type="time" value={config.scheduleTime} onChange={e => setConfig({ ...config, scheduleTime: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Timezone</label>
              <select value={config.scheduleTimezone} onChange={e => setConfig({ ...config, scheduleTimezone: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="Asia/Kolkata">IST (India)</option>
                <option value="America/New_York">EST (US East)</option>
                <option value="America/Los_Angeles">PST (US West)</option>
                <option value="Europe/London">GMT (UK)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            📅 Reports are generated and delivered every <strong>{config.scheduleDay}</strong> at <strong>{config.scheduleTime}</strong> ({config.scheduleTimezone})
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Admin ────────────────────────────────────────────────────────────
function Admin({ dashboardData }: { dashboardData: DashboardData | null }) {
  if (!dashboardData) return <LoadingState />

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-900">Administration</h1><p className="text-sm text-slate-500">System configuration, scoring weights, and operational controls</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Scoring Weights</h3>
          <div className="space-y-3">
            {[
              { label: 'Business Value', weight: 20, color: 'bg-blue-500' },
              { label: 'Automation Potential', weight: 15, color: 'bg-violet-500' },
              { label: 'Technical Feasibility', weight: 15, color: 'bg-emerald-500' },
              { label: 'Reusability', weight: 15, color: 'bg-cyan-500' },
              { label: 'Demand', weight: 10, color: 'bg-amber-500' },
              { label: 'Differentiation', weight: 10, color: 'bg-rose-500' },
              { label: 'Clean-Core Relevance', weight: 10, color: 'bg-indigo-500' },
              { label: 'Complexity Penalty (max)', weight: -15, color: 'bg-red-400' },
            ].map(w => (
              <div key={w.label} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-40 shrink-0">{w.label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className={cn('h-2 rounded-full', w.color)} style={{ width: `${Math.abs(w.weight)}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-900 w-8 text-right">{w.weight > 0 ? w.weight : w.weight}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">System Health</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2"><Database className="h-4 w-4 text-blue-500" /><span className="text-sm text-slate-700">Database</span></div>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Healthy</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-blue-500" /><span className="text-sm text-slate-700">Sources Active</span></div>
              <span className="text-xs font-medium text-slate-700">{dashboardData.kpis.activeSources}/{dashboardData.kpis.totalSources}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-blue-500" /><span className="text-sm text-slate-700">Agent Runs</span></div>
              <span className="text-xs font-medium text-slate-700">{dashboardData.kpis.totalAgentRuns} total</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-blue-500" /><span className="text-sm text-slate-700">Pending Reviews</span></div>
              <span className={cn('text-xs font-medium', dashboardData.kpis.pendingReviews > 0 ? 'text-amber-600' : 'text-emerald-600')}>{dashboardData.kpis.pendingReviews} items</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Platform Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCard label="Version" value="1.0.0" />
            <InfoCard label="LLM Provider" value="Model Gateway" />
            <InfoCard label="Report Schedule" value="Saturday 06:00 UTC" />
            <InfoCard label="Crawl Frequency" value="Daily" />
            <InfoCard label="RBAC" value="Enabled" />
            <InfoCard label="Audit Logging" value="Enabled" />
            <InfoCard label="Tenant Isolation" value="Active" />
            <InfoCard label="Data Retention" value="365 days" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Loading ──────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  )
}

// ─── Auth ─────────────────────────────────────────────────────────────
interface AuthUser { name: string; role: string; email: string }

function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('saie_session')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ─── Main App ─────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)
  const [view, setView] = useState<View>('dashboard')
  const [seeded, setSeeded] = useState(false)
  const { data: dashData, loading: dashLoad, refetch: dashRefetch } = useFetch<DashboardData>('/api/dashboard')
  const { data: discoveryData, loading: discLoad, refetch: discRefetch } = useFetch<any>('/api/sources')
  const { data: changesData, loading: changesLoad } = useFetch<any>('/api/changes')
  const { data: autoData, loading: autoLoad } = useFetch<any>('/api/automations')
  const { data: oppData, loading: oppLoad } = useFetch<any>('/api/opportunities')
  const { data: reportData, loading: reportLoad } = useFetch<any>('/api/reports')
  const { data: reviewData, loading: reviewLoad } = useFetch<any>('/api/reviews/pending')
  const { data: auditData, loading: auditLoad } = useFetch<any>('/api/audit')
  const { data: agentData, loading: agentLoad } = useFetch<any>('/api/agents')

  const handleSeed = async () => {
    await fetch('/api/seed', { method: 'POST' })
    setSeeded(true)
    dashRefetch()
    discRefetch()
    window.location.reload()
  }

  // Auto-seed on first load if empty
  const handleLogin = (userData: AuthUser) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('saie_session')
    setUser(null)
  }

  useEffect(() => {
    if (dashData && dashData.kpis.totalSources === 0 && !seeded) {
      handleSeed()
    }
  }, [dashData, seeded])

  const discoveryCombined = discoveryData ? { sources: discoveryData.items || discoveryData.sources, changes: changesData?.changes || changesData?.items } : null

  if (!user) {
    return (
      <>
        <StructureFlowBackground />
        <LoginPage onLogin={handleLogin} />
      </>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100/50">
      <Sidebar active={view} onNavigate={setView} user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          {view === 'dashboard' && <Dashboard data={dashData} loading={dashLoad} onSeed={handleSeed} />}
          {view === 'discovery' && <Discovery data={discoveryCombined} loading={discLoad || changesLoad} />}
          {view === 'automation' && <AutomationBoard data={{ automations: autoData?.items || autoData?.automations }} loading={autoLoad} />}
          {view === 'architecture' && <ArchitectureViewer data={{ automations: autoData?.items || autoData?.automations }} loading={autoLoad} />}
          {view === 'opportunities' && <OpportunityRadar data={{ opportunities: oppData?.items || oppData?.opportunities }} loading={oppLoad} />}
          {view === 'reports' && <Reports data={{ reports: reportData?.items || reportData?.reports }} loading={reportLoad} />}
          {view === 'delivery' && <DeliverySettings />}
          {view === 'governance' && <Governance data={{ reviews: reviewData?.items || reviewData?.reviews, auditLogs: auditData?.items || auditData?.logs, agentRuns: agentData?.items || agentData?.runs }} loading={reviewLoad || auditLoad || agentLoad} />}
          {view === 'admin' && <Admin dashboardData={dashData} />}
        </div>
      </main>
    </div>
  )
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (C) 2026 Shogo Technologies, Inc.

import { Hono } from 'hono'
import { prisma } from './src/lib/db'

const app = new Hono()

// ─── Auth ──────────────────────────────────────────────────────────────
// Default admin credentials (production would use hashed passwords in DB)
const DEFAULT_USERS: Record<string, { password: string; name: string; role: string; email: string }> = {
  'admin@saie.local': { password: 'admin', name: 'Administrator', role: 'admin', email: 'admin@saie.local' },
}

app.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { email, password } = body as { email?: string; password?: string }

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const user = DEFAULT_USERS[email.toLowerCase()]
  if (!user || user.password !== password) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        action: 'login',
        entityType: 'user',
        entityId: email,
        details: JSON.stringify({ name: user.name, role: user.role }),
      },
    })
  } catch { /* non-critical */ }

  return c.json({
    user: { name: user.name, role: user.role, email: user.email },
    token: Buffer.from(`${email}:${Date.now()}`).toString('base64'),
  })
})

app.get('/auth/me', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'Not authenticated' }, 401)

  const token = Buffer.from(auth.slice(7), 'base64').toString()
  const email = token.split(':')[0]
  const user = DEFAULT_USERS[email]
  if (!user) return c.json({ error: 'Invalid token' }, 401)

  return c.json({ user: { name: user.name, role: user.role, email: user.email } })
})

// ─── Dashboard ────────────────────────────────────────────────────────
app.get('/dashboard', async (c) => {
  const [
    totalSources,
    activeSources,
    totalFindings,
    newFindings,
    totalAutomations,
    totalOpportunities,
    highScoreOpps,
    pendingReviews,
    totalAgentRuns,
    recentChanges,
  ] = await Promise.all([
    prisma.source.count(),
    prisma.source.count({ where: { active: true } }),
    prisma.finding.count(),
    prisma.finding.count({ where: { status: 'new' } }),
    prisma.automation.count(),
    prisma.opportunity.count(),
    prisma.opportunity.count({ where: { totalScore: { gte: 70 } } }),
    prisma.review.count({ where: { decision: 'pending' } }),
    prisma.agentRun.count(),
    prisma.change.findMany({
      take: 10,
      orderBy: { classifiedAt: 'desc' },
      include: { version: { include: { source: true } } },
    }),
  ])

  const domainCounts = await prisma.automation.groupBy({
    by: ['domain'],
    _count: true,
    orderBy: { _count: { domain: 'desc' } },
    take: 10,
  })

  const typeCounts = await prisma.automation.groupBy({
    by: ['automationType'],
    _count: true,
    orderBy: { _count: { automationType: 'desc' } },
  })

  const scoreDistribution = await prisma.opportunity.groupBy({
    by: ['category'],
    _count: true,
    _avg: { totalScore: true },
  })

  const weeklyTrend = await prisma.change.groupBy({
    by: ['type'],
    _count: true,
  })

  return c.json({
    kpis: {
      totalSources,
      activeSources,
      totalFindings,
      newFindings,
      totalAutomations,
      totalOpportunities,
      highScoreOpps,
      pendingReviews,
      totalAgentRuns,
    },
    recentChanges,
    domainCounts,
    typeCounts,
    scoreDistribution,
    weeklyTrend,
  })
})

// ─── Health Check ────────────────────────────────────────────────────
app.get('/health', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const { getLLMStatus } = await import('./llm-client')
    const llm = getLLMStatus()
    const sourceCount = await prisma.source.count()
    return c.json({
      status: 'healthy',
      database: 'connected',
      scheduler: 'checking',
      sources: sourceCount,
      llm: {
        available: llm.available,
        provider: llm.provider,
        model: llm.model,
      },
    })
  } catch {
    return c.json({ status: 'unhealthy', database: 'disconnected' }, 503)
  }
})

// ─── LLM Provider Status ─────────────────────────────────────────────
app.get('/llm/status', async (c) => {
    const { getLLMStatus } = await import('./llm-client')
    const status = getLLMStatus()
  return c.json({
    ...status,
    supportedProviders: [
      { key: 'ANTHROPIC_API_KEY', name: 'Anthropic (Claude)', models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet', 'claude-3-haiku'] },
      { key: 'OPENAI_API_KEY', name: 'OpenAI (GPT)', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
      { key: 'GEMINI_API_KEY', name: 'Google Gemini', models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
      { key: 'NVIDIA_API_KEY', name: 'NVIDIA NIM', models: ['meta/llama-3.1-70b-instruct', 'meta/llama-3.1-405b-instruct'] },
      { key: 'GROQ_API_KEY', name: 'Groq', models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] },
      { key: 'DEEPSEEK_API_KEY', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
      { key: 'OLLAMA_HOST', name: 'Ollama (Local)', models: ['llama3.1:70b', 'mixtral:8x7b'] },
    ],
  })
})

// ─── Sources ──────────────────────────────────────────────────────────
app.get('/sources', async (c) => {
  const sources = await prisma.source.findMany({
    orderBy: { priority: 'asc' },
    include: {
      _count: { select: { crawlRuns: true, versions: true, evidence: true } },
    },
  })
  return c.json({ sources })
})

app.get('/sources/:id', async (c) => {
  const { id } = c.req.param()
  const source = await prisma.source.findUnique({
    where: { id },
    include: {
      crawlRuns: { orderBy: { startedAt: 'desc' }, take: 20 },
      versions: { orderBy: { retrievedAt: 'desc' }, take: 10 },
      _count: { select: { crawlRuns: true, versions: true, evidence: true } },
    },
  })
  if (!source) return c.json({ error: 'Source not found' }, 404)
  return c.json({ source })
})

// ─── Crawl Runs ───────────────────────────────────────────────────────
app.get('/crawl-runs', async (c) => {
  const runs = await prisma.crawlRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    include: { source: true },
  })
  return c.json({ runs })
})

// ─── Changes ──────────────────────────────────────────────────────────
app.get('/changes', async (c) => {
  const changes = await prisma.change.findMany({
    orderBy: { classifiedAt: 'desc' },
    take: 100,
    include: {
      version: { include: { source: true } },
      _count: { select: { findings: true } },
    },
  })
  return c.json({ changes })
})

// ─── Findings ─────────────────────────────────────────────────────────
app.get('/findings', async (c) => {
  const findings = await prisma.finding.findMany({
    orderBy: { firstDetected: 'desc' },
    include: {
      automations: true,
      _count: { select: { evidence: true, changes: true } },
    },
  })
  return c.json({ findings })
})

app.get('/findings/:id', async (c) => {
  const { id } = c.req.param()
  const finding = await prisma.finding.findUnique({
    where: { id },
    include: {
      automations: { include: { opportunities: true } },
      evidence: { include: { source: true } },
      changes: { include: { version: true } },
    },
  })
  if (!finding) return c.json({ error: 'Finding not found' }, 404)
  return c.json({ finding })
})

// ─── Automations ──────────────────────────────────────────────────────
app.get('/automations', async (c) => {
  const automations = await prisma.automation.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      finding: true,
      _count: { select: { archNodes: true, archEdges: true, opportunities: true } },
    },
  })
  return c.json({ automations })
})

app.get('/automations/:id', async (c) => {
  const { id } = c.req.param()
  const automation = await prisma.automation.findUnique({
    where: { id },
    include: {
      finding: true,
      archNodes: true,
      archEdges: { include: { fromNode: true, toNode: true } },
      opportunities: { include: { scores: true } },
    },
  })
  if (!automation) return c.json({ error: 'Automation not found' }, 404)
  return c.json({ automation })
})

// ─── Architecture ─────────────────────────────────────────────────────
app.get('/architecture/:automationId', async (c) => {
  const { automationId } = c.req.param()
  const nodes = await prisma.architectureNode.findMany({
    where: { automationId },
  })
  const edges = await prisma.architectureEdge.findMany({
    where: { automationId },
    include: { fromNode: true, toNode: true },
  })
  return c.json({ nodes, edges })
})

// ─── Opportunities ────────────────────────────────────────────────────
app.get('/opportunities', async (c) => {
  const status = c.req.query('status')
  const minScore = c.req.query('minScore')
  const category = c.req.query('category')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (category) where.category = category
  if (minScore) where.totalScore = { gte: parseFloat(minScore) }

  const opportunities = await prisma.opportunity.findMany({
    where,
    orderBy: { totalScore: 'desc' },
    include: {
      automation: { include: { finding: true } },
      scores: true,
    },
  })
  return c.json({ opportunities })
})

app.get('/opportunities/:id', async (c) => {
  const { id } = c.req.param()
  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      automation: { include: { finding: true, archNodes: true, archEdges: true } },
      scores: true,
    },
  })
  if (!opportunity) return c.json({ error: 'Opportunity not found' }, 404)
  return c.json({ opportunity })
})

// ─── Reports ──────────────────────────────────────────────────────────
app.get('/reports', async (c) => {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { items: true } } },
  })
  return c.json({ reports })
})

app.get('/reports/:id', async (c) => {
  const { id } = c.req.param()
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      items: {
        include: { finding: { include: { automations: true, evidence: true } } },
        orderBy: { rank: 'asc' },
      },
    },
  })
  if (!report) return c.json({ error: 'Report not found' }, 404)
  return c.json({ report })
})

// ─── Reviews ──────────────────────────────────────────────────────────
app.get('/reviews', async (c) => {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return c.json({ reviews })
})

app.get('/reviews/pending', async (c) => {
  const pending = await prisma.review.findMany({
    where: { decision: 'pending' },
    orderBy: { createdAt: 'desc' },
  })
  return c.json({ reviews: pending })
})

// ─── Audit Log ────────────────────────────────────────────────────────
app.get('/audit', async (c) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 200,
  })
  return c.json({ logs })
})

// ─── Agent Runs ───────────────────────────────────────────────────────
app.get('/agents', async (c) => {
  const runs = await prisma.agentRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 100,
  })
  return c.json({ runs })
})

app.get('/agents/stats', async (c) => {
  const stats = await prisma.agentRun.groupBy({
    by: ['agentType', 'status'],
    _count: true,
    _sum: { inputTokens: true, outputTokens: true, cost: true },
  })
  return c.json({ stats })
})

// ─── Scoring ──────────────────────────────────────────────────────────
app.get('/scoring/weights', async (c) => {
  return c.json({
    weights: {
      businessValue: 0.20,
      automationPotential: 0.15,
      technicalFeasibility: 0.15,
      reusability: 0.15,
      demand: 0.10,
      differentiation: 0.10,
      cleanCoreRelevance: 0.10,
      complexityPenaltyMax: -0.15,
    },
  })
})

app.post('/scoring/calculate', async (c) => {
  const body = await c.req.json()
  const { businessValue, automationPotential, technicalFeasibility, reusability, demand, differentiation, cleanCoreRelevance, complexityPenalty } = body

  const totalScore = Math.round(
    (businessValue * 0.20 +
    automationPotential * 0.15 +
    technicalFeasibility * 0.15 +
    reusability * 0.15 +
    demand * 0.10 +
    differentiation * 0.10 +
    cleanCoreRelevance * 0.10 -
    (complexityPenalty || 0) * 0.15) * 10
  ) / 10

  return c.json({ totalScore, maxPossible: 100 })
})

// ─── Live Crawl ───────────────────────────────────────────────────────
app.post('/crawl', async (c) => {
  const body = await c.req.json()
  const { sourceId, url } = body

  const source = sourceId
    ? await prisma.source.findUnique({ where: { id: sourceId } })
    : url
      ? await prisma.source.findFirst({ where: { url } })
      : null

  if (!source) return c.json({ error: 'Source not found. Provide sourceId or url.' }, 404)

  const startTime = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SAIE-Crawler/1.0 (SAP Intelligence Platform)' },
    })
    clearTimeout(timeout)

    const html = await response.text()
    const duration = Math.round((Date.now() - startTime) / 1000)

    // Extract meaningful text content from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : source.name

    // Extract meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    const description = metaMatch ? metaMatch[1].trim() : ''

    // Extract headings for structure understanding
    const headings: string[] = []
    const headingRegex = /<h[1-4][^>]*>([^<]+)<\/h[1-4]>/gi
    let hm
    while ((hm = headingRegex.exec(html)) !== null && headings.length < 20) {
      headings.push(hm[1].trim())
    }

    // Extract paragraph text
    const paragraphs: string[] = []
    const pRegex = /<p[^>]*>([^<]+)<\/p>/gi
    let pm
    while ((pm = pRegex.exec(html)) !== null && paragraphs.length < 50) {
      const text = pm[1].trim()
      if (text.length > 30) paragraphs.push(text)
    }

    // Look for automation-relevant keywords
    const fullText = (title + ' ' + description + ' ' + paragraphs.join(' ')).toLowerCase()
    const automationKeywords = ['automat', 'ai ', 'artificial intelligence', 'machine learning', 'intelligent', 'agentic', 'workflow', 'integration', 'api', 'event-driven', 'btp', 'clean core', 'migration', 'robotic', 'rpa', 'process automation', 'joule', 'copilot', 'agent']
    const foundKeywords = automationKeywords.filter(kw => fullText.includes(kw))

    // Compute content hash
    const encoder = new TextEncoder()
    const data = encoder.encode(html)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const contentHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)

    // Create crawl run record
    const crawlRun = await prisma.crawlRun.create({
      data: {
        sourceId: source.id,
        status: 'completed',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        itemsFound: headings.length + paragraphs.length,
        itemsChanged: 0,
        errors: 0,
        duration,
      },
    })

    // Create source version
    const version = await prisma.sourceVersion.create({
      data: {
        sourceId: source.id,
        crawlRunId: crawlRun.id,
        contentHash,
        url: source.url,
        title,
        retrievedAt: new Date(),
        contentLength: html.length,
      },
    })

    // Check if content changed from previous version
    const previousVersion = await prisma.sourceVersion.findFirst({
      where: { sourceId: source.id, id: { not: version.id } },
      orderBy: { retrievedAt: 'desc' },
    })

    let changed = false
    if (previousVersion && previousVersion.contentHash !== contentHash) {
      changed = true
      // Create change record
      await prisma.change.create({
        data: {
          versionId: version.id,
          previousVersionId: previousVersion.id,
          type: foundKeywords.length > 3 ? 'new_capability' : 'enhancement',
          title: `Content update on ${source.name}`,
          summary: `Content changed on ${source.name}. Headings: ${headings.slice(0, 5).join(', ')}. Automation keywords found: ${foundKeywords.join(', ')}.`,
          confidence: foundKeywords.length > 3 ? 0.8 : 0.6,
          material: foundKeywords.length > 2,
        },
      })
    }

    // Update source last crawl
    await prisma.source.update({
      where: { id: source.id },
      data: { lastCrawl: new Date(), contentHash },
    })

    return c.json({
      ok: true,
      source: { id: source.id, name: source.name, url: source.url },
      crawl: {
        status: 'completed',
        duration: `${duration}s`,
        contentLength: `${(html.length / 1024).toFixed(1)} KB`,
        title,
        description: description.slice(0, 200),
        headings: headings.slice(0, 10),
        paragraphsFound: paragraphs.length,
        automationKeywords: foundKeywords,
        contentHash,
        changed,
        versionId: version.id,
        crawlRunId: crawlRun.id,
      },
    })
  } catch (err: any) {
    const duration = Math.round((Date.now() - startTime) / 1000)

    await prisma.crawlRun.create({
      data: {
        sourceId: source.id,
        status: 'failed',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        itemsFound: 0,
        itemsChanged: 0,
        errors: 1,
        duration,
      },
    })

    return c.json({
      ok: false,
      source: { id: source.id, name: source.name, url: source.url },
      error: err.message || 'Crawl failed',
      duration: `${duration}s`,
    })
  }
})

// ─── Bulk Crawl All Sources ───────────────────────────────────────────
app.post('/crawl-all', async (c) => {
  const sources = await prisma.source.findMany({ where: { active: true }, orderBy: { tier: 'asc' } })
  const results: any[] = []

  for (const source of sources.slice(0, 5)) { // Limit to 5 per batch to avoid timeout
    try {
      const res = await fetch('http://localhost:' + (process.env.PORT || 3001) + '/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id }),
      })
      const data = await res.json()
      results.push(data)
    } catch {
      results.push({ ok: false, source: { name: source.name }, error: 'Request failed' })
    }
  }

  return c.json({
    ok: true,
    crawled: results.length,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  })
})

// ─── Seed Demo Data ───────────────────────────────────────────────────
app.post('/seed', async (c) => {
  // Check if data already exists — skip if so
  const existingSources = await prisma.source.count()
  if (existingSources > 0) {
    return c.json({ seeded: true, note: 'Data already exists. Call with ?force=true to re-seed.', counts: { sources: existingSources } })
  }

  const now = new Date()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)

  try {
  // Clean existing data (safe order — children first)
  await prisma.auditLog.deleteMany()
  await prisma.agentRun.deleteMany()
  await prisma.review.deleteMany()
  await prisma.reportItem.deleteMany()
  await prisma.report.deleteMany()
  await prisma.score.deleteMany()
  await prisma.opportunity.deleteMany()
  await prisma.architectureEdge.deleteMany()
  await prisma.architectureNode.deleteMany()
  await prisma.automation.deleteMany()
  await prisma.evidence.deleteMany()
  await prisma.finding.deleteMany()
  await prisma.change.deleteMany()
  await prisma.sourceVersion.deleteMany()
  await prisma.crawlRun.deleteMany()
  await prisma.source.deleteMany()

  // ── REAL SAP Sources — Tiered by Authority ──
  // Tier 1: Official SAP Documentation (highest trust)
  const tier1Sources = [
    { url: 'https://help.sap.com/docs/all-products', name: 'SAP Product Documentation Hub', type: 'documentation', domain: 'official', category: 'master_catalog' },
    { url: 'https://help.sap.com/docs/SAP_S4HANA_CLOUD', name: 'S/4HANA Cloud Documentation', type: 'documentation', domain: 'official', category: 's4hana' },
    { url: 'https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE', name: 'S/4HANA On-Premise Documentation', type: 'documentation', domain: 'official', category: 's4hana' },
    { url: 'https://help.sap.com/docs/SAP_S4HANA_CLOUD/financial-management', name: 'S/4HANA Financial Management Docs', type: 'documentation', domain: 'official', category: 'fi_co' },
    { url: 'https://help.sap.com/docs/SAP_S4HANA_CLOUD/quality-management', name: 'S/4HANA Quality Management Docs', type: 'documentation', domain: 'official', category: 'qm' },
    { url: 'https://help.sap.com/docs/portfolio-category/PRODUCT_LIFECYCLE_MANAGEMENT', name: 'PLM Documentation', type: 'documentation', domain: 'official', category: 'plm' },
    { url: 'https://help.sap.com/docs/btp/sap-business-technology-platform/sap-business-technology-platform', name: 'SAP BTP Documentation', type: 'documentation', domain: 'official', category: 'btp' },
    { url: 'https://cap.cloud.sap/docs/', name: 'SAP Cloud Application Programming Model', type: 'documentation', domain: 'official', category: 'cap' },
    { url: 'https://api.sap.com/', name: 'SAP Business Accelerator Hub (APIs)', type: 'api_docs', domain: 'official', category: 'apis' },
    { url: 'https://www.sap.com/products.html', name: 'SAP Products Master Catalog', type: 'catalog', domain: 'official', category: 'master_catalog' },
    { url: 'https://www.sap.com/products/a-z.html', name: 'SAP Products A-Z', type: 'catalog', domain: 'official', category: 'master_catalog' },
  ]

  // Tier 2: Official SAP Product & Innovation Pages
  const tier2Sources = [
    { url: 'https://www.sap.com/products/erp/s4hana.html', name: 'S/4HANA Product Page', type: 'product', domain: 'official', category: 's4hana' },
    { url: 'https://www.sap.com/products/technology-platform.html', name: 'SAP BTP Product Page', type: 'product', domain: 'official', category: 'btp' },
    { url: 'https://www.sap.com/products/technology-platform/build.html', name: 'SAP Build Product Page', type: 'product', domain: 'official', category: 'build' },
    { url: 'https://www.sap.com/products/technology-platform/integration-suite.html', name: 'SAP Integration Suite', type: 'product', domain: 'official', category: 'integration' },
    { url: 'https://www.sap.com/products/technology-platform/process-automation.html', name: 'SAP Build Process Automation', type: 'product', domain: 'official', category: 'process_automation' },
    { url: 'https://www.sap.com/products/technology-platform/event-mesh.html', name: 'SAP Event Mesh', type: 'product', domain: 'official', category: 'event_mesh' },
    { url: 'https://www.sap.com/products/data-cloud/datasphere.html', name: 'SAP Datasphere', type: 'product', domain: 'official', category: 'datasphere' },
    { url: 'https://www.sap.com/products/technology-platform/hana.html', name: 'SAP HANA', type: 'product', domain: 'official', category: 'hana' },
    { url: 'https://www.sap.com/products/artificial-intelligence/ai-core.html', name: 'SAP AI Core', type: 'product', domain: 'official', category: 'ai' },
    { url: 'https://www.sap.com/products/ai-platform.html', name: 'SAP AI Platform', type: 'product', domain: 'official', category: 'ai' },
    { url: 'https://www.sap.com/products/technology-platform/cloud-alm.html', name: 'SAP Cloud ALM', type: 'product', domain: 'official', category: 'alm' },
    { url: 'https://www.sap.com/products/spend-management/ariba.html', name: 'SAP Ariba', type: 'product', domain: 'official', category: 'procurement' },
    { url: 'https://www.sap.com/products/hcm/successfactors.html', name: 'SAP SuccessFactors', type: 'product', domain: 'official', category: 'hcm' },
    { url: 'https://www.sap.com/products/customer-experience/sales-cloud.html', name: 'SAP Sales Cloud', type: 'product', domain: 'official', category: 'crm' },
    { url: 'https://www.sap.com/products/scm/manufacturing.html', name: 'SAP Manufacturing', type: 'product', domain: 'official', category: 'manufacturing' },
    { url: 'https://www.sap.com/products/scm/extended-warehouse-management.html', name: 'SAP EWM', type: 'product', domain: 'official', category: 'ewm' },
    { url: 'https://www.sap.com/products/data-cloud/master-data-governance.html', name: 'SAP MDG', type: 'product', domain: 'official', category: 'mdg' },
  ]

  // Tier 3: Official SAP News & Announcements
  const tier3Sources = [
    { url: 'https://news.sap.com/', name: 'SAP News Center', type: 'news', domain: 'official', category: 'news' },
    { url: 'https://news.sap.com/topics/innovation/', name: 'SAP Innovation News', type: 'news', domain: 'official', category: 'innovation' },
    { url: 'https://news.sap.com/topics/artificial-intelligence/', name: 'SAP AI News', type: 'news', domain: 'official', category: 'ai' },
    { url: 'https://news.sap.com/topics/cloud/', name: 'SAP Cloud News', type: 'news', domain: 'official', category: 'cloud' },
    { url: 'https://news.sap.com/topics/ecosystem/', name: 'SAP Ecosystem News', type: 'news', domain: 'official', category: 'ecosystem' },
    { url: 'https://www.sap.com/topics/events/sapphire/innovation-news-guide-2026', name: 'Sapphire 2026 Innovation Guide', type: 'event', domain: 'official', category: 'event' },
    { url: 'https://www.sap.com/topics/innovation-guide', name: 'SAP Innovation Guide', type: 'guide', domain: 'official', category: 'innovation' },
  ]

  // Tier 4: SAP Community & Blogs (user-generated, high relevance)
  const tier4Sources = [
    { url: 'https://community.sap.com/', name: 'SAP Community Home', type: 'community', domain: 'community', category: 'community' },
    { url: 'https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/bg-p/erp-blog-sap', name: 'SAP ERP Blog Posts', type: 'blog', domain: 'community', category: 'erp' },
    { url: 'https://pages.community.sap.com/topics/joule', name: 'Joule Community Hub', type: 'community', domain: 'community', category: 'joule' },
    { url: 'https://learning.sap.com/', name: 'SAP Learning', type: 'learning', domain: 'official', category: 'learning' },
  ]

  // Tier 5: Industry-specific SAP pages
  const tier5Sources = [
    { url: 'https://www.sap.com/industries/aerospace-defense.html', name: 'Aerospace & Defense', type: 'industry', domain: 'official', category: 'aerospace' },
    { url: 'https://www.sap.com/industries/automotive.html', name: 'Automotive', type: 'industry', domain: 'official', category: 'automotive' },
    { url: 'https://www.sap.com/industries/banking.html', name: 'Banking', type: 'industry', domain: 'official', category: 'banking' },
    { url: 'https://www.sap.com/industries/healthcare.html', name: 'Healthcare', type: 'industry', domain: 'official', category: 'healthcare' },
    { url: 'https://www.sap.com/industries/industrial-manufacturing.html', name: 'Industrial Manufacturing', type: 'industry', domain: 'official', category: 'manufacturing' },
    { url: 'https://www.sap.com/industries/retail.html', name: 'Retail', type: 'industry', domain: 'official', category: 'retail' },
    { url: 'https://www.sap.com/industries/utilities.html', name: 'Utilities', type: 'industry', domain: 'official', category: 'utilities' },
    { url: 'https://www.sap.com/industries/oil-gas-energy.html', name: 'Oil, Gas & Energy', type: 'industry', domain: 'official', category: 'energy' },
    { url: 'https://www.sap.com/industries/life-sciences.html', name: 'Life Sciences', type: 'industry', domain: 'official', category: 'life_sciences' },
    { url: 'https://www.sap.com/industries/telecommunications.html', name: 'Telecommunications', type: 'industry', domain: 'official', category: 'telecom' },
  ]

  // Tier 6: S/4HANA functional domains & migration
  const tier6Sources = [
    { url: 'https://www.sap.com/products/financial-management.html', name: 'Financial Management', type: 'functional', domain: 'official', category: 'fi_co' },
    { url: 'https://www.sap.com/products/scm.html', name: 'Supply Chain Management', type: 'functional', domain: 'official', category: 'scm' },
    { url: 'https://www.sap.com/products/spend-management.html', name: 'Spend Management', type: 'functional', domain: 'official', category: 'procurement' },
    { url: 'https://www.sap.com/products/hcm.html', name: 'Human Capital Management', type: 'functional', domain: 'official', category: 'hcm' },
    { url: 'https://www.sap.com/products/crm.html', name: 'CRM', type: 'functional', domain: 'official', category: 'crm' },
    { url: 'https://www.sap.com/products/scm/asset-management.html', name: 'Asset Management (EAM)', type: 'functional', domain: 'official', category: 'pm_eam' },
    { url: 'https://www.sap.com/products/scm/transportation-management.html', name: 'Transportation Management', type: 'functional', domain: 'official', category: 'tm' },
    { url: 'https://www.sap.com/products/financial-management/treasury-management.html', name: 'Treasury Management', type: 'functional', domain: 'official', category: 'treasury' },
    { url: 'https://www.sap.com/products/financial-management/financial-management-for-grc.html', name: 'GRC', type: 'functional', domain: 'official', category: 'grc' },
    { url: 'https://www.sap.com/products/technology-platform/abap.html', name: 'SAP ABAP Cloud', type: 'functional', domain: 'official', category: 'abap' },
    { url: 'https://www.sap.com/products/erp/technology-platform.html', name: 'S/4HANA Technology Platform', type: 'functional', domain: 'official', category: 'migration' },
  ]

  const allSourceData = [
    ...tier1Sources.map((s, i) => ({ ...s, priority: 1, tier: 1, active: true })),
    ...tier2Sources.map((s, i) => ({ ...s, priority: 2, tier: 2, active: true })),
    ...tier3Sources.map((s, i) => ({ ...s, priority: 2, tier: 3, active: true })),
    ...tier4Sources.map((s, i) => ({ ...s, priority: 3, tier: 4, active: true })),
    ...tier5Sources.map((s, i) => ({ ...s, priority: 4, tier: 5, active: true })),
    ...tier6Sources.map((s, i) => ({ ...s, priority: 3, tier: 6, active: true })),
  ]

  const sources = []
  for (const s of allSourceData) {
    const source = await prisma.source.create({
      data: {
        url: s.url,
        name: s.name,
        type: s.type,
        domain: s.domain,
        priority: s.priority,
        tier: s.tier,
        industry: s.category || null,
        lastCrawl: daysAgo(Math.floor(Math.random() * 3)),
        active: s.active,
        contentHash: Math.random().toString(36).slice(2, 14),
      },
    })
    sources.push(source)
  }

  // NOTE: Crawl runs, source versions, findings, automations, opportunities,
  // and reports are ALL created by the 24/7 agent crawler from real SAP websites.
  // The crawler starts 5 seconds after server startup.

  return c.json({
    seeded: true,
    counts: { sources: sources.length },
    note: '60 real SAP sources seeded. Agent crawler will populate all other data from real web content.',
  })
  } catch (err: any) {
    console.error('Seed error:', err.message)
    return c.json({ error: 'Seed failed: ' + err.message }, 500)
  }
})

// ─── Report Delivery ──────────────────────────────────────────────────
// Lazy-load delivery module (only works in Node.js/local server, not Bun edge)
let deliveryModule: any = null
async function getDelivery() {
  if (deliveryModule) return deliveryModule
  try {
    deliveryModule = await import('./report-delivery')
    return deliveryModule
  } catch {
    return null
  }
}

// Default config for when module isn't available (Bun runtime)
const defaultDeliveryConfig = {
  smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpUser: '', smtpPass: '',
  smtpFrom: '', smtpFromName: 'SAIE Intelligence Engine', emailRecipients: [],
  localExportPath: process.env.LOCAL_EXPORT_PATH || './reports', exportFormats: ['html', 'json', 'csv'],
  googleDriveEnabled: false, googleDriveClientId: '', googleDriveClientSecret: '',
  googleDriveRefreshToken: '', googleDriveFolderId: '', googleDriveSharedWith: [],
  scheduleDay: 'saturday', scheduleTime: '22:00', scheduleTimezone: 'Asia/Kolkata',
}
let inMemoryConfig: any = { ...defaultDeliveryConfig }

// Get delivery configuration
app.get('/delivery/config', async (c) => {
  const mod = await getDelivery()
  if (mod) {
    return c.json({ config: mod.getDeliveryConfig(), presets: Object.keys(mod.SMTP_PRESETS) })
  }
  return c.json({ config: inMemoryConfig, presets: ['gmail', 'brevo', 'mailgun', 'outlook', 'yahoo'] })
})

// Update delivery configuration
app.post('/delivery/config', async (c) => {
  const body = await c.req.json()
  const mod = await getDelivery()
  if (mod) {
    const updated = mod.updateDeliveryConfig(body)
    return c.json({ ok: true, config: updated })
  }
  inMemoryConfig = { ...inMemoryConfig, ...body }
  return c.json({ ok: true, config: inMemoryConfig, note: 'Config saved in memory. For persistence, run with Node.js server.' })
})

// Test SMTP connection — accepts config in body, falls back to direct nodemailer test if module unavailable
app.post('/delivery/test-email', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const mod = await getDelivery()
  if (mod) {
    if (body && Object.keys(body).length > 0) mod.updateDeliveryConfig(body)
    const result = await mod.testSMTPConnection()
    return c.json(result)
  }
  // Fallback: test SMTP directly using nodemailer
  if (!body.smtpUser || !body.smtpPass) {
    return c.json({ ok: false, error: 'SMTP credentials not configured. Fill in email and password.' })
  }
  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      host: body.smtpHost || 'smtp.gmail.com',
      port: body.smtpPort || 587,
      secure: (body.smtpPort || 587) === 465,
      auth: { user: body.smtpUser, pass: body.smtpPass },
    })
    await transporter.verify()
    return c.json({ ok: true })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message || 'SMTP connection failed' })
  }
})

// Send test email
app.post('/delivery/send-test', async (c) => {
  const mod = await getDelivery()
  if (!mod) return c.json({ ok: false, error: 'Email delivery requires local Node.js server' })
  const body = await c.req.json()
  const { email } = body
  if (!email) return c.json({ ok: false, error: 'Provide email address' }, 400)
  const config = mod.getDeliveryConfig()
  mod.updateDeliveryConfig({ emailRecipients: [email] })
  const result = await mod.deliverSaturdayReport()
  mod.updateDeliveryConfig({ emailRecipients: config.emailRecipients })
  return c.json(result)
})

// Generate and deliver report through all channels
app.post('/delivery/send/:reportId?', async (c) => {
  const mod = await getDelivery()
  if (!mod) return c.json({ ok: false, error: 'Report delivery requires local Node.js server' })
  const { reportId } = c.req.param()
  const result = await mod.deliverSaturdayReport(reportId || undefined)
  return c.json(result)
})

// Get SMTP presets information
app.get('/delivery/presets', async (c) => {
  const mod = await getDelivery()
  if (!mod) return c.json({ presets: {} })
  return c.json({ presets: mod.SMTP_PRESETS })
})

// Test Google Drive connection — accepts config in body, falls back to direct test if module unavailable
app.post('/delivery/test-drive', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const mod = await getDelivery()
  if (mod) {
    if (body && Object.keys(body).length > 0) mod.updateDeliveryConfig(body)
    const result = await mod.testGoogleDriveConnection()
    return c.json(result)
  }
  // Fallback: test Google Drive directly
  if (!body.googleDriveEnabled) {
    return c.json({ ok: false, error: 'Google Drive not enabled. Enable it in the form first.' })
  }
  if (!body.googleDriveClientId || !body.googleDriveClientSecret || !body.googleDriveRefreshToken) {
    return c.json({ ok: false, error: 'Google Drive OAuth2 credentials not configured.' })
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: body.googleDriveClientId,
        client_secret: body.googleDriveClientSecret,
        refresh_token: body.googleDriveRefreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!tokenRes.ok) return c.json({ ok: false, error: 'Google Drive authentication failed. Check credentials.' })
    const tokenData = await tokenRes.json()
    const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    })
    if (!aboutRes.ok) return c.json({ ok: false, error: 'Google Drive API access failed.' })
    const about = await aboutRes.json()
    return c.json({ ok: true, user: about.user?.displayName, email: about.user?.emailAddress })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message || 'Google Drive test failed' })
  }
})

// ─── Download Project Package ────────────────────────────────────────
app.get('/download/project', async (c) => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const candidates = [
    path.join(process.cwd(), 'SAIE_Windows.zip'),
    path.join(process.cwd(), 'SAIE_Complete.tar.gz'),
    path.join(process.cwd(), 'SAIE_Windows.tar.gz'),
  ]
  const filePath = candidates.find(f => fs.existsSync(f))
  if (!filePath) {
    return c.json({ error: 'Package not found.' }, 404)
  }
  const fileBuffer = fs.readFileSync(filePath)
  const ext = filePath.endsWith('.zip') ? 'zip' : 'tar.gz'
  return new Response(fileBuffer, {
    headers: {
      'Content-Type': ext === 'zip' ? 'application/zip' : 'application/gzip',
      'Content-Disposition': `attachment; filename="SAIE_Windows.${ext}"`,
      'Content-Length': String(fileBuffer.length),
    },
  })
})

// ─── Scheduler API ──────────────────────────────────────────────────
app.get('/scheduler/status', async (c) => {
  try {
    const { schedulerRunning, schedulerLogs, lastReportGenerated } = await import('./agent-scheduler')
    const agentRuns = await prisma.agentRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    })
    const totalRuns = await prisma.agentRun.count()
    const completedRuns = await prisma.agentRun.count({ where: { status: 'completed' } })
    const failedRuns = await prisma.agentRun.count({ where: { status: 'failed' } })

    return c.json({
      running: schedulerRunning,
      lastReportGenerated,
      stats: { totalRuns, completedRuns, failedRuns },
      recentRuns: agentRuns,
      logs: schedulerLogs.slice(-30),
    })
  } catch {
    return c.json({ running: false, error: 'Scheduler module not found' })
  }
})

app.post('/scheduler/start', async (c) => {
  try {
    const { startScheduler } = await import('./agent-scheduler')
    startScheduler()
    return c.json({ ok: true, message: 'Scheduler started' })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

app.post('/scheduler/stop', async (c) => {
  try {
    const { stopScheduler } = await import('./agent-scheduler')
    stopScheduler()
    return c.json({ ok: true, message: 'Scheduler stopped' })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

app.post('/scheduler/run-pipeline', async (c) => {
  try {
    const { runFullPipeline } = await import('./agent-scheduler')
    const result = await runFullPipeline()
    return c.json({ ok: true, ...result })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

app.post('/scheduler/run-report', async (c) => {
  try {
    const { agentReportGenerator } = await import('./agent-scheduler')
    const result = await agentReportGenerator()
    return c.json({ ok: true, ...result })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

// ─── Data Retention & Archives ────────────────────────────────────────
app.get('/retention/status', async (c) => {
  const { RETENTION, listArchives } = await import('./data-retention')
  const archives = listArchives()

  const tables = ['crawl_runs', 'source_versions', 'changes', 'findings', 'evidence', 'automations', 'opportunities', 'scores', 'agent_runs', 'reports', 'report_items', 'reviews', 'audit_log']
  const counts: Record<string, number> = {}
  let total = 0
  for (const t of tables) {
    try {
      const r = await prisma.$queryRaw<any[]>(`SELECT COUNT(*) as c FROM "${t}"`)
      counts[t] = Number(r[0].c)
      total += counts[t]
    } catch { counts[t] = 0 }
  }

  return c.json({
    retention: RETENTION,
    currentRecords: counts,
    totalRecords: total,
    archives: archives.map(a => ({
      period: `${a.year}/${a.month}`,
      files: a.files,
      sizeKB: Math.round(a.size / 1024),
      summary: a.summary,
    })),
  })
})

app.post('/retention/run', async (c) => {
  try {
    const { runRetentionPipeline } = await import('./data-retention')
    const result = await runRetentionPipeline()
    return c.json({ ok: true, ...result })
  } catch (err: any) {
    return c.json({ ok: false, error: err.message }, 500)
  }
})

app.get('/retention/archive/:period/:table', async (c) => {
  const { period, table } = c.req.param()
  const { readArchive } = await import('./data-retention')
  const records = readArchive(period, table)
  return c.json({ period, table, count: records.length, records })
})

export default app

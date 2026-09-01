// ─── Data Lifecycle Management ────────────────────────────────────────
// Manages data retention, archival, and database optimization.
//
// Strategy:
//   Tier 1 (0-30 days):   Full detail — all records indexed and queryable
//   Tier 2 (30-90 days):  Compressed — keep summaries, delete raw details
//   Tier 3 (90-365 days): Aggregated — monthly stats only, delete daily data
//   Tier 4 (365+ days):   Purged — delete entirely
//
// Archive Format: JSON files saved to {project}/archives/
//   archives/2026/03/crawl_runs.json.gz  — monthly compressed archives
//   archives/2026/03/findings.json.gz     — monthly compressed archives
//   archives/2026/03/summary.json         — monthly human-readable summary
//
// Schedule: Runs daily at 3:00 AM IST via scheduler
// ─────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { gzipSync, gunzipSync } from 'zlib'

const prisma = new PrismaClient({ datasources: { db: { url: 'file:./prisma/dev.db' } } })

// ─── Configuration ────────────────────────────────────────────────────
const RETENTION = {
  hotDays: 30,       // Full detail kept for 30 days
  warmDays: 90,      // Summaries kept for 90 days
  coldDays: 365,     // Aggregates kept for 1 year
  archiveDir: join(process.cwd(), 'archives'),
  logTag: 'retention',
}

// ─── Utility: Date Helpers ────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ─── Archive Writer ───────────────────────────────────────────────────
function ensureArchiveDir(month: string): string {
  const dir = join(RETENTION.archiveDir, month)
  mkdirSync(dir, { recursive: true })
  return dir
}

function archiveRecords(table: string, records: any[], month: string): string {
  const dir = ensureArchiveDir(month)
  const filePath = join(dir, `${table}.json.gz`)
  const json = JSON.stringify(records, null, 0)
  const compressed = gzipSync(Buffer.from(json))
  writeFileSync(filePath, compressed)
  return filePath
}

function writeMonthlySummary(month: string, summary: Record<string, any>) {
  const dir = ensureArchiveDir(month)
  const filePath = join(dir, 'summary.json')
  writeFileSync(filePath, JSON.stringify(summary, null, 2))
}

// ─── Tier 1→2: Compress old data (30-90 days) ────────────────────────
// Keep: finding title, domain, confidence, evidence level, composite score
// Remove: raw paragraphs, full descriptions, detailed crawl output
async function compressOldRecords(): Promise<number> {
  const cutoff = daysAgo(RETENTION.hotDays)
  const cutoffDate = daysAgo(RETENTION.warmDays)
  let compressed = 0

  // Compress old crawl runs — keep only summary fields
  const oldCrawls = await prisma.crawlRun.findMany({
    where: { startedAt: { lt: cutoff } },
    select: {
      id: true, sourceId: true, status: true, startedAt: true,
      itemsFound: true, itemsChanged: true, errors: true, duration: true,
    },
  })

  if (oldCrawls.length > 0) {
    const month = monthKey(cutoff)
    archiveRecords('crawl_runs', oldCrawls, month)
    compressed += oldCrawls.length
  }

  // Compress old source versions — keep only hash + metadata
  const oldVersions = await prisma.sourceVersion.findMany({
    where: { retrievedAt: { lt: cutoff } },
    select: {
      id: true, sourceId: true, contentHash: true, title: true,
      retrievedAt: true, contentLength: true,
    },
  })

  if (oldVersions.length > 0) {
    const month = monthKey(cutoff)
    archiveRecords('source_versions', oldVersions, month)
    compressed += oldVersions.length
  }

  // Compress old findings — keep title, domain, confidence, evidence level
  const oldFindings = await prisma.finding.findMany({
    where: { createdAt: { lt: cutoff } },
    select: {
      id: true, title: true, domain: true, confidence: true,
      evidenceLevel: true, status: true, industry: true, createdAt: true,
    },
  })

  if (oldFindings.length > 0) {
    const month = monthKey(cutoff)
    archiveRecords('findings', oldFindings, month)
    compressed += oldFindings.length
  }

  // Compress old evidence — keep only key fields
  const oldEvidence = await prisma.evidence.findMany({
    where: { retrievedAt: { lt: cutoff } },
    select: {
      id: true, findingId: true, sourceId: true, confidence: true,
      authority: true, confirmed: true, retrievedAt: true,
    },
  })

  if (oldEvidence.length > 0) {
    const month = monthKey(cutoff)
    archiveRecords('evidence', oldEvidence, month)
    compressed += oldEvidence.length
  }

  return compressed
}

// ─── Tier 2→3: Aggregate monthly data (90-365 days) ──────────────────
// Keep: Monthly aggregated stats (count, avg confidence, top domains)
// Remove: Individual records
async function aggregateAndDelete(): Promise<number> {
  const cutoff = daysAgo(RETENTION.warmDays)
  const cutoffYear = daysAgo(RETENTION.coldDays)
  let deleted = 0

  // Generate monthly summaries for each month in the warm→cold window
  const months = new Set<string>()
  const d = new Date(cutoffYear)
  while (d <= cutoff) {
    months.add(monthKey(d))
    d.setMonth(d.getMonth() + 1)
  }

  for (const month of months) {
    const [year, mon] = month.split('/').map(Number)
    const monthStart = new Date(year, mon - 1, 1)
    const monthEnd = new Date(year, mon, 0, 23, 59, 59)

    // Findings summary for this month
    const findingStats = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) as total_findings,
        AVG(confidence) as avg_confidence,
        COUNT(CASE WHEN evidenceLevel = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN evidenceLevel = 'corroborated' THEN 1 END) as corroborated,
        COUNT(CASE WHEN evidenceLevel = 'inferred' THEN 1 END) as inferred
      FROM findings
      WHERE createdAt >= ${monthStart} AND createdAt <= ${monthEnd}
    `

    // Crawl summary
    const crawlStats = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) as total_crawls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(duration) as avg_duration,
        SUM(itemsFound) as total_items,
        SUM(itemsChanged) as total_changes
      FROM crawl_runs
      WHERE startedAt >= ${monthStart} AND startedAt <= ${monthEnd}
    `

    // Automations summary
    const automationStats = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as total_automations FROM automations
      WHERE createdAt >= ${monthStart} AND createdAt <= ${monthEnd}
    `

    // Opportunities summary
    const opportunityStats = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) as total_opportunities,
        AVG(totalScore) as avg_score,
        MAX(totalScore) as max_score,
        MIN(totalScore) as min_score
      FROM opportunities
      WHERE createdAt >= ${monthStart} AND createdAt <= ${monthEnd}
    `

    // Top domains this month
    const topDomains = await prisma.$queryRaw<any[]>`
      SELECT domain, COUNT(*) as count
      FROM findings
      WHERE createdAt >= ${monthStart} AND createdAt <= ${monthEnd} AND domain IS NOT NULL
      GROUP BY domain ORDER BY count DESC LIMIT 10
    `

    const summary = {
      month: month,
      period: `${formatDate(monthStart)} to ${formatDate(monthEnd)}`,
      generatedAt: new Date().toISOString(),
      findings: findingStats[0] || { total_findings: 0 },
      crawls: crawlStats[0] || { total_crawls: 0 },
      automations: automationStats[0] || { total_automations: 0 },
      opportunities: opportunityStats[0] || { total_opportunities: 0 },
      topDomains: topDomains || [],
    }

    // Write monthly summary
    writeMonthlySummary(month, summary)

    // Now delete individual records older than warm period for this month
    const oldCrawls = await prisma.crawlRun.findMany({
      where: { startedAt: { gte: monthStart, lt: monthEnd } },
      select: { id: true },
    })
    if (oldCrawls.length > 0) {
      await prisma.crawlRun.deleteMany({ where: { startedAt: { gte: monthStart, lt: monthEnd } } })
      deleted += oldCrawls.length
    }

    // Delete old source versions
    await prisma.sourceVersion.deleteMany({ where: { retrievedAt: { gte: monthStart, lt: monthEnd } } })

    // Delete old changes
    await prisma.change.deleteMany({ where: { createdAt: { gte: monthStart, lt: monthEnd } } })

    // Delete old evidence (keep findings but remove raw evidence)
    await prisma.evidence.deleteMany({ where: { retrievedAt: { gte: monthStart, lt: monthEnd } } })

    // Delete old scores
    await prisma.score.deleteMany({ where: { createdAt: { gte: monthStart, lt: monthEnd } } })
  }

  return deleted
}

// ─── Tier 4: Purge data older than 1 year ────────────────────────────
async function purgeOldData(): Promise<number> {
  const cutoff = daysAgo(RETENTION.coldDays)
  let purged = 0

  // Delete old crawl runs
  const oldCrawls = await prisma.crawlRun.deleteMany({ where: { startedAt: { lt: cutoff } } })
  purged += oldCrawls.count

  // Delete old source versions
  const oldVersions = await prisma.sourceVersion.deleteMany({ where: { retrievedAt: { lt: cutoff } } })
  purged += oldVersions.count

  // Delete old changes
  const oldChanges = await prisma.change.deleteMany({ where: { createdAt: { lt: cutoff } } })
  purged += oldChanges.count

  // Delete old findings (but NOT confirmed ones — they have long-term value)
  const oldFindings = await prisma.finding.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      evidenceLevel: { not: 'confirmed' },
    },
  })
  purged += oldFindings.count

  // Delete old automations
  const oldAutos = await prisma.automation.deleteMany({ where: { createdAt: { lt: cutoff } } })
  purged += oldAutos.count

  // Delete old opportunities
  const oldOpps = await prisma.opportunity.deleteMany({ where: { createdAt: { lt: cutoff } } })
  purged += oldOpps.count

  // Delete old agent runs
  const oldRuns = await prisma.agentRun.deleteMany({ where: { startedAt: { lt: cutoff } } })
  purged += oldRuns.count

  // Delete old audit logs
  const oldAudit = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
  purged += oldAudit.count

  return purged
}

// ─── Database Optimization ────────────────────────────────────────────
async function optimizeDatabase(): Promise<void> {
  // SQLite WAL mode — better concurrent read performance
  await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL')

  // Reclaim unused space
  await prisma.$executeRawUnsafe('VACUUM')

  // Rebuild indices for faster queries
  await prisma.$executeRawUnsafe('REINDEX')
}

// ─── Archive Viewer ───────────────────────────────────────────────────
function listArchives(): any[] {
  if (!existsSync(RETENTION.archiveDir)) return []

  const archives: any[] = []
  const years = readdirSync(RETENTION.archiveDir).filter(f => /^\d{4}$/.test(f))

  for (const year of years) {
    const months = readdirSync(join(RETENTION.archiveDir, year)).filter(f => /^\d{2}$/.test(f))
    for (const month of months) {
      const monthDir = join(RETENTION.archiveDir, year, month)
      const files = readdirSync(monthDir)
      const summaryPath = join(monthDir, 'summary.json')
      let summary: any = null
      if (existsSync(summaryPath)) {
        summary = JSON.parse(readFileSync(summaryPath, 'utf-8'))
      }
      archives.push({
        year, month,
        files: files.length,
        size: files.reduce((sum, f) => sum + statSync(join(monthDir, f)).size, 0),
        summary,
      })
    }
  }

  return archives.sort((a, b) => `${b.year}/${b.month}`.localeCompare(`${a.year}/${a.month}`))
}

function readArchive(month: string, table: string): any[] {
  const filePath = join(RETENTION.archiveDir, month, `${table}.json.gz`)
  if (!existsSync(filePath)) return []
  const compressed = readFileSync(filePath)
  const json = gunzipSync(compressed).toString()
  return JSON.parse(json)
}

// ─── Main: Run Full Retention Pipeline ────────────────────────────────
async function runRetentionPipeline(): Promise<any> {
  const startTime = Date.now()
  const log: string[] = []

  log.push(`[${new Date().toISOString()}] Data retention pipeline started`)

  // Step 1: Compress old records (30+ days)
  const compressed = await compressOldRecords()
  log.push(`Step 1: Compressed ${compressed} records (30-90 day window)`)

  // Step 2: Aggregate and delete warm data (90-365 days)
  const aggregated = await aggregateAndDelete()
  log.push(`Step 2: Aggregated and deleted ${aggregated} records (90-365 day window)`)

  // Step 3: Purge data older than 1 year
  const purged = await purgeOldData()
  log.push(`Step 3: Purged ${purged} records (365+ day window)`)

  // Step 4: Optimize database
  await optimizeDatabase()
  log.push('Step 4: Database optimized (WAL + VACUUM + REINDEX)')

  // Get current stats
  const tables = ['crawl_runs', 'source_versions', 'changes', 'findings', 'evidence', 'automations', 'opportunities', 'scores', 'agent_runs', 'reports', 'report_items', 'reviews', 'audit_log']
  const currentCounts: Record<string, number> = {}
  for (const t of tables) {
    try {
      const r = await prisma.$queryRaw<any[]>(`SELECT COUNT(*) as c FROM "${t}"`)
      currentCounts[t] = Number(r[0].c)
    } catch { currentCounts[t] = 0 }
  }

  const totalRecords = Object.values(currentCounts).reduce((a, b) => a + b, 0)
  const archives = listArchives()

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  log.push(`Pipeline completed in ${duration}s`)
  log.push(`Current database: ${totalRecords} active records`)
  log.push(`Archive months: ${archives.length}`)

  return {
    success: true,
    duration: `${duration}s`,
    compressed,
    aggregated,
    purged,
    currentCounts,
    totalRecords,
    archiveCount: archives.length,
    log,
  }
}

// ─── Export ───────────────────────────────────────────────────────────
export {
  runRetentionPipeline,
  listArchives,
  readArchive,
  RETENTION,
}

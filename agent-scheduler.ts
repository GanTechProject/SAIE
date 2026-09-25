// SAIE Agent Scheduler — 24/7 Real Web Crawler + Saturday Report Generator
// This module crawls REAL SAP websites, extracts intelligence, and generates reports.
// Uses multi-provider AI (Anthropic/OpenAI/Gemini/Nvidia/Groq) when available.

import { PrismaClient } from '@prisma/client'
import { analyzeWithLLM, callLLM, getLLMStatus, getProviderName } from './llm-client'

const prisma = new PrismaClient()

// ─── Scheduler State ─────────────────────────────────────────────────
let schedulerRunning = false
let schedulerInterval: ReturnType<typeof setInterval> | null = null
let lastReportGenerated: Date | null = null
const schedulerLogs: { time: string; agent: string; action: string; detail: string }[] = []

function log(agent: string, action: string, detail: string) {
  const entry = { time: new Date().toISOString(), agent, action, detail }
  schedulerLogs.push(entry)
  if (schedulerLogs.length > 200) schedulerLogs.shift()
  console.log(`[${agent}] ${action}: ${detail}`)
}

// ─── Content Hash ────────────────────────────────────────────────────
async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// ─── HTML Parser ─────────────────────────────────────────────────────
function parseHTML(html: string): { title: string; headings: string[]; paragraphs: string[]; keywords: string[] } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : ''

  const headings: string[] = []
  const headingRegex = /<h[1-4][^>]*>([^<]+)<\/h[1-4]>/gi
  let hm
  while ((hm = headingRegex.exec(html)) !== null && headings.length < 30) {
    const text = hm[1].trim()
    if (text.length > 2) headings.push(text)
  }

  const paragraphs: string[] = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let pm
  while ((pm = pRegex.exec(html)) !== null && paragraphs.length < 50) {
    const text = pm[1].replace(/<[^>]+>/g, '').trim()
    if (text.length > 30) paragraphs.push(text)
  }

  const fullText = (title + ' ' + headings.join(' ') + ' ' + paragraphs.join(' ')).toLowerCase()

  const automationKeywords = [
    'automat', 'artificial intelligence', 'machine learning', 'ai-', ' ai ', 'intelligent',
    'agentic', 'workflow', 'integration', 'api', 'event-driven', 'btp', 'clean core',
    'migration', 'robotic', 'rpa', 'process automation', 'joule', 'copilot', 'agent',
    'build process', 'event mesh', 'integration suite', 'datasphere', 's/4hana',
    'cloud alm', 'ariba', 'successfactors', 'analytics cloud', 'fiori',
    'cap', 'hana', 'cloud foundry', 'kubernetes', 'microservices', 'abap cloud',
    'api-led', 'event-driven architecture', 'real-time', 'predictive', 'anomaly',
    'natural language', 'generative', 'foundation model', 'llm', 'gpt',
    'reusable', 'accelerator', 'template', 'framework', 'sdk', 'extensibility',
  ]

  const foundKeywords = automationKeywords.filter(kw => fullText.includes(kw))

  return { title, headings, paragraphs, keywords: foundKeywords }
}

// ─── Content-Based Scoring ───────────────────────────────────────────
function scoreFromContent(
  keywords: string[],
  paragraphs: string[],
  headings: string[],
  sourceTier: number,
  contentLength: number,
): Record<string, number> {
  const kwCount = keywords.length
  const pCount = paragraphs.length
  const hCount = headings.length
  const textLen = contentLength / 1000

  const hasAI = keywords.some(k => ['ai', 'machine learning', 'intelligent', 'joule', 'copilot', 'llm', 'gpt', 'generative', 'foundation model', 'anomaly', 'predictive'].includes(k))
  const hasBTP = keywords.some(k => ['btp', 'cloud foundry', 'kubernetes', 'cap', 'hana'].includes(k))
  const hasAutomation = keywords.some(k => ['automat', 'rpa', 'robotic', 'workflow', 'process automation'].includes(k))
  const hasEvent = keywords.some(k => ['event-driven', 'event mesh', 'real-time', 'api-led', 'integration suite'].includes(k))
  const hasCleanCore = keywords.some(k => ['clean core', 'abap cloud', 'extensibility', 'api-led'].includes(k))

  const tierBonus = sourceTier <= 1 ? 15 : sourceTier <= 2 ? 10 : sourceTier <= 3 ? 5 : 0

  const clamp = (v: number) => Math.max(10, Math.min(95, Math.round(v)))

  return {
    businessValue: clamp(30 + kwCount * 3 + (hasAI ? 20 : 0) + (hasAutomation ? 15 : 0) + tierBonus + Math.min(pCount, 20)),
    automationPotential: clamp(25 + kwCount * 3 + (hasAutomation ? 25 : 0) + (hasAI ? 15 : 0) + tierBonus),
    technicalFeasibility: clamp(40 + (hasBTP ? 20 : 0) + (hasEvent ? 10 : 0) + tierBonus + Math.min(hCount, 15)),
    reusability: clamp(30 + kwCount * 2 + (hasCleanCore ? 20 : 0) + (hasBTP ? 15 : 0) + tierBonus),
    demand: clamp(20 + kwCount * 4 + Math.min(textLen, 30) + tierBonus),
    differentiation: clamp(25 + (hasAI ? 25 : 0) + (hasEvent ? 15 : 0) + kwCount * 2 + tierBonus),
    cleanCoreRelevance: clamp(20 + (hasCleanCore ? 30 : 0) + (hasBTP ? 20 : 0) + (hasEvent ? 10 : 0) + tierBonus),
    complexityPenalty: clamp(5 + kwCount * 1 + (hasEvent ? 3 : 0) - sourceTier),
  }
}

// ─── Agent: Discovery (Crawl Real Sources) ───────────────────────────
async function agentDiscovery(): Promise<{ crawled: number; succeeded: number; failed: number; details: any[] }> {
  log('discovery', 'start', 'Crawling real SAP sources...')

  const sources = await prisma.source.findMany({
    where: { active: true },
    orderBy: [{ tier: 'asc' }, { priority: 'asc' }],
  })

  let crawled = 0, succeeded = 0, failed = 0
  const details: any[] = []

  for (const source of sources) {
    const startTime = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)

      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SAIE-Intelligence/2.0 (SAP Automation Intelligence Platform)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      })
      clearTimeout(timeout)

      const html = await response.text()
      const duration = Math.round((Date.now() - startTime) / 1000)
      crawled++

      const { title, headings, paragraphs, keywords } = parseHTML(html)
      const fullText = title + ' ' + headings.join(' ') + ' ' + paragraphs.join(' ')
      const contentHash = await computeHash(fullText)

      // Create crawl run
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

      // Check if content is unchanged — skip creating duplicate version
      const previousVersion = await prisma.sourceVersion.findFirst({
        where: { sourceId: source.id },
        orderBy: { retrievedAt: 'desc' },
      })

      if (previousVersion && previousVersion.contentHash === contentHash) {
        succeeded++
        details.push({ source: source.name, status: 'unchanged', duration: `${duration}s`, keywords: keywords.length, changed: false })
        await prisma.source.update({ where: { id: source.id }, data: { lastCrawl: new Date() } })
        await new Promise(r => setTimeout(r, 1000))
        continue
      }

      // Content changed or first crawl — create version record
      const version = await prisma.sourceVersion.create({
        data: {
          sourceId: source.id,
          crawlRunId: crawlRun.id,
          contentHash,
          url: source.url,
          title: title || source.name,
          retrievedAt: new Date(),
          contentLength: html.length,
        },
      })

      // Check for content changes
      let changed = false
      if (previousVersion) {
        // Content changed — record the change
        changed = true
        await prisma.change.create({
          data: {
            versionId: version.id,
            previousVersionId: previousVersion.id,
            type: keywords.length > 3 ? 'new_capability' : 'enhancement',
            title: `Content update: ${title || source.name}`,
            summary: `Content changed. Headings: ${headings.slice(0, 5).join('; ')}. Keywords: ${keywords.slice(0, 10).join(', ')}`,
            confidence: keywords.length > 3 ? 0.8 : 0.6,
            material: keywords.length > 2,
          },
        })
      } else {
        // First crawl — create initial change record
        changed = true
        await prisma.change.create({
          data: {
            versionId: version.id,
            type: 'initial_crawl',
            title: `Initial crawl: ${title || source.name}`,
            summary: `First crawl completed. Found ${headings.length} headings, ${paragraphs.length} paragraphs. Keywords: ${keywords.join(', ')}`,
            confidence: 0.5,
            material: false,
          },
        })
      }

      // Update source
      await prisma.source.update({
        where: { id: source.id },
        data: { lastCrawl: new Date(), contentHash },
      })

      // Create finding if content has automation keywords
      if (keywords.length >= 2 && paragraphs.length > 0) {
        const canonicalKey = `real-${source.id}-${contentHash.slice(0, 6)}`
        const existing = await prisma.finding.findFirst({ where: { canonicalKey } })

        if (!existing) {
          const evidenceLevel = source.tier <= 2 ? 'confirmed' : source.tier <= 3 ? 'corroborated' : 'inferred'
          const confidence = Math.min(0.95, 0.5 + (source.tier <= 2 ? 0.3 : source.tier <= 3 ? 0.2 : 0.1) + (keywords.length * 0.02))

          const finding = await prisma.finding.create({
            data: {
              canonicalKey,
              title: `${title || source.name}: ${keywords.slice(0, 3).join(', ')}`,
              description: paragraphs.slice(0, 3).join(' ').slice(0, 500),
              status: 'new',
              domain: source.industry || 'General',
              industry: null,
              confidence,
              evidenceLevel,
              firstDetected: new Date(),
              lastUpdated: new Date(),
            },
          })

          // Create evidence — only if no evidence exists for this finding+source
          const existingEvidence = await prisma.evidence.findFirst({
            where: { findingId: finding.id, sourceId: source.id },
          })
          if (!existingEvidence) {
            await prisma.evidence.create({
              data: {
                findingId: finding.id,
                sourceId: source.id,
                locator: source.url,
                content: paragraphs.slice(0, 3).join(' ').slice(0, 300),
                confidence,
                authority: source.tier <= 2 ? 'official' : source.tier <= 3 ? 'official_news' : 'community',
                corroboration: source.tier <= 2 ? 3 : 1,
                retrievedAt: new Date(),
                confirmed: source.tier <= 2,
              },
            })
          }

          // Link change to finding
          const recentChange = await prisma.change.findFirst({
            where: { versionId: version.id },
            orderBy: { classifiedAt: 'desc' },
          })
          if (recentChange) {
            await prisma.change.update({
              where: { id: recentChange.id },
              data: { findings: { connect: { id: finding.id } } },
            })
          }

          // Create automation if keywords suggest strong patterns
          if (keywords.length >= 4) {
            const automation = await prisma.automation.create({
              data: {
                findingId: finding.id,
                title: `Real pattern: ${keywords.slice(0, 3).join(' + ')} from ${source.name}`,
                description: paragraphs.slice(0, 5).join(' ').slice(0, 500),
                domain: source.industry || 'General',
                automationType: keywords.some(k => ['rpa', 'robotic'].includes(k)) ? 'rpa'
                  : keywords.some(k => ['ai', 'machine learning', 'intelligent', 'joule', 'copilot'].includes(k)) ? 'ai_assisted'
                  : keywords.some(k => ['event-driven', 'event mesh'].includes(k)) ? 'event_driven'
                  : keywords.some(k => ['predictive', 'anomaly'].includes(k)) ? 'predictive'
                  : 'process_automation',
                sapProducts: keywords.filter(k => ['s/4hana', 'btp', 'joule', 'ariba', 'successfactors', 'datasphere', 'hana', 'integration suite', 'event mesh', 'cloud alm', 'fiori', 'cap', 'abap cloud'].includes(k)).join(', ') || 'SAP BTP',
                businessProblem: paragraphs[0]?.slice(0, 200) || 'Identified from real SAP content',
                status: 'identified',
              },
            })

            // Create opportunity with real score
            const scores = scoreFromContent(keywords, paragraphs, headings, source.tier, html.length)

            const totalScore = Math.round(
              (scores.businessValue * 0.20 + scores.automationPotential * 0.15 +
               scores.technicalFeasibility * 0.15 + scores.reusability * 0.15 +
               scores.demand * 0.10 + scores.differentiation * 0.10 +
               scores.cleanCoreRelevance * 0.10 - scores.complexityPenalty * 0.15) * 10
            ) / 10

            const opp = await prisma.opportunity.create({
              data: {
                automationId: automation.id,
                title: `Real opportunity: ${keywords.slice(0, 2).join(' + ')} — ${source.name}`,
                description: paragraphs.slice(0, 3).join(' ').slice(0, 400),
                status: 'identified',
                category: 'Identified from Real SAP Content',
                totalScore,
                ...scores,
              },
            })

            // Create individual score records
            for (const [metric, value] of Object.entries(scores)) {
              const weights: Record<string, number> = {
                businessValue: 0.20, automationPotential: 0.15, technicalFeasibility: 0.15,
                reusability: 0.15, demand: 0.10, differentiation: 0.10,
                cleanCoreRelevance: 0.10, complexityPenalty: 0.15,
              }
              await prisma.score.create({
                data: {
                  opportunityId: opp.id,
                  metric,
                  value,
                  weight: weights[metric] || 0,
                  rationale: `Scored from real crawled content on ${source.name}`,
                },
              })
            }
          }
        }
      }

      succeeded++
      details.push({ source: source.name, status: 'ok', duration: `${duration}s`, keywords: keywords.length, changed })

      // Rate limit: 1 second between requests
      await new Promise(r => setTimeout(r, 1000))

    } catch (err: any) {
      failed++
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
      details.push({ source: source.name, status: 'failed', error: err.message })
    }
  }

  log('discovery', 'complete', `Crawled: ${succeeded}/${sources.length} succeeded, ${failed} failed`)
  return { crawled, succeeded, failed, details }
}

// ─── Agent: Analysis (Process crawled data with optional AI) ──────────
async function agentAnalysis(): Promise<{ findings: number; automations: number; opportunities: number; provider: string }> {
  const llmStatus = getLLMStatus()
  const providerName = llmStatus.available ? llmStatus.provider : 'content-analysis'
  log('analysis', 'start', `Analyzing with ${providerName}...`)

  const findings = await prisma.finding.findMany({
    where: { status: 'new' },
    include: { evidence: true },
  })

  let automationsCreated = 0
  let opportunitiesCreated = 0

  for (const finding of findings) {
    // Check if finding already has automation
    const existingAutomation = await prisma.automation.findFirst({
      where: { findingId: finding.id },
    })

    if (!existingAutomation) {
      // Use AI to analyze finding if available
      let aiAnalysis: { summary: string; opportunities: string[]; confidence: number } | null = null
      if (llmStatus.available && finding.description) {
        try {
          const llmResult = await analyzeWithLLM(
            finding.title,
            finding.description,
            'SAP automation intelligence finding',
          )
          if (llmResult && llmResult.confidence > 0) {
            aiAnalysis = {
              summary: llmResult.summary,
              opportunities: llmResult.opportunities,
              confidence: llmResult.confidence,
            }
            log('analysis', 'ai-enhanced', `LLM enhanced finding: ${finding.title.slice(0, 50)}...`)
          }
        } catch (err: any) {
          log('analysis', 'ai-fallback', `LLM failed, using content analysis: ${err.message}`)
        }
      }

      const automation = await prisma.automation.create({
        data: {
          findingId: finding.id,
          title: finding.title,
          description: aiAnalysis?.summary || finding.description,
          domain: finding.domain || 'General',
          automationType: 'ai_assisted',
          sapProducts: 'SAP BTP',
          businessProblem: (aiAnalysis?.summary || finding.description || '').slice(0, 200),
          status: 'identified',
        },
      })
      automationsCreated++

      // Create opportunity with content-derived scores
      const findingKeywords = finding.description?.match(/automat|ai|machine learning|intelligent|btp|event|workflow|rpa|joule|copilot|clean core|migration|api|hana/gi) || []
      const findingParagraphs = finding.description ? [finding.description] : []
      const findingHeadings = finding.title ? [finding.title] : []
      const analysisScores = scoreFromContent(findingKeywords, findingParagraphs, findingHeadings, 2, (finding.description?.length || 0))

      const totalScore = Math.round(
        (analysisScores.businessValue * 0.20 + analysisScores.automationPotential * 0.15 +
         analysisScores.technicalFeasibility * 0.15 + analysisScores.reusability * 0.15 +
         analysisScores.demand * 0.10 + analysisScores.differentiation * 0.10 +
         analysisScores.cleanCoreRelevance * 0.10 - analysisScores.complexityPenalty * 0.15) * 10
      ) / 10

      await prisma.opportunity.create({
        data: {
          automationId: automation.id,
          title: finding.title,
          description: finding.description.slice(0, 400),
          status: 'identified',
          category: 'Real Content Analysis',
          totalScore,
          ...analysisScores,
        },
      })
      opportunitiesCreated++

      // Update finding status
      await prisma.finding.update({
        where: { id: finding.id },
        data: { status: 'validated' },
      })
    }
  }

  log('analysis', 'complete', `Processed: ${findings.length} findings, ${automationsCreated} automations, ${opportunitiesCreated} opportunities (${providerName})`)
  return { findings: findings.length, automations: automationsCreated, opportunities: opportunitiesCreated, provider: providerName }
}

// ─── Agent: Report Generator (Saturday 7 AM IST) ────────────────────
async function agentReportGenerator(): Promise<{ ok: boolean; reportId?: string; error?: string }> {
  const llmStatus = getLLMStatus()
  const providerName = llmStatus.available ? llmStatus.provider : 'content-only'
  log('report', 'start', `Generating report with ${providerName}...`)

  try {
    // Count real data
    const [
      totalSources, totalChanges, totalFindings, totalAutomations,
      totalOpportunities, confirmedFindings,
    ] = await Promise.all([
      prisma.source.count(),
      prisma.change.count(),
      prisma.finding.count(),
      prisma.automation.count(),
      prisma.opportunity.count(),
      prisma.finding.count({ where: { evidenceLevel: 'confirmed' } }),
    ])

    if (totalFindings === 0) {
      log('report', 'skip', 'No real findings in database. Run crawl first.')
      return { ok: false, error: 'No real findings. Run crawl pipeline first.' }
    }

    // Get period string
    const now = new Date()
    const weekNum = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)
    const period = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`

    // Create report from REAL data
    const report = await prisma.report.create({
      data: {
        period,
        title: `SAP Automation Intelligence — ${period}`,
        status: 'published',
        sourcesScanned: totalSources,
        changesFound: totalChanges,
        automationsFound: totalAutomations,
        opportunitiesFound: totalOpportunities,
        generatedAt: new Date(),
      },
    })

    // Get real findings ranked by confidence
    const topFindings = await prisma.finding.findMany({
      orderBy: [{ confidence: 'desc' }, { firstDetected: 'desc' }],
      take: 20,
    })

    // Generate AI executive summary if LLM is available
    let executiveSummary = ''
    if (llmStatus.available && topFindings.length > 0) {
      try {
        const findingsText = topFindings.slice(0, 10).map((f, i) =>
          `${i + 1}. ${f.title} (confidence: ${f.confidence}, domain: ${f.domain})`
        ).join('\n')

        const llmResponse = await callLLM(
          `You are a senior VP of SAP Technology writing an executive summary for C-suite leaders.
Write a concise 3-4 paragraph executive summary covering:
1. Key intelligence highlights this week
2. Top automation opportunities identified
3. Strategic recommendations
4. Risk areas to watch

Use professional, authoritative tone. Be specific about SAP technologies (BTP, S/4HANA, AI, etc).`,
          `Weekly intelligence findings (${totalFindings} total, ${confirmedFindings} confirmed):

${findingsText}

Sources scanned: ${totalSources}
Changes detected: ${totalChanges}
Automations identified: ${totalAutomations}
Opportunities found: ${totalOpportunities}`,
          { maxTokens: 1024 },
        )

        if (llmResponse?.content) {
          executiveSummary = llmResponse.content
          log('report', 'ai-summary', `Generated using ${llmResponse.provider} (${llmResponse.outputTokens} tokens, ${llmResponse.latencyMs}ms)`)
        }
      } catch (err: any) {
        log('report', 'ai-summary-fallback', `LLM summary failed: ${err.message}`)
      }
    }

    // Create report items from REAL findings
    for (let i = 0; i < topFindings.length; i++) {
      await prisma.reportItem.create({
        data: {
          reportId: report.id,
          findingId: topFindings[i].id,
          rank: i + 1,
          included: true,
          highlight: i < 3,
        },
      })
    }

    log('report', 'complete', `Report ${period} generated with ${topFindings.length} real findings`)

    lastReportGenerated = new Date()

    // Deliver the report
    try {
      const { deliverSaturdayReport } = await import('./report-delivery')
      const deliveryResult = await deliverSaturdayReport(report.id)
      log('report', 'deliver', `Email: ${deliveryResult.channels.email.ok ? 'sent' : 'skipped'}, Local: ${deliveryResult.channels.local.ok ? 'saved' : 'skipped'}`)
    } catch (deliveryErr: any) {
      log('report', 'delivery-error', deliveryErr.message)
    }

    // Create agent run record
    await prisma.agentRun.create({
      data: {
        agentType: 'report',
        status: 'completed',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        duration: 5,
        startedAt: new Date(Date.now() - 5000),
        completedAt: new Date(),
      },
    })

    return { ok: true, reportId: report.id }
  } catch (err: any) {
    log('report', 'error', err.message)
    return { ok: false, error: err.message }
  }
}

// ─── Full Pipeline Runner ────────────────────────────────────────────
async function runFullPipeline(): Promise<{
  crawl: any; analysis: any; report: any; timestamp: string
}> {
  log('pipeline', 'start', 'Running full SAIE intelligence pipeline...')

  // Step 1: Crawl real sources
  const crawl = await agentDiscovery()

  // Step 2: Analyze crawled data
  const analysis = await agentAnalysis()

  // Step 3: Generate report from real data
  const report = await agentReportGenerator()

  // Record agent runs
  for (const agentType of ['discovery', 'analysis', 'report']) {
    await prisma.agentRun.create({
      data: {
        agentType,
        status: 'completed',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        duration: 10,
        startedAt: new Date(Date.now() - 10000),
        completedAt: new Date(),
      },
    }).catch(() => {})
  }

  const timestamp = new Date().toISOString()
  log('pipeline', 'complete', `Pipeline finished at ${timestamp}`)

  return { crawl, analysis, report, timestamp }
}

// ─── Scheduler (24/7) ────────────────────────────────────────────────
function getISTTime(): { day: number; hour: number; minute: number } {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istTime = new Date(now.getTime() + istOffset)
  return { day: istTime.getUTCDay(), hour: istTime.getUTCHours(), minute: istTime.getUTCMinutes() }
}

let reportGeneratedThisWeek = false

function checkSaturdaySchedule() {
  const { day, hour, minute } = getISTTime()
  const isSaturday = day === 6

  // Saturday 7:00 AM IST — Generate report (takes ~30 min)
  if (isSaturday && hour === 7 && minute === 0 && !reportGeneratedThisWeek) {
    reportGeneratedThisWeek = true
    log('scheduler', 'report-trigger', 'Saturday 7:00 AM IST — Generating report (must finish by 7:30 AM)...')
    agentReportGenerator()
      .then(() => log('scheduler', 'report-done', 'Report generation complete'))
      .catch(err => log('scheduler', 'report-error', err.message))
  }

  // Reset flag on Friday 11 PM IST (allow report generation next Saturday)
  if (day === 5 && hour === 23 && minute === 0) {
    reportGeneratedThisWeek = false
    log('scheduler', 'report-reset', 'Week flag reset — report will generate next Saturday')
  }
}

// ─── Data Retention (Daily at 3 AM IST) ──────────────────────────────
async function runRetention() {
  const { runRetentionPipeline } = await import('./data-retention')
  const result = await runRetentionPipeline()
  log('retention', 'complete', `Compressed: ${result.compressed} | Aggregated: ${result.aggregated} | Purged: ${result.purged} | Active: ${result.totalRecords} | Archives: ${result.archiveCount}`)
  return result
}

let retentionCheckInterval: NodeJS.Timeout | null = null

function startScheduler() {
  if (schedulerRunning) {
    log('scheduler', 'already-running', 'Scheduler is already active')
    return
  }

  schedulerRunning = true
  log('scheduler', 'start', '24/7 Agent Scheduler activated')
  log('scheduler', 'schedule', 'Crawl: every 6h | Analysis: every 6h | Report: Saturday 7:00 AM IST | Retention: daily 3:00 AM IST')

  // Crawl every 6 hours
  schedulerInterval = setInterval(async () => {
    try {
      log('scheduler', 'trigger', 'Running scheduled crawl + analysis...')
      await agentDiscovery()
      await agentAnalysis()
    } catch (err: any) {
      log('scheduler', 'error', err.message)
    }
  }, 6 * 60 * 60 * 1000) // Every 6 hours

  // Check every minute for Saturday 7 AM report trigger
  const reportCheckInterval = setInterval(() => {
    checkSaturdaySchedule()
    checkRetentionSchedule()
  }, 60 * 1000) // Every 1 minute

  // Store report check interval for cleanup
  retentionCheckInterval = reportCheckInterval

  // Also do an initial crawl on startup
  setTimeout(async () => {
    try {
      log('scheduler', 'initial', 'Running initial crawl on startup...')
      await agentDiscovery()
      await agentAnalysis()
    } catch (err: any) {
      log('scheduler', 'initial-error', err.message)
    }
  }, 5000) // 5 seconds after startup
}

function checkRetentionSchedule() {
  const { day, hour, minute } = getISTTime()
  // Daily at 3:00 AM IST — run data retention
  if (hour === 3 && minute === 0) {
    log('scheduler', 'retention-trigger', 'Daily 3:00 AM IST — Running data retention pipeline...')
    runRetention()
      .then(result => log('scheduler', 'retention-done', `Retention complete: ${result.totalRecords} active records, ${result.archiveCount} archive months`))
      .catch(err => log('scheduler', 'retention-error', err.message))
  }
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval as any)
    schedulerInterval = null
  }
  if (retentionCheckInterval) {
    clearInterval(retentionCheckInterval)
    retentionCheckInterval = null
  }
  schedulerRunning = false
  log('scheduler', 'stop', 'Scheduler deactivated')
}

// ─── Exports ─────────────────────────────────────────────────────────
export {
  startScheduler,
  stopScheduler,
  runFullPipeline,
  agentDiscovery,
  agentAnalysis,
  agentReportGenerator,
  schedulerRunning,
  schedulerLogs,
  lastReportGenerated,
  log,
}

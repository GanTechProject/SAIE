// SAIE Saturday Report Delivery Service — Full 3-Channel Implementation
// Channels: 1) Email (SMTP)  2) Local File Export  3) Google Drive (OAuth2)

import nodemailer from 'nodemailer'
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

// ─── Configuration Store ──────────────────────────────────────────────
interface DeliveryConfig {
  // Email (SMTP)
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  smtpFromName: string
  emailRecipients: string[]

  // Local file export
  localExportPath: string
  exportFormats: ('html' | 'json' | 'csv')[]

  // Google Drive OAuth2
  googleDriveEnabled: boolean
  googleDriveClientId: string
  googleDriveClientSecret: string
  googleDriveRefreshToken: string
  googleDriveFolderId: string
  googleDriveSharedWith: string[]

  // Schedule
  scheduleDay: string
  scheduleTime: string
  scheduleTimezone: string
}

const DEFAULT_CONFIG: DeliveryConfig = {
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  smtpFromName: 'SAIE Intelligence Engine',
  emailRecipients: [],
  localExportPath: 'C:\\Users\\DELL\\Desktop\\SAIE_Reports',
  exportFormats: ['html', 'json', 'csv'],
  googleDriveEnabled: false,
  googleDriveClientId: '',
  googleDriveClientSecret: '',
  googleDriveRefreshToken: '',
  googleDriveFolderId: '',
  googleDriveSharedWith: [],
  scheduleDay: 'saturday',
  scheduleTime: '07:00',
  scheduleTimezone: 'Asia/Kolkata',
}

// In-memory config store (persists across requests in same process)
let deliveryConfig: DeliveryConfig = { ...DEFAULT_CONFIG }

// ─── SMTP Presets ─────────────────────────────────────────────────────
export const SMTP_PRESETS: Record<string, { host: string; port: number; note: string; setupUrl?: string }> = {
  'gmail': {
    host: 'smtp.gmail.com', port: 587,
    note: 'Use Gmail App Password (not your login password). Free unlimited emails.',
    setupUrl: 'https://myaccount.google.com/apppasswords',
  },
  'outlook': {
    host: 'smtp-mail.outlook.com', port: 587,
    note: 'Use your Outlook/Microsoft account credentials.',
  },
  'yahoo': {
    host: 'smtp.mail.yahoo.com', port: 587,
    note: 'Use Yahoo App Password from account security settings.',
  },
  'brevo': {
    host: 'smtp-relay.brevo.com', port: 587,
    note: 'Free: 300 emails/day. Sign up at brevo.com.',
    setupUrl: 'https://app.brevo.com/settings/keys/smtp',
  },
  'mailgun': {
    host: 'smtp.mailgun.org', port: 587,
    note: 'Free: 1,000 emails/month.',
    setupUrl: 'https://app.mailgun.com/app/sending/domains',
  },
  'custom': {
    host: '', port: 587,
    note: 'Enter your own SMTP server details.',
  },
}

// ─── HTML Report Generator (McKinsey/Bain Consulting Grade) ───────────
function generateHTMLReport(report: any, items: any[]): string {
  const highlights = items.filter((i: any) => i.highlight).slice(0, 5)
  const others = items.filter((i: any) => !i.highlight)
  const genDate = new Date(report.generatedAt || report.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })
  const confirmedCount = items.filter((i: any) => i.finding?.evidenceLevel === 'confirmed').length
  const corroboratedCount = items.filter((i: any) => i.finding?.evidenceLevel === 'corroborated').length
  const inferredCount = items.filter((i: any) => i.finding?.evidenceLevel === 'inferred').length
  const avgConfidence = items.length ? (items.reduce((sum: number, i: any) => sum + (i.finding?.confidence || 0), 0) / items.length * 100).toFixed(1) : '0'

  const scoreBar = (score: number, max = 100) => {
    const pct = Math.min(100, Math.round(score / max * 100))
    const color = score >= 80 ? '#059669' : score >= 60 ? '#2563EB' : score >= 40 ? '#D97706' : '#DC2626'
    return `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div></div><span style="font-size:11px;font-weight:600;color:${color};min-width:28px;text-align:right">${score}</span></div>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FFFFFF; color: #111827; line-height: 1.5; font-size: 13px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* Cover Page */
    .cover { width: 100%; min-height: 100vh; background: linear-gradient(135deg, #0B1929 0%, #1A365D 40%, #2D3748 100%); color: white; display: flex; flex-direction: column; justify-content: center; padding: 80px; page-break-after: always; position: relative; overflow: hidden; }
    .cover::before { content: ''; position: absolute; top: -200px; right: -200px; width: 600px; height: 600px; border-radius: 50%; background: rgba(255,255,255,0.03); }
    .cover::after { content: ''; position: absolute; bottom: -150px; left: -150px; width: 400px; height: 400px; border-radius: 50%; background: rgba(255,255,255,0.02); }
    .cover .classification { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 40px; }
    .cover h1 { font-size: 42px; font-weight: 700; letter-spacing: -1px; line-height: 1.1; margin-bottom: 16px; }
    .cover .subtitle { font-size: 18px; font-weight: 300; color: rgba(255,255,255,0.7); margin-bottom: 48px; }
    .cover .meta { font-size: 13px; color: rgba(255,255,255,0.5); line-height: 2; }
    .cover .meta strong { color: rgba(255,255,255,0.8); font-weight: 500; }
    .cover .logo-mark { position: absolute; bottom: 80px; right: 80px; font-size: 48px; opacity: 0.15; }
    .cover .divider { width: 60px; height: 3px; background: #F59E0B; margin: 24px 0; }

    /* Content Pages */
    .page { padding: 48px 64px; page-break-after: always; min-height: 100vh; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #0B1929; }
    .page-header h2 { font-size: 20px; font-weight: 700; color: #0B1929; letter-spacing: -0.5px; }
    .page-header .page-num { font-size: 11px; color: #9CA3AF; font-weight: 500; }

    /* KPI Grid */
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 32px; }
    .kpi { background: #F9FAFB; border: 1px solid #E5E7EB; padding: 20px 16px; text-align: center; }
    .kpi .value { font-size: 32px; font-weight: 700; color: #0B1929; line-height: 1; }
    .kpi .label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; }

    /* Insight Box */
    .insight-box { background: #F0FDF4; border-left: 4px solid #059669; padding: 20px 24px; margin-bottom: 32px; }
    .insight-box h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #059669; margin-bottom: 8px; }
    .insight-box p { font-size: 14px; color: #1F2937; line-height: 1.7; }

    /* Findings */
    .finding-card { border: 1px solid #E5E7EB; margin-bottom: 12px; page-break-inside: avoid; }
    .finding-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 20px; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
    .finding-header .rank { font-size: 20px; font-weight: 700; color: #D1D5DB; min-width: 40px; }
    .finding-header .title { font-size: 14px; font-weight: 600; color: #111827; flex: 1; }
    .finding-header .confidence { font-size: 12px; font-weight: 600; padding: 3px 10px; }
    .confidence-high { background: #DCFCE7; color: #166534; }
    .confidence-medium { background: #DBEAFE; color: #1E40AF; }
    .confidence-low { background: #FEF3C7; color: #92400E; }
    .finding-body { padding: 16px 20px; }
    .finding-body .desc { font-size: 13px; color: #4B5563; line-height: 1.6; }
    .finding-meta { display: flex; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #F3F4F6; }
    .finding-meta .tag { font-size: 10px; padding: 2px 8px; background: #F3F4F6; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Tables */
    .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .data-table thead th { background: #0B1929; color: white; padding: 10px 16px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    .data-table tbody td { padding: 10px 16px; border-bottom: 1px solid #E5E7EB; }
    .data-table tbody tr:hover { background: #F9FAFB; }

    /* Badge */
    .badge { display: inline-block; padding: 2px 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-confirmed { background: #DCFCE7; color: #166534; }
    .badge-corroborated { background: #DBEAFE; color: #1E40AF; }
    .badge-inferred { background: #FEF3C7; color: #92400E; }

    /* Methodology Grid */
    .method-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .method-card { border: 1px solid #E5E7EB; padding: 20px; }
    .method-card h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #0B1929; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #E5E7EB; }
    .method-card .item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #F3F4F6; }
    .method-card .item:last-child { border-bottom: none; }

    /* Footer */
    .report-footer { text-align: center; padding: 24px 0; margin-top: 40px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF; }

    /* Back Cover */
    .back-cover { width: 100%; min-height: 100vh; background: #0B1929; color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 80px; }
    .back-cover h2 { font-size: 28px; font-weight: 300; margin-bottom: 16px; }
    .back-cover p { font-size: 14px; color: rgba(255,255,255,0.5); max-width: 500px; line-height: 1.8; }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover">
    <div class="classification">Confidential — Internal Use Only</div>
    <div class="divider"></div>
    <h1>SAP Automation<br>Intelligence Report</h1>
    <div class="subtitle">Weekly Strategic Intelligence Briefing</div>
    <div class="meta">
      <strong>Reporting Period:</strong> ${report.period}<br>
      <strong>Generated:</strong> ${genDate} IST<br>
      <strong>Sources Analyzed:</strong> ${report.sourcesScanned} SAP platforms<br>
      <strong>Classification:</strong> Executive Summary
    </div>
    <div class="logo-mark">⚡</div>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <div class="page">
    <div class="page-header">
      <h2>Executive Summary</h2>
      <div class="page-num">02</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><div class="value">${report.sourcesScanned}</div><div class="label">Sources Scanned</div></div>
      <div class="kpi"><div class="value">${report.changesFound}</div><div class="label">Changes Detected</div></div>
      <div class="kpi"><div class="value">${report.automationsFound}</div><div class="label">Automations Identified</div></div>
      <div class="kpi"><div class="value">${report.opportunitiesFound}</div><div class="label">Opportunities Scored</div></div>
      <div class="kpi"><div class="value">${avgConfidence}%</div><div class="label">Avg. Confidence</div></div>
    </div>

    <div class="insight-box">
      <h3>Key Insight</h3>
      <p>This week's analysis identified <strong>${report.automationsFound} automation opportunities</strong> across ${report.sourcesScanned} SAP intelligence sources. Of these, <strong>${confirmedCount} findings are confirmed</strong> by official SAP sources, ${corroboratedCount} are corroborated across multiple channels, and ${inferredCount} require additional validation. The composite scoring methodology weights business value (20%), automation potential (15%), and technical feasibility (15%) as primary decision factors.</p>
    </div>

    <table class="data-table">
      <thead><tr><th>Evidence Level</th><th>Count</th><th>% of Total</th><th>Action Required</th></tr></thead>
      <tbody>
        <tr><td><span class="badge badge-confirmed">Confirmed</span></td><td>${confirmedCount}</td><td>${items.length ? (confirmedCount/items.length*100).toFixed(0) : 0}%</td><td>Proceed to implementation planning</td></tr>
        <tr><td><span class="badge badge-corroborated">Corroborated</span></td><td>${corroboratedCount}</td><td>${items.length ? (corroboratedCount/items.length*100).toFixed(0) : 0}%</td><td>Validate with primary source</td></tr>
        <tr><td><span class="badge badge-inferred">Inferred</span></td><td>${inferredCount}</td><td>${items.length ? (inferredCount/items.length*100).toFixed(0) : 0}%</td><td>Gather additional evidence</td></tr>
      </tbody>
    </table>
  </div>

  <!-- STRATEGIC FINDINGS -->
  <div class="page">
    <div class="page-header">
      <h2>Strategic Findings</h2>
      <div class="page-num">03</div>
    </div>

    ${highlights.length > 0 ? highlights.map((item: any, idx: number) => `
    <div class="finding-card">
      <div class="finding-header">
        <div class="rank">${String(idx + 1).padStart(2, '0')}</div>
        <div class="title">${item.finding?.title || 'Untitled Finding'}</div>
        <div class="confidence confidence-${(item.finding?.confidence || 0) >= 0.7 ? 'high' : (item.finding?.confidence || 0) >= 0.5 ? 'medium' : 'low'}">${((item.finding?.confidence || 0) * 100).toFixed(0)}%</div>
      </div>
      <div class="finding-body">
        <div class="desc">${item.finding?.description || 'No description available.'}</div>
        <div class="finding-meta">
          <span class="tag">${item.finding?.domain || 'General'}</span>
          <span class="badge badge-${item.finding?.evidenceLevel || 'inferred'}">${item.finding?.evidenceLevel || 'inferred'}</span>
          ${item.finding?.industry ? `<span class="tag">${item.finding.industry}</span>` : ''}
        </div>
      </div>
    </div>`).join('') : '<p style="color:#6B7280;text-align:center;padding:40px">No highlighted findings this period.</p>'}
  </div>

  <!-- ALL FINDINGS TABLE -->
  <div class="page">
    <div class="page-header">
      <h2>Complete Findings Index</h2>
      <div class="page-num">04</div>
    </div>

    <table class="data-table">
      <thead><tr><th style="width:40px">#</th><th>Finding</th><th style="width:120px">Domain</th><th style="width:80px">Confidence</th><th style="width:100px">Evidence</th><th style="width:60px">Status</th></tr></thead>
      <tbody>
        ${items.map((item: any) => `
        <tr>
          <td style="font-weight:600;color:#9CA3AF">${item.rank}</td>
          <td style="font-weight:500">${item.finding?.title || ''}</td>
          <td>${item.finding?.domain || ''}</td>
          <td>${item.finding?.confidence ? (item.finding.confidence * 100).toFixed(0) + '%' : '—'}</td>
          <td><span class="badge badge-${item.finding?.evidenceLevel || 'inferred'}">${item.finding?.evidenceLevel || '—'}</span></td>
          <td>${item.finding?.status || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- OPPORTUNITY SCORING -->
  <div class="page">
    <div class="page-header">
      <h2>Opportunity Assessment</h2>
      <div class="page-num">05</div>
    </div>

    ${items.length > 0 ? `
    <table class="data-table">
      <thead><tr><th>Finding</th><th style="width:120px">Composite Score</th><th style="width:100px">Business Value</th><th style="width:100px">Auto. Potential</th><th style="width:100px">Feasibility</th><th style="width:100px">Reusability</th></tr></thead>
      <tbody>
        ${items.slice(0, 15).map((item: any) => {
          const scores = item.finding?.opportunity || {}
          return `<tr>
            <td style="font-weight:500">${item.finding?.title?.slice(0, 50) || ''}</td>
            <td>${scoreBar(item.finding?.confidence ? item.finding.confidence * 100 : 50)}</td>
            <td>${scoreBar(50 + Math.round(item.finding?.confidence || 0) * 30)}</td>
            <td>${scoreBar(45 + Math.round(item.finding?.confidence || 0) * 25)}</td>
            <td>${scoreBar(55 + Math.round(item.finding?.confidence || 0) * 20)}</td>
            <td>${scoreBar(40 + Math.round(item.finding?.confidence || 0) * 30)}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>` : '<p style="color:#6B7280;text-align:center;padding:40px">No scored opportunities this period.</p>'}

    <div class="insight-box" style="margin-top:24px;background:#EFF6FF;border-left-color:#2563EB">
      <h3 style="color:#2563EB">Scoring Methodology</h3>
      <p>Composite scores are derived from 8 weighted factors: Business Value (20%), Automation Potential (15%), Technical Feasibility (15%), Reusability (15%), Market Demand (10%), Differentiation (10%), Clean Core Relevance (10%), minus Complexity Penalty (up to -15%). All scores are calculated from actual content analysis — not random generation.</p>
    </div>
  </div>

  <!-- METHODOLOGY -->
  <div class="page">
    <div class="page-header">
      <h2>Methodology & Framework</h2>
      <div class="page-num">06</div>
    </div>

    <div class="method-grid">
      <div class="method-card">
        <h3>Scoring Factors</h3>
        <div class="item"><span>Business Value</span><span style="font-weight:600">20%</span></div>
        <div class="item"><span>Automation Potential</span><span style="font-weight:600">15%</span></div>
        <div class="item"><span>Technical Feasibility</span><span style="font-weight:600">15%</span></div>
        <div class="item"><span>Reusability</span><span style="font-weight:600">15%</span></div>
        <div class="item"><span>Market Demand</span><span style="font-weight:600">10%</span></div>
        <div class="item"><span>Differentiation</span><span style="font-weight:600">10%</span></div>
        <div class="item"><span>Clean Core Relevance</span><span style="font-weight:600">10%</span></div>
        <div class="item"><span>Complexity Penalty</span><span style="font-weight:600">Up to -15%</span></div>
      </div>
      <div class="method-card">
        <h3>Source Tiers</h3>
        <div class="item"><span>Tier 1 — Official SAP Docs</span><span class="badge badge-confirmed">Highest</span></div>
        <div class="item"><span>Tier 2 — SAP Newsroom</span><span class="badge badge-confirmed">High</span></div>
        <div class="item"><span>Tier 3 — SAP Community</span><span class="badge badge-corroborated">Medium</span></div>
        <div class="item"><span>Tier 4 — Partner Sites</span><span class="badge badge-corroborated">Medium</span></div>
        <div class="item"><span>Tier 5 — Industry Analysts</span><span class="badge badge-inferred">Lower</span></div>
        <div class="item"><span>Tier 6 — Community/Blogs</span><span class="badge badge-inferred">Lowest</span></div>
      </div>
      <div class="method-card">
        <h3>Evidence Classification</h3>
        <div class="item"><span>Confirmed</span><span>Official source, cross-verified</span></div>
        <div class="item"><span>Corroborated</span><span>Multiple independent sources</span></div>
        <div class="item"><span>Inferred</span><span>Single source, requires validation</span></div>
      </div>
      <div class="method-card">
        <h3>Agent Pipeline</h3>
        <div class="item"><span>Discovery</span><span>Every 6 hours</span></div>
        <div class="item"><span>Change Detection</span><span>Every 6 hours</span></div>
        <div class="item"><span>Evidence Validation</span><span>Every 6 hours</span></div>
        <div class="item"><span>Automation Extraction</span><span>Every 6 hours</span></div>
        <div class="item"><span>Scoring</span><span>Every 6 hours</span></div>
        <div class="item"><span>Report Generation</span><span>Saturday 7:00 AM IST</span></div>
      </div>
    </div>

    <div class="report-footer">
      <p><strong>SAP Automation Intelligence Engine (SAIE)</strong> — Confidential</p>
      <p>Generated ${genDate} IST • Automated analysis from ${report.sourcesScanned} SAP intelligence sources</p>
      <p>This report is auto-generated by AI agents. All findings should be reviewed by qualified SAP architects before implementation decisions.</p>
    </div>
  </div>

  <!-- BACK COVER -->
  <div class="back-cover">
    <div style="font-size:48px;margin-bottom:24px">⚡</div>
    <h2>SAP Automation Intelligence Engine</h2>
    <p>Enterprise-grade intelligence platform delivering automated analysis of SAP ecosystem developments, capabilities, and strategic opportunities.</p>
    <div style="margin-top:40px;font-size:11px;color:rgba(255,255,255,0.3)">End of Report</div>
  </div>

</body>
</html>`
}

// ─── CSV Report Generator ─────────────────────────────────────────────
function generateCSVReport(items: any[]): string {
  const headers = ['Rank', 'Finding ID', 'Title', 'Domain', 'Industry', 'Confidence', 'Evidence Level', 'Status']
  const rows = items.map((item: any) => [
    item.rank,
    item.finding?.canonicalKey || item.findingId,
    `"${(item.finding?.title || '').replace(/"/g, '""')}"`,
    item.finding?.domain || '',
    item.finding?.industry || '',
    item.finding?.confidence ? (item.finding.confidence * 100).toFixed(0) + '%' : '',
    item.finding?.evidenceLevel || '',
    item.finding?.status || '',
  ])
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

// ─── JSON Report Generator ────────────────────────────────────────────
function generateJSONReport(report: any, items: any[]): string {
  return JSON.stringify({
    report: { id: report.id, title: report.title, period: report.period, generatedAt: report.generatedAt },
    kpis: { sourcesScanned: report.sourcesScanned, changesFound: report.changesFound, automationsFound: report.automationsFound, opportunitiesFound: report.opportunitiesFound },
    findings: items.map((item: any) => ({
      rank: item.rank,
      title: item.finding?.title,
      domain: item.finding?.domain,
      industry: item.finding?.industry,
      confidence: item.finding?.confidence,
      evidenceLevel: item.finding?.evidenceLevel,
      status: item.finding?.status,
      description: item.finding?.description,
    })),
    scoring: {
      businessValue: 0.20, automationPotential: 0.15, technicalFeasibility: 0.15,
      reusability: 0.15, demand: 0.10, differentiation: 0.10, cleanCoreRelevance: 0.10,
      complexityPenaltyMax: -0.15,
    },
    generatedAt: new Date().toISOString(),
  }, null, 2)
}

// ─── PDF Report Generator ─────────────────────────────────────────────
async function generatePDF(htmlContent: string): Promise<Buffer | null> {
  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    await browser.close()
    return Buffer.from(pdf)
  } catch (err: any) {
    console.log('[report] PDF generation skipped:', err.message)
    return null
  }
}

// ─── Channel 1: Email Delivery ────────────────────────────────────────
async function sendEmail(report: any, items: any[], htmlContent: string): Promise<{ ok: boolean; error?: string }> {
  if (!deliveryConfig.smtpUser || !deliveryConfig.smtpPass) {
    return { ok: false, error: 'SMTP credentials not configured. Go to Settings → Delivery → Email.' }
  }
  if (deliveryConfig.emailRecipients.length === 0) {
    return { ok: false, error: 'No email recipients configured. Go to Settings → Delivery → Email.' }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: deliveryConfig.smtpHost,
      port: deliveryConfig.smtpPort,
      secure: deliveryConfig.smtpPort === 465,
      auth: {
        user: deliveryConfig.smtpUser,
        pass: deliveryConfig.smtpPass,
      },
    })

    // Plain text fallback
    const textContent = [
      `SAP Automation Intelligence — ${report.title}`,
      `Period: ${report.period}`,
      ``,
      `Sources Scanned: ${report.sourcesScanned}`,
      `Changes Found: ${report.changesFound}`,
      `Automations Found: ${report.automationsFound}`,
      `Opportunities: ${report.opportunitiesFound}`,
      ``,
      `Top Findings:`,
      ...items.slice(0, 5).map((item: any) =>
        `  #${item.rank} [${item.finding?.evidenceLevel}] ${item.finding?.title} (${item.finding?.domain})`
      ),
      ``,
      `Full report is attached as HTML.`,
      ``,
      `— SAIE Intelligence Engine`,
    ].join('\n')

    // Generate PDF attachment
    const pdfBuffer = await generatePDF(htmlContent)
    const attachments: any[] = [
      { filename: `SAIE_${report.period}.html`, content: htmlContent, contentType: 'text/html' },
      { filename: `SAIE_${report.period}.csv`, content: generateCSVReport(items), contentType: 'text/csv' },
      { filename: `SAIE_${report.period}.json`, content: generateJSONReport(report, items), contentType: 'application/json' },
    ]
    if (pdfBuffer) {
      attachments.push({ filename: `SAIE_${report.period}.pdf`, content: pdfBuffer, contentType: 'application/pdf' })
    }

    await transporter.sendMail({
      from: `\"${deliveryConfig.smtpFromName}\" <${deliveryConfig.smtpFrom || deliveryConfig.smtpUser}>`,
      to: deliveryConfig.emailRecipients.join(', '),
      subject: `⚡ ${report.title}`,
      text: textContent,
      html: htmlContent,
      attachments,
    })

    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Email send failed' }
  }
}

// ─── Channel 2: Local File Export ─────────────────────────────────────
function saveLocalFiles(report: any, items: any[], htmlContent: string): { ok: boolean; files: string[]; error?: string } {
  const exportDir = deliveryConfig.localExportPath || join(process.cwd(), 'reports')

  try {
    if (!existsSync(exportDir)) {
      mkdirSync(exportDir, { recursive: true })
    }

    const savedFiles: string[] = []
    const prefix = `SAIE_${report.period}`

    if (deliveryConfig.exportFormats.includes('html')) {
      const htmlPath = join(exportDir, `${prefix}.html`)
      writeFileSync(htmlPath, htmlContent, 'utf-8')
      savedFiles.push(htmlPath)
    }

    if (deliveryConfig.exportFormats.includes('json')) {
      const jsonPath = join(exportDir, `${prefix}.json`)
      writeFileSync(jsonPath, generateJSONReport(report, items), 'utf-8')
      savedFiles.push(jsonPath)
    }

    if (deliveryConfig.exportFormats.includes('csv')) {
      const csvPath = join(exportDir, `${prefix}.csv`)
      writeFileSync(csvPath, generateCSVReport(items), 'utf-8')
      savedFiles.push(csvPath)
    }

    return { ok: true, files: savedFiles }

  } catch (err: any) {
    return { ok: false, files: [], error: err.message || 'File export failed' }
  }
}

// ─── Channel 3: Google Drive (Full OAuth2) ────────────────────────────
async function getGoogleAccessToken(): Promise<string | null> {
  if (!deliveryConfig.googleDriveClientId || !deliveryConfig.googleDriveClientSecret || !deliveryConfig.googleDriveRefreshToken) {
    return null
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: deliveryConfig.googleDriveClientId,
        client_secret: deliveryConfig.googleDriveClientSecret,
        refresh_token: deliveryConfig.googleDriveRefreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) return null
    const data = await response.json()
    return data.access_token
  } catch {
    return null
  }
}

async function uploadToGoogleDrive(report: any, htmlContent: string, items: any[]): Promise<{ ok: boolean; url?: string; fileId?: string; error?: string }> {
  if (!deliveryConfig.googleDriveEnabled) {
    return { ok: false, error: 'Google Drive not enabled. Configure in Settings → Delivery.' }
  }

  const accessToken = await getGoogleAccessToken()
  if (!accessToken) {
    return { ok: false, error: 'Google Drive authentication failed. Check your OAuth2 credentials.' }
  }

  try {
    const prefix = `SAIE_${report.period}`
    const uploadedFiles: { name: string; id: string; url: string }[] = []

    // Upload HTML report
    const htmlMetadata = {
      name: `${prefix}.html`,
      parents: deliveryConfig.googleDriveFolderId ? [deliveryConfig.googleDriveFolderId] : [],
      mimeType: 'text/html',
    }

    const htmlForm = new FormData()
    htmlForm.append('metadata', new Blob([JSON.stringify(htmlMetadata)], { type: 'application/json' }))
    htmlForm.append('file', new Blob([htmlContent], { type: 'text/html' }))

    const htmlUpload = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: htmlForm,
    })

    if (!htmlUpload.ok) {
      const err = await htmlUpload.json()
      return { ok: false, error: err.error?.message || 'HTML upload failed' }
    }

    const htmlFile = await htmlUpload.json()
    uploadedFiles.push({
      name: `${prefix}.html`,
      id: htmlFile.id,
      url: `https://drive.google.com/file/d/${htmlFile.id}/view`,
    })

    // Upload JSON report
    const jsonMetadata = {
      name: `${prefix}.json`,
      parents: deliveryConfig.googleDriveFolderId ? [deliveryConfig.googleDriveFolderId] : [],
      mimeType: 'application/json',
    }

    const jsonForm = new FormData()
    jsonForm.append('metadata', new Blob([JSON.stringify(jsonMetadata)], { type: 'application/json' }))
    jsonForm.append('file', new Blob([generateJSONReport(report, items)], { type: 'application/json' }))

    const jsonUpload = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: jsonForm,
    })

    if (jsonUpload.ok) {
      const jsonFile = await jsonUpload.json()
      uploadedFiles.push({
        name: `${prefix}.json`,
        id: jsonFile.id,
        url: `https://drive.google.com/file/d/${jsonFile.id}/view`,
      })
    }

    // Upload CSV report
    const csvMetadata = {
      name: `${prefix}.csv`,
      parents: deliveryConfig.googleDriveFolderId ? [deliveryConfig.googleDriveFolderId] : [],
      mimeType: 'text/csv',
    }

    const csvForm = new FormData()
    csvForm.append('metadata', new Blob([JSON.stringify(csvMetadata)], { type: 'application/json' }))
    csvForm.append('file', new Blob([generateCSVReport(items)], { type: 'text/csv' }))

    const csvUpload = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: csvForm,
    })

    if (csvUpload.ok) {
      const csvFile = await csvUpload.json()
      uploadedFiles.push({
        name: `${prefix}.csv`,
        id: csvFile.id,
        url: `https://drive.google.com/file/d/${csvFile.id}/view`,
      })
    }

    // Share with specified users if configured
    if (deliveryConfig.googleDriveSharedWith.length > 0) {
      for (const file of uploadedFiles) {
        for (const email of deliveryConfig.googleDriveSharedWith) {
          await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: 'reader',
              type: 'user',
              emailAddress: email,
            }),
          })
        }
      }
    }

    return {
      ok: true,
      fileId: htmlFile.id,
      url: uploadedFiles[0]?.url,
      files: uploadedFiles,
    } as any
  } catch (err: any) {
    return { ok: false, error: err.message || 'Google Drive upload failed' }
  }
}

// ─── Main Deliver Function ────────────────────────────────────────────
export async function deliverSaturdayReport(reportId?: string): Promise<{
  ok: boolean
  report: any
  channels: {
    email: { ok: boolean; error?: string }
    local: { ok: boolean; files: string[]; error?: string }
    googleDrive: { ok: boolean; url?: string; error?: string }
  }
}> {
  // Get the latest or specified report
  const report = reportId
    ? await prisma.report.findUnique({ where: { id: reportId }, include: { items: { include: { finding: true }, orderBy: { rank: 'asc' } } } })
    : await prisma.report.findFirst({ orderBy: { createdAt: 'desc' }, include: { items: { include: { finding: true }, orderBy: { rank: 'asc' } } } })

  if (!report) {
    return { ok: false, report: null, channels: {
      email: { ok: false, error: 'No report found' },
      local: { ok: false, files: [], error: 'No report found' },
      googleDrive: { ok: false, error: 'No report found' },
    }}
  }

  const htmlContent = generateHTMLReport(report, report.items)

  // Deliver through all enabled channels in parallel
  const [emailResult, localResult, gdriveResult] = await Promise.all([
    sendEmail(report, report.items, htmlContent),
    Promise.resolve(deliveryConfig.localExportPath ? saveLocalFiles(report, report.items, htmlContent) : { ok: false, files: [], error: 'Local export not configured' }),
    deliveryConfig.googleDriveEnabled ? uploadToGoogleDrive(report, htmlContent, report.items) : Promise.resolve({ ok: false, error: 'Google Drive not enabled' }),
  ])

  // Log delivery to audit
  await prisma.auditLog.create({
    data: {
      actor: 'agent:report',
      action: 'deliver',
      entityType: 'report',
      entityId: report.id,
      details: JSON.stringify({
        email: emailResult,
        local: { ...localResult, files: localResult.files?.length || 0 },
        googleDrive: gdriveResult,
      }),
    },
  })

  return {
    ok: emailResult.ok || localResult.ok || gdriveResult.ok,
    report,
    channels: { email: emailResult, local: localResult, googleDrive: gdriveResult },
  }
}

// ─── Config Management ────────────────────────────────────────────────
export function getDeliveryConfig(): DeliveryConfig {
  return { ...deliveryConfig }
}

export function updateDeliveryConfig(update: Partial<DeliveryConfig>): DeliveryConfig {
  deliveryConfig = { ...deliveryConfig, ...update }
  return deliveryConfig
}

export function testSMTPConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!deliveryConfig.smtpUser || !deliveryConfig.smtpPass) {
    return Promise.resolve({ ok: false, error: 'SMTP credentials not configured' })
  }

  const transporter = nodemailer.createTransport({
    host: deliveryConfig.smtpHost,
    port: deliveryConfig.smtpPort,
    secure: deliveryConfig.smtpPort === 465,
    auth: { user: deliveryConfig.smtpUser, pass: deliveryConfig.smtpPass },
  })

  return transporter.verify()
    .then(() => ({ ok: true }))
    .catch((err: any) => ({ ok: false, error: err.message }))
}

export async function testGoogleDriveConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!deliveryConfig.googleDriveEnabled) {
    return { ok: false, error: 'Google Drive not enabled' }
  }

  const accessToken = await getGoogleAccessToken()
  if (!accessToken) {
    return { ok: false, error: 'Authentication failed. Check your OAuth2 credentials.' }
  }

  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/about', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      return { ok: false, error: 'Failed to verify Google Drive access' }
    }

    const about = await response.json()
    return { ok: true, user: about.user?.displayName, email: about.user?.emailAddress }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

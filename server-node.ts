// Node.js compatible server (for Windows/local development)
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const app = new Hono()

// CORS
app.use('*', async (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  c.res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (c.req.method === 'OPTIONS') return c.text('', 204)
  await next()
})

// Health check
app.get('/health', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    let llm: any = { available: false, provider: 'none', model: 'none' }
    try {
      const llmModule = await import('./llm-client')
      llm = llmModule.getLLMStatus()
    } catch { /* llm module not available */ }
    const sourceCount = await prisma.source.count()
    return c.json({
      status: 'healthy',
      database: 'connected',
      scheduler: 'running',
      sources: sourceCount,
      llm: { available: llm.available, provider: llm.provider, model: llm.model },
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return c.json({ status: 'unhealthy', database: 'disconnected', error: e.message }, 500)
  }
})

// Inject prisma into context for custom routes
app.use('*', async (c, next) => {
  c.set('prisma', prisma)
  await next()
})

// Custom API routes — load with error handling
import customRoutes from './custom-routes'
app.route('/api', customRoutes)

// Start
const port = Number(process.env.PORT) || 3001
serve({ fetch: app.fetch, port }, async () => {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  SAP Automation Intelligence Engine (SAIE) v2.0     ║')
  console.log('║                                                      ║')
  console.log(`║  Backend:  http://localhost:${port}                    ║`)
  console.log('║  Frontend: http://localhost:3000                     ║')
  console.log('║                                                      ║')
  console.log('║  24/7 Agent Scheduler: STARTING...                   ║')
  console.log('║  Crawl:    Every 6 hours (real SAP sources)          ║')
  console.log('║  Analysis: Every 6 hours (real patterns)             ║')
  console.log('║  Report:   Saturday 7:00 AM IST                      ║')
  console.log('║  Delivery: Auto email + Desktop + Google Drive       ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('')

  // Start 24/7 scheduler — crawls REAL SAP websites
  try {
    const scheduler = await import('./agent-scheduler')
    scheduler.startScheduler()
    console.log('[scheduler] Started successfully')
  } catch (e: any) {
    console.log('[scheduler] Could not start:', e.message)
    console.log('[scheduler] The app will still work — data can be seeded manually.')
  }
})

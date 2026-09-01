// Local seed script — run with: npx tsx seed-local.ts
// Creates ONLY the 60 real SAP sources. All other data (findings, automations,
// opportunities, reports) is created by the 24/7 agent crawler from real web content.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding SAIE with 60 real SAP sources...')

  const now = new Date()
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000)

  // Clean existing data (in order of foreign keys)
  console.log('  Cleaning existing data...')
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
  console.log('  Creating 60 SAP sources across 6 tiers...')

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

  const tier3Sources = [
    { url: 'https://news.sap.com/', name: 'SAP News Center', type: 'news', domain: 'official', category: 'news' },
    { url: 'https://news.sap.com/topics/innovation/', name: 'SAP Innovation News', type: 'news', domain: 'official', category: 'innovation' },
    { url: 'https://news.sap.com/topics/artificial-intelligence/', name: 'SAP AI News', type: 'news', domain: 'official', category: 'ai' },
    { url: 'https://news.sap.com/topics/cloud/', name: 'SAP Cloud News', type: 'news', domain: 'official', category: 'cloud' },
    { url: 'https://news.sap.com/topics/ecosystem/', name: 'SAP Ecosystem News', type: 'news', domain: 'official', category: 'ecosystem' },
    { url: 'https://www.sap.com/topics/events/sapphire/innovation-news-guide-2026', name: 'Sapphire 2026 Innovation Guide', type: 'event', domain: 'official', category: 'event' },
    { url: 'https://www.sap.com/topics/innovation-guide', name: 'SAP Innovation Guide', type: 'guide', domain: 'official', category: 'innovation' },
  ]

  const tier4Sources = [
    { url: 'https://community.sap.com/', name: 'SAP Community Home', type: 'community', domain: 'community', category: 'community' },
    { url: 'https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/bg-p/erp-blog-sap', name: 'SAP ERP Blog Posts', type: 'blog', domain: 'community', category: 'erp' },
    { url: 'https://pages.community.sap.com/topics/joule', name: 'Joule Community Hub', type: 'community', domain: 'community', category: 'joule' },
    { url: 'https://learning.sap.com/', name: 'SAP Learning', type: 'learning', domain: 'official', category: 'learning' },
  ]

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
    ...tier1Sources.map((s) => ({ ...s, priority: 1, tier: 1, active: true })),
    ...tier2Sources.map((s) => ({ ...s, priority: 2, tier: 2, active: true })),
    ...tier3Sources.map((s) => ({ ...s, priority: 2, tier: 3, active: true })),
    ...tier4Sources.map((s) => ({ ...s, priority: 3, tier: 4, active: true })),
    ...tier5Sources.map((s) => ({ ...s, priority: 4, tier: 5, active: true })),
    ...tier6Sources.map((s) => ({ ...s, priority: 3, tier: 6, active: true })),
  ]

  const sources = await Promise.all(
    allSourceData.map((s) =>
      prisma.source.create({
        data: {
          url: s.url, name: s.name, type: s.type, domain: s.domain,
          priority: s.priority, tier: s.tier, industry: s.category || null,
          lastCrawl: null, active: s.active, contentHash: null,
        },
      })
    )
  )

  // Audit log
  await prisma.auditLog.create({ data: { actor: 'system', action: 'seed', entityType: 'system', entityId: 'local', details: `Seeded ${sources.length} real SAP sources. Agent crawler will populate all other data.` } })

  console.log('✅ Seed complete!')
  console.log(`   Sources: ${sources.length}`)
  console.log('   All other data will be created by the 24/7 agent crawler.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

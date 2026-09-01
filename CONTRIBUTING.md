# Contributing to SAIE

Thank you for your interest in contributing to the SAP Automation Intelligence Engine (SAIE)! This document outlines the guidelines and workflow for contributions.

---

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- Git
- Basic familiarity with TypeScript, React, and SQLite/Prisma

### Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/GanTechProject/SAIE.git
cd SAIE

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Add at least one AI API key to .env

# 4. Initialize database
npm run setup

# 5. Start development
# Terminal 1:
npm run server
# Terminal 2:
npm run dev
```

---

## Development Workflow

### Branch Naming

| Type | Prefix | Example |
|------|--------|---------|
| Feature | `feat/` | `feat/add-azure-openai-provider` |
| Bug Fix | `fix/` | `fix/crawl-timeout-handling` |
| Documentation | `docs/` | `docs/update-api-reference` |
| Refactor | `refactor/` | `refactor/scoring-engine` |
| Chore | `chore/` | `chore/update-dependencies` |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Examples:
```
feat(llm): add Azure OpenAI provider support
fix(crawler): handle 429 rate limit with exponential backoff
docs(readme): update environment variable table
refactor(scoring): extract weight configuration to constants
chore(deps): upgrade prisma to 6.20.0
```

### Pull Request Process

1. **Create a focused PR** — One logical change per PR
2. **Write a clear description** — What, why, and how
3. **Reference issues** — `Fixes #123` or `Relates to #456`
4. **Pass checks** — TypeScript compiles, no lint errors
5. **Update documentation** — README, API docs, comments as needed
6. **Request review** — Tag maintainers

---

## Code Standards

### TypeScript

- **Strict mode enabled** — No implicit `any`
- **Explicit return types** for public functions
- **Interfaces over types** for object shapes
- **Zod schemas** for runtime validation (where applicable)

```typescript
// ✅ Good
interface CrawlResult {
  ok: boolean;
  source: Source;
  crawl: CrawlDetails;
}

async function crawlSource(sourceId: string): Promise<CrawlResult> { ... }

// ❌ Avoid
async function crawlSource(sourceId: any) { ... }
```

### React Components

- **Function components** with hooks
- **Colocate types** with component
- **Extract custom hooks** for reusable logic
- **Use `React.memo`** for pure presentational components

```typescript
// ✅ Good
interface DashboardProps {
  data: DashboardData | null;
  loading: boolean;
  onSeed: () => void;
}

export function Dashboard({ data, loading, onSeed }: DashboardProps) {
  // ...
}
```

### API Routes (Hono)

- **Validate input** with Zod or manual checks
- **Handle errors** with try/catch + proper status codes
- **Use Prisma transactions** for multi-model operations
- **Log audit events** for mutations

```typescript
// ✅ Good
app.post('/api/crawl', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { sourceId } = body as { sourceId?: string }

  if (!sourceId) {
    return c.json({ error: 'sourceId required' }, 400)
  }

  try {
    const result = await crawlSource(sourceId)
    return c.json(result)
  } catch (err: any) {
    console.error('[crawl]', err)
    return c.json({ error: err.message }, 500)
  }
})
```

### Database (Prisma)

- **Schema-first** — Modify `schema.prisma`, then `prisma generate`
- **Use transactions** for related writes
- **Select only needed fields** — avoid `include: { all: true }`
- **Index foreign keys** — already configured in schema

---

## Testing

Currently manual testing. When adding features:

1. **Test the happy path** — Verify core functionality works
2. **Test error cases** — Invalid input, network failures, missing config
3. **Verify database state** — Check Prisma Studio or raw SQL
4. **Test with/without LLM** — Ensure fallback behavior works

### Quick Test Commands

```bash
# Health & LLM
curl http://localhost:3001/api/health
curl http://localhost:3001/api/llm/status

# Crawl test
curl -X POST http://localhost:3001/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"sourceId": "<first-source-id>"}'

# Pipeline test
curl -X POST http://localhost:3001/api/scheduler/run-pipeline

# Type check
npx tsc --noEmit
```

---

## Architecture Guidelines

### Adding New LLM Providers

1. Add to `PROVIDER_PRIORITY` in `llm-client.ts`
2. Implement API call (OpenAI-compatible or custom)
3. Add to `supportedProviders` in `custom-routes.ts` `/llm/status`
4. Test with real API key

### Adding New SAP Sources

1. Add to `seed-local.ts` tier arrays
2. Categorize: `tier` (1-6), `type`, `domain`, `category`
3. Run `npm run seed` to verify
4. Monitor first crawl for keyword relevance

### Modifying Scoring

1. Update `scoreFromContent()` in `agent-scheduler.ts`
2. Update `/scoring/weights` endpoint in `custom-routes.ts`
3. Ensure weights sum to 1.0 (excluding penalty)
4. Document rationale in code comments

---

## Documentation

Update these files when relevant:

| Change Type | Files to Update |
|-------------|-----------------|
| New feature | `README.md`, `CONTRIBUTING.md` |
| API change | `README.md` (API reference) |
| Env variable | `.env.example`, `README.md` |
| Schema change | `README.md` (Database section) |
| New script | `package.json`, `README.md` |

---

## Review Criteria

Maintainers will evaluate PRs on:

- ✅ **Correctness** — Solves the stated problem
- ✅ **Type safety** — `tsc --noEmit` passes
- ✅ **Consistency** — Matches existing patterns
- ✅ **Documentation** — Updated for user-facing changes
- ✅ **Security** — No secrets, proper validation
- ✅ **Performance** — No obvious regressions

---

## Questions?

- Open a [Discussion](https://github.com/GanTechProject/SAIE/discussions)
- Check existing [Issues](https://github.com/GanTechProject/SAIE/issues)
- Review the [README](README.md) for architecture overview

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License (same as the project).
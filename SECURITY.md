# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | ✅ Yes    |
| < 2.0   | ❌ No     |

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities via public GitHub issues.**

Instead, please email **security@gantecproject.com** (or create a private security advisory on GitHub) with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for remediation.

---

## Security Considerations

### Secrets Management

| Secret Type | Storage | Rotation |
|-------------|---------|----------|
| AI API Keys | `.env` (gitignored) | Manual |
| SMTP Password | `.env` (gitignored) | Per provider policy |
| Google OAuth2 Tokens | `.env` (gitignored) | Auto-refresh |
| Database | `prisma/dev.db` (gitignored) | N/A |

**Never commit:**
- `.env` files
- API keys
- Passwords
- Private keys
- OAuth tokens
- Database files with production data

### Authentication

Current implementation uses a simple token scheme (base64-encoded email + timestamp). **This is NOT production-ready.**

For production deployment:
- Implement bcrypt password hashing
- Use JWT with short expiry + refresh tokens
- Add rate limiting on auth endpoints
- Implement proper session management
- Add MFA support

### Network Security

| Component | Current | Production Requirement |
|-----------|---------|------------------------|
| Backend binding | `0.0.0.0:3001` | Restrict to private network / load balancer |
| CORS | `*` (all origins) | Restrict to known frontend domains |
| HTTPS | HTTP only | TLS termination at reverse proxy |
| Database | Local file | Encrypted volume + access controls |

### Data Protection

- **SQLite database** contains business intelligence — treat as confidential
- **Audit log** tracks all mutations — protect from tampering
- **Report exports** may contain sensitive findings — encrypt at rest
- **No PII** stored beyond delivery email addresses

### Dependency Security

```bash
# Audit dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated
```

### Content Security

- **Crawled content** from public SAP websites only
- **No authentication** used for source access
- **Rate limited** to 1 request/second per source
- **User-Agent** identifies as SAIE bot
- **Respects robots.txt** (not explicitly implemented — TODO)

---

## Secure Deployment Checklist

- [ ] Generate strong random secrets for all `.env` values
- [ ] Use separate `.env.production` (not committed)
- [ ] Enable HTTPS via reverse proxy (nginx/Caddy/Cloudflare)
- [ ] Restrict backend port to internal network only
- [ ] Configure CORS for production frontend domain only
- [ ] Set up database backup + encryption
- [ ] Enable audit log monitoring/alerting
- [ ] Configure log aggregation (no secrets in logs)
- [ ] Set up vulnerability scanning in CI/CD
- [ ] Document incident response procedure

---

## Known Limitations

| Area | Limitation | Mitigation |
|------|------------|------------|
| Auth | Simple token, no password hash | Replace with proper auth before production |
| TLS | HTTP only | Terminate TLS at reverse proxy |
| CORS | Wildcard | Configure specific origins |
| Rate limiting | None on API | Add middleware (e.g., `hono-rate-limiter`) |
| Input validation | Partial (manual) | Add Zod schemas to all endpoints |
| Secrets in logs | Possible if error objects logged | Sanitize error responses |

---

## Responsible Disclosure Timeline

| Phase | Target |
|-------|--------|
| Acknowledgment | 48 hours |
| Initial Assessment | 5 business days |
| Fix Development | 14 business days (critical), 30 days (non-critical) |
| Patch Release | Within 48 hours of fix |
| Public Disclosure | After patch released + 7 days |

---

## Security Contacts

- **Primary**: security@gantecproject.com
- **GitHub**: [Security Advisories](https://github.com/GanTechProject/SAIE/security/advisories)

---

*Last updated: 2026-09-01*
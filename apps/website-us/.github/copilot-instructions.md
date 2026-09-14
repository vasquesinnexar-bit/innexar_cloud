# Copilot Setup for Site Core Pilates

Follow this repository guidance in order:

1. .github/instructions/*.instructions.md
2. .github/agents/*.agent.md for specialized execution modes
3. .github/skills/*/SKILL.md for domain playbooks
4. .github/rules/* as supplemental operational frameworks

## Repository-Specific Directives

- Preserve Clean Architecture module boundaries in src/modules.
- Keep API behavior aligned with .github/instructions/api-design.instructions.md.
- Enforce OWASP-oriented practices from security-owasp.instructions.md.
- Add or update tests for backend/frontend changes and keep behavior verifiable.
- Prefer small, targeted edits over broad refactors.

## Preferred Specialists

- Next.js routing, rendering, and performance: Next.js Senior Dev
- API and module boundary design: Backend Architect
- Prisma schema evolution and rollout safety: Database Migration Specialist
- Billing/webhook/idempotency hardening: Payment Security Specialist

## Skill Pack Scope

Use curated skills under .github/skills focused on backend, frontend, architecture, testing, security, payments, API design, git workflow, and observability logging.

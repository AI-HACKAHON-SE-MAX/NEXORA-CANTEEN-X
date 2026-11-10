# AI Usage Log

Required by the event rules. Log every meaningful use of AI tools during the build.

## Tools used

| Tool | Used for |
|------|----------|
|  |  |

## Log

| Time | Member | Tool | What it was asked | What was accepted / changed / rejected | How it was verified |
|------|--------|------|-------------------|----------------------------------------|---------------------|
| 2026-11-10 10:14 PK | Repository owner | Codex | Inspect the starter template and begin the CanteenX scaffold from the supplied project brief | Used the product stack, pinned config values, safe error shape, and health-route contract; retained the event template and did not copy the prewritten prompt pack into the repository | Compared the starter tree and Git history with the project brief |
| 2026-11-10 10:58 PK | Repository owner | Codex | Implement the database, shared logic, APIs, and student/staff/admin screens | Added the Supabase schema/seed/reset scripts, order and staff flows, deterministic estimator, analytics, and setup/security docs; automated tests were not added in this pass | `npm run build`, `npm run security:check`, and `git diff --check` passed. Supabase/live/browser flows remain unverified. |

## Reflection

### Where AI helped most

Setting up the application structure and translating the security rules into server-side routes and database functions.

### Where AI was wrong or misleading

The first production build caught a staff-query type mismatch and an incorrect TypeScript assumption about `scrypt`. Both were fixed, and the next build completed. The supplied prompt pack described requirements, but the repository template was checked before changing its files.

### What we did not delegate to AI

No real credentials, staff PIN, student University IDs, or customer data were supplied or put in the repository.

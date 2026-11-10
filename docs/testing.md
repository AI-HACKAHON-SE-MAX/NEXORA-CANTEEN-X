# Testing status

## Commands run

| Check | Result | Notes |
|---|---|---|
| `npm run build` | PASS | Next.js production build and strict TypeScript check passed locally on 2026-11-10. |
| `npm run security:check` | PASS | Source scan found no public server-secret variables. This is a narrow source scan, not a full security audit. |
| `git diff --check` | PASS | No whitespace errors were reported. |
| Automated unit/API tests | NOT RUN | Test files and Vitest setup have not been added. |
| Supabase integration/manual QA | NOT RUN | SQL has not been applied to a project and no credentials/live deployment are configured. |

## Before demo

1. Apply `supabase/schema.sql` and `supabase/seed.sql` in a disposable Supabase project.
2. Configure `.env.local` with dummy/demo secrets and generate the staff PIN hash using `npm run make:pin-hash`.
3. Run `npm run reset:demo`, then start `npm run dev`.
4. On a second browser, sign in at `/staff-login`; place a student order and move it through Preparing, Ready, and Picked Up.
5. Repeat with cancellation, wrong/missing order keys, out-of-stock item, stale staff status update, and a third active order for one dummy ID.
6. Check 360px Chrome and Safari layouts, offline behavior, cleared storage, expired staff cookie, and two-browser status race.
7. Run `npm run build` and `npm run security:check` again after any code changes.

## Known untested areas

Every database RPC/constraint, RLS denial from anon/authenticated, concurrency/race behavior, estimator edge cases, error-response equivalence, staff cookie flags, polling/backoff, 360px phone layout, analytics tie/empty states, and live deployment behavior remain unverified. No estimate accuracy has been measured from real orders.

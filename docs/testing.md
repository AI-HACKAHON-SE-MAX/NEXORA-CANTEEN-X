# Testing status

## Commands run

| Check | Result | Notes |
|---|---|---|
| `npm run build` | PASS | Next.js production build and strict TypeScript check passed locally on 2026-11-10. |
| `npm run security:check` | PASS | Source scan found no public server-secret variables. This is a narrow source scan, not a full security audit. |
| `git diff --check` | PASS | No whitespace errors were reported. |
| CUI ID/name validation | Implemented | Accepts FA/SP CUI registration patterns; names are letters and spaces. |
| Email OTP/device session | Implemented in source | Requires updated Supabase schema and Resend deployment settings before live verification. |
| Photo menu/theme/cart interactions | Implemented in source | Remote image hosts and mobile visual layout still need browser QA. |
| Automated unit/API tests | NOT RUN | Test files and Vitest setup have not been added. |
| Supabase integration/manual QA | NOT RUN | Updated SQL and Resend sender have not been configured for this code revision; the existing Vercel release was not changed. |

## Before demo

1. Apply the updated `supabase/schema.sql` and `supabase/seed.sql` in the Supabase project before deploying these changes.
2. Configure `RESEND_API_KEY` and `STUDENT_OTP_FROM` in Vercel with a verified sender; set the same values in local `.env.local` for OTP QA.
3. Configure `.env.local` with demo secrets and generate the staff PIN hash using `npm run make:pin-hash`.
4. Run `npm run reset:demo`, then start `npm run dev`.
5. Verify OTP signup, reload on the same device without another code, sign in on a second browser with a fresh code, then place an order and move it through the kitchen statuses.
6. Repeat with cancellation, wrong/missing order keys, out-of-stock item, stale staff status update, combo pricing, and a third active order for one CUI-style ID.
7. Check 360px Chrome and Safari layouts, dark/light persistence, offline behavior, cleared storage, expired staff cookie, and two-browser status race.
8. Run `npm run build` and `npm run security:check` again after any code changes.

## Known untested areas

Every database RPC/constraint, OTP email delivery, device-cookie persistence, RLS denial from anon/authenticated, concurrency/race behavior, estimator edge cases, error-response equivalence, staff cookie flags, polling/backoff, 360px phone layout, remote-image availability, analytics tie/empty states, and deployment of this code revision remain unverified. The production URL was not modified during this code pass. No estimate accuracy has been measured from real orders.

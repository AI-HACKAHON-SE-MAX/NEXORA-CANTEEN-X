# Judge Check Map

This map points to the code paths and manual checks for the main security and ordering requirements. Do not treat source inspection as a substitute for live acceptance testing.

| Judge check | Implementation / evidence | Status |
|---|---|---|
| Guessing a pickup token must not expose or cancel another order | `app/api/orders/[id]/route.ts`, `app/api/orders/[id]/cancel/route.ts`, `lib/order-access.ts`; private 256-bit order key checked server-side. | Implemented; wrong-key live negative test should be recorded before judging. |
| Browser clients cannot read other customers' data or write orders directly to tables | `supabase/schema.sql` enables RLS and revokes browser-role table/function grants; app uses server-side Supabase service role. | Implemented in SQL; recheck project grants/policies after schema changes. |
| Order status changes require staff PIN/session | `app/api/staff/login/route.ts`, `lib/session.ts`, `app/api/staff/orders/[id]/status/route.ts`. | Implemented; exercise invalid/missing staff session before judging. |
| Estimates remain sane for empty/busy queues and after step-back | `lib/estimator.ts`; estimator has bounded calibration, robust samples, and step-back exclusion. | Implemented; add measured queue scenarios to `docs/testing.md` after manual verification. |
| Empty cart, invalid quantity, and double submit are rejected | `lib/validation.ts`, `app/api/orders/route.ts`, `components/StudentStorefront.tsx`, transactional RPC in `supabase/schema.sql`. | Implemented; repeat from two tabs/devices before judging. |
| Demo orders work through sign-in, ordering, tracking, and kitchen | `/demo`, `app/api/demo/auth/*`, `app/api/orders/route.ts`, and `components/KitchenDashboard.tsx`. | Smoke-tested live; demo orders are labeled `DEMO` and excluded from sales/prep-time metrics. |

## Known identity limit

Regular email verification proves inbox access only. It does not validate CUI enrollment or bind that inbox to the entered registration number. CUI SSO or an authoritative student roster integration is required for that guarantee.

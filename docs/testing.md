# Testing and Verification Status

## Automated checks

| Check | Latest known result | Notes |
|---|---|---|
| `npx tsc --noEmit --pretty false` | PASS | TypeScript completed without errors after the live-demo integration. |
| `npm run security:check` | PASS | Source scan found no public server-secret variables. This is a narrow source scan, not a full security audit. |
| `git diff --check` | PASS | No whitespace errors on the implementation changes. |
| Automated unit/API suite | NOT CONFIGURED | No unit/API test runner is configured. |
| Concurrent-user/load test | NOT RUN | Capacity is not measured; see [PRODUCT_OVERVIEW.md](../PRODUCT_OVERVIEW.md). |

## Live demo smoke test

On 2026-11-10, against the deployed CanteenX app:

- Demo auth start and verification succeeded using the temporary server-issued code.
- A one-item demo order returned HTTP 201.
- The private order tracker returned `isDemo: true`.
- The order was cancelled immediately after verification so it did not remain in the active kitchen queue. The cancelled row remains marked as a demo order.
- The Supabase `orders.is_demo` column was verified present after applying `supabase/migrations/20261110_demo_orders.sql`.

## Before judging

Manually check these scenarios and record the observed results:

1. Try another order's UUID with a missing/wrong `x-order-key`; reads/cancellation should not reveal it.
2. Try to call staff status routes without a valid staff PIN session; status must not change.
3. Compare an empty queue, a busy queue, and a step-back in the estimate; values should remain bounded and labeled estimates.
4. Submit an empty cart, invalid quantities, and a duplicate submit.
5. Confirm RLS, browser grants, and no public policies directly in the deployed Supabase project.
6. Check 360px mobile layout, dark/light persistence, offline behavior, expired staff session, and two-staff-device status races.

Regular student OTP email still depends on Supabase student auth tables and Resend sender configuration. The temporary demo code does not send email and does not prove CUI enrollment or email ownership.

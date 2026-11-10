# Requirements

## Problem and users

Students lose time waiting in the canteen line between classes. CanteenX gives them a small menu/cart flow and a pickup token so they can arrive after placing an order. Kitchen staff need a live queue with simple status and stock controls. A staff-only admin view summarizes the day.

Primary users: students placing cash-on-pickup orders and canteen staff preparing them. Students do not create accounts; University ID is supplied for the active-order cap and is not verified against campus records.

## Functional requirements

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-01 | Browse menu, build a bounded cart, and submit dummy University ID/name with an idempotency key. Prices and totals are read/recomputed on the server. | Must | Implemented in code; database flow not live-verified |
| FR-02 | Return a pickup label and a private order key once; track the order by UUID + key from the same device. | Must | Implemented in code; not integration-tested |
| FR-03 | Track Received → Preparing → Ready for Pickup → Picked Up, with student cancellation from Received and terminal expiry. | Must | Implemented in code; race behavior not integration-tested |
| FR-04 | Estimate preparation time from own prep, active queue, station count, and recent calibration samples. | Must | Implemented in code; estimator has not been unit-tested |
| FR-05 | Staff can view the active queue, move or step back one status, and toggle item availability. | Must | Implemented in code; staff session/database not live-verified |
| FR-06 | Staff can view daily counts, pickup revenue, top item, hourly orders, average prep duration, and estimate error. | Must | Implemented in code; analytics not live-verified |

## Non-functional requirements

| ID | Category | Requirement | Target | How measured | Result |
|---|---|---|---|---|---|
| NFR-01 | Security | No browser Supabase access or public service-role key. | All DB calls server-side. | Source scan + architecture review. | `security:check` passed; deployment not checked. |
| NFR-02 | Privacy | No customer name, University ID, key/hash, or secret in staff responses/logs. | Zero fields/logs. | Route payload review and automated scan. | Payloads reviewed; automated tests not added. |
| NFR-03 | Race safety | Concurrent order creation/status changes do not exceed caps or overwrite a newer status. | One winner per conditional update; max 2 active per ID. | Supabase concurrency test. | Not run; requires applied schema/database. |
| NFR-04 | Availability | API responses are not cached; database failures return safe errors. | `Cache-Control: no-store`; unavailable maps to 503. | Route review and live outage test. | Code implemented; live outage test not run. |
| NFR-05 | Compatibility | Student and kitchen flows work at narrow mobile width. | 360 CSS px, touch targets at least 44 px. | Manual Chrome/Safari phone QA. | Not yet checked on devices. |
| NFR-06 | Build quality | App compiles under strict TypeScript. | `npm run build` succeeds. | Production build. | Passed locally on 2026-11-10. |

## Constraints and assumptions

- Next.js App Router, TypeScript, Tailwind, Supabase Postgres, Zod, jose, and server-side Supabase access.
- Server environment values must be configured before API workflows work. `supabase/schema.sql` and `seed.sql` must be applied separately.
- Cash is collected at pickup. The pickup token is a label, never an authorization credential.
- Pakistan time (`Asia/Karachi`) defines the order day and hourly analytics.

## Out of scope

Student accounts or university sign-in, payment processing, push notifications, multiple canteens, order editing, and AI-generated prep-time estimates. Gemini menu description generation is optional and not implemented.

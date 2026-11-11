# CanteenX

> Campus canteen ordering and queue management · CUI Islamabad · Team NEXORA

CanteenX lets students order from the campus canteen before they arrive, then track preparation and pickup with a short token. The kitchen team manages the live queue and item availability; staff can review daily operations in the admin view. See [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) for the product summary, architecture, identity limits, and capacity status.

## Current build status

- **Deployment:** <https://nexora-canteen-x-seven.vercel.app>
- **Student demo:** `/demo` uses the live menu and order pipeline with a temporary server-issued code. Demo orders appear in the live kitchen queue with a `DEMO` label and are excluded from sales/prep-time metrics.
- **Verified:** demo sign-in, order creation, tracking, and cancellation were smoke-tested against the deployed app; TypeScript and `npm run security:check` pass.
- **Capacity:** not load-tested. Do not claim a guaranteed concurrent-user limit; see the capacity section in [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md).
- Regular student email OTP requires the Supabase account tables from `supabase/schema.sql` and configured Resend sender settings.

## Judge quick start

1. Open `/demo` for the end-to-end temporary student demo. Enter a CUI-style registration number, name, and any syntactically valid email, request the temporary code shown on screen, then place and track a clearly marked demo order.
2. The live Supabase project must have `supabase/migrations/20261110_demo_orders.sql` applied for demo orders. For a fresh project, apply `supabase/schema.sql` and `supabase/seed.sql` instead.
3. Demo orders appear in the staff kitchen queue with a `DEMO` label. Staff sign in at `/staff-login` and move the order through the queue as usual. Demo mode does not send email or verify CUI enrollment.
4. Regular students use the homepage checkout and receive an emailed OTP when Supabase auth tables and Resend are configured.

## Run locally

### Prerequisites

- Node.js 20.9 or later and npm.
- A Supabase project. The browser never receives the service-role key.

### Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the server environment values, including a Resend API key and verified sender address for student OTP email.
3. Apply the current `supabase/schema.sql`, then `supabase/seed.sql`, in the Supabase SQL editor. Reapply the schema before deploying this account-auth change.
4. Run `npm run make:pin-hash` in an interactive terminal to create the staff PIN salt/hash. The PIN is entered without echo and is not printed.
5. Start the app with `npm run dev` and open `http://localhost:3000`.

### Environment variable names

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ID_HASH_SECRET`, `STAFF_PIN_SALT`, `STAFF_PIN_HASH`, `SESSION_SECRET`, `RESEND_API_KEY`, and `STUDENT_OTP_FROM`; `GEMINI_API_KEY` is optional. Keep values in `.env.local` or the deployment provider’s server-side settings. Never add them to source control.

### Useful commands

- `npm run build` — production compilation and TypeScript check.
- `npm run security:check` — scans source files for public server-secret variables.
- `npm run reset:demo` — clears demo orders/rate limits/token counters and restores the synthetic menu. Refuses to run in production unless invoked manually with `--force`.
- `npm run reset:pin-lockout` — clears only staff PIN rate-limit counters.
- `npm run make:pin-hash` — interactively derives the staff PIN hash.

Automated tests have not been added yet. Do not treat the successful build as proof that database or browser flows work.

## Features

- Student menu, cart, checkout, cash on pickup, and device-local order tracking.
- Status flow: received → preparing → ready for pickup → picked up; cancellation and expiry are terminal states.
- Deterministic queue-aware ready-time estimate, explicitly shown as an estimate.
- Staff kitchen queue, step-back controls, and stock toggles.
- Staff daily metrics for orders, pickup revenue, top item, hourly volume, preparation time, and estimate error.

## Security model

1. Supabase is accessed from server-only code using the service-role key; no `NEXT_PUBLIC_` Supabase keys are used.
2. Every application table has RLS enabled, no policies, and browser-role privileges revoked. Only `service_role` receives table/function access.
3. Pickup tokens are labels only. Order reads/cancellation require a UUID plus the owner’s key in `x-order-key`.
4. Each order key has 256 bits of randomness; only its SHA-256 hash is stored. Invalid owner checks share the same 404 response.
5. CUI registration number format is checked, names accept letters and spaces, and email ownership is confirmed by a one-time code. University IDs are normalized and HMAC-SHA256 hashed. Names are not sent to staff/admin responses.
6. Verified students receive a random, HttpOnly device cookie for 180 days. Each device must verify by email once; the database stores only the device-token hash. Emails and registrations are uniquely bound after verification.
7. The staff PIN is scrypt-verified on the server with a salt. Staff sessions are signed HS256 JWTs in HttpOnly, SameSite=Strict cookies; every staff API handler checks the session.
8. The server validates input, reads menu prices itself, and creates an order with an atomic database function. The Study Break combo discount is calculated and applied in the database, not trusted from the browser. State updates are conditional on the expected current status.
9. Errors and logs do not include request bodies, personal data, PINs, keys, hashes, or stack traces. `.env.local` is ignored by Git.

## Estimator

For each cart line, preparation work is `base + (quantity - 1) × base × 0.5`, with a 3-minute default for missing/non-positive prep times. Queue work ahead is divided by the configured station count (2 by default); preparing orders count at half remaining work and ready orders count as zero. A calibration factor uses the median actual/estimated ratio from up to 10 non-stepped-back completed orders in the last 60 minutes, after clamping ratios to 0.5–2.0 and the resulting factor to 0.8–1.5. The display is capped at 60 minutes (`60+`). The value is an estimate, not a promise.

## Known limitations

- The CUI registration-number pattern and email OTP verify format and inbox access, but do not prove that the inbox belongs to the entered registration number. Authoritative identity binding needs CUI SSO or a university roster integration.
- If browser storage is cleared or the order key is lost, the order cannot be tracked on that device; staff can still serve by pickup token.
- IP rate limits may affect multiple students behind a shared campus network.
- Supabase must be configured and the current SQL applied before student login and ordering work. Resend must have a verified sender. Real-device checks and automated tests remain outstanding.

## Documentation

- [Product overview, architecture, and capacity](PRODUCT_OVERVIEW.md)
- [Requirements](docs/requirements.md)
- [Design](docs/design.md)
- [Testing status](docs/testing.md)
- [Judge check map](docs/judge-checks.md)
- [AI usage log](docs/ai-usage-log.md)
- [Submission checklist](SUBMISSION.md)

# CanteenX — Product Overview

**Team:** NEXORA  
**Product:** CanteenX campus canteen ordering and queue management  
**Campus:** CUI Islamabad  
**Live app:** <https://nexora-canteen-x-seven.vercel.app>

## What it is

CanteenX is a web app for ordering campus canteen food ahead of pickup. Students browse the current menu, build a cart, place a cash-on-pickup order, and track preparation on the device used to order. Kitchen staff use a live queue to accept, prepare, and mark orders ready or picked up. Admin staff review daily operational metrics.

## What it does

- Shows the current menu, prices, availability, search, categories, and student deals.
- Verifies a student's email with a one-time code for the regular ordering flow, then remembers that browser device.
- Creates orders on the server using current database prices and availability, with duplicate-submit protection, quantity limits, and an active-order limit per hashed CUI registration number.
- Gives each order a pickup token and a separate unguessable tracking key. The token is a counter label; the tracking key controls order access.
- Estimates a ready time from item preparation times and the active queue. It is an estimate, not a promise.
- Lets kitchen staff update order states and stock after server-side staff PIN authentication.
- Provides daily metrics for real orders. Temporary demo orders are clearly marked in the kitchen and excluded from sales and preparation-time metrics.

## Architecture

```text
Student browser ──HTTPS──> Next.js app and server routes on Vercel
                                  │
                                  ├── Supabase Postgres via server-only service role
                                  │     ├── menu, orders, order items
                                  │     ├── student/device/OTP records
                                  │     ├── rate limits and token counters
                                  │     └── atomic order-creation SQL function
                                  │
                                  └── Resend email API for regular student OTP

Staff browser ──HTTPS──> PIN-protected Next.js staff APIs ──> Supabase
```

The browser never receives the Supabase service-role key. Database access is performed by server routes; row-level security is enabled and browser database privileges are revoked. Student order tracking uses a private order key held by the ordering device. Kitchen/admin APIs require a signed staff session created after PIN verification.

## Demo behavior

`/demo` exercises the current menu, cart, temporary-code student sign-in, order creation, order tracker, and shared kitchen queue. The short-lived demo code is returned only from the server demo endpoint and shown in the demo screen; no email is sent. Demo orders are real queue records and carry a **DEMO** label so staff can identify them. They are excluded from sales and preparation-time analytics. Do not use demo orders as real food requests.

## Capacity

**Measured capacity: not established.** We have not run a concurrent-user or load test, and the effective limit depends on the Vercel deployment, Supabase project tier, database connection/compute limits, and email-provider limits. The architecture is suitable for a small campus pilot, but no guaranteed number of concurrent users should be claimed until a load test is run against the deployed plans. A reasonable next validation target is **50 concurrent student sessions** with staff queue polling enabled, followed by higher-load tests while watching API latency, database utilization, and rate-limit behavior.

## Identity and known limits

Regular sign-in checks the CUI-style registration-number format and verifies access to the entered email inbox. It does **not** validate student enrollment or prove that the email belongs to that CUI ID; authoritative identity binding requires CUI SSO or a university roster integration. Demo login is intentionally temporary and does not verify email ownership or enrollment.

## Repository documentation

- [README](README.md) — setup, deployment, and commands
- [Requirements](docs/requirements.md)
- [Design](docs/design.md)
- [Testing status](docs/testing.md)
- [Demo mode](docs/DEMO_MODE.md)
- [AI usage log](docs/ai-usage-log.md)
- [Submission checklist](SUBMISSION.md)

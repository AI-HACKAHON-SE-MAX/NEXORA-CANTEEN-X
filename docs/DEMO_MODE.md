# CanteenX live system demo

The `/demo` page uses the same menu, cart, checkout, order creation, tracking, and kitchen status routes as the student app. Demo sign-in displays a short-lived one-time code instead of sending email. This confirms the demo flow only; it does not verify a student's email ownership or CUI enrollment.

Demo sessions are signed, short-lived, and separate from regular student device sessions. Demo orders use the existing transactional order flow and appear in the live kitchen queue with a `DEMO` label. Demo orders are excluded from sales and prep-time analytics. Staff PIN protection and the order's private tracking key still apply.

## Database setup

Before deploying this version, run [`supabase/migrations/20261110_demo_orders.sql`](../supabase/migrations/20261110_demo_orders.sql) in the Supabase SQL Editor for the production project. The migration adds a `is_demo` flag with a safe `false` default for existing orders and adds the RPC overload used to create flagged orders. It is safe to run more than once.

For a fresh Supabase project, run [`supabase/schema.sql`](../supabase/schema.sql) instead; it includes the same demo-order support.

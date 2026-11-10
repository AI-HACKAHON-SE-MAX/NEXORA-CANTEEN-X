"use client";

import { useCallback, useEffect, useState } from "react";
import { POLL_SECONDS } from "@/lib/config-values";
import { CanteenHeader } from "@/components/CanteenHeader";

type SavedOrder = { id: string; key: string; token: string; createdAt: string; status?: string };
type OrderDetails = {
  token: string;
  status: "received" | "preparing" | "ready" | "picked_up" | "cancelled" | "expired";
  items: Array<{ name: string; quantity: number }>;
  total: number;
  estimatedMinutes: number | null;
  estimatedReadyAt: string | null;
  serverTime: string;
  createdAt: string;
};

const terminal = new Set(["picked_up", "cancelled", "expired"]);
const labels: Record<OrderDetails["status"], string> = {
  received: "Received",
  preparing: "Preparing",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  cancelled: "Cancelled",
  expired: "Expired",
};
const stages: OrderDetails["status"][] = ["received", "preparing", "ready", "picked_up"];

function money(amount: number): string {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);
}

function loadOrders(): SavedOrder[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("cx_orders") ?? "[]");
    if (!Array.isArray(value)) return [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const valid = value.filter((order): order is SavedOrder =>
      order && typeof order.id === "string" && typeof order.key === "string" &&
      typeof order.token === "string" && typeof order.createdAt === "string" && Number.isFinite(new Date(order.createdAt).getTime()) &&
      !(terminal.has(String(order.status ?? "")) && new Date(order.createdAt).getTime() < cutoff),
    ).slice(0, 5);
    if (valid.length !== value.length) localStorage.setItem("cx_orders", JSON.stringify(valid));
    return valid;
  } catch {
    return [];
  }
}

function saveStatus(orderId: string, status: string) {
  try {
    const saved = loadOrders().map((order) => order.id === orderId ? { ...order, status } : order);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const kept = saved.filter((order) => !(terminal.has(order.status ?? "") && new Date(order.createdAt).getTime() < cutoff));
    localStorage.setItem("cx_orders", JSON.stringify(kept));
  } catch {
    // The screen continues to work for this visit if browser storage is disabled.
  }
}

export function MyOrders() {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOrders(loadOrders());
    setLoaded(true);
    setOffline(!navigator.onLine);
    const online = () => setOffline(false);
    const offlineEvent = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineEvent);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineEvent);
    };
  }, []);

  if (!loaded) return <main className="cx-page cx-orders-page"><div className="cx-loading-panel" role="status"><span className="cx-spinner" />Loading your orders…</div></main>;
  return (
    <main className="cx-page cx-orders-page">
      {offline && <div role="status" className="cx-offline">You’re offline. Showing saved order details.</div>}
      <CanteenHeader links={[{ href: "/", label: "Menu" }, { href: "/order", label: "My orders", active: true }]} />
      <section className="cx-orders-shell">
        <div className="cx-orders-heading">
          <div><span className="cx-eyebrow">PICKUP TRACKER</span><h1>My orders<span>.</span></h1><p>Keep this page open for live updates. Show your pickup token at the counter.</p></div>
          <div className="cx-live-pill"><i /> Live updates <b>every {POLL_SECONDS}s</b></div>
        </div>
        {orders.length === 0 ? (
          <div className="cx-orders-empty">
            <span className="cx-empty-icon" aria-hidden="true">✦</span>
            <h2>No orders on this device yet.</h2>
            <p>If you ordered on another device or cleared browser storage, show your pickup token to the counter staff.</p>
            <a href="/" className="cx-primary-link">Browse today’s menu <ArrowIcon /></a>
          </div>
        ) : <div className="cx-orders-list">{orders.map((order) => <OrderCard key={order.id} order={order} />)}</div>}
        <p className="cx-orders-footnote">Your tracking key stays in this browser. Pickup tokens are labels, so keep yours private until pickup.</p>
      </section>
    </main>
  );
}

function ArrowIcon() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function OrderCard({ order }: { order: SavedOrder }) {
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [message, setMessage] = useState("");
  const [missing, setMissing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible" || terminal.has(details?.status ?? order.status ?? "")) return;
    const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
      cache: "no-store",
      headers: { "x-order-key": order.key },
    });
    if (response.status === 404) {
      setMissing(true);
      return;
    }
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json() as OrderDetails;
    setDetails(body);
    setOffset(new Date(body.serverTime).getTime() - Date.now());
    setMessage("");
    saveStatus(order.id, body.status);
  }, [details?.status, order.id, order.key, order.status]);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    let failures = 0;
    const schedule = (delay: number) => {
      if (stopped || document.visibilityState !== "visible" || terminal.has(details?.status ?? order.status ?? "")) return;
      timer = window.setTimeout(run, delay);
    };
    const run = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        await poll();
        failures = 0;
        if (!missing && !terminal.has(details?.status ?? order.status ?? "")) schedule(POLL_SECONDS * 1000);
      } catch {
        failures += 1;
        setMessage("We couldn't refresh this order. Retrying shortly.");
        schedule(Math.min(30_000, POLL_SECONDS * 1000 * 2 ** (failures - 1)));
      }
    };
    const visibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (timer) window.clearTimeout(timer);
        void run();
      } else if (timer) {
        window.clearTimeout(timer);
      }
    };
    void run();
    document.addEventListener("visibilitychange", visibilityChange);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, [details?.status, missing, order.status, poll]);

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function cancel() {
    if (!details || details.status !== "received" || cancelling) return;
    if (!window.confirm("Cancel this order? The kitchen may already be preparing it.")) return;
    setCancelling(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: "POST",
        headers: { "x-order-key": order.key },
      });
      if (response.status === 409) {
        await poll();
        setMessage("The order changed before it could be cancelled. Status refreshed.");
      } else if (response.status === 404) {
        setMissing(true);
      } else if (!response.ok) {
        setMessage("Couldn't cancel right now. Please try again.");
      } else {
        await poll();
      }
    } catch {
      setMessage("Couldn't reach the canteen. Check your connection and try again.");
    } finally {
      setCancelling(false);
    }
  }

  if (missing) return <article className="cx-order-card cx-order-missing" role="alert"><p className="cx-order-caption">Pickup token</p><p className="cx-order-token">{order.token}</p><p>We can’t find this order on this device. Show the token to the counter staff.</p></article>;
  const status = details?.status ?? (order.status as OrderDetails["status"] | undefined);
  const index = status ? stages.indexOf(status) : -1;
  const remainingMs = details?.estimatedReadyAt ? new Date(details.estimatedReadyAt).getTime() - (tick + offset) : null;
  const itemCount = details?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const isLate = remainingMs !== null && remainingMs <= 0 && status !== "ready";

  return (
    <article className={`cx-order-card${status === "ready" ? " is-ready" : ""}`}>
      <div className="cx-order-card-head">
        <div><p className="cx-order-caption">Pickup token</p><p className="cx-order-token">{order.token}</p><p className="cx-order-status" aria-live="polite"><i className={`cx-status-dot ${status ?? "pending"}`} />{status ? labels[status] : "Checking status…"}</p></div>
        {details && <div className="cx-order-eta"><p>Ready-time estimate</p><strong>{status === "ready" ? "Ready now" : terminal.has(status ?? "") ? "—" : isLate ? "Any moment now" : (details.estimatedMinutes ?? 0) >= 60 ? "60+ minutes" : `About ${details.estimatedMinutes} min`}</strong>{remainingMs !== null && remainingMs > 0 && remainingMs < 60 * 60_000 && status !== "ready" && !terminal.has(status ?? "") && <span>~{Math.ceil(remainingMs / 60_000)} min remaining</span>}</div>}
      </div>

      {status && !terminal.has(status) && <ol className="cx-order-progress" aria-label="Order progress">
        {stages.map((stage, stageIndex) => {
          const complete = index >= stageIndex;
          return <li key={stage} className={complete ? stageIndex < index ? "complete passed" : "complete" : ""}><div>{complete ? "✓" : stageIndex + 1}</div><p>{labels[stage]}</p></li>;
        })}
      </ol>}

      {details && <>
        <div className="cx-order-items">
          <div className="cx-order-items-title"><h2>Your items</h2><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span></div>
          <ul>{details.items.map((item, itemIndex) => <li key={`${item.name}-${itemIndex}`}><span>{item.quantity} × {item.name}</span></li>)}</ul>
          <div className="cx-order-total"><span>Total due at pickup</span><strong>{money(details.total)}</strong></div>
        </div>
        {status === "received" && <button disabled={cancelling} onClick={() => void cancel()} className="cx-danger-button">{cancelling ? "Cancelling…" : "Cancel order"}</button>}
      </>}
      {message && <p role="status" className="cx-inline-notice">{message}</p>}
      {!details && !message && <p className="cx-order-loading" role="status"><span className="cx-spinner" />Checking for an update…</p>}
    </article>
  );
}

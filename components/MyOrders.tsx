"use client";

import { useCallback, useEffect, useState } from "react";
import { POLL_SECONDS } from "@/lib/config-values";

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

  if (!loaded) return <main className="min-h-screen bg-[#fffaf2] p-6" role="status">Loading your orders…</main>;
  return (
    <main className="min-h-screen bg-[#fffaf2] text-stone-950">
      {offline && <div role="status" className="bg-stone-900 px-4 py-2 text-center text-sm font-semibold text-white">You're offline. Showing saved order details.</div>}
      <header className="border-b border-amber-100 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6"><a href="/" className="text-xl font-black">Canteen<span className="text-orange-700">X</span></a><a href="/" className="min-h-11 rounded-full px-4 py-2 text-sm font-bold text-stone-700 hover:bg-amber-100">Back to menu</a></div></header>
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-orange-700">Pickup tracker</p>
        <h1 className="mt-1 text-3xl font-black sm:text-4xl">My orders</h1>
        <p className="mt-3 max-w-xl text-stone-600">Keep this page open to see updates. Show your pickup token to the counter staff.</p>
        {orders.length === 0 ? (
          <div className="mt-7 rounded-2xl border border-amber-100 bg-white p-6 text-stone-700">
            <p className="font-semibold">No orders are saved on this device.</p>
            <p className="mt-2 text-sm text-stone-600">If you placed an order on another device or cleared browser storage, show your pickup token to the counter staff.</p>
            <a href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-orange-700 px-4 font-bold text-white">Browse menu</a>
          </div>
        ) : <div className="mt-7 space-y-5">{orders.map((order) => <OrderCard key={order.id} order={order} />)}</div>}
      </section>
    </main>
  );
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

  if (missing) return <article className="rounded-2xl border border-amber-200 bg-white p-6" role="alert"><p className="font-bold">Order {order.token}</p><p className="mt-2 text-sm text-stone-600">We can't find this order on this device. Show your token to the counter staff.</p></article>;
  const status = details?.status ?? (order.status as OrderDetails["status"] | undefined);
  const index = status ? stages.indexOf(status) : -1;
  const remainingMs = details?.estimatedReadyAt ? new Date(details.estimatedReadyAt).getTime() - (tick + offset) : null;
  const isLate = remainingMs !== null && remainingMs <= 0 && status !== "ready";

  return (
    <article className="rounded-2xl border border-amber-100 bg-white p-5 shadow-[0_3px_20px_rgba(60,40,10,0.04)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-500">Pickup token</p><p className="mt-1 text-4xl font-black tracking-wider text-orange-800">{order.token}</p><p className="mt-2 text-sm font-semibold" aria-live="polite">{status ? labels[status] : "Checking status…"}</p></div>
        {details && <div className="rounded-xl bg-amber-50 px-4 py-3 text-right"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Ready-time estimate</p><p className="mt-1 text-lg font-extrabold text-stone-900">{status === "ready" ? "Ready now" : terminal.has(status ?? "") ? "—" : isLate ? "Any moment now" : (details.estimatedMinutes ?? 0) >= 60 ? "60+ minutes" : `About ${details.estimatedMinutes} min`}</p>{remainingMs !== null && remainingMs > 0 && remainingMs < 60 * 60_000 && status !== "ready" && !terminal.has(status ?? "") && <p className="mt-1 text-xs text-stone-500">~{Math.ceil(remainingMs / 60_000)} min remaining</p>}</div>}
      </div>

      {status && !terminal.has(status) && <ol className="mt-7 grid grid-cols-4 gap-2" aria-label="Order progress">
        {stages.map((stage, stageIndex) => {
          const complete = index >= stageIndex;
          return <li key={stage} className="text-center"><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${complete ? "bg-orange-700 text-white" : "bg-stone-100 text-stone-500"}`}>{complete ? "✓" : stageIndex + 1}</div><p className={`mt-2 text-[11px] font-semibold sm:text-xs ${complete ? "text-stone-900" : "text-stone-500"}`}>{labels[stage]}</p></li>;
        })}
      </ol>}

      {details && <>
        <div className="mt-6 border-t border-stone-100 pt-4">
          <h2 className="text-sm font-bold text-stone-700">Your items</h2>
          <ul className="mt-2 space-y-2 text-sm">{details.items.map((item, itemIndex) => <li key={`${item.name}-${itemIndex}`} className="flex justify-between gap-3"><span>{item.quantity} × {item.name}</span><span className="text-stone-600">{itemIndex === 0 ? money(details.total) : ""}</span></li>)}</ul>
          <p className="mt-3 text-xs text-stone-500">Pay {money(details.total)} in cash at pickup.</p>
        </div>
        {status === "received" && <button disabled={cancelling} onClick={() => void cancel()} className="mt-5 min-h-11 rounded-xl border border-red-200 px-4 font-bold text-red-800 hover:bg-red-50 disabled:opacity-60">{cancelling ? "Cancelling…" : "Cancel order"}</button>}
      </>}
      {message && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">{message}</p>}
      {!details && !message && <p className="mt-5 text-sm text-stone-500" role="status">Checking for an update…</p>}
    </article>
  );
}

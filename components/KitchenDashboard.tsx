"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { POLL_SECONDS } from "@/lib/config-values";
import { CanteenHeader } from "@/components/CanteenHeader";

type QueueOrder = {
  id: string;
  token: string;
  status: "received" | "preparing" | "ready";
  isDemo: boolean;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
  estimatedReadyAt: string;
};
type StockItem = { id: string; name: string; price: number; isAvailable: boolean };

const statusLabels = { received: "Received", preparing: "Preparing", ready: "Ready for pickup" };

function time(value: string): string {
  return new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" }).format(new Date(value));
}

export function KitchenDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [moreCount, setMoreCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [queueResponse, menuResponse] = await Promise.all([
      fetch("/api/staff/orders", { cache: "no-store" }),
      fetch("/api/staff/menu", { cache: "no-store" }),
    ]);
    if (queueResponse.status === 401 || menuResponse.status === 401) {
      router.replace("/staff-login");
      return;
    }
    if (!queueResponse.ok || !menuResponse.ok) throw new Error("unavailable");
    const [queue, menu] = await Promise.all([
      queueResponse.json() as Promise<{ orders: QueueOrder[]; moreCount: number }>,
      menuResponse.json() as Promise<{ items: StockItem[] }>,
    ]);
    setOrders(queue.orders);
    setMoreCount(queue.moreCount);
    setStock(menu.items);
    setMessage("");
  }, [router]);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    let failures = 0;
    const schedule = (delay: number) => {
      if (!stopped && document.visibilityState === "visible") timer = window.setTimeout(run, delay);
    };
    const run = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        await refresh();
        failures = 0;
      } catch {
        failures += 1;
        setMessage("Connection lost. Keeping the last queue and retrying.");
      } finally {
        setLoading(false);
        schedule(failures ? Math.min(30_000, POLL_SECONDS * 1000 * 2 ** (failures - 1)) : POLL_SECONDS * 1000);
      }
    };
    const visibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (timer) window.clearTimeout(timer);
        void run();
      } else if (timer) window.clearTimeout(timer);
    };
    const onOnline = () => { setOffline(false); void run(); };
    const onOffline = () => setOffline(true);
    setOffline(!navigator.onLine);
    void run();
    document.addEventListener("visibilitychange", visibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  async function changeStatus(order: QueueOrder, to: string) {
    if (busy) return;
    setBusy(order.id);
    setMessage("");
    try {
      const response = await fetch(`/api/staff/orders/${encodeURIComponent(order.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: order.status, to }),
      });
      if (response.status === 401) {
        router.replace("/staff-login");
        return;
      }
      if (response.status === 409) {
        setMessage("This order changed on another device. The queue has been refreshed.");
        await refresh();
        return;
      }
      if (!response.ok) throw new Error("update");
      await refresh();
    } catch {
      setMessage("Couldn't update the order. Refreshing the queue before you try again.");
      try { await refresh(); } catch { /* Keep the latest queue visible while offline. */ }
    } finally {
      setBusy(null);
    }
  }

  async function toggleStock(item: StockItem) {
    const key = `stock:${item.id}`;
    if (busy) return;
    setBusy(key);
    setMessage("");
    try {
      const response = await fetch(`/api/staff/menu/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      if (response.status === 401) {
        router.replace("/staff-login");
        return;
      }
      if (!response.ok) throw new Error("stock");
      setStock((current) => current.map((entry) => entry.id === item.id ? { ...entry, isAvailable: !item.isAvailable } : entry));
    } catch {
      setMessage("Couldn't change stock status. Please retry.");
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    try { await fetch("/api/staff/logout", { method: "POST" }); } catch { /* The page is leaving either way. */ }
    router.replace("/staff-login");
  }

  const receivedCount = orders.filter((order) => order.status === "received").length;
  const preparingCount = orders.filter((order) => order.status === "preparing").length;
  const readyCount = orders.filter((order) => order.status === "ready").length;

  return (
    <main className="cx-page cx-ops-page">
      {offline && <div role="status" className="cx-offline">Offline · showing the last queue data</div>}
      <CanteenHeader links={[{ href: "/kitchen", label: "Kitchen", active: true }, { href: "/admin", label: "Analytics" }]} actionLabel="Log out" onAction={() => void logout()} />
      <section className="cx-ops-shell">
        <div className="cx-ops-heading">
          <div><span className="cx-eyebrow">CANTEEN OPERATIONS</span><h1>Kitchen queue<span>.</span></h1><p>Keep orders moving from receipt to pickup.</p></div>
          <div className="cx-queue-count"><strong>{orders.length + moreCount}</strong><span>active orders</span></div>
        </div>

        <div className="cx-queue-summary" aria-label="Queue status summary">
          <QueueCount label="New" count={receivedCount} tone="orange" />
          <QueueCount label="Preparing" count={preparingCount} tone="gold" />
          <QueueCount label="Ready" count={readyCount} tone="green" />
        </div>

        {message && <p role="status" className="cx-alert cx-alert-warm">{message}</p>}
        <div className="cx-kitchen-layout">
          <section className="cx-queue-section" aria-labelledby="queue-title">
            <div className="cx-panel-heading cx-queue-heading"><div><span className="cx-eyebrow">LIVE QUEUE</span><h2 id="queue-title">Orders to prepare</h2></div><span className="cx-panel-badge">Auto-updates</span></div>
            {loading ? <div className="cx-loading-panel" role="status"><span className="cx-spinner" />Loading the kitchen queue…</div> : orders.length === 0 ? <div className="cx-queue-empty"><span className="cx-empty-icon" aria-hidden="true">✓</span><h3>All caught up.</h3><p>New student orders will appear here automatically.</p></div> : (
              <div className="cx-queue-list">
                {orders.map((order) => <article key={order.id} className={`cx-kitchen-order cx-kitchen-${order.status}`}>
                  <div className="cx-kitchen-order-head"><div><p className="cx-order-caption">Pickup token {order.isDemo && <span className="cx-demo-order-tag">DEMO</span>}</p><p className="cx-kitchen-token">{order.token}</p></div><div className="cx-kitchen-status-block"><span className={`cx-status-badge ${order.status}`}>{statusLabels[order.status]}</span><small>Received {time(order.createdAt)}</small></div></div>
                  <div className="cx-kitchen-items"><p>Order items</p><ul>{order.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.quantity} ×</span><strong>{item.name}</strong></li>)}</ul></div>
                  <div className="cx-kitchen-order-bottom"><div className="cx-kitchen-estimate"><span>Estimated ready</span><strong>{time(order.estimatedReadyAt)}</strong></div><div className="cx-kitchen-actions">
                    {order.status === "received" && <button disabled={busy !== null} onClick={() => void changeStatus(order, "preparing")} className="cx-action-button primary">Start preparing <ArrowIcon /></button>}
                    {order.status === "preparing" && <><button disabled={busy !== null} onClick={() => void changeStatus(order, "ready")} className="cx-action-button ready">Mark ready <CheckIcon /></button><button disabled={busy !== null} onClick={() => void changeStatus(order, "received")} className="cx-action-button secondary">Step back</button></>}
                    {order.status === "ready" && <><button disabled={busy !== null} onClick={() => void changeStatus(order, "picked_up")} className="cx-action-button picked">Mark picked up <CheckIcon /></button><button disabled={busy !== null} onClick={() => void changeStatus(order, "preparing")} className="cx-action-button secondary">Step back</button></>}
                  </div></div>
                </article>)}
                {moreCount > 0 && <p className="cx-more-orders">{moreCount} more active order{moreCount === 1 ? "" : "s"} not shown.</p>}
              </div>
            )}
          </section>

          <aside className="cx-stock-panel">
            <div className="cx-panel-heading"><div><span className="cx-eyebrow">MENU CONTROL</span><h2>Stock status</h2><p>Changes affect new orders only.</p></div><span className="cx-stock-count">{stock.filter((item) => item.isAvailable).length}/{stock.length}</span></div>
            {stock.length === 0 && loading ? <div className="cx-stock-loading"><span className="cx-spinner" />Loading menu…</div> : <div className="cx-stock-list">{stock.map((item) => <div key={item.id} className="cx-stock-row"><div><strong>{item.name}</strong><span className={item.isAvailable ? "available" : "unavailable"}><i />{item.isAvailable ? "Available" : "Out of stock"}</span></div><button disabled={busy !== null} onClick={() => void toggleStock(item)} className={`cx-stock-toggle ${item.isAvailable ? "on" : "off"}`} aria-label={`${item.isAvailable ? "Mark out of stock" : "Mark in stock"}: ${item.name}`} aria-pressed={item.isAvailable}><span /></button></div>)}</div>}
          </aside>
        </div>
        <p className="cx-ops-footnote">Status updates are shared with students tracking their order.</p>
      </section>
    </main>
  );
}

function QueueCount({ label, count, tone }: { label: string; count: number; tone: "orange" | "gold" | "green" }) {
  return <div className="cx-queue-count-card"><span className={`cx-queue-count-dot ${tone}`} /><div><strong>{count}</strong><span>{label}</span></div></div>;
}

function ArrowIcon() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

function CheckIcon() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>;
}

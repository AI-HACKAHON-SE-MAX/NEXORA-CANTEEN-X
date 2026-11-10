"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { POLL_SECONDS } from "@/lib/config-values";

type QueueOrder = {
  id: string;
  token: string;
  status: "received" | "preparing" | "ready";
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

  return (
    <main className="min-h-screen bg-[#f5f5f0] text-stone-950">
      {offline && <div role="status" className="bg-stone-950 px-4 py-2 text-center text-sm font-semibold text-white">Offline · showing the last queue data</div>}
      <header className="border-b border-stone-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><div><a href="/" className="text-lg font-black">Canteen<span className="text-orange-700">X</span></a><span className="ml-3 hidden text-sm font-medium text-stone-500 sm:inline">Kitchen dashboard</span></div><div className="flex items-center gap-2"><a href="/admin" className="min-h-11 rounded-xl px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100">Analytics</a><button onClick={() => void logout()} className="min-h-11 rounded-xl border border-stone-300 px-3 text-sm font-bold">Log out</button></div></div></header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px] lg:py-9">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Live queue</p><h1 className="mt-1 text-3xl font-black">Orders to prepare</h1></div><span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-700">{orders.length + moreCount} active</span></div>
          {message && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950">{message}</p>}
          {loading ? <p className="mt-6 rounded-2xl bg-white p-6 text-stone-600" role="status">Loading the kitchen queue…</p> : orders.length === 0 ? <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-8"><h2 className="text-xl font-extrabold">Queue is clear</h2><p className="mt-2 text-stone-600">New student orders will appear here automatically.</p></div> : (
            <div className="mt-6 space-y-4">
              {orders.map((order) => <article key={order.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Pickup token</p><p className="mt-1 text-3xl font-black tracking-wider text-orange-800">{order.token}</p></div><div className="text-right"><span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-950">{statusLabels[order.status]}</span><p className="mt-2 text-xs text-stone-500">Received {time(order.createdAt)}</p></div></div>
                <ul className="mt-5 space-y-2 border-t border-stone-100 pt-4">{order.items.map((item, index) => <li key={`${item.name}-${index}`} className="flex justify-between gap-3 text-sm"><span className="font-semibold">{item.quantity} × {item.name}</span></li>)}</ul>
                <p className="mt-4 text-sm text-stone-600">Ready-time estimate: <strong className="text-stone-900">{time(order.estimatedReadyAt)}</strong></p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {order.status === "received" && <button disabled={busy !== null} onClick={() => void changeStatus(order, "preparing")} className="min-h-11 flex-1 rounded-xl bg-orange-700 px-4 font-bold text-white disabled:opacity-50">Start preparing</button>}
                  {order.status === "preparing" && <><button disabled={busy !== null} onClick={() => void changeStatus(order, "ready")} className="min-h-11 flex-1 rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-50">Mark ready</button><button disabled={busy !== null} onClick={() => void changeStatus(order, "received")} className="min-h-11 rounded-xl border border-stone-300 px-4 font-bold disabled:opacity-50">Step back</button></>}
                  {order.status === "ready" && <><button disabled={busy !== null} onClick={() => void changeStatus(order, "picked_up")} className="min-h-11 flex-1 rounded-xl bg-stone-950 px-4 font-bold text-white disabled:opacity-50">Mark picked up</button><button disabled={busy !== null} onClick={() => void changeStatus(order, "preparing")} className="min-h-11 rounded-xl border border-stone-300 px-4 font-bold disabled:opacity-50">Step back</button></>}
                </div>
              </article>)}
              {moreCount > 0 && <p className="rounded-xl bg-stone-200 p-3 text-center text-sm font-semibold text-stone-700">{moreCount} more active order{moreCount === 1 ? "" : "s"} not shown.</p>}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Menu control</p><h2 className="mt-1 text-xl font-black">Stock status</h2><p className="mt-2 text-sm text-stone-600">Turning an item off only affects new orders.</p>
          <div className="mt-4 divide-y divide-stone-100">{stock.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold">{item.name}</p><p className="text-xs text-stone-500">{item.isAvailable ? "Available" : "Out of stock"}</p></div><button disabled={busy !== null} onClick={() => void toggleStock(item)} className={`min-h-11 rounded-xl px-3 text-xs font-bold disabled:opacity-50 ${item.isAvailable ? "border border-stone-300 text-stone-700" : "bg-orange-700 text-white"}`}>{item.isAvailable ? "Mark out" : "Mark in stock"}</button></div>)}</div>
        </aside>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Analytics = {
  day: string;
  ordersTotal: number;
  completedCount: number;
  cancelledCount: number;
  expiredCount: number;
  revenue: number;
  topItem: { name: string; quantity: number } | null;
  ordersPerHour: Array<{ hour: number; count: number }>;
  avgActualPrepMinutes: number | null;
  estimateAccuracy: number | null;
};

function money(amount: number): string {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);
}

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setError("");
    try {
      const response = await fetch("/api/staff/analytics", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/staff-login");
        return;
      }
      if (!response.ok) throw new Error("analytics");
      setData(await response.json() as Analytics);
    } catch {
      setError("Analytics are temporarily unavailable. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function logout() {
    try { await fetch("/api/staff/logout", { method: "POST" }); } catch { /* The page is leaving either way. */ }
    router.replace("/staff-login");
  }

  return (
    <main className="min-h-screen bg-[#f5f5f0] text-stone-950">
      <header className="border-b border-stone-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"><div><a href="/" className="text-lg font-black">Canteen<span className="text-orange-700">X</span></a><span className="ml-3 hidden text-sm font-medium text-stone-500 sm:inline">Today’s analytics</span></div><div className="flex items-center gap-2"><a href="/kitchen" className="min-h-11 rounded-xl px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-100">Kitchen</a><button onClick={() => void logout()} className="min-h-11 rounded-xl border border-stone-300 px-3 text-sm font-bold">Log out</button></div></div></header>
      <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">Admin overview</p><h1 className="mt-1 text-3xl font-black">Today at the canteen</h1>{data && <p className="mt-2 text-sm text-stone-500">Karachi date · {data.day}</p>}</div><button onClick={() => void refresh()} className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-bold">Refresh</button></div>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">{error}</p>}
        {loading ? <p className="mt-6 rounded-2xl bg-white p-6 text-stone-600" role="status">Loading today’s numbers…</p> : data && <>
          {data.ordersTotal === 0 && <p className="mt-6 rounded-xl bg-amber-100 p-4 text-sm font-semibold text-amber-950">No orders yet today.</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Orders today" value={String(data.ordersTotal)} />
            <Metric label="Picked up" value={String(data.completedCount)} />
            <Metric label="Cash revenue" value={money(data.revenue)} />
            <Metric label="Top item" value={data.topItem ? `${data.topItem.name} · ${data.topItem.quantity}` : "No data"} />
            <Metric label="Cancelled" value={String(data.cancelledCount)} />
            <Metric label="Expired" value={String(data.expiredCount)} />
            <Metric label="Average prep" value={data.avgActualPrepMinutes === null ? "No data" : `${data.avgActualPrepMinutes} min`} />
            <Metric label="Estimate error" value={data.estimateAccuracy === null ? "No data" : `${data.estimateAccuracy} min MAE`} />
          </div>
          <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"><h2 className="text-xl font-black">Orders by hour</h2><p className="mt-1 text-sm text-stone-500">Created today, Pakistan Standard Time (UTC+5).</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] border-collapse text-left text-sm"><thead><tr className="border-b border-stone-200 text-stone-500"><th className="py-3 pr-4 font-semibold">Hour</th><th className="py-3 pr-4 font-semibold">Orders</th><th className="py-3 font-semibold">Volume</th></tr></thead><tbody>{data.ordersPerHour.map((row) => <tr key={row.hour} className="border-b border-stone-100 last:border-0"><td className="py-2.5 pr-4">{String(row.hour).padStart(2, "0")}:00</td><td className="py-2.5 pr-4">{row.count}</td><td className="py-2.5"><div className="h-2 rounded-full bg-amber-100"><div className="h-2 rounded-full bg-orange-700" style={{ width: `${data.ordersTotal ? Math.min(100, (row.count / data.ordersTotal) * 100) : 0}%` }} /></div></td></tr>)}</tbody></table></div></section>
          <p className="mt-4 text-xs text-stone-500">Estimate error is mean absolute error against the displayed estimate. Prep and accuracy values are historical measures, not promises.</p>
        </>}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="min-h-28 rounded-2xl border border-stone-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-3 text-xl font-black leading-tight sm:text-2xl">{value}</p></article>;
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CanteenHeader } from "@/components/CanteenHeader";

type Analytics = {
  day: string;
  ordersTotal: number;
  demoOrders: number;
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

  const peakHour = Math.max(1, ...(data?.ordersPerHour ?? []).map((row) => row.count));

  return (
    <main className="cx-page cx-ops-page">
      <CanteenHeader links={[{ href: "/kitchen", label: "Kitchen" }, { href: "/admin", label: "Analytics", active: true }]} actionLabel="Log out" onAction={() => void logout()} />
      <section className="cx-ops-shell">
        <div className="cx-ops-heading">
          <div><span className="cx-eyebrow">DAILY SNAPSHOT</span><h1>Today at the canteen<span>.</span></h1><p>{data ? `Karachi date · ${data.day}` : "Sales, service, and preparation at a glance."}</p></div>
          <button onClick={() => void refresh()} className="cx-secondary-button" disabled={loading}><RefreshIcon />{loading ? "Refreshing…" : "Refresh numbers"}</button>
        </div>
        {error && <p role="alert" className="cx-alert cx-alert-error">{error}</p>}
        {loading && !data ? <div className="cx-loading-panel" role="status"><span className="cx-spinner" />Loading today’s numbers…</div> : data && <>
          {data.ordersTotal === 0 && <div className="cx-alert cx-alert-warm"><strong>A fresh start.</strong><span>No orders have been placed today yet.</span></div>}
          <div className="cx-metric-grid">
            <Metric icon="↗" label="Orders today" value={String(data.ordersTotal)} tone="green" />
            <Metric icon="✓" label="Picked up" value={String(data.completedCount)} tone="orange" />
            <Metric icon="₨" label="Cash revenue" value={money(data.revenue)} tone="gold" />
            <Metric icon="✦" label="Top item" value={data.topItem ? `${data.topItem.name} · ${data.topItem.quantity}` : "No data"} tone="green" />
          </div>
          <div className="cx-admin-content-grid">
            <section className="cx-panel cx-hour-panel">
              <div className="cx-panel-heading"><div><span className="cx-eyebrow">TRAFFIC</span><h2>Orders by hour</h2><p>Created today · Pakistan Standard Time</p></div><span className="cx-panel-badge">{data.ordersTotal} total</span></div>
              {data.ordersTotal === 0 ? <div className="cx-chart-empty">Hourly activity will appear here as orders come in.</div> : <div className="cx-hour-chart" role="img" aria-label="Orders by hour in Pakistan Standard Time">
                {data.ordersPerHour.map((row) => <div className="cx-hour-bar-column" key={row.hour} title={`${String(row.hour).padStart(2, "0")}:00 · ${row.count} orders`}><div className="cx-hour-bar-track"><div className="cx-hour-bar" style={{ height: `${Math.max(row.count ? 7 : 0, (row.count / peakHour) * 100)}%` }} /></div><span>{row.hour % 3 === 0 ? String(row.hour).padStart(2, "0") : ""}</span></div>)}
              </div>}
              <div className="cx-chart-legend"><span><i /> Orders per hour</span><small>Local campus time · UTC+5</small></div>
            </section>
            <section className="cx-panel cx-service-panel">
              <div className="cx-panel-heading"><div><span className="cx-eyebrow">SERVICE CHECK</span><h2>Today’s operations</h2></div></div>
              <div className="cx-service-list">
                <ServiceMetric label="Demo orders" value={String(data.demoOrders)} detail="Excluded from sales and wait-time metrics" />
                <ServiceMetric label="Cancelled" value={String(data.cancelledCount)} detail="Customer or staff cancellations" />
                <ServiceMetric label="Expired" value={String(data.expiredCount)} detail="Uncollected orders" />
                <ServiceMetric label="Average prep" value={data.avgActualPrepMinutes === null ? "—" : `${data.avgActualPrepMinutes} min`} detail="Measured from live orders" />
                <ServiceMetric label="Estimate error" value={data.estimateAccuracy === null ? "—" : `${data.estimateAccuracy} min`} detail="Mean absolute error" />
              </div>
            </section>
          </div>
          <p className="cx-ops-footnote">Prep and estimate accuracy are historical measures from completed orders. Queue-time figures are estimates, not promises.</p>
        </>}
      </section>
    </main>
  );
}

function Metric({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: "green" | "orange" | "gold" }) {
  return <article className="cx-metric-card"><span className={`cx-metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article>;
}

function ServiceMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="cx-service-row"><div><strong>{label}</strong><span>{detail}</span></div><b>{value}</b></div>;
}

function RefreshIcon() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3" /></svg>;
}

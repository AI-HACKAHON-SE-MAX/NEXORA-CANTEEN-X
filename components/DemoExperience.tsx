"use client";

import { useState } from "react";
import { CanteenHeader } from "@/components/CanteenHeader";

type DemoView = "student" | "kitchen" | "analytics";
type DemoStatus = "received" | "preparing" | "ready" | "picked_up";
type DemoItem = { id: string; name: string; description: string; price: number; image: string };
type DemoOrder = { token: string; status: DemoStatus; items: Array<{ name: string; quantity: number }> };

const menu: DemoItem[] = [
  { id: "biryani", name: "Chicken Biryani", description: "Aromatic rice, tender chicken, and raita.", price: 280, image: "https://images.deliveryhero.io/image/fd-pk/LH/bxh6-listing.jpg?height=700&width=800" },
  { id: "samosa", name: "Aloo Samosa", description: "Crisp potato pastry with mint chutney.", price: 50, image: "https://images.unsplash.com/photo-1721980743533-49f5fa70994b?auto=format&fit=crop&w=700&q=80" },
  { id: "chai", name: "Doodh Patti Chai", description: "Strong milk tea, brewed to order.", price: 70, image: "https://explorerest.sgp1.digitaloceanspaces.com/restaurant/14981/gallery/kitch-kashmiri-chai-gallery-7jpeg-3.jpeg" },
];

const labels: Record<DemoStatus, string> = { received: "Received", preparing: "Preparing", ready: "Ready for pickup", picked_up: "Picked up" };
const nextStatus: Record<DemoStatus, DemoStatus> = { received: "preparing", preparing: "ready", ready: "picked_up", picked_up: "picked_up" };

function money(amount: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);
}

export function DemoExperience() {
  const [view, setView] = useState<DemoView>("student");
  const [bag, setBag] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [orders, setOrders] = useState<DemoOrder[]>([
    { token: "D-104", status: "received", items: [{ name: "Chicken Biryani", quantity: 1 }, { name: "Doodh Patti Chai", quantity: 1 }] },
    { token: "D-103", status: "preparing", items: [{ name: "Aloo Samosa", quantity: 2 }, { name: "Doodh Patti Chai", quantity: 1 }] },
    { token: "D-102", status: "ready", items: [{ name: "Chicken Biryani", quantity: 1 }] },
  ]);

  const count = Object.values(bag).reduce((sum, value) => sum + value, 0);
  const subtotal = menu.reduce((sum, item) => sum + item.price * (bag[item.id] ?? 0), 0);
  const combos = Math.min(bag.samosa ?? 0, bag.chai ?? 0);
  const total = subtotal - combos * 20;

  function add(item: DemoItem) {
    setBag((current) => ({ ...current, [item.id]: Math.min(10, (current[item.id] ?? 0) + 1) }));
    setNotice(`${item.name} added to your demo bag.`);
  }

  function placeDemoOrder() {
    if (!count) return;
    const items = menu.flatMap((item) => bag[item.id] ? [{ name: item.name, quantity: bag[item.id] }] : []);
    const token = `D-${orders.length + 102}`;
    setOrders((current) => [{ token, status: "received", items }, ...current]);
    setBag({});
    setNotice(`Demo order ${token} placed locally. No order was sent to the canteen.`);
  }

  function advanceDemoOrder(token: string) {
    setOrders((current) => current.map((order) => order.token === token ? { ...order, status: nextStatus[order.status] } : order));
  }

  return (
    <main className="cx-page cx-demo-page">
      <CanteenHeader links={[{ href: "/", label: "Student menu" }, { href: "/staff-login", label: "Staff sign-in" }, { href: "/demo", label: "Demo", active: true }]} />
      <section className="cx-demo-shell">
        <div className="cx-demo-hero">
          <div><span className="cx-demo-eyebrow"><i /> INTERACTIVE SANDBOX</span><h1>Explore CanteenX<span>.</span></h1><p>Try the student, kitchen, and admin screens with sample data. Nothing here creates or changes a real order.</p></div>
          <div className="cx-demo-stamp"><strong>DEMO</strong><span>Sample data<br />Local interactions</span></div>
        </div>
        <div className="cx-demo-safety"><span>ⓘ</span><p><strong>Demo mode is separate from the live service.</strong> It uses sample data in this browser only. No email, database, or production API calls are made.</p></div>

        <div className="cx-demo-tabs" role="group" aria-label="Demo screens">
          <DemoTab active={view === "student"} onClick={() => setView("student")}>Student ordering</DemoTab>
          <DemoTab active={view === "kitchen"} onClick={() => setView("kitchen")}>Kitchen queue</DemoTab>
          <DemoTab active={view === "analytics"} onClick={() => setView("analytics")}>Admin analytics</DemoTab>
        </div>

        {view === "student" && <section className="cx-demo-student-view">
          <div className="cx-demo-section-heading"><div><span className="cx-eyebrow">SAMPLE MENU</span><h2>Pick something good</h2></div><span className="cx-panel-badge">Campus menu · sample prices</span></div>
          <div className="cx-demo-order-layout">
            <div className="cx-demo-menu-grid">{menu.map((item) => <article key={item.id} className="cx-product-card cx-demo-product">
              <div className="cx-product-photo"><img src={item.image} alt={item.name} loading="lazy" /></div>
              <div className="cx-product-info"><h3>{item.name}</h3><p>{item.description}</p><div className="cx-product-bottom"><b>{money(item.price)}</b><button onClick={() => add(item)} className="cx-add-button">Add <span>+</span></button></div></div>
            </article>)}</div>
            <aside className="cx-demo-bag cx-panel"><div className="cx-panel-heading"><div><span className="cx-eyebrow">YOUR BAG</span><h2>Demo checkout</h2></div><span className="cx-panel-badge">{count} items</span></div>
              {count === 0 ? <div className="cx-demo-bag-empty">Add a sample dish to try the checkout interaction.</div> : <>
                <ul className="cx-demo-bag-list">{menu.filter((item) => bag[item.id]).map((item) => <li key={item.id}><span>{bag[item.id]} × {item.name}</span><button onClick={() => setBag((current) => ({ ...current, [item.id]: current[item.id] - 1 || 0 }))} aria-label={`Remove one ${item.name}`}>−</button></li>)}</ul>
                {combos > 0 && <div className="cx-demo-discount"><span>Study break combo</span><strong>−{money(combos * 20)}</strong></div>}
                <div className="cx-demo-total"><span>Total · cash on pickup</span><strong>{money(total)}</strong></div>
                <button className="cx-checkout-button" onClick={placeDemoOrder}>Place demo order <ArrowIcon /></button>
              </>}
              {notice && <p role="status" className="cx-inline-notice">{notice}</p>}
            </aside>
          </div>
          {orders[0] && <div className="cx-demo-tracking cx-panel"><div><span className="cx-eyebrow">ORDER TRACKING PREVIEW</span><h3>Pickup token <strong>{orders[0].token}</strong></h3><p>Status updates are simulated in the Kitchen Queue tab.</p></div><span className={`cx-status-badge ${orders[0].status}`}>{labels[orders[0].status]}</span></div>}
        </section>}

        {view === "kitchen" && <section className="cx-demo-kitchen-view">
          <div className="cx-demo-section-heading"><div><span className="cx-eyebrow">SAMPLE OPERATIONS</span><h2>Kitchen queue</h2></div><span className="cx-panel-badge">{orders.filter((order) => order.status !== "picked_up").length} active</span></div>
          <div className="cx-demo-queue">{orders.map((order) => <article key={order.token} className="cx-kitchen-order">
            <div className="cx-kitchen-order-head"><div><p className="cx-order-caption">Demo pickup token</p><p className="cx-kitchen-token">{order.token}</p></div><span className={`cx-status-badge ${order.status === "picked_up" ? "ready" : order.status}`}>{labels[order.status]}</span></div>
            <div className="cx-kitchen-items"><p>Order items</p><ul>{order.items.map((item) => <li key={item.name}><span>{item.quantity} ×</span><strong>{item.name}</strong></li>)}</ul></div>
            {order.status !== "picked_up" && <button className="cx-action-button primary" onClick={() => advanceDemoOrder(order.token)}>Simulate: {labels[nextStatus[order.status]]} <ArrowIcon /></button>}
          </article>)}</div>
          <p className="cx-demo-footnote">Buttons only advance the sample orders in this page. They do not call staff APIs.</p>
        </section>}

        {view === "analytics" && <DemoAnalytics orders={orders} />}
      </section>
    </main>
  );
}

function DemoTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button aria-pressed={active} onClick={onClick} className={active ? "cx-demo-tab active" : "cx-demo-tab"}>{children}</button>;
}

function DemoAnalytics({ orders }: { orders: DemoOrder[] }) {
  const picked = orders.filter((order) => order.status === "picked_up").length + 12;
  const bars = [1, 2, 3, 2, 5, 7, 6, 9, 12, 10, 8, 5];
  return <section className="cx-demo-analytics-view">
    <div className="cx-demo-section-heading"><div><span className="cx-eyebrow">SAMPLE OPERATIONS</span><h2>Today’s analytics</h2></div><span className="cx-panel-badge">Example data</span></div>
    <div className="cx-metric-grid">
      <DemoMetric icon="↗" label="Orders today" value="18" tone="green" />
      <DemoMetric icon="✓" label="Picked up" value={String(picked)} tone="orange" />
      <DemoMetric icon="₨" label="Cash revenue" value={money(4_260)} tone="gold" />
      <DemoMetric icon="✦" label="Top item" value="Chicken Biryani · 7" tone="green" />
    </div>
    <div className="cx-panel cx-demo-chart-panel"><div className="cx-panel-heading"><div><span className="cx-eyebrow">TRAFFIC</span><h2>Orders by hour</h2><p>Sample day · Pakistan Standard Time</p></div><span className="cx-panel-badge">18 total</span></div>
      <div className="cx-hour-chart" role="img" aria-label="Sample orders by hour">{bars.map((value, index) => <div className="cx-hour-bar-column" key={index} title={`${index + 8}:00 · ${value} orders`}><div className="cx-hour-bar-track"><div className="cx-hour-bar" style={{ height: `${(value / 12) * 100}%` }} /></div><span>{index % 2 === 0 ? `${index + 8}` : ""}</span></div>)}</div>
      <div className="cx-chart-legend"><span><i /> Sample orders per hour</span><small>Not live data</small></div>
    </div>
    <p className="cx-demo-footnote">These numbers are illustrative only. Live analytics require a configured database and staff sign-in.</p>
  </section>;
}

function DemoMetric({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: "green" | "orange" | "gold" }) {
  return <article className="cx-metric-card"><span className={`cx-metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article>;
}

function ArrowIcon() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

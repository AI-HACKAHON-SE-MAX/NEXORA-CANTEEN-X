"use client";

import { useEffect, useMemo, useState } from "react";
import { CanteenHeader } from "@/components/CanteenHeader";

type DemoView = "student" | "kitchen" | "analytics";
type DemoStatus = "received" | "preparing" | "ready" | "picked_up" | "cancelled";
type Category = "All" | "Meals" | "Snacks" | "Drinks" | "Sweets";
type DemoItem = { id: string; name: string; description: string; price: number; image: string; category: Exclude<Category, "All"> };
type OrderLine = { id: string; name: string; quantity: number; price: number };
type DemoOrder = { token: string; status: DemoStatus; items: OrderLine[]; total: number; studentName: string; createdAt: string; sample?: boolean };
type DemoSavedState = { bag: Record<string, number>; orders: DemoOrder[] };

const STORAGE_KEY = "cx_student_demo_v2";
const MAX_ITEM_QUANTITY = 10;
const MAX_CART_QUANTITY = 20;
const menu: DemoItem[] = [
  { id: "samosa", name: "Aloo Samosa", description: "Crisp potato pastry with mint chutney.", price: 50, category: "Snacks", image: "https://images.unsplash.com/photo-1721980743533-49f5fa70994b?auto=format&fit=crop&w=700&q=80" },
  { id: "roll", name: "Chicken Roll", description: "Spiced chicken wrapped in a warm paratha.", price: 190, category: "Meals", image: "https://isodelivery.com.au/cdn/shop/files/0D97B4E2-47ED-4871-9A81-12ABFAAC77FC_512x410.jpg?v=1705706264" },
  { id: "fries", name: "Masala Fries", description: "Golden fries tossed with house masala.", price: 160, category: "Snacks", image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80" },
  { id: "biryani", name: "Chicken Biryani", description: "Aromatic rice with chicken and raita.", price: 280, category: "Meals", image: "https://images.deliveryhero.io/image/fd-pk/LH/bxh6-listing.jpg?height=700&width=800" },
  { id: "chai", name: "Doodh Patti Chai", description: "Strong milk tea, brewed to order.", price: 70, category: "Drinks", image: "https://explorerest.sgp1.digitaloceanspaces.com/restaurant/14981/gallery/kitch-kashmiri-chai-gallery-7jpeg-3.jpeg" },
  { id: "lemonade", name: "Mint Lemonade", description: "Fresh lemon, mint, and chilled water.", price: 110, category: "Drinks", image: "https://images.unsplash.com/photo-1513558161293-cdaf765edfd7?auto=format&fit=crop&w=700&q=80" },
  { id: "sandwich", name: "Veggie Sandwich", description: "Toasted bread with crisp vegetables.", price: 150, category: "Meals", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=700&q=80" },
  { id: "brownie", name: "Chocolate Brownie", description: "Soft cocoa brownie baked in small batches.", price: 130, category: "Sweets", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=700&q=80" },
  { id: "paratha", name: "Chicken Cheese Paratha", description: "Flaky paratha with chicken and melted cheese.", price: 240, category: "Meals", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=80" },
];

const initialOrders: DemoOrder[] = [
  { token: "D-104", status: "received", items: [{ id: "biryani", name: "Chicken Biryani", quantity: 1, price: 280 }, { id: "chai", name: "Doodh Patti Chai", quantity: 1, price: 70 }], total: 350, studentName: "Sample Student", createdAt: new Date().toISOString(), sample: true },
  { token: "D-103", status: "preparing", items: [{ id: "samosa", name: "Aloo Samosa", quantity: 2, price: 50 }, { id: "chai", name: "Doodh Patti Chai", quantity: 1, price: 70 }], total: 170, studentName: "Sample Student", createdAt: new Date().toISOString(), sample: true },
  { token: "D-102", status: "ready", items: [{ id: "biryani", name: "Chicken Biryani", quantity: 1, price: 280 }], total: 280, studentName: "Sample Student", createdAt: new Date().toISOString(), sample: true },
];
const labels: Record<DemoStatus, string> = { received: "Received", preparing: "Preparing", ready: "Ready for pickup", picked_up: "Picked up", cancelled: "Cancelled" };
const nextStatus: Partial<Record<DemoStatus, DemoStatus>> = { received: "preparing", preparing: "ready", ready: "picked_up" };

function money(amount: number) {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);
}

function isDemoOrder(value: unknown): value is DemoOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<DemoOrder>;
  return typeof order.token === "string" && typeof order.studentName === "string" && typeof order.createdAt === "string" && ["received", "preparing", "ready", "picked_up", "cancelled"].includes(String(order.status)) && Array.isArray(order.items) && typeof order.total === "number";
}

export function DemoExperience() {
  const [view, setView] = useState<DemoView>("student");
  const [bag, setBag] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<DemoOrder[]>(initialOrders);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [studentName, setStudentName] = useState("Demo Student");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<DemoSavedState> | null;
      if (saved && Array.isArray(saved.orders)) setOrders(saved.orders.filter(isDemoOrder).slice(0, 30));
      if (saved?.bag && typeof saved.bag === "object") {
        const safeBag = Object.fromEntries(Object.entries(saved.bag).filter(([id, quantity]) => menu.some((item) => item.id === id) && Number.isInteger(quantity) && Number(quantity) > 0 && Number(quantity) <= MAX_ITEM_QUANTITY)) as Record<string, number>;
        setBag(safeBag);
      }
    } catch { /* Demo remains usable when browser storage is blocked. */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ bag, orders } satisfies DemoSavedState)); } catch { /* Persistence is optional in demo mode. */ }
  }, [bag, orders, hydrated]);

  const count = Object.values(bag).reduce((sum, value) => sum + value, 0);
  const subtotal = menu.reduce((sum, item) => sum + item.price * (bag[item.id] ?? 0), 0);
  const combos = Math.min(bag.samosa ?? 0, bag.chai ?? 0);
  const total = Math.max(0, subtotal - combos * 20);
  const visibleMenu = useMemo(() => menu.filter((item) => (category === "All" || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())), [category, query]);
  const studentOrders = orders.filter((order) => !order.sample);
  const latestStudentOrder = studentOrders[0];

  function changeQuantity(item: DemoItem, delta: number) {
    if (delta > 0 && (count >= MAX_CART_QUANTITY || (bag[item.id] ?? 0) >= MAX_ITEM_QUANTITY)) {
      setNotice(`Demo bag limit is ${MAX_CART_QUANTITY} items, with up to ${MAX_ITEM_QUANTITY} of each dish.`);
      return;
    }
    setBag((current) => {
      const next = { ...current };
      const quantity = Math.max(0, (next[item.id] ?? 0) + delta);
      if (quantity === 0) delete next[item.id]; else next[item.id] = quantity;
      setNotice(delta > 0 ? `${item.name} added to your demo bag.` : "Bag updated.");
      return next;
    });
  }

  function placeDemoOrder() {
    if (!count) { setNotice("Add at least one dish before placing a demo order."); return; }
    const safeName = studentName.trim().replace(/[^\p{L} ]/gu, "").slice(0, 60) || "Demo Student";
    const items = menu.filter((item) => bag[item.id]).map((item) => ({ id: item.id, name: item.name, quantity: bag[item.id], price: item.price }));
    const nextNumber = Math.max(104, ...orders.map((order) => Number(order.token.replace(/^D-/, "")) || 0)) + 1;
    const token = `D-${nextNumber}`;
    const order: DemoOrder = { token, status: "received", items, total, studentName: safeName, createdAt: new Date().toISOString() };
    setOrders((current) => [order, ...current].slice(0, 30));
    setBag({});
    setNotice(`Sample order ${token} placed for ${safeName}. It is saved only in this browser.`);
  }

  function advanceDemoOrder(token: string) {
    setOrders((current) => current.map((order) => order.token === token && nextStatus[order.status] ? { ...order, status: nextStatus[order.status]! } : order));
  }

  function cancelDemoOrder(token: string) {
    setOrders((current) => current.map((order) => order.token === token && order.status === "received" ? { ...order, status: "cancelled" } : order));
    setNotice(`Demo order ${token} cancelled locally.`);
  }

  function resetDemo() {
    setBag({}); setOrders(initialOrders); setStudentName("Demo Student");
    setNotice("Demo reset. Your sample orders and bag are back to the starting state.");
  }

  return (
    <main className="cx-page cx-demo-page">
      <CanteenHeader links={[{ href: "/", label: "Student menu" }, { href: "/staff-login", label: "Staff sign-in" }, { href: "/demo", label: "Demo", active: true }]} />
      <section className="cx-demo-shell">
        <div className="cx-demo-hero">
          <div><span className="cx-demo-eyebrow"><i /> INTERACTIVE SANDBOX</span><h1>Explore CanteenX<span>.</span></h1><p>Place and track a complete sample student order. Menu search, filters, cart limits, combo pricing, cancellation, and kitchen updates all work in this browser.</p></div>
          <div className="cx-demo-stamp"><strong>DEMO</strong><span>Sample data<br />Local interactions</span></div>
        </div>
        <div className="cx-demo-safety"><span>ⓘ</span><p><strong>This is a working student demo, isolated from live orders.</strong> Your bag and sample orders stay in this browser. Demo checkout skips email verification and never writes to the production database.</p></div>

        <div className="cx-demo-tabs" role="group" aria-label="Demo screens">
          <DemoTab active={view === "student"} onClick={() => setView("student")}>Student ordering</DemoTab>
          <DemoTab active={view === "kitchen"} onClick={() => setView("kitchen")}>Kitchen queue</DemoTab>
          <DemoTab active={view === "analytics"} onClick={() => setView("analytics")}>Admin analytics</DemoTab>
          <button className="cx-demo-reset" onClick={resetDemo}>Reset demo</button>
        </div>

        {view === "student" && <section className="cx-demo-student-view">
          <div className="cx-demo-section-heading"><div><span className="cx-eyebrow">SAMPLE MENU</span><h2>Pick something good</h2></div><span className="cx-panel-badge">9 dishes · sample prices</span></div>
          <div className="cx-tools cx-demo-tools"><div className="cx-search"><SearchIcon /><input type="search" placeholder="Find your favourite…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search demo menu" /></div><div className="cx-categories" role="group" aria-label="Filter demo menu categories">{(["All", "Meals", "Snacks", "Drinks", "Sweets"] as Category[]).map((item) => <button key={item} className={category === item ? "cx-category active" : "cx-category"} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
          <div className="cx-demo-order-layout">
            <div className="cx-demo-menu-grid">{visibleMenu.length ? visibleMenu.map((item) => <article key={item.id} className="cx-product-card cx-demo-product">
              <div className="cx-product-photo"><img src={item.image} alt={item.name} loading="lazy" /></div>
              <div className="cx-product-info"><h3>{item.name}</h3><p>{item.description}</p><div className="cx-product-bottom"><b>{money(item.price)}</b>{bag[item.id] ? <div className="cx-stepper" aria-label={`${bag[item.id]} ${item.name} in bag`}><button onClick={() => changeQuantity(item, -1)} aria-label={`Remove one ${item.name}`}>−</button><b>{bag[item.id]}</b><button onClick={() => changeQuantity(item, 1)} aria-label={`Add one ${item.name}`}>+</button></div> : <button onClick={() => changeQuantity(item, 1)} className="cx-add-button">Add <span>+</span></button>}</div></div>
            </article>) : <div className="cx-empty">No sample dishes match. Try a different search or category.</div>}</div>
            <aside className="cx-demo-bag cx-panel"><div className="cx-panel-heading"><div><span className="cx-eyebrow">YOUR BAG</span><h2>Demo checkout</h2></div><span className="cx-panel-badge">{count} items</span></div>
              {count === 0 ? <div className="cx-demo-bag-empty">Add a sample dish to try the checkout interaction.</div> : <>
                <ul className="cx-demo-bag-list">{menu.filter((item) => bag[item.id]).map((item) => <li key={item.id}><span>{bag[item.id]} × {item.name}<small>{money(item.price * bag[item.id])}</small></span><div className="cx-stepper"><button onClick={() => changeQuantity(item, -1)} aria-label={`Remove one ${item.name}`}>−</button><b>{bag[item.id]}</b><button onClick={() => changeQuantity(item, 1)} aria-label={`Add one ${item.name}`}>+</button></div></li>)}</ul>
                <label className="cx-demo-name">Pickup name<input value={studentName} maxLength={60} onChange={(event) => setStudentName(event.target.value.replace(/[^\p{L} ]/gu, ""))} placeholder="Your name" /></label>
                {combos > 0 && <div className="cx-demo-discount"><span>Study break combo</span><strong>−{money(combos * 20)}</strong></div>}
                <div className="cx-demo-total"><span>Total · cash on pickup</span><strong>{money(total)}</strong></div>
                <button className="cx-checkout-button" onClick={placeDemoOrder}>Place demo order <ArrowIcon /></button>
              </>}
              {notice && <p role="status" className="cx-inline-notice">{notice}</p>}
            </aside>
          </div>
          {latestStudentOrder && <StudentTracking order={latestStudentOrder} onCancel={cancelDemoOrder} />}
          {studentOrders.length > 1 && <div className="cx-demo-order-history"><span className="cx-eyebrow">YOUR DEMO ORDERS</span>{studentOrders.slice(1, 5).map((order) => <div key={order.token}><span>#{order.token} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} items</span><strong className={`cx-status-badge ${order.status}`}>{labels[order.status]}</strong></div>)}</div>}
        </section>}

        {view === "kitchen" && <section className="cx-demo-kitchen-view">
          <div className="cx-demo-section-heading"><div><span className="cx-eyebrow">SAMPLE OPERATIONS</span><h2>Kitchen queue</h2></div><span className="cx-panel-badge">{orders.filter((order) => !["picked_up", "cancelled"].includes(order.status)).length} active</span></div>
          <div className="cx-demo-queue">{orders.filter((order) => order.status !== "cancelled").map((order) => <article key={order.token} className="cx-kitchen-order">
            <div className="cx-kitchen-order-head"><div><p className="cx-order-caption">{order.sample ? "Sample pickup token" : `${order.studentName} · demo order`}</p><p className="cx-kitchen-token">{order.token}</p></div><span className={`cx-status-badge ${order.status}`}>{labels[order.status]}</span></div>
            <div className="cx-kitchen-items"><p>Order items</p><ul>{order.items.map((item) => <li key={item.id}><span>{item.quantity} ×</span><strong>{item.name}</strong></li>)}</ul></div>
            <div className="cx-demo-kitchen-total"><span>Total</span><strong>{money(order.total)}</strong></div>
            {nextStatus[order.status] && <button className="cx-action-button primary" onClick={() => advanceDemoOrder(order.token)}>Simulate: {labels[nextStatus[order.status]!]} <ArrowIcon /></button>}
          </article>)}</div>
          <p className="cx-demo-footnote">Advance a received demo order to see the student tracker update. Buttons only change local sample data and never call staff APIs.</p>
        </section>}

        {view === "analytics" && <DemoAnalytics orders={orders} />}
      </section>
    </main>
  );
}

function StudentTracking({ order, onCancel }: { order: DemoOrder; onCancel: (token: string) => void }) {
  return <div className="cx-demo-tracking cx-panel"><div><span className="cx-eyebrow">YOUR ORDER · {order.studentName}</span><h3>Pickup token <strong>{order.token}</strong></h3><p>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(" · ")} · {money(order.total)}</p><p>Change its status from the Kitchen Queue tab; this tracker updates with it.</p></div><div className="cx-demo-tracking-actions"><span className={`cx-status-badge ${order.status}`}>{labels[order.status]}</span>{order.status === "received" && <button className="cx-text-button" onClick={() => onCancel(order.token)}>Cancel demo order</button>}</div></div>;
}

function DemoTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button aria-pressed={active} onClick={onClick} className={active ? "cx-demo-tab active" : "cx-demo-tab"}>{children}</button>;
}

function DemoAnalytics({ orders }: { orders: DemoOrder[] }) {
  const completed = orders.filter((order) => order.status === "picked_up");
  const revenue = 4_260 + completed.reduce((sum, order) => sum + order.total, 0);
  const bars = [1, 2, 3, 2, 5, 7, 6, 9, 12, 10, 8, 5];
  return <section className="cx-demo-analytics-view">
    <div className="cx-demo-section-heading"><div><span className="cx-eyebrow">SAMPLE OPERATIONS</span><h2>Today’s analytics</h2></div><span className="cx-panel-badge">Example data + your demo actions</span></div>
    <div className="cx-metric-grid">
      <DemoMetric icon="↗" label="Orders today" value={String(18 + orders.filter((order) => !order.sample).length)} tone="green" />
      <DemoMetric icon="✓" label="Picked up" value={String(12 + completed.length)} tone="orange" />
      <DemoMetric icon="₨" label="Cash revenue" value={money(revenue)} tone="gold" />
      <DemoMetric icon="✦" label="Top item" value="Chicken Biryani · 7" tone="green" />
    </div>
    <div className="cx-panel cx-demo-chart-panel"><div className="cx-panel-heading"><div><span className="cx-eyebrow">TRAFFIC</span><h2>Orders by hour</h2><p>Sample day · Pakistan Standard Time</p></div><span className="cx-panel-badge">18 total · sample</span></div>
      <div className="cx-hour-chart" role="img" aria-label="Sample orders by hour">{bars.map((value, index) => <div className="cx-hour-bar-column" key={index} title={`${index + 8}:00 · ${value} orders`}><div className="cx-hour-bar-track"><div className="cx-hour-bar" style={{ height: `${(value / 12) * 100}%` }} /></div><span>{index % 2 === 0 ? `${index + 8}` : ""}</span></div>)}</div>
      <div className="cx-chart-legend"><span><i /> Sample orders per hour</span><small>Not live data</small></div>
    </div>
    <p className="cx-demo-footnote">Analytics values use illustrative data. Your sample orders adjust the totals locally; production analytics require staff sign-in.</p>
  </section>;
}

function DemoMetric({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: "green" | "orange" | "gold" }) {
  return <article className="cx-metric-card"><span className={`cx-metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong></div></article>;
}

function SearchIcon() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

function ArrowIcon() {
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

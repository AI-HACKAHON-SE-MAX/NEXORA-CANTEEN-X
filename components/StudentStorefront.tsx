"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  prepMinutes: number;
  imageUrl: string | null;
  isAvailable: boolean;
};
type Cart = Record<string, number>;
type Student = { name: string };
const CART_KEY = "cx_cart";
const SAMOSA_ID = "10000000-0000-4000-8000-000000000001";
const CHAI_ID = "10000000-0000-4000-8000-000000000005";
const PHOTOS: Record<string, string> = {
  "10000000-0000-4000-8000-000000000001": "https://images.unsplash.com/photo-1721980743533-49f5fa70994b?auto=format&fit=crop&w=900&q=82",
  "10000000-0000-4000-8000-000000000002": "https://isodelivery.com.au/cdn/shop/files/0D97B4E2-47ED-4871-9A81-12ABFAAC77FC_512x410.jpg?v=1705706264",
  "10000000-0000-4000-8000-000000000003": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=82",
  "10000000-0000-4000-8000-000000000004": "https://images.deliveryhero.io/image/fd-pk/LH/bxh6-listing.jpg?height=900&width=900",
  "10000000-0000-4000-8000-000000000005": "https://explorerest.sgp1.digitaloceanspaces.com/restaurant/14981/gallery/kitch-kashmiri-chai-gallery-7jpeg-3.jpeg",
  "10000000-0000-4000-8000-000000000006": "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=82",
  "10000000-0000-4000-8000-000000000007": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=82",
  "10000000-0000-4000-8000-000000000008": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=82",
  "10000000-0000-4000-8000-000000000009": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=82",
};

function money(amount: number): string {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);
}

function Icon({ name, size = 20 }: { name: "cart" | "sun" | "moon" | "search" | "arrow" | "check" | "spark"; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    cart: <><path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 1.9-1.4L22 8H6"/><circle cx="10" cy="21" r="1"/><circle cx="18" cy="21" r="1"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    moon: <path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 15 1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1 1-2.5Z"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function StudentStorefront() {
  const router = useRouter();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [cartLoaded, setCartLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [authStep, setAuthStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [offline, setOffline] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [addedId, setAddedId] = useState("");
  const attemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const submitLock = useRef(false);

  async function loadMenu() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/menu", { cache: "no-store" });
      if (!response.ok) throw new Error("menu");
      const body = await response.json() as { items: MenuItem[] };
      setMenu(Array.isArray(body.items) ? body.items : []);
    } catch {
      setLoadError("We couldn't load today's menu. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        setCart(Object.fromEntries(Object.entries(saved).filter(([id, qty]) => /^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(qty) && (qty as number) > 0 && (qty as number) <= 10)) as Cart);
      }
      const savedTheme = localStorage.getItem("cx_theme");
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
    } catch { /* Keep the storefront usable when browser storage is blocked. */ }
    setCartLoaded(true);
    void loadMenu();
    void fetch("/api/student/session", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { authenticated?: boolean; student?: Student };
      if (body.authenticated && body.student) setStudent(body.student);
    }).catch(() => undefined);
    const online = () => setOffline(false);
    const offlineEvent = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineEvent);
    setOffline(!navigator.onLine);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offlineEvent); };
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* Storage is optional. */ }
  }, [cart, cartLoaded]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("cx_theme", theme); } catch { /* Storage is optional. */ }
  }, [theme]);

  const quantity = Object.values(cart).reduce((sum, count) => sum + count, 0);
  const cartItems = useMemo(() => menu.filter((item) => cart[item.id] > 0), [menu, cart]);
  const rawTotal = cartItems.reduce((sum, item) => sum + item.price * cart[item.id], 0);
  const comboCount = Math.min(cart[SAMOSA_ID] ?? 0, cart[CHAI_ID] ?? 0);
  const discount = comboCount * 20;
  const total = Math.max(0, rawTotal - discount);
  const visibleMenu = menu.filter((item) => {
    const text = `${item.name} ${item.description}`.toLowerCase();
    const matchesQuery = text.includes(query.trim().toLowerCase());
    const lower = item.name.toLowerCase();
    const itemCategory = /chai|lemonade/.test(lower) ? "Drinks" : /brownie/.test(lower) ? "Sweets" : /samosa|fries/.test(lower) ? "Snacks" : "Meals";
    return matchesQuery && (category === "All" || itemCategory === category);
  });

  function updateQuantity(item: MenuItem, delta: number) {
    setCart((current) => {
      const totalCount = Object.values(current).reduce((sum, count) => sum + count, 0);
      if (delta > 0 && ((current[item.id] ?? 0) >= 10 || totalCount >= 20 || (!(item.id in current) && Object.keys(current).length >= 10))) return current;
      const next = { ...current };
      const value = Math.min(10, Math.max(0, (next[item.id] ?? 0) + delta));
      if (value === 0) delete next[item.id]; else next[item.id] = value;
      return next;
    });
    if (delta > 0) {
      setAddedId(item.id);
      setToast(`${item.name} added to your bag`);
      window.setTimeout(() => setAddedId(""), 950);
      window.setTimeout(() => setToast(""), 2300);
    }
  }

  function addCombo() {
    const samosa = menu.find((item) => item.id === SAMOSA_ID);
    const chai = menu.find((item) => item.id === CHAI_ID);
    if (quantity > 18 || (cart[SAMOSA_ID] ?? 0) >= 10 || (cart[CHAI_ID] ?? 0) >= 10) {
      setToast("Make a little room in your bag for the combo.");
      return;
    }
    if (samosa?.isAvailable) updateQuantity(samosa, 1);
    if (chai?.isAvailable) updateQuantity(chai, 1);
    setToast("Study break combo added · save PKR 20");
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true); setAuthNotice("");
    try {
      const response = await fetch("/api/student/auth/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universityId, customerName: name, email }),
      });
      const body = await response.json() as { message?: string; error?: { code?: string } };
      if (!response.ok) throw new Error(body.error?.code ?? "unavailable");
      setAuthStep("code");
      setAuthNotice(body.message ?? "Check your email for the six-digit code.");
    } catch (error) {
      setAuthNotice(error instanceof Error && error.message === "validation_error"
        ? "Check the CUI ID format, your name, and email address."
        : "We couldn't send a code right now. Check the details and try again.");
    } finally { setAuthBusy(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true); setAuthNotice("");
    try {
      const response = await fetch("/api/student/auth/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universityId, email, code: otp }),
      });
      const body = await response.json() as { student?: Student; error?: { code?: string } };
      if (!response.ok || !body.student) throw new Error(body.error?.code ?? "unauthorized");
      setStudent(body.student);
      setName(body.student.name);
      setAuthNotice("Email verified. This device is remembered for 180 days.");
      attemptRef.current = null;
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setAuthNotice(code === "rate_limited" ? "Too many attempts. Wait a little before trying again." : "That code could not be verified. Check it or request a new one.");
    } finally { setAuthBusy(false); }
  }

  async function resendCode() {
    setAuthBusy(true); setAuthNotice("");
    try {
      const response = await fetch("/api/student/auth/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universityId, customerName: name, email }),
      });
      const body = await response.json() as { message?: string; error?: { code?: string } };
      if (!response.ok) throw new Error(body.error?.code ?? "unavailable");
      setAuthNotice(body.message ?? "A fresh code has been sent.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setAuthNotice(code === "rate_limited" ? "Too many codes were requested. Wait a little before requesting another." : "We couldn't send another code right now.");
    } finally { setAuthBusy(false); }
  }

  async function signOut() {
    try { await fetch("/api/student/auth/logout", { method: "POST" }); } catch { /* The cookie will expire if the network is unavailable. */ }
    setStudent(null); setAuthStep("details"); setOtp(""); attemptRef.current = null;
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || quantity === 0 || !student) return;
    submitLock.current = true; setPending(true); setNotice("");
    try {
      const refreshed = await fetch("/api/menu", { cache: "no-store" });
      if (!refreshed.ok) throw new Error("menu");
      const latest = (await refreshed.json() as { items: MenuItem[] }).items;
      const byId = new Map(latest.map((item) => [item.id, item]));
      const changed = Object.entries(cart).some(([id]) => {
        const before = menu.find((item) => item.id === id); const after = byId.get(id);
        return !before || !after || before.price !== after.price || !after.isAvailable;
      });
      setMenu(latest);
      if (changed) { setNotice("The menu changed. Review the latest availability and prices, then try again."); return; }
      const fingerprint = JSON.stringify(Object.entries(cart).sort(([a], [b]) => a.localeCompare(b)));
      let attempt = attemptRef.current;
      if (!attempt || attempt.fingerprint !== fingerprint) { attempt = { fingerprint, key: crypto.randomUUID() }; attemptRef.current = attempt; }
      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: Object.entries(cart).map(([menuItemId, count]) => ({ menuItemId, quantity: count })), idempotencyKey: attempt.key }),
      });
      const body = await response.json() as { orderId?: string; orderKey?: string; token?: string; createdAt?: string; error?: { code?: string } };
      if (!response.ok) {
        const messages: Record<string, string> = {
          active_order_limit: "You already have two active orders. Wait for one to finish before ordering again.",
          item_unavailable: "An item is no longer available. Update your bag and try again.",
          duplicate_submit: "This order was already sent. Check My orders before trying again.",
          rate_limited: "A few orders came in quickly. Wait a moment and try again.",
        };
        setNotice(messages[body.error?.code ?? ""] ?? "The order service is unavailable. Your bag is saved; try again shortly.");
        return;
      }
      if (!body.orderId || !body.orderKey || !body.token) throw new Error("order");
      const stored = readSavedOrders();
      const next = [{ id: body.orderId, key: body.orderKey, token: body.token, createdAt: body.createdAt ?? new Date().toISOString(), status: "received" }, ...stored.filter((order) => order.id !== body.orderId)].slice(0, 5);
      try { localStorage.setItem("cx_orders", JSON.stringify(next)); } catch {
        setNotice(`Order placed. Show pickup token ${body.token}; this browser couldn't save its private tracking key.`); return;
      }
      try { localStorage.removeItem(CART_KEY); } catch { /* Item cleanup is best effort. */ }
      setCart({}); attemptRef.current = null; setCheckoutOpen(false); setDrawerOpen(false); router.push("/order");
    } catch { setNotice("Couldn't confirm the order. Your bag is saved; retry the same bag to avoid a duplicate."); }
    finally { submitLock.current = false; setPending(false); }
  }

  const samosa = menu.find((item) => item.id === SAMOSA_ID);
  const chai = menu.find((item) => item.id === CHAI_ID);
  const comboAvailable = Boolean(samosa?.isAvailable && chai?.isAvailable);

  return (
    <main className="cx-page" data-theme={theme}>
      {offline && <div className="cx-offline" role="status">You’re offline. Your bag is saved on this device.</div>}
      <header className="cx-header">
        <div className="cx-header-inner">
          <a href="/" className="cx-brand" aria-label="CanteenX home"><span className="cx-brand-mark">C</span><span>Canteen<span className="cx-brand-x">X</span><small>CUI ISLAMABAD</small></span></a>
          <nav className="cx-nav" aria-label="Main navigation">
            <a className="cx-nav-link" href="#menu">Menu</a><a className="cx-nav-link" href="/order">My orders</a>
            <button className="cx-icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}><Icon name={theme === "light" ? "moon" : "sun"}/></button>
            {student ? <button className="cx-profile" onClick={() => void signOut()} title="Sign out">{student.name.split(" ")[0]} <span>· Sign out</span></button> : <button className="cx-signin" onClick={() => { setCheckoutOpen(true); setAuthStep("details"); }}>Sign in</button>}
            <button className="cx-cart-button" onClick={() => setDrawerOpen(true)} aria-label={`Open bag, ${quantity} items`}><Icon name="cart"/><span>Bag</span><b aria-live="polite">{quantity}</b></button>
          </nav>
        </div>
      </header>

      <section className="cx-hero-wrap">
        <div className="cx-hero">
          <div className="cx-hero-copy"><div className="cx-kicker"><span className="cx-live-dot"/> MADE FRESH AT CUI ISLAMABAD</div>
            <h1>Your campus<br/><em>cravings, handled.</em></h1><p>Order from your phone. Pick up fresh food when you’re ready. Less waiting between classes.</p>
            <a href="#menu" className="cx-primary-link">Explore today’s menu <Icon name="arrow"/></a>
            <div className="cx-hero-proof"><span><b>01</b> Pick your food</span><i/> <span><b>02</b> Track your order</span><i/> <span><b>03</b> Pick up fresh</span></div>
          </div>
          <div className="cx-hero-photo" role="img" aria-label="Freshly prepared campus food"><div className="cx-photo-note"><span>GOOD FOOD, ON YOUR TIME</span><b>Lunch break, upgraded.</b></div></div>
          <div className="cx-hero-sticker"><Icon name="spark" size={17}/><span>Made with<br/><b>campus love</b></span></div>
        </div>
      </section>

      {comboAvailable && <section className="cx-promo-wrap" aria-label="Current deal"><div className="cx-promo">
        <div className="cx-promo-icon"><Icon name="spark" size={22}/></div><div className="cx-promo-copy"><span>THE STUDY BREAK COMBO</span><strong>Samosa + chai. Save PKR 20.</strong><small>One of each in the same bag unlocks the combo price automatically.</small></div>
        <div className="cx-promo-price"><del>{money((samosa?.price ?? 0) + (chai?.price ?? 0))}</del><b>{money((samosa?.price ?? 0) + (chai?.price ?? 0) - 20)}</b></div>
        <button onClick={addCombo} className="cx-promo-button">Add combo <Icon name="arrow" size={18}/></button>
      </div></section>}

      <section className="cx-menu-section" id="menu">
        <div className="cx-menu-heading"><div><span className="cx-eyebrow">WHAT SOUNDS GOOD?</span><h2>Today’s menu<span className="cx-menu-period">.</span></h2><p>Fresh picks from your campus canteen.</p></div><div className="cx-menu-meta"><span className="cx-open-pill"><i/> Kitchen taking orders</span><span>Prices in PKR</span></div></div>
        <div className="cx-tools"><div className="cx-search"><Icon name="search"/><input type="search" placeholder="Find your favourite…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search menu"/></div>
          <div className="cx-categories" role="group" aria-label="Filter menu categories">{["All", "Meals", "Snacks", "Drinks", "Sweets"].map((item) => <button key={item} className={category === item ? "cx-category active" : "cx-category"} onClick={() => setCategory(item)}>{item}</button>)}</div>
        </div>
        {loadError ? <div className="cx-empty"><p>{loadError}</p><button onClick={() => void loadMenu()} className="cx-outline-button">Try again</button></div>
          : loading ? <div className="cx-loading" role="status"><span className="cx-spinner"/>Setting the table…</div>
          : visibleMenu.length === 0 ? <div className="cx-empty">No dishes match that search. Try another name or category.</div>
          : <div className="cx-product-grid">{visibleMenu.map((item, index) => <article key={item.id} className="cx-product-card" style={{ animationDelay: `${index * 55}ms` }}>
            <div className="cx-product-photo"><img src={item.imageUrl || PHOTOS[item.id] || PHOTOS[SAMOSA_ID]} alt={item.name} loading="lazy" onError={(event) => { if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = "true"; event.currentTarget.src = PHOTOS[SAMOSA_ID]; } }}/><span className="cx-photo-tag">{item.prepMinutes} MIN PREP</span>{!item.isAvailable && <div className="cx-sold-out">Sold out</div>}</div>
            <div className="cx-product-info"><div><div className="cx-product-name-row"><h3>{item.name}</h3>{item.id === SAMOSA_ID && comboCount > 0 && <span className="cx-deal-tag">COMBO</span>}</div><p>{item.description}</p></div>
              <div className="cx-product-bottom"><b>{money(item.price)}</b><button disabled={!item.isAvailable || (cart[item.id] ?? 0) >= 10 || quantity >= 20} onClick={() => updateQuantity(item, 1)} className={addedId === item.id ? "cx-add-button added" : "cx-add-button"} aria-label={`Add ${item.name} to bag`}>{addedId === item.id ? <><Icon name="check" size={17}/> Added</> : <>Add <span>+</span></>}</button></div>
            </div>
          </article>)}</div>}
        <div className="cx-bottom-note"><span>✳</span> Prepared fresh when you order <i/> Payment at pickup <i/> Track your order live</div>
      </section>

      <footer className="cx-footer"><div className="cx-footer-brand">Canteen<span>X</span></div><p>Good food. More time for what matters.</p><a href="/order">Your orders <Icon name="arrow" size={16}/></a></footer>

      {toast && <div className="cx-toast" role="status" aria-live="polite"><span><Icon name="check" size={17}/></span>{toast}<button onClick={() => setDrawerOpen(true)}>View bag</button></div>}

      {quantity > 0 && !drawerOpen && !checkoutOpen && <button className="cx-mobile-bag" onClick={() => setDrawerOpen(true)}><span className="cx-mobile-bag-icon"><Icon name="cart"/><b>{quantity}</b></span><span>View your bag</span><strong>{money(total)} <Icon name="arrow" size={17}/></strong></button>}

      {drawerOpen && <div className="cx-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}><aside className="cx-drawer" aria-label="Your bag">
        <div className="cx-drawer-head"><div><span className="cx-eyebrow">YOUR PICKS</span><h2>Your bag <span>({quantity})</span></h2></div><button className="cx-close" onClick={() => setDrawerOpen(false)} aria-label="Close bag">×</button></div>
        <div className="cx-drawer-items">{cartItems.length === 0 ? <div className="cx-empty-cart"><span>🛍</span><b>Your bag is taking a break.</b><p>Add something delicious from today’s menu.</p></div> : cartItems.map((item) => <div className="cx-cart-row" key={item.id}>
          <img src={item.imageUrl || PHOTOS[item.id] || PHOTOS[SAMOSA_ID]} alt="" onError={(event) => { if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = "true"; event.currentTarget.src = PHOTOS[SAMOSA_ID]; } }}/><div className="cx-cart-item-info"><b>{item.name}</b><span>{money(item.price)} each</span></div><div className="cx-stepper"><button onClick={() => updateQuantity(item, -1)} aria-label={`Remove one ${item.name}`}>−</button><b>{cart[item.id]}</b><button onClick={() => updateQuantity(item, 1)} disabled={cart[item.id] >= 10 || quantity >= 20} aria-label={`Add one ${item.name}`}>+</button></div>
        </div>)}</div>
        <div className="cx-bag-footer">{discount > 0 && <div className="cx-savings"><Icon name="spark" size={16}/> Study break combo <b>−{money(discount)}</b></div>}<div className="cx-total-line"><span>Total <small>· confirmed at checkout</small></span><strong>{money(total)}</strong></div><button disabled={!quantity} className="cx-checkout-button" onClick={() => { setCheckoutOpen(true); setDrawerOpen(false); }}>Continue to checkout <Icon name="arrow"/></button><p>Cash on pickup · No payment in app</p></div>
      </aside></div>}

      {checkoutOpen && <div className="cx-overlay cx-checkout-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending && !authBusy) setCheckoutOpen(false); }}><section className="cx-checkout" aria-labelledby="checkout-title">
        <div className="cx-checkout-head"><div><span className="cx-eyebrow">ONE LAST STEP</span><h2 id="checkout-title">{student ? "Ready for pickup?" : "Verify your student email"}</h2><p>{student ? "Your campus order, made easy." : "We’ll send a code once. This device stays signed in for 180 days."}</p></div><button className="cx-close" disabled={pending || authBusy} onClick={() => setCheckoutOpen(false)} aria-label="Close checkout">×</button></div>
        {!student && authStep === "details" && <form onSubmit={sendCode} className="cx-auth-form">
          <label>CUI registration number<input required autoComplete="username" maxLength={30} placeholder="e.g. SP24-BSE-015" pattern="(CIIT/)?(FA|SP)[0-9]{2}-[A-Za-z]{2,4}-[0-9]{3,4}(/ISB)?" value={universityId} onChange={(event) => setUniversityId(event.target.value.toUpperCase())}/><small>Use your CUI format: FA or SP, batch year, program and roll number.</small></label>
          <label>Name for pickup<input required autoComplete="name" minLength={2} maxLength={60} placeholder="Your full name" value={name} onChange={(event) => setName(event.target.value.replace(/[^\p{L} ]/gu, ""))}/><small>Letters and spaces only.</small></label>
          <label>Email address<input required type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value.trim())}/><small>Use an inbox you can open right now.</small></label>
          {authNotice && <p className="cx-form-notice" role="status">{authNotice}</p>}
          <button disabled={authBusy} className="cx-checkout-button">{authBusy ? "Sending your code…" : "Email me a verification code"}<Icon name="arrow"/></button>
          <p className="cx-privacy-note">Your device is remembered in a secure, private cookie. A new device needs email verification. The code confirms email access; CUI enrollment is not checked against campus records.</p>
        </form>}
        {!student && authStep === "code" && <form onSubmit={verifyCode} className="cx-auth-form">
          <div className="cx-code-hint"><span>✉</span><div><b>Check your inbox</b><small>We sent a six-digit code to {email}.</small></div></div>
          <label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}/></label>
          {authNotice && <p className="cx-form-notice" role="status">{authNotice}</p>}
          <button disabled={authBusy || otp.length !== 6} className="cx-checkout-button">{authBusy ? "Verifying…" : "Verify and continue"}<Icon name="arrow"/></button>
          <button type="button" disabled={authBusy} className="cx-text-button" onClick={() => void resendCode()}>Resend code</button>
          <button type="button" className="cx-text-button" onClick={() => { setAuthStep("details"); setAuthNotice(""); }}>Use another email or CUI ID</button>
        </form>}
        {student && <form onSubmit={submitOrder} className="cx-order-confirm">
          <div className="cx-verified"><span><Icon name="check"/></span><div><b>Verified student</b><small>{student.name} · this device remembered</small></div></div>
          <div className="cx-order-summary">{cartItems.map((item) => <div key={item.id}><span>{cart[item.id]} × {item.name}</span><b>{money(item.price * cart[item.id])}</b></div>)}{discount > 0 && <div className="cx-summary-discount"><span>Study break combo</span><b>−{money(discount)}</b></div>}<div className="cx-summary-total"><span>Total · cash on pickup</span><b>{money(total)}</b></div></div>
          {notice && <p className="cx-form-notice error" role="alert">{notice}</p>}
          <button disabled={pending || !quantity} className="cx-checkout-button">{pending ? "Sending to the kitchen…" : "Place order · cash on pickup"}<Icon name="arrow"/></button>
          <p className="cx-privacy-note">Your order status is private to this device and its order key.</p>
        </form>}
      </section></div>}
    </main>
  );
}

function readSavedOrders(): Array<{ id: string; key: string; token: string; createdAt: string; status?: string }> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("cx_orders") ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return parsed.filter((item): item is { id: string; key: string; token: string; createdAt: string; status?: string } => item && typeof item.id === "string" && typeof item.key === "string" && typeof item.token === "string" && typeof item.createdAt === "string" && Number.isFinite(new Date(item.createdAt).getTime()) && !(new Date(item.createdAt).getTime() < cutoff && ["picked_up", "cancelled", "expired"].includes(String(item.status)))).slice(0, 5);
  } catch { return []; }
}

"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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

const CART_KEY = "cx_cart";

function money(amount: number): string {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);
}

export function StudentMenu() {
  const router = useRouter();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Cart>({});
  const [cartLoaded, setCartLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
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
      setLoadError("We couldn't load the menu. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        const clean = Object.fromEntries(Object.entries(saved).filter(([id, qty]) =>
          /^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(qty) && (qty as number) > 0 && (qty as number) <= 10,
        )) as Cart;
        setCart(clean);
      }
    } catch {
      try { localStorage.removeItem(CART_KEY); } catch { /* Storage is unavailable in this browser. */ }
    }
    setCartLoaded(true);
    void loadMenu();
    const online = () => setOffline(false);
    const offlineEvent = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineEvent);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineEvent);
    };
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch { /* Keep the cart usable for this visit when storage is blocked. */ }
  }, [cart, cartLoaded]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const quantity = Object.values(cart).reduce((sum, count) => sum + count, 0);
  const cartItems = useMemo(() => menu.filter((item) => cart[item.id] > 0), [menu, cart]);
  const total = cartItems.reduce((sum, item) => sum + item.price * cart[item.id], 0);

  function updateQuantity(item: MenuItem, delta: number) {
    setNotice("");
    setCart((current) => {
      const totalCount = Object.values(current).reduce((sum, count) => sum + count, 0);
      if (delta > 0 && ((current[item.id] ?? 0) >= 10 || totalCount >= 20 ||
        (!(item.id in current) && Object.keys(current).length >= 10))) return current;
      const next = { ...current };
      const value = Math.min(10, Math.max(0, (next[item.id] ?? 0) + delta));
      if (value === 0) delete next[item.id];
      else next[item.id] = value;
      return next;
    });
  }

  function cartFingerprint(): string {
    return JSON.stringify({
      universityId: universityId.trim().toUpperCase(),
      customerName: name.trim(),
      items: Object.entries(cart).sort(([a], [b]) => a.localeCompare(b)),
    });
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || quantity === 0) return;
    submitLock.current = true;
    setPending(true);
    setNotice("");
    setRetryAt(null);
    try {
      const refreshed = await fetch("/api/menu", { cache: "no-store" });
      if (!refreshed.ok) throw new Error("menu");
      const latest = (await refreshed.json() as { items: MenuItem[] }).items;
      const byId = new Map(latest.map((item) => [item.id, item]));
      const changed = Object.entries(cart).some(([id]) => {
        const before = menu.find((item) => item.id === id);
        const after = byId.get(id);
        return !before || !after || before.price !== after.price || !after.isAvailable;
      });
      setMenu(latest);
      if (changed) {
        setNotice("The menu changed since you added these items. Review availability and prices, then submit again.");
        return;
      }

      const fingerprint = cartFingerprint();
      let attempt = attemptRef.current;
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = { fingerprint, key: crypto.randomUUID() };
        attemptRef.current = attempt;
      }
      const idempotencyKey = attempt.key;
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId,
          customerName: name,
          items: Object.entries(cart).map(([menuItemId, count]) => ({ menuItemId, quantity: count })),
          idempotencyKey,
        }),
      });
      const body = await response.json() as {
        orderId?: string;
        orderKey?: string;
        token?: string;
        createdAt?: string;
        error?: { code?: string };
      };
      if (!response.ok) {
        const code = body.error?.code;
        if (code === "rate_limited") {
          const seconds = Number(response.headers.get("Retry-After")) || 30;
          setRetryAt(Date.now() + seconds * 1000);
          setNotice("Too many orders just now. Please wait before trying again.");
        } else if (code === "active_order_limit") {
          setNotice("You already have two active orders. Wait for one to finish before ordering again.");
        } else if (code === "item_unavailable") {
          setNotice("An item in your cart is no longer available. Remove it and try again.");
        } else if (code === "duplicate_submit") {
          setNotice("This order was already sent. Check My orders before trying again.");
        } else if (code === "daily_limit") {
          setNotice("The canteen has reached today's order limit. Please try again tomorrow.");
        } else if (code === "validation_error") {
          setNotice("Check your name, University ID, and cart details.");
        } else {
          setNotice("The order service is unavailable. Your cart is saved; try again shortly.");
        }
        if (["validation_error", "item_unavailable", "active_order_limit", "daily_limit"].includes(code ?? "")) {
          attemptRef.current = null;
        }
        return;
      }
      if (!body.orderId || !body.orderKey || !body.token) throw new Error("order");
      const stored = readSavedOrders();
      const next = [
        { id: body.orderId, key: body.orderKey, token: body.token, createdAt: body.createdAt ?? new Date().toISOString(), status: "received" },
        ...stored.filter((order) => order.id !== body.orderId),
      ].slice(0, 5);
      try {
        localStorage.setItem("cx_orders", JSON.stringify(next));
      } catch {
        attemptRef.current = null;
        setCart({});
        try { localStorage.removeItem(CART_KEY); } catch { /* Storage is unavailable in this browser. */ }
        setNotice(`Order placed. Show pickup token ${body.token} to the counter staff; this device couldn't save the tracking key.`);
        return;
      }
      try { localStorage.removeItem(CART_KEY); } catch { /* The order key is saved; cart cleanup can be retried later. */ }
      setCart({});
      attemptRef.current = null;
      router.push("/order");
    } catch {
      setNotice("Couldn't confirm the order. Your cart is saved; retry the same cart to avoid a duplicate.");
    } finally {
      submitLock.current = false;
      setPending(false);
    }
  }

  const retrySeconds = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;

  return (
    <main className="min-h-screen bg-[#fffaf2] text-stone-950">
      {offline && <div role="status" className="bg-stone-900 px-4 py-2 text-center text-sm font-semibold text-white">You're offline. Your cart is saved on this device.</div>}
      <header className="sticky top-0 z-20 border-b border-amber-100 bg-[#fffaf2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/" className="text-xl font-black tracking-tight" aria-label="CanteenX home">Canteen<span className="text-orange-700">X</span></a>
          <nav className="flex items-center gap-3">
            <a href="/order" className="min-h-11 rounded-full px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-amber-100">My orders</a>
            <button onClick={() => setDrawerOpen(true)} className="min-h-11 rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-white hover:bg-stone-800">
              Cart <span className="ml-1 rounded-full bg-orange-600 px-2 py-0.5">{quantity}</span>
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
        <div className="overflow-hidden rounded-[2rem] bg-[#25392e] px-6 py-9 text-white sm:px-10 sm:py-12">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-300">Campus canteen · COMSATS</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight sm:text-6xl">Good food. Less waiting.</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-stone-200 sm:text-lg">Order ahead, follow your pickup status, and collect when it’s ready.</p>
          <div className="mt-6 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-amber-100">Cash on pickup · No payment in app</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-[0.15em] text-orange-700">Made fresh on campus</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">Today’s menu</h2></div>
          <span className="hidden text-sm text-stone-500 sm:block">Prices in PKR</span>
        </div>
        {loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
            <p className="font-semibold text-red-900">{loadError}</p>
            <button onClick={() => void loadMenu()} className="mt-4 min-h-11 rounded-xl bg-red-900 px-4 font-bold text-white">Try again</button>
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-amber-100 bg-white p-8 text-stone-600" role="status">Loading today’s menu…</div>
        ) : menu.length === 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-white p-8 text-stone-600">There are no menu items available right now.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {menu.map((item) => (
              <article key={item.id} className="flex min-h-52 flex-col rounded-2xl border border-amber-100 bg-white p-5 shadow-[0_3px_20px_rgba(60,40,10,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="text-lg font-extrabold">{item.name}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p></div>
                  {!item.isAvailable && <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600">Out of stock</span>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                  <div><p className="font-extrabold text-orange-800">{money(item.price)}</p><p className="mt-1 text-xs text-stone-500">About {item.prepMinutes} min prep</p></div>
                  <button disabled={!item.isAvailable || (cart[item.id] ?? 0) >= 10 || quantity >= 20 || (!(item.id in cart) && Object.keys(cart).length >= 10)} onClick={() => updateQuantity(item, 1)} className="min-h-11 min-w-11 rounded-full bg-amber-100 px-4 font-black text-orange-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Add ${item.name} to cart`}>＋</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {drawerOpen && <div className="fixed inset-0 z-40 flex justify-end bg-stone-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
        <aside className="flex h-full w-full max-w-md flex-col bg-white p-5 shadow-2xl sm:p-7" aria-label="Shopping cart">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Your cart</h2><button onClick={() => setDrawerOpen(false)} className="min-h-11 min-w-11 rounded-full bg-stone-100 text-xl" aria-label="Close cart">×</button></div>
          <div className="mt-6 flex-1 space-y-4 overflow-y-auto">
            {cartItems.length === 0 ? <p className="rounded-xl bg-amber-50 p-4 text-stone-600">Your cart is empty. Add something tasty from the menu.</p> : cartItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
                <div><p className="font-bold">{item.name}</p><p className="mt-1 text-sm text-stone-500">{money(item.price * cart[item.id])}</p></div>
                <div className="flex items-center gap-2"><button onClick={() => updateQuantity(item, -1)} className="min-h-11 min-w-11 rounded-full bg-stone-100 font-bold" aria-label={`Remove one ${item.name}`}>−</button><span className="w-6 text-center font-bold">{cart[item.id]}</span><button disabled={!item.isAvailable || (cart[item.id] ?? 0) >= 10 || quantity >= 20 || (!(item.id in cart) && Object.keys(cart).length >= 10)} onClick={() => updateQuantity(item, 1)} className="min-h-11 min-w-11 rounded-full bg-stone-100 font-bold disabled:opacity-50" aria-label={`Add one ${item.name}`}>＋</button></div>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-200 pt-5"><div className="flex justify-between text-lg font-extrabold"><span>Estimated total</span><span>{money(total)}</span></div><p className="mt-1 text-xs text-stone-500">Final total is confirmed when you place the order.</p><button disabled={!quantity} onClick={() => { setCheckoutOpen(true); setDrawerOpen(false); }} className="mt-5 min-h-12 w-full rounded-xl bg-orange-700 px-4 font-bold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50">Continue to checkout</button></div>
        </aside>
      </div>}

      {checkoutOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/50 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setCheckoutOpen(false); }}>
        <section className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8" aria-labelledby="checkout-title">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-[0.15em] text-orange-700">Almost there</p><h2 id="checkout-title" className="mt-1 text-2xl font-black">Pickup details</h2></div><button disabled={pending} onClick={() => setCheckoutOpen(false)} className="min-h-11 min-w-11 rounded-full bg-stone-100 text-xl" aria-label="Close checkout">×</button></div>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-950">Use a dummy ID and name for the demo.</p>
          <form onSubmit={submitOrder} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-stone-700">University ID<input required minLength={3} maxLength={30} pattern="[A-Za-z0-9\-_/]+" value={universityId} onChange={(event) => setUniversityId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base outline-none focus:border-orange-700 focus:ring-2 focus:ring-orange-100" /></label>
            <label className="block text-sm font-semibold text-stone-700">Name for pickup<input required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 px-4 text-base outline-none focus:border-orange-700 focus:ring-2 focus:ring-orange-100" /></label>
            {cartItems.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm text-stone-600"><span>{cart[item.id]} × {item.name}</span><span>{money(item.price * cart[item.id])}</span></div>)}
            {notice && <p role="alert" aria-live="polite" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">{notice}{retrySeconds > 0 && <span> Try again in {retrySeconds}s.</span>}</p>}
            <div className="flex items-center justify-between border-t border-stone-200 pt-4 font-extrabold"><span>Estimated total</span><span>{money(total)}</span></div>
            <button disabled={pending || !quantity} className="min-h-12 w-full rounded-xl bg-orange-700 px-4 font-bold text-white hover:bg-orange-800 disabled:cursor-wait disabled:opacity-60">{pending ? "Placing order…" : "Place order · cash on pickup"}</button>
          </form>
        </section>
      </div>}

      {quantity > 0 && !drawerOpen && !checkoutOpen && <button onClick={() => setDrawerOpen(true)} className="fixed bottom-4 left-4 right-4 z-30 mx-auto flex min-h-14 max-w-md items-center justify-between rounded-2xl bg-stone-950 px-5 font-bold text-white shadow-xl sm:hidden"><span>{quantity} item{quantity === 1 ? "" : "s"} in cart</span><span>View · {money(total)}</span></button>}
    </main>
  );
}

function readSavedOrders(): Array<{ id: string; key: string; token: string; createdAt: string; status?: string }> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem("cx_orders") ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return parsed.filter((item): item is { id: string; key: string; token: string; createdAt: string; status?: string } =>
      item && typeof item.id === "string" && typeof item.key === "string" && typeof item.token === "string" &&
      typeof item.createdAt === "string" && Number.isFinite(new Date(item.createdAt).getTime()) && !(new Date(item.createdAt).getTime() < cutoff &&
        ["picked_up", "cancelled", "expired"].includes(String(item.status))),
    ).slice(0, 5);
  } catch {
    return [];
  }
}

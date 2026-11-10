"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StaffLoginForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!response.ok) {
        setMessage(response.status === 429 ? "Too many attempts. Wait a little and try again." : "PIN not accepted. Check it and try again.");
        return;
      }
      setPin("");
      router.replace("/kitchen");
    } catch {
      setMessage("Couldn't reach the canteen right now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label htmlFor="staff-pin" className="block text-sm font-semibold text-stone-700">Staff PIN</label>
      <input
        id="staff-pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        minLength={4}
        maxLength={12}
        required
        value={pin}
        onChange={(event) => setPin(event.target.value)}
        className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg tracking-[0.25em] outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
      />
      {message && <p role="alert" className="text-sm font-medium text-red-700">{message}</p>}
      <button
        disabled={pending}
        className="w-full rounded-xl bg-orange-700 px-5 py-3 font-bold text-white transition hover:bg-orange-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Checking…" : "Continue to kitchen"}
      </button>
    </form>
  );
}

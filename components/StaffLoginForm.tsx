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
    <form onSubmit={submit} className="cx-staff-auth-form">
      <label htmlFor="staff-pin">Staff PIN</label>
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
        className="cx-staff-pin"
      />
      {message && <p role="alert" className="cx-alert cx-alert-error">{message}</p>}
      <button
        disabled={pending}
        className="cx-checkout-button"
      >
        {pending ? "Checking…" : "Continue to kitchen"}
      </button>
    </form>
  );
}

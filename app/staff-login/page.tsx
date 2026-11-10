import { StaffLoginForm } from "@/components/StaffLoginForm";
import { CanteenHeader } from "@/components/CanteenHeader";

export default function StaffLoginPage() {
  return (
    <main className="cx-page cx-staff-login-page">
      <CanteenHeader links={[{ href: "/", label: "Student menu" }, { href: "/demo", label: "Try demo" }]} />
      <div className="cx-login-wrap">
        <section className="cx-login-card">
          <span className="cx-login-mark" aria-hidden="true">C</span>
          <span className="cx-eyebrow">CANTEENX STAFF</span>
          <h1>Welcome back<span>.</span></h1>
          <p>Enter your staff PIN to open the live kitchen queue and canteen analytics.</p>
          <StaffLoginForm />
          <div className="cx-login-note"><span>🔒</span> Staff access is protected and monitored.</div>
          <div className="cx-login-demo"><span>Just exploring?</span><a href="/demo">Open the interactive demo <ArrowIcon /></a><small>Sample data only · won’t change live orders</small></div>
        </section>
        <div className="cx-login-aside"><span className="cx-kicker">CUI ISLAMABAD · CANTEEN OPERATIONS</span><h2>Great service<br /><em>starts behind<br />the counter.</em></h2><p>Keep the queue moving. Students see status updates as you prepare each order.</p></div>
      </div>
    </main>
  );
}

function ArrowIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}

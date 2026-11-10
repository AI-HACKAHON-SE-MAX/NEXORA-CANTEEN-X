import { StaffLoginForm } from "@/components/StaffLoginForm";

export default function StaffLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50 px-5 py-12 text-stone-950">
      <section className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-700">CanteenX staff</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Kitchen sign in</h1>
        <p className="mt-3 text-stone-600">Enter the staff PIN to open the live order queue.</p>
        <StaffLoginForm />
      </section>
    </main>
  );
}

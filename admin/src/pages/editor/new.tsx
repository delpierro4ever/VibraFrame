// src/pages/editor/new.tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

// Types for better error handling
type ApiOk = { ok: true; eventId: string; eventCode: string };
type ApiErr = { ok: false; error: string; message?: string };
type ApiResp = ApiOk | ApiErr;

export default function NewEventPage() {
  const router = useRouter();

  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Validation: Ensure name isn't just whitespace
  const canSubmit = useMemo(() => eventName.trim().length > 0, [eventName]);

  const onNext = async () => {
    if (!canSubmit || loading) return;

    setLoading(true);
    setErr(null);

    try {
      const response = await fetch("/api/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eventName.trim(),
          description: description.trim(),
        }),
      });

      // Runtime check: Ensure response is actually JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned a non-JSON response. Check your API route.");
      }

      const data = (await response.json()) as ApiResp;

      if (!response.ok || !data.ok) {
        const msg = !data.ok ? (data.message || data.error) : `Server Error (${response.status})`;
        setErr(msg);
        setLoading(false);
        return;
      }

      // Success: Redirect to the draft editor
      // We use the ID returned from the API
      await router.push(`/editor/draft/${encodeURIComponent(data.eventId)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "A network error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>ViroEvent | Create Draft</title>
        {/* Inline style fallback for the CSS variables in case they aren't in globals.css */}
        <style>{`
          :root {
            --viro-primary: #21c7e8;
            --viro-secondary: #8b8cf9;
          }
        `}</style>
      </Head>

      <main className="min-h-screen text-white bg-[#14133A]">
        {/* Animated/Gradient Background Wrapper */}
        <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_0%,rgba(33,199,232,0.18),transparent_60%),radial-gradient(900px_600px_at_80%_10%,rgba(139,140,249,0.16),transparent_55%),linear-gradient(180deg,#14133A,rgba(27,26,74,1))]">
          
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-10 border-b border-white/10 bg-black/10 backdrop-blur-md">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[linear-gradient(135deg,var(--viro-primary),var(--viro-secondary))] shadow-[0_10px_30px_rgba(33,199,232,0.25)]" />
                <div className="leading-tight">
                  <div className="text-lg font-semibold">ViroEvent</div>
                  <div className="text-xs text-white/70">Create an event flyer experience</div>
                </div>
              </div>

              <div className="text-sm text-white/75">
                <span className="hidden sm:inline">Step 1 of 2 — </span>
                <span className="font-medium text-white">Create Draft</span>
              </div>
            </div>
          </header>

          {/* Form Content */}
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="mx-auto max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight">Create Event</h1>
              <p className="mt-2 text-white/75">
                Start with a private draft. You’ll upload the background and position the photo + name slots next.
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white/80">Event name</label>
                    <input
                      type="text"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="e.g. AFCON Finals Night"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[var(--viro-primary)] focus:ring-2 focus:ring-[rgba(33,199,232,0.2)] placeholder:text-white/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80">Description (Optional)</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Briefly describe the event..."
                      rows={3}
                      className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-[var(--viro-primary)] focus:ring-2 focus:ring-[rgba(33,199,232,0.2)] placeholder:text-white/30"
                    />
                  </div>
                </div>

                <button
                  onClick={onNext}
                  disabled={!canSubmit || loading}
                  className="mt-8 w-full rounded-xl py-4 font-bold text-[#0D0B26] shadow-[0_15px_35px_rgba(33,199,232,0.3)] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-[linear-gradient(135deg,var(--viro-primary),#2FE3FF)] hover:brightness-110"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </span>
                  ) : "Next Step →"}
                </button>

                {err && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 animate-in fade-in slide-in-from-top-1">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {err}
                  </div>
                )}
              </div>

              {/* Progress Help */}
              <div className="mt-8 rounded-xl bg-white/5 p-4 text-sm text-white/60">
                <h3 className="mb-2 font-medium text-white/90">What happens next?</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--viro-primary)]">1.</span>
                    Upload your flyer graphic (.png or .jpg)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[var(--viro-primary)]">2.</span>
                    Drag the dynamic slots into position
                  </li>
                </ul>
              </div>

              <footer className="mt-14 text-center text-xs text-white/30">
                &copy; {new Date().getFullYear()} ViroEvent Engine. All rights reserved.
              </footer>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
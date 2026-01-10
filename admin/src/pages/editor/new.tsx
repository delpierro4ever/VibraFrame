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
        <title>Create Event | ViroEvent</title>
        <meta name="description" content="Create a new event poster template" />
      </Head>

      <main className="min-h-screen text-white">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-[var(--viro-border)] bg-[rgba(11,11,20,0.75)] backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] border border-[var(--viro-border)]">
                <span className="text-[var(--viro-primary)] font-black">V</span>
              </span>
              <div className="leading-tight">
                <div className="font-extrabold tracking-tight">ViroEvent</div>
                <div className="text-xs text-[var(--viro-muted)] -mt-0.5">
                  Personalized posters
                </div>
              </div>
            </div>

            <div className="text-sm text-[var(--viro-muted)]">
              <span className="hidden sm:inline">Step 1 of 2 — </span>
              <span className="font-medium text-white">Create Draft</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <section className="mx-auto max-w-3xl px-4 py-10 lg:py-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] mb-4">
              <span className="text-[var(--viro-primary)] font-semibold">
                Step 1
              </span>
              <span className="text-[var(--viro-muted)]">
                • Event details
              </span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-black tracking-tight">
              Create Event
            </h1>
            <p className="mt-3 text-[var(--viro-muted)] text-base lg:text-lg">
              Start with a private draft. You'll upload the background and position the photo + name slots next.
            </p>
          </div>

          {/* Form Card */}
          <div className="viro-card p-6 lg:p-8 border border-[var(--viro-border)]">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Event name
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. AFCON Finals Night"
                  className="viro-input"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Description <span className="text-[var(--viro-muted)] font-normal">(Optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe the event..."
                  className="viro-input"
                  rows={3}
                />
              </div>
            </div>

            <button
              onClick={onNext}
              disabled={!canSubmit || loading}
              className="mt-6 w-full viro-btn viro-btn-primary"
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
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--viro-danger)]/30 bg-[var(--viro-danger)]/10 px-4 py-3 text-sm text-red-200">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {err}
              </div>
            )}
          </div>

          {/* Help Section */}
          <div className="mt-8 viro-card p-5 border border-[var(--viro-border)]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">What happens next?</div>
              <span className="text-xs px-3 py-1 rounded-full border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)]">
                2 steps
              </span>
            </div>

            <div className="space-y-2 text-sm text-[var(--viro-muted)]">
              <div className="flex items-start gap-2">
                <span className="text-[var(--viro-primary)] font-bold">1.</span>
                Upload your flyer graphic (.png or .jpg)
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[var(--viro-primary)] font-bold">2.</span>
                Drag the dynamic slots into position
              </div>
            </div>
          </div>

          <footer className="mt-10 text-center text-xs text-[var(--viro-muted)]">
            © {new Date().getFullYear()} ViroEvent. Powered by <span className="text-white">Alita Automations</span>.
          </footer>
        </section>
      </main>
    </>
  );
}
// admin/src/pages/index.tsx
import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";

function cleanEventCode(raw: string): string {
  // remove leading "=" if someone pasted from spreadsheet
  return raw.replace(/^=+/, "").trim().toUpperCase();
}

export default function HomePage() {
  const router = useRouter();
  const year = useMemo(() => new Date().getFullYear(), []);

  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const goToEvent = async () => {
    const c = cleanEventCode(code);
    if (!c) {
      setErr("Enter your event code (example: VF-3FFQX)");
      return;
    }
    setErr(null);
    await router.push(`/e/${encodeURIComponent(c)}`);
  };

  return (
    <>
      <Head>
        <title>ViroEvent — Personalized Event Posters in Seconds</title>
        <meta
          name="description"
          content="Organizers upload one poster template. Attendees add their photo + name and instantly download a 1080×1080 flyer."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen text-white">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-[var(--viro-border)] bg-[rgba(11,11,20,0.75)] backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.06)] border border-[var(--viro-border)]">
                <span className="text-[var(--viro-primary)] font-black">V</span>
              </span>
              <div className="leading-tight">
                <div className="font-extrabold tracking-tight">ViroEvent</div>
                <div className="text-xs text-[var(--viro-muted)] -mt-0.5">
                  Personalized posters
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="viro-btn viro-btn-primary"
              >
                Organizer dashboard
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-10 lg:pt-16">
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)]">
                <span className="text-[var(--viro-primary)] font-semibold">
                  Mobile-first
                </span>
                <span className="text-[var(--viro-muted)]">
                  • 1080×1080 export • Share-ready
                </span>
              </div>

              <h1 className="text-3xl lg:text-5xl font-black tracking-tight">
                One event poster.
                <br />
                <span className="text-[var(--viro-primary)]">
                  Every attendee gets their own.
                </span>
              </h1>

              <p className="text-[var(--viro-muted)] text-base lg:text-lg leading-relaxed">
                Organizers upload a poster template (background + photo slot + name slot).
                Attendees add their photo and name in seconds, then download and share
                a personalized flyer.
              </p>

              {/* Attendee quick entry */}
              <div className="viro-card p-4 border border-[var(--viro-border)]">
                <div className="text-sm font-semibold">I have an event code</div>
                <div className="text-xs text-[var(--viro-muted)] mt-1">
                  Enter the code from the organizer (example: <span className="text-white">VF-3FFQX</span>)
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="VF-XXXXX"
                    className="flex-1 viro-input"
                    autoCapitalize="characters"
                    inputMode="text"
                  />
                  <button
                    type="button"
                    onClick={goToEvent}
                    className="viro-btn viro-btn-primary"
                  >
                    Open
                  </button>
                </div>

                {err ? (
                  <div className="mt-2 text-xs text-[var(--viro-danger)]">{err}</div>
                ) : null}

                <div className="mt-3 text-xs text-[var(--viro-muted)]">
                  No app install. Works perfectly on WhatsApp & Instagram.
                </div>
              </div>

              {/* Organizer CTA */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href="/admin"
                  className="viro-btn viro-btn-primary text-center"
                >
                  Create an event (organizer)
                </Link>

                <Link
                  href="/auth"
                  className="viro-btn border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] hover:opacity-90 text-center"
                >
                  Login / Register
                </Link>
              </div>
            </div>

            {/* How it works */}
            <div className="viro-card p-5 lg:p-6 border border-[var(--viro-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold">How it works</div>
                <span className="text-xs px-3 py-1 rounded-full border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)]">
                  3 steps
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] flex items-center justify-center font-extrabold text-[var(--viro-primary)]">
                    1
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Organizer creates event</div>
                    <div className="text-xs text-[var(--viro-muted)]">
                      Upload background + position photo + name.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] flex items-center justify-center font-extrabold text-[var(--viro-primary)]">
                    2
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Share a link</div>
                    <div className="text-xs text-[var(--viro-muted)]">
                      Example: <span className="text-white">/e/VF-XXXXX</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] flex items-center justify-center font-extrabold text-[var(--viro-primary)]">
                    3
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Attendees generate posters</div>
                    <div className="text-xs text-[var(--viro-muted)]">
                      Upload photo + name → download → share.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] p-4">
                  <div className="text-xs text-[var(--viro-muted)]">Output</div>
                  <div className="font-extrabold">1080×1080</div>
                </div>
                <div className="rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] p-4">
                  <div className="text-xs text-[var(--viro-muted)]">Time</div>
                  <div className="font-extrabold">~10 seconds</div>
                </div>
              </div>

              <div className="mt-5">
                <Link
                  href="/admin"
                  className="w-full inline-flex justify-center viro-btn viro-btn-primary"
                >
                  Organizer dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-14">
          <div className="viro-card p-6 lg:p-8 border border-[var(--viro-border)]">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <div className="text-xl font-black">Ready to create your first event?</div>
                <div className="text-sm text-[var(--viro-muted)] mt-1">
                  Upload a poster template once. Let attendees do the rest.
                </div>
              </div>
              <div className="flex gap-3 w-full lg:w-auto">
                <Link
                  href="/admin"
                  className="flex-1 lg:flex-none text-center viro-btn viro-btn-primary"
                >
                  Create event
                </Link>
                <button
                  type="button"
                  onClick={goToEvent}
                  className="flex-1 lg:flex-none text-center viro-btn border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] hover:opacity-90"
                >
                  Open event code
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--viro-border)] bg-[rgba(11,11,20,0.55)]">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-[var(--viro-muted)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              © {year} <span className="text-white font-semibold">ViroEvent</span>. Powered by{" "}
              <span className="text-white">Alita Automations</span>.
            </div>
            <div className="text-xs">
              Contact: <span className="text-white">+237 6725 229 13</span>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

type ApiOk = {
  ok: true;
  eventCode: string;
  event: {
    eventId: string | null;
    name: string | null;
    description: string | null;
    published: boolean | null;
    createdAt: string | null;
  } | null;
  totalDownloads: number;
  daily: Array<{ day: string; downloads: number }>;
};

type ApiErr = { ok: false; error: string; message?: string };
type ApiResp = ApiOk | ApiErr;

function cleanEventCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^=+/, "").trim();
}

export default function AnalyticsPage() {
  const router = useRouter();

  const eventCode = useMemo(() => {
    const q = router.query.eventCode;
    return cleanEventCode(typeof q === "string" ? q : Array.isArray(q) ? q[0] : "");
  }, [router.query.eventCode]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiOk | null>(null);

  useEffect(() => {
    if (!router.isReady || !eventCode) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const r = await fetch(`/api/analytics?eventCode=${encodeURIComponent(eventCode)}&days=30`);
        const json = (await r.json()) as ApiResp;
        if (cancelled) return;

        if (!r.ok || !json.ok) {
          setErr(!json.ok ? json.message || json.error : `Request failed (${r.status})`);
          setData(null);
          return;
        }

        setData(json);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, eventCode]);

  const daily = data?.daily ?? [];
  const maxDay = Math.max(1, ...daily.map((d) => d.downloads || 0));

  const attendeeLink =
    typeof window !== "undefined" ? `${window.location.origin}/e/${eventCode}` : `/e/${eventCode}`;

  return (
    <>
      <Head>
        <title>{`ViroEvent Analytics | ${eventCode}`}</title>
      </Head>

      <main className="min-h-screen text-white p-4 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-sm text-[var(--viro-muted)] hover:opacity-90">
              ← Back to home
            </Link>

            <Link
              href={`/e/${eventCode}`}
              className="viro-btn border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] hover:opacity-90"
            >
              Open attendee link
            </Link>
          </div>

          <div className="viro-card p-5 border border-[var(--viro-border)]">
            <div className="text-sm text-[var(--viro-muted)]">Analytics</div>
            <div className="text-2xl font-black mt-1">
              Event: <span className="text-[var(--viro-primary)]">{eventCode}</span>
            </div>

            {loading ? (
              <div className="mt-4 text-[var(--viro-muted)]">Loading…</div>
            ) : err ? (
              <div className="mt-4 text-[var(--viro-danger)]">{err}</div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] p-4">
                    <div className="text-xs text-[var(--viro-muted)]">Total downloads</div>
                    <div className="text-3xl font-black mt-1">{data?.totalDownloads ?? 0}</div>
                  </div>

                  <div className="rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] p-4">
                    <div className="text-xs text-[var(--viro-muted)]">Attendee link</div>
                    <div className="text-sm font-semibold mt-1 break-all">{attendeeLink}</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold mb-2">Daily downloads (last 14 days)</div>

                  <div className="rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] p-4">
                    <div className="space-y-2">
                      {daily.slice(-14).map((d) => {
                        const pct = Math.round((100 * (d.downloads || 0)) / maxDay);
                        return (
                          <div key={d.day} className="flex items-center gap-3">
                            <div className="w-[92px] text-xs text-[var(--viro-muted)]">{d.day}</div>
                            <div className="flex-1 h-3 rounded-full bg-black/30 overflow-hidden">
                              <div
                                className="h-full bg-[var(--viro-primary)]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="w-10 text-right text-xs text-white/90">{d.downloads}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 text-[11px] text-[var(--viro-muted)]">
                      API loads 30 days, UI shows last 14 for readability.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 text-xs text-[var(--viro-muted)] text-center">
            Powered by <span className="text-white">Alita Automations</span> • +237 6725 229 13
          </div>
        </div>
      </main>
    </>
  );
}

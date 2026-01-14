// admin/src/pages/analytics/[eventCode].tsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

type DailyRow = { day: string; downloads: number };

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
  daily: DailyRow[];
};

type ApiErr = { ok: false; error: string; message?: string };
type ApiResp = ApiOk | ApiErr;

function cleanEventCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^=+/, "").trim();
}

function sumDownloads(rows: DailyRow[]) {
  return rows.reduce((acc, r) => acc + (Number.isFinite(r.downloads) ? r.downloads : 0), 0);
}

export default function AnalyticsPage() {
  const router = useRouter();

  const eventCode = useMemo(() => {
    const q = router.query.eventCode;
    return cleanEventCode(typeof q === "string" ? q : Array.isArray(q) ? q[0] : "");
  }, [router.query.eventCode]);

  const [days, setDays] = useState<7 | 30 | 90>(30);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiOk | null>(null);

  const [copied, setCopied] = useState(false);

  const attendeeLink = useMemo(() => {
    if (typeof window === "undefined") return `/e/${eventCode}`;
    return `${window.location.origin}/e/${eventCode}`;
  }, [eventCode]);

  const copyAttendeeLink = async () => {
    try {
      await navigator.clipboard.writeText(attendeeLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = attendeeLink;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {
        setCopied(false);
      }
    }
  };

  useEffect(() => {
    if (!router.isReady || !eventCode) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const r = await fetch(
          `/api/analytics?eventCode=${encodeURIComponent(eventCode)}&days=${days}`
        );
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
  }, [router.isReady, eventCode, days]);

  const daily = data?.daily ?? [];
  const maxDay = Math.max(1, ...daily.map((d) => d.downloads || 0));

  const last7 = daily.slice(-7);
  const downloadsLast7 = sumDownloads(last7);

  return (
    <>
      <Head>
        <title>{`ViroEvent Analytics | ${eventCode}`}</title>
      </Head>

      <main className="min-h-screen text-white p-4 lg:p-8">
        <div className="mx-auto max-w-3xl">
          {/* top nav */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/admin" className="text-sm text-[var(--viro-muted)] hover:opacity-90">
              ← Back to dashboard
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href={`/e/${eventCode}`}
                className="viro-btn border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] hover:opacity-90"
              >
                Open attendee page
              </Link>
            </div>
          </div>

          <div className="viro-card p-5 border border-[var(--viro-border)]">
            <div className="text-sm text-[var(--viro-muted)]">Organizer Analytics</div>

            <div className="mt-1 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <div className="text-2xl font-black">
                  Event: <span className="text-[var(--viro-primary)]">{eventCode}</span>
                </div>
                {data?.event?.name ? (
                  <div className="text-sm text-white/90 mt-1">{data.event.name}</div>
                ) : null}
                {data?.event?.description ? (
                  <div className="text-xs text-[var(--viro-muted)] mt-1">{data.event.description}</div>
                ) : null}
              </div>

              {/* days toggle */}
              <div className="flex items-center gap-2">
                {[7, 30, 90].map((d) => {
                  const active = days === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d as 7 | 30 | 90)}
                      className={[
                        "px-3 py-2 rounded-xl text-xs font-semibold border transition",
                        active
                          ? "border-[var(--viro-primary)] bg-[rgba(255,138,42,0.12)]"
                          : "border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] hover:opacity-90",
                      ].join(" ")}
                    >
                      {d}d
                    </button>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="mt-4 text-[var(--viro-muted)]">Loading…</div>
            ) : err ? (
              <div className="mt-4 text-[var(--viro-danger)]">{err}</div>
            ) : (
              <>
                {/* stats */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] p-4">
                    <div className="text-xs text-[var(--viro-muted)]">Total downloads</div>
                    <div className="text-3xl font-black mt-1">{data?.totalDownloads ?? 0}</div>
                  </div>

                  <div className="rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] p-4">
                    <div className="text-xs text-[var(--viro-muted)]">Downloads (last 7d)</div>
                    <div className="text-3xl font-black mt-1">{downloadsLast7}</div>
                  </div>

                  <div className="rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] p-4">
                    <div className="text-xs text-[var(--viro-muted)]">Attendee link</div>
                    <div className="text-[11px] text-white/90 mt-1 break-all">{attendeeLink}</div>
                    <button
                      type="button"
                      onClick={copyAttendeeLink}
                      className="mt-2 w-full viro-btn border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] hover:opacity-90"
                    >
                      {copied ? "Copied ✅" : "Copy link"}
                    </button>
                  </div>
                </div>

                {/* chart */}
                <div className="mt-6">
                  <div className="text-sm font-semibold mb-2">Daily Downloads ({days} days)</div>

                  <div className="rounded-xl border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] p-6">
                    <div className="h-40 flex items-end gap-1">
                      {daily.map((d, i) => {
                        const pct = maxDay > 0 ? Math.round((100 * (d.downloads || 0)) / maxDay) : 0;
                        const isToday = i === daily.length - 1;
                        return (
                          <div
                            key={d.day}
                            className="flex-1 flex flex-col items-center justify-end group relative"
                            style={{ height: "100%" }}
                          >
                            {/* Bar */}
                            <div
                              className={`w-full max-w-[8px] rounded-t-sm transition-all duration-500 ${isToday ? 'bg-[var(--viro-primary)]' : 'bg-[var(--viro-primary)]/40 hover:bg-[var(--viro-primary)]/60'}`}
                              style={{ height: `${Math.max(pct, 4)}%` }}
                            ></div>

                            {/* Hover Tooltip */}
                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                              <div className="bg-black/80 backdrop-blur border border-white/10 text-xs px-2 py-1 rounded whitespace-nowrap">
                                <span className="text-[var(--viro-muted)]">{d.day}:</span> <span className="font-bold">{d.downloads}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* X-Axis Labels (show only some to avoid crowding) */}
                    <div className="mt-2 flex justify-between text-[10px] text-[var(--viro-muted)]">
                      <div>{daily[0]?.day}</div>
                      <div>{daily[Math.floor(daily.length / 2)]?.day}</div>
                      <div>{daily[daily.length - 1]?.day}</div>
                    </div>

                    {daily.length === 0 ? (
                      <div className="text-sm text-[var(--viro-muted)] text-center mt-3">
                        No downloads recorded yet.
                      </div>
                    ) : null}
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

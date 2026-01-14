// src/pages/admin/index.tsx
import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps, NextApiRequest } from "next";
import { supabaseServer } from "@/lib/supabase/server";

import type { Template } from "@/types/template";

type EventRow = {
  id: string;
  event_code: string | null;
  name: string | null;
  description: string | null;
  published: boolean | null;
  created_at: string | null;
  status: string | null;
  template: Template | null;
  backgroundUrl?: string | null;
};

type Props = {
  events: EventRow[];
  errorMsg: string | null;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const supabase = supabaseServer(ctx.req as NextApiRequest, ctx.res as any);

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  if (!session) {
    return {
      redirect: {
        destination: "/auth?next=/admin",
        permanent: false,
      },
    };
  }

  const { data, error } = await supabase
    .from("events")
    .select("id,event_code,name,description,published,created_at,status,template")
    .order("created_at", { ascending: false });

  const events = (data ?? []) as EventRow[];

  // 2. Collect background paths
  const paths: string[] = [];
  events.forEach((e) => {
    const url = e.template?.background?.url;
    if (typeof url === "string" && url.length > 0) {
      paths.push(url);
    }
  });

  // 3. Create signed URLs (batch)
  if (paths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from("vf-event-assets")
      .createSignedUrls(paths, 3600); // 1 hour link

    if (signedData) {
      // correctly map path -> signedUrl
      // createSignedUrls returns { error, path, signedUrl }[]
      const map = new Map<string, string>();
      signedData.forEach((item) => {
        if (item.path && item.signedUrl) {
          map.set(item.path, item.signedUrl);
        }
      });

      // assign back to events
      events.forEach((e) => {
        const url = e.template?.background?.url;
        if (url && map.has(url)) {
          e.backgroundUrl = map.get(url)!;
        }
      });
    }
  };

  return {
    props: {
      events,
      errorMsg: error?.message ?? null,
    },
  };
};

export default function AdminDashboard({ events, errorMsg }: Props) {
  return (
    <>
      <Head>
        <title>Dashboard | ViroEvent</title>
      </Head>

      <main className="min-h-screen px-4 py-6 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Organizer Dashboard</h1>
              <p className="text-sm text-white/60 mt-1">
                Your events (only you can see these).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/editor/new"
                className="rounded-xl bg-orange-500 text-white px-4 py-2 font-medium hover:bg-orange-600 transition"
              >
                + Create Event
              </Link>

              <Link
                href="/admin/logout"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Logout
              </Link>
            </div>
          </div>

          {errorMsg ? (
            <div className="mt-4 text-sm text-red-300 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
              {errorMsg}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden"
              >
                <Link
                  href={`/editor/draft/${encodeURIComponent(e.id)}`}
                  className="block"
                >
                  <div className={`aspect-square relative flex items-center justify-center text-white/40 text-sm overflow-hidden group ${e.backgroundUrl ? '' : 'bg-black/30'}`}>
                    {e.backgroundUrl ? (
                      <>
                        <img
                          src={e.backgroundUrl}
                          alt={e.name || "Event Background"}
                          className="absolute inset-0 w-full h-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        {/* Preview Overlays */}
                        {e.template?.photo && (
                          <div
                            className="absolute border-2 border-[var(--viro-primary)] bg-black/20"
                            style={{
                              left: `${(e.template.photo.x ?? 0.5) * 100}%`,
                              top: `${(e.template.photo.y ?? 0.35) * 100}%`,
                              width: `${((e.template.photo.size ?? 220) / (e.template.canvas?.width ?? 1080)) * 100}%`,
                              height: `${((e.template.photo.size ?? 220) / (e.template.canvas?.width ?? 1080)) * 100}%`,
                              transform: "translate(-50%, -50%)",
                              borderRadius: e.template.photo.shape === "circle" ? "50%" : "4px",
                            }}
                          >
                            <div className="w-full h-full flex items-center justify-center text-[8px] opacity-40">Photo</div>
                          </div>
                        )}
                        {e.template?.text && (
                          <div
                            className="absolute border border-white/30 bg-white/10 flex items-center justify-center text-[6px] font-bold text-white/50"
                            style={{
                              left: `${(e.template.text.x ?? 0.5) * 100}%`,
                              top: `${(e.template.text.y ?? 0.78) * 100}%`,
                              width: `${(e.template.text.w ?? 0.82) * 100}%`,
                              height: `${(e.template.text.h ?? 0.14) * 100}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            NAME SLOT
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <span className="text-3xl font-black text-[var(--viro-primary)]">V</span>
                        <span>No Background</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <div className="font-medium">{e.name ?? "Untitled Event"}</div>

                    {e.description ? (
                      <div className="text-xs text-white/60 mt-1 line-clamp-2">
                        {e.description}
                      </div>
                    ) : (
                      <div className="text-xs text-white/40 mt-1">No description</div>
                    )}

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-white/60">{e.event_code ?? "Not published"}</span>
                      <span className={e.published ? "text-green-300" : "text-yellow-300"}>
                        {e.published ? "Published" : "Draft"}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-white/50">
                      {e.status ? `Status: ${e.status}` : ""}
                    </div>
                  </div>
                </Link>

                {/* Analytics Button */}
                {e.published && e.event_code && (
                  <div className="px-3 pb-3">
                    <Link
                      href={`/analytics/${encodeURIComponent(e.event_code)}`}
                      className="block text-center text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                    >
                      📊 View Analytics
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>

          {events.length === 0 && !errorMsg ? (
            <div className="mt-10 text-white/60 text-sm">
              No events yet. Click <b>Create Event</b> to make your first one.
            </div>
          ) : null}

          <div className="mt-10 text-xs text-white/60 text-center">
            Powered by <span className="text-white">Alita Automations</span>
          </div>
        </div>
      </main>
    </>
  );
}

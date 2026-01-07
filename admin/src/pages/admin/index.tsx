// src/pages/admin/index.tsx
import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps, NextApiRequest } from "next";
import { supabaseServer } from "@/lib/supabase/server";

type EventRow = {
  id: string;
  event_code: string | null;
  name: string | null;
  description: string | null;
  published: boolean | null;
  created_at: string | null;
  status: string | null;
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
    .select("id,event_code,name,description,published,created_at,status")
    .order("created_at", { ascending: false });

  return {
    props: {
      events: (data ?? []) as EventRow[],
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
              <Link
                key={e.id}
                href={`/editor?eventId=${encodeURIComponent(e.id)}`}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition overflow-hidden"
              >
                <div className="aspect-square bg-black/30 flex items-center justify-center text-white/40 text-sm">
                  Thumbnail (next)
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

// admin/src/pages/api/analytics.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Err = { ok: false; error: string; message?: string };

type DailyRow = { day: string; downloads: number };

type Ok = {
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

type Resp = Ok | Err;

function getQueryString(q: unknown): string {
  if (typeof q === "string") return q.trim();
  if (Array.isArray(q)) return String(q[0] ?? "").trim();
  return "";
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function toDailyRow(x: unknown): DailyRow {
  if (!isRecord(x)) return { day: "", downloads: 0 };

  const dayVal = x.day;
  const downloadsVal = x.downloads;

  const day = typeof dayVal === "string" ? dayVal : String(dayVal ?? "");
  const downloads =
    typeof downloadsVal === "number"
      ? downloadsVal
      : Number(downloadsVal ?? 0);

  return { day, downloads: Number.isFinite(downloads) ? downloads : 0 };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const eventCode = getQueryString(req.query.eventCode);
  if (!eventCode) {
    return res.status(400).json({
      ok: false,
      error: "bad_request",
      message: "Missing eventCode",
    });
  }

  const daysStr = getQueryString(req.query.days);
  const daysNum = /^\d+$/.test(daysStr) ? Number(daysStr) : 30;
  const days = clampInt(daysNum, 7, 120);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      ok: false,
      error: "server_misconfigured",
      message: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1) Event details
    const { data: eventRow, error: evErr } = await supabase
      .from("events")
      .select("id, name, description, published, created_at, event_code")
      .eq("event_code", eventCode)
      .maybeSingle();

    if (evErr) {
      return res.status(500).json({
        ok: false,
        error: "events_query_failed",
        message: evErr.message,
      });
    }

    // 2) Total downloads
    const { count, error: countErr } = await supabase
      .from("event_downloads")
      .select("*", { count: "exact", head: true })
      .eq("event_code", eventCode);

    if (countErr) {
      return res.status(500).json({
        ok: false,
        error: "downloads_count_failed",
        message: countErr.message,
      });
    }

    // 3) Daily downloads via RPC
    const { data: dailyRaw, error: rpcErr } = await supabase.rpc(
      "vf_downloads_daily",
      {
        p_event_code: eventCode,
        p_days: days,
      }
    );

    if (rpcErr) {
      return res.status(500).json({
        ok: false,
        error: "rpc_failed",
        message: rpcErr.message,
      });
    }

    const daily: DailyRow[] = Array.isArray(dailyRaw)
      ? dailyRaw.map(toDailyRow)
      : [];

    return res.status(200).json({
      ok: true,
      eventCode,
      event: eventRow
        ? {
            eventId: (eventRow as { id?: string }).id ?? null,
            name: (eventRow as { name?: string | null }).name ?? null,
            description: (eventRow as { description?: string | null }).description ?? null,
            published: (eventRow as { published?: boolean | null }).published ?? null,
            createdAt: (eventRow as { created_at?: string | null }).created_at ?? null,
          }
        : null,
      totalDownloads: count ?? 0,
      daily,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "unknown_error",
      message: e instanceof Error ? e.message : "Unknown error",
    });
  }
}

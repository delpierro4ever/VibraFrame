// src/pages/api/get-event-by-code.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Template = {
  canvas?: { width?: number; height?: number };
  photo?: { x?: number; y?: number; size?: number; shape?: "circle" | "square" };
  text?: { x?: number; y?: number; w?: number; h?: number; size?: number; color?: string };
  background?: { url?: string };
};

type EventRow = {
  id: string;
  event_code: string;
  template: Template | null;
  created_at: string | null;
  published: boolean | null;
};

type Ok = {
  ok: true;
  eventCode: string;
  data: {
    ok: true;
    event: {
      eventId: string;
      eventCode: string;
      template: Template | null;
      createdAt: string | null;
      backgroundPath: string | null;
      backgroundSignedUrl: string | null;
    };
  };
};

type Err = { ok: false; error: string; message?: string; upstream?: unknown };
type Resp = Ok | Err;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function getBackgroundPathFromTemplate(tpl: unknown): string | null {
  if (!isPlainObject(tpl)) return null;

  // No `any`: use safe indexed access
  const bg = (tpl as Record<string, unknown>)["background"];
  if (!isPlainObject(bg)) return null;

  const url = (bg as Record<string, unknown>)["url"];
  return isNonEmptyString(url) ? url.trim() : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const eventCodeRaw = req.query.eventCode;
    const eventCode = typeof eventCodeRaw === "string" ? eventCodeRaw.replace(/^=+/, "").trim() : "";
    if (!isNonEmptyString(eventCode)) {
      return res.status(400).json({ ok: false, error: "Missing eventCode" });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_BUCKET ?? "vf-event-assets";

    if (!url || !key) {
      return res.status(500).json({
        ok: false,
        error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("events")
      .select("id,event_code,template,created_at,published")
      .eq("event_code", eventCode)
      .eq("published", true)
      .maybeSingle<EventRow>();

    if (error) {
      console.error("Supabase query error:", error);
      return res.status(500).json({
        ok: false,
        error: "Supabase query failed",
        message: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({ ok: false, error: "Event not found or not published" });
    }

    const backgroundPath = getBackgroundPathFromTemplate(data.template);
    console.log("Extracted background path:", backgroundPath);

    let backgroundSignedUrl: string | null = null;
    if (backgroundPath) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(backgroundPath, 60 * 60);

      if (signedError) {
        console.error("Signed URL error:", signedError);
      } else if (signedData?.signedUrl) {
        backgroundSignedUrl = signedData.signedUrl;
        console.log("Generated signed URL:", backgroundSignedUrl);
      }
    } else {
      console.log("No background path found in template");
    }

    return res.status(200).json({
      ok: true,
      eventCode: String(data.event_code),
      data: {
        ok: true,
        event: {
          eventId: String(data.id),
          eventCode: String(data.event_code),
          template: data.template ?? null,
          createdAt: data.created_at ?? null,
          backgroundPath,
          backgroundSignedUrl,
        },
      },
    });
  } catch (e) {
    console.error("Unexpected error in get-event-by-code:", e);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      message: e instanceof Error ? e.message : "Unknown error",
    });
  }
}

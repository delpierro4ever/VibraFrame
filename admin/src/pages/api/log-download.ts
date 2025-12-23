import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Ok = { ok: true };
type Err = { ok: false; error: string; message?: string };
type Resp = Ok | Err;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const body: unknown = req.body;
  if (!isPlainObject(body)) return res.status(400).json({ ok: false, error: "Invalid body" });

  const eventId = body.eventId;
  const eventCode = body.eventCode;

  if (!isNonEmptyString(eventId) || !isNonEmptyString(eventCode)) {
    return res.status(400).json({ ok: false, error: "Missing eventId or eventCode" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: "Missing Supabase env" });

  const supabase = createClient(url, key);

  const { error } = await supabase.from("event_downloads").insert({
    event_id: eventId,
    event_code: eventCode,
  });

  if (error) return res.status(500).json({ ok: false, error: "Insert failed", message: error.message });

  return res.status(200).json({ ok: true });
}

// src/pages/api/update-template.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Ok = { ok: true };
type Err = { ok: false; error: string; message?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { eventId, template } = req.body;

  if (!eventId || !template) {
    return res.status(400).json({ ok: false, error: "Missing eventId or template" });
  }

  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !key) {
    return res.status(500).json({ ok: false, error: "Supabase env not set" });
  }

  const supabase = createClient(url, key);

  const { error } = await supabase
    .from("events")
    .update({ template })
    .eq("id", eventId);

  if (error) {
    return res.status(500).json({
      ok: false,
      error: "Failed to save template",
      message: error.message,
    });
  }

  return res.status(200).json({ ok: true });
}
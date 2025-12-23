import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type Ok = { ok: true; eventId: string; eventCode: string };
type Err = { ok: false; error: string; message?: string };

const supabase = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

function makeCode(prefix = "VE") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${out}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "MethodNotAllowed" });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      ok: false,
      error: "MissingEnv",
      message: "Missing Supabase env vars",
    });
  }

  const body = req.body as { name?: unknown; description?: unknown } | undefined;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";

  if (!name) {
    return res.status(400).json({
      ok: false,
      error: "BadRequest",
      message: "Event name is required",
    });
  }

  // ✅ SAFE DEFAULT TEMPLATE (NON-NULL)
  const emptyTemplate = {
    canvas: { width: 1080, height: 1080 },
    photo: { x: 0.5, y: 0.4, size: 220, shape: "circle" },
    text: {
      x: 0.5,
      y: 0.78,
      w: 0.82,
      h: 0.14,
      content: "YOUR NAME",
      font: "Poppins",
      color: "#FFFFFF",
      size: 48,
    },
    background: { url: "" },
  };

  // retry for unique code
  for (let attempt = 0; attempt < 5; attempt++) {
    const eventCode = makeCode("VE");

    const { data, error } = await supabase
      .from("events")
      .insert({
        name,
        description,
        published: false,
        event_code: eventCode,
        template: emptyTemplate, // ✅ FIX
      })
      .select("id,event_code")
      .single();

    if (!error && data) {
      return res.status(200).json({
        ok: true,
        eventId: data.id,
        eventCode: data.event_code,
      });
    }

    const msg = error?.message?.toLowerCase() ?? "";
    const isDup = msg.includes("duplicate") || msg.includes("unique");

    if (!isDup) {
      return res.status(500).json({
        ok: false,
        error: "DatabaseError",
        message: error?.message ?? "Failed to create event",
      });
    }
  }

  return res.status(500).json({
    ok: false,
    error: "ServerError",
    message: "Could not generate unique event code",
  });
}

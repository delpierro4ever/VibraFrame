// src/pages/api/publish-event.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** JSON type (Supabase-style) */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          event_code: string | null;
          published: boolean | null;
          created_at: string | null;
          template: Json | null; // ✅ no any
          name: string | null;
          description: string | null;
        };
        Insert: {
          id?: string;
          event_code?: string | null;
          published?: boolean | null;
          created_at?: string | null;
          template?: Json | null; // ✅ no any
          name?: string | null;
          description?: string | null;
        };
        Update: {
          id?: never;
          event_code?: string | null;
          published?: boolean | null;
          created_at?: string | null;
          template?: Json | null; // ✅ no any
          name?: string | null;
          description?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

type TypedSupabaseClient = SupabaseClient<Database>;

type Ok = { ok: true; eventId: string; eventCode: string };
type Err = { ok: false; error: string; message?: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function generateEventCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "VF-";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function generateUniqueEventCode(supabase: TypedSupabaseClient): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = generateEventCode();
    const { data } = await supabase
      .from("events")
      .select("id")
      .eq("event_code", code)
      .maybeSingle();

    if (!data) return code;
  }
  throw new Error("Failed to generate unique event code after 10 attempts");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const eventId = isNonEmptyString(req.body?.eventId) ? req.body.eventId.trim() : "";
  if (!eventId) {
    return res.status(400).json({ ok: false, error: "Missing eventId" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({
      ok: false,
      error: "Supabase environment variables not configured",
    });
  }

  const supabase = createClient<Database>(url, key);

  let eventCode: string;
  try {
    eventCode = await generateUniqueEventCode(supabase);
  } catch (e: unknown) {
    return res.status(500).json({
      ok: false,
      error: "Could not generate unique event code",
      message: e instanceof Error ? e.message : "Unknown error",
    });
  }

  // ✅ remove `as any` — now types will match
  const { error } = await supabase
    .from("events")
    .update({
      event_code: eventCode,
      published: true,
    })
    .eq("id", eventId);

  if (error) {
    return res.status(500).json({
      ok: false,
      error: "Failed to publish event",
      message: error.message,
    });
  }

  return res.status(200).json({ ok: true, eventId, eventCode });
}

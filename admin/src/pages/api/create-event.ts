// src/pages/api/create-event.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { serialize, type SerializeOptions } from "cookie";

type Ok = { ok: true; eventId: string; eventCode: string };
type Err = { ok: false; error: string; message?: string };

type CookiePair = { name: string; value: string };

type CookieMethodsServerDeprecated = {
  get(name: string): string | undefined;
  set(name: string, value: string, options?: Partial<SerializeOptions>): void;
  remove(name: string, options?: Partial<SerializeOptions>): void;
};

type CookieMethodsServer = {
  getAll(): CookiePair[];
  setAll(cookies: { name: string; value: string; options: Partial<SerializeOptions> }[]): void;
};

function appendSetCookieHeader(res: NextApiResponse, cookie: string) {
  const prev = res.getHeader("Set-Cookie");

  if (!prev) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }

  if (typeof prev === "string") {
    res.setHeader("Set-Cookie", [prev, cookie]);
    return;
  }

  if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, cookie]);
    return;
  }

  res.setHeader("Set-Cookie", cookie);
}

function buildCookiesAdapter(
  req: NextApiRequest,
  res: NextApiResponse
): CookieMethodsServerDeprecated & CookieMethodsServer {
  return {
    // ✅ Deprecated API
    get(name: string) {
      return req.cookies[name];
    },
    set(name: string, value: string, options?: Partial<SerializeOptions>) {
      appendSetCookieHeader(res, serialize(name, value, { path: "/", ...options }));
    },
    remove(name: string, options?: Partial<SerializeOptions>) {
      appendSetCookieHeader(res, serialize(name, "", { path: "/", maxAge: 0, ...options }));
    },

    // ✅ New API
    getAll() {
      return Object.entries(req.cookies).map(([name, value]) => ({
        name,
        value: value ?? "",
      }));
    },
    setAll(cookies: { name: string; value: string; options: Partial<SerializeOptions> }[]) {
      cookies.forEach((c) => {
        appendSetCookieHeader(res, serialize(c.name, c.value, { path: "/", ...c.options }));
      });
    },
  };
}

function makeCode(prefix = "VE") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${out}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "MethodNotAllowed" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return res.status(500).json({
      ok: false,
      error: "MissingEnv",
      message: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    });
  }

  const supabase = createServerClient(url, anon, {
    cookies: buildCookiesAdapter(req, res),
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return res.status(401).json({ ok: false, error: "Unauthorized", message: userError.message });
  }

  const user = userData.user;
  if (!user) {
    return res.status(401).json({ ok: false, error: "Unauthorized", message: "Please login" });
  }

  const body = req.body as { name?: unknown; description?: unknown } | undefined;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!name) {
    return res.status(400).json({ ok: false, error: "BadRequest", message: "Event name is required" });
  }

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

  for (let attempt = 0; attempt < 5; attempt++) {
    const eventCode = makeCode("VE");

    const { data, error } = await supabase
      .from("events")
      .insert({
        owner_id: user.id,
        name,
        description,
        status: "draft",
        published: false,
        event_code: eventCode,
        template: emptyTemplate,
      })
      .select("id,event_code")
      .single();

    if (!error && data) {
      return res.status(200).json({ ok: true, eventId: data.id, eventCode: data.event_code });
    }

    const msg = (error?.message ?? "").toLowerCase();
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

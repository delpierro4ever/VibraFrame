import type { NextApiRequest, NextApiResponse } from "next";

type JsonRecord = Record<string, unknown>;

function safeJsonParse(text: string): JsonRecord {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
    return { ok: false, message: "Upstream JSON was not an object" };
  } catch {
    return { ok: false, message: "Invalid JSON from upstream", raw: text };
  }
}

const N8N_URL = process.env.N8N_SUBMIT_URL;
const SECRET = process.env.VIBRAFRAME_WEBHOOK_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse<JsonRecord>) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    if (!N8N_URL || !SECRET) {
      return res.status(500).json({ ok: false, message: "Server misconfigured (missing env vars)" });
    }

    const bodyUnknown: unknown = req.body;

    const body =
      bodyUnknown && typeof bodyUnknown === "object" && !Array.isArray(bodyUnknown)
        ? (bodyUnknown as Record<string, unknown>)
        : null;

    const eventCode = typeof body?.eventCode === "string" ? body.eventCode : "";
    const name = typeof body?.name === "string" ? body.name : "";
    const photoDataUrl = typeof body?.photoDataUrl === "string" ? body.photoDataUrl : "";
    const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl : "";

    if (!eventCode) return res.status(400).json({ ok: false, message: "Missing eventCode" });
    if (!name) return res.status(400).json({ ok: false, message: "Missing name" });

    if (!photoDataUrl && !photoUrl) {
      return res.status(400).json({ ok: false, message: "Missing photoDataUrl or photoUrl" });
    }

    const upstream = await fetch(N8N_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vibraframe-secret": SECRET,
      },
      body: JSON.stringify({
        eventCode,
        name,
        photoDataUrl: photoDataUrl || null,
        photoUrl: photoUrl || null,
      }),
    });

    const text = await upstream.text();
    const data = safeJsonParse(text);

    return res.status(upstream.status).json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected error";
    return res.status(500).json({ ok: false, message: msg });
  }
}

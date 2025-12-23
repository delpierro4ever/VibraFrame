import type { NextApiRequest, NextApiResponse } from "next";

type Ok = { ok: true; status: 200; eventId: string };
type Err = { ok: false; status: number; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ ok: false, status: 405, error: "Method not allowed" });
  }

  const { name, description } = req.body as {
    name?: unknown;
    description?: unknown;
  };

  if (typeof name !== "string" || !name.trim()) {
    return res
      .status(400)
      .json({ ok: false, status: 400, error: "Missing event name" });
  }

  try {
    const r = await fetch(process.env.N8N_CREATE_DRAFT_EVENT_URL!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description:
          typeof description === "string" ? description.trim() : "",
      }),
    });

    const data = (await r.json()) as
      | { ok: true; eventId: string }
      | { ok: false; error: string };

    if (!r.ok || !data.ok) {
      return res.status(500).json({
        ok: false,
        status: 500,
        error: !data.ok ? data.error : "Draft creation failed",
      });
    }

    return res.status(200).json({
      ok: true,
      status: 200,
      eventId: data.eventId,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
}

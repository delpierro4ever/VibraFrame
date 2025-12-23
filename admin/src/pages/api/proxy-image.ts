import type { NextApiRequest, NextApiResponse } from "next";

function isSafeHttpUrl(u: string) {
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = typeof req.query.url === "string" ? req.query.url : "";

  if (!url || !isSafeHttpUrl(url)) {
    return res.status(400).json({ ok: false, error: "Invalid url" });
  }

  try {
    const r = await fetch(url, { method: "GET" });

    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `Upstream ${r.status}` });
    }

    const contentType = r.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await r.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "ProxyError",
      message: e instanceof Error ? e.message : "Unknown error",
    });
  }
}

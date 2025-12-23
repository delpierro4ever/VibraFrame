import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { type File as FormidableFile, type Files, type Fields } from "formidable";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

export const config = { api: { bodyParser: false } };

type Ok = { ok: true; path: string };
type Err = { ok: false; error: string };
type Resp = Ok | Err;

function parseForm(req: NextApiRequest): Promise<{ fields: Fields; files: Files }> {
  const form = formidable({ multiples: false });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function firstString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function getSingleFile(input: unknown): FormidableFile | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    const f = input[0];
    return isFormidableFile(f) ? f : null;
  }
  return isFormidableFile(input) ? input : null;
}

function isFormidableFile(v: unknown): v is FormidableFile {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.originalFilename === "string" ||
    typeof obj.mimetype === "string" ||
    typeof obj.size === "number"
  );
}

function getLocalPath(file: FormidableFile): string {
  // Formidable v2 uses `filepath`. Older versions used `path`.
  const maybe = file as unknown as { filepath?: unknown; path?: unknown };
  if (typeof maybe.filepath === "string") return maybe.filepath;
  if (typeof maybe.path === "string") return maybe.path;
  return "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return res.status(500).json({ ok: false, error: "Missing Supabase env vars" });
    }

    const supabase = createClient(url, key);

    const { fields, files } = await parseForm(req);
    const eventId = firstString(fields.eventId);

    // "file" is the field name you append in FormData
    const fileUnknown = (files as unknown as Record<string, unknown>)["file"];
    const file = getSingleFile(fileUnknown);

    if (!eventId || !file) {
      return res.status(400).json({ ok: false, error: "Missing eventId or file" });
    }

    const localPath = getLocalPath(file);
    if (!localPath) {
      return res.status(400).json({ ok: false, error: "Formidable file path missing" });
    }

    const buffer = fs.readFileSync(localPath);

    const originalName = typeof file.originalFilename === "string" ? file.originalFilename : "";
    const ext = originalName.includes(".") ? originalName.split(".").pop() || "png" : "png";
    const storagePath = `events/${eventId}/background/original.${ext}`;

    const contentType =
      typeof file.mimetype === "string" && file.mimetype ? file.mimetype : "image/png";

    const { error } = await supabase.storage.from("vf-event-assets").upload(storagePath, buffer, {
      upsert: true,
      contentType,
    });

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    // IMPORTANT: we only return the STORAGE PATH
    return res.status(200).json({ ok: true, path: storagePath });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" });
  }
}

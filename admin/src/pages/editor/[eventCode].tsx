import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import DraggableBox from "./DraggableBox";

type ServerProps =
  | { ok: true; eventCode: string; data: unknown }
  | {
      ok: false;
      eventCode: string;
      error: string;
      message?: string;
      upstream?: unknown;
    };

type Template = {
  canvas: { width: number; height: number };
  photo: { x: number; y: number; size: number; shape: "circle" };
  text: {
    x: number;
    y: number;
    w: number;
    h: number;
    content: string;
    font: string;
    color: string;
    size: number;
  };
  background?: { url?: string };
};

type UpstreamEvent = { event?: { template?: unknown } };

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function getTemplateFromUpstream(data: unknown): Template | null {
  if (!isRecord(data)) return null;

  const evt = (data as UpstreamEvent).event;
  if (!evt || !isRecord(evt)) return null;

  const t = evt.template;
  if (!isRecord(t)) return null;

  const canvas = t.canvas;
  const photo = t.photo;
  const text = t.text;

  if (!isRecord(canvas) || !isRecord(photo) || !isRecord(text)) return null;

  const cw = typeof canvas.width === "number" ? canvas.width : 360;
  const ch = typeof canvas.height === "number" ? canvas.height : 360;

  const px = typeof photo.x === "number" ? photo.x : 0.5;
  const py = typeof photo.y === "number" ? photo.y : 0.3;
  const psize = typeof photo.size === "number" ? photo.size : 128;

  const tx = typeof text.x === "number" ? text.x : 0.5;
  const ty = typeof text.y === "number" ? text.y : 0.78;
  const tw = typeof text.w === "number" ? text.w : 0.82;
  const th = typeof text.h === "number" ? text.h : 0.14;

  const content = typeof text.content === "string" ? text.content : "YOUR NAME";
  const font = typeof text.font === "string" ? text.font : "Poppins";
  const color = typeof text.color === "string" ? text.color : "#FFD54F";
  const size = typeof text.size === "number" ? text.size : 44;

  const bg = t.background;
  const backgroundUrl =
    isRecord(bg) && typeof bg.url === "string" ? bg.url : undefined;

  return {
    canvas: { width: cw, height: ch },
    photo: { x: px, y: py, size: psize, shape: "circle" },
    text: { x: tx, y: ty, w: tw, h: th, content, font, color, size },
    background: backgroundUrl ? { url: backgroundUrl } : undefined,
  };
}

export const getServerSideProps: GetServerSideProps<ServerProps> = async (ctx) => {
  const raw = ctx.params?.eventCode;
  const eventCode = Array.isArray(raw) ? raw[0] : raw;

  if (!eventCode || typeof eventCode !== "string") return { notFound: true };

  const proto =
    (ctx.req.headers["x-forwarded-proto"] as string | undefined) || "http";
  const host = ctx.req.headers.host || "localhost:3000";
  const baseUrl = `${proto}://${host}`;
  const url = `${baseUrl}/api/get-event-by-code?eventCode=${encodeURIComponent(
    eventCode
  )}`;

  try {
    const r = await fetch(url);
    const text = await r.text();
    const parsed = safeJsonParse(text);

    if (!r.ok) {
      return {
        props: {
          ok: false,
          eventCode,
          error: "UpstreamError",
          message: `API returned ${r.status}`,
          upstream: parsed,
        },
      };
    }

    return { props: { ok: true, eventCode, data: parsed } };
  } catch (e) {
    return {
      props: {
        ok: false,
        eventCode,
        error: "ServerError",
        message: e instanceof Error ? e.message : "Unknown error",
      },
    };
  }
};

const FALLBACK: Template = {
  canvas: { width: 360, height: 360 },
  photo: { x: 0.5, y: 0.3, size: 128, shape: "circle" },
  text: {
    x: 0.5,
    y: 0.78,
    w: 0.82,
    h: 0.14,
    content: "YOUR NAME",
    font: "Poppins",
    color: "#FFD54F",
    size: 44,
  },
};

export default function EditorByEventCode(props: ServerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const upstreamTemplate = useMemo(() => {
    if (!props.ok) return null;
    return getTemplateFromUpstream(props.data);
  }, [props]);

  const template = upstreamTemplate ?? FALLBACK;

  // ✅ Hydration-safe: stable initial state (doesn't depend on template)
  const [photoPx, setPhotoPx] = useState<{ x: number; y: number }>({ x: 180, y: 110 });
  const [textPx, setTextPx] = useState<{ x: number; y: number }>({ x: 180, y: 280 });

  const [photoSize, setPhotoSize] = useState<number>(128);
  const [content, setContent] = useState<string>("YOUR NAME");
  const [font, setFont] = useState<string>("Poppins");
  const [color, setColor] = useState<string>("#FFD54F");
  const [textSize, setTextSize] = useState<number>(44);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // ✅ After mount + whenever template changes, sync state
  useEffect(() => {
    setPhotoPx({
      x: Math.round(clamp01(template.photo.x) * template.canvas.width),
      y: Math.round(clamp01(template.photo.y) * template.canvas.height),
    });

    setTextPx({
      x: Math.round(clamp01(template.text.x) * template.canvas.width),
      y: Math.round(clamp01(template.text.y) * template.canvas.height),
    });

    setPhotoSize(template.photo.size);
    setContent(template.text.content);
    setFont(template.text.font);
    setColor(template.text.color);
    setTextSize(template.text.size);
  }, [template]);

  const save = async () => {
    if (!props.ok || !canvasRef.current) return;

    setSaving(true);
    setSaveMsg("");

    const w = canvasRef.current.offsetWidth;
    const h = canvasRef.current.offsetHeight;

    const nextTemplate: Template = {
      canvas: { width: w, height: h },
      photo: {
        x: clamp01(photoPx.x / w),
        y: clamp01(photoPx.y / h),
        size: Math.max(40, Math.min(280, Math.round(photoSize))),
        shape: "circle",
      },
      text: {
        x: clamp01(textPx.x / w),
        y: clamp01(textPx.y / h),
        w: template.text.w,
        h: template.text.h,
        content: content || "YOUR NAME",
        font: font || "Poppins",
        color: color || "#FFFFFF",
        size: Math.max(14, Math.min(120, Math.round(textSize))),
      },
      background: { url: template.background?.url || "" },
    };

    try {
      const r = await fetch("/api/update-template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventCode: props.eventCode, template: nextTemplate }),
      });

      const txt = await r.text();
      const parsed = safeJsonParse(txt);

      const failed =
        !r.ok ||
        (isRecord(parsed) && typeof parsed.ok === "boolean" && parsed.ok === false);

      setSaveMsg(failed ? "❌ Save failed" : "✅ Saved!");
    } catch (e) {
      setSaveMsg(`❌ Save failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`Editor | ${props.eventCode}`}</title>
      </Head>

      <main className="h-screen bg-neutral-950 text-white flex overflow-hidden">
        <aside className="w-[360px] bg-neutral-900 border-r border-neutral-800 p-6">
          <h2 className="text-xl font-bold mb-4">Editor</h2>
          <p className="text-sm text-neutral-300 mb-4">
            Event: <b>{props.eventCode}</b>
          </p>

          <label className="block text-sm mb-2">Name Preview Text</label>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded bg-neutral-800 border border-neutral-700"
          />

          <label className="block text-sm mb-2">Font</label>
          <input
            value={font}
            onChange={(e) => setFont(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded bg-neutral-800 border border-neutral-700"
          />

          <label className="block text-sm mb-2">Color</label>
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded bg-neutral-800 border border-neutral-700"
          />

          <label className="block text-sm mb-2">Text Size (px)</label>
          <input
            type="number"
            value={textSize}
            onChange={(e) => setTextSize(Number(e.target.value))}
            className="w-full mb-4 px-3 py-2 rounded bg-neutral-800 border border-neutral-700"
          />

          <label className="block text-sm mb-2">Photo Size (px)</label>
          <input
            type="number"
            value={photoSize}
            onChange={(e) => setPhotoSize(Number(e.target.value))}
            className="w-full mb-6 px-3 py-2 rounded bg-neutral-800 border border-neutral-700"
          />

          <button
            onClick={save}
            disabled={saving || !props.ok}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black py-3 rounded-lg font-semibold"
          >
            {saving ? "Saving..." : "Save Template"}
          </button>

          {saveMsg && <p className="mt-4 text-sm">{saveMsg}</p>}
        </aside>

        <section className="flex-1 bg-neutral-950 flex items-center justify-center">
          <div
            ref={canvasRef}
            className="relative bg-neutral-800 rounded-xl shadow-lg w-[360px] h-[360px] overflow-hidden"
          >
            <DraggableBox x={photoPx.x} y={photoPx.y} onStop={(x, y) => setPhotoPx({ x, y })}>
              <div
                className="rounded-full border-2 border-dashed border-yellow-500 flex items-center justify-center text-xs text-yellow-400 bg-neutral-900"
                style={{ width: photoSize, height: photoSize }}
              >
                Photo
              </div>
            </DraggableBox>

            <DraggableBox x={textPx.x} y={textPx.y} onStop={(x, y) => setTextPx({ x, y })}>
              <div
                className="bg-neutral-900 border border-yellow-500 rounded text-center"
                style={{
                  width: Math.round(template.text.w * 360),
                  padding: "10px 12px",
                  fontFamily: font,
                  color,
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {content}
              </div>
            </DraggableBox>
          </div>
        </section>
      </main>
    </>
  );
}

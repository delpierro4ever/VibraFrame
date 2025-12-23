// src/pages/e/[eventCode].tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

type Template = {
  canvas?: { width?: number; height?: number };
  photo?: { x?: number; y?: number; size?: number; shape?: "circle" | "square" };
  text?: { x?: number; y?: number; w?: number; h?: number; size?: number; color?: string };
  background?: { url?: string };
};

type ApiOk = {
  ok: true;
  eventCode: string;
  data: {
    ok: true;
    event: {
      eventId: string;
      eventCode: string;
      template: Template | null;
      createdAt: string | null;
      backgroundPath: string | null;
      backgroundSignedUrl: string | null;
    };
  };
};

type ApiErr = { ok: false; error: string; message?: string };
type ApiResp = ApiOk | ApiErr;

const OUT_W = 1080;
const OUT_H = 1080;

function cleanEventCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^=+/, "").trim();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;

  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

async function loadImage(src: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });

  return img;
}

export default function EventCodePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // One shared file input (both controls + preview circle click trigger this)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const eventCode = useMemo(() => {
    const q = router.query.eventCode;
    return cleanEventCode(typeof q === "string" ? q : Array.isArray(q) ? q[0] : "");
  }, [router.query.eventCode]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [event, setEvent] = useState<ApiOk["data"]["event"] | null>(null);

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Fetch event
  useEffect(() => {
    if (!router.isReady || !eventCode) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const r = await fetch(`/api/get-event-by-code?eventCode=${encodeURIComponent(eventCode)}`);
        const data = (await r.json()) as ApiResp;

        if (cancelled) return;

        if (!r.ok || !data.ok) {
          setErr(!data.ok ? data.message || data.error : `Request failed (${r.status})`);
          return;
        }

        setEvent(data.data.event);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, eventCode]);

  // Cleanup photo object URL
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const tpl = event?.template ?? {};

  // Treat x/y as normalized (0..1). Always render in 1080x1080 output space.
  const baseW = tpl.canvas?.width ?? OUT_W;
  const scaleToOut = baseW ? OUT_W / baseW : 1;

  const xNormPhoto = tpl.photo?.x ?? 0.5;
  const yNormPhoto = tpl.photo?.y ?? 0.35;
  const photoSizeBase = tpl.photo?.size ?? 220;
  const photoSizeOut = photoSizeBase * scaleToOut;
  const photoShape = tpl.photo?.shape ?? "circle";

  const xNormText = tpl.text?.x ?? 0.5;
  const yNormText = tpl.text?.y ?? 0.78;
  const textWNorm = tpl.text?.w ?? 0.82;
  const textHNorm = tpl.text?.h ?? 0.14;

  // quick fix: reduce name font a bit (auto-fit later)
  const textSizeBase = (tpl.text?.size ?? 44) * 0.78;
  const textSizeOut = textSizeBase * scaleToOut;

  const textColor = tpl.text?.color ?? "#FFD54F";

  // Compute in OUTPUT space (1080x1080)
  let photoXOut = xNormPhoto * OUT_W;
  let photoYOut = yNormPhoto * OUT_H;

  const r = photoSizeOut / 2;
  photoXOut = clamp(photoXOut, r, OUT_W - r);
  photoYOut = clamp(photoYOut, r, OUT_H - r);

  const textXOut = xNormText * OUT_W;
  const textYOut = yNormText * OUT_H;

  // Preview uses same 420 coordinate math; container scales visually (aspect-square)
  const previewSize = 420;
  const previewScale = previewSize / OUT_W;

  const photoStyle: React.CSSProperties = {
    left: photoXOut * previewScale - (photoSizeOut * previewScale) / 2,
    top: photoYOut * previewScale - (photoSizeOut * previewScale) / 2,
    width: photoSizeOut * previewScale,
    height: photoSizeOut * previewScale,
    borderRadius: photoShape === "circle" ? "9999px" : "12px",
  };

  const textStyle: React.CSSProperties = {
    left: textXOut * previewScale - (textWNorm * OUT_W * previewScale) / 2,
    top: textYOut * previewScale - (textHNorm * OUT_H * previewScale) / 2,
    width: textWNorm * OUT_W * previewScale,
    height: textHNorm * OUT_H * previewScale,
    fontSize: textSizeOut * previewScale,
    color: textColor,
    letterSpacing: "0.5px",
    textShadow: "0 2px 14px rgba(0,0,0,0.55)",
  };

  const pickPhoto = () => {
    fileInputRef.current?.click();
  };

  const onPhotoFile = (file: File) => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
  };

  const generateAndDownload = async () => {
    if (!event?.backgroundSignedUrl || !name.trim() || !photoUrl || !canvasRef.current) return;

    setGenerating(true);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      canvas.width = OUT_W;
      canvas.height = OUT_H;

      // Background
      const bgSrc =
        event.backgroundSignedUrl +
        (event.backgroundSignedUrl.includes("?") ? "&" : "?") +
        "t=" +
        Date.now();

      const bgImg = await loadImage(bgSrc);
      ctx.drawImage(bgImg, 0, 0, OUT_W, OUT_H);

      // Photo (clip + cover)
      const userImg = await loadImage(photoUrl);

      ctx.save();
      ctx.beginPath();

      if (photoShape === "circle") {
        ctx.arc(photoXOut, photoYOut, r, 0, Math.PI * 2);
      } else {
        const half = r;
        const x = photoXOut - half;
        const y = photoYOut - half;
        const rr = 18;
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + 2 * half, y, x + 2 * half, y + 2 * half, rr);
        ctx.arcTo(x + 2 * half, y + 2 * half, x, y + 2 * half, rr);
        ctx.arcTo(x, y + 2 * half, x, y, rr);
        ctx.arcTo(x, y, x + 2 * half, y, rr);
      }

      ctx.clip();

      const dx = photoXOut - r;
      const dy = photoYOut - r;
      const dw = photoSizeOut;
      const dh = photoSizeOut;
      coverDraw(ctx, userImg, dx, dy, dw, dh);

      ctx.restore();

      // Name text
      ctx.font = `800 ${Math.round(textSizeOut)}px Arial, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name.trim().toUpperCase(), textXOut, textYOut);

      // Download
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setGenerating(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${name.trim().toLowerCase().replace(/\s+/g, "-")}-${eventCode}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
          setGenerating(false);
        },
        "image/jpeg",
        0.95
      );
    } catch (e) {
      setGenerating(false);
      setErr(e instanceof Error ? e.message : "Failed to generate flyer");
    }
  };

  const canGenerate =
    !!event?.backgroundSignedUrl && !!name.trim() && !!photoUrl && !generating && !loading && !err;

  return (
    <>
      <Head>
        <title>ViroEvent | {eventCode}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden shared file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPhotoFile(file);
        }}
      />

      {/* Page */}
      <main className="min-h-dvh bg-[var(--viro-bg)] text-white">
        {/* Add bottom padding on mobile so content doesn't hide behind sticky bar */}
        <div className="mx-auto w-full max-w-5xl px-4 py-4 pb-28 sm:px-6 sm:py-6 lg:pb-6">
          {/* Top status */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-[var(--viro-muted)]">Event</div>
              <div className="text-base font-semibold">
                <span className="text-[var(--viro-primary)]">{eventCode || "—"}</span>
              </div>
              {loading ? (
                <div className="mt-1 text-xs text-[var(--viro-muted)]">Loading…</div>
              ) : err ? (
                <div className="mt-1 text-xs text-[var(--viro-danger)]">{err}</div>
              ) : (
                <div className="mt-1 text-xs text-emerald-400">Ready ✅</div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs px-3 py-1 rounded-full border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)]">
                1080×1080
              </span>
              <span className="text-xs px-3 py-1 rounded-full border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)]">
                IG / WhatsApp
              </span>
            </div>
          </div>

          {/* Layout */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr] lg:gap-6">
            {/* PREVIEW */}
            <section className="order-1 lg:order-2">
              <div className="viro-card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-[var(--viro-muted)]">Preview</div>
                  <span className="text-xs px-3 py-1 rounded-full border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)]">
                    Live
                  </span>
                </div>

                <div className="mx-auto w-full max-w-[420px]">
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-2xl bg-black/20">
                    {event?.backgroundSignedUrl ? (
                      <img
                        src={event.backgroundSignedUrl}
                        alt="background"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-black/20" />
                    )}

                    {/* Photo circle */}
                    <button
                      type="button"
                      onClick={pickPhoto}
                      className="absolute overflow-hidden bg-black/30"
                      style={photoStyle}
                      aria-label="Upload photo"
                      title="Tap to upload photo"
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          borderRadius: photoShape === "circle" ? "9999px" : "12px",
                          border: `2px solid ${textColor}`,
                          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                        }}
                      />

                      {photoUrl ? (
                        <img src={photoUrl} alt="photo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/80 text-xs">
                          Tap to upload
                        </div>
                      )}
                    </button>

                    {/* Name */}
                    <div
                      className="absolute flex items-center justify-center font-extrabold text-center"
                      style={textStyle}
                    >
                      {name.trim() || "YOUR NAME"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-center text-xs text-[var(--viro-muted)]">
                  Tap the photo circle to upload. Fill your name below.
                </div>
              </div>
            </section>

            {/* CONTROLS */}
            <aside className="order-2 lg:order-1">
              <div className="viro-card p-4 sm:p-6">
                <label className="text-sm text-[var(--viro-muted)]">Your name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fonjio Peter"
                  className="mt-2 mb-4 viro-input w-full"
                />

                <div className="flex items-center justify-between">
                  <label className="text-sm text-[var(--viro-muted)]">Upload photo</label>
                  <button
                    type="button"
                    className="text-xs text-[var(--viro-primary)] hover:opacity-80"
                    onClick={pickPhoto}
                  >
                    Choose file
                  </button>
                </div>

                <button
                  type="button"
                  onClick={pickPhoto}
                  className="mt-2 mb-4 w-full viro-card p-4 border border-[var(--viro-border)] hover:opacity-90 transition"
                >
                  <div className="text-sm font-semibold">Tap to upload</div>
                  <div className="text-xs text-[var(--viro-muted)] mt-1">
                    Tip: use a clear face photo for best results.
                  </div>
                </button>

                {/* Desktop button (mobile uses sticky bar) */}
                <button
                  onClick={generateAndDownload}
                  disabled={!canGenerate}
                  className="hidden lg:block w-full h-12 viro-btn viro-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? "Generating..." : "Generate & Download"}
                </button>

                <div className="mt-4 text-xs text-[var(--viro-muted)] space-y-1">
                  <div>• Output: 1080×1080 JPG</div>
                  <div>• Perfect for IG / WhatsApp</div>
                  <div>• Auto-fit text is next (if needed).</div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Sticky bottom action bar (MOBILE ONLY) */}
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--viro-border)] bg-[var(--viro-bg)]/90 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto w-full max-w-5xl px-1">
            <button
              onClick={generateAndDownload}
              disabled={!canGenerate}
              className="w-full h-12 rounded-xl bg-[var(--viro-primary)] font-semibold text-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? "Generating..." : "Generate & Download"}
            </button>
            <div className="mt-2 text-center text-[11px] text-[var(--viro-muted)]">
              Make sure your name + photo are set before generating.
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// admin/src/pages/e/[eventCode].tsx
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

  // shared file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // preview box ref (we measure its real width)
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewPx, setPreviewPx] = useState(420);

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

  // ✅ Share state
  const [didDownload, setDidDownload] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareLink = useMemo(() => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "";
    return `${origin}/e/${eventCode}`;
  }, [eventCode]);

  const shareText = useMemo(() => {
    const n = name.trim() ? `(${name.trim()}) ` : "";
    return `🇨🇲🦁 Let’s support the Lions! ${n}Create your FREE custom AFCON poster with your photo + name in seconds.\nTap here: ${shareLink}`;
  }, [name, shareLink]);

  const whatsappHref = useMemo(() => {
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  }, [shareText]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = shareLink;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setCopied(false);
      }
    }
  };

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

  // Measure preview size responsively
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      // keep it sane
      setPreviewPx(Math.max(240, Math.min(420, Math.round(w))));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cleanup photo object URL
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const tpl = event?.template ?? {};

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

  // Make name font 3x smaller than before
  const textSizeBase = (tpl.text?.size ?? 44) / 3;
  const textSizeOut = textSizeBase * scaleToOut;

  const textColor = tpl.text?.color ?? "#FFD54F";

  // Compute output positions (1080 space) + clamp
  let photoXOut = xNormPhoto * OUT_W;
  let photoYOut = yNormPhoto * OUT_H;

  const r = photoSizeOut / 2;
  photoXOut = clamp(photoXOut, r, OUT_W - r);
  photoYOut = clamp(photoYOut, r, OUT_H - r);

  const textXOut = xNormText * OUT_W;
  const textYOut = yNormText * OUT_H;

  // Responsive preview scale based on real previewPx
  const previewScale = previewPx / OUT_W;

  // Use % for positions so it stays correct even when the preview resizes
  const photoStyle: React.CSSProperties = {
    left: `${(photoXOut / OUT_W) * 100}%`,
    top: `${(photoYOut / OUT_H) * 100}%`,
    transform: "translate(-50%, -50%)",
    width: photoSizeOut * previewScale,
    height: photoSizeOut * previewScale,
    borderRadius: photoShape === "circle" ? "9999px" : "12px",
  };

  const textStyle: React.CSSProperties = {
    left: `${(textXOut / OUT_W) * 100}%`,
    top: `${(textYOut / OUT_H) * 100}%`,
    transform: "translate(-50%, -50%)",
    width: textWNorm * previewPx,
    height: textHNorm * previewPx,
    fontSize: textSizeOut * previewScale,
    color: textColor,
    letterSpacing: "0.5px",
    textShadow: "0 2px 14px rgba(0,0,0,0.55)",
  };

  const pickPhoto = () => fileInputRef.current?.click();

  const onPhotoFile = (file: File) => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setDidDownload(false); // ✅ reset share box for new poster
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

      const bgSrc =
        event.backgroundSignedUrl +
        (event.backgroundSignedUrl.includes("?") ? "&" : "?") +
        "t=" +
        Date.now();

      const bgImg = await loadImage(bgSrc);
      ctx.drawImage(bgImg, 0, 0, OUT_W, OUT_H);

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
      coverDraw(ctx, userImg, dx, dy, photoSizeOut, photoSizeOut);

      ctx.restore();

      ctx.font = `800 ${Math.round(textSizeOut)}px Arial, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name.trim().toUpperCase(), textXOut, textYOut);

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

          // ✅ Log download (non-blocking, safe)
          fetch("/api/log-download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: event?.eventId,
              eventCode,
            }),
          }).catch(() => {});

          setDidDownload(true); // ✅ show share box after success
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

  return (
    <>
      <Head>
        <title>ViroEvent | {eventCode}</title>
      </Head>

      <canvas ref={canvasRef} className="hidden" />

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

      {/* Mobile-first layout */}
      <main className="min-h-screen text-white flex flex-col lg:flex-row">
        {/* LEFT PANEL */}
        <aside className="w-full lg:w-[380px] p-4 lg:p-6 viro-card m-4 lg:m-6">
          <div className="text-sm mb-4">
            <div className="font-semibold">
              Event: <span className="text-[var(--viro-primary)]">{eventCode}</span>
            </div>
            {loading ? (
              <div className="text-[var(--viro-muted)]">Loading…</div>
            ) : err ? (
              <div className="text-[var(--viro-danger)]">{err}</div>
            ) : (
              <div className="text-emerald-400">Ready ✅</div>
            )}
          </div>

          <label className="text-sm text-[var(--viro-muted)]">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="mt-2 mb-4 viro-input"
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

          <button
            onClick={generateAndDownload}
            disabled={generating || !name.trim() || !photoUrl || !event?.backgroundSignedUrl}
            className="w-full viro-btn viro-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "Generating..." : "Generate & Download"}
          </button>

          {/* ✅ SHARE BOX */}
          {didDownload && (
            <div className="mt-4 viro-card p-4 border border-[var(--viro-border)]">
              <div className="text-sm font-semibold">Share your poster 🔥</div>
              <div className="text-xs text-[var(--viro-muted)] mt-1">
                Send the link so your friends can create theirs too.
              </div>

              <div className="mt-3 flex gap-2">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center viro-btn viro-btn-primary"
                >
                  Share on WhatsApp
                </a>

                <button
                  type="button"
                  onClick={copyLink}
                  className="flex-1 viro-btn border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] hover:opacity-90"
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>

              <div className="mt-3 text-[10px] text-[var(--viro-muted)] break-all">
                {shareLink}
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-[var(--viro-muted)] space-y-1">
            <div>• Output: 1080×1080 JPG</div>
            <div>• Perfect for IG / WhatsApp</div>
          </div>

          <div className="mt-6 text-xs text-[var(--viro-muted)] text-center">
            Powered by <span className="text-white">Alita Automations</span> <br />
            Contact @ +237 6725 229 13
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <section className="flex-1 flex items-start lg:items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-[560px] viro-card p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[var(--viro-muted)]">Preview</div>
              <span className="text-xs px-3 py-1 rounded-full border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)]">
                Live
              </span>
            </div>

            {/* Responsive square preview */}
            <div
              ref={previewRef}
              className="relative w-full aspect-square max-w-[420px] mx-auto rounded-xl overflow-hidden shadow-2xl bg-black/20"
            >
              {event?.backgroundSignedUrl ? (
                <img
                  src={event.backgroundSignedUrl}
                  alt="background"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-black/20" />
              )}

              {/* Photo */}
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

            <div className="mt-4 text-xs text-[var(--viro-muted)] text-center">
              Tap the photo circle to upload.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

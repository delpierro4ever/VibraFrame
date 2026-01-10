// admin/src/pages/e/[eventCode].tsx
import Head from "next/head";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useRef, useState } from "react";

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

function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { name?: string; message?: string };
  return err.name === "AbortError" || /abort/i.test(err.message ?? "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ✅ Watermark helper (NEW)
function drawWatermark(ctx: CanvasRenderingContext2D, text: string) {
  ctx.save();

  const padX = 18;
  const padY = 10;
  const h = 44;

  ctx.font = "700 28px Arial, sans-serif";
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;

  // bottom-left placement
  const x = 32;
  const y = OUT_H - (h + 32);

  // pill background
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  const r = 14;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();

  // text
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2);

  ctx.restore();
}

export default function EventCodePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ✅ Store generated image for sharing
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

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

  const shareImage = async () => {
    if (!resultBlob) return;

    setShareNotice(null);

    const safeName = (name.trim() || "poster")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");
    const safeCode = (eventCode || "VF").replace(/[^a-z0-9-_]/gi, "");
    const filename = `${safeName || "poster"}-${safeCode}.jpg`;

    const file = new File([resultBlob], filename, { type: "image/jpeg" });

    const nav = navigator as unknown as {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data?: ShareData) => boolean;
    };

    try {
      setSharing(true);

      if (!nav.share) {
        downloadBlob(resultBlob, filename);
        setShareNotice("Sharing isn’t supported here. I downloaded the image instead.");
        return;
      }

      const shareData: ShareData = {
        files: [file],
        title: "ViroEvent Poster",
        text: "My supporter poster",
      };

      if (nav.canShare && !nav.canShare(shareData)) {
        downloadBlob(resultBlob, filename);
        setShareNotice("Your browser can’t share image files. I downloaded it instead.");
        return;
      }

      await nav.share(shareData);
    } catch (e) {
      if (isAbortError(e)) return; // user cancelled
      downloadBlob(resultBlob, filename);
      setShareNotice("Share failed on this device. I downloaded the image instead.");
    } finally {
      setSharing(false);
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
      setPreviewPx(Math.max(240, Math.min(420, Math.round(w))));
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cleanup object URLs properly
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  useEffect(() => {
    return () => {
      if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    };
  }, [resultPreviewUrl]);

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

  const textSizeBase = (tpl.text?.size ?? 44) / 3;
  const textSizeOut = textSizeBase * scaleToOut;

  const textColor = tpl.text?.color ?? "#FFD54F";

  let photoXOut = xNormPhoto * OUT_W;
  let photoYOut = yNormPhoto * OUT_H;

  const r = photoSizeOut / 2;
  photoXOut = clamp(photoXOut, r, OUT_W - r);
  photoYOut = clamp(photoYOut, r, OUT_H - r);

  const textXOut = xNormText * OUT_W;
  const textYOut = yNormText * OUT_H;

  const previewScale = previewPx / OUT_W;

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
    setDidDownload(false);
    setResultBlob(null);
    setShareNotice(null);

    if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
    setResultPreviewUrl(null);
  };

  const generateAndDownload = async () => {
    if (!event?.backgroundSignedUrl || !name.trim() || !photoUrl || !canvasRef.current) return;

    setGenerating(true);
    setErr(null);
    setShareNotice(null);

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

      // name text
      ctx.font = `800 ${Math.round(textSizeOut)}px Arial, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(name.trim().toUpperCase(), textXOut, textYOut);

      // ✅ WATERMARK (NEW)
      drawWatermark(ctx, "Create yours: viroevent.com");

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setGenerating(false);
            return;
          }

          // store for share
          setResultBlob(blob);
          if (resultPreviewUrl) URL.revokeObjectURL(resultPreviewUrl);
          const previewUrl = URL.createObjectURL(blob);
          setResultPreviewUrl(previewUrl);

          // download
          const safeName = name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-_]/g, "");
          const safeCode = (eventCode || "VF").replace(/[^a-z0-9-_]/gi, "");
          const filename = `${safeName || "poster"}-${safeCode}.jpg`;

          downloadBlob(blob, filename);

          // log download (non-blocking)
          fetch("/api/log-download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: event?.eventId, eventCode }),
          }).catch(() => { });

          setDidDownload(true);
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

      <main className="min-h-screen text-white flex flex-col lg:flex-row">
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

          {/* ✅ SHARE IMAGE BOX */}
          {didDownload && (
            <div className="mt-4 viro-card p-4 border border-[var(--viro-border)]">
              <div className="text-sm font-semibold">Share your poster 🔥</div>
              <div className="text-xs text-[var(--viro-muted)] mt-1">
                Share the image directly (WhatsApp/IG) or share the link.
              </div>

              {resultPreviewUrl && (
                <div className="mt-3 rounded-lg overflow-hidden border border-[var(--viro-border)]">
                  <img src={resultPreviewUrl} alt="Generated poster" className="w-full h-auto" />
                </div>
              )}

              <div className="mt-3 flex gap-2 flex-col">
                <button
                  type="button"
                  onClick={shareImage}
                  disabled={!resultBlob || sharing}
                  className="w-full viro-btn viro-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sharing ? "Opening share..." : "Share Image"}
                </button>

                {shareNotice && (
                  <div className="text-[11px] text-[var(--viro-muted)]">{shareNotice}</div>
                )}

                <div className="flex gap-2">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-center viro-btn border border-[var(--viro-border)] bg-[rgba(37,211,102,0.1)] hover:bg-[rgba(37,211,102,0.2)] text-sm"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </div>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      // Instagram doesn't have a direct share URL like WhatsApp
                      // Best we can do is copy link and prompt user
                      copyLink();
                      alert("Link copied! Open Instagram and paste the link in your story or post.");
                    }}
                    className="flex-1 viro-btn border border-[var(--viro-border)] bg-[rgba(193,53,132,0.1)] hover:bg-[rgba(193,53,132,0.2)] text-sm"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                      Instagram
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={copyLink}
                    className="flex-1 viro-btn border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] hover:opacity-90 text-sm"
                  >
                    {copied ? "✓ Copied" : "Copy Link"}
                  </button>
                </div>
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

        <section className="flex-1 flex items-start lg:items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-[560px] viro-card p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-[var(--viro-muted)]">Preview</div>
              <span className="text-xs px-3 py-1 rounded-full border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)]">
                Live
              </span>
            </div>

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

              <div className="absolute flex items-center justify-center font-extrabold text-center" style={textStyle}>
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

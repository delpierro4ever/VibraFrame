import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import DraggableBox from "../../editor/DraggableBox";
import type { Template } from "@/types/template";

type UploadOk = { ok: true; path: string };
type UploadErr = { ok: false; error: string };

type PublishOk = { ok: true; eventId: string; eventCode: string; shareUrl?: string };
type PublishErr = { ok: false; status: number; error: string; message?: string };

const OUT_W = 1080;
const OUT_H = 1080;

// Preview box fixed at 420x420
const PREVIEW_W = 420;
const PREVIEW_H = 420;

export default function DraftEditor() {
  const router = useRouter();
  const eventId =
    typeof router.query.eventId === "string" ? router.query.eventId : null;

  const canvasRef = useRef<HTMLDivElement>(null);

  // preview positions (px)
  const [photoPos, setPhotoPos] = useState({ x: 120, y: 90 });
  const [textPos, setTextPos] = useState({ x: 40, y: 270 });

  const [bgPath, setBgPath] = useState<string | null>(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // After publish, show share link instead of redirecting to attendee
  const [publishedCode, setPublishedCode] = useState<string | null>(null);

  const saveDraftTemplate = async () => {
    if (!eventId) return;
    if (!canvasRef.current) return;

    setLoading(true);
    setMsg(null);

    const previewWidth = canvasRef.current.offsetWidth || PREVIEW_W;
    const previewHeight = canvasRef.current.offsetHeight || PREVIEW_H;

    // DraggableBox positions represent top-left of the slot in UI.
    const PHOTO_UI_SIZE = 128; // w-32 h-32
    const NAME_UI_W = 280;
    const NAME_UI_H = 56; // approx

    const photoCenterX = photoPos.x + PHOTO_UI_SIZE / 2;
    const photoCenterY = photoPos.y + PHOTO_UI_SIZE / 2;

    const textCenterX = textPos.x + NAME_UI_W / 2;
    const textCenterY = textPos.y + NAME_UI_H / 2;

    const photoXNorm = photoCenterX / previewWidth;
    const photoYNorm = photoCenterY / previewHeight;

    const textXNorm = textCenterX / previewWidth;
    const textYNorm = textCenterY / previewHeight;

    const scaleToOut = OUT_W / previewWidth;

    const template: Template = {
      canvas: { width: OUT_W, height: OUT_H },
      photo: {
        x: photoXNorm,
        y: photoYNorm,
        size: Math.round(PHOTO_UI_SIZE * scaleToOut),
        shape: "circle",
      },
      text: {
        x: textXNorm,
        y: textYNorm,
        w: 0.82,
        h: 0.14,
        content: "YOUR NAME",
        font: "Poppins",
        color: "#FFD54F",
        size: Math.round(38 * scaleToOut), // ✅ a bit smaller than 44
      },
      background: { url: bgPath || "" },
    };

    try {
      const r = await fetch("/api/update-template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, template }),
      });

      const data = (await r.json()) as
        | { ok: true }
        | { ok: false; error: string; message?: string };

      if (!r.ok || !data.ok) {
        setMsg(!data.ok ? data.message || data.error : "Failed to save draft");
        return;
      }

      setMsg("Draft saved ✅");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const publishEvent = async () => {
    if (!eventId) return;

    if (!bgPath) {
      setMsg("Please upload a background before publishing.");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      // Ensure latest template is saved before publishing (MVP-safe)
      await saveDraftTemplate();

      const r = await fetch("/api/publish-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      const data = (await r.json()) as PublishOk | PublishErr;

      if (!r.ok || !data.ok) {
        setMsg(!data.ok ? data.message || data.error : "Publish failed");
        return;
      }

      setPublishedCode(data.eventCode);
      setMsg("Published ✅ Copy and share the link below.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const onPickBackground = async (file: File) => {
    if (!eventId) return;

    setLoading(true);
    setMsg(null);

    try {
      const form = new FormData();
      form.append("eventId", eventId);
      form.append("file", file);

      const r = await fetch("/api/upload-background", {
        method: "POST",
        body: form,
      });

      const data = (await r.json()) as UploadOk | UploadErr;

      if (!r.ok || !data.ok) {
        setMsg(!data.ok ? data.error : "Upload failed");
        return;
      }

      setBgPath(data.path);

      if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);

      const localPreview = URL.createObjectURL(file);
      setBgPreviewUrl(localPreview);

      setMsg("Background uploaded ✅");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (bgPreviewUrl) URL.revokeObjectURL(bgPreviewUrl);
    };
  }, [bgPreviewUrl]);

  useEffect(() => {
    setMsg(null);
    setPublishedCode(null);
  }, [eventId]);

  const shareUrl =
    publishedCode && typeof window !== "undefined"
      ? `${window.location.origin}/e/${publishedCode}`
      : publishedCode
        ? `/e/${publishedCode}`
        : null;

  return (
    <>
      <Head>
        <title>{`Draft Editor · ViroEvent`}</title>
      </Head>

      <main className="min-h-screen bg-[var(--viro-bg)] text-[var(--viro-text)]">
        {/* Header */}
        <header className="border-b border-[var(--viro-border)]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">ViroEvent</div>
              <div className="text-xs text-[var(--viro-muted)]">
                Step 2 of 2 — Design slots & publish
              </div>
            </div>

            <div className="text-xs text-[var(--viro-muted)]">
              Event ID: <span className="text-white/90">{eventId ?? "…"}</span>
            </div>
          </div>
        </header>

        <section className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
          {/* LEFT PANEL */}
          <aside className="bg-[var(--viro-surface)] border border-[var(--viro-border)] rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-1">Draft Editor</h2>
            <p className="text-sm text-[var(--viro-muted)] mb-6">
              Upload background, drag slots, then publish to get a share link.
            </p>

            <label className="block text-sm mb-2 text-[var(--viro-muted)]">
              Flyer background (1:1)
            </label>

            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-[var(--viro-muted)]
                file:mr-3 file:rounded-lg file:border-0
                file:bg-[var(--viro-border)] file:px-4 file:py-2
                file:text-white hover:file:opacity-90"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickBackground(f);
              }}
            />

            <div className="mt-5 space-y-3">
              <button
                onClick={saveDraftTemplate}
                disabled={loading || !eventId}
                className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-[var(--viro-border)]
                  py-3 font-semibold transition disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Draft"}
              </button>

              <button
                onClick={publishEvent}
                disabled={loading || !eventId}
                className="w-full rounded-xl bg-[var(--viro-primary)] hover:bg-[var(--viro-primary-hover)]
                  text-black py-3 font-semibold transition disabled:opacity-50"
              >
                {loading ? "Publishing..." : "Publish Event"}
              </button>
            </div>

            {msg && (
              <div className="mt-4 text-sm text-white/90 bg-black/20 border border-[var(--viro-border)] rounded-xl p-3">
                {msg}
              </div>
            )}

            {/* Share box */}
            {publishedCode && (
              <div className="mt-5 p-4 rounded-2xl border border-[var(--viro-border)] bg-black/20">
                <div className="text-xs text-[var(--viro-muted)]">Event Code</div>
                <div className="text-[var(--viro-secondary)] font-semibold">
                  {publishedCode}
                </div>

                <div className="mt-3 text-xs text-[var(--viro-muted)]">
                  Share Link
                </div>
                <div className="text-sm break-all">{shareUrl}</div>

                <button
                  className="mt-3 w-full rounded-xl py-2 bg-white/10 hover:bg-white/15 border border-[var(--viro-border)] text-sm"
                  onClick={async () => {
                    if (!shareUrl) return;
                    await navigator.clipboard.writeText(shareUrl);
                    setMsg("Link copied ✅");
                  }}
                >
                  Copy Link
                </button>

                <button
                  className="mt-2 w-full rounded-xl py-2 bg-white/10 hover:bg-white/15 border border-[var(--viro-border)] text-sm"
                  onClick={() =>
                    router.push(`/e/${encodeURIComponent(publishedCode)}`)
                  }
                >
                  Open Attendee Page (optional)
                </button>
              </div>
            )}

            <div className="mt-6 text-sm text-[var(--viro-muted)] space-y-1">
              <div>• Drag the circle to position the photo</div>
              <div>• Drag the rectangle to position the name</div>
              <div>• Publish to get a share link</div>
            </div>
          </aside>

          {/* RIGHT PANEL */}
          <section className="flex items-center justify-center">
            <div className="w-full">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-[var(--viro-muted)]">
                  Preview (420×420)
                </div>
                <div className="text-xs text-[var(--viro-muted)]">
                  Tip: Keep the circle inside the frame
                </div>
              </div>

              <div
                ref={canvasRef}
                className="mx-auto relative rounded-2xl shadow-2xl w-[420px] h-[420px]
                  overflow-hidden border border-[var(--viro-border)] bg-black/20"
              >
                {bgPreviewUrl ? (
                  <img
                    src={bgPreviewUrl}
                    alt="background"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[var(--viro-muted)] text-sm">
                    Upload a flyer background
                  </div>
                )}

                {/* Photo slot */}
                <DraggableBox
                  x={photoPos.x}
                  y={photoPos.y}
                  onStop={(x, y) => setPhotoPos({ x, y })}
                  bounds={false}
                >
                  <div className="w-32 h-32 rounded-full border-2 border-dashed border-[var(--viro-primary)]
                    flex items-center justify-center text-xs text-[var(--viro-primary)] bg-black/35 backdrop-blur-sm">
                    Photo
                  </div>
                </DraggableBox>

                {/* Name slot */}
                <DraggableBox
                  x={textPos.x}
                  y={textPos.y}
                  onStop={(x, y) => setTextPos({ x, y })}
                  bounds={false}
                >
                  <div className="w-[280px] px-4 py-3 bg-black/35 backdrop-blur-sm
                    border border-[var(--viro-primary)] text-white font-semibold text-sm rounded-xl text-center">
                    YOUR NAME
                  </div>
                </DraggableBox>
              </div>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}

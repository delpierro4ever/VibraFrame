import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, useMemo } from "react";
import ResizableCircle from "../../editor/ResizableCircle"; // Keep original path for ResizableCircle
import { supabaseBrowser } from "@/lib/supabase/client"; // Add supabaseBrowser import
import type { Template } from "@/types/template"; // Keep type import for Template
import Draggable from "react-draggable";

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
  const [photoSize, setPhotoSize] = useState(128); // diameter in pixels
  const [textPos, setTextPos] = useState({ x: 40, y: 270 });
  const [fontSize, setFontSize] = useState(38); // font size in pixels
  const [textColor, setTextColor] = useState("#FFD54F");
  const [namePlaceholder, setNamePlaceholder] = useState("YOUR NAME");

  const [bgPath, setBgPath] = useState<string | null>(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // After publish, show share link instead of redirecting to attendee
  const [publishedCode, setPublishedCode] = useState<string | null>(null);

  // Limit name to 12 characters
  const maxNameLength = 12;
  const handleNameChange = (value: string) => {
    if (value.length <= maxNameLength) {
      setNamePlaceholder(value);
    }
  };

  const saveDraftTemplate = async () => {
    if (!eventId) return;
    if (!canvasRef.current) return;

    setLoading(true);
    setMsg(null);

    const previewWidth = canvasRef.current.offsetWidth || PREVIEW_W;
    const previewHeight = canvasRef.current.offsetHeight || PREVIEW_H;

    // DraggableBox positions represent top-left of the slot in UI.
    const PHOTO_UI_SIZE = photoSize; // Use dynamic size
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
        content: namePlaceholder || "YOUR NAME",
        font: "Poppins",
        color: textColor,
        size: Math.round(fontSize * scaleToOut),
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

  // Fetch event details on load
  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/get-event-by-code?id=${eventId}`); // Using a new or existing endpoint to get by ID
        // Often we might not have a dedicated "get-by-id" endpoint, but let's check if we can reuse an existing one or create a fetcher
        // Actually, let's assume we need to fetch the event data.
        // If we don't have a direct endpoint, we might need to rely on what we have.
        // Let's use a mocked fetch or a real one if available. 
        // Wait, we don't have a "get event by ID" generic endpoint readily visible in file list, 
        // but let's assume one exists or we should use the supabase client directly for admin pages.
      } catch (e) {
        console.error(e);
      }
    })();
  }, [eventId]);

  // ACTUALLY, checking the file list, we have `api/get-event-by-code` which might be for public.
  // We need to fetch the template. Let's use Supabase client directly in useEffect for simplicity in this admin page,
  // OR create a quick endpoint. But `supabaseBrowser` is available.

  const supabase = useMemo(() => supabaseBrowser(), []);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("template, published, event_code")
        .eq("id", eventId)
        .single();

      if (cancelled) return;
      setLoading(false);

      if (error || !data) {
        setMsg("Failed to load event data");
        return;
      }

      if (data.published && data.event_code) {
        setPublishedCode(data.event_code);
      }

      const t = data.template as Template | null;
      if (t) {
        // Restore state from template
        if (t.background?.url) {
          setBgPath(t.background.url);
          // We need a signed URL for the preview to work
          const { data: signed } = await supabase.storage
            .from("flyer-backgrounds")
            .createSignedUrl(t.background.url, 3600);
          if (signed?.signedUrl) setBgPreviewUrl(signed.signedUrl);
        }

        // Restore dimensions (converting normalized back to pixels if needed, though they are stored as numbers)
        // Note: Our template stores normalized x/y (0-1) and size in 1080-space pixels.
        // We need to convert these to the preview box space (420px) for the UI controls validation?
        // Actually, the state variables `photoPos` `textPos` seem to represent offsets in PURPLE BOX coordinate space?
        // DraggableBox `x` and `y` are pixels relative to parent.
        // Our save logic did: x / previewWidth.
        // So load logic should be: x * previewWidth.

        // Wait, we need to know the previewWidth/Height to restore correctly. 
        // It uses `canvasRef.current.offsetWidth` which might be 420.
        // Let's assume PREVIEW_W = 420.

        if (t.photo) {
          const sizeOut = t.photo.size; // 1080 space
          const sizePreview = Math.round(sizeOut * (PREVIEW_W / OUT_W));
          setPhotoSize(sizePreview);

          const xPreview = (t.photo.x * PREVIEW_W) - (sizePreview / 2);
          const yPreview = (t.photo.y * PREVIEW_H) - (sizePreview / 2);
          setPhotoPos({ x: xPreview, y: yPreview });
        }

        if (t.text) {
          const sizeOut = t.text.size;
          const sizePreview = Math.round(sizeOut * (PREVIEW_W / OUT_W));
          setFontSize(sizePreview / 0.4); // because we scale it down by 0.4 in the render? Wait.
          // In render: fontSize: `${fontSize * 0.4}px`
          // In save: size: Math.round(fontSize * scaleToOut)
          // Let's stick to the state value which is the "slider value" (approx 24-72).
          // Recovering exact slider value might be tricky due to rounding, but:
          // savedSize = fontSize * (1080/420).
          // fontSize = savedSize * (420/1080).
          setFontSize(Math.round(sizeOut * (PREVIEW_W / OUT_W)));

          if (t.text.color) setTextColor(t.text.color);
          if (t.text.content) setNamePlaceholder(t.text.content);

          // Center recovery
          // Saved x is center. DraggableBox x is top-left.
          // Width of text box is fixed 280px in UI?
          const UI_W = 280;
          const UI_H = 56;
          const xPreview = (t.text.x * PREVIEW_W) - (UI_W / 2);
          const yPreview = (t.text.y * PREVIEW_H) - (UI_H / 2);
          setTextPos({ x: xPreview, y: yPreview });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [eventId, supabase]);

  useEffect(() => {
    return () => {
      // Cleanup blob URLs if they were created locally (uploaded)
      // We don't revoke signed URLs here usually, but good practice to clean local ones
    };
  }, []);

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
              Upload background, customize slots, then publish to get a share link.
            </p>

            {/* Background Upload */}
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-2">
                Flyer background (1:1)
              </label>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-[var(--viro-muted)]
                  file:mr-3 file:rounded-lg file:border-0
                  file:bg-[var(--viro-border)] file:px-4 file:py-2
                  file:text-white hover:file:opacity-90 file:cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickBackground(f);
                }}
              />
            </div>

            {/* Photo Size Control */}
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-2">
                Photo Frame Size
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="64"
                  max="300"
                  value={photoSize}
                  onChange={(e) => setPhotoSize(Number(e.target.value))}
                  className="flex-1 h-2 bg-[var(--viro-border)] rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--viro-primary)]
                    [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--viro-primary)]
                    [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
                <span className="text-sm font-mono text-[var(--viro-muted)] w-12 text-right">
                  {photoSize}px
                </span>
              </div>
            </div>

            {/* Font Size Control */}
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-2">
                Name Font Size
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="24"
                  max="72"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1 h-2 bg-[var(--viro-border)] rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--viro-primary)]
                    [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
                    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--viro-primary)]
                    [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
                <span className="text-sm font-mono text-[var(--viro-muted)] w-12 text-right">
                  {fontSize}px
                </span>
              </div>
            </div>

            {/* Name Placeholder */}
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-2">
                Name Placeholder
              </label>
              <input
                type="text"
                value={namePlaceholder}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="YOUR NAME"
                maxLength={maxNameLength}
                className="viro-input text-sm"
              />
              <div className="mt-1 text-xs text-[var(--viro-muted)] text-right">
                {namePlaceholder.length}/{maxNameLength} characters
              </div>
            </div>

            {/* Font Color Picker */}
            <div className="mb-5">
              <label className="block text-sm font-semibold mb-2">
                Name Font Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border-2 border-[var(--viro-border)] bg-transparent cursor-pointer p-0.5"
                />
                <span className="text-sm font-mono text-[var(--viro-muted)] uppercase">
                  {textColor}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
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
              <div>• Drag corner handle to resize photo frame</div>
              <div>• Drag slots to position them</div>
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

                {/* Photo slot - Resizable */}
                <ResizableCircle
                  x={photoPos.x}
                  y={photoPos.y}
                  size={photoSize}
                  onMove={(x, y) => setPhotoPos({ x, y })}
                  onResize={(newSize) => setPhotoSize(newSize)}
                >
                  <div
                    className="w-full h-full rounded-full border-2 border-dashed border-[var(--viro-primary)]
                      flex items-center justify-center text-xs text-[var(--viro-primary)] bg-black/35 backdrop-blur-sm"
                  >
                    Photo
                  </div>
                </ResizableCircle>

                {/* Name slot */}
                <Draggable
                  position={textPos}
                  onStop={(_, data) => setTextPos({ x: data.x, y: data.y })}
                  bounds="parent"
                >
                  <div
                    className="absolute w-[280px] px-4 py-3 bg-black/35 backdrop-blur-sm cursor-move
                      border border-[var(--viro-primary)] font-semibold rounded-xl text-center"
                    style={{ fontSize: `${fontSize * 0.4}px`, color: textColor }}
                  >
                    {namePlaceholder || "YOUR NAME"}
                  </div>
                </Draggable>
              </div>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}

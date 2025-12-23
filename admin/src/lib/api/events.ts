// admin/src/lib/api/events.ts
import type { VibraTemplate } from "@/types/vibraframe";

export type CreateEventResponse = {
  ok: true;
  eventId: string;
  eventCode: string;
} | {
  ok: false;
  error: string;
  message?: string;
  upstream?: unknown;
};

export async function createEvent(templateJson: VibraTemplate): Promise<CreateEventResponse> {
  const res = await fetch("/api/create-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(templateJson),
  });

  // Try to parse JSON (fallback to text)
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    data = { ok: false, error: "Invalid JSON response", message: text };
  }

  // If server returned proper response, pass through
  if (res.ok && isCreateEventResponse(data) && data.ok) return data;

  // Normalize error
  if (isCreateEventResponse(data) && !data.ok) return data;

  return {
    ok: false,
    error: "Create event failed",
    message: `Status ${res.status}: ${typeof text === "string" ? text : ""}`,
    upstream: data,
  };
}

function isCreateEventResponse(v: unknown): v is CreateEventResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (o.ok === true) return typeof o.eventId === "string" && typeof o.eventCode === "string";
  if (o.ok === false) return typeof o.error === "string";
  return false;
}

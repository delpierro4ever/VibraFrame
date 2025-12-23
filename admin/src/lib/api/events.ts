// admin/src/lib/api/events.ts

import type { VibraTemplate, CreateEventResponse } from "@/types/vibraframe";

const N8N_CREATE_EVENT_URL = process.env.NEXT_PUBLIC_N8N_CREATE_EVENT_URL;
const WEBHOOK_SECRET = process.env.NEXT_PUBLIC_VIBRAFRAME_WEBHOOK_SECRET;

export async function createEvent(
  templateJson: VibraTemplate
): Promise<CreateEventResponse> {
  if (!N8N_CREATE_EVENT_URL) {
    throw new Error("Missing env: NEXT_PUBLIC_N8N_CREATE_EVENT_URL");
  }

  const res = await fetch(N8N_CREATE_EVENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // optional security header (recommended)
      ...(WEBHOOK_SECRET ? { "x-vibraframe-secret": WEBHOOK_SECRET } : {}),
    },
    body: JSON.stringify(templateJson),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create event failed: ${res.status} ${text}`);
  }

  return (await res.json()) as CreateEventResponse;
}

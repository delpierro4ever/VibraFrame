import type { VibraTemplate } from "@/types/vibraframe";

type CreateEventOk = {
  ok?: boolean;
  eventId: string;
  eventCode: string;
  eventLink: string;
};

type CreateEventErr = {
  ok?: boolean;
  message?: string;
  raw?: unknown;
};

type CreateEventResponse = CreateEventOk | CreateEventErr;

function isCreateEventOk(x: unknown): x is CreateEventOk {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.eventId === "string" &&
    typeof o.eventCode === "string" &&
    typeof o.eventLink === "string"
  );
}

export async function createEvent(template: VibraTemplate): Promise<CreateEventOk> {
  const res = await fetch("/api/create-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template }),
  });

  const text = await res.text();

  let data: CreateEventResponse;
  try {
    data = JSON.parse(text) as CreateEventResponse;
  } catch {
    data = { ok: false, message: "Invalid JSON from API", raw: text };
  }

  if (!res.ok) {
    const msg = (data as CreateEventErr)?.message || `Create event failed (${res.status})`;
    throw new Error(msg);
  }

  if (!isCreateEventOk(data)) {
    throw new Error(`Create event response missing fields: ${JSON.stringify(data)}`);
  }

  if (data.ok === false) {
    throw new Error((data as CreateEventErr)?.message || "Create event failed");
  }

  return data;
}

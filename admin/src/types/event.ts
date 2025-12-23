export interface CreateEventResponse {
  eventId: string;
  eventCode: string;
  eventLink: string;
}


// admin/src/types/event.ts
export type Event = {
  id: string;
  event_code: string;
  name?: string | null;
  description?: string | null;
  template?: unknown;
  published?: boolean | null;
  created_at?: string | null;

   thumbnail?: string | null;
};

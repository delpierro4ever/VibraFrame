import { Event } from "@/types/event";
import Link from "next/link";

type Props = {
  event: Event;
};

export default function EventCard({ event }: Props) {
  return (
    <div className="bg-neutral-900 rounded-xl overflow-hidden shadow hover:shadow-lg transition">
      <img
        src={event.thumbnail ?? ""}
        alt={event.name}
        className="h-40 w-full object-cover"
      />

      <div className="p-4 space-y-2">
        <h3 className="text-lg font-semibold text-white">
          {event.name}
        </h3>

        <p className="text-sm text-neutral-400">
          Code: <span className="font-mono">{event.code}</span>
        </p>

        <p className="text-sm text-neutral-400">
          Posters Generated: {event.postersGenerated}
        </p>

        <div className="flex gap-2 pt-2">
          <Link
            href={`/editor/${event.id}`}
            className="flex-1 text-center bg-yellow-500 hover:bg-yellow-400 text-black text-sm py-2 rounded-lg font-medium"
          >
            Edit
          </Link>

          <button className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white text-sm py-2 rounded-lg">
            Duplicate
          </button>
        </div>
      </div>
    </div>
  );
}

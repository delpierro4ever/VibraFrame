import Head from "next/head";
import Link from "next/link";
import EventCard from "@/components/dashboard/EventCard";
import { mockEvents } from "@/lib/mockData";

export default function Dashboard() {
  return (
    <>
      <Head>
        <title>VibraFrame Admin</title>
      </Head>

      <main className="min-h-screen bg-neutral-950 text-white px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">My Events</h1>

          <Link
            href="/editor/new"
            className="bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-2 rounded-lg font-semibold"
          >
            + Create New Event
          </Link>
        </div>

        {/* Events Grid */}
        {mockEvents.length === 0 ? (
          <div className="text-center py-20 text-neutral-400">
            <p className="text-lg mb-4">No events yet</p>
            <Link
              href="/editor/new"
              className="inline-block bg-yellow-500 text-black px-6 py-3 rounded-lg font-semibold"
            >
              Create Your First Event
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {mockEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

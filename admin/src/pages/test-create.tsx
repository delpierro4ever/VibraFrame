import { useState } from "react";

type CreateOk = {
  ok: true;
  eventId: string;
  eventCode: string;
  eventLink: string;
};

type CreateErr = {
  ok: false;
  error: string;
  message?: string;
  upstream?: unknown;
};

type CreateResp = CreateOk | CreateErr;

export default function TestCreate() {
  const [result, setResult] = useState<CreateResp | null>(null);
  const [loading, setLoading] = useState(false);

  const onCreate = async () => {
    setLoading(true);
    setResult(null);

    try {
      const r = await fetch("/api/create-event", { method: "POST" });
      const data = (await r.json()) as CreateResp;
      setResult(data);
    } catch (e) {
      setResult({
        ok: false,
        error: "FetchError",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  const ok = result?.ok === true;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2>Test Create Event</h2>
      <p>This creates an event using the hardcoded template and returns an event link.</p>

      <button onClick={onCreate} disabled={loading}>
        {loading ? "Creating..." : "Create test event"}
      </button>

      {result?.ok === false && (
        <p style={{ color: "red" }}>{result.message ?? result.error}</p>
      )}

      <h3>Result</h3>
      <p><b>eventId:</b> {ok ? result.eventId : ""}</p>
      <p><b>eventCode:</b> {ok ? result.eventCode : ""}</p>
      <p>
        <b>eventLink:</b>{" "}
        {ok ? (
          <a href={result.eventLink} target="_blank" rel="noreferrer">
            {result.eventLink}
          </a>
        ) : (
          ""
        )}
      </p>

      {ok && (
        <p>
          <a href={`/e/${result.eventCode}`} target="_blank" rel="noreferrer">
            Open attendee page
          </a>
        </p>
      )}

      <h3>Debug</h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

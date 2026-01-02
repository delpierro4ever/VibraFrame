// src/pages/auth/callback.tsx
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

type Status = "loading" | "success" | "error";

function parseHashTokens(hash: string): { access_token?: string; refresh_token?: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);

  return {
    access_token: params.get("access_token") || undefined,
    refresh_token: params.get("refresh_token") || undefined,
  };
}

export default function AuthCallbackPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("Completing sign in...");

  // ✅ Your version requires explicit args
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

    if (!url || !anon) {
      // This will show a clear message in UI instead of failing silently.
      // (We still handle it below.)
      // eslint-disable-next-line no-console
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }

    return createBrowserClient(url, anon);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    let cancelled = false;

    (async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
        if (!url || !anon) {
          throw new Error(
            "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local / Vercel env."
          );
        }

        // ✅ Case A: PKCE flow => URL has ?code=...
        const code = typeof router.query.code === "string" ? router.query.code : null;

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          if (!cancelled) {
            setStatus("success");
            setMessage("✅ Email confirmed. Redirecting...");
          }

          router.replace("/admin").catch(() => {});
          return;
        }

        // ✅ Case B: Implicit flow => tokens in URL hash
        const { access_token, refresh_token } = parseHashTokens(window.location.hash);

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          if (!cancelled) {
            setStatus("success");
            setMessage("✅ Email confirmed. Redirecting...");
          }

          router.replace("/admin").catch(() => {});
          return;
        }

        // ✅ Case C: error params
        const errDesc =
          (typeof router.query.error_description === "string" && router.query.error_description) ||
          (typeof router.query.error === "string" && router.query.error) ||
          null;

        if (errDesc) {
          throw new Error(decodeURIComponent(errDesc));
        }

        throw new Error(
          "Missing confirmation data in the URL. Please resend the confirmation email and try again."
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Callback failed";
        if (!cancelled) {
          setStatus("error");
          setMessage(msg);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    router.isReady,
    router.query.code,
    router.query.error,
    router.query.error_description,
    supabase,
    router,
  ]);

  return (
    <>
      <Head>
        <title>ViroEvent — Auth Callback</title>
      </Head>

      <main className="min-h-screen flex items-center justify-center text-white px-4">
        <div className="viro-card w-full max-w-md p-6 border border-[var(--viro-border)] text-center">
          <div className="text-xl font-extrabold">
            {status === "loading" ? "Verifying..." : status === "success" ? "Success ✅" : "Error ❌"}
          </div>

          <div className="mt-3 text-sm text-[var(--viro-muted)]">{message}</div>

          {status === "error" && (
            <div className="mt-5 flex justify-center gap-2">
              <Link
                href="/auth"
                className="viro-btn border border-[var(--viro-border)] bg-[rgba(255,255,255,0.04)] hover:opacity-90"
              >
                Back to login
              </Link>

              <Link href="/" className="viro-btn viro-btn-primary">
                Go home
              </Link>
            </div>
          )}

          {status === "loading" && (
            <div className="mt-5 text-xs text-[var(--viro-muted)]">
              If this takes too long, go back and resend the confirmation email.
            </div>
          )}
        </div>
      </main>
    </>
  );
}

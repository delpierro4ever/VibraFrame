// src/pages/auth/index.tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "login" | "register";

function getNextParam(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? v[0] : v;
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const next = getNextParam(router.query.next);
  const nextUrl = next && next.startsWith("/") ? next : "/admin";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          },
        });
        if (error) throw error;

        // Depending on Supabase email confirmation setting:
        // - If confirmation OFF => session exists immediately.
        // - If confirmation ON => user must confirm email before session.
        router.push(nextUrl);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        router.push(nextUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setMsg(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Organizer Auth | ViroEvent</title>
      </Head>

      <main className="min-h-screen flex items-center justify-center px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {mode === "login" ? "Organizer Login" : "Create Organizer Account"}
              </h1>
              <p className="text-sm text-white/60 mt-1">
                Create events, edit templates, and view analytics.
              </p>
            </div>

            <button
              type="button"
              className="text-xs underline text-white/70 hover:text-white"
              onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}
            >
              {mode === "login" ? "Register" : "Login"}
            </button>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="text-xs text-white/60">Email</label>
              <input
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Password</label>
              <input
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none focus:border-white/20"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </div>

            {msg ? (
              <div className="text-sm text-red-300 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                {msg}
              </div>
            ) : null}

            <button
              disabled={loading}
              className="w-full rounded-xl bg-white text-black py-2 font-medium disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Login"
                  : "Create account"}
            </button>
          </form>

          <div className="mt-4 text-xs text-white/60">
            By continuing, you agree to use ViroEvent responsibly.
          </div>
        </div>
      </main>
    </>
  );
}

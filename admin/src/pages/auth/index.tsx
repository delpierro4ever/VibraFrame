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

import type { GetServerSideProps, NextApiRequest } from "next";
import { supabaseServer } from "@/lib/supabase/server";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = supabaseServer(ctx.req as NextApiRequest, ctx.res as any);
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    return {
      redirect: {
        destination: "/admin",
        permanent: false,
      },
    };
  }

  return { props: {} };
};

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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          },
        });
        if (error) throw error;

        // Check if email confirmation is required
        // If user exists but no session, email confirmation is needed
        if (data.user && !data.session) {
          setSuccessMsg(email.trim());
          setLoading(false);
          return; // Don't redirect yet
        }

        // If session exists immediately, redirect (email confirmation disabled)
        router.replace(nextUrl);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        router.replace(nextUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setMsg(message);
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!successMsg) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: successMsg,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        }
      });

      if (error) throw error;
      setMsg("Verification email resent! Please check your inbox.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to resend email");
    } finally {
      setLoading(false);
    }
  }

  // Success state - show verification instructions
  if (successMsg) {
    return (
      <>
        <Head>
          <title>Verify Email | ViroEvent</title>
        </Head>

        <main className="min-h-screen flex items-center justify-center px-4 text-white">
          <div className="w-full max-w-md">
            <div className="viro-card border border-[var(--viro-border)] p-6 lg:p-8">
              {/* Success Icon */}
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-center mb-2">
                Account Created!
              </h1>

              <p className="text-center text-[var(--viro-muted)] mb-6">
                We've sent a verification email to:
              </p>

              <div className="text-center mb-6 px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[var(--viro-border)]">
                <div className="font-semibold text-[var(--viro-primary)]">{successMsg}</div>
              </div>

              <div className="space-y-3 text-sm text-[var(--viro-muted)] mb-6">
                <div className="flex items-start gap-2">
                  <span className="text-[var(--viro-primary)] mt-0.5">1.</span>
                  <span>Check your inbox (and spam folder)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--viro-primary)] mt-0.5">2.</span>
                  <span>Click the verification link in the email</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[var(--viro-primary)] mt-0.5">3.</span>
                  <span>You'll be redirected back to login</span>
                </div>
              </div>

              {msg && (
                <div className="mb-4 text-sm text-green-300 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-center">
                  {msg}
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={resendVerification}
                  disabled={loading}
                  className="w-full viro-btn viro-btn-primary"
                >
                  {loading ? "Sending..." : "Resend Verification Email"}
                </button>

                <button
                  onClick={() => {
                    setSuccessMsg(null);
                    setMode("login");
                    setEmail("");
                    setPassword("");
                  }}
                  className="w-full rounded-xl border border-[var(--viro-border)] bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
                >
                  Back to Login
                </button>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-[var(--viro-muted)]">
              Didn't receive the email? Check your spam folder or click "Resend"
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Organizer Auth | ViroEvent</title>
      </Head>

      <main className="min-h-screen flex items-center justify-center px-4 text-white">
        <div className="w-full max-w-md viro-card border border-[var(--viro-border)] p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {mode === "login" ? "Organizer Login" : "Create Organizer Account"}
              </h1>
              <p className="text-sm text-[var(--viro-muted)] mt-1">
                Create events, edit templates, and view analytics.
              </p>
            </div>

            <button
              type="button"
              className="text-xs underline text-[var(--viro-muted)] hover:text-white transition"
              onClick={() => {
                setMode((m) => (m === "login" ? "register" : "login"));
                setMsg(null);
              }}
            >
              {mode === "login" ? "Register" : "Login"}
            </button>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div>
              <label className="text-xs text-[var(--viro-muted)]">Email</label>
              <input
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none focus:border-[var(--viro-primary)]/50 focus:ring-2 focus:ring-[var(--viro-primary)]/20 transition"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="text-xs text-[var(--viro-muted)]">Password</label>
              <input
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none focus:border-[var(--viro-primary)]/50 focus:ring-2 focus:ring-[var(--viro-primary)]/20 transition"
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
              className="w-full viro-btn viro-btn-primary"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Login"
                  : "Create account"}
            </button>
          </form>

          <div className="mt-4 text-xs text-[var(--viro-muted)]">
            By continuing, you agree to use ViroEvent responsibly.
          </div>
        </div>
      </main>
    </>
  );
}

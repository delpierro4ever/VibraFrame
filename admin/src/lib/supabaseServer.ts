// src/lib/supabaseServer.ts
import type { GetServerSidePropsContext } from "next";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { serialize, type SerializeOptions } from "cookie";

type CookiePair = { name: string; value: string };

// Supabase helpers can call either deprecated or new cookie interface depending on version.
// We'll implement BOTH, using the correct option type they expect: Partial<SerializeOptions>.
type CookieMethodsServerDeprecated = {
  get(name: string): string | undefined;
  set(name: string, value: string, options?: Partial<SerializeOptions>): void;
  remove(name: string, options?: Partial<SerializeOptions>): void;
};

type CookieMethodsServer = {
  getAll(): CookiePair[];
  setAll(cookies: { name: string; value: string; options: Partial<SerializeOptions> }[]): void;
};

function appendSetCookie(res: GetServerSidePropsContext["res"], cookie: string) {
  const prev = res.getHeader("Set-Cookie");

  if (!prev) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }

  if (typeof prev === "string") {
    res.setHeader("Set-Cookie", [prev, cookie]);
    return;
  }

  if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, cookie]);
    return;
  }

  res.setHeader("Set-Cookie", cookie);
}

function buildCookiesAdapter(
  ctx: GetServerSidePropsContext
): CookieMethodsServerDeprecated & CookieMethodsServer {
  return {
    // ✅ Deprecated API
    get(name: string) {
      return ctx.req.cookies[name];
    },
    set(name: string, value: string, options?: Partial<SerializeOptions>) {
      appendSetCookie(ctx.res, serialize(name, value, { path: "/", ...options }));
    },
    remove(name: string, options?: Partial<SerializeOptions>) {
      appendSetCookie(ctx.res, serialize(name, "", { path: "/", maxAge: 0, ...options }));
    },

    // ✅ New API
    getAll() {
      return Object.entries(ctx.req.cookies).map(([name, value]) => ({
        name,
        value: value ?? "",
      }));
    },
    setAll(cookies: { name: string; value: string; options: Partial<SerializeOptions> }[]) {
      cookies.forEach((c) => {
        appendSetCookie(ctx.res, serialize(c.name, c.value, { path: "/", ...c.options }));
      });
    },
  };
}

export function supabaseServer(ctx: GetServerSidePropsContext) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(url, anon, {
    cookies: buildCookiesAdapter(ctx),
  });
}

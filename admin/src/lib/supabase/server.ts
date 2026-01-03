import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextApiRequest, NextApiResponse } from "next";

type SetCookieItem = {
  name: string;
  value: string;
  options?: CookieOptions;
};

export function supabaseServer(req: NextApiRequest, res: NextApiResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          // NextApiRequest cookies can be string | undefined, but Supabase requires string
          const entries = Object.entries(req.cookies ?? {});
          const cleaned = entries
            .filter(([, value]) => typeof value === "string" && value.length > 0)
            .map(([name, value]) => ({ name, value: value as string }));

          return cleaned.length ? cleaned : null;
        },

        setAll(cookies: SetCookieItem[]) {
          const existing = res.getHeader("Set-Cookie");
          const existingArr = Array.isArray(existing)
            ? existing
            : typeof existing === "string"
              ? [existing]
              : [];

          const serialized = cookies.map(({ name, value, options }) => {
            const opts = options ?? {};
            const parts: string[] = [];

            parts.push(`${name}=${value}`);
            parts.push(`Path=${opts.path ?? "/"}`);

            if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
            if (opts.domain) parts.push(`Domain=${opts.domain}`);
            if (opts.httpOnly ?? true) parts.push("HttpOnly"); // Supabase cookies should be HttpOnly
            parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
            if (opts.secure) parts.push("Secure");

            return parts.join("; ");
          });

          res.setHeader("Set-Cookie", [...existingArr, ...serialized]);
        },
      },
    }
  );
}

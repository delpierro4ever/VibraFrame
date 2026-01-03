import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../lib/supabase/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = typeof req.query.code === "string" ? req.query.code : null;

  // Where to send user after verification/login
  const next = typeof req.query.next === "string" ? req.query.next : "/admin";

  if (!code) {
    return res.redirect(`/auth?error=missing_code`);
  }

  const supabase = supabaseServer(req, res);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Common PKCE issue: code verifier missing (opened link in different browser)
    return res.redirect(`/auth?error=${encodeURIComponent(error.message)}`);
  }

  return res.redirect(next);
}

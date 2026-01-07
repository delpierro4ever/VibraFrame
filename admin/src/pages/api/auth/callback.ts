import { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "@/lib/supabase/server";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        res.status(405).appendHeader("Allow", "GET").end();
        return;
    }

    const code = req.query.code;
    const next = req.query.next ?? "/admin";

    if (code) {
        const supabase = supabaseServer(req, res);
        const { error } = await supabase.auth.exchangeCodeForSession(String(code));
        if (!error) {
            res.redirect(303, String(next));
            return;
        }
    }

    // TODO: better error handling
    res.redirect(303, "/auth?error=auth-code-error");
}

// src/pages/admin/logout.tsx
import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.signOut().finally(() => {
      router.replace("/auth");
    });
  }, [router]);

  return (
    <>
      <Head>
        <title>Logging out…</title>
      </Head>
      <main className="min-h-screen flex items-center justify-center text-white">
        Logging out…
      </main>
    </>
  );
}

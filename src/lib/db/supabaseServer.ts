/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies as nextCookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function supabaseServer(): Promise<SupabaseClient> {
  const maybe = nextCookies();
  const cookieStore = maybe instanceof Promise ? await maybe : maybe;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            (cookieStore as any).set(name, value, options);
          } catch {
            // swallow
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            (cookieStore as any).set(name, "", { ...options, maxAge: 0 });
          } catch {
            // swallow 
          }
        },
      },
    }
  );
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { access_token, refresh_token } = (await req.json()) as {
    access_token?: string;
    refresh_token?: string;
  };

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set(name, "", options);
        },
      },
    }
  );

  if (!access_token || !refresh_token) {
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  await supabase.auth.setSession({ access_token, refresh_token });
  return NextResponse.json({ ok: true });
}

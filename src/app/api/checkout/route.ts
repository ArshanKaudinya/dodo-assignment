import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/db/supabaseServer";

export const runtime = "nodejs";

type Body = {
  productId: string;
  metadata?: Record<string, string>;
};

type CheckoutResponse = {
  id: string;
  url: string;
  status: "open" | "completed" | "expired" | string;
  customer_external_id?: string | null;
  external_customer_id?: string | null;
};

function polarApiBase() {
  return "https://sandbox-api.polar.sh";
}

export async function POST(req: Request) {
  const { productId, metadata }: Body = await req.json();

  // 0) Basic guards
  if (!process.env.POLAR_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Missing POLAR_ACCESS_TOKEN" }, { status: 500 });
  }
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  // 1) Read user from Supabase cookies (set by your /auth/refresh)
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 2) Build request — snake_case matches Polar Core API
  const payload = {
    products: [productId],
    customer_external_id: user.id,  
    customer_email: user.email,  
    success_url: `${process.env.APP_URL}/success`,
    cancel_url: `${process.env.APP_URL}/cancel`,
    allow_discount_codes: true,
    metadata: { supabaseUserId: user.id, ...(metadata ?? {}) },
  };

  // 3) Call Polar Core API
  const res = await fetch(`${polarApiBase()}/v1/checkouts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  // 4) Helpful error passthrough
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    // Common cases:
    // 401/403 -> wrong token or wrong environment; needs Organization Access Token with checkouts:write (sandbox vs prod mismatch).
    // 422 -> invalid productId or field name.
    return NextResponse.json(
      { error: "polar_error", status: res.status, body: bodyText },
      { status: 500 }
    );
  }

  const checkout: CheckoutResponse = await res.json();
  return NextResponse.json({ url: checkout.url });
}

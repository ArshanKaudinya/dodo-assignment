"use server";

import { supabaseServer } from "@/lib/db/supabaseServer";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "revoked" | "paused";
type SubscriptionRow = {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name: string | null;
  status: SubStatus | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean | null;
  updated_at: string | null;
};

const POLAR_BASE =
  process.env.POLAR_SERVER === "production" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function cancelSubscription(_formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) return { ok: false, message: "Missing POLAR_ACCESS_TOKEN" };

  const s = await supabaseServer();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

  const { data: sub, error: subErr } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("id,status,current_period_end")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<SubscriptionRow, "id" | "status" | "current_period_end">>();
  if (subErr) return { ok: false, message: subErr.message };
  if (!sub || sub.status !== "active") return { ok: false, message: "No active subscription" };

  const subRes = await fetch(`${POLAR_BASE}/v1/subscriptions/${sub.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!subRes.ok) return { ok: false, message: `Fetch subscription failed (${subRes.status})` };

  const subJson = (await subRes.json()) as { customer_id?: string; customerId?: string };
  const polarCustomerId = subJson.customer_id ?? subJson.customerId;
  if (!polarCustomerId) return { ok: false, message: "Missing Polar customer_id" };

  const csRes = await fetch(`${POLAR_BASE}/v1/customer-sessions/`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ customer_id: polarCustomerId }),
    cache: "no-store",
  });
  if (!csRes.ok) return { ok: false, message: `Customer session failed (${csRes.status})` };
  const { token: portalToken } = (await csRes.json()) as { token: string };

  const cancelRes = await fetch(`${POLAR_BASE}/v1/customer-portal/subscriptions/${sub.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${portalToken}`, "content-type": "application/json" },
    cache: "no-store",
  });
  if (!cancelRes.ok) return { ok: false, message: `Cancel failed (${cancelRes.status})` };
  const cancelJson = (await cancelRes.json()) as { current_period_end?: string | null };

  const { error: upErr } = await supabaseAdmin
    .from("billing_subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      current_period_end: cancelJson.current_period_end ?? sub.current_period_end ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);
  if (upErr) return { ok: false, message: upErr.message };

  return { ok: true, message: "Canceled" };
}

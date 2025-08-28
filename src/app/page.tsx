import Link from "next/link";
import { supabaseServer } from "@/lib/db/supabaseServer";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";
import { SubscribeButton } from "./components/SubscribeButton";

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

async function getCurrentSubscription(userId: string) {
  const s = await supabaseServer();
  const { data, error } = await s
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

function polarBase() {
  return process.env.POLAR_SERVER === "production"
    ? "https://api.polar.sh"
    : "https://sandbox-api.polar.sh";
}

/** Server Action: cancel active sub for logged-in user (no billing_customers table required) */
async function cancelSubscription(): Promise<{ ok: boolean; message?: string }> {
  "use server";
  if (!process.env.POLAR_ACCESS_TOKEN) return { ok: false, message: "Missing POLAR_ACCESS_TOKEN" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Unauthorized" };

  // 1) Load latest sub
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("id,status,current_period_end")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<Pick<SubscriptionRow, "id" | "status" | "current_period_end">>();
  if (subErr) return { ok: false, message: subErr.message };
  if (!sub || sub.status !== "active") return { ok: false, message: "No active subscription" };

  // 2) Fetch Polar subscription to get customer_id (since we don’t store it)
  const subRes = await fetch(`${polarBase()}/v1/subscriptions/${sub.id}`, {
    headers: { Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}` },
    cache: "no-store",
  });
  if (!subRes.ok) {
    const t = await subRes.text();
    return { ok: false, message: `Fetch sub failed (${subRes.status}): ${t}` };
  }
  const subJson = await subRes.json() as { customer_id?: string; customerId?: string };
  const polarCustomerId = subJson.customer_id ?? subJson.customerId;
  if (!polarCustomerId) return { ok: false, message: "No Polar customer_id on subscription" };

  // 3) Create customer session
  const csRes = await fetch(`${polarBase()}/v1/customer-sessions/`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ customer_id: polarCustomerId }),
    cache: "no-store",
  });
  if (!csRes.ok) {
    const t = await csRes.text();
    return { ok: false, message: `Customer session failed (${csRes.status}): ${t}` };
  }
  const { token } = (await csRes.json()) as { token: string };

  // 4) Cancel via customer portal API
  const cancelRes = await fetch(`${polarBase()}/v1/customer-portal/subscriptions/${sub.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    cache: "no-store",
  });
  if (!cancelRes.ok) {
    const t = await cancelRes.text();
    return { ok: false, message: `Cancel failed (${cancelRes.status}): ${t}` };
  }
  const cancelJson = (await cancelRes.json()) as { current_period_end?: string | null };

  // 5) Optimistic DB update (webhook will confirm)
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

export default async function Page() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const productId = process.env.POLAR_PRODUCT_ID ?? null;
  const sub = user ? await getCurrentSubscription(user.id) : null;

  async function logout() {
    "use server";
    const s = await supabaseServer();
    await s.auth.signOut();
  }

  return (
    <main className="mx-auto max-w-xl p-8 space-y-6 text-sm text-gray-800" role="main">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Account</h1>
          <p className="text-gray-500">Manage access and subscription.</p>
        </div>
        {user ? (
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md border border-red-400 bg-red-100 px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
            >
              Logout
            </button>
          </form>
        ) : null}
      </header>

      {!user ? (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-base font-medium">You’re not signed in</h2>
          <p className="mb-4 text-gray-600">Sign in to sync your customer profile and subscribe.</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-800 hover:bg-gray-50"
          >
            Login
          </Link>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-base font-medium">Subscription</h2>

            {/* Status card */}
            {sub ? (
              <div className="mb-4 space-y-1">
                <p>
                  <span className="font-medium">Status:</span>{" "}
                  <span
                    className={
                      sub.status === "active"
                        ? "text-emerald-700"
                        : sub.status === "canceled" || sub.status === "revoked"
                        ? "text-rose-700"
                        : "text-gray-700"
                    }
                  >
                    {sub.status}
                  </span>
                </p>
                {sub.product_name ? (
                  <p>
                    <span className="font-medium">Plan:</span> {sub.product_name}
                  </p>
                ) : null}
                {sub.current_period_end ? (
                  <p>
                    <span className="font-medium">Renews / ends:</span>{" "}
                    {new Date(sub.current_period_end).toLocaleString()}
                  </p>
                ) : null}
                <p className="text-xs text-gray-500">Subscription ID: {sub.id}</p>
              </div>
            ) : (
              <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-700">
                No subscription found.
              </div>
            )}

            {/* Actions */}
            {!productId ? (
              <div role="status" className="rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-700">
                Subscription temporarily unavailable. Missing product ID.
              </div>
            ) : sub?.status === "active" ? (
              <div className="flex items-center gap-3">
                <form
                  action={async () => {
                    "use server";
                    const result = await cancelSubscription();
                    if (!result.ok) throw new Error(result.message ?? "Cancel failed");
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md border border-rose-300 bg-rose-100 px-4 py-2 font-medium text-rose-900 hover:bg-rose-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                  >
                    Cancel subscription
                  </button>
                </form>
              </div>
            ) : (
              <SubscribeButton productId={productId} />
            )}
          </div>
        </section>
      )}
    </main>
  );
}

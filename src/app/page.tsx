import Link from "next/link";
import { supabaseServer } from "@/lib/db/supabaseServer";
import { SubscribeButton } from "./components/SubscribeButton";
import { CancelButton } from "./components/CancelButton";
import { cancelSubscription } from "./actions";

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

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : null;

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

export default async function Page() {
  const s = await supabaseServer();
  const { data: { user } } = await s.auth.getUser();
  const productId = process.env.POLAR_PRODUCT_ID ?? null;
  const sub = user ? await getCurrentSubscription(user.id) : null;

  async function logout() {
    "use server";
    const s = await supabaseServer();
    await s.auth.signOut();
  }

  const statusColor =
    sub?.status === "active"
      ? "text-emerald-700"
      : sub?.status === "canceled" || sub?.status === "revoked"
      ? "text-rose-700"
      : "text-gray-700";

  return (
    <main className="mx-auto max-w-xl p-8 space-y-6 text-sm text-gray-800" role="main">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Account</h1>
          <p className="text-gray-500">Manage access and subscription.</p>
        </div>
        {user && (
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md border border-red-400 bg-red-100 px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
            >
              Logout
            </button>
          </form>
        )}
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

            {sub ? (
              <div className="mb-4 space-y-1">
                <p>
                  <span className="font-medium">Status: </span>
                  <span className={statusColor}>{sub.status}</span>
                </p>
                {sub.product_name && (
                  <p>
                    <span className="font-medium">Plan: </span>
                    {sub.product_name}
                  </p>
                )}
                {fmtDate(sub.current_period_end) && (
                  <p>
                    <span className="font-medium">Renews / ends: </span>
                    {fmtDate(sub.current_period_end)}
                  </p>
                )}
                <p className="text-xs text-gray-500">Subscription ID: {sub.id}</p>
              </div>
            ) : (
              <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-700">
                No subscription found.
              </div>
            )}

            {!productId ? (
              <div role="status" className="rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-700">
                Subscription temporarily unavailable. Missing product ID.
              </div>
            ) : sub?.status === "active" ? (
              <div className="flex items-center gap-3">
                <CancelButton
                  action={cancelSubscription}
                  className="inline-flex items-center justify-center cursor-pointer rounded-md border border-rose-300 bg-rose-100 px-4 py-2 font-medium text-rose-900 hover:bg-rose-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-60 disabled:cursor-not-allowed"
                />
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

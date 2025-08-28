import { NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { supabaseAdmin } from "@/lib/db/supabaseAdmin";

export const runtime = "nodejs";

const resJson = (status: number, body: unknown) =>
  new NextResponse(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const log = (...a: unknown[]) => console.log("[polar-webhook]", ...a);

// tiny helper to handle camelCase/snake_case
const pick = <T>(...vals: Array<T | null | undefined>) => vals.find(v => v != null) as T | undefined;

type EventType =
  | "customer.created" | "customer.updated"
  | "subscription.created" | "subscription.updated"
  | "subscription.active" | "subscription.canceled" | "subscription.revoked";

type AnyObj = Record<string, unknown>;

export async function POST(req: Request) {
  try {
    if (!process.env.POLAR_WEBHOOK_SECRET) {
      return resJson(500, { error: "Missing POLAR_WEBHOOK_SECRET" });
    }

    const raw = Buffer.from(await req.arrayBuffer());
    const evt = validateEvent(raw, Object.fromEntries(req.headers), process.env.POLAR_WEBHOOK_SECRET) as {
      type: EventType;
      data: AnyObj;
    };

    // SUBSCRIPTIONS: only final states
    if (evt.type === "subscription.active" || evt.type === "subscription.canceled" || evt.type === "subscription.revoked") {
      // unwrap: data or data.subscription; support camelCase + snake_case
      const sub = ("subscription" in evt.data ? evt.data.subscription : evt.data) as AnyObj;

      // ---- resolve user id (UID) ----
      const customer = sub.customer as AnyObj | undefined;
      const uid =
        pick<string>(
          customer?.externalId as string | undefined,
          customer?.external_id as string | undefined,
          (sub.metadata as AnyObj | undefined)?.supabaseUserId as string | undefined
        ) ?? null;

      if (!uid) {
        log("no uid (externalId/external_id/metadata.supabaseUserId) → skipping");
        return resJson(202, { skipped: "no_uid" });
      }

      // ---- normalize fields (camel or snake) ----
      const status = evt.type === "subscription.active" ? "active" : evt.type === "subscription.canceled" ? "canceled" : "revoked";

      const productId  = pick<string>((sub.product as AnyObj | undefined)?.id as string, sub.product_id as string);
      const product    = sub.product as AnyObj | undefined;
      const productName = (product?.name as string | undefined) ?? null;

      const startedAt           = pick<string>(sub.startedAt as string, sub.started_at as string) ?? null;
      const currentPeriodStart  = pick<string>(sub.currentPeriodStart as string, sub.current_period_start as string) ?? null;
      const currentPeriodEnd    = pick<string>(sub.currentPeriodEnd as string, sub.current_period_end as string) ?? null;
      const canceledAt          = pick<string>(sub.canceledAt as string, sub.canceled_at as string) ?? (status !== "active" ? new Date().toISOString() : null);
      const cancelAtPeriodEnd   = pick<boolean>(sub.cancelAtPeriodEnd as boolean, sub.cancel_at_period_end as boolean) ?? false;

      const row = {
        id: String(sub.id),
        user_id: uid,
        product_id: productId ?? null,
        product_name: productName,
        status,
        started_at: startedAt,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        canceled_at: canceledAt,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      };

      const up = await supabaseAdmin.from("billing_subscriptions").upsert(row);
      if (up.error) {
        log("billing_subscriptions upsert error:", up.error, "row:", row);
        return resJson(500, { error: "db_upsert_failed", detail: up.error.message });
      }
      log("subscription upserted:", { id: row.id, user_id: row.user_id, status: row.status });
      return resJson(202, { ok: true });
    }
    // ignore the rest
    return resJson(202, { ok: true, ignored: evt.type });
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      log("invalid signature");
      return resJson(403, { error: "invalid_signature" });
    }
    log("unhandled error:", err);
    return resJson(500, { error: "internal" });
  }
}

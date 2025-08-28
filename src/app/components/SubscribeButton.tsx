"use client";

import { useState } from "react";

export function SubscribeButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    try {
      setLoading(true);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Checkout failed");
      }
      const { url } = (await res.json()) as { url: string };
      window.location.assign(url);
    } catch (e) {
      console.error(e);
      alert("Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-block rounded bg-slate-400 px-4 py-2 text-black disabled:opacity-60"
    >
      {loading ? "Starting…" : "Subscribe"}
    </button>
  );
}

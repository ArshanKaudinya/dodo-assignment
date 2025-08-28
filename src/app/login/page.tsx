"use client";

import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent align-middle" />
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const emailValid = /\S+@\S+\.\S+/.test(email);
  const pwValid = pw.length >= 6;
  const canEmailPass = useMemo(() => emailValid && pwValid, [emailValid, pwValid]);

  async function syncServerCookies() {
    const { data } = await supabase.auth.getSession();
    const access_token = data.session?.access_token;
    const refresh_token = data.session?.refresh_token;
    await fetch("/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token, refresh_token }),
    }).catch(() => {});
  }

  async function withUi<T>(fn: () => Promise<T>) {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      return await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function doEmailPass() {
    await withUi(async () => {
      if (!canEmailPass) throw new Error("Enter a valid email and 6+ char password.");

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setMsg("Account created. Now sign in.");
        setMode("signin");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;

      await syncServerCookies();
      setMsg("Signed in.");
      window.location.assign("/");
    });
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            {mode === "signup" ? "Create account" : "Sign in"}
          </h1>

          {/* segmented mode switch */}
          <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`px-3 py-1.5 ${
                mode === "signin" ? "bg-white border border-gray-300 rounded-md" : "text-gray-600"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`px-3 py-1.5 ${
                mode === "signup" ? "bg-white border border-gray-300 rounded-md" : "text-gray-600"
              }`}
            >
              Sign up
            </button>
          </div>
        </header>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) void doEmailPass();
          }}
          noValidate
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm text-gray-700">
              Email
            </label>
            <input
              id="email"
              className={`w-full rounded-md border p-2 outline-none focus:ring-2 focus:ring-gray-300 ${
                email && !emailValid ? "border-red-300" : "border-gray-300"
              }`}
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
            {email && !emailValid ? (
              <p className="text-xs text-red-600">Enter a valid email.</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                className={`w-full rounded-md border p-2 pr-20 outline-none focus:ring-2 focus:ring-gray-300 ${
                  pw && !pwValid ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="min 6 characters"
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPw((x) => !x)}
                className="absolute inset-y-0 right-2 my-1 inline-flex items-center rounded border border-gray-300 bg-white px-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {pw && !pwValid ? (
              <p className="text-xs text-red-600">At least 6 characters.</p>
            ) : null}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500">
              {mode === "signup" ? "You’ll be able to sign in right after." : "Use your email and password."}
            </div>

            <button
              type="submit"
              disabled={loading || !canEmailPass}
              className="flex items-center gap-2 rounded bg-slate-400 px-4 py-2 text-sm font-medium text-black disabled:opacity-60 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {loading ? <Spinner /> : null}
              <span>{mode === "signup" ? "Create" : "Continue"}</span>
            </button>
          </div>
        </form>

        {err ? (
          <p role="alert" className="mt-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {err}
          </p>
        ) : null}
        {msg ? (
          <p role="status" className="mt-4 rounded border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-800">
            {msg}
          </p>
        ) : null}

        <p className="mt-6 text-center text-xs text-gray-500">
          By continuing you agree to our terms.
        </p>
      </div>
    </main>
  );
}
  
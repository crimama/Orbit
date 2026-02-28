"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next")?.trim() || "/";
    return raw.startsWith("/") ? raw : "/";
  }, [searchParams]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Access token is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to authenticate");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Network error while authenticating");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-6"
      >
        <h1 className="text-xl font-semibold text-slate-100">
          Agent Orbit Access
        </h1>
        <p className="text-sm text-slate-400">
          Enter the server access token to continue.
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Access token"
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-slate-400"
          autoFocus
        />
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
        >
          {submitting ? "Verifying..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
          <div className="w-full rounded-xl border border-slate-700 bg-slate-900 p-6 text-sm text-slate-300">
            Loading login...
          </div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next")?.trim() || "/";
    return raw.startsWith("/") ? raw : "/";
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
    }, 5000);

    async function load() {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Failed to load auth status");
        }
        const json = (await res.json()) as { configured?: boolean };
        if (mounted) {
          setConfigured(Boolean(json.configured));
        }
      } catch {
        if (mounted) {
          setConfigured(true);
          setError("Failed to load login status");
        }
      } finally {
        window.clearTimeout(timer);
      }
    }

    load();
    return () => {
      mounted = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const isSetup = configured === false;
    const token = password.trim();
    if (!token) {
      setError(isSetup ? "Password is required" : "Password is required");
      return;
    }
    if (isSetup && token.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (isSetup && !confirmPassword.trim()) {
      setError("Password confirmation is required");
      return;
    }
    if (isSetup && confirmPassword.trim() && confirmPassword.trim() !== token) {
      setError("Password confirmation does not match");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, confirmToken: confirmPassword.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to authenticate");
        return;
      }
      setConfigured(true);
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
          {configured === false
            ? "Create an admin password for first-time setup."
            : "Enter your password to continue."}
        </p>
        {configured === null ? (
          <p className="text-sm text-slate-300">Checking login status...</p>
        ) : null}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-slate-400"
          autoFocus
        />
        {configured === false ? (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-slate-400"
          />
        ) : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting || configured === null}
          className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
        >
          {submitting
            ? "Verifying..."
            : configured === false
              ? "Set password"
              : "Sign in"}
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

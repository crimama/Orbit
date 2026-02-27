"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import ABCompare from "@/components/dashboard/ABCompare";

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const left = searchParams.get("left");
  const right = searchParams.get("right");

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-neutral-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            &larr; Back
          </button>
          <h1 className="text-sm font-semibold">A/B Session Compare</h1>
        </div>
      </div>

      {/* Compare panels */}
      <div className="flex-1 overflow-hidden">
        <ABCompare leftSessionId={left} rightSessionId={right} />
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}

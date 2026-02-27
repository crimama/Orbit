"use client";

interface InterceptorBannerProps {
  pendingCount: number;
  latestCommand?: string;
  onClick: () => void;
}

export default function InterceptorBanner({
  pendingCount,
  latestCommand,
  onClick,
}: InterceptorBannerProps) {
  if (pendingCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-yellow-700/50 bg-yellow-900/30 px-4 py-2 text-left transition-colors hover:bg-yellow-900/50"
    >
      <div className="flex items-center gap-3">
        {/* Animated pulse indicator */}
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-500" />
        </span>

        <span className="text-sm font-medium text-yellow-200">
          {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}
        </span>

        {latestCommand && (
          <span className="max-w-xs truncate font-mono text-xs text-yellow-400/80">
            {latestCommand}
          </span>
        )}
      </div>

      <span className="text-xs text-yellow-300/70">Click to review</span>
    </button>
  );
}

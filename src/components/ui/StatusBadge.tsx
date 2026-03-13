interface StatusBadgeProps {
  status: "active" | "paused" | "terminated" | "yolo";
  label?: string;
  className?: string;
}

const statusClasses: Record<string, string> = {
  active: "border-green-500/30 bg-green-500/10 text-green-300",
  paused: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  terminated: "border-neutral-700 bg-neutral-900 text-neutral-500",
  yolo: "border-red-500/40 bg-red-500/15 text-red-300",
};

const defaultLabels: Record<string, string> = {
  active: "active",
  paused: "paused",
  terminated: "stopped",
  yolo: "yolo",
};

export default function StatusBadge({
  status,
  label,
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClasses[status]} ${className}`}
    >
      {label ?? defaultLabels[status]}
    </span>
  );
}

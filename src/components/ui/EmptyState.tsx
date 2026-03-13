interface EmptyStateProps {
  message: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
      <p className="text-sm text-neutral-500">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded bg-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-600"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

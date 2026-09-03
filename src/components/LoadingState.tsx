import { cn } from "@/lib/utils";

type LoadingStateProps = {
  label?: string;
  compact?: boolean;
  className?: string;
};

export function LoadingState({
  label = "Carregando...",
  compact = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn("somma-loading-state", compact && "is-compact", className)}
      role="status"
      aria-live="polite"
    >
      <div className="somma-loading-label">
        <span className="somma-loading-pulse" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="somma-loading-track" aria-hidden="true">
        <span className="somma-loading-bar" />
      </div>
    </div>
  );
}

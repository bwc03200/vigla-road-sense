import { forwardRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  MapPin,
  Merge,
  Navigation,
  RotateCw,
  Split,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RouteStep } from "@/types/vigla";

function iconFor(maneuverType: string, instruction: string) {
  const t = (maneuverType || "").toLowerCase();
  const text = (instruction || "").toLowerCase();
  const left = /left|gauche/.test(text);
  const right = /right|droite/.test(text);
  if (t === "arrive") return Flag;
  if (t === "depart") return Navigation;
  if (t.includes("roundabout") || t.includes("rotary")) return RotateCw;
  if (t === "merge") return Merge;
  if (t === "fork") return Split;
  if (t === "on ramp") return ArrowUpRight;
  if (t === "off ramp") return ArrowUpLeft;
  if (t === "continue" || t === "new name") return ArrowUp;
  if (left) return CornerUpLeft;
  if (right) return CornerUpRight;
  if (t === "turn") return ArrowDown;
  return MapPin;
}

function formatDistance(m: number) {
  if (!Number.isFinite(m) || m < 0) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

interface StepRowProps {
  index: number;
  step: RouteStep;
  /** Distance to this maneuver when it is the active one, otherwise step length. */
  distanceM: number;
  isCurrent: boolean;
  isDone: boolean;
}

export const StepRow = forwardRef<HTMLDivElement, StepRowProps>(
  function StepRow({ index, step, distanceM, isCurrent, isDone }, ref) {
    const Icon = iconFor(step.maneuverType, step.instruction);
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
          isCurrent
            ? "bg-primary/10 ring-1 ring-primary/30"
            : isDone
              ? "opacity-45"
              : "hover:bg-muted/80",
        )}
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            isCurrent
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            isCurrent ? "font-semibold" : "font-medium",
          )}
          title={step.instruction}
        >
          <span className="mr-1 text-[11px] text-muted-foreground">
            {index + 1}.
          </span>
          {step.instruction}
        </span>
        <span
          className={cn(
            "shrink-0 text-xs font-semibold tabular-nums",
            isCurrent ? "text-primary" : "text-muted-foreground",
          )}
        >
          {formatDistance(distanceM)}
        </span>
      </div>
    );
  },
);

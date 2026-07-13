import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  children: ReactNode;
  onReset?: () => void;
}
interface State {
  error: Error | null;
  resetKey: number;
}

/**
 * Standard React Error Boundary. Only React's own error propagation
 * (getDerivedStateFromError / componentDidCatch) can put it in the error
 * state — no external store observation, no effect-driven fallback.
 */
export class NavigationErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Log the real exception + component stack before showing the fallback,
    // so any future trigger leaves an exploitable trace.
    // eslint-disable-next-line no-console
    console.error(
      "[NavigationErrorBoundary] caught error:",
      error?.message,
      "\nstack:",
      error?.stack,
      "\ncomponentStack:",
      info?.componentStack,
    );
    reportLovableError(error, {
      boundary: "NavigationErrorBoundary",
      componentStack: info.componentStack,
    });
  }

  reset = () => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) {
      return <div key={this.state.resetKey}>{this.props.children}</div>;
    }
    return (
      <div className="pointer-events-auto absolute inset-x-0 top-0 z-[900] p-3">
        <div className="rounded-3xl bg-slate-900 p-4 text-white shadow-[0_16px_40px_rgba(15,23,42,0.35)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF6B35]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                Un problème est survenu
              </div>
              <div className="mt-0.5 text-xs text-white/70">
                Retour à la carte pour continuer.
              </div>
            </div>
          </div>
          <Button
            className="mt-3 h-11 w-full bg-white text-slate-900 hover:bg-white/90"
            onClick={this.reset}
          >
            Retour à la carte
          </Button>
        </div>
      </div>
    );
  }
}

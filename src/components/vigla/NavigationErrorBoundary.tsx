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
}

export class NavigationErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    reportLovableError(error, {
      boundary: "NavigationErrorBoundary",
      componentStack: info.componentStack,
    });
    // eslint-disable-next-line no-console
    console.error("[NavigationErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ViglaLogo } from "@/components/vigla/ViglaLogo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [
    { title: "VIGLA — Connexion" },
    { name: "description", content: "Connectez-vous à VIGLA pour retrouver vos trajets et alertes routières." },
    { property: "og:title", content: "VIGLA — Connexion" },
    { property: "og:description", content: "Retrouvez vos trajets et alertes routières avec VIGLA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(t("auth.accountCreated"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <ViglaLogo />
          <div className="min-w-0"><span className="text-xl font-bold">VIGLA Road Sense</span><p className="text-xs text-muted-foreground">{t("brand.tagline")}</p></div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-2xl">
          <h1 className="text-lg font-semibold text-foreground">
            {mode === "signin" ? t("auth.signin") : t("auth.signup")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.subtitle")}</p>
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 text-base">
              {loading ? "…" : mode === "signin" ? t("auth.signInBtn") : t("auth.signUpBtn")}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? t("auth.toSignup") : t("auth.toSignin")}
          </button>
        </div>
      </div>
    </main>

  );
}

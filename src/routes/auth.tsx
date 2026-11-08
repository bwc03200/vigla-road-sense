import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { SHOW_AUTH_SCREEN } from "@/lib/access-mode";
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
  beforeLoad: () => {
    if (!SHOW_AUTH_SCREEN) throw redirect({ to: "/", replace: true });
  },
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
  const [signupError, setSignupError] = useState("");
  const [signupMessage, setSignupMessage] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setSignupError("");
    setSignupMessage("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const signupEmail = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) {
          setSignupError("Saisissez une adresse email valide.");
          return;
        }
        if (password.length < 6) {
          setSignupError("Le mot de passe doit contenir au moins 6 caractères.");
          return;
        }
        console.log("[VIGLA inscription] Appel d’inscription", { emailPresent: Boolean(signupEmail), passwordPresent: Boolean(password) });
        const { data, error } = await supabase.auth.signUp({
          email: signupEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/" });
        } else {
          setSignupMessage("Vérifiez votre email pour activer votre compte");
        }
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      if (mode === "signup") {
        const details = err as { code?: string; status?: number; message?: string } | null;
        const code = details?.code;
        const message = details?.message ?? "";
        console.error("[VIGLA inscription] Échec", { code: code ?? "unknown", status: details?.status });
        if (code === "weak_password" || /weak|easy to guess/i.test(message)) {
          setSignupError("Ce mot de passe est trop facile à deviner ou déjà compromis. Choisissez un mot de passe plus robuste et unique.");
        } else if (code === "user_already_exists" || code === "email_exists" || /already.*registered/i.test(message)) {
          setSignupError("Cet email est déjà utilisé. Connectez-vous avec votre compte existant.");
        } else if (/password.*(short|least)/i.test(message)) {
          setSignupError("Le mot de passe est trop court. Choisissez un mot de passe plus long.");
        } else if (code === "over_email_send_rate_limit" || details?.status === 429) {
          setSignupError("Trop de demandes d’inscription. Réessayez dans quelques minutes.");
        } else if (/fetch|network|connection|timeout/i.test(message)) {
          setSignupError("Impossible de joindre le service d’inscription. Vérifiez votre connexion et réessayez.");
        } else if (code === "signup_disabled" || code === "email_provider_disabled") {
          setSignupError("L’inscription est momentanément indisponible. Réessayez plus tard.");
        } else {
          setSignupError("L’inscription a échoué. Vérifiez votre email et votre mot de passe, puis réessayez.");
        }
      } else {
        toast.error(err instanceof Error ? err.message : t("common.unknownError"));
      }
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
          <form onSubmit={onSubmit} noValidate={mode === "signup"} className="mt-5 space-y-3">
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
          {mode === "signup" && signupError && <p role="alert" className="mt-3 text-sm text-destructive">{signupError}</p>}
          {mode === "signup" && signupMessage && <p role="status" className="mt-3 text-sm text-foreground">{signupMessage}</p>}
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

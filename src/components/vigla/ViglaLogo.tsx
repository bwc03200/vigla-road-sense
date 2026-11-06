import { useTranslation } from "react-i18next";
import logo from "@/assets/vigla-logo.png.asset.json";
import icon from "@/assets/vigla-icon-180.png.asset.json";

export function ViglaLogo({ full = false, className = "" }: { full?: boolean; className?: string }) {
  return <img src={full ? logo.url : icon.url} alt="VIGLA Road Sense" width={full ? 1024 : 48} height={full ? 1024 : 48} className={`shrink-0 object-contain ${full ? "h-auto w-full" : "h-12 w-12 rounded-lg"} ${className}`} />;
}

export function ViglaSplash() {
  const { t } = useTranslation();
  return <div className="flex min-h-dvh items-center justify-center bg-background p-6" role="status" aria-label={t("common.loading")}>
    <div className="w-full max-w-lg"><ViglaLogo full /><p className="mt-4 text-center text-sm text-muted-foreground">{t("common.loading")}</p></div>
  </div>;
}
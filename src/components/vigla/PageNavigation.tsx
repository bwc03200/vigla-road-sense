import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageNavigation({ title, onBack, children }: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return (
    <>
      <header className="vigla-page-header">
        <Button variant="ghost" onClick={onBack} className="vigla-page-back h-11 shrink-0 px-2">
          <ArrowLeft aria-hidden="true" />
          {t("common.back")}
        </Button>
        <nav aria-label={title} className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-xs text-sillaxe-muted">
            <span>{t("tabs.map")}</span>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
          </div>
          <h1 ref={heading} tabIndex={-1} aria-current="page" className="m-0 text-lg font-semibold leading-tight outline-none">
            {title}
          </h1>
        </nav>
      </header>
      <section className="vigla-page-content" aria-label={title}>{children}</section>
    </>
  );
}
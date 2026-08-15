import { useTranslation } from "react-i18next";

interface QuickRoutePOIButtonProps {
  count: number;
  onClick: () => void;
}

/** Chip opening the quick-route restaurants list. Hidden when no POI is loaded. */
export function QuickRoutePOIButton({ count, onClick }: QuickRoutePOIButtonProps) {
  const { t } = useTranslation();
  if (count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={t("navigation.browse_restaurants", "Browse Restaurants")}
      className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.18)] transition active:scale-95"
    >
      <span aria-hidden="true">🍽️</span>
      <span>{t("navigation.browse_restaurants", "Browse Restaurants")}</span>
    </button>
  );
}

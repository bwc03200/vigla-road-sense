import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MapPin,
  ShieldCheck,
  Route as RouteIcon,
  Navigation,
  Zap,
  Users,
  Bike,
  Vibrate,
  Flag,
  Hand,
  Share2,
  FileText,
  Check,
  X,
  Sparkles,
  Radar,
} from "lucide-react";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "VIGLA — Le copilote qui protège vraiment les motards" },
      {
        name: "description",
        content:
          "Alertes de zones de danger temps réel, mode convoi, alertes moto natives. Auto et moto. Prix garanti stable 24 mois.",
      },
      { property: "og:title", content: "VIGLA — Copilote auto & moto" },
      {
        property: "og:description",
        content:
          "Radars officiels, alertes communautaires, mode convoi et fonctions moto exclusives.",
      },
    ],
  }),
  component: LandingPage,
});

function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24 ${className}`}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function EyebrowTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-10 max-w-3xl">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary-strong">
        {eyebrow}
      </div>
      <h2 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  exclusive,
  tone = "light",
}: {
  icon: typeof MapPin;
  title: string;
  desc: string;
  exclusive?: boolean;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <div
      className={
        isDark
          ? "relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
          : "relative rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      }
    >
      {exclusive && (
        <span className="absolute -top-2 right-4 inline-flex items-center gap-1 rounded-full bg-primary-strong px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow">
          <Sparkles className="h-3 w-3" /> Exclusif
        </span>
      )}
      <div
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
          isDark ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary-strong"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3
        className={`text-base font-bold ${
          isDark ? "text-white" : "text-slate-900"
        }`}
      >
        {title}
      </h3>
      <p
        className={`mt-1.5 text-sm ${
          isDark ? "text-white/70" : "text-slate-600"
        }`}
      >
        {desc}
      </p>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <a href="#hero" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-strong text-primary-foreground">
              <Radar className="h-4 w-4" />
            </div>
            <span className="text-lg font-black tracking-tight">VIGLA</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">
              Fonctionnalités
            </a>
            <a href="#comparatif" className="hover:text-slate-900">
              Comparatif
            </a>
            <a href="#tarifs" className="hover:text-slate-900">
              Tarifs
            </a>
          </nav>
          <Link
            to="/auth"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Se connecter
          </Link>
        </div>
      </header>

      {/* HERO */}
      <Section id="hero" className="pt-10 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary-strong">
              Auto & moto · Temps réel
            </div>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Le seul copilote qui protège{" "}
              <span className="text-primary-strong">vraiment les motards</span> — pas
              juste les voitures.
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-600 sm:text-lg">
              Alertes de zones de danger en temps réel, mode convoi, et un prix
              qui ne grimpe jamais en cachette. Pour l'auto et la moto.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary-strong px-6 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-105"
              >
                Essayer gratuitement
              </Link>
              <a
                href="#features"
                className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Voir les fonctionnalités
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Sans carte bancaire · Remboursement 14 jours sans condition
            </p>
          </div>

          {/* Mock preview */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/30 via-primary/10 to-transparent blur-2xl" />
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-3 shadow-2xl">
              <div className="relative aspect-[9/16] overflow-hidden rounded-[2rem] bg-slate-100">
                {/* Fake map */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#e2e8f0,transparent_60%),radial-gradient(circle_at_70%_80%,#fed7aa,transparent_50%)]" />
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 200 320"
                  fill="none"
                >
                  <path
                    d="M20 300 C 60 220, 80 200, 120 140 S 180 60, 180 20"
                    stroke="#FF6B35"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <circle cx="120" cy="140" r="8" fill="#0F172A" />
                  <circle cx="120" cy="140" r="14" fill="#0F172A" fillOpacity="0.15" />
                </svg>
                {/* Top bar */}
                <div className="absolute inset-x-3 top-3 rounded-2xl bg-slate-900/95 p-3 text-white shadow">
                  <div className="text-[10px] uppercase tracking-widest text-white/60">
                    Dans 350 m
                  </div>
                  <div className="text-sm font-bold">Radar fixe · 90 km/h</div>
                </div>
                {/* Bottom card */}
                <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white p-3 shadow-lg">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-primary-strong">
                    Convoi · 6 motards
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Ouvreur à 400 m · Serre-file OK
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ICP */}
      <Section id="icp" className="bg-white">
        <EyebrowTitle
          eyebrow="Pour qui"
          title="Une app, deux mondes qui roulent ensemble"
          subtitle="Pensée dès le départ pour l'auto ET la moto. Pas un produit voiture repeint."
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Navigation className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Automobilistes</h3>
            <p className="mt-1 text-sm text-slate-600">Cette app est pour toi si :</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {[
                "Tu roules tous les jours et tu en as marre de payer Coyote de plus en plus cher",
                "Tu veux des radars officiels + les signalements de la communauté au même endroit",
                "Tu veux préparer un trajet et voir les zones de danger avant de partir",
                "Tu veux une app qui reste simple, sans pubs ni surcouches inutiles",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-white p-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-strong text-primary-foreground">
              <Bike className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Motards</h3>
            <p className="mt-1 text-sm text-slate-600">Cette app est pour toi si :</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {[
                "Tu conduis avec des gants et un casque — pas envie de sortir le tel à chaque alerte",
                "Le bruit du vent couvre les sons : tu veux des vibrations au guidon en plus",
                "Tu sors régulièrement en club ou en groupe et tu veux voir ton convoi en direct",
                "Tu veux être alerté des gravillons, nid-de-poule et virages piégeux — pas juste des radars",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* PROBLEM / SOLUTION */}
      <Section id="probleme">
        <EyebrowTitle
          eyebrow="Le problème"
          title="Aujourd'hui, tu jongles entre 3 apps et un groupe WhatsApp"
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Avant VIGLA
            </div>
            <ul className="space-y-4 text-sm text-slate-700">
              {[
                "Waze pour les radars, Liberty Rider pour la sécurité, un groupe WhatsApp pour le club.",
                "Un abonnement Coyote qui augmente chaque année sans prévenir.",
                "Interface pensée voiture, rien pour la conduite moto.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-white to-white p-6">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-primary-strong">
              Avec VIGLA
            </div>
            <ul className="space-y-4 text-sm text-slate-800">
              {[
                "Tout dans une seule app : radars, sécurité, convoi.",
                "Prix garanti stable pendant 24 mois. Zéro mauvaise surprise.",
                "Alertes et mode conduite pensés dès le départ pour la moto.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary-strong" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* FEATURES */}
      <Section id="features" className="bg-white">
        <EyebrowTitle
          eyebrow="Fonctionnalités"
          title="Pour toutes les conduites"
          subtitle="Les bases d'une bonne app de navigation communautaire, en mieux."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={MapPin}
            title="Carte temps réel"
            desc="Zones de danger communautaires signalées et confirmées en direct."
          />
          <FeatureCard
            icon={Radar}
            title="Radars officiels"
            desc="Base data.gouv.fr (Sécurité Routière), mise à jour automatiquement."
          />
          <FeatureCard
            icon={RouteIcon}
            title="Itinéraire préparé"
            desc="Prévisualise le nombre de zones de danger sur ton trajet avant de partir."
          />
          <FeatureCard
            icon={Navigation}
            title="Navigation guidée"
            desc="Recalcul automatique en cas d'écart, façon Waze/Google Maps."
          />
          <FeatureCard
            icon={Zap}
            title="Signalement en un tap"
            desc="Radar, accident, travaux, obstacle — deux secondes, terminé."
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Réputation communautaire"
            desc="Un système qui filtre les fausses alertes et fiabilise le réseau."
          />
        </div>

        {/* MOTO FEATURES */}
        <div className="mt-16 rounded-3xl bg-slate-900 p-6 text-white sm:p-10">
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-strong text-primary-foreground">
              <Bike className="h-6 w-6" />
            </div>
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
                Exclusif motards
              </div>
              <h3 className="text-2xl font-black tracking-tight sm:text-3xl">
                Ce que les autres n'ont pas
              </h3>
              <p className="mt-2 text-sm text-white/70 sm:text-base">
                Sept fonctions pensées par un motard, pour des motards.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              tone="dark"
              exclusive
              icon={ShieldCheck}
              title="Mode moto natif"
              desc="Alertes gravillons, nid-de-poule, virages à visibilité réduite."
            />
            <FeatureCard
              tone="dark"
              exclusive
              icon={Vibrate}
              title="Vibration au guidon"
              desc="Utile avec casque et bruit du vent, en plus du signal sonore."
            />
            <FeatureCard
              tone="dark"
              exclusive
              icon={Users}
              title="Mode convoi temps réel"
              desc="Vois la position de tous les membres du club sur la carte."
            />
            <FeatureCard
              tone="dark"
              exclusive
              icon={Flag}
              title="Ouvreur / Serre-file"
              desc="Alerte immédiate en cas de décrochage d'un membre du groupe."
            />
            <FeatureCard
              tone="dark"
              exclusive
              icon={Hand}
              title="« Je m'arrête »"
              desc="Un tap et tout le convoi est prévenu instantanément."
            />
            <FeatureCard
              tone="dark"
              exclusive
              icon={Share2}
              title="Itinéraire partagé"
              desc="Le tracé est envoyé à tout le groupe, pas juste au créateur."
            />
            <FeatureCard
              tone="dark"
              exclusive
              icon={FileText}
              title="Résumé de sortie"
              desc="Distance, durée, zones rencontrées, tracé — partagé à tous à l'arrivée."
            />
          </div>
        </div>
      </Section>

      {/* COMPARATIF */}
      <Section id="comparatif">
        <EyebrowTitle
          eyebrow="Comparatif"
          title="VIGLA face aux autres"
          subtitle="Chacun a ses forces. Voici où VIGLA se distingue, sans dénigrer personne."
        />
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Critère</th>
                  <th className="px-4 py-3 text-center text-primary-strong">VIGLA</th>
                  <th className="px-4 py-3 text-center">Waze</th>
                  <th className="px-4 py-3 text-center">Coyote</th>
                  <th className="px-4 py-3 text-center">OOONO</th>
                  <th className="px-4 py-3 text-center">Liberty Rider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {[
                  ["Mode moto natif", true, false, false, false, true],
                  ["Mode convoi temps réel", true, false, false, false, false],
                  ["Prix stable garanti", true, true, false, true, false],
                  ["Radars officiels + communautaires", true, false, true, false, false],
                  ["Vibrations adaptées au guidon", true, false, false, false, false],
                ].map(([label, ...cells]) => (
                  <tr key={String(label)}>
                    <td className="px-4 py-3 font-medium">{label as string}</td>
                    {(cells as boolean[]).map((ok, i) => (
                      <td key={i} className="px-4 py-3 text-center">
                        {ok ? (
                          <Check className="mx-auto h-5 w-5 text-primary-strong" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-slate-300" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* TARIFS */}
      <Section id="tarifs" className="bg-white">
        <EyebrowTitle
          eyebrow="Tarifs"
          title="Simple, honnête, garanti stable 24 mois"
          subtitle="Aucune augmentation surprise. Aucune pub. Aucune revente de tes données."
        />
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-strong">
          <ShieldCheck className="h-4 w-4" /> Prix garanti stable pendant 24 mois
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <PriceCard
            name="Free"
            price="0€"
            period=""
            desc="Pour découvrir VIGLA"
            features={[
              "Carte temps réel",
              "Radars officiels",
              "Signalement communautaire",
            ]}
          />
          <PriceCard
            highlighted
            name="Premium"
            price="6,99€"
            period="/mois"
            secondary="ou 59€/an"
            desc="Toutes les fonctions moto"
            features={[
              "Tout Free +",
              "Mode moto natif + vibrations",
              "Navigation guidée avancée",
              "Résumé de sortie complet",
            ]}
          />
          <PriceCard
            name="Club / Fleet"
            price="Sur devis"
            period=""
            desc="Convoi & groupe illimité"
            features={[
              "Tout Premium +",
              "Mode convoi temps réel",
              "Rôles ouvreur / serre-file",
              "Tableau de bord club",
            ]}
          />
        </div>
      </Section>

      {/* GARANTIE */}
      <Section id="garantie">
        <div className="rounded-3xl bg-gradient-to-br from-primary/15 via-white to-white p-8 sm:p-12">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-strong text-primary-foreground">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Essaie VIGLA sans risque.
              </h3>
              <p className="mt-2 max-w-2xl text-slate-700">
                Gratuit, sans carte bancaire. Si le mode Premium ne te convient
                pas dans les 14 premiers jours, on te rembourse intégralement,
                sans justification à donner.
              </p>
            </div>
            <Link
              to="/auth"
              className="inline-flex h-12 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-bold text-white hover:bg-slate-800"
            >
              Commencer
            </Link>
          </div>
        </div>
      </Section>

      {/* AVANTAGES */}
      <Section id="avantages" className="bg-white">
        <EyebrowTitle
          eyebrow="Pourquoi VIGLA"
          title="Trois raisons qui font la différence"
        />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              t: "Boîtier + alertes moto + convoi",
              d: "Le seul à combiner un boîtier discret, des alertes moto natives et le mode convoi temps réel.",
            },
            {
              t: "Radars officiels toujours à jour",
              d: "Base Sécurité Routière synchronisée automatiquement chaque semaine.",
            },
            {
              t: "Créé par un motard",
              d: "Pas un produit voiture générique adapté après coup — pensé moto dès la première ligne de code.",
            },
          ].map((x) => (
            <div
              key={x.t}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary-strong">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{x.t}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{x.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA FINAL */}
      <Section id="cta">
        <div className="overflow-hidden rounded-3xl bg-slate-900 p-8 text-white sm:p-14">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Prêt à rouler mieux protégé ?
            </h2>
            <p className="mt-3 text-white/70">
              Crée ton compte gratuitement en moins d'une minute.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-primary-strong px-8 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 hover:brightness-105"
            >
              Créer mon compte gratuitement
            </Link>
          </div>
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-strong text-primary-foreground">
              <Radar className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-slate-900">VIGLA</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <a href="#" className="hover:text-slate-900">Mentions légales</a>
            <a href="#" className="hover:text-slate-900">Confidentialité</a>
            <a href="mailto:contact@vigla.app" className="hover:text-slate-900">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PriceCard({
  name,
  price,
  period,
  secondary,
  desc,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  period: string;
  secondary?: string;
  desc: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        highlighted
          ? "relative rounded-3xl border-2 border-primary bg-white p-6 shadow-xl shadow-primary/10"
          : "rounded-3xl border border-slate-200 bg-white p-6"
      }
    >
      {highlighted && (
        <div className="absolute -top-3 left-6 rounded-full bg-primary-strong px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
          Recommandé
        </div>
      )}
      <div className="text-sm font-bold uppercase tracking-widest text-slate-500">
        {name}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl font-black text-slate-900">{price}</span>
        <span className="text-sm text-slate-500">{period}</span>
      </div>
      {secondary && (
        <div className="mt-1 text-xs text-slate-500">{secondary}</div>
      )}
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
      <ul className="mt-5 space-y-2 text-sm text-slate-700">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-strong" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/auth"
        className={
          highlighted
            ? "mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary-strong text-sm font-bold text-primary-foreground hover:brightness-105"
            : "mt-6 inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50"
        }
      >
        Choisir
      </Link>
    </div>
  );
}

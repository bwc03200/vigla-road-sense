
# Plan — VIGLA UX v3

Gros lot livré en une passe. Découverte = suggestions statiques. Notifications d'urgence = liens `sms:` / `mailto:` côté client (l'utilisateur qui appuie sur "J'appelle" / "Envoyer aux proches" ouvre son app native ; si compte à rebours = 0, on ouvre automatiquement le composeur SMS avec la position).

## 1. Base de données (une seule migration)

Nouvelles tables (toutes en RLS, grants standards) :

- `convoys` — id, name, code (6 char), owner_id, created_at, ended_at
- `convoy_members` — convoy_id, user_id, display_name, joined_at, last_lat, last_lng, last_seen
- `convoy_alerts` — convoy_id, user_id, kind (`wait|join|break|fuel|hazard|message`), payload jsonb, created_at, expires_at (default now()+15s)
- `emergency_contacts` — id, user_id, name, phone, email, created_at
- `roadbooks` — id, created_by, title, description, duration_days, distance_km, route_geojson, cover_hint text, is_public, created_at

Realtime activé sur `convoy_members` et `convoy_alerts`.

## 2. Détection de chute + secours

- Nouveau hook `useCrashDetection(active)` : `DeviceMotionEvent` avec `requestPermission()` iOS, seuil accélération > 25 m/s² puis immobilité (< 1 m/s² pendant > 20 s) → passe en état `suspected`.
- Composant plein-écran `CrashAlertOverlay` : cercle SVG 120 s, boutons "J'appelle le 112" (`tel:112`) et "Je vais bien". À 0 s : ouvre `sms:` (ou `mailto:` si pas de numéro) pré-rempli avec position GPS + lien Google Maps vers chaque contact d'urgence, puis affiche confirmation.
- Fallback silencieux si `DeviceMotion` indisponible + note "Détection expérimentale" dans Paramètres.

## 3. Protection automatique

- Nouveau hook `useAutoProtect()` : si vitesse lissée > 15 km/h pendant > 60 s ET pas de navigation active ET pas déjà dismissed cette session → bandeau flottant "On dirait que tu roules — activer la protection ?".
- Activation crée un `ActiveNavigation` léger (pas de destination, `steps=[]`), active la détection de chute, affiche badge "Protection en cours · Xkm · Xmin".

## 4. Générateur de trajet

- `RoutePlanner` reçoit 2 onglets : "Itinéraire précis" (existant) / "Générer un trajet".
- Sous-onglets Quick Ride / Découverte.
- **Quick Ride** : slider distance 10–300 km + sélecteur boussole 8 directions + "Toutes directions". Génère 2 waypoints intermédiaires aléatoires dans un rayon = distance/π (biais direction si choisi), appelle OSRM en boucle, garde la meilleure. Retry 1× avec seed différent si échec.
- **Découverte** : liste statique de ~15 sorties FR (Alpes, Vosges, Bretagne, Massif Central…) filtrées par distance à la position — chaque item déclenche un calcul d'itinéraire.

## 5. Roadbooks

- Nouvel onglet dans `BottomTabs` "Roadbooks" (remplace ou complète historique — au choix : je garde les 4 existants + ajoute un 5e).
- `RoadbookList` : Publics / Mes roadbooks / Créer (à partir de la route active).
- `RoadbookDetail` : titre, distance, durée, description, bouton "Charger comme itinéraire".

## 6. Convoi + réactions rapides

- Nouveau tab "Convoi" (ou intégré via bouton flottant).
- `ConvoyPanel` : créer (génère code 6 chars) / rejoindre (saisir code). Liste des membres avec position dernière vue.
- Realtime : chaque membre publie sa position toutes les 5 s (update `convoy_members.last_lat/lng`).
- Sur la carte, marqueurs des autres membres pendant navigation.
- 4 boutons flottants pendant navigation en convoi : Attends, Rejoins, Pause, Essence → insert `convoy_alerts`.
- Sub realtime affiche bulles flottantes "Road Breaker: Attends-moi 🖐️", auto-hide 15 s (via `expires_at`).

## 7. Paramètres

- Nouvel écran/modal `Profile` accessible depuis `TopBar` : contacts d'urgence (CRUD), toggle détection de chute (avec avertissement), pseudo pour le convoi.

## Détails techniques

- Store : ajouts `crashState`, `autoProtect`, `convoy`, `convoyAlerts`, `emergencyContacts`, `roadbooks`.
- Hooks : `useCrashDetection`, `useAutoProtect`, `useConvoy`, `useConvoyAlerts`, `useEmergencyContacts`, `useRoadbooks`.
- Composants : `CrashAlertOverlay`, `AutoProtectBanner`, `ProtectionBadge`, `RouteGenerator`, `DiscoveryList`, `RoadbookList`, `RoadbookDetail`, `ConvoyPanel`, `ConvoyReactionBar`, `ConvoyMessageBubbles`, `EmergencyContactsScreen`, `SettingsSheet`.
- Types étendus dans `src/types/vigla.ts`.
- Zéro dépendance nouvelle — tout tient avec React + Leaflet + Supabase déjà installés.

## Ce qui ne sera PAS fait

- Envoi automatique SMS/email serveur (Twilio/Resend) — remplacé par `sms:` / `mailto:` côté client comme choisi.
- Génération IA des découvertes — liste en dur.
- Convoi vocal / partage temps réel avancé (déjà hors périmètre).

## Critères d'acceptation

Ceux du prompt initial, plus : convoi de base fonctionnel (create/join/list membres) puisqu'on le construit avec.

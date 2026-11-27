# CLAUDE.md

**Quick-start guide for Claude Code - Complete details in linked docs**

---

## Project Overview

VIGLA — GPS navigation and road safety alert app for motorcyclists (and
drivers): real-time map, vigilance/ETA HUD, radar/hazard alerts, voice
guidance, reports, roadbooks, convoy mode.

**Tech Stack**: React + Vite + TypeScript, Supabase (backend/DB/auth),
Playwright (E2E), bun (package manager)

## 🚨 GUARDRAIL : NO FEATURE DECONSTRUCTION

Toute instruction à Lovable/Claude Code DOIT préserver les fonctionnalités
live existantes. Clause explicite "DO NOT MODIFY" sur les features
protégées, vérification avant/après. S'applique à tout, y compris l'usage
des agents/skills ci-dessous — aucun agent ne doit "refactorer" ou
"nettoyer" une feature en dehors de la tâche demandée.

**Outillage `.claude/` (depuis ECC — github.com/affaan-m/ECC) :**
- `.claude/agents/` — 72 subagents (review, sécurité, architecture...)
- `.claude/skills/` — 328 skills réutilisables
- `.claude/commands/` — 99 commandes
- `.claude/settings.json` — 4 hooks actifs : `config-protection` (bloque la
  modif de configs lint/format existantes), `block-no-verify` (bloque
  `git commit --no-verify`), `doc-file-warning` et `check-console-log`
  (avertissent sans bloquer). Reste des hooks ECC dans
  `.claude/hooks-available/`, inactifs.

**Skill `watch` (depuis claude-video — github.com/bradautomates/claude-video, MIT) :**
- `.claude/skills/watch/` — donne à Claude la capacité de "regarder" une vidéo
  (URL YouTube/TikTok/Vimeo ou fichier local) : téléchargement, extraction de
  frames, transcription, puis analyse par Claude.
- Deux moteurs : `gemini` (clé gratuite sur https://aistudio.google.com/apikey)
  ou `local` (ffmpeg + yt-dlp + WhisperX/Groq/OpenAI en fallback). Prérequis :
  Python 3.10+, ffmpeg/ffprobe, yt-dlp.
- Hook `SessionStart` associé (lecture seule, toujours exit 0, n'avertit que).
- N'auto-génère PAS de skill permanent à partir d'une vidéo — analyse ponctuelle.

**Skills `superpowers` (depuis obra/superpowers — github.com/obra/superpowers,
MIT, Jesse Vincent) :**
- 15 skills dans `.claude/skills/` : `brainstorming`, `writing-plans`,
  `executing-plans`, `test-driven-development`, `systematic-debugging`,
  `using-superpowers`, `writing-skills`, `subagent-driven-development`,
  `dispatching-parallel-agents`, `using-git-worktrees`,
  `finishing-a-development-branch`, `requesting-code-review`,
  `receiving-code-review`, `verification-before-completion`,
  `diagnosing-superpowers`. Méthodes de travail (planification, TDD, debug
  systématique, code review) — complète les skills ECC, pas de conflit.
- Hook `SessionStart` associé (lecture seule, exit 0) : peut ne pas injecter
  le contexte automatiquement hors installation plugin officielle — les
  skills restent utilisables via l'outil Skill dans tous les cas.

---

## Session Start Protocol ⚡

**MANDATORY** at start of each session:

```bash
# Load essential docs (~800 tokens - 2 min read)
✓ .claude/COMMON_MISTAKES.md      # ⚠️ CRITICAL - Read FIRST
✓ .claude/QUICK_START.md          # Essential commands
✓ .claude/ARCHITECTURE_MAP.md     # File locations
```

**At task completion:**
- Create completion doc in `.claude/completions/YYYY-MM-DD-task-name.md`
- Move session file to `.claude/sessions/archive/` (if created)

**⚠️ NEVER auto-load:**
- Files in `.claude/completions/` (0 token cost)
- Files in `.claude/sessions/` (0 token cost)
- Files in `docs/archive/` (0 token cost)

---

## Quick Start Commands

```bash
# Add your common commands here
```

---

**Last Updated**: 2026-11-12
**Optimized with**: [Claude Token Optimizer](https://github.com/nadimtuhin/claude-token-optimizer)

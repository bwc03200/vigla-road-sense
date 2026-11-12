# CLAUDE.md

**Quick-start guide for Claude Code - Complete details in linked docs**

---

## Project Overview

VIGLA — GPS navigation and road safety alert app for motorcyclists (and
drivers): real-time map, vigilance/ETA HUD, radar/hazard alerts, voice
guidance, reports, roadbooks, convoy mode.

**Tech Stack**: React + Vite + TypeScript, Supabase (backend/DB/auth),
Playwright (E2E), bun (package manager)

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

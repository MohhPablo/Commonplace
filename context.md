# CONTEXT.md — Commonplace PWA

> Project briefing for AI agents and future sessions. Read this FIRST so you don't re-explore the repo from scratch. It's the authoritative map of architecture, data model, patterns, and the product's non-negotiables.

## What this app is

**Commonplace** — a private, offline-first daily companion (journal, tasks, priorities, habits) that feels like a warm paper notebook. No accounts, no backend, no cloud. Installable PWA (add to Home Screen, standalone). Built exactly to the brief in `daily-companion-pwa-prompt.md` + `pwa-ios-technical-reference.md` (keep those two for product/technical intent).

Working name: **commonplace**. npm package name: `commonplace@0.1.0`.

## Stack (exact)

- **React 18 + TypeScript + Vite 6** (no router — tab switching is React `useState`).
- **Tailwind CSS v4** (via `@tailwindcss/vite`), themed with CSS vars in `@theme`.
- **Framer Motion** — all transitions/springs, drag-reorder, bottom sheets.
- **Tiptap** (ProseMirror) — journal rich-text editor.
- **Dexie 4** — IndexedDB wrapper (the ONLY data store).
- **vite-plugin-pwa** (Workbox) — manifest + service worker (`autoUpdate`, `skipWaiting`, `clientsClaim`).
- **@phosphor-icons/react** — iconography (duotone/light weights only).
- **Web Notifications API** — foreground-only reminders (no backend, no scheduled push).

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (typecheck + production build + PWA precache)
- `npm run preview` — serve `dist/` (use this to test the real build)
- `npm run typecheck` — `tsc -b --noEmit`

## Architecture at a glance

```
index.html  →  #boot-splash (instant CSS paint) + viewport meta (viewport-fit=cover, interactive-widget=resizes-content)
src/main.tsx → mounts <App/>, requestPersistentStorage(), fade-then-remove splash
src/App.tsx  → top-level shell:
   - state: active TabKey, locked (password gate), settingsOpen, showOnboarding
   - <TodayBanner/> (fixed top, undone habits)
   - <main> renders ONE tab by `active`:
        journal | tasks | priorities | habits | review   (review added later)
   - <TabBar/> fixed bottom; <Splash/> 900ms fade; <Settings/> sheet (gear button top-right)
   - <LockScreen/> (when password set) ; <Onboarding/> (first run, once)
src/components/  TabBar, Icon, Checkbox, EmptyState, Splash, LockScreen, Settings, Onboarding
src/features/    journal/, tasks/, priorities/, habits/, review/
src/lib/         db.ts, habits.ts, date.ts, badge.ts, notifications.ts, settings.ts,
                 auth.ts, haptics.ts, backup.ts
src/index.css    Tailwind import + @theme tokens + dark/sepia theme overrides + global rules
vite.config.ts   plugins + manualChunks (motion/tiptap/dexie vendor splits)
```

**No router, no global state library, no Context for data.** Each feature loads from Dexie into local `useState`, re-reads on mutation. React state is ephemeral UI only.

## Data model (Dexie: db name `"commonplace"`)

Tables (all in `src/lib/db.ts`). **Migrations are cumulative — never edit old `version(n)` blocks, only append.**

| Table | Key fields | Notes |
|---|---|---|
| `entries` | `id, createdAt, updatedAt, content (Tiptap JSON), wordCount` | Journal. Debounced autosave (500ms). |
| `tasks` | `id, text, dueDate(null), completed, completedAt, createdAt` | Flat todo. Swipe-to-delete. |
| `priorities` | `id, list("needs"|"wants"), text, order, fulfilled, fulfilledAt, createdAt` | Two reorderable lists via Framer `Reorder`. |
| `habits` | `id, name, createdAt, archived` | Soft-delete via `archived`. |
| `habitLogs` | `id, habitId, date(YYYY-MM-DD), completed` | Compound index `[habitId+date]` = one log/day. |
| `moods` | `id, date(YYYY-MM-DD), score(1-5), label?, createdAt` | Review tab. Added v3. |
| `reflections` | `id, date(YYYY-MM-DD), content, createdAt` | Review tab daily prompt. Added v3. |
| `meta` | `id, key, value` | KV store for settings: `setting:reminderTime`, `setting:theme`, `setting:onboarded`, `authHash` (password). Added v2. |

**Dexie schema history:** v1 (core 5 tables) → v2 (added `meta`) → v3 (added `moods`, `reflections`).

**Backup** (`src/lib/backup.ts`): `exportData()`/`downloadBackup()`/`importData()` snapshot ALL tables (incl. moods/reflections). `importData` validates `version === 1` and wraps a Dexie transaction over every table.

## Key modules & how to use them

- **`lib/db.ts`** — `db` singleton + interfaces + `requestPersistentStorage()` (best-effort `navigator.storage.persist()`).
- **`lib/date.ts`** — `dayKey()` (local `YYYY-MM-DD`, the canonical daily key), `fromDayKey()`, `formatDateline()`, `formatShort()`, `formatRelative()`. Always use `dayKey()` for "today" comparisons (habitLogs, moods, reflections).
- **`lib/habits.ts`** — `currentStreak(habitId, logs)`, `isDoneOn(logs, habitId, key)`, `toggleToday(habit, logs)`.
- **`lib/auth.ts`** — password gate. `isPasswordSet()`, `setPassword()` (PBKDF2-SHA256, Web Crypto, salt stored in `meta.authHash`), `verifyPassword()`, `clearPassword()`, `resetAllData()` (wipes everything).
- **`lib/notifications.ts`** — `requestReminderPermission()`, `showForegroundReminder()` (persistent: `requireInteraction:true`, keeps ref), `configureReminder()`/`saveReminderTime()` (foreground scheduler fires at user-chosen HH:MM while app open, lists undone habits).
- **`lib/settings.ts`** — KV helpers `getSetting/setSetting`, plus typed `getReminderTime/setReminderTime`, `getTheme/setTheme` (`"paper"|"dark"|"sepia"`), `getOnboarded/setOnboarded`.
- **`lib/haptics.ts`** — `tap()` → `navigator.vibrate`. **No-op on iOS by design** (Vibration API unsupported; see technical ref §1). Safe to call anywhere.
- **`lib/badge.ts`** — `setBadge()`/`clearBadge()` (Badging API, best-effort).

## Design system (the "Warm & Editorial" look — non-negotiable)

Defined as CSS vars in `src/index.css` `@theme` and overridden per `html[data-theme]`:
- paper `#FAF6EF`, surface `#FDFBF7`, ink `#2B2420`, softink `#6B6058`, terracotta `#C1502D` (primary accent), sage `#4B5D45` (success), ochre `#C89B3C` (streaks), taupe `#E4DCCB` (dividers), rust `#A8412A` (destructive).
- Fonts: **Fraunces** (serif headers/dates/wordmark) + **Inter** (UI/body). Loaded via Google Fonts `<link>` in `index.html`.
- Phosphor icons only; duotone secondary layer = terracotta low-opacity. Custom `Checkbox` (never native `<input type=checkbox>`).
- Spring transitions (Framer Motion), warm diffuse shadows (`--shadow-page`/`--shadow-lift`), subtle paper-grain overlay (`.paper-grain`).
- **Layout:** centered `max-w-md` column, `min-h-dvh`, safe-area insets everywhere, `pb-24` main to clear fixed TabBar.

## iOS-specific constraints (do NOT violate)

From `pwa-ios-technical-reference.md` — these are hard limits, not preferences:
- **No backend** → no scheduled notifications while app closed, no Web Push without a server. Reminders = in-app banner + Badge API + best-effort foreground Notification only.
- **`navigator.vibrate` unsupported on iOS** → use motion/color feedback (haptics.ts is a safe no-op there).
- **No native HTML5 drag-and-drop** → use Framer `Reorder` (already done in Priorities).
- Manifest alone insufficient on iOS → separate apple-touch-icon/meta tags already in `index.html`.
- `viewport-fit=cover` + safe-area insets; `interactive-widget=resizes-content` added to fix keyboard jump.

## Features summary

| Tab | Component | Behavior |
|---|---|---|
| Journal | `features/journal/Journal.tsx` + `Editor.tsx` | List↔Write; Tiptap; debounced autosave; search; BubbleMenu on selection. |
| Tasks | `features/tasks/Tasks.tsx` | Add/due/complete; swipe-to-delete; collapsed Done. |
| Priorities | `features/priorities/Priorities.tsx` | Needs/Wants segmented; Framer `Reorder`; fulfilled section. |
| Habits | `features/habits/Habits.tsx` + `MonthGrid.tsx` | Add/delete; one-tap today; streak; calendar expands inline per habit (tap card); foreground reminders + time picker. |
| Review | `features/review/Review.tsx` | Daily reflection prompt (autosave), 5-point mood picker + 7-day strip, insights (best streak, words/week, entries, avg mood). |

**Cross-cutting:** Splash (fade), password LockScreen (PBKDF2), Settings sheet (password/theme/notifications/backup), Onboarding (first-run, once), haptics on toggle, dark/sepia themes, vendor chunk splitting.

## How to add a new feature (the proven pattern)

1. **Data?** Add interface + `Table` prop in `db.ts`, bump Dexie to next version listing ALL tables. Extend `BackupData` in `db.ts` and the read/clear/bulkAdd in `backup.ts`. If it's just config, store as `setting:*` in `meta` via `lib/settings.ts` (no migration needed).
2. **UI?** New tab → add to `TabKey` + `TABS` in `components/TabBar.tsx` and render in `App.tsx`. Small feature → add to an existing feature or the `Settings` sheet.
3. **Style?** Use the existing palette CSS vars / `Icon` / `Checkbox` / `EmptyState`. Respect safe areas.
4. **Verify:** `npm run build` (must pass tsc + PWA precache) then `npm run preview` and test at the printed localhost URL. Test on a real iPhone for PWA behaviors.

## Known gotchas

- `tsconfig` is strict (`noUnusedLocals`/`noUnusedParameters`) — remove unused imports/params or build fails.
- Dexie `db.transaction("rw", ...)` takes **max 5 table args** → pass an **array** for more (used in `backup.ts`, `auth.ts`).
- `@tiptap/pm` has **no root entry** → don't list it in `manualChunks`; split `@tiptap/react` + `@tiptap/starter-kit` only.
- Web Crypto `deriveBits` salt needs `as BufferSource` cast under the current TS DOM lib.
- Background preview server on port 4173 — kill with `kill_shell` when done.

## Files you'll touch most

`src/App.tsx`, `src/components/TabBar.tsx`, `src/lib/db.ts`, `src/lib/settings.ts`, `src/index.css`, `vite.config.ts`. Feature logic lives under `src/features/<name>/`.

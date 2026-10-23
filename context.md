# CONTEXT.md — Commonplace PWA

> Project briefing for AI agents and future sessions. Read this FIRST so you don't re-explore the repo from scratch. It's the authoritative map of architecture, data model, patterns, and the product's non-negotiables.

## What this app is

**Commonplace** — a private, offline-first daily companion (journal, tasks, priorities, habits) with an iOS-inspired glass interface and a quiet full-page writer. No accounts, no backend, no cloud. Installable PWA (add to Home Screen, standalone). Originally based on `daily-companion-pwa-prompt.md` + `pwa-ios-technical-reference.md` (keep those two for product/technical intent).

Working name: **commonplace**. npm package name: `commonplace` (see package.json for release version).

## Stack (exact)

- **React 18 + TypeScript + Vite 6** (no router — tab switching is React `useState`).
- **Tailwind CSS v4** (via `@tailwindcss/vite`), themed with CSS vars in `@theme`.
- **Framer Motion** — all transitions/springs, drag-reorder, bottom sheets.
- **Tiptap 3** (ProseMirror) — journal rich-text editor.
- **Dexie 4** — IndexedDB wrapper (the ONLY data store).
- **vite-plugin-pwa** (Workbox) — manifest + service worker (prompt-based updates, explicit activation from Settings, `clientsClaim`).
- **@phosphor-icons/react** — iconography (regular weight, fill when active — reads like SF Symbols).
- **sonner** — undo toasts (glass pill, swipe to dismiss), bridged through `UndoSnackbar`.
- **@number-flow/react** — rolling digits for stats via `AnimatedNumber` (plain text where WAAPI is missing).
- **Web Notifications API** — foreground-only reminders (no backend, no scheduled push).

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` (typecheck + production build + PWA precache)
- `npm run preview` — serve `dist/` (use this to test the real build)
- `npm run typecheck` — `tsc -b --noEmit`
- `npm test` — Vitest regression tests (Node.js 24 recommended)

## Architecture at a glance

```
index.html  →  #boot-splash (instant CSS paint) + viewport meta (viewport-fit=cover, interactive-widget=resizes-content)
src/main.tsx → mounts <App/>, requestPersistentStorage(), fade-then-remove splash
src/App.tsx  → top-level shell:
   - state: active TabKey, locked (password gate), settingsOpen, showOnboarding
   - Auth/theme initialization gate; background privacy lock; visible in-app reminder
   - <main> renders ONE content tab by `active` (secondary features are lazy-loaded):
        journal | tasks | priorities | habits | review   (review added later)
   - Five-tab <TabBar/> anchored in the app frame; <Splash/>; <Settings/> sheet from the header gear
   - <LockScreen/> (when password set) ; <Onboarding/> (first run, once)
src/components/  TabBar, Icon, Checkbox, EmptyState, Splash, LockScreen, Settings, Onboarding,
                 FAB (+ HeaderSlot), ProgressRing, AnimatedNumber, UndoSnackbar (+ AppToaster)
src/features/    journal/, tasks/, priorities/, habits/, review/
src/lib/         db.ts, habits.ts, date.ts, badge.ts, notifications.ts, settings.ts,
                 auth.ts, haptics.ts, backup.ts
src/index.css    Tailwind import + @theme tokens + dark/sepia theme overrides + global rules
vite.config.ts   plugins + manualChunks (motion/tiptap/dexie vendor splits)
```

**No router, no global state library, no Context for data.** Each feature loads from Dexie into local `useState`, re-reads on mutation. React state is ephemeral UI only.

## Data model (Dexie: db name `"commonplace"`)

Tables (all in `src/lib/db.ts`). **Migrations are cumulative — never edit old `version(n)` blocks, only append.**

| Table         | Key fields                                                   | Notes                                                                                                                 |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `entries`     | `id, createdAt, updatedAt, content (Tiptap JSON), wordCount` | Journal. Serialized autosave (500ms) with retry and navigation flush.                                                 |
| `tasks`       | `id, text, dueDate(null), completed, completedAt, createdAt` | Flat todo. Swipe-to-delete.                                                                                           |
| `priorities`  | `id, list("needs"                                            | "wants"), text, order, fulfilled, fulfilledAt, createdAt`                                                             | Two reorderable lists via Framer `Reorder`, text editing, keyboard reorder, debounced order writes. |
| `habits`      | `id, name, createdAt, archived`                              | Soft-delete via `archived`.                                                                                           |
| `habitLogs`   | `id, habitId, date(YYYY-MM-DD), completed`                   | Compound index `[habitId+date]` = one log/day.                                                                        |
| `moods`       | `id, date(YYYY-MM-DD), score(1-5), label?, createdAt`        | Review tab. Added v3.                                                                                                 |
| `reflections` | `id, date(YYYY-MM-DD), content, createdAt`                   | Review tab daily prompt. Added v3.                                                                                    |
| `meta`        | `id, key, value`                                             | KV store for settings: `setting:reminderTime`, `setting:theme`, `setting:onboarded`, `authHash` (password). Added v2. |

**Dexie schema history:** v1 (core 5 tables) → v2 (`meta`) → v3 (`moods`, `reflections`) → v4 (repair duplicate logical keys) → v5 (unique meta keys and daily habit/mood/reflection keys). Old migrations are unchanged.

**Backup** (`src/lib/backup.ts`): `exportData()`/`downloadBackup()`/`importData()` snapshot ALL tables (incl. moods/reflections). `importData` validates the complete backup before a replacement transaction. Settings previews record counts and requires an explicit replacement action. Export flushes drafts and reads a consistent transaction.

## Key modules & how to use them

- **`lib/db.ts`** — `db` singleton + interfaces + `requestPersistentStorage()` (best-effort `navigator.storage.persist()`).
- **`lib/date.ts`** — `dayKey()` (local `YYYY-MM-DD`, the canonical daily key), `fromDayKey()`, `formatDateline()`, `formatShort()`, `formatRelative()`. Always use `dayKey()` for "today" comparisons (habitLogs, moods, reflections).
- **`lib/habits.ts`** — `currentStreak(habitId, logs)`, `isDoneOn(logs, habitId, key)`, `toggleToday(habit)` (transactional).
- **`lib/auth.ts`** — password gate. `isPasswordSet()`, `setPassword()` (PBKDF2-SHA256, Web Crypto, salt stored in `meta.authHash`), `verifyPassword()`, `clearPassword()`, `resetAllData()` (wipes everything).
- **`lib/notifications.ts`** — `requestReminderPermission()`, `showForegroundReminder()` (persistent: `requireInteraction:true`, keeps ref), `configureReminder()`/`saveReminderTime()` (foreground scheduler fires at user-chosen HH:MM while app open, lists undone habits).
- **`lib/settings.ts`** — KV helpers `getSetting/setSetting`, plus typed `getReminderTime/setReminderTime`, `getTheme/setTheme` (`"paper"|"dark"|"sepia"`), `getOnboarded/setOnboarded`, `getWritingSize/setWritingSize` (small/default/large).
- **`lib/haptics.ts`** — `tap()` → `navigator.vibrate`. **No-op on iOS by design** (Vibration API unsupported; see technical ref §1). Safe to call anywhere.
- **`lib/badge.ts`** — `setBadge()`/`clearBadge()` (Badging API, best-effort).

## Design system (current user direction)

The latest direction: an Apple-made feel that is still distinctly Commonplace (iOS 26-style glass chrome, large titles, warm brand).

- Tokens live in `src/index.css`. Light (`paper`, warm #F3F1EE), dark and sepia define surfaces, Apple system tints (`--tint-blue`, `--tint-green`…), `--fill`, and glass materials (`--glass-bg`, `--glass-rim`, `--glass-shadow`). `Theme` also has `system`, which follows `prefers-color-scheme`; `applyTheme` mirrors the choice into `localStorage["commonplace:theme"]` so `index.html` can paint the right boot splash before JS.
- Section tint: `data-section` on `<html>` and `.app-session` sets `--tint`/`--tint-2` per tab. Components use `var(--tint)` rather than a fixed accent. Settings (`.sheet-page`) stays terracotta.
- Typography: system font (SF Pro) with Inter Variable fallback; `--font-rounded` (SF Rounded) for numbers; `--font-display` (`ui-serif` → New York) for prompts and the writer's date heading.
- Shell: `.app-scroll` fills the session; `.app-header` overlays it with a progressive blur that appears after scrolling, plus a compact title. Screen actions portal into the header through `HeaderSlot`/`HeaderAction` (`FAB` uses it; standalone renders fall back inline). `.tab-bar` is a floating glass capsule with a `layoutId` pill.
- Cards use `--r` radii and become true squircles where `corner-shape` is supported. `.icon-tile` is the Settings-style coloured square.
- Sheets float inset from the screen edges (iOS 26) with a circular close button and a tinted pill action. The writer has a glass back pill, a Done pill and a floating formatting capsule.
- Icon & launch art: `scripts/gen-icons.mjs` renders the SVG master into PNG icons and 22 `apple-touch-startup-image`s (11 iPhone sizes × light/dark), written between markers in `index.html`. Launch images are excluded from the Workbox precache.
- `lib/updates.ts` registers the worker directly and saves drafts before explicit activation; it waits for controllerchange before reloading, including updates activated from another tab. Keep PWA updates prompt-based so ordinary downloads do not reload an active draft.

## iOS-specific constraints (do NOT violate)

From `pwa-ios-technical-reference.md` — these are hard limits, not preferences:

- **No backend** → no scheduled notifications while app closed, no Web Push without a server. Reminders = in-app banner + Badge API + best-effort foreground Notification only.
- **`navigator.vibrate` unsupported on iOS** → use motion/color feedback (haptics.ts is a safe no-op there).
- **No native HTML5 drag-and-drop** → use Framer `Reorder` (already done in Priorities).
- Manifest alone insufficient on iOS → separate apple-touch-icon/meta tags already in `index.html`.
- `viewport-fit=cover` + safe-area insets; `interactive-widget=resizes-content` is a browser hint; keyboard layout also uses measured VisualViewport insets.

## Features summary

| Tab        | Component                                      | Behavior                                                                                                                                                                  |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journal    | `features/journal/Journal.tsx` + `Editor.tsx`  | List↔Write; Tiptap; debounced autosave; search; keyboard-aware writing dock with expandable formatting; lazy-loaded editor.                                              |
| Tasks      | `features/tasks/Tasks.tsx`                     | Smart lists (Today/Scheduled/All/Completed); Overdue/Today/Upcoming/Anytime sections; swipe or sheet delete; Undo.                                                        |
| Priorities | `features/priorities/Priorities.tsx`           | Needs/Wants segmented; Framer `Reorder`; fulfilled section.                                                                                                               |
| Habits     | `features/habits/Habits.tsx` + `MonthGrid.tsx` | Daily progress ring; one-tap today; streak pill; 7-day strip; tap name to expand month calendar + Archive (with Undo).                                                     |
| Review     | `features/review/Review.tsx`                   | Activity rings (habits, tasks, reflect), reflection prompt (autosave), mood orbs, 7-day mood bars, insights.                                                               |

**Cross-cutting:** Splash (fade), password LockScreen (PBKDF2), Settings page (password/theme/notifications/backup/app updates), Onboarding (first-run, once), haptics on toggle, dark/sepia themes, vendor chunk splitting.

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

## Reliability and interaction updates

- `lib/autosave.ts` / `useAutosave.ts` serialize and coalesce draft writes. App navigation and backup export await pending saves; failed drafts stay available for retry. Deletion discards pending writes before deleting, and reset discards all drafts before clearing tables.
- Lock initialization completes before private features first mount. After an unlocked session is backgrounded, the entire private surface is hidden from layout, focus, and accessibility while preserving in-memory drafts. The passcode is not encryption.
- `lib/useToday.ts` refreshes daily feature state at midnight and on resume. Reminder dates use local `dayKey()`. Reminders can show an in-app banner without system notification support.
- `BottomSheet` is a labelled modal portal with focus containment, Escape handling, background inertness, and focus restoration.
- Theme colors use semantic CSS variables, including `--color-onaccent`. Page zoom gestures are restricted at the app surface as requested; rich-text selection remains enabled. Every editable field is at least 16px. Motion respects the device preference.
- Journal lists show searchable excerpts and month groups. Tasks and priorities are editable. Mood choices have visible text labels.
- See `README.md`, `tests/`, and `.github/workflows/check.yml` for verification and remaining real-device checks.

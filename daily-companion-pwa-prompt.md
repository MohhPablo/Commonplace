# Daily Companion — PWA Development Prompt

## How to use this prompt

Feed this whole file to your AI coding tool as the project brief. A companion file, **`pwa-ios-technical-reference.md`**, is referenced throughout — give the AI both files together. The reference doc is the authority on anything technical (what iOS actually supports); this doc is the authority on product and design decisions. Where the two might seem to conflict, the technical reference wins on feasibility, this doc wins on intent.

---

## 1. Project vision

This is a personal, daily-use companion app — one quiet home for writing, tasks, priorities, and habits. It should feel like a well-made paper notebook that happens to live on a phone: warm, unhurried, a little bit editorial (think a nicely typeset magazine or a Moleskine, not a productivity SaaS dashboard). It is for one person's private daily use — no accounts, no social features, no gamified dopamine-loop design. Calm over flashy. Considered over generic.

**Working name ideas** (pick one, or ignore and use your own): *Commonplace* (a "commonplace book" was historically exactly this — a single notebook mixing journal entries, notes, and daily lists — a nice thematic fit), *Marginalia*, *Quire*, *Foolscap*, *Ledger & Leaf*.

Avoid anything that reads as a generic Material Design to-do app, a dark-mode "hacker" productivity tool, or a cutesy gamified habit app with mascots and confetti. The bar: if a screenshot could be mistaken for any other to-do app on the App Store, it's too generic — redo it.

---

## 2. Non-negotiable technical foundation

- **PWA, installable on iPhone Home Screen**, running in standalone display mode (no Safari chrome visible once installed).
- **Fully offline-first.** Every feature must work with no network connection at all — this is a local, on-device app by design, not a "sometimes offline" web app.
- **All data stored on-device only** (IndexedDB). No backend, no accounts, no login, no cloud sync in v1.
- Must **feel native**: native-feeling navigation, gestures, transitions, and typography — not a website squeezed into a phone frame.
- Follow **`pwa-ios-technical-reference.md`** exactly for manifest setup, service worker caching, storage persistence, notification behavior, and touch drag-and-drop. Do not substitute an API it flags as unsupported on iOS (e.g. Background Sync, the Notification Triggers API, the Vibration API) even if it seems like the "obvious" solution — it will silently fail on a real iPhone.

---

## 3. Design system — "Warm & Editorial"

### Color palette

| Role | Color | Hex | Notes |
|---|---|---|---|
| Background (paper) | Paper White | `#FAF6EF` | Warm ivory, not stark white — the base of every screen |
| Surface (cards) | Warm White | `#FDFBF7` | Slightly lighter than background, for cards/sheets sitting "on" the paper |
| Primary text | Ink | `#2B2420` | Warm near-black, not pure `#000` |
| Secondary text | Soft Ink | `#6B6058` | Warm gray-brown for metadata, timestamps, placeholders |
| Primary accent | Terracotta | `#C1502D` | Primary actions, active tab, journal accents — used deliberately, not everywhere |
| Secondary accent | Sage | `#4B5D45` | Habit completions, success states, positive confirmations |
| Tertiary accent | Ochre | `#C89B3C` | Streaks, highlights, badges — a small "gold leaf" moment, used sparingly |
| Divider / hairline | Warm Taupe | `#E4DCCB` | Borders, separators — never pure gray |
| Error / destructive | Muted Rust | `#A8412A` | Delete confirmations only |

Explicitly **not** dark mode, not black-and-white minimalism, not a blue-and-white SaaS palette. This palette should feel like it belongs on uncoated paper under warm light.

### Typography

- **Headers / dates / emphasis:** a serif with real character — **Fraunces** (variable font, Google Fonts) for a distinctive editorial feel without being an overused choice like Playfair Display. Use it for journal entry dates ("dateline" style, like a newspaper masthead), section headers, and the app's wordmark.
- **Body / UI text:** a clean humanist sans — **Inter** as the safe, reliable default (widely available, renders well at small sizes). If you want more personality, **General Sans** (Fontshare, free) is a good alternative.
- Set generous line-height (1.6+) in the journal editor specifically — it should read like a page, not a form field.

### Iconography

- Use **Phosphor Icons**, `duotone` or `light` weight — avoid the default filled Material Icons look entirely, it's the single fastest way to make an app feel generic.
- If using duotone, set the icon's secondary layer to the Terracotta accent at low opacity — gives icons a subtle warmth instead of flat gray.
- No default emoji as icons. No default browser `<input type="checkbox">` styling — build custom checkboxes (see Habits/Tasks below).

### Texture & motion

- Apply a very subtle paper-grain texture overlay (SVG noise filter or a low-opacity PNG, ~3–4% opacity) across backgrounds — enough to feel tactile, not enough to be noticed consciously.
- Shadows should be warm-tinted, not pure black: e.g. `rgba(43, 36, 32, 0.08)`, soft and diffuse, like a page lifting slightly off the one beneath it — not Material Design's crisp elevation shadows.
- Use **spring-based transitions** (Framer Motion) rather than linear ease curves — tab switches, list reorders, and completions should have a small amount of natural bounce.
- Completion interactions (checking off a task/habit) should have a satisfying, deliberate animation — a checkmark that draws itself, not an instant toggle.

### Layout & spacing

- Generous whitespace/margins — editorial layouts breathe. Avoid cramming.
- Content max-width and centered padding even on the widest iPhones, so text doesn't stretch edge-to-edge like a spreadsheet.
- Respect safe areas (notch, home indicator) per the technical reference doc — nothing should ever sit under the home indicator or be clipped by the notch.

---

## 4. Navigation & information architecture

**Bottom tab bar**, four tabs, custom-styled (not default iOS blue-tinted system tab bar — build it to match the palette above):

1. **Journal** (default/landing tab)
2. **Tasks**
3. **Priorities** (Needs & Wants)
4. **Habits**

Each tab icon should switch from a `light`-weight to `duotone`-weight (or outline to filled) Phosphor icon when active, with the active tab's icon and label tinted Terracotta. Keep the tab bar itself minimal — icon + short label, no badges cluttering it beyond what's specified in §5.4.

---

## 5. Feature specifications

### 5.1 Journal

- A distraction-free, full-page writing view — should feel like opening to a blank page, not filling out a form.
- Rich text formatting: **bold, italic, headings, bullet list, numbered list, blockquote**. Use a floating/selection toolbar that appears only when text is selected (like Medium's editor), not a permanently docked toolbar eating screen space.
- Each entry auto-stamps its date in the serif "dateline" style at the top — the user shouldn't have to add a title unless they want to.
- **Autosave continuously** (debounced) to IndexedDB — never require an explicit "Save" button. Given iOS can reload the page unexpectedly after backgrounding (see technical reference §8), this matters more than usual.
- A separate **entries list/timeline view** to browse past entries (by date, most recent first), with a simple text search across all entries.
- Word count, shown subtly (not a prominent stat) — a small editorial touch, not a productivity metric.
- Recommended library: **Tiptap** (built on ProseMirror) for the rich text editor rather than a raw `contentEditable` implementation.

### 5.2 Tasks (To-Do List)

- Simple flat list: add, edit, complete, delete.
- Optional due date per task (no due date required).
- Custom checkbox styling matching the palette — checking a task off should feel satisfying (see motion notes above), and completed tasks move to a collapsed "Done" section at the bottom rather than vanishing instantly.
- Swipe-to-delete gesture on list items for a native-feeling interaction, in addition to an explicit delete option (swipe gestures aren't always discoverable).
- No drag-reordering required here (that's reserved for Priorities) unless you want to add it as a nice-to-have.

### 5.3 Priorities (Needs & Wants)

- **Two separate, clearly labeled lists**: "Needs" and "Wants" — either as a segmented control at the top of the tab or two stacked sections, whichever reads cleaner given the design system.
- Each list is **independently drag-reorderable** — dragging changes priority order, top of the list = highest priority. Follow §5 of the technical reference doc for the drag implementation (Framer Motion `Reorder` or `dnd-kit` — **not** the native HTML5 drag-and-drop API, it doesn't work reliably on iOS touch).
- Each item has a checkbox to mark it "fulfilled" — checked items move into a collapsed "Fulfilled" section at the bottom of their respective list (kept as a record, not deleted), matching the Tasks pattern for consistency.
- Give the lists a slightly different visual treatment from Tasks — e.g. numbered like a manuscript list — so this section doesn't feel like a re-skinned to-do list.

### 5.4 Habits (Habit Tracker)

- **Multiple custom habits**, each user-created with a name, and each with its **own independent streak**.
- Each habit gets a **calendar-style completion view** — a monthly grid where completed days are marked with a small filled "ink stamp" dot/mark (not a generic green square heatmap) — visually consistent with the paper/editorial theme.
- Tapping a habit's entry for "today" marks it complete/incomplete — simple one-tap interaction from the main Habits screen, without needing to drill into the calendar view for routine use.
- Current streak count displayed prominently per habit (Ochre accent — this is the one place a small "gold star" moment fits the theme).

**Reminders — read this before building:**
Per the technical reference doc §4, there is no way to fire a scheduled OS notification while this app is fully closed without a backend server, and this app intentionally has none. Build reminders as:
1. An **in-app "today" banner** at the top of the Habits tab (and optionally the Journal/home view) showing which habits are still undone — shown every time the app is opened.
2. The **Badge API**, setting a count on the Home Screen icon for incomplete habits.
3. An **opt-in "Enable Notifications" toggle** that requests permission and shows a best-effort local alert if the app happens to be open around the user's chosen time.

Do **not** promise or attempt "reminds you even when the app is closed, no setup required" — that specific claim requires a backend and would be a broken promise on iOS. If true background push reminders matter enough later, flag it to the user as a Phase 2 that requires adding a small server component — don't quietly half-build it now.

---

## 6. Data & offline behavior

- All data lives in **IndexedDB** (recommend the **Dexie.js** wrapper for a saner API than raw IndexedDB).
- Suggested schema (adjust as needed):
  - `entries`: id, createdAt, updatedAt, content (rich text JSON), wordCount
  - `tasks`: id, text, dueDate (nullable), completed, completedAt, createdAt
  - `priorities`: id, list ("needs" | "wants"), text, order (for drag position), fulfilled, fulfilledAt, createdAt
  - `habits`: id, name, createdAt, archived
  - `habitLogs`: id, habitId, date (day granularity), completed
- Request persistent storage on first load (`navigator.storage.persist()` — see technical reference §3).
- Build a simple **Export** action (single JSON file download, timestamped) and matching **Import** action, as a manual backup safety net — this is on-device, user-controlled, and doesn't contradict the "no cloud sync" decision, it just protects against iOS's storage eviction behavior (see technical reference §3).
- Every feature must be fully usable with the device in airplane mode, including on first-ever launch after installing.

---

## 7. PWA installability & native-feel checklist

Full detail lives in the technical reference doc — this is the short version to confirm before calling it done:

- [ ] Valid `manifest.json` **and** the separate iOS meta tags (manifest alone is not enough on iOS)
- [ ] 192×192, 512×512, and 512×512 maskable icons, plus a 180×180 `apple-touch-icon`
- [ ] Service worker caches the app shell for full offline use, with `skipWaiting()`/`clients.claim()` so updates apply cleanly
- [ ] Splash flash minimized (matching `background_color`/`theme-color` to the paper background, or real `apple-touch-startup-image` assets)
- [ ] Safe-area insets respected on every screen (notch + home indicator)
- [ ] No tap-highlight flash, no double-tap-zoom on buttons, no rubber-band overscroll revealing blank space
- [ ] Tested on a **real iPhone** via the actual "Add to Home Screen" flow, not just emulated in desktop DevTools

---

## 8. Explicit constraints (please don't do these)

- No user accounts, login, or authentication of any kind.
- No cloud database, no backend API, no analytics/tracking calls.
- No reliance on APIs the technical reference doc flags as unsupported on iOS (Background Sync, Notification Triggers/`showTrigger`, Vibration API, native HTML5 drag-and-drop touch support).
- No dark mode requirement — this app is intentionally light/paper-themed; don't default to a dark theme or make dark mode a priority.
- No gamification clutter — no mascots, no confetti bursts, no streak-shaming copy ("Don't break your streak!!"). Keep the tone calm and encouraging at most.
- Don't build all of §9 below — it's explicitly optional, pick a couple at most if any.

---

## 9. Optional enhancements (pick a few — do not build all of these)

These are offered as ideas, not requirements. Adding all of them risks a bloated v1 that's harder to get right — better to ship the four core features well and add from this list later if there's appetite.

- **Simple app lock:** a local PIN or Face ID-style unlock (via WebAuthn) before opening the app — a nice fit for a private journal, genuinely useful rather than decorative.
- **Weekly/monthly "look back" view:** a single screen collating the week's journal entries, completed tasks, and habit streaks — a gentle reflection moment.
- **Daily writing prompt (opt-in):** a small, dismissible prompt above the journal editor on days with no entry yet, not required to use the journal.
- **Mood tag per journal entry:** a single small icon/tag, not a full mood-tracking system.
- **Home Screen quick-action shortcut** (long-press the app icon → "New entry") via the manifest's `shortcuts` field.
- **Simple stats screen:** entries written, longest habit streaks, tasks completed this month — framed as gentle reflection, not productivity-metric pressure.

---

## 10. Suggested tech stack

Adjust to your tool's defaults if it has strong opinions, but this combination fits the requirements well:

- **React + Vite**, with `vite-plugin-pwa` (handles manifest + service worker generation via Workbox reliably)
- **Tailwind CSS**, themed with the exact palette in §3 (avoid Tailwind's default slate/gray grays — override them)
- **Framer Motion** for transitions and the Priorities drag-reorder (`Reorder.Group`)
- **Tiptap** for the journal rich text editor
- **Dexie.js** for IndexedDB
- **Phosphor Icons** (`@phosphor-icons/react` or equivalent) for iconography

A plain client-side app (no server runtime) is the right shape here — avoid frameworks/setups that assume a backend by default.

---

## 11. Definition of done

- All four features (Journal, Tasks, Priorities, Habits) fully functional offline, with data persisting across app restarts.
- Installs cleanly to an iPhone Home Screen and opens in standalone mode with correct icon, name, and colors.
- No screen looks like a generic/default component library demo — palette, type, and icons from §3 are applied everywhere, including empty states.
- Passes the checklist in §7.
- Reminders behave exactly as scoped in §5.4 — no broken promise about notifications firing while the app is closed.

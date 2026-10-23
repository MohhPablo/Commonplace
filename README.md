# Commonplace

A private, offline-first journal, task list, priorities notebook, and habit tracker. Built with React, TypeScript, Vite, Dexie, and Tiptap. Everything is stored in IndexedDB on the current device; no account or backend is required.

## Development

Use Node.js 24 LTS (the test runner requires Node.js 22.12 or newer).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The regression suite covers database upgrades, PIN changes, backup validation, reset, autosave ordering and recovery, editing, keyboard interaction, and daily reminders. DOM tests do not replace testing Safari and the installed Home Screen app on an actual iPhone.

## Keeping your data safe

- Export a JSON backup from Settings before moving devices or clearing browser data. Export waits for pending drafts to save.
- Import validates a backup and asks before replacing your current content. Device settings and the passcode are retained.
- The passcode is a UI privacy gate, not data encryption. Backups are readable JSON.
- Reset clears all content and settings. If you forgot the passcode, only reset the app when you accept losing its local data.
- Reminder timers work while Commonplace is open. They do not wake a closed app.

## App experience

- Each screen opens with an iOS-style large title that collapses into the navigation bar on scroll. A floating glass tab bar sits above the home indicator, and each space has its own tint: Journal terracotta, Tasks blue, Priorities indigo, Habits green, Review pink.
- Launch: iOS shows a generated launch image, the HTML boot splash repeats it exactly, then the animated splash zooms into the app. Regenerate the icon and launch images with `npm i --no-save playwright && node scripts/gen-icons.mjs`.
- Theme defaults to System (follows the device's light/dark setting); Light, Sepia and Dark remain available in Settings.
- Sheets close from their grabber, heading, or a downward pull on non-interactive content at the top. Scrolling and editing fields keep their usual behavior.
- The journal opens as a full-height writing page, with a keyboard-aware toolbar, undo/redo, lists, formatting, and an optional book font. Done saves before returning to entries.
- Writing size (Small / Default / Large) is available in Settings. Page zoom gestures are restricted on app surfaces while text selection remains available.
- Settings → Check for updates checks for a new version, saves pending drafts, and installs the downloaded update. Failed saves or downloads leave the app open for retry.

## Existing installations

Database versions 4 and 5 repair duplicate logical keys before enforcing uniqueness. The currently effective PIN is retained, and journal/task/priority records are preserved. Older version-one backups remain supported.

## Release checks

Before merging, run the tests and production build. On an iPhone, also check the keyboard and caret, scroll position, safe areas, all three themes, background locking, offline launch, and updating the installed app while writing. Automated tests and desktop Chrome smoke checks cover writing, autosave, Done navigation, the Settings update check, sheet-grabber dismissal, and light/dark rendering. Physical iPhone checks remain outstanding.

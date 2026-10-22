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

## Existing installations

Database versions 4 and 5 repair duplicate logical keys before enforcing uniqueness. The currently effective PIN is retained, and journal/task/priority records are preserved. Older version-one backups remain supported.

## Release checks

Before merging, run the tests and production build. On an iPhone, also check the keyboard and caret, scroll position, safe areas, all three themes, background locking, offline launch, and updating the installed app while writing. The current implementation was verified with automated tests; a visual browser review was unavailable in the implementation session.

# PWA on iOS — Technical Reference (read this before writing code)

**Purpose of this doc:** iOS Safari supports PWAs unevenly, and a lot of tutorials online are outdated or describe Android/Chrome behavior. This doc is a grounded, checked-in-2026 reference for exactly what iOS Safari can and can't do, so the build doesn't rely on APIs that don't exist on iPhone. Treat this as the source of truth over general training knowledge — if something here conflicts with an instinct to use a particular API, follow this doc.

---

## 1. Quick reality-check table

| Capability | iOS Safari status | Notes |
|---|---|---|
| Install to Home Screen, standalone display | ✅ Works | No `beforeinstallprompt` event — you must show your own manual "Add to Home Screen" instructions, there is no auto-install banner. |
| Offline caching via Service Worker + Cache API | ✅ Works | Reliable for app-shell caching. Storage is not guaranteed long-term (see §3). |
| IndexedDB | ✅ Works, but flaky | History of occasional transaction hangs/corruption on iOS. Wrap all calls in try/catch with retries. |
| Web Push notifications | ⚠️ Partial | Only for apps **installed to Home Screen**, iOS **16.4+**, permission prompt must follow a direct user tap, and — critically — **sending** a push requires a server (VAPID keys + a push service). A fully offline, backend-free app cannot deliver a notification while it is closed. |
| Notification Triggers API (`showTrigger` / `TimestampTrigger`) | ❌ Never shipped in WebKit | This is a Chrome/Chromium-only, experimental-flag API. Do not use it — it will silently fail on iOS. |
| Background Sync / Periodic Background Sync / Background Fetch | ❌ Not supported | No timeline for support. The app cannot "wake up" in the background to do anything. |
| Badging API (`navigator.setAppBadge`) | ✅ Works (16.4+) | Great lightweight substitute for some notification use cases — see §4. |
| Vibration API (`navigator.vibrate`) | ❌ Not supported | WebKit exposes no public vibration/haptics API. Use motion/color feedback instead, not vibration. |
| Native HTML5 Drag-and-Drop API on touch | ❌ Unreliable | The `draggable="true"` + `dragstart/dragover/drop` API was built for mouse input. Touch support is inconsistent even on recent iOS. Use a touch-first library (see §5). |
| Payment Request API / Apple Pay | ✅ Works | Not relevant here, included for completeness. |
| App manifest controlling icon/name on iOS | ⚠️ Partial | Safari mostly ignores the manifest for the Home Screen icon and title — you need separate `<meta>`/`<link>` tags (see §1a). |
| Manifest-driven splash screen | ❌ Not supported | iOS shows a blank white screen unless you supply `apple-touch-startup-image` images per device size, or fake it (see §2). |

If you only remember one thing from this table: **this app has no backend, so anything that requires a server to "push" something to the user while the app is closed is off the table for v1.**

---

## 1a. Installability — manifest.json + required iOS meta tags

Even with a correct manifest, iOS needs its own meta tags for icon, title, and status bar — the manifest alone is not enough.

```json
// manifest.json
{
  "name": "Your App Name",
  "short_name": "AppName",
  "description": "One-line description",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FAF6EF",
  "theme_color": "#FAF6EF",
  "lang": "en",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

```html
<!-- In <head>, in addition to the manifest link -->
<link rel="manifest" href="/manifest.json" />

<!-- iOS ignores the manifest for these — must be separate -->
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" /> <!-- 180x180, no transparency -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="AppName" />
<meta name="theme-color" content="#FAF6EF" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

- Provide a **192×192** and **512×512** standard icon, plus a **512×512 maskable** icon (content kept inside the central 80% "safe zone" — maskable icons get cropped into different shapes on other platforms). Never combine `"any maskable"` in one entry.
- Since iOS 26, Safari will treat any Home Screen–saved site as a standalone web app even without a manifest — but don't rely on that default; ship a real manifest and the meta tags above for control over icon, name, and colors.
- **EU note:** under the Digital Markets Act, iOS 17.4+ in the EU may open "installed" PWAs as plain Safari tabs (no standalone mode, no push). Not relevant to a Nigeria-based user base, but worth knowing if the audience ever includes EU users.

---

## 2. Splash screen (the annoying part)

iOS does **not** generate a splash screen from the manifest the way Android does. Two real options:

1. **Do it properly:** generate device-specific `apple-touch-startup-image` images (there are ~15–25 size/orientation combinations across iPhone models) and link them all in `<head>`. Use a generator tool (e.g. `pwa-asset-generator` on npm) rather than making these by hand.
2. **Fake it cheaply (recommended for v1):** set `background_color`/`theme-color` to match your paper background exactly, and render a simple centered logo/wordmark in plain HTML+CSS the instant the page paints (before your JS bundle finishes loading). The transition from "white flash" to "your background" becomes nearly invisible because the colors match. This is far less work and looks fine for a personal-use app.

---

## 3. Local storage — IndexedDB, quotas, and eviction

- **Quota:** as of Safari 17+, an installed web app gets up to ~20% of total device disk space as its origin quota — plenty for text-based journal/task/habit data (this app will realistically use single-digit megabytes even after years of daily use). Older guidance citing a hard "50MB" cap is outdated for installed apps but you may still see it referenced — don't design around it, but don't assume unlimited space either.
- **Eviction risk:** by default, storage is "best-effort." If the user doesn't open the app (no tap/click) for **7 days**, Safari may wipe script-writable storage (IndexedDB, Cache API) entirely — not partially, the whole origin at once.
- **Mitigation:** request persistent storage on first load:

```js
if (navigator.storage && navigator.storage.persist) {
  const isPersisted = await navigator.storage.persist();
}
```

Safari generally grants this automatically for installed Home Screen apps, but it's not guaranteed — treat it as a best-effort improvement, not a promise.

- **Strongly recommended safety net:** even though the app is on-device-only by design, build a simple **"Export my data"** action (downloads a single JSON file with every journal entry, task, priority item, and habit log) and a matching **"Import"** action. This isn't cloud sync — it's a manual backup the user controls, and it directly protects against the eviction scenario above. Losing months of journal entries to a silent OS cleanup would be a bad experience worth designing around.
- **Recommended library:** use **Dexie.js** as a friendly wrapper over IndexedDB rather than the raw API — much less boilerplate, well-maintained, good TypeScript support.
- **Reliability tip:** wrap all IndexedDB reads/writes in try/catch. iOS has a documented history of occasional transaction hangs and rare data corruption; fail gracefully rather than crashing the UI.

---

## 4. Notifications — the honest version

This is the part most tutorials get wrong for an offline, backend-free app. Here's what's actually true:

- A **true "the OS wakes up and shows a notification while the app is fully closed"** experience requires **Web Push**, and Web Push requires a **server** to send the payload at the right time (via VAPID keys and a push service) — even for a "reminder to yourself." There is no way around this on iOS; the client alone cannot schedule a future notification that fires after the app has been terminated.
- The **Notification Triggers API** (`showTrigger`) that some articles describe for "offline scheduled notifications" **never shipped in Safari** — it's Chromium-only and still experimental there. Do not build against it.

**What to build instead (fully offline, no server required):**
1. **In-app "Today" reminder banner** — whenever the user opens the app, show which habits are still undone today, front and center. This is reliable and needs nothing but local data.
2. **Badge API** — set a numeric badge on the Home Screen icon representing incomplete habits, updated whenever the app runs:
   ```js
   if (navigator.setAppBadge) {
     await navigator.setAppBadge(incompleteHabitCount);
   }
   // and navigator.clearAppBadge() when everything's done
   ```
3. **Foreground notification, best-effort** — if the app happens to be open (or briefly resumed) around the user's chosen reminder time, you can call the standard `Notification` API to show a local alert. This only works while the page/service worker is alive; it is not a scheduled background reminder.

**If real background push reminders become a priority later:** that's a legitimate Phase 2, but it means adding a small backend (a serverless function is enough — e.g. a Cloudflare Worker or Vercel function using the `web-push` npm package to send a daily payload at the user's chosen time). Safari 18.4+ also introduced **Declarative Web Push**, a simplified push format that skips some service worker boilerplate — worth using if that phase happens. Flag this clearly as optional and out of scope for the offline v1 rather than quietly trying to half-implement it.

---

## 5. Touch drag-and-drop

The native HTML5 Drag and Drop API (`draggable="true"`, `dragstart`/`dragover`/`drop` events) was designed for mouse input and has unreliable, inconsistent touch support across iOS Safari versions. **Do not build the priority-reordering lists on the native API.** Use a library built on Pointer/Touch events instead:

- **Framer Motion's `<Reorder.Group>` / `<Reorder.Item>`** — simplest option if the app is already using Framer Motion for animation (recommended for this project — see the main prompt). Handles touch out of the box, minimal setup for a vertical reorderable list.
- **`@dnd-kit/core` + `@dnd-kit/sortable`** — more powerful/actively maintained if you need multiple lists, drag-between-lists, or more complex interactions than Framer Motion's Reorder offers.

Either is fine; don't reach for the raw HTML5 DnD API or a library documented as "uses the native HTML5 Drag and Drop API" (those explicitly warn they need a separate touch polyfill and still call the experience unreliable).

---

## 6. Native-feel details (CSS/JS)

```css
/* Respect the notch / home indicator */
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

/* Kill the blue tap-flash on buttons/links */
* {
  -webkit-tap-highlight-color: transparent;
}

/* Prevent iOS "rubber-band" overscroll from revealing white space behind the app */
html, body {
  overscroll-behavior: none;
}

/* Prevent accidental double-tap-to-zoom on buttons/icons */
button, .interactive {
  touch-action: manipulation;
}

/* Prevent text selection on UI chrome (not on the journal editor itself) */
.tab-bar, .app-header {
  -webkit-user-select: none;
  user-select: none;
}

-webkit-font-smoothing: antialiased; /* on body, for crisper type rendering */
```

- **No haptics:** since `navigator.vibrate` doesn't exist on iOS Safari, lean on visual/motion feedback for completions instead — a checkbox that morphs into a drawn checkmark, a small spring-scale bounce, a color pulse. (There's an unofficial trick using `<input type="checkbox" switch>` that produces a native click/haptic on iOS 18+ for that specific toggle style, but it's undocumented behavior, not a public API — don't design a feature around it.)
- **Momentum scrolling** is native by default on modern iOS Safari; you don't need the old `-webkit-overflow-scrolling: touch` hack, but it doesn't hurt to include as a fallback.
- **Status bar:** `apple-mobile-web-app-status-bar-style` of `black-translucent` lets your background show through the status bar area — pairs well with a light paper background and dark status bar text (iOS infers text color from `black-translucent` + content).

---

## 7. Testing

- Chrome DevTools' mobile emulation does **not** accurately represent Safari/WebKit behavior — service worker quirks, storage eviction, and PWA installability must be tested on a **real iPhone**.
- To inspect a running iOS PWA: connect the iPhone to a Mac, enable Safari's **Develop** menu, and use **Develop → [Your iPhone] → [Your App]** to get a full remote Web Inspector. There's no way to remotely debug an installed iOS PWA without a Mac.
- Test the full "Add to Home Screen" flow itself (Share sheet → Add to Home Screen → open from icon), not just the browser-tab version — some bugs (icon, splash, standalone-only CSS) only show up once actually installed.

---

## 8. Known iOS/WebKit quirks worth designing around

- **Service worker cache going stale:** call `self.skipWaiting()` and `clients.claim()` in your service worker so updates take effect on next load instead of requiring a full app close.
- **State loss on resume:** if the app has been backgrounded for a while, iOS may fully reload the page rather than resuming it — don't rely on in-memory state for anything the user would be upset to lose; persist aggressively to IndexedDB (e.g., autosave journal drafts on every pause/keystroke-debounce, not just on an explicit "save" tap).
- **Generic/broken icon:** if the manifest fails to parse or an icon 404s, iOS falls back to a screenshot thumbnail instead of your icon — double-check every icon URL resolves before shipping.

---

## 9. Sources for further reading

- WebKit Blog — storage policy updates, Web Push for Web Apps on iOS/iPadOS
- MDN — Storage API: storage quotas and eviction criteria; Vibration API browser compatibility
- web.dev (Google) — Web App Manifest guide, PWA enhancements (splash screens, app shortcuts)
- Apple Developer Documentation — "Sending web push notifications in web apps and browsers"
- `caniuse.com` — Push API, Vibration API, Notification Triggers support tables
- GitHub — `beverloo/notification-triggers` explainer (confirms Chromium-only status), `dnd-kit`, Framer Motion `Reorder` docs, `drag-drop-touch-js/dragdroptouch` (confirms native HTML5 DnD touch limitations)

*(This doc reflects the state of iOS/Safari PWA support as understood in mid-2026. Apple ships PWA-relevant changes with major iOS releases — if you're reading this much later, spot-check the notification and storage sections against current WebKit release notes before relying on them.)*

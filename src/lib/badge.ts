/**
 * Home Screen badge helper (technical ref §4 / §1 table: Badging API works
 * 16.4+). Best-effort — never throws into the UI if unsupported.
 */
export async function setBadge(count: number): Promise<void> {
  try {
    if ("setAppBadge" in navigator && count > 0) {
      await navigator.setAppBadge(count);
    } else if ("clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
    }
  } catch {
    /* badge is non-essential; ignore failures */
  }
}

export async function clearBadge(): Promise<void> {
  try {
    if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
  } catch {
    /* ignore */
  }
}

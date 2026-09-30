/**
 * Posts the user muted via "Turn off notifications for this post".
 * Stored per-device in localStorage. Key: chowk-muted-posts (JSON array).
 */

const KEY = "chowk-muted-posts";

export function readMutedIds(): Set<string> {
  try {
    if (typeof window === "undefined" || !window.localStorage)
      return new Set();
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function isMuted(id: string): boolean {
  return readMutedIds().has(id);
}

export function setMuted(id: string, muted: boolean): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const ids = readMutedIds();
    if (muted) ids.add(id);
    else ids.delete(id);
    window.localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // Storage is optional.
  }
}

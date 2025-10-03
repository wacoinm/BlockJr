// src/utils/sessionStorage.ts
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export type ProjectSession = {
  step: number;
  progress: number; // 0..100
  // you can extend this shape later (e.g. currentCheckpoint, meta, ...)
};

const PREFIX = "pj_session_v1_";

function isWeb(): boolean {
  try {
    return Capacitor.getPlatform() === "web" || (typeof window !== "undefined" && typeof window.localStorage !== "undefined");
  } catch {
    return false;
  }
}

/**
 * Initialize session for projectId if not present.
 * Returns the current session (existing or newly created default).
 */
export async function initSession(projectId: string): Promise<ProjectSession> {
  const key = PREFIX + projectId;
  const defaultSession: ProjectSession = { step: 1, progress: 0 };

  if (isWeb()) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        window.localStorage.setItem(key, JSON.stringify(defaultSession));
        return defaultSession;
      }
      return JSON.parse(raw) as ProjectSession;
    } catch (e) {
      console.warn("initSession(localStorage) failed", e);
      return defaultSession;
    }
  }

  try {
    const kv = await Preferences.get({ key });
    if (!kv.value) {
      await Preferences.set({ key, value: JSON.stringify(defaultSession) });
      return defaultSession;
    }
    return JSON.parse(kv.value) as ProjectSession;
  } catch (e) {
    console.warn("initSession(Preferences) failed", e);
    return defaultSession;
  }
}

/**
 * Load session (may return null if not present)
 */
export async function loadSession(projectId: string): Promise<ProjectSession | null> {
  const key = PREFIX + projectId;

  if (isWeb()) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as ProjectSession) : null;
    } catch (e) {
      console.warn("loadSession(localStorage) failed", e);
      return null;
    }
  }

  try {
    const kv = await Preferences.get({ key });
    return kv.value ? (JSON.parse(kv.value) as ProjectSession) : null;
  } catch (e) {
    console.warn("loadSession(Preferences) failed", e);
    return null;
  }
}

/**
 * Save session (overwrites)
 */
export async function saveSession(projectId: string, session: ProjectSession): Promise<boolean> {
  const key = PREFIX + projectId;

  if (isWeb()) {
    try {
      window.localStorage.setItem(key, JSON.stringify(session));
      return true;
    } catch (e) {
      console.warn("saveSession(localStorage) failed", e);
      return false;
    }
  }

  try {
    await Preferences.set({ key, value: JSON.stringify(session) });
    return true;
  } catch (e) {
    console.warn("saveSession(Preferences) failed", e);
    return false;
  }
}

/**
 * Convenience to get progress (returns 0 if missing)
 */
export async function getProgress(projectId: string): Promise<number> {
  const s = await loadSession(projectId);
  return s ? s.progress : 0;
}

// src/utils/sessionStorage.ts
// Lightweight session storage helpers backed by localStorage.
// Exports named functions: initSession, getSession, setSession, advanceSessionStep
// Also exports a default object with the same functions.

export type ProjectSession = {
  step: number; // current chapter index (1-based)
  progress: number; // percentage 0..100
  updatedAt: string; // ISO timestamp
  [k: string]: any;
};

const KEY_PREFIX = "bj_session/";

function keyFor(projectId: string) {
  return `${KEY_PREFIX}${projectId}`;
}

/**
 * Ensure a session exists for projectId; if not, create initial session.
 */
export async function initSession(projectId: string): Promise<ProjectSession> {
  if (!projectId) throw new Error("projectId required");
  const existing = await getSession(projectId);
  if (existing) return existing;

  const initial: ProjectSession = {
    step: 1,
    progress: 0,
    updatedAt: new Date().toISOString(),
  };
  await setSession(projectId, initial);
  return initial;
}

/**
 * Read session from localStorage. Returns null if not present.
 */
export async function getSession(projectId: string): Promise<ProjectSession | null> {
  if (!projectId) return null;
  try {
    const key = keyFor(projectId);
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ProjectSession;
      return parsed;
    } catch (e) {
      // corrupted data: remove and return null
      try {
        if (typeof window !== "undefined") window.localStorage.removeItem(key);
      } catch {}
      return null;
    }
  } catch (err) {
    console.warn("getSession failed", err);
    return null;
  }
}

/**
 * Save session to localStorage. Overwrites existing session.
 */
export async function setSession(projectId: string, session: ProjectSession): Promise<void> {
  if (!projectId) return;
  try {
    const key = keyFor(projectId);
    const copy = { ...session, updatedAt: new Date().toISOString() };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(copy));
    }
  } catch (err) {
    console.warn("setSession failed", err);
  }
}

/**
 * Advance the stored session step by +1 (unless step already at totalChapters)
 * and update progress (if totalChapters provided).
 * Returns the updated session object.
 */
export async function advanceSessionStep(projectId: string, totalChapters?: number): Promise<ProjectSession> {
  if (!projectId) throw new Error("projectId required");
  const cur = (await getSession(projectId)) ?? { step: 1, progress: 0, updatedAt: new Date().toISOString() };

  let nextStep = (cur.step ?? 1) + 1;
  if (typeof totalChapters === "number" && totalChapters > 0) {
    nextStep = Math.min(nextStep, totalChapters);
  }
  const progress = typeof totalChapters === "number" && totalChapters > 0
    ? Math.min(100, Math.round((nextStep / Math.max(1, totalChapters)) * 100))
    : cur.progress ?? 0;

  const updated: ProjectSession = {
    ...cur,
    step: nextStep,
    progress,
    updatedAt: new Date().toISOString(),
  };
  await setSession(projectId, updated);
  return updated;
}

/**
 * Convenience: decrement step (in case you need it), not used right now but handy.
 */
export async function retreatSessionStep(projectId: string): Promise<ProjectSession> {
  if (!projectId) throw new Error("projectId required");
  const cur = (await getSession(projectId)) ?? { step: 1, progress: 0, updatedAt: new Date().toISOString() };
  const nextStep = Math.max(1, (cur.step ?? 1) - 1);
  const updated: ProjectSession = {
    ...cur,
    step: nextStep,
    updatedAt: new Date().toISOString(),
  };
  await setSession(projectId, updated);
  return updated;
}

const defaultExport = {
  initSession,
  getSession,
  setSession,
  advanceSessionStep,
  retreatSessionStep,
};

export default defaultExport;

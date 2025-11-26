// src/utils/projectUnlock.ts
// Simple project unlock helpers backed by localStorage so projects can depend on each other.

const UNLOCK_KEY = 'blockjr:unlockedProjects';
const PROJECT_ORDER = ['ماشین', 'جرثقیل', 'منجنیق'];

const norm = (s?: string | null) => String(s ?? '').trim();

function readUnlocked(): string[] {
  try {
    if (typeof window === 'undefined') return seedUnlocked([]);
    const raw = window.localStorage.getItem(UNLOCK_KEY);
    if (!raw) return seedUnlocked([]);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedUnlocked([]);
    return seedUnlocked(parsed.map(norm).filter(Boolean));
  } catch {
    return seedUnlocked([]);
  }
}

function seedUnlocked(list: string[]): string[] {
  const seeded = new Set<string>(list.map(norm).filter(Boolean));
  if (PROJECT_ORDER.length > 0) {
    seeded.add(norm(PROJECT_ORDER[0]));
  }
  return Array.from(seeded);
}

function persistUnlocked(list: string[]) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(UNLOCK_KEY, JSON.stringify(seedUnlocked(list)));
  } catch {
    // ignore
  }
}

export function getProjectOrder(): string[] {
  return [...PROJECT_ORDER];
}

export function getUnlockedProjects(): string[] {
  return readUnlocked();
}

export function isProjectUnlocked(projectId?: string | null, unlocked?: string[]): boolean {
  const list = (unlocked ?? readUnlocked()).map(norm);
  const id = norm(projectId);
  if (!id) return false;
  return list.includes(id);
}

export function unlockProject(projectId: string): string[] {
  const current = new Set(readUnlocked());
  const id = norm(projectId);
  if (!id) return Array.from(current);
  current.add(id);
  const next = Array.from(current);
  persistUnlocked(next);
  return next;
}

export function unlockNextAfter(projectId: string): string | null {
  const order = PROJECT_ORDER.map(norm);
  const idx = order.indexOf(norm(projectId));
  const nextId = idx >= 0 && idx + 1 < PROJECT_ORDER.length ? PROJECT_ORDER[idx + 1] : null;
  if (!nextId) return null;
  if (isProjectUnlocked(nextId)) return null;
  unlockProject(nextId);
  return nextId;
}

export function resetUnlocksForTesting() {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(UNLOCK_KEY);
  } catch {
    // ignore
  }
}

export default {
  getProjectOrder,
  getUnlockedProjects,
  isProjectUnlocked,
  unlockProject,
  unlockNextAfter,
  resetUnlocksForTesting,
};

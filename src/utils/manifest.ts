// src/utils/manifest.ts
// Small wrapper around config/packs-manifest.json to provide typed access.
// Extended to support tasklists per project AND per chapter (chapterKey).
import rawManifest from "../../config/packs-manifest.json";

export type PackEntry = {
  id: string;
  name: string;
  description?: string;
  items?: string[];
  qrRaw?: string;
  qrBase64?: string;
};

export type ProjectEntry = {
  id: string;
  name: string;
  subtitle?: string;
  category?: string;
  imgsPath?: string;
  storyModule?: string;
  storyDir?: string;
  validatorPath?: string;
  isLock?: boolean;
  lockReason?: string;
  notes?: string;
};

export type StoryEntry = {
  projectId: string;
  storyPath: string;
  storyModule: string;
  validatorPath?: string;
  notes?: string;
};

/** Tasklist types - support chapterKey */
export type TaskItem = {
  id: string;
  title: string;
  description?: string;
  shortDescription?: string;
  type?: "image" | "video" | "text" | "task" | "validator";
  mediaUrl?: string;
  mediaText?: string;
  locked?: boolean;
};

export type TaskListEntry = {
  projectId: string;
  // optional: if present this entry is for a specific chapterKey
  chapterKey?: string;
  tasks: TaskItem[];
};

export type Manifest = {
  generatedAt?: string;
  packStorageKey?: string;
  packs: PackEntry[];
  projects: ProjectEntry[];
  stories: StoryEntry[];
  tasklists?: TaskListEntry[]; // optional
  packToProjectKeywords?: Record<string, string[]>;
  notes?: string;
};

const manifest: Manifest = rawManifest as unknown as Manifest;

/** getters */
export function getAllPacks(): PackEntry[] {
  return manifest.packs || [];
}
export function getAllProjects(): ProjectEntry[] {
  return manifest.projects || [];
}
export function getAllStories(): StoryEntry[] {
  return manifest.stories || [];
}
export function getPackKeywords(packId: string): string[] {
  return (manifest.packToProjectKeywords && manifest.packToProjectKeywords[packId]) || [];
}

/** tasklist getters */
/**
 * Get all tasklists (raw)
 */
export function getAllTaskLists(): TaskListEntry[] {
  return manifest.tasklists || [];
}

/**
 * Get tasklist for a project.
 * If chapterKey provided, try to find a tasklist entry with matching projectId+chapterKey.
 * If not found, fallback to any entry that matches only projectId (legacy behavior).
 */
export function getTaskListForProject(projectId: string, chapterKey?: string): TaskListEntry | undefined {
  const lists = manifest.tasklists || [];
  if (chapterKey) {
    const exact = lists.find((t) => t.projectId === projectId && t.chapterKey === chapterKey);
    if (exact) return exact;
  }
  // fallback: any entry with projectId and no chapterKey or matching projectId
  const fallback = lists.find((t) => t.projectId === projectId && !t.chapterKey) || lists.find((t) => t.projectId === projectId);
  return fallback;
}

export default manifest;

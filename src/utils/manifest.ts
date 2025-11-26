// src/utils/manifest.ts
// Small wrapper around config/packs-manifest.json to provide typed access.
// Adapted for new structure where packs can contain their own `projects`,
// but we keep the old API (getAllPacks / getAllProjects / getAllStories / tasklists).

import rawManifest from "../../config/packs-manifest.json";

export type ProjectEntry = {
  id: string;
  name: string;
  subtitle?: string;
  category?: string;
  imgsPath?: string;
  storyModule?: string;
  isLock?: boolean;
  lockReason?: string;
  order?: number;
  dependsOn?: string[];
  notes?: string;
};

export type PackEntry = {
  id: string;
  name: string;
  description?: string;
  items?: string[];
  qrRaw?: string;
  qrBase64?: string;
  // NEW: nested projects inside each pack in packs-manifest.json
  projects?: Partial<ProjectEntry>[];
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
  // The following are now DERIVED from packs[].projects:
  projects: ProjectEntry[];
  stories: StoryEntry[];
  tasklists?: TaskListEntry[]; // optional
  packToProjectKeywords?: Record<string, string[]>;
  notes?: string;
};

// raw JSON as any, then we build a normalized Manifest object
const raw: any = rawManifest as any;

// derive projects & stories from packs[].projects
const derivedProjects: ProjectEntry[] = [];
const derivedStories: StoryEntry[] = [];

if (Array.isArray(raw?.packs)) {
  for (const pack of raw.packs) {
    if (!pack || !Array.isArray(pack.projects)) continue;

    for (const proj of pack.projects) {
      if (!proj) continue;
      const id: string = String(proj.id ?? proj.name ?? "").trim();
      if (!id) continue;

      const projectEntry: ProjectEntry = {
        id,
        name: proj.name ?? id,
        subtitle: proj.subtitle,
        category: proj.category,
        imgsPath: proj.imgsPath,
        storyModule: proj.storyModule,
        isLock: proj.isLock,
        lockReason: proj.lockReason,
        order: typeof proj.order === "number" ? proj.order : undefined,
        dependsOn: Array.isArray(proj.dependsOn) ? proj.dependsOn : undefined,
        notes: proj.notes,
      };

      derivedProjects.push(projectEntry);

      if (proj.storyModule) {
        const storyModule = String(proj.storyModule);
        const normalized = storyModule.replace(/\\/g, "/");
        const storyPath =
          normalized.indexOf("/") >= 0
            ? normalized.replace(/\/[^/]*$/, "")
            : normalized;

        derivedStories.push({
          projectId: id,
          storyPath,
          storyModule,
          validatorPath: undefined,
          notes: undefined,
        });
      }
    }
  }
}

// keep backward-compatible shape for the rest of the app
const manifest: Manifest = {
  generatedAt: raw.generatedAt,
  packStorageKey: raw.packStorageKey,
  packs: (raw.packs || []) as PackEntry[],
  projects: derivedProjects,
  stories: derivedStories,
  tasklists: (raw.tasklists || []) as TaskListEntry[],
  packToProjectKeywords: (raw.packToProjectKeywords || {}) as Record<string, string[]>,
  notes: raw.notes,
};

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
export function getAllTaskLists(): TaskListEntry[] {
  return manifest.tasklists || [];
}

/**
 * Get tasklist for a project.
 * If chapterKey provided, try to find a tasklist entry with matching projectId+chapterKey.
 * If not found, fallback to any entry that matches only projectId (legacy behavior).
 */
export function getTaskListForProject(
  projectId: string,
  chapterKey?: string
): TaskListEntry | undefined {
  const lists = manifest.tasklists || [];
  if (chapterKey) {
    const exact = lists.find((t) => t.projectId === projectId && t.chapterKey === chapterKey);
    if (exact) return exact;
  }
  const fallback =
    lists.find((t) => t.projectId === projectId && !t.chapterKey) ||
    lists.find((t) => t.projectId === projectId);
  return fallback;
}

export default manifest;

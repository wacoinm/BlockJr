// src/utils/manifest.ts
// Small wrapper around config/packs-manifest.json to provide typed access.
// Make sure tsconfig has "resolveJsonModule": true OR add `declare module '*.json'`.
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
  validatorPath: string;
  notes?: string;
};

export type Manifest = {
  generatedAt?: string;
  packStorageKey?: string;
  packs: PackEntry[];
  projects: ProjectEntry[];
  stories: StoryEntry[];
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
export default manifest;

// src/utils/projectStorage.ts
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import type { Project } from "../pages/ProjectManager";

const PROJECT_INDEX_KEY = "pj_index_v1";
const PROJECT_FOLDER = "bj_projects";

function isWeb(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Load project index.
 *
 * Defensive behavior:
 * - If stored JSON is invalid or not an array, clear the key and return [].
 * - On native, check Preferences first, then fallback to filesystem (projects.json).
 */
export async function loadProjects(): Promise<Project[]> {
  if (isWeb()) {
    try {
      const raw = window.localStorage.getItem(PROJECT_INDEX_KEY);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as Project[];
        // unexpected non-array -> clear the key to avoid repeated failures
        console.warn("loadProjects: pj_index_v1 contains non-array value. Clearing it.", parsed);
        try {
          window.localStorage.removeItem(PROJECT_INDEX_KEY);
        } catch {}
        return [];
      } catch (parseErr) {
        console.warn("loadProjects: JSON.parse failed for localStorage pj_index_v1. Clearing it.", parseErr);
        try {
          window.localStorage.removeItem(PROJECT_INDEX_KEY);
        } catch {}
        return [];
      }
    } catch (e) {
      console.warn("loadProjects(localStorage) error", e);
      return [];
    }
  }

  // Native (Capacitor)
  try {
    const kv = await Preferences.get({ key: PROJECT_INDEX_KEY });
    if (kv && kv.value) {
      try {
        const parsed = JSON.parse(kv.value);
        if (Array.isArray(parsed)) return parsed as Project[];
        console.warn("loadProjects: Preferences pj_index_v1 contains non-array value. Removing it.", parsed);
        try {
          await Preferences.remove({ key: PROJECT_INDEX_KEY });
        } catch {}
        // fall through to filesystem attempt
      } catch (parseErr) {
        console.warn("loadProjects: JSON.parse failed for Preferences pj_index_v1. Will try filesystem.", parseErr);
      }
    }

    // Filesystem fallback
    try {
      const res = await Filesystem.readFile({
        path: `${PROJECT_FOLDER}/projects.json`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      if (res && res.data) {
        try {
          const list = JSON.parse(res.data);
          if (Array.isArray(list)) {
            // Mirror into Preferences (best-effort)
            try {
              await Preferences.set({ key: PROJECT_INDEX_KEY, value: JSON.stringify(list) });
            } catch {}
            return list as Project[];
          } else {
            console.warn("loadProjects: projects.json parsed but not an array. Ignoring.");
          }
        } catch (err) {
          console.warn("loadProjects: parsing projects.json failed", err);
        }
      }
    } catch {
      // ignore filesystem read errors and return []
    }

    return [];
  } catch (e) {
    console.warn("loadProjects(Preferences/Filesystem) error", e);
    return [];
  }
}

export async function saveProjects(projects: Project[]): Promise<void> {
  const serialized = JSON.stringify(projects);
  if (isWeb()) {
    try {
      window.localStorage.setItem(PROJECT_INDEX_KEY, serialized);
    } catch (e) {
      console.warn("saveProjects(localStorage) failed", e);
    }
    return;
  }

  try {
    await Preferences.set({ key: PROJECT_INDEX_KEY, value: serialized });
  } catch (e) {
    console.warn("saveProjects(Preferences) failed", e);
  }

  try {
    await Filesystem.mkdir({ path: PROJECT_FOLDER, directory: Directory.Data, recursive: true });
    await Filesystem.writeFile({
      path: `${PROJECT_FOLDER}/projects.json`,
      data: serialized,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  } catch (e) {
    console.warn("saveProjects(Filesystem) failed", e);
  }
}

export async function saveProjectFile(projectId: string, filename: string, data: string): Promise<boolean> {
  if (!projectId || !filename) return false;

  if (isWeb()) {
    try {
      const key = `${PROJECT_FOLDER}/${projectId}/${filename}`;
      window.localStorage.setItem(key, data);
      return true;
    } catch (e) {
      console.warn("saveProjectFile(localStorage) failed", e);
      return false;
    }
  }

  try {
    const folder = `${PROJECT_FOLDER}/${projectId}`;
    await Filesystem.mkdir({ path: folder, directory: Directory.Data, recursive: true });
    await Filesystem.writeFile({
      path: `${folder}/${filename}`,
      data,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return true;
  } catch (e) {
    console.warn("saveProjectFile(Filesystem) failed", e);
    return false;
  }
}

/**
 * Read a file for a project. Returns string data or null if missing.
 */
export async function readProjectFile(projectId: string, filename: string): Promise<string | null> {
  if (!projectId || !filename) return null;

  if (isWeb()) {
    try {
      const key = `${PROJECT_FOLDER}/${projectId}/${filename}`;
      const v = window.localStorage.getItem(key);
      return v;
    } catch (e) {
      console.warn("readProjectFile(localStorage) failed", e);
      return null;
    }
  }

  try {
    const res = await Filesystem.readFile({
      path: `${PROJECT_FOLDER}/${projectId}/${filename}`,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return res.data;
  } catch (e) {
    // file doesn't exist or cannot be read
    return null;
  }
}

export async function removeProjectFolder(projectId: string): Promise<void> {
  if (!projectId) return;

  if (isWeb()) {
    try {
      const prefix = `${PROJECT_FOLDER}/${projectId}/`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) keysToRemove.push(k);
      }
      for (const k of keysToRemove) window.localStorage.removeItem(k);
    } catch (e) {
      console.warn("removeProjectFolder(localStorage) failed", e);
    }
    return;
  }

  try {
    const path = `${PROJECT_FOLDER}/${projectId}`;
    await Filesystem.rmdir({ path, directory: Directory.Data, recursive: true });
  } catch (e) {
    console.warn("removeProjectFolder(Filesystem) failed", e);
  }
}

export async function renameProjectFolder(oldId: string, newId: string): Promise<boolean> {
  if (!oldId || !newId) return false;
  if (oldId === newId) return true;

  if (isWeb()) {
    try {
      const oldPrefix = `${PROJECT_FOLDER}/${oldId}/`;
      const newPrefix = `${PROJECT_FOLDER}/${newId}/`;
      const toCopy: Array<{ k: string; v: string }> = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(oldPrefix)) {
          const v = window.localStorage.getItem(k);
          if (v !== null) toCopy.push({ k: k.slice(oldPrefix.length), v });
        }
      }
      for (const item of toCopy) {
        window.localStorage.setItem(`${newPrefix}${item.k}`, item.v);
      }
      // remove old keys
      const removals: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(oldPrefix)) removals.push(k);
      }
      for (const k of removals) window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      console.warn("renameProjectFolder(localStorage) failed", e);
      return false;
    }
  }

  try {
    const oldFolder = `${PROJECT_FOLDER}/${oldId}`;
    const newFolder = `${PROJECT_FOLDER}/${newId}`;

    await Filesystem.mkdir({ path: newFolder, directory: Directory.Data, recursive: true });

    try {
      const listing = await Filesystem.readdir({ path: oldFolder, directory: Directory.Data });
      for (const filename of listing.files) {
        try {
          const f = await Filesystem.readFile({ path: `${oldFolder}/${filename}`, directory: Directory.Data, encoding: Encoding.UTF8 });
          await Filesystem.writeFile({ path: `${newFolder}/${filename}`, data: f.data, directory: Directory.Data, encoding: Encoding.UTF8 });
        } catch (errFile) {
          console.warn("renameProjectFolder: file copy failed", filename, errFile);
        }
      }
    } catch {
      // ignore if reading old folder fails
    }

    try {
      await Filesystem.rmdir({ path: oldFolder, directory: Directory.Data, recursive: true });
    } catch {
      // ignore rmdir failure
    }

    return true;
  } catch (e) {
    console.warn("renameProjectFolder(Filesystem) failed", e);
    return false;
  }
}

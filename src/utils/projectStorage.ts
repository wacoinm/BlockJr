// src/utils/projectStorage.ts
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Storage } from "@capacitor/storage";
import type { Project } from "../pages/ProjectManager";

const PROJECT_INDEX_KEY = "pj_index_v1";
const PROJECT_FOLDER = "bj_projects";

/**
 * Detect running on web (localStorage available).
 */
function isWeb(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Load projects.
 * On web => use localStorage.
 * On native => prefer Capacitor Storage, fallback to Filesystem.
 */
export async function loadProjects(): Promise<Project[]> {
  if (isWeb()) {
    try {
      const raw = window.localStorage.getItem(PROJECT_INDEX_KEY);
      if (raw) return JSON.parse(raw) as Project[];
      return [];
    } catch (e) {
      console.warn("loadProjects(localStorage) error", e);
      return [];
    }
  }

  try {
    const kv = await Storage.get({ key: PROJECT_INDEX_KEY });
    if (kv.value) {
      try {
        return JSON.parse(kv.value) as Project[];
      } catch {
        // fallthrough to FS
      }
    }

    try {
      const res = await Filesystem.readFile({
        path: `${PROJECT_FOLDER}/projects.json`,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });
      const list = JSON.parse(res.data) as Project[];
      await Storage.set({ key: PROJECT_INDEX_KEY, value: JSON.stringify(list) });
      return list;
    } catch {
      return [];
    }
  } catch (e) {
    console.warn("loadProjects(capacitor) error", e);
    return [];
  }
}

/**
 * Save projects list.
 * On web => localStorage.
 * On native => Storage + write projects.json to Filesystem when possible.
 */
export async function saveProjects(projects: Project[]): Promise<void> {
  if (isWeb()) {
    try {
      window.localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(projects));
    } catch (e) {
      console.warn("saveProjects(localStorage) failed", e);
    }
    return;
  }

  try {
    await Storage.set({ key: PROJECT_INDEX_KEY, value: JSON.stringify(projects) });
  } catch (e) {
    console.warn("saveProjects(Storage) failed", e);
  }

  try {
    await Filesystem.mkdir({ path: PROJECT_FOLDER, directory: Directory.Data, recursive: true });
    await Filesystem.writeFile({
      path: `${PROJECT_FOLDER}/projects.json`,
      data: JSON.stringify(projects),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
  } catch (e) {
    console.warn("saveProjects(Filesystem) failed", e);
  }
}

/**
 * Save a single project file (base64 string without data: prefix).
 * On web => store base64 under a key in localStorage.
 * On native => write file to Filesystem.
 */
export async function saveProjectFile(projectId: string, filename: string, base64data: string): Promise<boolean> {
  if (!projectId || !filename) return false;

  if (isWeb()) {
    try {
      const key = `${PROJECT_FOLDER}/${projectId}/${filename}`;
      window.localStorage.setItem(key, base64data);
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
      data: base64data,
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
 * Remove a project's folder and files.
 * On web => remove localStorage keys with that prefix.
 * On native => rmdir recursive.
 */
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

/**
 * Rename a project's folder (best-effort).
 * On web => rename keys by copying values to new prefix then deleting old keys.
 * On native => copy files and remove old folder.
 */
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
      // copy
      for (const item of toCopy) {
        window.localStorage.setItem(`${newPrefix}${item.k}`, item.v);
      }
      // remove old keys
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(oldPrefix)) window.localStorage.removeItem(k);
      }
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
      // ignore read errors
    }

    try {
      await Filesystem.rmdir({ path: oldFolder, directory: Directory.Data, recursive: true });
    } catch {
      // ignore removal errors
    }

    return true;
  } catch (e) {
    console.warn("renameProjectFolder(Filesystem) failed", e);
    return false;
  }
}

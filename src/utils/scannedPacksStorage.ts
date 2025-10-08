// src/utils/scannedPacksStorage.ts
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const SCANNED_PACKS_KEY = 'scanned_packs_v1';

function isClassicWeb(): boolean {
  try {
    const platform = (Capacitor && typeof Capacitor.getPlatform === 'function') ? Capacitor.getPlatform() : 'web';
    if (platform === 'web') return true;
    if (typeof Preferences === 'undefined' || !Preferences) return true;
    return false;
  } catch {
    return true;
  }
}

async function readRaw(): Promise<string | null> {
  try {
    if (isClassicWeb()) {
      return localStorage.getItem(SCANNED_PACKS_KEY);
    }
    const res = await Preferences.get({ key: SCANNED_PACKS_KEY });
    return res?.value ?? null;
  } catch (err) {
    console.warn('readRaw scanned packs failed, falling back to localStorage', err);
    try {
      return localStorage.getItem(SCANNED_PACKS_KEY);
    } catch {
      return null;
    }
  }
}

async function writeRaw(value: string | null): Promise<void> {
  try {
    if (isClassicWeb()) {
      if (value === null) localStorage.removeItem(SCANNED_PACKS_KEY);
      else localStorage.setItem(SCANNED_PACKS_KEY, value);
      return;
    }
    if (value === null) {
      await Preferences.remove({ key: SCANNED_PACKS_KEY });
    } else {
      await Preferences.set({ key: SCANNED_PACKS_KEY, value });
    }
  } catch (err) {
    console.warn('writeRaw scanned packs failed, falling back to localStorage', err);
    try {
      if (value === null) localStorage.removeItem(SCANNED_PACKS_KEY);
      else localStorage.setItem(SCANNED_PACKS_KEY, value);
    } catch {
      // ignore
    }
  }
}

/** Return array of scanned pack objects (empty array if none) */
export async function getScannedPacks(): Promise<any[]> {
  try {
    const raw = await readRaw();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn('getScannedPacks parse failed', err);
    return [];
  }
}

/** Overwrite scanned packs list (array) */
export async function saveScannedPacks(packs: any[]): Promise<void> {
  try {
    const asString = JSON.stringify(Array.isArray(packs) ? packs : []);
    await writeRaw(asString);
  } catch (err) {
    console.warn('saveScannedPacks failed', err);
  }
}

/** Add a single scanned pack (prepends). Avoid duplicates by id (if present) */
export async function addScannedPack(pack: any): Promise<void> {
  if (!pack) return;
  try {
    const list = await getScannedPacks();
    const id = pack.id ?? pack.name ?? null;
    if (id && list.some((p) => p.id === id)) return; // already present
    const newList = [pack, ...list];
    await saveScannedPacks(newList);
  } catch (err) {
    console.warn('addScannedPack failed', err);
  }
}

/** Remove a scanned pack by id */
export async function removeScannedPackById(id: string): Promise<void> {
  if (!id) return;
  try {
    const list = await getScannedPacks();
    const filtered = list.filter((p) => p.id !== id);
    await saveScannedPacks(filtered);
  } catch (err) {
    console.warn('removeScannedPackById failed', err);
  }
}

export default {
  getScannedPacks,
  saveScannedPacks,
  addScannedPack,
  removeScannedPackById,
};

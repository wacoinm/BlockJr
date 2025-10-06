// src/utils/packStorage.ts
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const SELECTED_PACK_KEY = 'selected_pack_v1';

/**
 * Save selected pack id (string) or null to remove.
 * - on web: uses localStorage
 * - on native (Capacitor): uses Preferences
 */
export async function setSelectedPack(packId: string | null): Promise<void> {
  try {
    const isWeb = Capacitor.getPlatform() === 'web';
    if (isWeb) {
      if (packId === null) localStorage.removeItem(SELECTED_PACK_KEY);
      else localStorage.setItem(SELECTED_PACK_KEY, packId);
      return;
    }

    // native
    if (packId === null) {
      await Preferences.remove({ key: SELECTED_PACK_KEY });
    } else {
      await Preferences.set({ key: SELECTED_PACK_KEY, value: packId });
    }
  } catch (err) {
    // non-fatal: log and continue
    // eslint-disable-next-line no-console
    console.warn('setSelectedPack failed', err);
  }
}

/**
 * Return the stored pack id or null
 */
export async function getSelectedPack(): Promise<string | null> {
  try {
    const isWeb = Capacitor.getPlatform() === 'web';
    if (isWeb) {
      return localStorage.getItem(SELECTED_PACK_KEY);
    }

    const res = await Preferences.get({ key: SELECTED_PACK_KEY });
    return res.value ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('getSelectedPack failed', err);
    return null;
  }
}

/** Convenience: clear stored selected pack */
export async function clearSelectedPack(): Promise<void> {
  await setSelectedPack(null);
}

export default {
  setSelectedPack,
  getSelectedPack,
  clearSelectedPack,
};

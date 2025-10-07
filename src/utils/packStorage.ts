// src/utils/packStorage.ts
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const SELECTED_PACK_KEY = 'selected_pack_v1';

/**
 * Helper: detect if we should use web localStorage.
 * Being defensive: if Preferences isn't available for any reason, fallback to localStorage.
 */
function isClassicWeb(): boolean {
  try {
    // Capacitor.getPlatform() is synchronous and returns 'web'/'android'/'ios'
    const platform = (Capacitor && typeof Capacitor.getPlatform === 'function') ? Capacitor.getPlatform() : 'web';
    // If platform says 'web' treat as web.
    if (platform === 'web') return true;
    // If Preferences is missing for some reason, fall back to web behavior
    if (typeof Preferences === 'undefined' || !Preferences) return true;
    return false;
  } catch (err) {
    // On error be conservative and use localStorage
    return true;
  }
}

/**
 * Save selected pack id (string) or null to remove.
 * - on web: uses localStorage
 * - on native (Capacitor): uses Preferences (if available), otherwise localStorage
 */
export async function setSelectedPack(packId: string | null): Promise<void> {
  try {
    const isWeb = isClassicWeb();
    if (isWeb) {
      if (packId === null) localStorage.removeItem(SELECTED_PACK_KEY);
      else localStorage.setItem(SELECTED_PACK_KEY, packId);
      return;
    }

    // native + Preferences available
    if (packId === null) {
      await Preferences.remove({ key: SELECTED_PACK_KEY });
    } else {
      await Preferences.set({ key: SELECTED_PACK_KEY, value: packId });
    }
  } catch (err) {
    // non-fatal: log and also fallback to localStorage
    // eslint-disable-next-line no-console
    console.warn('setSelectedPack failed (Preferences), falling back to localStorage', err);
    try {
      if (packId === null) localStorage.removeItem(SELECTED_PACK_KEY);
      else localStorage.setItem(SELECTED_PACK_KEY, packId);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Return the stored pack id or null
 */
export async function getSelectedPack(): Promise<string | null> {
  try {
    const isWeb = isClassicWeb();
    if (isWeb) {
      return localStorage.getItem(SELECTED_PACK_KEY);
    }

    const res = await Preferences.get({ key: SELECTED_PACK_KEY });
    return res?.value ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('getSelectedPack failed (Preferences), falling back to localStorage', err);
    try {
      return localStorage.getItem(SELECTED_PACK_KEY);
    } catch {
      return null;
    }
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

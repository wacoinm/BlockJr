// src/utils/ensureBluetoothPermissions.ts
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';

const platform = Capacitor.getPlatform();
const isNative = platform !== 'web';

/**
 * Best-effort permission/init check for Bluetooth usage.
 * Returns true when everything *appears* OK (permissions likely granted and bluetooth enabled).
 * Returns false when manual user action is likely required (grant perms in settings / enable bluetooth).
 */
export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (!isNative) {
    console.log('[ensureBluetoothPermissions] not native; skipping native checks (web).');
    return true;
  }

  // 1) Try to ensure Bluetooth is enabled (most important)
  try {
    const { enabled } = await BluetoothSerial.isEnabled();
    if (!enabled) {
      console.log('[ensureBluetoothPermissions] bluetooth disabled, attempting to enable...');
      try {
        await BluetoothSerial.enable();
      } catch (e) {
        console.warn('[ensureBluetoothPermissions] enable() failed (user may need to enable manually)', e);
        return false;
      }
    }
  } catch (e) {
    // If isEnabled() itself fails, assume something's wrong with bluetooth stack -> return false
    console.warn('[ensureBluetoothPermissions] Bluetooth isEnabled check failed', e);
    return false;
  }

  // 2) Quick check for location availability (some Android devices require location for scanning)
  // Use navigator.geolocation to check permission/service availability in hybrid webview.
  const locationOk = await (async (): Promise<boolean> => {
    if (!('geolocation' in navigator)) return false;

    return new Promise<boolean>((resolve) => {
      let done = false;
      const onSuccess = () => { if (!done) { done = true; resolve(true); } };
      const onFail = () => { if (!done) { done = true; resolve(false); } };

      navigator.geolocation.getCurrentPosition(
        () => onSuccess(),
        (err) => {
          console.warn('[ensureBluetoothPermissions] geolocation.getCurrentPosition failed', err);
          onFail();
        },
        { timeout: 2500, maximumAge: 0 }
      );

      setTimeout(() => { if (!done) { done = true; resolve(false); } }, 3000);
    });
  })();

  if (!locationOk) {
    // not necessarily fatal on all devices, but common cause of "scan failed"
    console.warn('[ensureBluetoothPermissions] location not available or permission denied');
    // return false to let caller show "please enable location/permissions" UI
    return false;
  }

  // If we reached here, bluetooth enabled and location available (likely permissions OK)
  return true;
}

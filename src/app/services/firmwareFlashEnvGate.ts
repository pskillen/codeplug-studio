/**
 * Per-radio prod gate for the firmware flasher. Separate from the codeplug Write gate (Flash is not Write):
 * there is no Capacitor exemption here. See DESIGN.md — Firmware flashing.
 */
import { isDeveloperModeOn } from '@integrations/preferences/developerMode.ts';
import {
  isCapacitorSerialSupported,
  listFirmwareUpdaters,
  type FirmwareUpdaterDescriptor,
} from '@integrations/radio-io';

import { resolveProdFeatureGate, type ProdFeatureGate } from './prodFeatureGate.ts';

export type FirmwareFlashGate = ProdFeatureGate;

/**
 * Pure given `buildEnv` and `developerMode`. 'hidden' only on the prod build while the radio's `prodFlashDisabled` is
 * set and developer mode is off on this device (#1650). Asks the one prod gate, {@link resolveProdFeatureGate}.
 */
export function resolveFirmwareFlashGate(
  descriptor: Pick<FirmwareUpdaterDescriptor, 'prodFlashDisabled'>,
  buildEnv: string = __BUILD_ENV__,
  developerMode?: boolean,
): FirmwareFlashGate {
  return resolveProdFeatureGate(descriptor.prodFlashDisabled, { buildEnv, developerMode });
}

/**
 * The flasher's own platform check. In a browser every radio passes (the page itself needs Web Serial). On the Android
 * app a radio passes when its `capacitorSupported` is `true`, or when it is `'developerMode'` and developer mode is on
 * for this device, in any build (#1657). That one setting is the only place developer mode touches the platform
 * check, and it is visibility only: no interlock reads it.
 *
 * Pure given `native` and `developerMode`; `developerMode` defaults to this device's switch, read at call time.
 */
export function isFirmwareUpdaterOfferedOnPlatform(
  descriptor: Pick<FirmwareUpdaterDescriptor, 'capacitorSupported'>,
  native: boolean = isCapacitorSerialSupported(),
  developerMode?: boolean,
): boolean {
  if (!native) return true;
  if (descriptor.capacitorSupported === 'developerMode') {
    return developerMode ?? isDeveloperModeOn();
  }
  return descriptor.capacitorSupported === true;
}

/**
 * Registered updaters this build and platform may offer: gate 'allowed', and
 * {@link isFirmwareUpdaterOfferedOnPlatform}.
 */
export function listOfferedFirmwareUpdaters(
  buildEnv: string = __BUILD_ENV__,
  developerMode?: boolean,
): readonly FirmwareUpdaterDescriptor[] {
  const native = isCapacitorSerialSupported();
  return listFirmwareUpdaters().filter(
    (d) =>
      resolveFirmwareFlashGate(d, buildEnv, developerMode) === 'allowed' &&
      isFirmwareUpdaterOfferedOnPlatform(d, native, developerMode),
  );
}

/**
 * Per-radio prod gate for the firmware flasher. Separate from the codeplug Write gate (Flash is not Write):
 * there is no Capacitor exemption here. See DESIGN.md — Firmware flashing.
 */
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
 * Registered updaters this build and platform may offer: gate 'allowed', and Web Serial or `capacitorSupported`.
 * The platform check is the feature's own and developer mode never relaxes it.
 */
export function listOfferedFirmwareUpdaters(
  buildEnv: string = __BUILD_ENV__,
  developerMode?: boolean,
): readonly FirmwareUpdaterDescriptor[] {
  const native = isCapacitorSerialSupported();
  return listFirmwareUpdaters().filter(
    (d) =>
      resolveFirmwareFlashGate(d, buildEnv, developerMode) === 'allowed' &&
      (!native || d.capacitorSupported),
  );
}

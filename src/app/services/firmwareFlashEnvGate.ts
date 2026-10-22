/**
 * Per-radio prod gate for the firmware flasher. Separate from the codeplug Write gate (Flash is not Write):
 * there is no Capacitor exemption here. See DESIGN.md — Firmware flashing.
 */
import {
  isCapacitorSerialSupported,
  listFirmwareUpdaters,
  type FirmwareUpdaterDescriptor,
} from '@integrations/radio-io';

import { isProdBuildEnv } from './radioWriteEnvGate.ts';

export type FirmwareFlashGate = 'hidden' | 'allowed';

/** Pure. 'hidden' only on the prod build while the radio's `prodFlashDisabled` is set. */
export function resolveFirmwareFlashGate(
  descriptor: Pick<FirmwareUpdaterDescriptor, 'prodFlashDisabled'>,
  buildEnv: string = __BUILD_ENV__,
): FirmwareFlashGate {
  return isProdBuildEnv(buildEnv) && descriptor.prodFlashDisabled ? 'hidden' : 'allowed';
}

/** Registered updaters this build and platform may offer: gate 'allowed', and Web Serial or `capacitorSupported`. */
export function listOfferedFirmwareUpdaters(
  buildEnv: string = __BUILD_ENV__,
): readonly FirmwareUpdaterDescriptor[] {
  const native = isCapacitorSerialSupported();
  return listFirmwareUpdaters().filter(
    (d) => resolveFirmwareFlashGate(d, buildEnv) === 'allowed' && (!native || d.capacitorSupported),
  );
}

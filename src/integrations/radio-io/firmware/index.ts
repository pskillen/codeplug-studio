/**
 * Firmware updater seam. The app reaches firmware flashing only through this barrel, via `@integrations/radio-io`.
 */
export type {
  FirmwareBootloaderIdent,
  FirmwareFlashEnd,
  FirmwareFlashPhase,
  FirmwareFlashProgress,
  FirmwareFlashResult,
  FirmwareFlashTiming,
  FirmwareLinkSpec,
  FirmwarePreflightAttestation,
  FirmwarePreflightProbe,
  FirmwarePreflightProbeResult,
  FirmwareRadioPreflight,
  FirmwareUpdater,
  FirmwareUpdaterDescriptor,
} from './types.ts';
export { FirmwareFlashError } from './errors.ts';
export { createGuardedSend } from './guardedSend.ts';
export { getFirmwareUpdater, listFirmwareUpdaters } from './registry.ts';

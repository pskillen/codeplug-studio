/**
 * Build the exact image a firmware updater will flash, from verified stock and a target.
 * One pipeline: verify stock → (apply patch → verify result) → updater interlocks. See DESIGN.md — Firmware flashing.
 */
import { FirmwareError } from '../../firmware/errors.ts';
import { sha256Hex } from '../../firmware/hash.ts';
import type { VerifiedStockFirmware } from '../../firmware/stock/resolveStockFirmware.ts';
import type {
  FirmwarePackage,
  FirmwareProvenance,
  FirmwareRadioId,
  StockFirmwareDescriptor,
} from '../../firmware/types.ts';

/** Phase 3 (#1362 catalog) widens this union with { kind: 'patch'; patch: LoadedFirmwarePatch }. */
export type FirmwareTarget = { readonly kind: 'stock' };

declare const preparedBrand: unique symbol;

export interface PreparedFirmwareImage {
  /** Only this service constructs one. A speed bump, not the safety mechanism: updaters re-run their interlocks. */
  readonly [preparedBrand]: true;
  readonly radioId: FirmwareRadioId;
  readonly provenance: FirmwareProvenance;
  readonly stockVersion: string;
  readonly releaseTag?: string;
  readonly patchVersion?: string;
  readonly patchSha256?: string;
  readonly versionStamp?: string;
  /** The bytes that will be flashed. */
  readonly package: FirmwarePackage;
  /** Per role, recomputed here. */
  readonly sha256: Readonly<Record<string, string>>;
  readonly verifyHint: string;
}

async function hashPackage(pkg: FirmwarePackage): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [role, bytes] of Object.entries(pkg.files)) out[role] = await sha256Hex(bytes);
  return out;
}

export async function prepareFirmwareImage(input: {
  descriptor: StockFirmwareDescriptor;
  stock: VerifiedStockFirmware;
  target: FirmwareTarget;
}): Promise<PreparedFirmwareImage> {
  const { descriptor, stock, target } = input;
  if (
    stock.descriptor.radioId !== descriptor.radioId ||
    stock.package.radioId !== descriptor.radioId
  ) {
    throw new FirmwareError(
      'stock-wrong-radio',
      `The stock firmware supplied is not for the ${descriptor.label}.`,
    );
  }

  switch (target.kind) {
    case 'stock': {
      const pkg = stock.package;
      const sha256 = await hashPackage(pkg);
      const roles = descriptor.members.map((m) => m.role);
      const intact =
        Object.keys(sha256).length === roles.length &&
        roles.every((r) => sha256[r] !== undefined && sha256[r] === stock.sha256[r]);
      if (!intact) {
        throw new FirmwareError(
          'stock-wrong-version',
          `The stock firmware changed after it was checked. Load the ${descriptor.label} ${descriptor.version} files again.`,
        );
      }
      return {
        radioId: descriptor.radioId,
        provenance: 'stock',
        stockVersion: descriptor.version,
        package: pkg,
        sha256,
        verifyHint: descriptor.stockVerifyHint,
      } as PreparedFirmwareImage;
    }
  }
}

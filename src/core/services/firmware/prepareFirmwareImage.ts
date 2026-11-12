/**
 * Build the exact image a firmware updater will flash, from verified stock and a target.
 * One pipeline: verify stock → (apply patch → verify result) → updater interlocks. See DESIGN.md — Firmware flashing.
 */
import { FirmwareError } from '../../firmware/errors.ts';
import { sha256Hex } from '../../firmware/hash.ts';
import { applyFirmwarePatch, readFirmwarePatchVersionStamp } from '../../firmware/patch/index.ts';
import { loadedFirmwarePatchTitle, stockFirmwareTitle } from '../../firmware/releases/projects.ts';
import type { LoadedFirmwarePatch } from '../../firmware/releases/types.ts';
import type { VerifiedStockFirmware } from '../../firmware/stock/resolveStockFirmware.ts';
import { stockVariantFor } from '../../firmware/stockVariants.ts';
import type {
  FirmwarePackage,
  FirmwareProvenance,
  FirmwareRadioId,
  StockFirmwareDescriptor,
} from '../../firmware/types.ts';

export type FirmwareTarget =
  { readonly kind: 'stock' } | { readonly kind: 'patch'; readonly patch: LoadedFirmwarePatch };

/** Shown after a patched flash when the release gives no verify hint of its own. */
export const DEFAULT_PATCH_VERIFY_HINT = 'Check the radio boots and shows the expected version.';

declare const preparedBrand: unique symbol;

export interface PreparedFirmwareImage {
  /** Only this service constructs one. A speed bump, not the safety mechanism: updaters re-run their interlocks. */
  readonly [preparedBrand]: true;
  readonly radioId: FirmwareRadioId;
  readonly provenance: FirmwareProvenance;
  readonly stockVersion: string;
  /**
   * The stock base the patch names (`base`), where the format has one. A radio's interlocks key their per-base
   * windows and limits by it, and check it against the verified stock's hash.
   */
  readonly baseName?: string;
  /** Operator-facing name of what is flashed: 'MM9PDY modded firmware 1.0.0' or 'stock firmware v1.01.048'. */
  readonly title: string;
  readonly releaseTag?: string;
  readonly patchVersion?: string;
  readonly patchSha256?: string;
  readonly versionStamp?: string;
  /** The bytes that will be flashed. */
  readonly package: FirmwarePackage;
  /**
   * The verified stock the image was built from; set for every target. An updater's `checkImage` compares the image
   * against it where the radio's rules need the stock bytes (UV-5R Mini).
   */
  readonly stockPackage?: FirmwarePackage;
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
  const { descriptor: radioDescriptor, stock, target } = input;
  if (
    stock.descriptor.radioId !== radioDescriptor.radioId ||
    stock.package.radioId !== radioDescriptor.radioId
  ) {
    throw new FirmwareError(
      'stock-wrong-radio',
      `The stock firmware supplied is not for the ${radioDescriptor.label}.`,
    );
  }
  // The verified stock is one of the radio's accepted versions; everything below uses that one.
  const descriptor = stockVariantFor(radioDescriptor, stock.descriptor.version);
  if (!descriptor) {
    throw new FirmwareError(
      'stock-wrong-version',
      `The stock firmware supplied is not a version Studio accepts for the ${radioDescriptor.label}.`,
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
        title: stockFirmwareTitle(descriptor.version),
        package: pkg,
        stockPackage: stock.package,
        sha256,
        verifyHint: descriptor.stockVerifyHint,
      } as PreparedFirmwareImage;
    }
    case 'patch': {
      const { patch } = target;
      const description = patch.parsed.description;
      if (!descriptor.patchNames.includes(description.name)) {
        throw new FirmwareError(
          'patch-wrong-radio',
          `This patch is not for the ${descriptor.label}.`,
        );
      }
      // The pinned check: apply only checks the stock it is handed.
      const roles = descriptor.members.map((m) => m.role);
      const pinned =
        Object.keys(description.stock).length === roles.length &&
        descriptor.members.every((m) => {
          const d = description.stock[m.role];
          return d !== undefined && d.sha256 === m.sha256 && d.size === m.size;
        });
      if (!pinned) {
        throw new FirmwareError(
          'patch-wrong-stock',
          'This patch was made for different stock firmware',
        );
      }
      const pkg = await applyFirmwarePatch(stock.package, patch.parsed);
      const sha256 = await hashPackage(pkg);
      const resultRoles = Object.keys(description.result);
      const matches =
        Object.keys(sha256).length === resultRoles.length &&
        resultRoles.every((r) => {
          const want = description.result[r]!;
          return sha256[r] === want.sha256 && pkg.files[r]?.length === want.size;
        });
      if (!matches) {
        throw new FirmwareError(
          'patch-result-mismatch',
          'The patched firmware does not match the hash recorded in the patch. Nothing was flashed.',
        );
      }
      return {
        radioId: descriptor.radioId,
        provenance: patch.provenance,
        stockVersion: descriptor.version,
        title: loadedFirmwarePatchTitle(patch),
        releaseTag: patch.release?.tag,
        patchVersion: description.version,
        baseName: description.base,
        patchSha256: patch.sha256,
        versionStamp: readFirmwarePatchVersionStamp(pkg, patch.parsed),
        package: pkg,
        stockPackage: stock.package,
        sha256,
        verifyHint: patch.release?.verifyHint ?? DEFAULT_PATCH_VERIFY_HINT,
      } as PreparedFirmwareImage;
    }
  }
}

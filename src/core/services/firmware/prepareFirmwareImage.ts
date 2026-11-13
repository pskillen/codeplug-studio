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
import { stockVariantFor, toStockVariantFor } from '../../firmware/stockVariants.ts';
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
  /**
   * Set for a to-stock patch (its build name is the stock's own base name): the result is that stock, with a loader
   * that can install it. The title and verify hint are the stock's; the flash log says "back to stock". Descriptive:
   * the radio's interlocks recognise a to-stock image themselves and hold it to their own rules.
   */
  readonly backToStock?: true;
  /**
   * The hardware layout of the radio this image is prepared for, as the operator gave it, where the radio comes in more
   * than one layout (UV-5R Mini: `L1` or `L2`, from its Radio Info screen). Unset when Studio has not been told. An
   * updater whose image is tied to one layout refuses an image prepared for the other layout, or for none.
   */
  readonly radioLayout?: string;
  /**
   * The build name the operator typed from the radio's own Radio Info screen (trimmed; absent when none was given).
   * An updater refuses an image whose build is the one the radio already shows.
   */
  readonly radioBuild?: string;
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
  /** The radio's hardware layout, where the operator has said (see `PreparedFirmwareImage.radioLayout`). */
  radioLayout?: string;
  /** The build name the operator typed from Radio Info, where one was given (see `PreparedFirmwareImage.radioBuild`). */
  radioBuild?: string;
}): Promise<PreparedFirmwareImage> {
  const { descriptor: radioDescriptor, stock, target } = input;
  const layout = {
    ...(input.radioLayout === undefined ? {} : { radioLayout: input.radioLayout }),
    ...(input.radioBuild ? { radioBuild: input.radioBuild } : {}),
  };
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
        ...layout,
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
      // A to-stock patch installs the stock it was built on: it reads as that stock, not as a modded build.
      const backToStock =
        toStockVariantFor(radioDescriptor, description)?.version === descriptor.version;
      return {
        radioId: descriptor.radioId,
        provenance: patch.provenance,
        stockVersion: descriptor.version,
        title: backToStock
          ? stockFirmwareTitle(descriptor.version)
          : loadedFirmwarePatchTitle(patch),
        ...(backToStock ? { backToStock: true } : {}),
        releaseTag: patch.release?.tag,
        patchVersion: description.version,
        baseName: description.base,
        patchSha256: patch.sha256,
        versionStamp: readFirmwarePatchVersionStamp(pkg, patch.parsed),
        package: pkg,
        stockPackage: stock.package,
        ...layout,
        sha256,
        verifyHint: backToStock
          ? descriptor.stockVerifyHint
          : (patch.release?.verifyHint ?? DEFAULT_PATCH_VERIFY_HINT),
      } as PreparedFirmwareImage;
    }
  }
}

/**
 * Build the exact image a firmware updater will flash, from verified stock and a target.
 * One pipeline: verify stock → (apply patch → verify result) → updater interlocks. See DESIGN.md — Firmware flashing.
 */
import { FirmwareError } from '../../firmware/errors.ts';
import { sha256Hex } from '../../firmware/hash.ts';
import { applyFirmwarePatch, readFirmwarePatchVersionStamp } from '../../firmware/patch/index.ts';
import { loadedFirmwarePatchTitle, stockFirmwareTitle } from '../../firmware/releases/projects.ts';
import type { LoadedFirmwarePatch } from '../../firmware/releases/types.ts';
import {
  verifiedStockForBase,
  type VerifiedStockFirmware,
} from '../../firmware/stock/resolveStockFirmware.ts';
import { stockVariantFor, stockVariants, toStockVariantFor } from '../../firmware/stockVariants.ts';
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
   * The flash layout of the radio this image is prepared for, where the radio's firmware comes in more than one
   * (UV-5R Mini: `L1` or `L2`, the factory firmware's packing, from its radio report or its Radio Info screen). Unset
   * when Studio has not been told. An updater whose image is tied to one layout refuses an image prepared for the
   * other layout, or for none.
   */
  readonly radioLayout?: string;
  /**
   * The build name the radio gave about itself (UV-5R Mini: its radio report); absent when it named none.
   * An updater warns about, or refuses, an image whose build is the one the radio already runs.
   */
  readonly radioBuild?: string;
  /**
   * Set when the radio reported about itself (UV-5R Mini: its radio report), so it runs an MM9PDY build even where
   * `radioBuild` is absent because the report named none.
   */
  readonly radioReported?: true;
  /**
   * The stock base the radio's own code is built on, where the radio said so itself (UV-5R Mini: its radio report's
   * code-base flag). An updater refuses an image on another base: a radio's code base never changes.
   */
  readonly radioCodeBase?: string;
  /**
   * Set when the operator has explicitly confirmed writing the build the radio already runs (a repair). An updater that
   * allows a same-build write asks for this confirmation first and sends nothing without it.
   */
  readonly reinstallConfirmed?: true;
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

/** The refusal for a patch on a stock base the operator supplied no stock for. */
export const STOCK_FOR_BASE_MISSING = (version: string, fileNames: readonly string[]): string =>
  `This file is built on stock ${version}, which wasn't supplied. Add ${fileNames.join(', ')} at the Stock firmware step.`;

/**
 * The verified stock a target is built on. A patch that names its `base` is built on the stock of that base, where the
 * radio takes one stock per base (`severalStocks`); the first supplied stock otherwise. A patch on a base of this
 * radio that was not supplied is refused here, naming the file to add.
 */
function stockForTarget(
  radioDescriptor: StockFirmwareDescriptor,
  stock: VerifiedStockFirmware,
  target: FirmwareTarget,
): VerifiedStockFirmware {
  const base = target.kind === 'patch' ? target.patch.parsed.description.base : undefined;
  if (base === undefined || !radioDescriptor.severalStocks) return stock;
  const own = verifiedStockForBase(stock, base);
  if (own) return own;
  const variant = stockVariants(radioDescriptor).find((v) => v.baseName === base);
  if (!variant) return stock;
  throw new FirmwareError(
    'patch-wrong-stock',
    STOCK_FOR_BASE_MISSING(
      variant.version,
      variant.members.map((m) => m.fileName),
    ),
  );
}

export async function prepareFirmwareImage(input: {
  descriptor: StockFirmwareDescriptor;
  stock: VerifiedStockFirmware;
  target: FirmwareTarget;
  /** The radio's flash layout, where Studio knows it (see `PreparedFirmwareImage.radioLayout`). */
  radioLayout?: string;
  /** The build name the radio gave, where it gave one (see `PreparedFirmwareImage.radioBuild`). */
  radioBuild?: string;
  /** The radio reported about itself (see `PreparedFirmwareImage.radioReported`). */
  radioReported?: boolean;
  /** The radio's own code base, where it said so (see `PreparedFirmwareImage.radioCodeBase`). */
  radioCodeBase?: string;
  /** The operator confirmed writing the build the radio already runs (see `PreparedFirmwareImage.reinstallConfirmed`). */
  reinstallConfirmed?: boolean;
}): Promise<PreparedFirmwareImage> {
  const { descriptor: radioDescriptor, target } = input;
  const stock = stockForTarget(radioDescriptor, input.stock, target);
  const layout = {
    ...(input.radioLayout === undefined ? {} : { radioLayout: input.radioLayout }),
    ...(input.radioBuild ? { radioBuild: input.radioBuild } : {}),
    ...(input.radioReported ? { radioReported: true as const } : {}),
    ...(input.radioCodeBase ? { radioCodeBase: input.radioCodeBase } : {}),
    ...(input.reinstallConfirmed ? { reinstallConfirmed: true as const } : {}),
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

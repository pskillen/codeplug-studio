/**
 * Port of `apply` from the firmware project's `fw/make_patch.py`: verify stock → overwrite segments (a segment may
 * extend the image) → verify result.
 */
import { DM32UV_FIRMWARE_ROLE_BIN } from '../../../../radios/baofeng/dm-32uv/firmware.ts';
import { FirmwareError } from '../../../errors.ts';
import { sha256Hex } from '../../../hash.ts';
import type { FirmwarePackage } from '../../../types.ts';
import { malformed } from '../../schema.ts';
import type { Dm32PatchV1 } from './schema.ts';

export async function applyDm32Patch(
  stock: FirmwarePackage,
  patch: Dm32PatchV1,
): Promise<FirmwarePackage> {
  const roles = Object.keys(stock.files);
  const image = stock.files[DM32UV_FIRMWARE_ROLE_BIN];
  if (roles.length !== 1 || !image) {
    throw new FirmwareError(
      'patch-wrong-stock',
      'This patch needs the single DM-32UV firmware image, which was not supplied.',
    );
  }
  if (image.length !== patch.stock.size || (await sha256Hex(image)) !== patch.stock.sha256) {
    throw new FirmwareError(
      'patch-wrong-stock',
      'This patch was made for different stock firmware than the one you supplied.',
    );
  }

  let out = image.slice();
  let length = out.length;
  for (const seg of patch.segments) {
    if (seg.offset > length) throw malformed('a segment leaves a gap in the image');
    const end = seg.offset + seg.data.length;
    if (end > out.length) {
      const grown = new Uint8Array(end);
      grown.set(out.subarray(0, length));
      out = grown;
    }
    out.set(seg.data, seg.offset);
    length = Math.max(length, end);
  }
  const result = out.length === length ? out : out.slice(0, length);

  if (result.length !== patch.result.size || (await sha256Hex(result)) !== patch.result.sha256) {
    throw new FirmwareError(
      'patch-result-mismatch',
      'The patched firmware does not match the hash recorded in the patch. Nothing will be flashed.',
    );
  }
  return { radioId: stock.radioId, files: { [DM32UV_FIRMWARE_ROLE_BIN]: result } };
}

const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

/** The release tag stamped into the result image's version slot, if the patch declares one. */
export function readDm32VersionStamp(
  result: FirmwarePackage,
  patch: Dm32PatchV1,
): string | undefined {
  const slot = patch.versionSlot;
  const image = result.files[DM32UV_FIRMWARE_ROLE_BIN];
  if (!slot || !image || slot.offset + slot.len > image.length) return undefined;
  const bytes = image.subarray(slot.offset, slot.offset + slot.len);
  const nul = bytes.indexOf(0);
  const text = String.fromCharCode(...(nul === -1 ? bytes : bytes.subarray(0, nul)));
  return PRINTABLE_ASCII.test(text) ? text : undefined;
}

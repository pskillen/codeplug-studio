/**
 * Port of `apply` from the firmware project's `tools/make_patch.py` (UV-5R Mini): verify the stock `.ufw`'s size and
 * SHA-256 → copy → write each edit in place → cut to `truncate` → append → verify the result's size and SHA-256.
 * Pure: the stock bytes are never mutated, and nothing comes out unless the result matches.
 */
import { UV5RMINI_FIRMWARE_ROLE_UFW } from '../../../../radios/baofeng/uv-5r-mini/firmware.ts';
import { FirmwareError } from '../../../errors.ts';
import { sha256Hex } from '../../../hash.ts';
import type { FirmwarePackage } from '../../../types.ts';
import { malformed } from '../../schema.ts';
import type { FirmwarePatchHashes } from '../../types.ts';
import { UV5RMINI_MAX_RESULT_SIZE } from './constants.ts';
import type { Uv5rMiniPatchV1 } from './schema.ts';

const ROLE = UV5RMINI_FIRMWARE_ROLE_UFW;

async function matches(bytes: Uint8Array, want: FirmwarePatchHashes | undefined): Promise<boolean> {
  return !!want && bytes.length === want.size && (await sha256Hex(bytes)) === want.sha256;
}

export async function applyUv5rMiniPatch(
  stock: FirmwarePackage,
  patch: Uv5rMiniPatchV1,
): Promise<FirmwarePackage> {
  const stockUfw = stock.files[ROLE];
  if (Object.keys(stock.files).length !== 1 || !stockUfw) {
    throw new FirmwareError(
      'patch-wrong-stock',
      'This patch needs the UV-5R Mini stock firmware file, which was not supplied.',
    );
  }
  if (!(await matches(stockUfw, patch.stock[ROLE]))) {
    throw new FirmwareError(
      'patch-wrong-stock',
      'This patch was made for different stock firmware than the file you supplied.',
    );
  }

  const want = patch.result[ROLE]!;
  const length = patch.truncate + patch.append.length;
  if (length !== want.size) {
    throw new FirmwareError(
      'patch-result-mismatch',
      'The patched firmware does not match the size recorded in the patch. Nothing will be flashed.',
    );
  }
  if (length > UV5RMINI_MAX_RESULT_SIZE || patch.truncate > stockUfw.length) {
    throw malformed('the patch is outside its limits');
  }
  const out = new Uint8Array(length);
  out.set(stockUfw.subarray(0, patch.truncate));
  let last = 0;
  for (const edit of patch.edits) {
    const end = edit.offset + edit.data.length;
    if (edit.data.length === 0 || edit.offset < last || end > patch.truncate) {
      throw malformed('an edit is empty, out of order or outside the image');
    }
    out.set(edit.data, edit.offset);
    last = end;
  }
  out.set(patch.append, patch.truncate);

  if (!(await matches(out, want))) {
    throw new FirmwareError(
      'patch-result-mismatch',
      'The patched firmware does not match the hashes recorded in the patch. Nothing will be flashed.',
    );
  }
  return { radioId: stock.radioId, files: { [ROLE]: out } };
}

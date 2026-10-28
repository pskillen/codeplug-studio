/**
 * Port of `apply` from the firmware project's `fw/make_patch.py` (RT95): verify all three stock files → hooks (each
 * checked against its original bytes) → append → rewrite the image length in `.CDI` (+0x104) and `.spi` (+2) →
 * verify all three results.
 */
import { RT95_HEAD_FIRMWARE_ROLE } from '../../../../radios/retevis/rt95/firmware.ts';
import { FirmwareError } from '../../../errors.ts';
import { sha256Hex } from '../../../hash.ts';
import type { FirmwarePackage } from '../../../types.ts';
import { malformed } from '../../schema.ts';
import type { FirmwarePatchHashes } from '../../types.ts';
import { CDI_LEN_OFF, RT95_MAX_IMAGE, SPI_LEN_OFF } from './constants.ts';
import type { Rt95PatchV1 } from './schema.ts';

const ROLES = [
  RT95_HEAD_FIRMWARE_ROLE.CDD,
  RT95_HEAD_FIRMWARE_ROLE.CDI,
  RT95_HEAD_FIRMWARE_ROLE.SPI,
] as const;

async function matches(bytes: Uint8Array, want: FirmwarePatchHashes | undefined): Promise<boolean> {
  return !!want && bytes.length === want.size && (await sha256Hex(bytes)) === want.sha256;
}

/** Copy `buf` with a u32 LE `n` written at `off`. */
function withLength(buf: Uint8Array, off: number, n: number): Uint8Array {
  if (off + 4 > buf.length) throw malformed('an image-length field is outside its file');
  if (n > 0xffff_ffff) throw malformed('the patched image is too large');
  const out = buf.slice();
  new DataView(out.buffer, out.byteOffset, out.byteLength).setUint32(off, n, true);
  return out;
}

export async function applyRt95Patch(
  stock: FirmwarePackage,
  patch: Rt95PatchV1,
): Promise<FirmwarePackage> {
  const keys = Object.keys(stock.files);
  if (keys.length !== ROLES.length || !ROLES.every((r) => stock.files[r])) {
    throw new FirmwareError(
      'patch-wrong-stock',
      'This patch needs all three RT95 front panel firmware files, which were not all supplied.',
    );
  }
  for (const role of ROLES) {
    if (!(await matches(stock.files[role]!, patch.stock[role]))) {
      throw new FirmwareError(
        'patch-wrong-stock',
        'This patch was made for different stock firmware than the files you supplied.',
      );
    }
  }

  const stockCdd = stock.files[RT95_HEAD_FIRMWARE_ROLE.CDD]!;
  const length = stockCdd.length + patch.append.data.length;
  if (length > RT95_MAX_IMAGE) {
    throw malformed("the patched image does not fit the front panel's flash");
  }
  const cdd = new Uint8Array(length);
  cdd.set(stockCdd);
  for (const hook of patch.hooks) {
    const len = hook.original.length;
    if (hook.data.length !== len || hook.offset + len > stockCdd.length) {
      throw malformed('a hook is outside the stock image or changes its length');
    }
    const current = cdd.subarray(hook.offset, hook.offset + len);
    if (!current.every((b, i) => b === hook.original[i])) {
      throw new FirmwareError(
        'patch-original-mismatch',
        'The stock firmware does not contain the bytes this patch expects to replace. Nothing will be flashed.',
      );
    }
    cdd.set(hook.data, hook.offset);
  }
  if (patch.append.offset !== stockCdd.length) {
    throw malformed('the appended bytes do not start at the end of the stock image');
  }
  cdd.set(patch.append.data, stockCdd.length);

  const files: Record<string, Uint8Array> = {
    [RT95_HEAD_FIRMWARE_ROLE.CDD]: cdd,
    [RT95_HEAD_FIRMWARE_ROLE.CDI]: withLength(
      stock.files[RT95_HEAD_FIRMWARE_ROLE.CDI]!,
      CDI_LEN_OFF,
      cdd.length,
    ),
    [RT95_HEAD_FIRMWARE_ROLE.SPI]: withLength(
      stock.files[RT95_HEAD_FIRMWARE_ROLE.SPI]!,
      SPI_LEN_OFF,
      cdd.length,
    ),
  };
  for (const role of ROLES) {
    if (!(await matches(files[role]!, patch.result[role]))) {
      throw new FirmwareError(
        'patch-result-mismatch',
        'The patched firmware does not match the hashes recorded in the patch. Nothing will be flashed.',
      );
    }
  }
  return { radioId: stock.radioId, files };
}

/**
 * Test-only synthetic AT-D890UV firmware packages: a port of `synth()` in the firmware project's
 * `tools/test_d890update.py`. Bytes `(i*7) & 0xFF` with a plausible vector table. Never real stock.
 */
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import type { D890FirmwareFiles } from '../package.ts';

const enc = (s: string) => new TextEncoder().encode(s);

function putU32(b: Uint8Array, o: number, v: number): void {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
  b[o + 2] = (v >>> 16) & 0xff;
  b[o + 3] = (v >>> 24) & 0xff;
}

export interface SynthD890Options {
  readonly model?: string;
  readonly version?: string;
  readonly name?: string;
}

/** The three files of a one-entry firmware package loading `length` bytes at `addr`. */
export function synthD890Package(
  addr = 0x0800c000,
  length = 100,
  opts: SynthD890Options = {},
): D890FirmwareFiles {
  const cdd = new Uint8Array(length);
  for (let i = 0; i < length; i++) cdd[i] = (i * 7) & 0xff;
  if (length >= 8) {
    putU32(cdd, 0, 0x20025fa0);
    putU32(cdd, 4, 0x0800c041);
  }

  const cdi = new Uint8Array(278);
  cdi.fill(0x20, 0, 0x100);
  cdi.set(enc(opts.name ?? 'D890UV_MAIN.bin'), 0);
  putU32(cdi, 0x100, addr);
  putU32(cdi, 0x104, length);
  putU32(cdi, 0x108, 0);
  putU32(cdi, 0x10c, 0x10000);

  const model = opts.model ?? 'D890UV';
  const version = opts.version ?? 'V100';
  const spi = new Uint8Array(51).fill(0x20);
  putU32(spi, 0, 0x20);
  spi[4] = 1;
  spi[5] = 0;
  putU32(spi, 6, length);
  spi.fill(0, 10, 14);
  spi.set(enc(`${model.padEnd(6)}  ${version}`), 14);
  spi.set(enc(model.padEnd(16)), 26);
  spi.set(enc(version), 42);

  return { cdd, cdi, spi };
}

/** Tests only: the real constructor is `prepareFirmwareImage`. */
export function preparedD890Image(
  files: D890FirmwareFiles,
  overrides: Partial<{ radioId: string; files: Record<string, Uint8Array> }> = {},
): PreparedFirmwareImage {
  return {
    radioId: overrides.radioId ?? 'anytone-at-d890uv',
    provenance: 'stock',
    stockVersion: 'V0.00-test',
    title: 'stock firmware V0.00-test',
    package: {
      radioId: overrides.radioId ?? 'anytone-at-d890uv',
      files: overrides.files ?? { cdd: files.cdd, cdi: files.cdi, spi: files.spi },
    },
    sha256: {},
    verifyHint: 'test',
  } as unknown as PreparedFirmwareImage;
}

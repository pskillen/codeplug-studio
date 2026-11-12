/**
 * Test-only: the firmware project's synthetic MAIN golden (`main_stock_golden()` in `tools/test_rt95update.py`),
 * regenerated here. `.CDD` = 0xD93C + 40 bytes of `(i * 7 + 3) & 0xFF`, then SP, reset vector, model string and the
 * hook-site bytes. Never real stock bytes.
 */
import {
  CDI_LEN_OFF,
  RT95_MAIN_HOOK_OFFSET,
  RT95_MAIN_HOOK_ORIGINAL,
  RT95_MAIN_IMAGE_LEN,
  SPI_LEN_OFF,
} from '../constants.ts';

export interface SyntheticMainFiles {
  readonly cdd: Uint8Array;
  readonly cdi: Uint8Array;
  readonly spi: Uint8Array;
}

export function synthMainStock(): SyntheticMainFiles {
  const cdd = new Uint8Array(RT95_MAIN_IMAGE_LEN + 40);
  for (let i = 0; i < cdd.length; i++) cdd[i] = (i * 7 + 3) & 0xff;
  const dv = new DataView(cdd.buffer);
  dv.setUint32(0, 0x200013e8, true);
  dv.setUint32(4, 0x08002869, true);
  cdd.set(new TextEncoder().encode('RT95-P\0'), 0xd65c);
  cdd.set(RT95_MAIN_HOOK_ORIGINAL, RT95_MAIN_HOOK_OFFSET);
  const cdi = new Uint8Array(278);
  cdi.fill(0x20, 0, 0x100);
  cdi.set(new TextEncoder().encode('RT95_MAIN.bin'), 0);
  const cdiView = new DataView(cdi.buffer);
  cdiView.setUint32(0x100, 0x08002000, true);
  cdiView.setUint32(CDI_LEN_OFF, RT95_MAIN_IMAGE_LEN, true);
  cdiView.setUint32(0x108, 0, true);
  cdiView.setUint32(0x10c, 0x00010000, true);
  const spi = new Uint8Array(10);
  const spiView = new DataView(spi.buffer);
  spiView.setUint16(0, 1, true);
  spiView.setUint32(SPI_LEN_OFF, RT95_MAIN_IMAGE_LEN, true);
  return { cdd, cdi, spi };
}

import { describe, expect, it } from 'vitest';
import { dm32Capture, dm32Page } from './dm32Archive.fixture.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import { HEX_PAGE_BYTES, hexRows, sensitiveRanges } from './viewerUtils.ts';

/** A channel page plus the 0x04 settings page; synthetic passwords "1234", "AB" and "CD". */
async function passwordArchive() {
  const settings = dm32Page(0x04);
  settings.set(new TextEncoder().encode('1234'), 0x431); // power-on
  settings.set(new TextEncoder().encode('AB'), 0x43b); // write
  settings.set(new TextEncoder().encode('CD'), 0x443); // read
  return archiveDm32Capture(
    dm32Capture({
      blocks: new Map([
        [0x1000, dm32Page(0x12)],
        [0x2000, settings],
      ]),
    }),
  );
}

describe('DM-32 password masking in Hex', () => {
  it('finds the three password spans at the captured page address', async () => {
    const archive = await passwordArchive();
    const found = archive.manifest.regions.flatMap((r) =>
      sensitiveRanges(archive, r.id).map(({ start, end }) => [start, end]),
    );
    expect(found).toEqual([
      [0x2431, 0x2439],
      [0x243b, 0x2443],
      [0x2443, 0x244b],
    ]);
  });

  it('masks by default, shows on reveal, and leaves the archive bytes untouched', async () => {
    const archive = await passwordArchive();
    const holder = archive.manifest.regions.find((r) => sensitiveRanges(archive, r.id).length)!;
    const before = archive.regions[holder.id]!.slice();
    const bytes = archive.regions[holder.id]!;
    const page = Math.floor((0x2431 - holder.address) / HEX_PAGE_BYTES);
    const rowAt = (mask: ReturnType<typeof sensitiveRanges>) =>
      hexRows(bytes, holder.address, page, mask).find((r) => r.address === 0x2430)!;
    const masked = rowAt(sensitiveRanges(archive, holder.id));
    expect(masked.hex).toContain('•• •• •• ••');
    expect(masked.hex).not.toMatch(/31 32 33 34/);
    expect(masked.ascii).not.toContain('1234');
    const shown = rowAt([]);
    expect(shown.hex).toMatch(/31 32 33 34/);
    expect(archive.regions[holder.id]!).toEqual(before);
  });

  it('masks nothing when the settings page is absent', async () => {
    const archive = await archiveDm32Capture(
      dm32Capture({ blocks: new Map([[0x1000, dm32Page(0x12)]]) }),
    );
    for (const r of archive.manifest.regions) expect(sensitiveRanges(archive, r.id)).toEqual([]);
  });
});

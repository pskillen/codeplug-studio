/**
 * Re-verifies every bundled release patch: exact bytes, format, pinned stock and result hashes. Release patches only;
 * never vendor firmware.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AT_D890UV_FIRMWARE_ROLE } from '../../radios/anytone/at-d890uv/firmware.ts';
import { DM32UV_FIRMWARE_IMAGE_SIZE } from '../../radios/baofeng/dm-32uv/firmware.ts';
import { sha256Hex } from '../hash.ts';
import type { D890PatchV1 } from '../patch/formats/anytone-d890-firmware/index.ts';
import { parseFirmwarePatch } from '../patch/index.ts';
import { getStockFirmwareDescriptor, listStockFirmwareDescriptors } from '../stockCatalog.ts';
import { BUNDLED_FIRMWARE_RELEASES } from './index.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('bundled firmware release catalog', () => {
  it('has at least one final per radio, no duplicates, and RC tags match the channel', () => {
    for (const d of listStockFirmwareDescriptors()) {
      expect(
        BUNDLED_FIRMWARE_RELEASES.some((r) => r.radioId === d.radioId && r.channel === 'final'),
        d.radioId,
      ).toBe(true);
    }
    const keys = BUNDLED_FIRMWARE_RELEASES.map((r) => `${r.radioId}@${r.tag}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of BUNDLED_FIRMWARE_RELEASES) {
      expect(/-rc\.\d+$/.test(r.tag), r.tag).toBe(r.channel === 'rc');
    }
  });

  describe.each(BUNDLED_FIRMWARE_RELEASES.map((r) => [`${r.radioId} ${r.tag}`, r] as const))(
    '%s',
    (_name, release) => {
      const dir = join(here, release.radioId);
      const patchPath = join(dir, `${release.tag}.patch.json`);
      const notesPath = join(dir, `${release.tag}.release-notes.md`);
      const descriptor = getStockFirmwareDescriptor(release.radioId);

      it('ships the published bytes', async () => {
        expect(existsSync(patchPath)).toBe(true);
        const fileBytes = new Uint8Array(readFileSync(patchPath));
        expect(await sha256Hex(fileBytes)).toBe(release.patchSha256);
        // Proves the `?raw` import is byte-exact.
        const loaded = await release.loadBytes();
        expect(Buffer.from(loaded).equals(Buffer.from(fileBytes))).toBe(true);
        expect(await sha256Hex(loaded)).toBe(release.patchSha256);
      });

      it('parses, belongs to this radio and matches its pinned stock', async () => {
        const parsed = parseFirmwarePatch(await release.loadBytes());
        const { description } = parsed;
        expect(descriptor.patchNames).toContain(description.name);
        expect(release.patchName).toBe(description.name);
        expect(description.version).toBe(release.tag);
        expect(release.stockVersion).toBe(descriptor.version);
        expect(Object.keys(description.stock).sort()).toEqual(
          descriptor.members.map((m) => m.role).sort(),
        );
        for (const m of descriptor.members) {
          expect(description.stock[m.role]).toEqual({ sha256: m.sha256, size: m.size });
        }
        const results = Object.fromEntries(
          Object.entries(description.result).map(([role, h]) => [role, h.sha256]),
        );
        expect(release.resultSha256).toEqual(results);

        if (release.radioId === 'baofeng-dm32uv') {
          // A bundled release can never be refused by the updater's length interlock.
          expect(description.result.bin?.size).toBe(DM32UV_FIRMWARE_IMAGE_SIZE);
        }
        if (release.radioId === 'anytone-at-d890uv') {
          const patch = parsed.patch as D890PatchV1;
          const cddSize = descriptor.members.find(
            (m) => m.role === AT_D890UV_FIRMWARE_ROLE.CDD,
          )!.size;
          expect(patch.hooks.length).toBeGreaterThan(0);
          for (const h of patch.hooks) {
            expect(h.original.length).toBe(h.data.length);
            expect(h.offset + h.data.length).toBeLessThanOrEqual(cddSize);
          }
          expect(patch.append.offset).toBe(cddSize);
        }
      });

      it('ships non-empty release notes', async () => {
        expect(existsSync(notesPath)).toBe(true);
        expect((await release.loadNotes()).trim().length).toBeGreaterThan(0);
        expect(await release.loadNotes()).toBe(readFileSync(notesPath, 'utf8'));
      });
    },
  );
});

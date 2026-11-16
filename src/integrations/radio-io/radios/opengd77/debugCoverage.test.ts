import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import {
  OPENGD77_BACKUP_FLASH_SPANS,
  OPENGD77_BACKUP_USER_DATABASE_ID,
} from './backupRestoreRoles.ts';
import { DM1701_RADIO_TYPES, MD9600_RADIO_TYPES } from './constants.ts';
import {
  buildOpenGd77DebugArchiveParts,
  OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR,
} from './debugCapture.ts';
import {
  classifyOpenGd77DebugCoverage,
  describeOpenGd77RadioType,
  isOpenGd77ModelId,
  OPENGD77_DEBUG_MODELS,
  openGd77DebugIdentity,
  openGd77DebugRegionIdentity,
  openGd77DebugModel,
} from './debugCoverage.ts';
import { OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID } from './hydration.ts';
import { createOpenUv380Image } from './memory.ts';
import { makeOpenGd77FirmwareInfoPayload } from './__fixtures__/scriptedPipe.ts';

function parts(radioType = 0x08, db = new Uint8Array(12 + 27 * 2)) {
  return buildOpenGd77DebugArchiveParts({
    modelId: OPENGD77_DM1701_MODEL_ID,
    capturedAt: '2026-01-01T00:00:00.000Z',
    capturedVia: 'web-serial',
    firmwareInfoRaw: makeOpenGd77FirmwareInfoPayload(radioType, { features: 0x05 }),
    calibrationWorkingCopy: new Uint8Array(512),
    settingsGap: new Uint8Array(0x60),
    image: createOpenUv380Image(),
    userDatabase: db,
  });
}

describe('models and aliases', () => {
  it('keys both models and exposes their radio types', () => {
    expect(OPENGD77_DEBUG_MODELS[OPENGD77_DM1701_MODEL_ID]!.radioTypes).toEqual(DM1701_RADIO_TYPES);
    expect(OPENGD77_DEBUG_MODELS[OPENGD77_MD9600_MODEL_ID]!.radioTypes).toEqual(MD9600_RADIO_TYPES);
  });

  it.each([
    ['DM-1701', 'DM-1701'],
    ['RT-84', 'DM-1701'],
    ['Baofeng DM-1701', 'DM-1701'],
    ['MD-9600', 'MD-9600'],
    ['RT-90', 'MD-9600'],
  ])('resolves %s to %s', (alias, id) => {
    expect(isOpenGd77ModelId(alias)).toBe(true);
    expect(openGd77DebugModel(alias)?.modelId).toBe(id);
  });

  it.each(['DM-32UV', 'retevis-rt95', '', 'toString', '__proto__'])('rejects %s', (id) => {
    expect(isOpenGd77ModelId(id)).toBe(false);
    expect(openGd77DebugModel(id)).toBeUndefined();
  });
});

describe('describeOpenGd77RadioType', () => {
  it('names shared types without picking one of a pair', () => {
    expect(describeOpenGd77RadioType(0x05)).toBe('MD-9600 / RT-90');
    expect(describeOpenGd77RadioType(0x08)).toBe('DM-1701 / RT-84');
    expect(describeOpenGd77RadioType(0x0a)).toBe('DM-1701 / RT-84 (RGB display)');
  });
  it('names documented types with no debug page', () => {
    expect(describeOpenGd77RadioType(0x06)).toBe('TYT MD-UV390 (no debug page)');
  });
  it('does not guess at unknown codes', () => {
    expect(describeOpenGd77RadioType(0x7f)).toBe('Unrecognised radio type 0x7f');
  });
});

describe('openGd77DebugIdentity', () => {
  it('is undefined without the sidecar', () => {
    expect(openGd77DebugIdentity({})).toBeUndefined();
  });

  it('reads the reported fields and feature bits', () => {
    const id = openGd77DebugIdentity(parts(0x0a).sidecars)!;
    expect(id).toMatchObject({
      status: 'ok',
      radioType: 0x0a,
      radioTypeLabel: 'DM-1701 / RT-84 (RGB display)',
      revision: 'R20240101000000',
      buildDate: '20240101120000',
      flashId: 0x4018,
      features: 0x05,
      featureBits: { inverseVideo: true, dmrIdDatabaseNLocation: false, voicePromptsLoaded: true },
    });
  });

  it('is invalid for a wrong length', () => {
    const id = openGd77DebugIdentity({
      [OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]: new Uint8Array(10),
    });
    expect(id).toEqual({ status: 'invalid', reason: expect.stringContaining('10 bytes') });
  });
});

describe('classifyOpenGd77DebugCoverage', () => {
  it('reports every span captured, the gaps and a packed User Database', () => {
    const p = parts();
    const c = classifyOpenGd77DebugCoverage(p.manifest, p.regions, p.sidecars);
    expect(c.spans.map((s) => s.state)).toEqual(['captured', 'captured', 'captured', 'captured']);
    expect(c.spans.map((s) => [s.start, s.length])).toEqual(
      OPENGD77_BACKUP_FLASH_SPANS.map((s) => [s.start, s.length]),
    );
    expect(c.gaps).toHaveLength(3);
    // The debug-only settings gap 0x6060-0x60BF is read, so the unread gap starts after it.
    expect(c.gaps[0]).toEqual({ start: 0x60c0, end: 0x7500 });
    expect(c.userDatabase).toEqual({
      state: 'captured',
      byteLength: 12 + 54,
      packed: true,
      headerOnly: false,
    });
    expect(c.unclassified).toEqual([]);
    expect(c.flashPart).toBe('Flash ID 0x4018 (as reported)');
  });

  it('says a header-only User Database is header only', () => {
    const p = parts(0x08, new Uint8Array(12));
    expect(classifyOpenGd77DebugCoverage(p.manifest, p.regions).userDatabase.headerOnly).toBe(true);
  });

  it('marks a missing span and a truncated span', () => {
    const p = parts();
    const manifest: RadioBackupManifestV1 = {
      ...p.manifest,
      regions: p.manifest.regions.filter((r) => r.id !== 'flash-span-1'),
    };
    const regions = { ...p.regions, 'flash-span-2': p.regions['flash-span-2']!.slice(0, 100) };
    const c = classifyOpenGd77DebugCoverage(manifest, regions);
    expect(c.spans[1]).toMatchObject({ state: 'missing', capturedBytes: 0 });
    expect(c.spans[2]).toMatchObject({ state: 'partial', capturedBytes: 100 });
    expect(c.spans[0]!.state).toBe('captured');
  });

  it('marks a missing User Database as not captured', () => {
    const p = parts();
    const manifest = {
      ...p.manifest,
      regions: p.manifest.regions.filter((r) => r.id !== OPENGD77_BACKUP_USER_DATABASE_ID),
    };
    expect(classifyOpenGd77DebugCoverage(manifest, p.regions).userDatabase).toMatchObject({
      state: 'not-captured',
      byteLength: 0,
    });
  });

  it('lists unknown, mis-addressed and mis-roled regions as unclassified with a reason', () => {
    const p = parts();
    const manifest: RadioBackupManifestV1 = {
      ...p.manifest,
      regions: [
        ...p.manifest.regions.map((r) =>
          r.id === 'flash-span-0' ? { ...r, address: r.address + 1 } : r,
        ),
        {
          id: 'mystery',
          label: 'x',
          address: 0x1234,
          byteLength: 4,
          path: 'regions/x.bin',
          restoreRole: 'inspect-only',
        },
      ],
    };
    const c = classifyOpenGd77DebugCoverage(manifest, { ...p.regions, mystery: new Uint8Array(4) });
    expect(c.spans[0]!.state).toBe('missing');
    expect(c.unclassified.map((u) => u.id)).toEqual(['flash-span-0', 'mystery']);
    expect(c.unclassified[0]!.reason).toMatch(/does not match/);
    expect(c.unclassified[1]!.reason).toMatch(/not a registered/);
  });
});

describe('openGd77DebugRegionIdentity', () => {
  it('identifies registered spans and the packed User Database', () => {
    const p = parts();
    expect(openGd77DebugRegionIdentity(p.manifest, p.regions, 'flash-span-0')).toEqual({
      space: 'OpenGD77 FLASH, absolute address',
      representation: 'FLASH bytes',
    });
    expect(
      openGd77DebugRegionIdentity(p.manifest, p.regions, OPENGD77_BACKUP_USER_DATABASE_ID)?.space,
    ).toMatch(/packed/);
  });

  it('accepts a restorable span (Backup ZIP read)', () => {
    const p = parts();
    const manifest = {
      ...p.manifest,
      regions: p.manifest.regions.map((r) => ({ ...r, restoreRole: 'restorable' as const })),
    };
    expect(openGd77DebugRegionIdentity(manifest, p.regions, 'flash-span-1')).toBeDefined();
  });

  it('refuses unknown ids, moved addresses, wrong paths and short bytes', () => {
    const p = parts();
    expect(openGd77DebugRegionIdentity(p.manifest, p.regions, 'nope')).toBeUndefined();
    const edit = (patch: object) => ({
      ...p.manifest,
      regions: p.manifest.regions.map((r) => (r.id === 'flash-span-0' ? { ...r, ...patch } : r)),
    });
    expect(openGd77DebugRegionIdentity(edit({ address: 1 }), p.regions, 'flash-span-0')).toBe(
      undefined,
    );
    expect(openGd77DebugRegionIdentity(edit({ path: 'x.bin' }), p.regions, 'flash-span-0')).toBe(
      undefined,
    );
    const short = { ...p.regions, 'flash-span-0': new Uint8Array(3) };
    expect(openGd77DebugRegionIdentity(p.manifest, short, 'flash-span-0')).toBeUndefined();
  });
});

describe('calibration working copy coverage', () => {
  const cal = (p: ReturnType<typeof parts>, change: object) => ({
    ...p.manifest,
    regions: p.manifest.regions.map((r) =>
      r.id === 'calibration-working-copy' ? { ...r, ...change } : r,
    ),
  });

  it('classifies the region as its own address space, not a span or unclassified', () => {
    const p = parts();
    const c = classifyOpenGd77DebugCoverage(p.manifest, p.regions, p.sidecars);
    expect(c.calibration).toEqual({ state: 'captured', byteLength: 512 });
    expect(c.unclassified).toEqual([]);
    expect(c.spans.every((s) => s.id !== 'calibration-working-copy')).toBe(true);
    expect(c.gaps.some((g) => g.start <= 0x10000 && g.end > 0x10000)).toBe(true);
    expect(openGd77DebugRegionIdentity(p.manifest, p.regions, 'calibration-working-copy')).toEqual({
      space: 'OpenGD77 working copy (served from RAM)',
      representation: 'calibration bytes',
    });
  });

  it('is not-captured when absent and unclassified when the address is wrong', () => {
    const p = parts();
    const none = classifyOpenGd77DebugCoverage(
      {
        ...p.manifest,
        regions: p.manifest.regions.filter((r) => r.id !== 'calibration-working-copy'),
      },
      p.regions,
      p.sidecars,
    );
    expect(none.calibration.state).toBe('not-captured');
    const moved = cal(p, { address: 0x10020 });
    const c = classifyOpenGd77DebugCoverage(moved, p.regions, p.sidecars);
    expect(c.calibration.state).toBe('not-captured');
    expect(c.unclassified.map((u) => u.id)).toEqual(['calibration-working-copy']);
    expect(
      openGd77DebugRegionIdentity(moved, p.regions, 'calibration-working-copy'),
    ).toBeUndefined();
  });
});

describe('settings struct tail coverage', () => {
  const gapOf = (p: ReturnType<typeof parts>, change: object) => ({
    ...p.manifest,
    regions: p.manifest.regions.map((r) => (r.id === 'settings-gap' ? { ...r, ...change } : r)),
  });

  it('classifies the region as captured and removes it from the unread gaps', () => {
    const p = parts();
    const c = classifyOpenGd77DebugCoverage(p.manifest, p.regions, p.sidecars);
    expect(c.settingsGap).toEqual({ state: 'captured', byteLength: 0x60 });
    expect(c.unclassified).toEqual([]);
    expect(c.spans.every((s) => s.id !== 'settings-gap')).toBe(true);
    expect(c.gaps[0]).toEqual({ start: 0x60c0, end: 0x7500 });
    expect(c.gaps.some((g) => g.start <= 0x6060 && g.end > 0x6060)).toBe(false);
    expect(openGd77DebugRegionIdentity(p.manifest, p.regions, 'settings-gap')).toEqual({
      space: 'OpenGD77 FLASH, absolute address',
      representation: 'FLASH bytes',
    });
  });

  it('is not-captured for an older archive and the gap stays unread', () => {
    const p = parts();
    const old = {
      ...p.manifest,
      regions: p.manifest.regions.filter((r) => r.id !== 'settings-gap'),
    };
    const c = classifyOpenGd77DebugCoverage(old, p.regions, p.sidecars);
    expect(c.settingsGap).toEqual({ state: 'not-captured', byteLength: 0 });
    expect(c.unclassified).toEqual([]);
    expect(c.gaps[0]).toEqual({ start: 0x6060, end: 0x7500 });
  });

  it('is unclassified, not captured and incomparable when the address is wrong', () => {
    const p = parts();
    const moved = gapOf(p, { address: 0x6080 });
    const c = classifyOpenGd77DebugCoverage(moved, p.regions, p.sidecars);
    expect(c.settingsGap.state).toBe('not-captured');
    expect(c.unclassified.map((u) => u.id)).toEqual(['settings-gap']);
    expect(openGd77DebugRegionIdentity(moved, p.regions, 'settings-gap')).toBeUndefined();
  });
});

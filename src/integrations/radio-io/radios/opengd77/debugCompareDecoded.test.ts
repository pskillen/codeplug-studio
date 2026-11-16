import { describe, expect, it } from 'vitest';
import { diffDecoded } from '../../debugCompare/index.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { makeOpenGd77FirmwareInfoPayload } from './__fixtures__/scriptedPipe.ts';
import { OPENGD77_BACKUP_USER_DATABASE_ID } from './backupRestoreRoles.ts';
import { encodeChannelsIntoImage } from './channelCodec.ts';
import { compareOpenGd77Evidence } from './debugCompare.ts';
import { openGd77DecodedSnapshot } from './debugCompareDecoded.ts';
import { buildOpenGd77DebugArchiveParts } from './debugCapture.ts';
import { OPENGD77_DM1701_MODEL_ID } from './hydration.ts';
import { createOpenUv380Image, writeAbs } from './memory.ts';
import { encodeUserDatabaseHeader } from './userDatabaseCodec.ts';

const channel = (slot: number, name: string, rxHz = 145_500_000): RadioChannelDto => ({
  slotIndex: slot,
  empty: false,
  wireName: name,
  rxHz,
  txHz: rxHz,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: null,
  bandwidth: 'FM',
  mode: 'analog',
  location: null,
  useLocation: false,
});

function parts(
  opts: {
    revision?: string;
    entries?: number;
    channels?: RadioChannelDto[];
    bytes?: (image: ReturnType<typeof createOpenUv380Image>) => void;
  } = {},
) {
  const entries = opts.entries ?? 2;
  const header = encodeUserDatabaseHeader(entries);
  const db = new Uint8Array(header.length + entries * 27);
  db.set(header);
  const info = makeOpenGd77FirmwareInfoPayload(0x08, { features: 0x04 });
  if (opts.revision) {
    info.fill(0, 8, 24);
    info.set(new TextEncoder().encode(opts.revision), 8);
  }
  const image = createOpenUv380Image();
  if (opts.channels) encodeChannelsIntoImage(image, opts.channels, { clearUnlisted: true });
  opts.bytes?.(image);
  return buildOpenGd77DebugArchiveParts({
    modelId: OPENGD77_DM1701_MODEL_ID,
    capturedAt: '2026-01-01T00:00:00.000Z',
    capturedVia: 'web-serial',
    firmwareInfoRaw: info,
    calibrationWorkingCopy: new Uint8Array(512),
    settingsGap: new Uint8Array(0x60),
    image,
    userDatabase: db,
  });
}

const diff = (a: ReturnType<typeof parts>, b: ReturnType<typeof parts>, revealSensitive = false) =>
  diffDecoded(openGd77DecodedSnapshot(a), openGd77DecodedSnapshot(b), { revealSensitive });

describe('openGd77DecodedSnapshot', () => {
  it('is empty for another radio', () => {
    const p = parts();
    expect(
      openGd77DecodedSnapshot({ ...p, manifest: { ...p.manifest, radioModelId: 'RT95' } }),
    ).toEqual([]);
  });

  it('matches the evidence compare: same changed and unchanged fields', () => {
    const a = parts({ revision: 'R1' });
    const b = parts({ revision: 'R2', entries: 3 });
    const old = compareOpenGd77Evidence(a, b).filter((r) => !r.field.startsWith('Calibration'));
    const d = diff(a, b);
    const fields = d.records
      .filter((r) => r.domainId === 'evidence')
      .flatMap((r) => r.fields.map((f) => [f.id, f.kind] as const));
    for (const row of old) {
      const kind = fields.find(([id]) => id === row.field)?.[1];
      expect(kind, row.field).toBe(
        row.status === 'Changed'
          ? 'changed'
          : row.status === 'Unchanged'
            ? 'unchanged'
            : 'incomparable',
      );
    }
  });

  it('reports one channel change', () => {
    const d = diff(
      parts({ channels: [channel(1, 'SIMPLEX')] }),
      parts({ channels: [channel(1, 'SIMPLEX', 145_525_000)] }),
    );
    const rec = d.records.filter((r) => r.domainId === 'channels');
    expect(rec).toHaveLength(1);
    expect(rec[0]!.kind).toBe('changed');
    expect(rec[0]!.fields.filter((f) => f.kind === 'changed').map((f) => f.id)).toEqual([
      'rx',
      'tx',
    ]);
  });

  it('reads an added channel as added when both captures list occupancy', () => {
    const d = diff(
      parts({ channels: [channel(1, 'A')] }),
      parts({ channels: [channel(1, 'A'), channel(2, 'B')] }),
    );
    expect(
      d.records
        .filter((r) => r.domainId === 'channels' && r.kind !== 'unchanged')
        .map((r) => [r.slot, r.kind]),
    ).toEqual([[2, 'added']]);
  });

  it('reads a User Database that was not captured as unavailable, not zero', () => {
    const a = parts();
    const manifest = {
      ...a.manifest,
      regions: a.manifest.regions.filter((r) => r.id !== OPENGD77_BACKUP_USER_DATABASE_ID),
    };
    const d = diff(a, { ...a, manifest });
    const db = d.records.find((r) => r.key === 'evidence-user-database')!;
    expect(db.fields.length).toBeGreaterThan(0);
    expect(db.fields.every((f) => f.kind === 'incomparable')).toBe(true);
    expect(db.kind).toBe('incomparable');
  });

  it('reads a changed boot PIN and codeplug password as changed with no values', () => {
    const withPins = (pin: number, pwd: number) =>
      parts({
        bytes: (image) => {
          writeAbs(image, 0x751c, Uint8Array.of(pin, pin, pin));
          writeAbs(image, 0x100, new Uint8Array(8).fill(pwd));
        },
      });
    const hidden = diff(withPins(0x31, 0x41), withPins(0x32, 0x42));
    const sensitive = hidden.records
      .filter((r) => r.domainId === 'settings')
      .flatMap((r) => r.fields.filter((f) => f.sensitive));
    expect(sensitive.length).toBeGreaterThanOrEqual(2);
    expect(
      sensitive.every((f) => f.kind === 'changed' && f.a === undefined && f.b === undefined),
    ).toBe(true);
    const shown = diff(withPins(0x31, 0x41), withPins(0x32, 0x42), true);
    expect(
      shown.records
        .filter((r) => r.domainId === 'settings')
        .flatMap((r) => r.fields.filter((f) => f.sensitive && f.kind === 'changed'))
        .every((f) => f.a !== undefined && f.b !== undefined),
    ).toBe(true);
  });
});

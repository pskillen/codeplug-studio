import { describe, expect, it } from 'vitest';
import { RT95_CALIBRATION_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import type { DebugArchive } from './captureArchive.ts';
import { debugRadios, resolveLegacyDebugSlug, radioDebugDescriptors } from './descriptors.ts';
import { rt95Archive } from './rt95Archive.fixture.ts';
import { syntheticZip } from './uv5rMiniLegacyArchive.fixture.ts';
import { openUv5rMiniLegacyArchive } from './uv5rMiniLegacyArchive.ts';

const descriptor = (slug: string) => radioDebugDescriptors.find((d) => d.slug === slug)!;
const labels = (slug: string) =>
  descriptor(slug).identityRows!({ connection: 'Not connected', family: 'F' }).map(
    ([label]) => label,
  );

describe('radio and firmware addressing', () => {
  it('gives each (radio, firmware) pair once and keeps one model per radio key', () => {
    const pairs = radioDebugDescriptors.map((d) => `${d.radio}:${d.firmware}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const radio of new Set(radioDebugDescriptors.map((d) => d.radio))) {
      const models = new Set(
        radioDebugDescriptors.filter((d) => d.radio === radio).map((d) => d.model),
      );
      expect(models.size).toBe(1);
    }
  });

  it('resolves every slug and bare radio key', () => {
    const table: [string, string, string][] = [
      ['at-d890uv', 'at-d890uv', 'stock'],
      ['dm-32uv', 'dm-32uv', 'stock'],
      ['dm-32uv-radiofoundry', 'dm-32uv', 'radiofoundry'],
      ['dm-1701-radiofoundry', 'dm-1701', 'radiofoundry'],
      ['dm-1701-opengd77', 'dm-1701', 'opengd77'],
      ['md-9600-radiofoundry', 'md-9600', 'radiofoundry'],
      ['md-9600-opengd77', 'md-9600', 'opengd77'],
      ['rt84-radiofoundry', 'rt84', 'radiofoundry'],
      ['rt90-radiofoundry', 'rt90', 'radiofoundry'],
      ['rt95', 'rt95', 'stock'],
      ['uv-21-pro-v2', 'uv-21-pro-v2', 'stock'],
      ['uv-5r-mini', 'uv-5r-mini', 'stock'],
    ];
    for (const [slug, radio, firmware] of table) {
      expect(resolveLegacyDebugSlug(slug)).toEqual({ radio, firmware });
    }
    expect(resolveLegacyDebugSlug('md-9600')).toEqual({ radio: 'md-9600', firmware: 'opengd77' });
    expect(resolveLegacyDebugSlug('dm-32uv')?.firmware).toBe('stock');
    expect(resolveLegacyDebugSlug('rt84')?.firmware).toBe('radiofoundry');
  });

  it('lists each radio once in card order', () => {
    expect(debugRadios().map((r) => r.radio)).toEqual([
      'at-d890uv',
      'dm-32uv',
      'dm-1701',
      'md-9600',
      'rt84',
      'rt90',
      'rt95',
      'uv-21-pro-v2',
      'uv-5r-mini',
    ]);
  });
});

describe('descriptor fields that carry radio text for the shared page', () => {
  it('every radio with its own identity evidence builds its rows in its home', () => {
    expect(labels('at-d890uv')).toContain('Serial · captured LocalInfo');
    expect(labels('dm-32uv')).toContain('Model · captured PSEARCH');
    expect(labels('rt95')).toContain('PC ident [head]');
    expect(labels('dm-1701-opengd77')).toContain('Radio type · FirmwareInfo');
    expect(labels('uv-5r-mini')).toContain('Firmware mod');
  });

  it('carries the caption and the Backup notice for D890 and DM-32', () => {
    expect(descriptor('at-d890uv').identityNote).toMatch(/V100 is protocol evidence/);
    expect(descriptor('at-d890uv').readNotice?.title).toBe('Read-only capture and recovery');
    expect(descriptor('dm-32uv').identityNote).toMatch(/no readable serial/);
    expect(descriptor('dm-32uv').readNotice?.text).toMatch(/no END command/);
  });

  it('Coverage and decoded-compare facts sit on each radio descriptor, not in shared checks', () => {
    for (const slug of [
      'at-d890uv',
      'dm-32uv',
      'dm-1701-opengd77',
      'md-9600-opengd77',
      'rt95',
      'uv-5r-mini',
    ])
      expect(descriptor(slug).coverage, slug).toBeTypeOf('function');
    expect(descriptor('uv-21-pro-v2').coverage).toBeUndefined();
    for (const slug of [
      'at-d890uv',
      'dm-32uv',
      'dm-1701-opengd77',
      'md-9600-opengd77',
      'rt95',
      'uv-5r-mini',
    ])
      expect(descriptor(slug).compare?.decoded, slug).toBeTypeOf('function');
  });

  it('RT95 coverage has its clone summary line and a start label; it declines another radio', () => {
    const view = descriptor('rt95').coverage!(rt95Archive());
    expect(view?.body).toBeTruthy();
    expect(view?.omitCaptured).toBeFalsy();
    expect(descriptor('uv-5r-mini').coverage!(rt95Archive())).toBeUndefined();
  });

  it('only the Mini offers its wire bytes as an extra Hex region', () => {
    const archive = {
      manifest: { regions: [] },
      regions: {},
      sidecars: { 'debug/wire.bin': new Uint8Array([1, 2]) },
    } as unknown as DebugArchive;
    expect(descriptor('uv-5r-mini').extraHexRegions!(archive)).toEqual([
      { id: 'wire', label: 'Wire bytes as received', bytes: new Uint8Array([1, 2]) },
    ]);
    expect(
      descriptor('uv-5r-mini').extraHexRegions!({ ...archive, sidecars: {} } as DebugArchive),
    ).toEqual([]);
    for (const d of radioDebugDescriptors)
      if (d.slug !== 'uv-5r-mini') expect(d.extraHexRegions, d.slug).toBeUndefined();
  });

  it('RT95 reports clone coverage from the archive', () => {
    const rows = Object.fromEntries(
      descriptor('rt95').identityRows!({
        archive: rt95Archive(),
        connection: 'Read complete · disconnected',
        family: 'F',
      }),
    );
    expect(rows['Clone channels/settings [unknown]']).toBe('Captured in programming image');
    expect(rows['Evidence']).toBe('Archive manifest');
  });

  it('opens the Mini legacy reads ZIP, and declines anything else', () => {
    const open = descriptor('uv-5r-mini').openLegacyArchive!;
    expect(open(syntheticZip())).toHaveLength(1);
    expect(open(new Uint8Array([1, 2, 3]))).toBeUndefined();
    expect(descriptor('rt95').openLegacyArchive).toBeUndefined();
    expect(openUv5rMiniLegacyArchive(syntheticZip())?.[0]?.source).toBeDefined();
  });

  it('region notes tag RT95 regions and explain Mini addresses', () => {
    const archive = rt95Archive();
    expect(descriptor('rt95').regionNote!(archive, 'programming-image').tag).toBe('[unknown]');
    expect(descriptor('rt95').regionNote!(archive, RT95_CALIBRATION_REGION_ID).tag).toBe('[body]');
    const mini = descriptor('uv-5r-mini').regionNote!;
    expect(mini(archive, 'clone').representation).toBe('Decoded clone bytes');
    expect(mini(archive, 'mem-00').addressNote).toMatch(/packed offsets/);
    expect(mini(archive, 'zones')).toEqual({});
  });
});

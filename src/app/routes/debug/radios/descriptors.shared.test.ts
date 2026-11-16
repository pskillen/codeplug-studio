import { describe, expect, it } from 'vitest';
import { RT95_CALIBRATION_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { radioDebugDescriptors } from './descriptors.ts';
import { rt95Archive } from './rt95Archive.fixture.ts';
import { syntheticZip } from './uv5rMiniLegacyArchive.fixture.ts';
import { openUv5rMiniLegacyArchive } from './uv5rMiniLegacyArchive.ts';

const descriptor = (slug: string) => radioDebugDescriptors.find((d) => d.slug === slug)!;
const labels = (slug: string) =>
  descriptor(slug).identityRows!({ connection: 'Not connected', family: 'F' }).map(
    ([label]) => label,
  );

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

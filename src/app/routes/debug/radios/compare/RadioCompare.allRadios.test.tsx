import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
} from '@integrations/radio-io/backup/index.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { makeOpenGd77FirmwareInfoPayload } from '@integrations/radio-io/radios/opengd77/__fixtures__/scriptedPipe.ts';
import { buildOpenGd77DebugArchiveParts } from '@integrations/radio-io/radios/opengd77/debugCapture.ts';
import { OPENGD77_DM1701_MODEL_ID } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { createOpenUv380Image } from '@integrations/radio-io/radios/opengd77/memory.ts';
import { encodeUserDatabaseHeader } from '@integrations/radio-io/radios/opengd77/userDatabaseCodec.ts';
import { buildSyntheticRt95Image } from '@integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts';
import { encodeBcdFreq } from '@integrations/radio-io/radios/rt95/bcd.ts';
import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openDebugArchive, type DebugArchive } from '../captureArchive.ts';
import { radioDebugDescriptors } from '../descriptors.ts';
import { rt95Archive } from '../rt95Archive.fixture.ts';
import { RadioCompare } from './RadioCompare.tsx';

/** Every radio takes the one shared path: its descriptor's decoded snapshot, one list, one view. */
const descriptor = (slug: string) => radioDebugDescriptors.find((d) => d.slug === slug)!;
const show = (slug: string, a: DebugArchive, b: DebugArchive) =>
  render(
    <MantineProvider>
      <RadioCompare descriptor={descriptor(slug)} a={a} b={b} />
    </MantineProvider>,
  );
const changedRecords = () =>
  screen.getAllByRole('group').filter((g) => g.textContent?.includes('changed'));

describe('Compare shows decoded changes on every radio', () => {
  it('RT95: a changed channel', () => {
    const a = buildSyntheticRt95Image();
    const b = buildSyntheticRt95Image();
    b.set(encodeBcdFreq(146_540_000), 0);
    show('rt95', rt95Archive(a), rt95Archive(b));
    expect(changedRecords().length).toBeGreaterThan(0);
  });

  it('AT-D890UV: a changed setting is listed with its address', () => {
    const archive = (setting: number, trim: number) =>
      openDebugArchive(
        packRadioBackupZip(
          {
            format: RADIO_BACKUP_FORMAT,
            version: RADIO_BACKUP_VERSION,
            capturedAt: '2026-01-01',
            capturedVia: 'file',
            app: { buildEnv: 'test', buildVersion: 'test' },
            radioModelId: 'AT-D890UV',
            descriptorLabel: 'synthetic',
            coverage: 'partial',
            imageByteLength: 0x5000000,
            regions: [
              {
                id: 'sparse-main',
                label: 'main',
                address: D890_MAP.OptionalSettingsMain + 0x26,
                byteLength: 1,
                path: 'regions/sparse-main.bin',
                restoreRole: 'inspect-only',
              },
              {
                id: 'vital-tune-a',
                label: 'tune',
                address: 0x04f00000,
                byteLength: 3,
                path: 'regions/vital-tune-a.bin',
                restoreRole: 'inspect-only',
              },
            ],
          },
          { 'sparse-main': Uint8Array.of(setting), 'vital-tune-a': Uint8Array.of(trim, 7, 1) },
        ),
        'AT-D890UV',
      );
    show('at-d890uv', archive(1, 0xd0), archive(2, 0xd1));
    expect(screen.getAllByRole('columnheader', { name: 'Address' }).length).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) {
      const more = screen.queryByRole('button', { name: /^Show more/ });
      if (more) fireEvent.click(more);
    }
    expect(screen.getAllByText('0x03500026').length).toBeGreaterThan(0);
  });

  it('UV-5R Mini: a changed settings byte is listed with its address', () => {
    const image = (byte: number) => {
      const img = new Uint8Array(0x10000).fill(0xff);
      img[0x9001] = byte;
      return img;
    };
    const mini = (clone: Uint8Array) =>
      ({
        manifest: { radioModelId: 'UV-5R Mini', capturedAt: '2026-01-01', regions: [] },
        regions: { clone },
        sidecars: {},
        source: 'file',
      }) as unknown as DebugArchive;
    show('uv-5r-mini', mini(image(0)), mini(image(1)));
    expect(screen.getAllByText('0x00009001').length).toBeGreaterThan(0);
  });

  it('OpenGD77: a changed firmware revision is a decoded change', () => {
    const parts = (revision: string) => {
      const info = makeOpenGd77FirmwareInfoPayload(0x08, { features: 0x04 });
      info.fill(0, 8, 24);
      info.set(new TextEncoder().encode(revision), 8);
      return {
        ...buildOpenGd77DebugArchiveParts({
          modelId: OPENGD77_DM1701_MODEL_ID,
          capturedAt: '2026-01-01T00:00:00.000Z',
          capturedVia: 'web-serial',
          firmwareInfoRaw: info,
          calibrationWorkingCopy: new Uint8Array(512),
          settingsGap: new Uint8Array(0x60),
          image: createOpenUv380Image(),
          userDatabase: encodeUserDatabaseHeader(0),
        }),
        source: 'file',
      } as unknown as DebugArchive;
    };
    show('dm-1701-opengd77', parts('R1'), parts('R2'));
    expect(changedRecords().length).toBeGreaterThan(0);
  });
});

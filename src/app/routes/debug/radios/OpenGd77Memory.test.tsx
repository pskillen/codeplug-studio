import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import { encodeChannelsIntoImage } from '@integrations/radio-io/radios/opengd77/channelCodec.ts';
import { OPENGD77_BACKUP_FLASH_SPANS } from '@integrations/radio-io/radios/opengd77/backupRestoreRoles.ts';
import {
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
} from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { createOpenUv380Image, writeAbs } from '@integrations/radio-io/radios/opengd77/memory.ts';
import { encodeZonesIntoImage } from '@integrations/radio-io/radios/opengd77/zoneCodec.ts';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { OpenGd77Memory } from './OpenGd77Memory.tsx';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';

const channel = (
  slot: number,
  name: string,
  extra: Partial<RadioChannelDto> = {},
): RadioChannelDto => ({
  slotIndex: slot,
  empty: false,
  wireName: name,
  rxHz: 145_500_000,
  txHz: 145_600_000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: null,
  bandwidth: 'FM',
  mode: 'analog',
  location: null,
  useLocation: false,
  ...extra,
});

function image() {
  const img = createOpenUv380Image();
  encodeChannelsIntoImage(
    img,
    [
      channel(1, 'SIMPLEX'),
      channel(2, 'DIGI', { mode: 'digital', colorCode: 1, timeslot: 2, powerPercent: 80 }),
      channel(130, 'BANK ONE'),
    ],
    { clearUnlisted: true, powerSteps: undefined },
  );
  encodeZonesIntoImage(img, [
    { wireName: 'LOCAL', channelNumbers: [1, 1, 130, 5, 2000] },
    { wireName: '', channelNumbers: [2] },
  ]);
  return img;
}

const view = (archive?: DebugArchive) =>
  render(
    <MantineProvider>
      <OpenGd77Memory archive={archive} />
    </MantineProvider>,
  );

describe.each([OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID])(
  'OpenGd77Memory %s',
  (model) => {
    it('asks for a capture when there is none', () => {
      view();
      expect(screen.getByText('No capture')).toBeInTheDocument();
    });

    it('lists channels, searches and shows the directory sections', async () => {
      view(await syntheticOpenGd77Archive(model, { image: image() }));
      expect(screen.getByText('SIMPLEX')).toBeInTheDocument();
      expect(screen.getByText('BANK ONE')).toBeInTheDocument();
      expect(screen.getByText(/Occupied 3 ·/)).toBeInTheDocument();
      expect(screen.getByText(/1,024 binary slots/)).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('Search channels'), {
        target: { value: 'bank' },
      });
      expect(screen.queryByText('SIMPLEX')).not.toBeInTheDocument();
      expect(screen.getByText('BANK ONE')).toBeInTheDocument();
      for (const tab of ['Contacts', 'RX groups', 'User Database']) {
        fireEvent.click(screen.getByRole('tab', { name: tab }));
        expect(screen.queryByText('Coming in a later piece')).not.toBeInTheDocument();
      }
    });

    it("shows the model's own power ladder step", async () => {
      view(await syntheticOpenGd77Archive(model, { image: image() }));
      // channel 2 was encoded with the DM-1701 ladder (80% = step 8), so the wire step is 8
      expect(
        screen.getByText(model === OPENGD77_DM1701_MODEL_ID ? '80%' : '63%'),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Default').length).toBeGreaterThan(0);
    });

    it('lists a not captured bank once, not as rows', async () => {
      const full = await syntheticOpenGd77Archive(model, { image: image() });
      const spanId = OPENGD77_BACKUP_FLASH_SPANS[3]!.id;
      const manifest = {
        ...full.manifest,
        regions: full.manifest.regions.filter((r) => r.id !== spanId),
      };
      const regions = Object.fromEntries(
        Object.entries(full.regions).filter(([k]) => k !== spanId),
      );
      view(openDebugArchive(packRadioBackupZip(manifest, regions), model));
      expect(screen.getByText(/Bank 1, slots 129 to 256: not captured/)).toBeInTheDocument();
      expect(screen.getByText(/Bank 7, slots 897 to 1024: not captured/)).toBeInTheDocument();
      expect(screen.queryByText('BANK ONE')).not.toBeInTheDocument();
      expect(screen.getByText(/not captured 896/)).toBeInTheDocument();
    });

    it('shows channels and zones as not captured with only the User Database', async () => {
      const full = await syntheticOpenGd77Archive(model);
      const manifest = {
        ...full.manifest,
        regions: full.manifest.regions.filter((r) => r.id === 'user-database'),
      };
      view(
        openDebugArchive(
          packRadioBackupZip(manifest, { 'user-database': full.regions['user-database']! }),
          model,
        ),
      );
      expect(screen.getAllByText(/not captured/i).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('tab', { name: 'Zones' }));
      expect(screen.getByText('Not captured')).toBeInTheDocument();
    });

    it('lists zones, including unnamed, and explains each member', async () => {
      view(await syntheticOpenGd77Archive(model, { image: image() }));
      fireEvent.click(screen.getByRole('tab', { name: 'Zones' }));
      expect(screen.getByText('LOCAL')).toBeInTheDocument();
      expect(screen.getByText('Unnamed zone')).toBeInTheDocument();
      fireEvent.click(screen.getByText('LOCAL'));
      expect(screen.getByText(/Absent: the channel bitmap/)).toBeInTheDocument();
      expect(screen.getByText(/Out of range/)).toBeInTheDocument();
      expect(screen.getAllByText('SIMPLEX')).toHaveLength(2);
    });

    it('shows a read-only Settings view: decoded where captured, not captured elsewhere', async () => {
      const img = image();
      writeAbs(img, 0x604b, new Uint8Array([0x80, 0x47, 0x00, 0x00]));
      writeAbs(img, 0x6057, new Uint8Array([0xc0, 0x03]));
      writeAbs(img, 0xe0, new TextEncoder().encode('M0TEST'));
      view(await syntheticOpenGd77Archive(model, { image: img }));
      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
      expect(screen.getByText('Firmware settings, read-only')).toBeInTheDocument();
      expect(
        screen.getByText(
          model === OPENGD77_DM1701_MODEL_ID
            ? /Flash copy as of the last power-off or CPS save/
            : /Backup copy; the live copy is in backup SRAM/,
        ),
      ).toBeInTheDocument();
      const row = (id: string) => document.querySelector(`[data-row-id="${id}"]`) as HTMLElement;
      expect(row('setting-magicNumber').textContent).toContain('0x4780');
      expect(row('setting-timezone').textContent).toContain('UTC+00:00, local time shown');
      expect(row('setting-vfoScanHigh').textContent).toContain('Not captured');
      expect(row('setting-txPowerLevel').textContent).toContain('Not captured');
      expect(row('general-radioName').textContent).toContain('M0TEST');
      expect(row('general-sn').textContent).toContain('unused (no reader)');
    });

    it('does not name settings fields when the version is wrong', async () => {
      const img = image();
      writeAbs(img, 0x604b, new Uint8Array([0x76, 0x47, 0x00, 0x00]));
      view(await syntheticOpenGd77Archive(model, { image: img }));
      fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
      expect(screen.getByText('Firmware settings not decoded')).toBeInTheDocument();
      expect(document.querySelector('[data-row-id="setting-timezone"]')).toBeNull();
    });
  },
);

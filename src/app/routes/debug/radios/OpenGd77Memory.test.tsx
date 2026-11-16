import { MantineProvider } from '@mantine/core';
import { chooseCategory } from '@app/components/debug/memoryCategoriesTestUtils.ts';
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
import { openGd77SettingsView } from '@integrations/radio-io/radios/opengd77/debugSettingsView.ts';
import { SettingsTab } from './SettingsTab.tsx';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';
import { hexRows, sensitiveRanges } from './viewerUtils.ts';

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

/** The table row whose Setting cell starts with `label` (the help text follows it in the same cell). */
const row = (label: string) =>
  Array.from(document.querySelectorAll('tbody tr')).find(
    (tr) => tr.querySelector('td')?.firstChild?.textContent === label,
  ) as HTMLElement;

const viewSettings = (archive?: DebugArchive) =>
  render(
    <MantineProvider>
      <SettingsTab archive={archive} settings={openGd77SettingsView} />
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
        chooseCategory(tab);
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
      chooseCategory('Zones');
      expect(screen.getByText('Not captured')).toBeInTheDocument();
    });

    it('has no Settings tab: settings live on the page-level Settings tab', async () => {
      view(await syntheticOpenGd77Archive(model, { image: image() }));
      expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull();
    });

    it('lists zones, including unnamed, and explains each member', async () => {
      view(await syntheticOpenGd77Archive(model, { image: image() }));
      chooseCategory('Zones');
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
      // An older archive: no settings gap region, so the struct tail is not captured.
      viewSettings(await syntheticOpenGd77Archive(model, { image: img, settingsGap: null }));
      expect(screen.getByText(/not validated on hardware/)).toBeInTheDocument();
      expect(
        screen.getByText(
          model === OPENGD77_DM1701_MODEL_ID
            ? /Flash copy as of the last power-off or CPS save/
            : /Backup copy; the live copy is in backup SRAM/,
        ),
      ).toBeInTheDocument();
      expect(row('magicNumber').textContent).toContain('0x4780');
      expect(row('timezone').textContent).toContain('UTC+00:00, local time shown');
      expect(row('vfoScanHigh').textContent).toContain('Not captured');
      expect(row('txPowerLevel').textContent).toContain('Not captured');
      expect(row('radioName (callsign)').textContent).toContain('M0TEST');
      expect(row('sn').textContent).toContain('unused (no reader)');
    });

    it('decodes the struct tail from the settings gap region of a current archive', async () => {
      viewSettings(await syntheticOpenGd77Archive(model));
      expect(row('magicNumber').textContent).toContain('0x4780');
      expect(row('vfoScanHigh').textContent).not.toContain('Not captured');
      expect(row('txPowerLevel').textContent).not.toContain('Not captured');
    });

    it('does not name settings fields when the version is wrong', async () => {
      const img = image();
      writeAbs(img, 0x604b, new Uint8Array([0x76, 0x47, 0x00, 0x00]));
      viewSettings(await syntheticOpenGd77Archive(model, { image: img }));
      expect(screen.getByText(/Firmware settings not decoded/)).toBeInTheDocument();
      expect(screen.queryByText('timezone')).toBeNull();
    });
  },
);

describe.each([OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID])(
  'OpenGD77 passwords %s',
  (model) => {
    async function passwordArchive() {
      const img = image();
      writeAbs(img, 0x100, new TextEncoder().encode('PRG123'));
      writeAbs(img, 0x7519, new Uint8Array([0x01]));
      writeAbs(img, 0x751c, new Uint8Array([0x12, 0x34, 0xff]));
      return syntheticOpenGd77Archive(model, { image: img });
    }

    it('hides the boot PIN and prgPwd until Show password, then hides them again', async () => {
      viewSettings(await passwordArchive());
      expect(row('Boot password enabled').textContent).toContain('Enabled');
      expect(row('Boot password PIN').textContent).toContain('MD-9600 layout unconfirmed');
      fireEvent.click(screen.getByLabelText(/Show raw bytes/));
      for (const id of ['Boot password PIN', 'prgPwd (CPS programming password)']) {
        expect(row(id).textContent).toContain('Hidden (password)');
        expect(row(id).textContent).toContain('••');
      }
      expect(document.body.textContent).not.toContain('1234');
      expect(document.body.textContent).not.toContain('PRG123');
      expect(document.body.textContent).not.toContain('12 34 FF');
      fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
      expect(row('Boot password PIN').textContent).toContain('1234');
      expect(row('prgPwd (CPS programming password)').textContent).toContain('PRG123');
      fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
      expect(document.body.textContent).not.toContain('PRG123');
    });

    it('masks the same bytes in Hex through the descriptor hook and keeps the archive bytes', async () => {
      const archive = await passwordArchive();
      const before = structuredClone(
        Object.fromEntries(Object.entries(archive.regions).map(([k, v]) => [k, Array.from(v)])),
      );
      const found = archive.manifest.regions.flatMap((r) =>
        sensitiveRanges(archive, r.id).map(({ start, end }) => [start, end]),
      );
      expect(found).toEqual([
        [0x100, 0x108],
        [0x751c, 0x751f],
      ]);
      const holder = archive.manifest.regions.find((r) =>
        sensitiveRanges(archive, r.id).some((x) => x.start === 0x100),
      )!;
      const masked = hexRows(
        archive.regions[holder.id]!,
        holder.address,
        0,
        sensitiveRanges(archive, holder.id),
      ).find((r) => r.address === 0x100)!;
      expect(masked.hex).toContain('•• ••');
      expect(masked.hex).not.toMatch(/50 52 47/);
      expect(masked.ascii).not.toContain('PRG');
      expect(
        Object.fromEntries(Object.entries(archive.regions).map(([k, v]) => [k, Array.from(v)])),
      ).toEqual(before);
    });

    it('masks nothing for another radio', async () => {
      const archive = await passwordArchive();
      const other = { ...archive, manifest: { ...archive.manifest, radioModelId: 'DM-32UV' } };
      for (const r of other.manifest.regions) expect(sensitiveRanges(other, r.id)).toEqual([]);
    });
  },
);

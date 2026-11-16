import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import {
  handBuiltContactRecord,
  putContactRecord,
  syntheticDirectoryArchive,
  syntheticUserDatabaseRegion,
} from '@integrations/radio-io/radios/opengd77/__fixtures__/directories.ts';
import { OPENGD77_BACKUP_FLASH_SPANS } from '@integrations/radio-io/radios/opengd77/backupRestoreRoles.ts';
import { encodeContactsIntoImage } from '@integrations/radio-io/radios/opengd77/contactCodec.ts';
import { OPENUV380_OFFSET } from '@integrations/radio-io/radios/opengd77/constants.ts';
import {
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
} from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { createOpenUv380Image } from '@integrations/radio-io/radios/opengd77/memory.ts';
import { encodeRxGroupsIntoImage } from '@integrations/radio-io/radios/opengd77/rxGroupCodec.ts';
import { encodeUserDatabaseHeader } from '@integrations/radio-io/radios/opengd77/userDatabaseCodec.ts';
import { OpenGd77Memory } from './OpenGd77Memory.tsx';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';

const transport = vi.hoisted(() => ({ open: vi.fn(), request: vi.fn() }));
vi.mock('@integrations/radio-io/transport/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@integrations/radio-io/transport/index.ts')>()),
  requestWebSerialPort: transport.request,
  openWebSerialPipe: transport.open,
}));

function directoryImage() {
  const image = createOpenUv380Image();
  encodeContactsIntoImage(image, [
    { index: 1, wireName: 'TEST TG', digitalId: 9_999_999, callType: 0 },
    { index: 3, wireName: 'TEST PRIV', digitalId: 1_234_567, callType: 1 },
  ]);
  putContactRecord(image, 7, handBuiltContactRecord('ODD TYPE', '55', 9, 0x07));
  encodeRxGroupsIntoImage(
    image,
    [{ index: 2, wireName: 'TEST GROUP', memberDigitalIds: [9_999_999, 1_234_567] }],
    new Map([
      [9_999_999, 1],
      [1_234_567, 3],
    ]),
  );
  return image;
}

const archiveOf = (
  model: string,
  image = directoryImage(),
  userDatabase = syntheticUserDatabaseRegion(5),
): DebugArchive => {
  const a = syntheticDirectoryArchive(image, userDatabase, model);
  return openDebugArchive(packRadioBackupZip(a.manifest, a.regions), model);
};

const view = (archive?: DebugArchive) =>
  render(
    <MantineProvider>
      <OpenGd77Memory archive={archive} />
    </MantineProvider>,
  );

const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const bodyRows = () => screen.getAllByRole('row').length;

describe.each([OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID])(
  'OpenGd77 directories %s',
  (model) => {
    it('lists contacts one-based with call types and Unknown kept raw', () => {
      view(archiveOf(model));
      expect(screen.queryByText('Coming in a later piece')).not.toBeInTheDocument();
      tab('Contacts');
      expect(screen.getByText('TEST TG')).toBeInTheDocument();
      expect(screen.getByText(/3 captured of 1,024 contact slots/)).toBeInTheDocument();
      expect(screen.getByText('Group')).toBeInTheDocument();
      expect(screen.getByText('Private')).toBeInTheDocument();
      expect(screen.getByText('Unknown (9)')).toBeInTheDocument();
      expect(screen.getByText('0x07')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText('Search contacts'), {
        target: { value: '1234567' },
      });
      expect(screen.queryByText('TEST TG')).not.toBeInTheDocument();
      expect(screen.getByText('TEST PRIV')).toBeInTheDocument();
    });

    it('says Not captured, never zero rows, for a missing contact bank', () => {
      const a = syntheticDirectoryArchive(directoryImage(), undefined, model);
      const id = OPENGD77_BACKUP_FLASH_SPANS.find(
        (s) =>
          OPENUV380_OFFSET.contacts >= s.start && OPENUV380_OFFSET.contacts < s.start + s.length,
      )!.id;
      const manifest = { ...a.manifest, regions: a.manifest.regions.filter((r) => r.id !== id) };
      const regions = Object.fromEntries(Object.entries(a.regions).filter(([k]) => k !== id));
      view(openDebugArchive(packRadioBackupZip(manifest, regions), model));
      tab('Contacts');
      expect(screen.getByText('Not captured')).toBeInTheDocument();
      expect(screen.queryByText(/contact slots/)).not.toBeInTheDocument();
    });

    it('shows RX group members with the resolved count and unresolved reasons', () => {
      const image = directoryImage();
      putContactRecord(image, 3, new Uint8Array(24).fill(0xff));
      view(archiveOf(model, image));
      tab('RX groups');
      expect(screen.getByText(/1 of 76 RX group lists in use/)).toBeInTheDocument();
      fireEvent.click(screen.getByText('TEST GROUP'));
      const region = screen.getByRole('region', { name: 'RX group 2 members' });
      expect(within(region).getByText('1 of 2 members resolved')).toBeInTheDocument();
      expect(within(region).getByText('Unresolved: contact slot is empty')).toBeInTheDocument();
    });

    it('pages the User Database at 100 rows with true flash addresses', () => {
      view(archiveOf(model, directoryImage(), syntheticUserDatabaseRegion(9_710)));
      tab('User Database');
      expect(screen.getByText('Valid header')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 98/)).toBeInTheDocument();
      expect(screen.getByText('0x0005000C')).toBeInTheDocument();
      expect(bodyRows()).toBeLessThanOrEqual(101 + 1);
      expect(screen.getByText(/Entries are stored packed in this archive/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText(/Page 2 of 98/)).toBeInTheDocument();
      // Entry 9,708 (ID 1009709) is the first one in segment 1; a search reaches it in one render.
      fireEvent.change(screen.getByLabelText('Search the User Database'), {
        target: { value: '1009709' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      expect(screen.getByText('0x000D8000')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    });

    it('searches by ID prefix and by text, capping at 200', () => {
      view(archiveOf(model, directoryImage(), syntheticUserDatabaseRegion(20_000)));
      tab('User Database');
      expect(screen.getByText(/Page 1 of 200/)).toBeInTheDocument();
      expect(bodyRows()).toBeLessThanOrEqual(102);
      fireEvent.change(screen.getByLabelText('Search the User Database'), {
        target: { value: '1000005' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      expect(screen.getByText('TEST 4')).toBeInTheDocument();
      expect(screen.getByText(/1 matching entries/)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Search by'), { target: { value: 'text' } });
      fireEvent.change(screen.getByLabelText('Search the User Database'), {
        target: { value: 'test' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      expect(screen.getByText(/Showing the first 200 matches/)).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
      expect(bodyRows()).toBeLessThanOrEqual(102);

      fireEvent.change(screen.getByLabelText('Search the User Database'), {
        target: { value: 'NOPE' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Search' }));
      expect(screen.getByText(/No entries match/)).toBeInTheDocument();
    });

    it('reports invalid header, empty, truncated and capped states', () => {
      const invalid = new Uint8Array(12).fill(0xff);
      const { unmount } = view(archiveOf(model, directoryImage(), invalid));
      tab('User Database');
      expect(screen.getByText('Invalid header')).toBeInTheDocument();
      expect(screen.getByText('ff ff ff ff ff ff ff ff ff ff ff ff')).toBeInTheDocument();
      unmount();

      const { unmount: u2 } = view(archiveOf(model, directoryImage(), encodeUserDatabaseHeader(0)));
      tab('User Database');
      expect(screen.getByText('Valid header')).toBeInTheDocument();
      expect(screen.getByText(/no captured entries/)).toBeInTheDocument();
      u2();

      const short = syntheticUserDatabaseRegion(3);
      short.set(encodeUserDatabaseHeader(50));
      view(archiveOf(model, directoryImage(), short));
      tab('User Database');
      expect(screen.getByText('Truncated')).toBeInTheDocument();
      expect(screen.getByText(/stored bytes end early/)).toBeInTheDocument();
    });

    it('refuses a User Database region with a wrong address and reads absent as not captured', () => {
      const a = syntheticDirectoryArchive(directoryImage(), syntheticUserDatabaseRegion(2), model);
      const bad = {
        ...a.manifest,
        regions: a.manifest.regions.map((r) =>
          r.id === 'user-database' ? { ...r, address: r.address + 4 } : r,
        ),
      };
      const { unmount } = view(openDebugArchive(packRadioBackupZip(bad, a.regions), model));
      tab('User Database');
      expect(screen.getByText('Refused')).toBeInTheDocument();
      unmount();
      const none = {
        ...a.manifest,
        regions: a.manifest.regions.filter((r) => r.id !== 'user-database'),
      };
      const regions = Object.fromEntries(
        Object.entries(a.regions).filter(([k]) => k !== 'user-database'),
      );
      view(openDebugArchive(packRadioBackupZip(none, regions), model));
      tab('User Database');
      expect(screen.getByText('Not captured')).toBeInTheDocument();
    });

    it('resets everything when the archive is replaced, and opens no transport', () => {
      const { rerender } = view(
        archiveOf(model, directoryImage(), syntheticUserDatabaseRegion(300)),
      );
      tab('User Database');
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
      rerender(
        <MantineProvider>
          <OpenGd77Memory
            archive={archiveOf(model, directoryImage(), syntheticUserDatabaseRegion(10))}
          />
        </MantineProvider>,
      );
      tab('User Database');
      expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
      expect(screen.getByLabelText('Search the User Database')).toHaveValue('');
      expect(transport.open).not.toHaveBeenCalled();
      expect(transport.request).not.toHaveBeenCalled();
    });

    it('refuses an archive of the other model when it is opened', () => {
      const other =
        model === OPENGD77_DM1701_MODEL_ID ? OPENGD77_MD9600_MODEL_ID : OPENGD77_DM1701_MODEL_ID;
      const a = syntheticDirectoryArchive(directoryImage(), undefined, other);
      expect(() => openDebugArchive(packRadioBackupZip(a.manifest, a.regions), model)).toThrow();
    });
  },
);

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Dm32DebugCapture } from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { dm32Capture, dm32Page } from './dm32Archive.fixture.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import { Dm32Memory } from './Dm32Memory.tsx';
import { Dm32Settings } from './Dm32Settings.tsx';

const bcd = (digits: string) =>
  digits
    .match(/../g)!
    .map((p) => parseInt(p, 16))
    .reverse();

function record(name: string, rx: string): Uint8Array {
  const r = new Uint8Array(48);
  r.set(new TextEncoder().encode(name), 0);
  r.set(bcd(rx), 0x10);
  r.set(bcd(rx), 0x14);
  r[0x19] = 0x82;
  return r;
}

/** One channel page holding the given names (slots 1..n), count n. */
function channelCapture(names: string[]): Dm32DebugCapture {
  const page = dm32Page(0x12);
  page[0] = names.length;
  names.forEach((n, i) => page.set(record(n, '14500000'), 0x10 + i * 48));
  return dm32Capture({ blocks: new Map([[0x1000, page]]) });
}

function show(archive?: DebugArchive) {
  const ui = (a?: DebugArchive) => (
    <MantineProvider>
      <Dm32Memory archive={a} />
    </MantineProvider>
  );
  const view = render(ui(archive));
  return { ...view, replace: (a?: DebugArchive) => view.rerender(ui(a)) };
}

function showSettings(archive?: DebugArchive) {
  const ui = (a?: DebugArchive) => (
    <MantineProvider>
      <Dm32Settings archive={a} />
    </MantineProvider>
  );
  const view = render(ui(archive));
  return { ...view, replace: (a?: DebugArchive) => view.rerender(ui(a)) };
}

describe('Dm32Memory', () => {
  it('has no Settings tab: settings live on the page-level Settings tab', async () => {
    show(await archiveDm32Capture(channelCapture(['A'])));
    expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull();
  });

  it('asks for a capture when there is none', () => {
    show();
    expect(screen.getByText('No capture')).toBeInTheDocument();
  });

  it('lists channels with the single name field and says callsign data is unavailable', async () => {
    show(await archiveDm32Capture(channelCapture(['MM9PDY Hub', 'GB3XX'])));
    expect(screen.getByText('MM9PDY Hub')).toBeInTheDocument();
    expect(screen.getByText('GB3XX')).toBeInTheDocument();
    expect(screen.getAllByText('145.00000').length).toBeGreaterThan(0);
    expect(screen.getByText(/separate callsign and name data is unavailable/i)).toBeInTheDocument();
  });

  it('searches the label and sorts temporarily by identity', async () => {
    show(await archiveDm32Capture(channelCapture(['BRAVO', 'ALPHA', 'CHARLIE'])));
    fireEvent.change(screen.getByPlaceholderText('Search channels'), { target: { value: 'alp' } });
    expect(screen.getByText('ALPHA')).toBeInTheDocument();
    expect(screen.queryByText('BRAVO')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Search channels'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Identity/ }));
    const names = screen
      .getAllByRole('row')
      .map((r) => r.textContent ?? '')
      .filter((t) => /ALPHA|BRAVO|CHARLIE/.test(t))
      .map((t) => /ALPHA|BRAVO|CHARLIE/.exec(t)![0]);
    expect(names).toEqual(['ALPHA', 'BRAVO', 'CHARLIE']);
  });

  it('resets search when the archive is replaced', async () => {
    const view = show(await archiveDm32Capture(channelCapture(['ONE', 'TWO'])));
    fireEvent.change(screen.getByPlaceholderText('Search channels'), { target: { value: 'two' } });
    view.replace(await archiveDm32Capture(channelCapture(['ONE', 'TWO'])));
    expect(screen.getByPlaceholderText('Search channels')).toHaveValue('');
  });

  it('shows Not captured and page-order caveats, never zero channels', async () => {
    // No channel page captured.
    show(
      await archiveDm32Capture(
        dm32Capture({
          blocks: new Map([[0x2000, dm32Page(0x03)]]),
          discovered: [
            { address: 0x1000, metadata: 0x12, type: 'channel' },
            { address: 0x2000, metadata: 0x03, type: 'unknown' },
          ],
        }),
      ),
    );
    expect(screen.getByText('Not captured')).toBeInTheDocument();
    expect(screen.getByText(/does not mean the radio has no channels/i)).toBeInTheDocument();
  });

  it('refuses a wrong-model archive', async () => {
    const archive = await archiveDm32Capture(channelCapture(['A']));
    const wrong = {
      ...archive,
      manifest: { ...archive.manifest, radioModelId: 'AT-D890UV' },
    } as DebugArchive;
    show(wrong);
    expect(screen.getByText('Not a DM-32UV capture')).toBeInTheDocument();
    expect(openDebugArchive).toBeDefined();
  });

  /** A channel page plus a settings page tagged 0x04 (and optionally a second one). */
  function settingsCapture(
    edit: (p: Uint8Array) => void = () => {},
    extraSettingsPages = 0,
  ): Dm32DebugCapture {
    const channels = dm32Page(0x12);
    const settings = dm32Page(0x04);
    edit(settings);
    const blocks = new Map<number, Uint8Array>([
      [0x1000, channels],
      [0x2000, settings],
    ]);
    const discovered: Dm32DebugCapture['discovered'] = [
      { address: 0x1000, metadata: 0x12, type: 'channel' },
      { address: 0x2000, metadata: 0x04, type: 'unknown' },
    ];
    for (let n = 0; n < extraSettingsPages; n++) {
      blocks.set(0x3000 + n * 0x1000, dm32Page(0x04));
      discovered.push({ address: 0x3000 + n * 0x1000, metadata: 0x04, type: 'unknown' });
    }
    return dm32Capture({
      discovered,
      window: { start: 0x1000, end: 0x3000 + extraSettingsPages * 0x1000 },
      rawRange: { start: 0x1000, end: 0x3fff + extraSettingsPages * 0x1000 },
      blocks,
    });
  }

  it('says Not captured when there is no 0x04 page, and keeps the other tabs', async () => {
    const archive = await archiveDm32Capture(channelCapture(['A']));
    showSettings(archive);
    expect(screen.getByText('Not captured')).toBeInTheDocument();
    cleanup();
    show(archive);
    for (const name of ['Zones', 'Scan lists', 'Talk groups', 'RX groups', 'Radio IDs', 'Contacts'])
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
  });

  it('refuses to decode several 0x04 pages and lists them', async () => {
    showSettings(await archiveDm32Capture(settingsCapture(() => {}, 1)));
    expect(screen.getByText('Several pages, not decoded')).toBeInTheDocument();
    expect(screen.getByText(/Several pages tagged 0x04, not decoded/)).toBeInTheDocument();
    expect(screen.queryByText('Auto power off')).toBeNull();
  });

  it('shows grouped settings, raw bytes with addresses on demand, and the exclusion', async () => {
    showSettings(
      await archiveDm32Capture(
        settingsCapture((p) => {
          p[0x1e] = 3;
          p[0x8d] = 43;
          p[0x200] = 0x05;
          p[0x94] = 0xee;
        }),
      ),
    );
    for (const g of [
      'Display',
      'Tones & alerts',
      'Power & battery',
      'Keys & buttons',
      'GPS / APRS',
      'DMR & calls',
      'Privacy / lock',
    ])
      expect(screen.getByRole('region', { name: g })).toBeInTheDocument();
    expect(screen.getByText('120 minutes')).toBeInTheDocument();
    expect(screen.getByText('Function 43 (43)')).toBeInTheDocument();
    expect(screen.queryByText('Address')).toBeNull();
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    expect(screen.getByText('0x0000201E')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Documented, not decoded' })).toHaveTextContent(
      /One-touch call.*05 00/,
    );
    expect(screen.getByRole('region', { name: 'Unused bytes' })).toHaveTextContent(
      /Unused \(no reader\).*0x00002094 \+3: EE 00 00/,
    );
    expect(screen.getByRole('region', { name: 'Unknown bytes' })).toHaveTextContent(
      'No unexplained captured bytes.',
    );
    expect(screen.getByText(/stock DM32.01.L01.048 layout/)).toBeInTheDocument();
    expect(
      screen.getByText(/Emergency systems and encryption keys are outside/),
    ).toBeInTheDocument();
  });

  it('masks the three passwords by default, reveals them on request, and re-hides on a new archive', async () => {
    const withPasswords = () =>
      settingsCapture((p) => {
        p[0x430] = 0xa5;
        p.set(new TextEncoder().encode('12345678'), 0x431);
        p.set(new TextEncoder().encode('87654321'), 0x43b);
        p.set(new TextEncoder().encode('11223344'), 0x443);
      });
    const view = showSettings(await archiveDm32Capture(withPasswords()));
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    expect(screen.getAllByText('Hidden (password)')).toHaveLength(3);
    for (const secret of ['12345678', '87654321', '11223344', '31 32 33'])
      expect(screen.queryByText(new RegExp(secret))).toBeNull();
    const table = screen.getByRole('table', { name: 'Privacy / lock settings' });
    expect(table).toHaveTextContent('•• •• •• •• •• •• •• ••');
    // searching the secret finds nothing while hidden
    const search = screen.getByPlaceholderText('Search settings');
    fireEvent.change(search, { target: { value: '12345678' } });
    expect(screen.queryByText('Power-on password')).toBeNull();
    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByText('12345678')).toBeInTheDocument();
    expect(screen.getByText('87654321')).toBeInTheDocument();
    expect(screen.getByText('11223344')).toBeInTheDocument();
    view.replace(await archiveDm32Capture(withPasswords()));
    expect(screen.getAllByText('Hidden (password)')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('searches label, group and raw hex', async () => {
    showSettings(await archiveDm32Capture(settingsCapture((p) => (p[0x1e] = 3))));
    const search = screen.getByPlaceholderText('Search settings');
    fireEvent.change(search, { target: { value: 'power & battery' } });
    expect(screen.getByText('Auto power off')).toBeInTheDocument();
    expect(screen.queryByText('Key lock')).toBeNull();
    fireEvent.change(search, { target: { value: 'zzzz' } });
    expect(screen.queryByText('Auto power off')).toBeNull();
    fireEvent.change(search, { target: { value: '' } });
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    fireEvent.change(search, { target: { value: '03' } });
    expect(screen.getByText('Auto power off')).toBeInTheDocument();
  });

  it('resets the settings search and raw toggle when the archive is replaced', async () => {
    const view = showSettings(await archiveDm32Capture(settingsCapture()));
    fireEvent.change(screen.getByPlaceholderText('Search settings'), { target: { value: 'gps' } });
    fireEvent.click(screen.getByLabelText('Show raw bytes + address'));
    view.replace(await archiveDm32Capture(settingsCapture()));
    expect(screen.getByPlaceholderText('Search settings')).toHaveValue('');
    expect(screen.getByLabelText('Show raw bytes + address')).not.toBeChecked();
  });

  it('is keyboard reachable at 375 px', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    showSettings(await archiveDm32Capture(settingsCapture()));
    const toggle = screen.getByLabelText('Show raw bytes + address');
    toggle.focus();
    expect(toggle).toHaveFocus();
    expect(screen.getByRole('table', { name: 'Power & battery settings' })).toBeInTheDocument();
  });

  /** Channels ONE, TWO; zones Alpha [2, 1, 1, 9] and Beta []; scan list "Scan" [2]. */
  function listsCapture(): Dm32DebugCapture {
    const channels = dm32Page(0x12);
    channels[0] = 2;
    channels.set(record('ONE', '14500000'), 0x10);
    channels.set(record('TWO', '14600000'), 0x10 + 48);
    channels[0x10 + 0x19] = 0x01; // scan list 1
    const zones = dm32Page(0x5c);
    zones.fill(0xff, 16, 4095);
    zones[0] = 2;
    const put = (i: number, name: string, members: number[]) => {
      const off = 16 + i * 145;
      zones.fill(0xff, off, off + 145);
      zones.set(new TextEncoder().encode(name), off);
      zones[off + name.length] = 0;
      zones[off + 16] = members.length;
      members.forEach((m, k) => {
        zones[off + 17 + k * 2] = m;
        zones[off + 18 + k * 2] = 0;
      });
    };
    put(0, 'Alpha', [2, 1, 1, 9]);
    put(1, 'Beta', []);
    const scan = dm32Page(0x11);
    scan[0] = 1;
    scan.set(new TextEncoder().encode('Scan'), 1);
    scan[1 + 0x0b] = 2;
    scan[1 + 0x1a] = 2;
    return dm32Capture({
      discovered: [
        { address: 0x1000, metadata: 0x12, type: 'channel' },
        { address: 0x2000, metadata: 0x5c, type: 'unknown' },
        { address: 0x3000, metadata: 0x11, type: 'unknown' },
      ],
      window: { start: 0x1000, end: 0x3000 },
      rawRange: { start: 0x1000, end: 0x3fff },
      blocks: new Map([
        [0x1000, channels],
        [0x2000, zones],
        [0x3000, scan],
      ]),
    });
  }

  it('lists zones, resolves members of the selected zone, searches and sorts', async () => {
    show(await archiveDm32Capture(listsCapture()));
    fireEvent.click(screen.getByRole('tab', { name: 'Zones' }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Alpha'));
    const region = screen.getByRole('region', { name: 'Zone 1 members' });
    expect(region).toHaveTextContent('TWO');
    expect(region).toHaveTextContent('Not captured: that channel record was not read');
    fireEvent.change(screen.getByPlaceholderText('Search zones'), { target: { value: 'beta' } });
    expect(screen.queryByText('Alpha')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Search zones'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('lists scan lists and resolves the channel scan list id', async () => {
    show(await archiveDm32Capture(listsCapture()));
    expect(screen.getByText('1: Scan')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Scan lists' }));
    fireEvent.click(screen.getByText('Scan'));
    const region = screen.getByRole('region', { name: 'Scan list 1 members' });
    expect(region).toHaveTextContent('TWO');
    expect(region).toHaveTextContent('+0x0D (hang)');
  });

  it('says zones are not captured rather than empty, and resets selection on replace', async () => {
    const view = show(await archiveDm32Capture(listsCapture()));
    fireEvent.click(screen.getByRole('tab', { name: 'Zones' }));
    fireEvent.click(screen.getByText('Alpha'));
    view.replace(
      await archiveDm32Capture(
        dm32Capture({
          discovered: [
            { address: 0x1000, metadata: 0x12, type: 'channel' },
            { address: 0x2000, metadata: 0x5c, type: 'unknown' },
          ],
        }),
      ),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Zones' }));
    expect(screen.getByText(/does not mean the radio has no zones/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Zone 1 members' })).toBeNull();
  });

  const tg = (name: string, id: number, type: number) => {
    const e = new Array<number>(24).fill(0);
    new TextEncoder().encode(name).forEach((b, i) => (e[1 + i] = b));
    e[18] = id & 0xff;
    e[19] = (id >> 8) & 0xff;
    e[20] = (id >> 16) & 0xff;
    e[21] = type;
    return e;
  };

  /** Talk groups Zeta/Alpha, quick-access count 5, radio IDs Zulu/Echo, two analogue records. */
  function contactsCapture(): Dm32DebugCapture {
    const talk = dm32Page(0x44);
    talk.set(tg('Zeta', 9, 4), 1);
    talk.set(tg('Alpha', 235, 3), 25);
    const quick = dm32Page(0x0b);
    quick[0] = 5;
    const ids = dm32Page(0x67);
    ids[0] = 2;
    ids.set([1, 0, 0, ...new TextEncoder().encode('Zulu')], 0x10);
    ids.set([2, 0, 0, ...new TextEncoder().encode('Echo')], 0x20);
    const analog = dm32Page(0x06);
    analog[0x1ff] = 2;
    analog.fill(0xab, 0x200, 0x220);
    return dm32Capture({
      discovered: [
        { address: 0x1000, metadata: 0x12, type: 'channel' },
        { address: 0x2000, metadata: 0x44, type: 'unknown' },
        { address: 0x3000, metadata: 0x0b, type: 'unknown' },
        { address: 0x4000, metadata: 0x67, type: 'unknown' },
        { address: 0x5000, metadata: 0x06, type: 'unknown' },
      ],
      window: { start: 0x1000, end: 0x5000 },
      rawRange: { start: 0x1000, end: 0x5fff },
      blocks: new Map([
        [0x1000, dm32Page(0x12)],
        [0x2000, talk],
        [0x3000, quick],
        [0x4000, ids],
        [0x5000, analog],
      ]),
    });
  }

  const rowNames = (names: string[]) =>
    screen
      .getAllByRole('row')
      .map((r) => names.find((n) => (r.textContent ?? '').includes(n)))
      .filter(Boolean);

  it('lists talk groups, flags the count mismatch, searches by name and ID, sorts, resets', async () => {
    const view = show(await archiveDm32Capture(contactsCapture()));
    fireEvent.click(screen.getByRole('tab', { name: 'Talk groups' }));
    expect(screen.getByText('Zeta')).toBeInTheDocument();
    expect(screen.getByText(/Stored count differs/)).toBeInTheDocument();
    expect(screen.getByText(/layout not established/)).toBeInTheDocument();
    expect(screen.getByText(/callsign data is unavailable/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search talk groups'), {
      target: { value: '235' },
    });
    expect(screen.queryByText('Zeta')).toBeNull();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search talk groups'), { target: { value: '' } });
    expect(rowNames(['Zeta', 'Alpha'])).toEqual(['Zeta', 'Alpha']);
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(rowNames(['Zeta', 'Alpha'])).toEqual(['Alpha', 'Zeta']);
    fireEvent.change(screen.getByPlaceholderText('Search talk groups'), {
      target: { value: 'zz' },
    });
    view.replace(await archiveDm32Capture(contactsCapture()));
    fireEvent.click(screen.getByRole('tab', { name: 'Talk groups' }));
    expect(screen.getByPlaceholderText('Search talk groups')).toHaveValue('');
    expect(rowNames(['Zeta', 'Alpha'])).toEqual(['Zeta', 'Alpha']);
  });

  it('lists radio IDs with search and sort', async () => {
    show(await archiveDm32Capture(contactsCapture()));
    fireEvent.click(screen.getByRole('tab', { name: 'Radio IDs' }));
    expect(rowNames(['Zulu', 'Echo'])).toEqual(['Zulu', 'Echo']);
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(rowNames(['Zulu', 'Echo'])).toEqual(['Echo', 'Zulu']);
    fireEvent.change(screen.getByPlaceholderText('Search radio IDs'), { target: { value: 'zul' } });
    expect(screen.queryByText('Echo')).toBeNull();
  });

  it('says the address book is not captured and shows analogue records raw', async () => {
    show(await archiveDm32Capture(contactsCapture()));
    fireEvent.click(screen.getByRole('tab', { name: 'Contacts' }));
    expect(
      screen.getByText('Digital address book (V-frame 0x0F bank): not captured'),
    ).toBeInTheDocument();
    expect(screen.getByText(/the radio states 2/)).toBeInTheDocument();
    expect(screen.getAllByText(/AB AB AB/)).toHaveLength(1); // record 2 is all zeros
  });

  it('says Not captured for talk groups, radio IDs and contacts, never none', async () => {
    show(await archiveDm32Capture(channelCapture(['A'])));
    for (const [tab, noun] of [
      ['Talk groups', 'talk groups'],
      ['Radio IDs', 'radio IDs'],
      ['Contacts', 'analogue contacts'],
    ]) {
      fireEvent.click(screen.getByRole('tab', { name: tab! }));
      expect(
        screen.getByText(new RegExp(`does not mean the radio has no ${noun}`)),
      ).toBeInTheDocument();
    }
  });

  /** Digital channel ONE (RX group 2, radio ID 0, TX contact 1); RX groups Zulu (slot 2) and Alpha (slot 5). */
  function referencesCapture(): Dm32DebugCapture {
    const base = contactsCapture();
    const channels = dm32Page(0x12);
    channels[0] = 1;
    const rec = record('ONE', '14500000');
    rec[0x18] = 0x10;
    rec[0x1f] = 2;
    rec[0x2b] = 0;
    channels.set(rec, 0x10);
    const tx = dm32Page(0x42);
    tx[0] = 0x01;
    tx[1] = 1;
    const rx = dm32Page(0x0f);
    const put = (slot: number, name: string, ids: number[]) => {
      rx[0] |= 1 << (slot - 1);
      const off = 0x11 + (slot - 1) * 109;
      rx.set(new TextEncoder().encode(name), off);
      ids.forEach((id, i) => (rx[off + 0x0b + i * 3] = id));
    };
    put(2, 'Zulu', [9, 9, 77]);
    put(5, 'Alpha', [235]);
    return {
      ...base,
      discovered: [
        ...base.discovered,
        { address: 0x6000, metadata: 0x42, type: 'unknown' },
        { address: 0x7000, metadata: 0x0f, type: 'unknown' },
      ],
      window: { start: 0x1000, end: 0x7000 },
      rawRange: { start: 0x1000, end: 0x7fff },
      blocks: new Map([...base.blocks, [0x1000, channels], [0x6000, tx], [0x7000, rx]]),
    };
  }

  it('lists RX groups with holes, members, matches, search, sort and reset', async () => {
    const view = show(await archiveDm32Capture(referencesCapture()));
    fireEvent.click(screen.getByRole('tab', { name: 'RX groups' }));
    expect(screen.getByText(/occupied slots: 2, 5/)).toBeInTheDocument();
    expect(rowNames(['Zulu', 'Alpha'])).toEqual(['Zulu', 'Alpha']);
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(rowNames(['Zulu', 'Alpha'])).toEqual(['Alpha', 'Zulu']);
    fireEvent.click(screen.getByText('Zulu'));
    const region = screen.getByRole('region', { name: 'RX group 2 members' });
    expect(region).toHaveTextContent('Zeta (talk group 1, matched by DMR ID)');
    expect(region).toHaveTextContent('No decoded talk group has this DMR ID');
    expect(region).toHaveTextContent('Empty');
    expect(region).toHaveTextContent('No time-slot store');
    fireEvent.change(screen.getByPlaceholderText('Search RX groups'), { target: { value: '235' } });
    expect(screen.queryByText('Zulu')).toBeNull();
    view.replace(await archiveDm32Capture(referencesCapture()));
    fireEvent.click(screen.getByRole('tab', { name: 'RX groups' }));
    expect(screen.getByPlaceholderText('Search RX groups')).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'RX group 2 members' })).toBeNull();
  });

  it('resolves channel references and lists what refers to a talk group', async () => {
    show(await archiveDm32Capture(referencesCapture()));
    expect(screen.getByText('1: Zeta')).toBeInTheDocument();
    expect(
      screen.getByText(/2: Zulu \(assumed 1-based; not verified on hardware\)/),
    ).toBeInTheDocument();
    expect(screen.getByText('0: Zulu (1)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Talk groups' }));
    fireEvent.click(screen.getByText('Zeta'));
    const region = screen.getByRole('region', { name: 'Talk group 1 referenced by' });
    expect(region).toHaveTextContent('Channel 1 · ONE (TX contact)');
    expect(region).toHaveTextContent('RX group 2 · Zulu (member by DMR ID)');
    expect(screen.getByText(/Referenced by counts only captured/)).toBeInTheDocument();
  });

  it('says RX groups are not captured, never none, and marks Referenced by partial', async () => {
    show(await archiveDm32Capture(contactsCapture()));
    fireEvent.click(screen.getByRole('tab', { name: 'RX groups' }));
    expect(screen.getByText(/does not mean the radio has no RX groups/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Talk groups' }));
    expect(screen.getByText(/Partial: .*RX groups were not captured/)).toBeInTheDocument();
  });
});

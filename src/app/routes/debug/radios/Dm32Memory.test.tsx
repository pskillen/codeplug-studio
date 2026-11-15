import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Dm32DebugCapture } from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { dm32Capture, dm32Page } from './dm32Archive.fixture.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import { Dm32Memory } from './Dm32Memory.tsx';

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

describe('Dm32Memory', () => {
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

  it('shows placeholders for sections not yet decoded', async () => {
    show(await archiveDm32Capture(channelCapture(['A'])));
    fireEvent.click(screen.getByRole('tab', { name: 'Zones' }));
    expect(screen.getByText('Not yet available')).toBeInTheDocument();
    for (const name of ['Scan lists', 'Talk groups', 'RX groups', 'Contacts', 'Settings'])
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
  });
});

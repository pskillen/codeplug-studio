import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '@integrations/radio-io/radios/dm32uv/calibrationDecode.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import {
  dm32CalibrationCapture,
  dm32Capture,
  dm32FactoryBytes,
  dm32GoldenCalibrationPage,
  dm32Page,
} from './dm32Archive.fixture.ts';
import { Dm32Calibration } from './Dm32Calibration.tsx';
import { archiveDm32Capture } from './dm32Capture.ts';
import type { Dm32DebugCapture } from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';

function show(archive?: DebugArchive) {
  const ui = (a?: DebugArchive) => (
    <MantineProvider>
      <Dm32Calibration archive={a} />
    </MantineProvider>
  );
  const view = render(ui(archive));
  return { ...view, replace: (a?: DebugArchive) => view.rerender(ui(a)) };
}

const calibrated = (overrides: Partial<Dm32DebugCapture> & { calibrationAddress?: number } = {}) =>
  archiveDm32Capture(dm32CalibrationCapture(overrides));

describe('Dm32Calibration', () => {
  beforeAll(() => {
    // jsdom has no scrollIntoView; Mantine's Select calls it when an option list opens.
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    // Let the async SHA-256 settle inside act so it never updates an unmounted or idle tree.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  });

  it('says Not captured with no archive', () => {
    show();
    expect(screen.getByText('Not captured')).toBeInTheDocument();
  });

  it('decodes the live page with offset, source, separate confidences and the hardware caveat', async () => {
    show(await calibrated());
    expect(screen.getByText('Not validated on hardware')).toBeInTheDocument();
    expect(screen.getByText('0x00002000')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Calibration page fields' });
    const band = within(table).getByText('UHF band low / high').closest('tr')!;
    expect(within(band).getByText('+0x000')).toBeInTheDocument();
    expect(within(band).getByText('400 – 470 MHz')).toBeInTheDocument();
    expect(within(band).getByText(/0x00038470/)).toBeInTheDocument();
    expect(within(band).getByTitle('Layout confidence')).toHaveTextContent('Traced');
    const power = within(table).getByText('UHF TX power low').closest('tr')!;
    expect(within(power).getByTitle('Layout confidence')).toHaveTextContent('Traced');
    expect(within(power).getByTitle('Meaning confidence')).toHaveTextContent('Traced');
    const adc = within(table).getByText('ADC channel 1 count (+0x07A)').closest('tr')!;
    expect(within(adc).getByTitle('Meaning confidence')).toHaveTextContent('Partly traced');
    const unknown = within(table).getAllByText('Present, purpose unexplained')[0]!.closest('tr')!;
    expect(within(unknown).getByTitle('Layout confidence')).toHaveTextContent('Unknown');
    expect(within(unknown).getByText('Raw only')).toBeInTheDocument();
  });

  it('shows the page SHA-256 and agrees with calibration.json', async () => {
    show(await calibrated());
    const hash = await sha256Hex(dm32GoldenCalibrationPage());
    expect(await screen.findByText(hash)).toBeInTheDocument();
    expect(await screen.findByText(/Agrees with calibration\.json/)).toBeInTheDocument();
  });

  it('flags a sidecar hash that differs from the captured bytes, and trusts the bytes', async () => {
    const archive = await calibrated();
    const sidecars = {
      ...archive.sidecars,
      'calibration.json': new TextEncoder().encode(
        JSON.stringify({ sha256: '00'.repeat(32), liveAddress: 0x2000 }),
      ),
    };
    show({ ...archive, sidecars });
    expect(await screen.findByText(/Differs from calibration\.json/)).toBeInTheDocument();
    expect(screen.getByText('400 – 470 MHz')).toBeInTheDocument();
  });

  it('reports calibration.json as absent when the sidecar is missing', async () => {
    const archive = await calibrated();
    const sidecars = { ...archive.sidecars };
    delete sidecars['calibration.json'];
    show({ ...archive, sidecars });
    expect(await screen.findByText(/calibration\.json absent/)).toBeInTheDocument();
  });

  it('warns when the captured V01 differs from the layout basis', async () => {
    show(await calibrated());
    expect(screen.getByText('DM32.SYN.001')).toBeInTheDocument();
    expect(screen.getByText(/may not apply to this radio/)).toBeInTheDocument();
    expect(screen.getByText(/Running firmware and mod: Unknown/)).toBeInTheDocument();
  });

  it('does not warn when V01 equals the basis', async () => {
    const base = dm32CalibrationCapture();
    show(
      await archiveDm32Capture({
        ...base,
        vframes: base.vframes.map((v) =>
          v.id === 0x01 && v.status === 'ok'
            ? { ...v, payload: new TextEncoder().encode('DM32.01.L01.048') }
            : v,
        ),
      }),
    );
    expect(screen.getByText('DM32.01.L01.048', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText(/may not apply to this radio/)).not.toBeInTheDocument();
  });

  it('follows a relocated live page', async () => {
    show(
      await calibrated({
        calibrationAddress: 0x4000,
        window: { start: 0x1000, end: 0x4000 },
        rawRange: { start: 0x1000, end: 0x4fff },
      }),
    );
    expect(screen.getByText('0x00004000')).toBeInTheDocument();
  });

  it('lists a duplicate by address and hash without decoding it', async () => {
    const dup = dm32GoldenCalibrationPage();
    dup[0x040] = 0x11;
    show(
      await archiveDm32Capture(
        dm32Capture({
          discovered: [
            { address: 0x1000, metadata: 0x02, type: 'unknown' },
            { address: 0x2000, metadata: 0x02, type: 'unknown' },
          ],
          blocks: new Map([
            [0x1000, dm32GoldenCalibrationPage()],
            [0x2000, dup],
          ]),
        }),
      ),
    );
    expect(screen.getByText(/Duplicate tag 0x02 pages/)).toBeInTheDocument();
    expect(await screen.findByText(await sha256Hex(dup))).toBeInTheDocument();
    expect(screen.getAllByRole('table', { name: 'Calibration page fields' })).toHaveLength(1);
    expect(screen.getByText('0x00001000')).toBeInTheDocument();
  });

  it('never treats tag 0x02 outside the window as calibration', async () => {
    show(await calibrated({ calibrationAddress: 0x8000 }));
    expect(
      screen.getByText('No page tagged 0x02 was captured inside the configuration window.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/a tag 0x02 page here is not calibration/)).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Calibration page fields' }),
    ).not.toBeInTheDocument();
  });

  it('selects nothing when the archive states no window', async () => {
    const archive = await calibrated();
    show({ ...archive, manifest: { ...archive.manifest, addressBase: undefined } });
    expect(screen.getAllByText(/does not state a valid configuration window/)).toHaveLength(2);
    expect(
      screen.queryByRole('table', { name: 'Calibration page fields' }),
    ).not.toBeInTheDocument();
  });

  it('refuses a region whose stored length differs from the manifest, with its reason', async () => {
    const archive = await calibrated();
    const manifest = {
      ...archive.manifest,
      regions: archive.manifest.regions.map((r) => ({ ...r, byteLength: r.byteLength + 4096 })),
    };
    show({ ...archive, manifest });
    expect(screen.getByText(/do not match the manifest length/)).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Calibration page fields' }),
    ).not.toBeInTheDocument();
  });

  it('refuses a region that is not whole blocks', async () => {
    const archive = await calibrated();
    const id = archive.manifest.regions[0]!.id;
    const cut = archive.regions[id]!.subarray(0, 6000);
    show({
      ...archive,
      regions: { ...archive.regions, [id]: cut },
      manifest: {
        ...archive.manifest,
        regions: archive.manifest.regions.map((r) => ({ ...r, byteLength: 6000 })),
      },
    });
    expect(screen.getByText(/Not whole 4 KiB blocks/)).toBeInTheDocument();
  });

  it('refuses a wrong-model archive', async () => {
    const archive = await calibrated();
    show({ ...archive, manifest: { ...archive.manifest, radioModelId: 'retevis-rt95' } });
    expect(screen.getByText(/is not a DM-32UV capture/)).toBeInTheDocument();
  });

  it('shows invalid BCD as raw with a reason and never as zero', async () => {
    const page = dm32GoldenCalibrationPage();
    page[0x001] = 0x4a;
    show(
      await archiveDm32Capture(
        dm32Capture({
          discovered: [{ address: 0x1000, metadata: 0x02, type: 'unknown' }],
          blocks: new Map([[0x1000, page]]),
        }),
      ),
    );
    const band = screen.getByText('UHF band low / high').closest('tr')!;
    expect(within(band).getByText(/invalid BCD/)).toBeInTheDocument();
    expect(within(band).getByText(/not BCD/)).toBeInTheDocument();
    expect(within(band).getByText(/4a/)).toBeInTheDocument();
  });

  it('decodes the kept factory sector without rendering the anti-clone key', async () => {
    show(await calibrated({ factory: { status: 'kept', bytes: dm32FactoryBytes() } }));
    const table = screen.getByRole('table', { name: 'Factory sector fields' });
    expect(within(table).getByText('GPS option (+0x80 bit 2)')).toBeInTheDocument();
    expect(within(table).getByText(/0xA5: 136–174/)).toBeInTheDocument();
    expect(await screen.findByText(/Agrees with factory-sector\.json/)).toBeInTheDocument();
    expect(table).not.toHaveTextContent(/d1 d2 d3 d4/i);
    expect(screen.getByText('0xA0A1A2A3A4A5A6A7A8A9AAAB')).toBeInTheDocument();
    expect(screen.getByText(/Chip UID, not a serial/)).toBeInTheDocument();
  });

  it('shows the anti-clone key only in the raw factory hex', async () => {
    show(await calibrated({ factory: { status: 'kept', bytes: dm32FactoryBytes() } }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Raw bytes source' }));
    fireEvent.click(await screen.findByRole('option', { name: /Factory sector/ }));
    const hex = screen.getByLabelText('Hexadecimal bytes');
    expect(hex).toHaveTextContent('0x0300B000');
    // The key sits at +0x10C, on the second 256-byte page.
    expect(hex).not.toHaveTextContent('d1 d2 d3 d4');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText('Hexadecimal bytes')).toHaveTextContent('d1 d2 d3 d4');
  });

  it('says why the factory sector is not kept, and Not captured when nothing is recorded', async () => {
    const mismatch = await calibrated();
    const first = show(mismatch);
    expect(screen.getByText('Not kept (two reads disagreed).')).toBeInTheDocument();
    first.unmount();
    const sidecars = { ...mismatch.sidecars };
    delete sidecars['factory-sector.json'];
    show({ ...mismatch, sidecars });
    expect(screen.getAllByText('Not captured').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Not kept/)).not.toBeInTheDocument();
  });

  it('shows the whole captured page as paged raw hex', async () => {
    show(await calibrated());
    const hex = screen.getByLabelText('Hexadecimal bytes');
    expect(hex).toHaveTextContent('0x00002000');
    expect(screen.getByText('Page 1 of 16')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 16')).toBeInTheDocument();
    expect(screen.getByLabelText('Hexadecimal bytes')).toHaveTextContent('0x00002100');
  });

  it('refreshes everything when the archive is replaced, and renders a reopened file identically', async () => {
    const first = await calibrated();
    const second = await calibrated({
      calibrationAddress: 0x4000,
      window: { start: 0x1000, end: 0x4000 },
      rawRange: { start: 0x1000, end: 0x4fff },
    });
    const view = show(first);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 16')).toBeInTheDocument();
    view.replace(second);
    expect(screen.getByText('0x00004000')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 16')).toBeInTheDocument();
    view.replace(first);
    const live = screen.getByRole('table', { name: 'Calibration page fields' }).textContent;
    view.unmount();
    // The same archive reopened from its zip bytes (a file) decodes to the same table.
    const reopened = { ...openDebugArchive(first.zipBytes, 'DM-32UV'), source: 'file' as const };
    show(reopened);
    expect(screen.getByRole('table', { name: 'Calibration page fields' }).textContent).toBe(live);
  });

  it('opens no transport', async () => {
    const requestPort = vi.fn();
    const getPorts = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, serial: { requestPort, getPorts } });
    show(await calibrated());
    expect(requestPort).not.toHaveBeenCalled();
    expect(getPorts).not.toHaveBeenCalled();
  });

  it('keeps unrelated blocks out of the calibration table', async () => {
    show(await archiveDm32Capture(dm32Capture({ blocks: new Map([[0x1000, dm32Page(0x12)]]) })));
    expect(
      screen.getByText('No page tagged 0x02 was captured inside the configuration window.'),
    ).toBeInTheDocument();
  });
});

import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dm32CalibrationView } from '@integrations/radio-io/radios/dm32uv/debugCalibrationView.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { CalibrationTab, type CalibrationTabProps } from './CalibrationTab.tsx';
import {
  dm32CalibrationCapture,
  dm32FactoryBytes,
  dm32GoldenCalibrationPage,
} from './dm32Archive.fixture.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import type { Dm32DebugCapture } from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';

afterEach(cleanup);

function show(props: Partial<CalibrationTabProps>) {
  const full: CalibrationTabProps = {
    calibration: dm32CalibrationView,
    entries: [],
    readId: null,
    overlayId: null,
    onRead: () => {},
    onOverlay: () => {},
    ...props,
  };
  const ui = (p: CalibrationTabProps) => (
    <MantineProvider>
      <CalibrationTab {...p} />
    </MantineProvider>
  );
  const view = render(ui(full));
  return {
    ...view,
    replace: (next: Partial<CalibrationTabProps>) => view.rerender(ui({ ...full, ...next })),
  };
}

const calibrated = (overrides: Partial<Dm32DebugCapture> & { calibrationAddress?: number } = {}) =>
  archiveDm32Capture(dm32CalibrationCapture(overrides));

describe('DM-32UV on the shared Calibration tab', () => {
  it('asks for a capture when there is none', () => {
    show({});
    expect(screen.getByText(/Open or read a capture/)).toBeInTheDocument();
  });

  it('draws the notice, the chart cards and the striped tables with both confidence badges', async () => {
    show({ archive: await calibrated() });
    expect(screen.getByText('Not validated on hardware')).toBeInTheDocument();
    expect(screen.getByText('UHF TX power')).toBeInTheDocument();
    expect(screen.getByText('VHF squelch thresholds, pair 1')).toBeInTheDocument();
    expect(screen.getByText('108–136 MHz squelch thresholds')).toBeInTheDocument();
    expect(screen.getByText('Battery')).toBeInTheDocument();
    expect(screen.getByText(/^0x00002000 · tag 0x02/)).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Band limits' });
    const band = within(table).getByText('UHF band low / high').closest('tr')!;
    expect(within(band).getByText('400 – 470 MHz')).toBeInTheDocument();
    expect(within(band).getAllByText(/0x00038470/)[0]).toBeInTheDocument();
    // Both badges print in full, never cut to "TR…".
    expect(within(band).getAllByText('traced')).toHaveLength(4);
    expect(screen.getByText('Raw captured bytes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /write|restore/i })).not.toBeInTheDocument();
  });

  it('warns when the captured V01 differs from the layout basis', async () => {
    show({ archive: await calibrated() });
    expect(screen.getByText(/Captured V01 base version: DM32\.SYN\.001/)).toBeInTheDocument();
    expect(screen.getByText(/may not apply to this radio/)).toBeInTheDocument();
  });

  it('shows the Not captured reason when no page is inside the window', async () => {
    show({ archive: await calibrated({ calibrationAddress: 0x8000 }) });
    expect(screen.getByText(/No page tagged 0x02 was captured/)).toBeInTheDocument();
    expect(screen.getByText(/a tag 0x02 page here is not calibration/)).toBeInTheDocument();
  });

  it('refuses a wrong-model archive', async () => {
    const archive = await calibrated();
    show({
      archive: { ...archive, manifest: { ...archive.manifest, radioModelId: 'retevis-rt95' } },
    });
    expect(screen.getByText(/is not a DM-32UV capture/)).toBeInTheDocument();
  });

  it('follows a relocated page, and a reopened file renders the same facts', async () => {
    const first = await calibrated();
    const second = await calibrated({
      calibrationAddress: 0x4000,
      window: { start: 0x1000, end: 0x4000 },
      rawRange: { start: 0x1000, end: 0x4fff },
    });
    const view = show({ archive: first });
    view.replace({ archive: second });
    expect(screen.getByText(/^0x00004000 · tag 0x02/)).toBeInTheDocument();
    view.unmount();
    const reopened: DebugArchive = {
      ...openDebugArchive(first.zipBytes, 'DM-32UV'),
      source: 'file',
    };
    show({ archive: reopened });
    expect(screen.getByText(/^0x00002000 · tag 0x02/)).toBeInTheDocument();
  });

  it('decodes the kept factory sector and puts the anti-clone key only in the raw bytes', async () => {
    show({ archive: await calibrated({ factory: { status: 'kept', bytes: dm32FactoryBytes() } }) });
    const table = screen.getByRole('table', { name: 'Factory sector: options' });
    expect(within(table).getByText('GPS option (+0x80 bit 2)')).toBeInTheDocument();
    expect(within(table).getByText(/0xA5: 136–174/)).toBeInTheDocument();
    expect(table).not.toHaveTextContent(/d1 d2 d3 d4/i);
    expect(screen.getByText(/Agrees with factory-sector\.json/)).toBeInTheDocument();
    expect(screen.getByText('Chip UID, not a serial').nextElementSibling).toHaveTextContent(
      '0xA0A1A2A3A4A5A6A7A8A9AAAB',
    );
  });

  it('pairs an overlay read by chart id and reports the differences', async () => {
    const other = dm32GoldenCalibrationPage();
    other[0x040] = 0x11;
    const base = await calibrated();
    const changed = await archiveDm32Capture(
      dm32CalibrationCapture({
        blocks: new Map([
          [0x1000, new Uint8Array(4096).fill(0x12, 4095)],
          [0x2000, other],
        ]),
      }),
    );
    show({ archive: base, overlayArchive: changed });
    expect(screen.getAllByText(/values? differ|same in both/).length).toBeGreaterThan(0);
  });

  it('opens no transport', async () => {
    const requestPort = vi.fn();
    const getPorts = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, serial: { requestPort, getPorts } });
    show({ archive: await calibrated() });
    fireEvent.click(screen.getAllByRole('button', { name: /Numeric table/ })[0]!);
    expect(requestPort).not.toHaveBeenCalled();
    expect(getPorts).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

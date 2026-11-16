import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { rt95CalibrationView } from '@integrations/radio-io/radios/rt95/debugCalibrationView.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { CalibrationTab, type CalibrationTabProps } from './CalibrationTab.tsx';

afterEach(cleanup);

function archive(bytes?: Uint8Array): DebugArchive {
  const regions = bytes
    ? [
        {
          id: 'rt95-calibration',
          label: 'Calibration',
          address: 0x3b00,
          byteLength: bytes.length,
          path: 'regions/rt95-calibration.bin',
          restoreRole: 'inspect-only' as const,
        },
      ]
    : [
        {
          id: 'programming-image',
          label: 'Clone',
          address: 0,
          byteLength: 2,
          path: 'regions/image.bin',
          restoreRole: 'inspect-only' as const,
        },
      ];
  return openDebugArchive(
    packRadioBackupZip(
      {
        format: 'codeplug-studio-radio-backup',
        version: 1,
        capturedAt: '2026-01-01',
        capturedVia: 'file',
        app: { buildEnv: 'test', buildVersion: 'test' },
        radioModelId: 'retevis-rt95',
        descriptorLabel: 'RT95',
        coverage: 'partial',
        imageByteLength: bytes?.length ?? 2,
        regions,
      },
      bytes ? { 'rt95-calibration': bytes } : { 'programming-image': new Uint8Array(2) },
    ),
    'retevis-rt95',
  );
}

function bytes(edit: (b: Uint8Array) => void = () => {}) {
  const b = new Uint8Array(0x4c0);
  for (let i = 0; i < 39; i++) {
    b[0x3cc0 - 0x3b00 + i] = 100 + i;
    b[0x3d00 - 0x3b00 + i] = 100 + i;
    b[0x3d40 - 0x3b00 + i] = 100 + i;
  }
  b.set([0x20, 0x21, 0x22], 0x3f81 - 0x3b00);
  edit(b);
  return b;
}

function show(props: Partial<CalibrationTabProps>) {
  const full: CalibrationTabProps = {
    calibration: rt95CalibrationView,
    entries: [],
    readId: null,
    overlayId: null,
    onRead: () => {},
    onOverlay: () => {},
    ...props,
  };
  return render(
    <MantineProvider>
      <CalibrationTab {...full} />
    </MantineProvider>,
  );
}

describe('CalibrationTab', () => {
  it('asks for a capture when there is none', () => {
    show({});
    expect(screen.getByText(/Open or read a capture/)).toBeInTheDocument();
  });

  it('says a read without the calibration region is not captured', () => {
    show({ archive: archive() });
    expect(screen.getByText(/no calibration region/)).toBeInTheDocument();
  });

  it('draws the notice, labelled charts, tables and folded sections without write controls', () => {
    show({ archive: archive(bytes()) });
    expect(screen.getByText('Not validated on hardware')).toBeInTheDocument();
    expect(screen.getByText('VHF power, 136–174 MHz')).toBeInTheDocument();
    expect(screen.getByText('UHF power, 400–490 MHz')).toBeInTheDocument();
    expect(screen.getByText('Production record')).toBeInTheDocument();
    expect(screen.getByText('Power and squelch bases')).toBeInTheDocument();
    expect(screen.getByText('Raw captured bytes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /write|restore/i })).not.toBeInTheDocument();
  });

  it('shows Read and Overlay pickers when the page has a read history', () => {
    show({
      archive: archive(bytes()),
      entries: [
        { id: 'a', label: 'Read 1', readAt: '2026-01-01T10:00:00Z' },
        { id: 'b', label: 'Read 2', readAt: '2026-01-01T11:00:00Z' },
      ],
      readId: 'a',
    });
    expect(screen.getByRole('combobox', { name: 'Read' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Overlay (optional)' })).toBeInTheDocument();
  });

  it('has no pickers without a history', () => {
    show({ archive: archive(bytes()) });
    expect(screen.queryByRole('combobox', { name: 'Read' })).not.toBeInTheDocument();
  });

  it('pairs an overlay read by chart id and reports the differences', () => {
    const a = archive(bytes());
    const b = archive(bytes((x) => (x[0x3cc0 - 0x3b00] = 5)));
    show({ archive: a, overlayArchive: b });
    expect(screen.getAllByText(/values? differ|same in both/).length).toBeGreaterThan(0);
  });

  it('says so when the overlay read has no calibration', () => {
    show({ archive: archive(bytes()), overlayArchive: archive() });
    expect(screen.getByText('Overlay not shown')).toBeInTheDocument();
  });

  it('masks the program password until Show password is pressed', () => {
    show({
      archive: archive(bytes((b) => b.set([0x50, 0x57, 0x31, 0x32], 0x3b18 - 0x3b00))),
    });
    expect(document.body.textContent).not.toContain('PW12');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(document.body.textContent).toContain('PW12');
  });
});

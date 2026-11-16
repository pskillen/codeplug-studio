import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { HexViewer } from './ArchiveViewers.tsx';
import { openDebugArchive } from './captureArchive.ts';
import { Rt95Calibration, Rt95CalibrationDiff } from './Rt95Calibration.tsx';
import { hexRows, sensitiveRanges } from './viewerUtils.ts';

/** Synthetic calibration prefix: "PW12" at the stored program password (0x3B18). */
function calibrationArchive(password = [0x50, 0x57, 0x31, 0x32]) {
  const bytes = new Uint8Array(0x20);
  bytes.set(password, 0x18);
  const region = {
    id: 'rt95-calibration',
    label: 'Calibration',
    address: 0x3b00,
    byteLength: bytes.length,
    path: 'regions/rt95-calibration.bin',
    restoreRole: 'inspect-only' as const,
  };
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
        imageByteLength: bytes.length,
        regions: [region],
      },
      { 'rt95-calibration': bytes },
    ),
    'retevis-rt95',
  );
}

const wrap = (node: React.ReactNode) => <DesignSystemV2Provider>{node}</DesignSystemV2Provider>;
const bodyText = () => document.body.textContent ?? '';

describe('RT95 password masking', () => {
  it('hides the program password in the calibration viewer until shown, and hides it again', () => {
    render(wrap(<Rt95Calibration archive={calibrationArchive()} />));
    expect(bodyText()).not.toMatch(/50 57 31 32/i);
    expect(bodyText()).toContain('•• •• •• ••');
    const button = screen.getByRole('button', { name: 'Show password' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    expect(bodyText()).toMatch(/50 57 31 32/i);
    const hide = screen.getByRole('button', { name: 'Hide password' });
    expect(hide).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(hide);
    expect(bodyText()).not.toMatch(/50 57 31 32/i);
  });

  it('shows the program password hex and ASCII, labelled unconfirmed, only after reveal', () => {
    render(wrap(<Rt95Calibration archive={calibrationArchive()} />));
    expect(bodyText()).not.toContain('"PW12"');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(bodyText()).toContain('50 57 31 32 · ASCII "PW12" · encoding unconfirmed');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(bodyText()).not.toContain('"PW12"');
  });

  it('gives hex only when the program password bytes are not printable', () => {
    render(wrap(<Rt95Calibration archive={calibrationArchive([0x01, 0x02, 0x03, 0x04])} />));
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(bodyText()).toContain('01 02 03 04 · encoding unconfirmed');
    expect(bodyText()).not.toContain('ASCII "');
  });

  it('hides the password again when another archive is shown', () => {
    const view = render(wrap(<Rt95Calibration archive={calibrationArchive()} />));
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(bodyText()).toMatch(/50 57 31 32/i);
    view.rerender(wrap(<Rt95Calibration archive={calibrationArchive()} />));
    expect(bodyText()).not.toMatch(/50 57 31 32/i);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('hides the password bytes and their ASCII in the hex viewer', () => {
    render(wrap(<HexViewer archive={calibrationArchive()} />));
    const hex = screen.getByLabelText('Hexadecimal bytes').textContent ?? '';
    expect(hex).not.toMatch(/50 57 31 32/);
    expect(hex).not.toContain('PW12');
    expect(hex).toContain('•• •• •• ••');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    const shown = screen.getByLabelText('Hexadecimal bytes').textContent ?? '';
    expect(shown).toMatch(/50 57 31 32/);
    expect(shown).toContain('PW12');
  });

  it('says a password changed between reads without showing either value', () => {
    render(
      wrap(
        <Rt95CalibrationDiff
          first={calibrationArchive()}
          second={calibrationArchive([0x41, 0x42, 0x43, 0x44])}
        />,
      ),
    );
    expect(
      screen.getByText(/Program password compare \(0x00003B18\): changed$/),
    ).toBeInTheDocument();
    expect(bodyText()).not.toMatch(/50 57 31 32|41 42 43 44/);
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(bodyText()).toMatch(/50 57 31 32 → 41 42 43 44/);
  });

  it('masks the power-on password digits in the RT95 programming image', () => {
    const archive = calibrationArchive();
    const image = new Uint8Array(0x10);
    image.set([0x31, 0x32, 0x33, 0x34, 0x35, 0x36], 0);
    const mask = sensitiveRanges(archive, 'programming-image');
    const [row] = hexRows(image, 0x3240, 0, mask);
    expect(row!.hex.startsWith('•• •• •• •• •• •• 00')).toBe(true);
    expect(row!.ascii).not.toContain('123456');
  });

  it('masks nothing for other radios', () => {
    const archive = calibrationArchive();
    const other = { ...archive, manifest: { ...archive.manifest, radioModelId: 'other' } };
    expect(sensitiveRanges(other, 'rt95-calibration')).toEqual([]);
  });
});
